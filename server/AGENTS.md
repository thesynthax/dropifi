# AGENTS.md - Dropifi v2

## Project Overview

Dropifi is a **minimal, developer-first file drop service** (like 0x0.st). The core concept is simple: upload a file via `curl` or browser, get an instant shareable URL, files expire automatically.

```
curl -F "file=@document.pdf" http://localhost:5000/
→ {"url":"/files/abc123.pdf","expires_at":"2026-03-29T12:00:00.000Z"}
```

**Tech Stack (v2 - Production Ready):**
- TypeScript 6 (strict mode, ES Modules)
- Fastify 5 (web framework)
- PostgreSQL (metadata with connection pooling)
- MinIO/S3 (object storage)
- Redis (caching, rate limiting, BullMQ)
- BullMQ (background job processing)
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

### Core Features (Implemented ✅)
| Feature | Status | Notes |
|---------|--------|-------|
| File Upload (`POST /`) | ✅ | Multipart handling |
| File Download (`GET /files/:id`) | ✅ | Database lookup |
| PostgreSQL Integration | ✅ | Connection pooling, schema |
| Validation (size, MIME, extension) | ✅ | Configurable limits |
| Magic Byte Detection | ✅ | file-type library |
| Smart Expiry Calculation | ✅ | Cubic formula (v1 style) |
| TTL Cleanup | ✅ | BullMQ + Redis |
| Storage Abstraction | ✅ | LocalDisk, S3, MinIO |
| Rate Limiting | ✅ | Sliding window (Redis) |
| Graceful Shutdown | ✅ | Pool/Redis cleanup |
| Password Protection | ✅ | bcrypt, per-file lockout |

### Advanced Features (Future)
| Feature | Priority | Notes |
|---------|----------|-------|
| Download Limits | Low | Max downloads per file |
| CLI Tool | Low | Terminal-first UX |
| CDN Integration | Medium | For downloads |
| Pre-signed Uploads | Low | Direct-to-S3 |

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
| v2 (dev) | Local filesystem | Development |
| v2 (prod) | Object Storage (S3/MinIO) | Scalable, distributed |

### Database Evolution

| Version | Database | Why |
|---------|----------|-----|
| v1 | SQLite | Single-node, embedded |
| v2 | PostgreSQL | Scalable, connection pooling |

---

## Current Architecture

```
                    Client
                       ↓
              ┌───────────────┐
              │ Load Balancer │ (future)
              └───────────────┘
                       ↓
       ┌──────────────────────────────┐
       │   Stateless API Servers     │ ← Fastify
       └──────────────────────────────┘
                       ↓
    ┌────────────────────────────────────────┐
    │                                        │
    │  PostgreSQL ──── Object Storage ──── Redis  │
    │   (metadata)    (S3/MinIO)    (queue/cache) │
    │                                        │
    └────────────────────────────────────────┘
                       ↓
    ┌────────────────────────────────────────┐
    │   Background Workers (BullMQ)          │
    │   - TTL Cleanup                        │
    └────────────────────────────────────────┘
```

---

## Configuration

All configuration is in `server/config/config.json`:

```json
{
    "PORT": 5000,
    "STORAGE_TYPE": "minio",
    "S3_ENDPOINT": "http://localhost:9000",
    "S3_BUCKET": "dropifi",
    "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/dropifi",
    "REDIS_URL": "redis://localhost:6379",
    "RATE_LIMIT_ENABLED": true,
    "RATE_LIMIT_WINDOW_MS": 60000,
    "RATE_LIMIT_MAX_REQUESTS": 10,
    "CLEANUP_INTERVAL_HOURS": 24,
    "MAX_FILE_SIZE": 104857000,
    "MIN_AGE": 1,
    "MAX_AGE": 30,
    "TRUST_PROXY": false,
    "PASSWORD_PROTECTION_ENABLED": true,
    "BCRYPT_ROUNDS": 12,
    "PASSWORD_MIN_LENGTH": 4,
    "MAX_AUTH_ATTEMPTS": 5,
    "AUTH_LOCKOUT_DURATION_MS": 300000,
    "MIME_BLACKLIST": [...]
}
```

**Config Options Explained:**

| Option | Type | Description |
|--------|------|-------------|
| PORT | number | Server port |
| STORAGE_TYPE | string | "local", "s3", or "minio" |
| S3_ENDPOINT | string | S3/MinIO endpoint URL |
| S3_BUCKET | string | Bucket name |
| DATABASE_URL | string | PostgreSQL connection string |
| REDIS_URL | string | Redis connection string |
| RATE_LIMIT_ENABLED | boolean | Enable/disable rate limiting |
| RATE_LIMIT_WINDOW_MS | number | Time window for rate limiting |
| RATE_LIMIT_MAX_REQUESTS | number | Max requests per window |
| CLEANUP_INTERVAL_HOURS | number | Hours between cleanup runs |
| MAX_FILE_SIZE | number | Max file size in bytes (100MB) |
| MIN_AGE | number | Min file age in days |
| MAX_AGE | number | Max file age in days |
| TRUST_PROXY | boolean | Trust X-Forwarded-For header |
| PASSWORD_PROTECTION_ENABLED | boolean | Enable/disable password protection |
| BCRYPT_ROUNDS | number | bcrypt cost factor (default 12) |
| PASSWORD_MIN_LENGTH | number | Min password length (default 4) |
| MAX_AUTH_ATTEMPTS | number | Max failed attempts before lockout |
| AUTH_LOCKOUT_DURATION_MS | number | Lockout duration in ms |
| MIME_BLACKLIST | string[] | Blocked file types |

---

## Build Commands

```bash
npm run build      # Compile TypeScript → dist/
npm run dev        # Development (tsx watch)
npm start          # Production (node dist/server.js)
```

**Environment Variables (override config):**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "sourceMap": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Build Output:** TypeScript compiles to `dist/` (not `src/`).

---

## Directory Structure

```
server/
├── config/
│   └── config.json           # All configuration here
├── src/
│   ├── server.ts             # Entry point, routes
│   ├── lib/
│   │   └── redis.ts          # Redis connection
│   ├── db/
│   │   └── index.ts          # PostgreSQL pool
│   ├── storage/
│   │   ├── storage.interface.ts
│   │   ├── local-disk.ts
│   │   ├── s3-storage.ts
│   │   ├── factory.ts        # createStorage()
│   │   └── index.ts
│   ├── services/
│   │   ├── validation.ts     # File validation
│   │   ├── expiry.ts        # TTL calculation
│   │   ├── cleanup.ts       # Cleanup service
│   │   ├── rate-limit.ts   # Rate limiting
│   │   ├── password.ts     # Password hashing & auth
│   │   └── index.ts
│   └── queues/
│       └── cleanup.ts        # BullMQ worker
├── dist/                     # Compiled output
├── package.json
└── tsconfig.json
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
| Files | kebab-case | `local-disk.ts` |
| Interfaces | PascalCase | `StorageService` |
| Variables | camelCase | `fileSize` |
| Constants | PascalCase | `MAX_FILE_SIZE` |
| Functions | camelCase | `validateMimeType` |
| Config keys | PascalCase | `MAX_FILE_SIZE` |

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

## Security Considerations

### Implemented Protections

| Protection | Implementation |
|------------|----------------|
| Path Traversal | Regex validation: `/^[\w-]+\.[\w]+$/` |
| Header Injection | Sanitize filename: remove `"`, `\n`, `\r`, `\t` |
| MIME Spoofing | Magic byte detection via `file-type` |
| Rate Limiting | Sliding window with Redis sorted sets |
| IP Spoofing | `TRUST_PROXY` config option |
| Password Protection | bcrypt hashing with configurable cost |
| Auth Rate Limiting | Per-file lockout via Redis |

### Input Validation Points
1. **File size** - Reject > MAX_FILE_SIZE
2. **MIME type** - Check against blacklist
3. **Extension** - Max length check
4. **Magic bytes** - Verify actual content
5. **Storage key** - Regex pattern match
6. **Filename** - Sanitize special characters
7. **Password** - Min length check, bcrypt hashing

---

## Password Protection

### Upload with Password
```bash
curl -F "file=@secret.pdf" -F "pass=secret123" http://localhost:5000/
```
Response (passwordless):
```
http://localhost:5000/files/abc123.pdf
2026-03-30T12:00:00.000Z
```

Response (password protected):
```
http://localhost:5000/files/abc123.pdf
2026-03-30T12:00:00.000Z

Password protected. Access via:
  Header: X-Dropifi-Password: <your-password>
  Basic Auth: Authorization: Basic base64(:<your-password>)
```

### Download with Password (Two Methods)

**Method 1: Custom Header (curl)**
```bash
curl -H "X-Dropifi-Password: secret123" http://localhost:5000/files/abc123.pdf -o secret.pdf
```

**Method 2: Basic Auth (browser + curl)**
```bash
# Browser: Shows native username/password dialog (username ignored)
# curl: Use empty username
curl -u ":secret123" http://localhost:5000/files/abc123.pdf -o secret.pdf

# Or manually construct Basic Auth header
curl -H "Authorization: Basic $(echo -n ':secret123' | base64)" http://localhost:5000/files/abc123.pdf -o secret.pdf
```

### Browser Preview
Files that can be previewed in browser (inline):
- Images: jpeg, png, gif, webp, svg, bmp
- PDF: application/pdf
- Text: plain, html, css, js, json
- Media: mp3, ogg, wav, mp4, webm, ogg

Other files are downloaded as attachments.

### Auth Lockout
- After 5 failed attempts, file is locked for 5 minutes
- Lockout tracked in Redis: `dropifi:auth:lockout:{storageKey}`
- Successful auth clears all failed attempts

### v1 vs v2 Password Protection

| Aspect | v1 | v2 |
|--------|----|-----|
| Hashing | bcrypt, cost 10 (hardcoded) | bcrypt, cost configurable |
| Download Auth | Basic Auth only | Both Basic Auth + X-Dropifi-Password |
| Auth Rate Limit | None | Per-file lockout via Redis |
| Storage | Empty string `''` | NULL (explicit) |
| Browser Preview | Yes | Yes (inline Content-Disposition) |

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

## Running Services (Docker)

```bash
# PostgreSQL (port 5432)
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dropifi -p 5432:5432 postgres:16

# Redis (port 6379)
docker run -d --name redis -p 6379:6379 redis:7

# MinIO (ports 9000, 9001)
docker run -d --name minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data --console-address ":9001"
```

---

## How to Test

```bash
cd server

# Start server
npm run dev

# Test upload
curl -F "file=@package.json" http://localhost:5000/

# Test download
curl http://localhost:5000/files/{id}

# Test rate limiting
for i in {1..12}; do curl -F "file=@package.json" http://localhost:5000/; done

# Test password protection
curl -F "file=@package.json" -F "pass=secret123" http://localhost:5000/
curl -H "X-Dropifi-Password: secret123" http://localhost:5000/files/{id} -o package.json

# Test wrong password
curl -H "X-Dropifi-Password: wrongpass" http://localhost:5000/files/{id}

# Run unit tests (requires Redis running)
npm test
```

---

## Constraints

### Do
- Build incrementally
- Understand before implementing
- Compare v1 vs v2 approaches
- Keep minimal API surface
- All config in config.json
- Use storage abstraction (never bypass)

### Do NOT
- Store files locally in production (use S3)
- Use SQLite (use PostgreSQL)
- Block requests with heavy processing
- Tightly couple storage to API
- Trust X-Forwarded-For without TRUST_PROXY

---

## Key Learnings

1. **Fastify over Express**: Plugin encapsulation, better TypeScript, 2-3x faster
2. **Storage Abstraction**: Interface pattern allows swapping LocalDisk → S3 with zero route changes
3. **Connection Pooling**: PostgreSQL pools prevent connection exhaustion
4. **Magic Bytes**: File signatures detect actual content type (not just HTTP headers)
5. **Smart Expiry**: Cubic formula - larger files get shorter TTL
6. **BullMQ/Redis**: Background workers survive server restarts, automatic retries
7. **MinIO**: Free, self-hosted S3-compatible object storage
8. **Rate Limiting**: Sliding window algorithm using Redis sorted sets
9. **Password Protection**: bcrypt hashing with per-file auth lockout via Redis

---

*Last updated: March 2026*
