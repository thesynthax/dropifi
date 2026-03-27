# AGENTS.md - Dropifi Server

## Project Overview
Dropifi is a file-sharing Express server with TypeScript. Files are uploaded, stored with optional password protection, and automatically cleaned up after expiration.

**Tech Stack**: TypeScript 5.4, Express 4.19, SQLite3, Multer, bcrypt, node-schedule, ES Modules

## Build/Test Commands

```bash
npm run build   # Compile TypeScript to dist/
npm run dev     # Development: tsx watch with hot reload
npm start       # Production: node dist/server.js
npm test        # Placeholder - no tests configured
```

**Recommended additions** (not yet implemented):
```bash
npm run lint        # ESLint --fix
npm run test        # Vitest run
npm run typecheck   # tsc --noEmit
```

## TypeScript Configuration

- **Target**: ES2021
- **Module**: NodeNext (ES Modules with `.js` extensions in imports)
- **Strict mode**: Enabled (all strict checks)
- **JSON imports**: Enabled via `resolveJsonModule`

Key tsconfig settings:
```json
{
  "strict": true,
  "esModuleInterop": true,
  "forceConsistentCasingInFileNames": true
}
```

## Code Style Guidelines

### Formatting
- **Indentation**: 4 spaces (no tabs)
- **Line endings**: LF
- **Braces**: K&R style (opening brace on same line)
- **Semicolons**: Required

### Import Organization
```typescript
import express from "express";           // Framework
import cors from "cors";                 // Middleware
import bodyParser from "body-parser";    // Middleware
import multer from "multer";             // File handling
import path from "path";                 // Node built-ins
import fs from "fs";
import sqlite3 from "sqlite3";           // Database
import { v4 as uuidv4 } from "uuid";    // Utils
import * as config from "../config/config.json" with { type: "json" };
import { fileTypeFromFile } from "file-type";
import cleanup from "./cleanup.js";     // Internal (note .js extension)
```

Group by: external frameworks → middleware → file handling → Node built-ins → database → utilities → config → internal modules.

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `cleanup.ts`, `server.ts` |
| Interfaces/Types | PascalCase | `FileRow` |
| Variables | camelCase | `fileName`, `uploadDate` |
| Constants | PascalCase or SCREAMING_SNAKE | `DESTINATION`, `DB_LOCATION` |
| Functions | camelCase | `clamp()`, `cleanup()` |
| Routes | kebab-case | `/files/:id` |
| Database columns | snake_case | `uniqueId`, `uploadDate` |

### Type Annotations

Define interfaces at module level for shared types:
```typescript
export interface FileRow {
    filename: string;
    filepath: string;
    mimetype: string;
    filesize: bigint;
    removed: boolean;
    expiration: number;
    uploadDate: number;
    password: string;
    uniqueId: string;
}
```

Use explicit types for function parameters and return values:
```typescript
const clamp = (min: number, max: number, value: number): number => { ... }
```

### Error Handling

**Current patterns in codebase**:
```typescript
// Try-catch with logging (non-critical)
try {
    if (!fs.existsSync(DESTINATION)) {
        fs.mkdirSync(DESTINATION);
    }
} catch (err) {
    console.error(err);
}

// Callback error handling (critical - exits)
db.run(qry, values, (err) => {
    if (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
});

// Express route errors
db.run(qry, values, (err) => {
    if (err) {
        return res.status(500).send("Internal Server Error");
    }
});
```

**Recommended**: Use consistent error handling - throw for truly exceptional cases, log and handle for expected failures, always return appropriate HTTP status codes in Express routes.

## Architecture Notes

### Express Routes
- Static files served from `./build` directory
- Main route: `POST /` for file uploads (handles `multipart/form-data` via Multer)
- File retrieval: `GET /files/:id` with optional Basic Auth
- Cleanup scheduled daily at midnight via `node-schedule`

### SQLite Patterns
```typescript
// Database initialization with error handling
const db = new sqlite3.Database(DB_LOCATION, flags, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

// Query patterns
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS ...`);
});

db.get(qry, values, (err, row) => { ... });
db.run(qry, values, (err) => { ... });
db.all(qry, values, (err, rows) => { ... });
```

### Configuration
All configuration is in `config/config.json`:
```typescript
import * as config from "../config/config.json" with { type: "json" };
config.default.PORT        // Access pattern
config.default.MAX_FILE_SIZE
```

## Deployment

- **Docker**: `Dockerfile` for Node 21 container
- **Platform**: Fly.io (see `fly.toml`)
- **Ports**: Default 5000, configurable via `config.json`
- **Data**: SQLite DB and uploads in `/data` volume

## Recommended Tooling (Not Yet Configured)

This codebase would benefit from:

1. **ESLint + Prettier**: For consistent formatting and linting
2. **Vitest or Jest**: For unit testing (currently has no tests)
3. **Husky + lint-staged**: For pre-commit hooks
4. **GitHub Actions**: For CI/CD
