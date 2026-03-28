# AGENTS.md - Dropifi v2

## Project Overview

Dropifi is a **minimal, developer-first file drop service** (like 0x0.st). This is a learning-focused project to demonstrate backend engineering skills.

**Tech Stack (v2):**
- TypeScript 6
- Fastify 5 (web framework)
- PostgreSQL (metadata storage)
- Object Storage (file storage - future)
- ES Modules

---

## Learning Approach

### Development Philosophy

**Step-by-step development:**
1. Understand the concept before implementing
2. Compare v1 (Express) vs v2 (Fastify) approaches
3. Implement one thing at a time
4. Verify understanding before moving on
5. Always explain *why*, not just *what*

**When implementing features:**
1. First understand what the feature does
2. Look at how v1 does it (if applicable)
3. Understand the architectural difference in v2
4. Implement and verify
5. Update AGENTS.md with learnings

---

## Complete Feature Checklist

### Core Features (Implemented)
| Feature | Status | Notes |
|---------|--------|-------|
| File Upload (`POST /`) | ✅ | Multipart handling |
| File Download (`GET /files/:id`) | ✅ | Database lookup |
| PostgreSQL Integration | ✅ | Connection pooling, schema |
| Validation | ✅ | Size, MIME, extension |
| Config-driven | ✅ | All in config.json |

### Core Features (Pending)
| Feature | Priority | Notes |
|---------|----------|-------|
| TTL/Cleanup | High | Expired file removal |
| Expiry calculation (v1 style) | High | File size → expiry time |
| Magic byte detection | Medium | Real MIME verification |
| Password protection | Medium | Optional file security |

### Advanced Features (Future)
| Feature | Priority | Notes |
|---------|----------|-------|
| Object Storage (S3/MinIO) | High | Replace local disk |
| CDN integration | Medium | For downloads |
| Rate limiting | Medium | Abuse prevention |
| Download limits | Low | Max downloads per file |
| CLI tool | Low | Terminal-first UX |

### Infrastructure (Future)
| Feature | Priority | Notes |
|---------|----------|-------|
| Background workers | High | Async cleanup |
| Redis caching | Medium | Rate limiting, sessions |
| Load balancer | Low | Horizontal scaling |

---

## v1 vs v2 Architecture Comparison

### Framework Choice: Express vs Fastify

| Aspect | v1 (Express) | v2 (Fastify) |
|--------|--------------|--------------|
| Architecture | Middleware chain | Plugin system |
| Encapsulation | Global middleware | Scoped plugins |
| Performance | Moderate | 2-3x faster |
| TypeScript | Manual types | Better inference |
| Validation | External (joi/zod) | Built-in JSON schema |
| Logging | External (morgan) | Built-in (Pino) |

### Storage Evolution

| Version | Storage | Why |
|---------|---------|-----|
| v1 | Local filesystem | Simple, single-server |
| v2 (current) | Local filesystem | Development |
| v2 (target) | Object Storage (S3) | Scalable, distributed |

### Database Evolution

| Version | Database | Why |
|---------|----------|-----|
| v1 | SQLite | Single-node, embedded |
| v2 | PostgreSQL | Scalable, connection pooling |

---

## Configuration

All configuration is in `server/config/config.json`:

```json
{
    "PORT": 5000,
    "UPLOAD_DESTINATION": "/tmp/dropifi-uploads",
    "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/dropifi",
    "MAX_FILE_SIZE": 104857000,
    "MAX_EXT_LENGTH": 10,
    "MIN_AGE": 1,
    "MAX_AGE": 30,
    "DEFAULT_EXPIRY_HOURS": 24,
    "MIME_BLACKLIST": [
        "application/x-dosexec",
        "application/x-executable",
        ...
    ]
}
```

**Config Options Explained:**

| Option | Type | Description |
|--------|------|-------------|
| PORT | number | Server port |
| UPLOAD_DESTINATION | string | Where files are stored |
| DATABASE_URL | string | PostgreSQL connection string |
| MAX_FILE_SIZE | number | Max file size in bytes (100MB) |
| MAX_EXT_LENGTH | number | Max extension length |
| MIN_AGE | number | Min file age in days |
| MAX_AGE | number | Max file age in days |
| DEFAULT_EXPIRY_HOURS | number | Default TTL for uploads |
| MIME_BLACKLIST | string[] | Blocked file types |

---

## Build Commands

```bash
npm run build      # Compile TypeScript
npm run dev        # Development (tsx watch)
npm start          # Production
npm run typecheck  # tsc --noEmit
```

**Environment Variables:**
- `DATABASE_URL` - Override database URL from config

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## Code Style Guidelines

### Formatting
- 4 spaces indentation
- K&R braces (same line)
- Semicolons required
- Double quotes

### Import Organization
1. External frameworks (Fastify)
2. Fastify plugins (@fastify/*)
3. Node built-ins (fs, path)
4. Config files
5. Internal modules (./storage, ./db, ./services)

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `file-routes.ts` |
| Interfaces | PascalCase | `FileRecord` |
| Variables | camelCase | `fileSize` |
| Constants | PascalCase | `MAX_FILE_SIZE` |
| Functions | camelCase | `validateMimeType` |
| Config keys | PascalCase | `MAX_FILE_SIZE` |

---

## Directory Structure

```
server/
├── config/
│   └── config.json           # All configuration here
├── src/
│   ├── server.ts             # Entry point
│   ├── storage/              # Storage abstraction
│   │   ├── storage.interface.ts
│   │   ├── local-disk.ts
│   │   └── index.ts
│   ├── services/             # Business logic
│   │   ├── validation.ts
│   │   └── index.ts
│   ├── db/                   # Database layer
│   │   └── index.ts
│   └── types/                # TypeScript types (future)
├── package.json
└── tsconfig.json
```

---

## Error Handling Patterns

### Fastify Style
```typescript
// Route errors
if (!validation.valid) {
    return reply.status(400).send(validation.error);
}

// Database errors
try {
    await client.query(...);
} finally {
    client.release();
}

// Critical errors
app.listen({ port }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});
```

### Best Practices
- Use appropriate HTTP status codes
- Log errors with context
- Never leak stack traces in production

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Fastify Server                      │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐  │
│  │ POST /       │    │ GET /files/:id               │  │
│  │ (upload)     │    │ (download)                   │  │
│  └──────┬───────┘    └───────────┬──────────────────┘  │
│         ↓                         ↓                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Validation Service                         │    │
│  │  - File size check                               │    │
│  │  - MIME type check                               │    │
│  │  - Extension check                                │    │
│  └─────────────────────────────────────────────────┘    │
│         ↓                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │         LocalDiskStorage                          │    │
│  │  - Saves to UPLOAD_DESTINATION                   │    │
│  └─────────────────────────────────────────────────┘    │
│         ↓                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │         PostgreSQL (metadata)                     │    │
│  │  - storage_key, original_name, mime, size        │    │
│  │  - expires_at, created_at                        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## v1 Reference

**Always read `dropifi-v1/` before implementing features.**

Key files:
- `src/server.ts` - Upload pipeline, route handling
- `src/cleanup.ts` - TTL cleanup logic
- `config/config.json` - All configuration options

**Reuse from v1:**
- Config structure and options
- MIME blacklist
- Expiry calculation formula
- Validation patterns
- Security approach

**Do NOT copy:**
- SQLite code
- Express-specific patterns
- Local filesystem coupling (keep abstraction)

---

## Questions to Ask Before Implementing

When adding a feature, always consider:

1. **What does this feature do?** (clear the "what")
2. **How does v1 do it?** (reference implementation)
3. **Why is v2 different?** (architectural change)
4. **What tradeoffs?** (performance, complexity, scalability)
5. **What could go wrong?** (error handling)
6. **Where in the architecture does this fit?**
7. **What config options does it need?**

---

## Next Steps

1. **TTL/Cleanup** - Remove expired files automatically
2. **Expiry calculation** - v1-style: larger files = shorter expiry
3. **Magic byte detection** - Verify actual MIME type
4. **Object Storage** - Replace LocalDiskStorage with S3

---

## Constraints

### Do
- Build incrementally
- Understand before implementing
- Compare v1 vs v2 approaches
- Keep minimal API surface
- All config in config.json

### Do NOT
- Store files locally in production (use S3)
- Use SQLite (use PostgreSQL)
- Block requests with heavy processing
- Tightly couple storage to API
