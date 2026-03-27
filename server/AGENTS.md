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

### Feature Implementation Order

1. **File Upload** (`POST /`) - multipart handling
2. **Validation** - MIME, size, extension checks
3. **File Retrieval** (`GET /files/:id`)
4. **Database Integration** - PostgreSQL
5. **TTL/Cleanup** - expired file removal
6. **Password Protection** - optional security
7. **Object Storage** - replace local filesystem
8. **Rate Limiting** - abuse prevention

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

### Why Fastify?

1. **Plugin encapsulation** - plugins don't leak scope, better for large apps
2. **Performance** - critical for file upload service
3. **TypeScript-first** - better DX with types
4. **Schema validation** - catch bad input early

### Express Patterns to Fastify

**Middleware → Plugins:**
```typescript
// Express (v1)
app.use(cors());
app.use(multer());

// Fastify (v2)
await app.register(cors);
await app.register(multerPlugin);
```

**Request handling:**
```typescript
// Express (v1)
app.post("/", upload.single('file'), (req, res) => {
    const file = req.file;
    res.send({ url: file.path });
});

// Fastify (v2)
app.post("/", async (request, reply) => {
    const data = await request.file();
    return { url: data.filename };
});
```

**Key differences:**
- Fastify uses `request` and `reply` instead of `req` and `res`
- Return value becomes response (or use `reply.send()`)
- `await` for async operations
- Plugins use `await app.register()`

---

## Build Commands

```bash
npm run build    # Compile TypeScript
npm run dev      # Development (tsx watch)
npm start        # Production
npm run typecheck  # tsc --noEmit
```

**Note:** No linting/testing configured yet.

---

## TypeScript Configuration

v2 uses modern TypeScript with strict settings:

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

**Key settings explained:**
- `nodenext` - Native ESM with `.js` extensions in imports
- `verbatimModuleSyntax` - No import transformation
- `noUncheckedIndexedAccess` - Arrays must be checked for undefined

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
4. Utilities (uuid)
5. Internal modules (./routes, ./services)

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `file-routes.ts` |
| Interfaces | PascalCase | `FileRecord` |
| Variables | camelCase | `fileSize` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE` |
| Functions | camelCase | `validateMimeType` |

---

## Error Handling Patterns

### Fastify Style
```typescript
// For critical startup errors
app.listen({ port }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});

// For route errors
try {
    // operation
} catch (err) {
    console.error("Upload error:", err);
    return reply.status(500).send("Internal Server Error");
}
```

### Best Practices
- Use appropriate HTTP status codes
- Log errors with context
- Never leak stack traces in production

---

## Current Implementation Status

### Completed
- Basic Fastify server with health check

### In Progress
- File upload handling (multipart)

### Planned
- Validation layer
- PostgreSQL integration
- File retrieval
- TTL cleanup

---

## v1 Reference (Required)

**Always read `dropifi-v1/` before implementing features.**

Key files:
- `src/server.ts` - Upload pipeline, route handling
- `src/cleanup.ts` - TTL cleanup logic
- `config/config.json` - Constraints and limits

**Reuse from v1:**
- Validation logic patterns
- Config structure
- MIME blacklist
- Expiry calculation

**Do NOT copy:**
- SQLite code
- Express-specific patterns
- Local filesystem storage

---

## Configuration

Current config (`server/config/config.json`):
```json
{
    "PORT": 5000
}
```

---

## Constraints

### Do
- Build incrementally
- Understand before implementing
- Compare v1 vs v2 approaches
- Keep minimal API surface

### Do NOT
- Store files locally (use object storage in v2)
- Use SQLite (use PostgreSQL)
- Block requests with heavy processing
- Tightly couple storage to API

---

## Questions to Ask Before Implementing

When adding a feature, always consider:

1. **What does this feature do?** (clear the "what")
2. **How does v1 do it?** (reference implementation)
3. **Why is v2 different?** (architectural change)
4. **What tradeoffs?** (performance, complexity, scalability)
5. **What could go wrong?** (error handling)

---

## Directory Structure (Target)

```
server/
├── src/
│   ├── server.ts           # Entry point
│   ├── routes/             # Route handlers
│   │   ├── upload.ts
│   │   └── files.ts
│   ├── services/           # Business logic
│   │   ├── validation.ts
│   │   ├── storage.ts
│   │   └── cleanup.ts
│   ├── db/                 # Database layer
│   │   └── index.ts
│   └── types/               # TypeScript types
│       └── file.ts
├── config/
│   └── config.json
├── package.json
└── tsconfig.json
```
