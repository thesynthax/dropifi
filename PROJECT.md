# Dropifi v2 — Project Context for OpenCode

## 1. Overview

Dropifi is a **minimal, developer-first file drop service** inspired by 0x0.st.

Core idea:
- Upload a file (via curl or browser)
- Instantly get a shareable URL
- No accounts, no friction
- Files expire automatically

This project is NOT a generic file uploader.

It is being built as a **systems engineering project** to demonstrate:
- backend architecture
- system design thinking
- scalability evolution
- production-grade infra patterns

---

## 2. Motivation

The goal of Dropifi v2 is NOT just to “add features”.

It is to evolve:
> a clean single-node system → into a scalable, production-grade distributed system

This project is meant to:
- demonstrate real backend engineering capability
- act as a strong portfolio project for infra/backend roles
- explore system design in practice (not just theory)

---

## 3. Previous Version (IMPORTANT)

There is a complete previous implementation in:

dropifi-v1/

You MUST read and understand it before making decisions.

### What exists in v1

- Express + TypeScript backend
- Multer-based streaming uploads
- Local filesystem storage (`uploads/`)
- SQLite database for metadata
- TTL-based cleanup job
- MIME validation using `file-type`
- Config-driven constraints (size, expiry, blacklist)

### Key design characteristics

- Single-node architecture
- Strong consistency
- Disk-backed storage
- Minimal API surface
- No authentication

### Important files in v1

- server.ts → request handling and upload pipeline
- cleanup.ts → TTL-based file deletion
- config.json → system constraints and limits
- package.json → runtime setup
- AGENTS.md → previous opencode context

You MUST reuse:
- good design decisions
- validation logic
- architectural principles

And improve:
- scalability
- modularity
- production readiness

---

## 4. Vision for v2

Dropifi v2 should become:

> Developer-first ephemeral file infrastructure

Not just a file uploader.

---

## 5. Core Principles

1. **Minimal UX, maximum power**
2. **Terminal-first (curl is first-class)**
3. **Streaming over buffering**
4. **Stateless APIs**
5. **Decoupled architecture**
6. **Eventually consistent cleanup**
7. **Config-driven system behavior**

---

## 6. Feature Set (Planned)

### Core (must-have)

- File upload (curl + browser)
- Instant URL generation
- File download
- Expiry (TTL-based)
- Metadata storage
- Cleanup system

---

### Advanced (v2 goals)

- Pre-signed uploads (direct to storage)
- Download limits
- Password-protected files
- API keys (optional)
- Rate limiting
- File size policies
- Expiry constraints

---

### Developer-first features

- CLI tool (future)
- API-first design
- automation-friendly endpoints

---

## 7. Architecture Evolution Plan

### Current (v1)

Client → Express → Local Disk + SQLite

---

### Target (v2)

Client
  ↓
Load Balancer
  ↓
Stateless API Servers
  ↓
----------------------------
| PostgreSQL (metadata)     |
| Object Storage (files)    |
| Redis (rate limit/queue)  |
----------------------------
  ↓
Background Workers
  ↓
CDN (downloads)

---

## 8. Key Architectural Changes

### 1. Storage

Replace:
- Local filesystem

With:
- Object storage (S3 / MinIO)

---

### 2. Database

Replace:
- SQLite

With:
- PostgreSQL

---

### 3. API Design

- Stateless services
- No local state
- Horizontal scalability

---

### 4. Upload Flow

Move toward:

Client → API → Signed URL → Object Storage

---

### 5. Cleanup

Move from:
- simple scheduler

To:
- async workers OR storage lifecycle rules

---

### 6. Background Jobs

Introduce:
- queue-based processing (BullMQ / Redis)

---

## 9. Core Components

### API Service

Handles:
- upload requests
- metadata
- validation
- URL generation

---

### Storage Layer

- Object storage
- no local disk dependency

---

### Metadata Layer

Stores:
- file_id
- storage_key
- size
- mime
- created_at
- expires_at
- download_count
- constraints

---

### Worker Layer

Handles:
- cleanup
- async tasks
- lifecycle enforcement

---

## 10. Data Model (Draft)

File {
  id: string (UUID)
  storage_key: string
  size: number
  mime: string
  created_at: Date
  expires_at: Date
  download_count: number
  constraints: {
    max_downloads?: number
    password_protected?: boolean
    password_hash?: string
  }
}

---

## 11. Security Model

Must include:

- MIME validation (keep from v1)
- extension validation
- file size limits
- blacklist enforcement
- rate limiting (new)

---

## 12. Non-Functional Requirements

- streaming uploads (no RAM buffering)
- horizontal scalability
- fault tolerance
- idempotency
- observability (logs + metrics)

---

## 13. Constraints

- No unnecessary overengineering
- No premature microservices explosion
- Keep system understandable
- Maintain minimal API surface

---

## 14. What NOT to Do

- Do NOT tightly couple storage to API
- Do NOT store files locally in v2
- Do NOT block requests with heavy processing
- Do NOT introduce stateful servers

---

## 15. Development Strategy

1. Understand v1 deeply
2. Extract reusable components
3. Redesign architecture BEFORE coding
4. Build incrementally
5. Keep system deployable at all times

---

## 16. Expectations from OpenCode

You are expected to:

- Read `dropifi-v1/` fully before generating code
- Preserve good patterns from v1
- Suggest improvements aligned with v2 goals
- Avoid breaking simplicity unnecessarily
- Think in terms of systems, not just endpoints

When making decisions:
- justify tradeoffs
- prefer clarity over cleverness
- keep scalability in mind

---

## 17. End Goal

A system that demonstrates:

- real backend engineering capability
- strong system design understanding
- production-level thinking

This is NOT just a project.

This is a **proof of competence**.
