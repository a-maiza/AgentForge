# AgentForge

**LLM Governance & Prompt Management Platform** — a production-grade LLMOps tool for versioning, evaluating, deploying, and monitoring LLM prompts and multi-step agent workflows.

---

## Architecture

### Services

| Service      | Technology            | Port | Purpose                                 |
| ------------ | --------------------- | ---- | --------------------------------------- |
| `web`        | Next.js 14            | 3000 | Frontend dashboard (App Router)         |
| `api`        | NestJS 10             | 3001 | REST API + WebSocket server             |
| `gateway`    | Fastify 4             | 3002 | High-throughput live API proxy          |
| `worker`     | FastAPI (Python 3.11) | 8000 | Async evaluation job processor          |
| `postgres`   | PostgreSQL 15         | 5432 | Primary database                        |
| `pgbouncer`  | PgBouncer             | 5433 | Connection pooling (transaction mode)   |
| `redis`      | Redis 7               | 6379 | Cache, BullMQ job queue, Pub/Sub        |
| `minio`      | MinIO                 | 9000 | S3-compatible object storage (datasets) |
| `minio` (UI) | MinIO Console         | 9001 | Web UI — http://localhost:9001          |

### Request flows

**Dashboard (browser → data):**

```
Browser → Next.js SSR → NestJS REST API → PostgreSQL
```

**Live API call (external consumer):**

```
Client → Fastify Gateway → Redis cache (TTL 30s) → LiteLLM → AI Provider
```

**Evaluation job:**

```
NestJS API → BullMQ (Redis) → FastAPI Worker → LiteLLM + HuggingFace evaluate → PostgreSQL
                                                      ↓
                               Redis Pub/Sub → NestJS WebSocket → Browser (Socket.io)
```

**Failover:**

```
Gateway detects timeout / error threshold → switches to secondary provider → emits failover.triggered
```

---

## Prerequisites

| Tool           | Version | Install                                            |
| -------------- | ------- | -------------------------------------------------- |
| Node.js        | >= 20   | https://nodejs.org or `nvm install 20`             |
| pnpm           | 9.12.0  | `npm install -g pnpm@9.12.0`                       |
| Python         | >= 3.11 | https://python.org or `pyenv install 3.11`         |
| uv             | latest  | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker Desktop | latest  | https://docs.docker.com/get-docker/                |

---

## Quick Start

```bash
# 1. Clone and install Node dependencies
git clone https://github.com/a-maiza/AgentForge.git
cd AgentForge
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — at minimum set CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
# CLERK_WEBHOOK_SECRET, JWT_SECRET, ENCRYPTION_KEY

# 3. Start infrastructure (database, cache, storage)
docker compose up -d postgres pgbouncer redis minio minio-init

# 4. Run Prisma migration (first-time setup — see section below)
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:migrate

# 5. (Optional) Seed default org / workspace / admin user
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:seed

# 6. Generate Prisma client
pnpm --filter @agentforge/api db:generate

# 7. Start all application services
docker compose up --build
```

The app will be available at:

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Gateway: http://localhost:3002
- Worker: http://localhost:8000
- MinIO Console: http://localhost:9001 (user: `minioadmin` / `minioadmin`)

---

## Database Migrations (Prisma)

> Docker Compose starts PostgreSQL but **does not run migrations automatically**.
> You must apply migrations manually whenever the schema changes.

### Important: direct connection required

`prisma migrate dev` and `prisma db seed` require a **direct connection** to PostgreSQL on port **5432**.
Do **not** use the PgBouncer URL (port 5433) for migrations — PgBouncer runs in transaction mode which is incompatible with DDL statements.

```bash
# Apply pending migrations (interactive, dev only)
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:migrate

# Apply migrations non-interactively (CI / staging / prod)
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:migrate:deploy

# Reset database (drops all data — dev only)
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:migrate:reset

# Seed default org, workspace, and admin user
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:seed

# Open Prisma Studio (database GUI)
DATABASE_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge \
  pnpm --filter @agentforge/api db:studio

# Regenerate Prisma client after schema changes
pnpm --filter @agentforge/api db:generate
```

### Migration history

| Migration                  | Phase | Tables added                                                                                                             |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| `0001_foundation`          | 1.2   | users, organizations, org_members, workspaces, workspace_members, prompts, prompt_versions, prompt_variables             |
| `0002_datasets_evals`      | 2.1   | datasets, dataset_versions, prompt_dataset_configs, ai_providers, prompt_ai_configs, evaluation_jobs, evaluation_results |
| `0003_deployments_gateway` | 3.1   | deployments, failover_configs, api_keys, api_call_logs                                                                   |
| future                     | 4+    | agents                                                                                                                   |

---

## Development Commands

### Monorepo (Turborepo — run from repo root)

```bash
pnpm dev              # Start all apps in parallel with hot-reload
pnpm build            # Build all apps
pnpm lint             # ESLint + Prettier check across all packages
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier write
pnpm format:check     # Prettier check (used in CI)
pnpm typecheck        # tsc --noEmit across all TypeScript packages
pnpm test             # Vitest (web) + Jest (api, gateway) unit tests
pnpm test:integration # Integration tests (requires running DB)
pnpm clean            # Remove dist/, .next/, node_modules/
```

### NestJS API (`apps/api`)

```bash
pnpm --filter @agentforge/api dev              # nest start --watch
pnpm --filter @agentforge/api build            # nest build
pnpm --filter @agentforge/api test             # jest --passWithNoTests
pnpm --filter @agentforge/api test -- --testPathPattern=<file>  # single test file
pnpm --filter @agentforge/api typecheck        # tsc --noEmit
pnpm --filter @agentforge/api lint             # eslint src/
```

### Next.js Frontend (`apps/web`)

```bash
pnpm --filter @agentforge/web dev              # next dev (port 3000)
pnpm --filter @agentforge/web build            # next build
pnpm --filter @agentforge/web test             # vitest run
pnpm --filter @agentforge/web test -- --run <file>  # single test file
pnpm --filter @agentforge/web typecheck        # tsc --noEmit
```

### Fastify Gateway (`apps/gateway`)

```bash
pnpm --filter @agentforge/gateway dev          # tsx watch src/index.ts (port 3002)
pnpm --filter @agentforge/gateway build        # tsc
pnpm --filter @agentforge/gateway test         # vitest run
pnpm --filter @agentforge/gateway typecheck    # tsc --noEmit
```

### FastAPI Worker (`apps/worker`)

```bash
cd apps/worker

uv sync                                    # Install/update dependencies from pyproject.toml
uv add <package>                           # Add a new dependency
uv run fastapi dev main.py                 # Dev server with hot-reload (port 8000)
uvicorn main:app --reload                  # Alternative

pytest                                     # All tests
pytest tests/test_metrics.py              # Single test file
pytest -k "test_f1"                       # Single test by name
pytest --cov=main --cov-report=xml -q     # With coverage
```

#### Python version pinning

`apps/worker/.python-version` pins Python **3.11** so `uv` always creates the virtual environment with the correct interpreter, matching the Dockerfile (`python:3.11-slim`) and CI (`PYTHON_VERSION: '3.11'`).

Without this file, `uv` defaults to the system Python (which may be a newer version, e.g. 3.14 via Homebrew on macOS), causing runtime incompatibilities.

```bash
# Re-create the venv with the pinned version (first-time or after Python upgrade)
cd apps/worker
uv python install 3.11   # download Python 3.11 managed by uv (if not already present)
rm -rf .venv
uv venv                  # uv reads .python-version → creates .venv with Python 3.11
uv sync --extra dev
```

#### IDE import resolution (Pyright / Pylance)

`apps/worker/pyrightconfig.json` points Pyright and Pylance at the `.venv` directory so that editors resolve `fastapi`, `pydantic`, `cryptography`, `boto3`, `litellm`, and other dependencies without "Unable to import" errors.

For **VS Code** specifically, also add the following to `.vscode/settings.json` (gitignored — each developer configures their own IDE):

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/apps/worker/.venv/bin/python",
  "python.analysis.venvPath": "${workspaceFolder}/apps/worker",
  "python.analysis.venv": ".venv",
  "python.analysis.extraPaths": ["${workspaceFolder}/apps/worker"]
}
```

---

## Environment Variables

Copy `.env.example` to `.env.local`. Variables marked **required** must be set before any service starts.

### Database

| Variable             | Default (local)                                                        | Notes                                  |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `DATABASE_URL`       | `postgresql://agentforge:agentforge@localhost:5432/agentforge`         | Direct connection — migrations, studio |
| `DATABASE_POOL_URL`  | `postgresql://agentforge:agentforge@localhost:5433/agentforge`         | PgBouncer — runtime app usage          |
| `DATABASE_ASYNC_URL` | `postgresql+asyncpg://agentforge:agentforge@localhost:5432/agentforge` | FastAPI worker                         |
| `REDIS_URL`          | `redis://localhost:6379`                                               |                                        |

### Authentication — Clerk _(required)_

| Variable                            | Notes                           |
| ----------------------------------- | ------------------------------- |
| `CLERK_SECRET_KEY`                  | From Clerk dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET`              | From Clerk dashboard → Webhooks |

### Security _(required)_

| Variable         | Notes                                           |
| ---------------- | ----------------------------------------------- |
| `JWT_SECRET`     | Min 32 characters — used for service-to-service |
| `ENCRYPTION_KEY` | 32-byte hex string: `openssl rand -hex 32`      |

### Object Storage

| Variable                | Local default           | Notes                             |
| ----------------------- | ----------------------- | --------------------------------- |
| `USE_MINIO`             | `true`                  | Set `false` in prod to use AWS S3 |
| `S3_ENDPOINT`           | `http://localhost:9000` |                                   |
| `S3_BUCKET`             | `agentforge-datasets`   |                                   |
| `MINIO_ROOT_USER`       | `minioadmin`            |                                   |
| `MINIO_ROOT_PASSWORD`   | `minioadmin`            |                                   |
| `AWS_ACCESS_KEY_ID`     | —                       | Required in production            |
| `AWS_SECRET_ACCESS_KEY` | —                       | Required in production            |

### Frontend URLs

| Variable                  | Default                 |
| ------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`     | `http://localhost:3001` |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:3002` |
| `NEXT_PUBLIC_WS_URL`      | `ws://localhost:3001`   |

### AI Providers _(optional — can be set per workspace in UI)_

`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`

### Monitoring

`SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

---

## Tech Stack

| Concern             | Technology                                   |
| ------------------- | -------------------------------------------- |
| Monorepo            | Turborepo 2 + pnpm workspaces                |
| Frontend            | Next.js 14 (App Router)                      |
| UI                  | Tailwind CSS + shadcn/ui                     |
| State management    | Zustand + TanStack Query v5                  |
| Node editor         | React Flow                                   |
| Real-time           | Socket.io + NestJS WebSockets                |
| Backend API         | NestJS 10 + Fastify adapter                  |
| Auth                | Clerk (JWT + webhooks)                       |
| ORM                 | Prisma 5 (api) + SQLAlchemy 2 async (worker) |
| Job queue           | BullMQ (Redis-backed)                        |
| API proxy           | Fastify 4 (gateway)                          |
| Eval worker         | FastAPI + uvicorn                            |
| LLM interface       | LiteLLM                                      |
| ML metrics          | HuggingFace `evaluate`                       |
| Semantic similarity | `sentence-transformers`                      |
| Object storage      | AWS S3 / MinIO (local)                       |
| Linting             | ESLint 9 (flat config) + Ruff                |
| Formatting          | Prettier 3                                   |
| Testing (Node)      | Vitest (web/gateway) + Jest (api)            |
| Testing (Python)    | pytest + pytest-asyncio                      |
| CI/CD               | GitHub Actions                               |
| Containerization    | Docker + Docker Compose                      |

---

## NestJS API — Module Overview (`apps/api`)

> Implemented in task 1.3. All modules live under `apps/api/src/`.

### Authentication & Security

| Mechanism            | Details                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| **JWT verification** | `AuthGuard` calls `verifyToken()` from `@clerk/backend` on every request       |
| **Global guard**     | Registered as `APP_GUARD` in `AppModule` — all routes are protected by default |
| **Opt-out**          | Decorate a route with `@Public()` to skip auth (e.g. the Clerk webhook)        |
| **Current user**     | Inject the authenticated user with `@CurrentUser()` param decorator            |
| **Webhook security** | `POST /webhooks/clerk` verifies the `svix` signature before processing events  |

### Module map

```
src/
├── prisma/               PrismaService (@Global) — shared across all modules
├── auth/                 AuthGuard, @Public(), @CurrentUser()
├── users/                UsersService + UsersController
│                           GET  /auth/me
│                           POST /webhooks/clerk  (@Public — svix-verified)
├── organizations/        OrganizationsService + OrganizationsController + OrgMemberGuard
│                           GET    /api/organizations
│                           POST   /api/organizations
│                           GET    /api/organizations/:orgId
│                           PUT    /api/organizations/:orgId
│                           DELETE /api/organizations/:orgId
│                           GET    /api/organizations/:orgId/members
│                           POST   /api/organizations/:orgId/members
│                           DELETE /api/organizations/:orgId/members/:userId
├── workspaces/           WorkspacesService + WorkspacesController + WorkspaceGuard
│                           GET    /api/workspaces
│                           POST   /api/organizations/:orgId/workspaces
│                           GET    /api/organizations/:orgId/workspaces/:workspaceId
│                           PUT    /api/organizations/:orgId/workspaces/:workspaceId
│                           DELETE /api/organizations/:orgId/workspaces/:workspaceId
│                           GET    /api/organizations/:orgId/workspaces/:workspaceId/members
├── prompts/              PromptsService + PromptsController
│                           GET    /api/workspaces/:workspaceId/prompts
│                           POST   /api/workspaces/:workspaceId/prompts
│                           GET    /api/workspaces/:workspaceId/prompts/:id
│                           PUT    /api/workspaces/:workspaceId/prompts/:id
│                           DELETE /api/workspaces/:workspaceId/prompts/:id
│                           GET    /api/workspaces/:workspaceId/prompts/:id/versions
│                           GET    /api/workspaces/:workspaceId/prompts/:id/versions/:v
└── common/
    ├── filters/          HttpExceptionFilter — RFC 7807 application/problem+json errors
    └── pipes/            ZodValidationPipe — Zod-backed body validation
```

### Prompt versioning & variable extraction

Every `PUT /api/workspaces/:workspaceId/prompts/:id` that changes `content`:

1. Creates an immutable `PromptVersion` row with an incremented `version_number`
2. Extracts all `{{variable_name}}` patterns from the new content
3. Updates `PromptVariable` rows — adds new variables, removes obsolete ones

Name-only or description-only updates do **not** create a new version.

### Error format (RFC 7807)

All errors return `Content-Type: application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "UNAUTHORIZED",
  "status": 401,
  "detail": "Missing or invalid authorization header",
  "instance": "/auth/me"
}
```

---

## Project Structure

```
AgentForge/
├── apps/
│   ├── api/              # NestJS 10 — REST API + WebSocket (port 3001)
│   │   ├── prisma/       # Schema, migrations, seed
│   │   └── src/
│   │       ├── auth/         # AuthGuard, @Public(), @CurrentUser()
│   │       ├── common/       # HttpExceptionFilter, ZodValidationPipe
│   │       ├── organizations/# CRUD + OrgMemberGuard
│   │       ├── prisma/       # PrismaService (@Global)
│   │       ├── prompts/      # CRUD + versioning + variable extraction
│   │       ├── users/        # Clerk webhook sync + GET /auth/me
│   │       └── workspaces/   # CRUD + WorkspaceGuard
│   ├── gateway/          # Fastify 4 — live API proxy (port 3002)
│   │   └── src/
│   ├── web/              # Next.js 14 — dashboard frontend (port 3000)
│   │   └── src/
│   └── worker/           # FastAPI — eval job processor (port 8000)
│       ├── main.py
│       └── tests/
├── packages/
│   └── shared/           # Shared TypeScript types, Zod schemas, constants
│       └── src/
├── .github/
│   └── workflows/        # PR checks, staging deploy, prod release
├── Makefile              # make setup / make dev / make migrate / make reset
├── docker-compose.yml
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
└── Documents/
    ├── REQUIREMENTS.md   # Full product specification
    └── Tasks.md          # Phased implementation task list
```
