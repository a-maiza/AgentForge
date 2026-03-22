# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AgentForge is a full-stack **LLM Governance & Prompt Management Platform** — a production-grade LLMOps tool for versioning, evaluating, deploying, and monitoring LLM prompts and multi-step agent workflows.

Full requirements: [`Documents/REQUIREMENTS.md`](Documents/REQUIREMENTS.md)
Phased task breakdown: [`Documents/Tasks.md`](Documents/Tasks.md)

---

## Monorepo Structure (Turborepo)

```
apps/
  web/        Next.js 14 (App Router) — frontend
  api/        NestJS 10 — main REST API + WebSocket server
  worker/     FastAPI (Python 3.11+) — async evaluation job processor
  gateway/    Fastify 4 — high-throughput live API proxy
packages/
  shared/     Shared TypeScript types, Zod schemas, DTOs (consumed by web + api)
```

---

## Commands

> All commands run from the repo root unless noted.

### Local development

```bash
docker compose up            # Start postgres, redis, minio + all app services
```

### Turborepo (once scaffolded)

```bash
pnpm dev                     # Run all apps in parallel (web, api, gateway)
pnpm build                   # Build all apps
pnpm lint                    # ESLint + Prettier check across all packages
pnpm typecheck               # tsc --noEmit across all TypeScript packages
pnpm test                    # Vitest (web) + Jest (api) unit tests
```

### Per-app

```bash
# Frontend (apps/web)
pnpm --filter web dev
pnpm --filter web test                      # Vitest
pnpm --filter web test -- --run <file>      # Single test file

# API (apps/api)
pnpm --filter api dev
pnpm --filter api test                      # Jest
pnpm --filter api test -- --testPathPattern=<file>

# Prisma (apps/api)
pnpm --filter api prisma:migrate            # prisma migrate dev
pnpm --filter api prisma:generate           # prisma generate
pnpm --filter api prisma:seed               # ts-node prisma/seed.ts
pnpm --filter api prisma:studio             # prisma studio

# Eval Worker (apps/worker)
cd apps/worker
uv run fastapi dev main.py                  # or: uvicorn main:app --reload
pytest                                      # all tests
pytest tests/test_metrics.py               # single file
pytest -k "test_f1"                        # single test by name

# Gateway (apps/gateway)
pnpm --filter gateway dev
```

### Python environment (apps/worker)

```bash
cd apps/worker
uv sync                      # install deps from pyproject.toml
uv add <package>             # add dependency
```

---

## Architecture

### Request flows

**Dashboard user → data:**
`Browser → Next.js Server Component (SSR) → NestJS REST API → PostgreSQL`

**Live API call (external consumer):**
`Client → Fastify Gateway → Redis (cache lookup) → LiteLLM → AI Provider`
The gateway caches prompt configs in Redis (TTL 30 s) and API key hashes (TTL 60 s) to avoid DB round-trips on the hot path.

**Evaluation job:**
`NestJS API → BullMQ (Redis queue) → FastAPI Worker → LiteLLM + HuggingFace evaluate → PostgreSQL`
Progress is written back via Redis Pub/Sub → NestJS WebSocket gateway → Socket.io-client in browser.

**Failover:**
The Fastify gateway wraps primary LLM calls; on timeout or error-threshold breach it switches to the secondary provider configured in `failover_configs`. It emits a `failover.triggered` Pub/Sub event.

### Auth

Clerk is the auth provider. The NestJS API validates Clerk JWTs via a Passport strategy. A Clerk webhook syncs `user.created`/`user.updated`/`user.deleted` events to the local `users` table. Workspace/org membership is enforced by `WorkspaceGuard` and `OrgMemberGuard` in NestJS.

### Prompt versioning

Every content-changing `PUT /api/prompts/:id` auto-creates an immutable `PromptVersion` row. The mutable `Prompt` record holds status and metadata only. `{{variable}}` patterns are auto-extracted from content into `PromptVariable` rows on each save.

### Deployment pipeline

`Deployment` rows are append-only. `POST /prompts/:id/go-live` sets `is_live = true` and assigns an `endpoint_hash` used by the gateway. Semver-like versioning: `MAJOR.MINOR.PATCH.BUILD` — the BUILD component increments on each deployment.

### AI provider key security

Provider API keys are encrypted at rest with AES-256-GCM (Node.js `crypto`). A unique IV is generated per encryption; the IV is stored alongside the ciphertext. Keys are decrypted in-process only within `AiProvidersService` — never serialised in API responses.

### Shared types

`packages/shared` is the single source of truth for TypeScript interfaces, Zod schemas, and string enums shared between `web` and `api`. Avoid duplicating type definitions across apps.

---

## Key technology choices

| Concern             | Choice                                       | Note                                                |
| ------------------- | -------------------------------------------- | --------------------------------------------------- |
| LLM calls (worker)  | LiteLLM                                      | Unified interface for all providers                 |
| ML metrics          | HuggingFace `evaluate`                       | F1, EM, BLEU, ROUGE, BERTScore                      |
| Semantic similarity | `sentence-transformers`                      | Embedding-based scoring                             |
| Job queue           | BullMQ (Redis-backed)                        | Shared between api (producer) and worker (consumer) |
| Node editor         | React Flow                                   | Workflow Studio canvas                              |
| Real-time           | Socket.io + NestJS WebSockets                | Live monitoring dashboard                           |
| ORM                 | Prisma 5 (api) + SQLAlchemy 2 async (worker) | Both target the same PostgreSQL DB                  |
| Object storage      | AWS S3 / MinIO (local)                       | Dataset files, evaluation artefacts                 |

---

## Environment variables

Copy `.env.example` to `.env.local`. Required vars before any service starts:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — min 32 chars
- `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `ENCRYPTION_KEY` — 32-byte hex string for AES-256 provider key encryption
- `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or MinIO equivalents)

## Git Workflow

When working on tasks listed in Tasks.md:

1. Before starting, create a new branch named `<type>/<task-number>-<brief-description>`,
   where the branch type reflects the nature of the change:
   - feat → new features
   - fix → bug fixes
   - docs → documentation updates
   - test → tests
   - refactor → refactoring

2. Use atomic commits with conventional commit messages.

3. Once the task is finished and all tests pass:
   a. Invoke the `readme-doc-updater` subagent to update `README.md` to reflect
      the task's changes (new modules, routes, files, env vars, migrations, etc.).
      Commit any README modifications to the current branch before creating the PR,
      so they are included in the same PR as the implementation.
   b. Open a pull request that includes:
      - A title matching the task description
      - A brief summary of the changes made
      - Any relevant testing notes or considerations
      - An updated checkbox in TASKS.md to mark the task as complete

## Testing Requirements

Before marking any task as complete:

1. Write unit tests for new functionality
2. Run the full test suite
3. If tests fail:
   - Analyse the failure output
   - Fix the code (not the tests, unless the tests are incorrect)
   - Re-run tests until all pass
