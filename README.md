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

**Real-time monitoring:**

```
Fastify Gateway → ApiCallLog (PostgreSQL, fire-and-forget)
                → Redis Pub/Sub  metrics.workspace.<id>
                                        ↓
                         NestJS MonitoringGateway (Socket.io /monitoring)
                                        ↓
                         Browser: metrics_update event per workspace room
```

The `MonitoringService` also serves aggregated metrics (summary, timeseries, per-endpoint breakdown, prompt analytics, AI optimization suggestions) via REST, with Redis caching (summary: 5 s TTL; suggestions: 300 s TTL).

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

| Variable                  | Default                 | Notes                                                                                                     |
| ------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | `http://localhost:3001` | NestJS REST API base URL                                                                                  |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:3002` | Fastify gateway base URL — used to construct live endpoint URLs and send test requests from the dashboard |
| `NEXT_PUBLIC_WS_URL`      | `ws://localhost:3001`   | WebSocket URL for real-time monitoring (Socket.io)                                                        |

### Internal Service URLs

| Variable     | Default              | Notes                                             |
| ------------ | -------------------- | ------------------------------------------------- |
| `WORKER_URL` | `http://worker:8000` | FastAPI worker base URL (`/optimize`, `/suggest`) |

Override `WORKER_URL` to `http://localhost:8000` when running the worker outside Docker Compose.

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

> Modules implemented across tasks 1.3, 2.2, 3.2, and 4.1. All modules live under `apps/api/src/`.

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
├── deployments/          DeploymentsService + DeploymentsController
│                           GET    /api/prompts/:id/deployments
│                           GET    /api/prompts/:id/deployments/history
│                           POST   /api/prompts/:id/deploy
│                           POST   /api/prompts/:id/promote
│                           POST   /api/prompts/:id/rollback/:environment
│                           POST   /api/prompts/:id/go-live/:environment
├── api-keys/             ApiKeysService + ApiKeysController (WorkspaceGuard)
│                           GET    /api/workspaces/:workspaceId/api-keys
│                           POST   /api/workspaces/:workspaceId/api-keys
│                           GET    /api/workspaces/:workspaceId/api-keys/:id
│                           PATCH  /api/workspaces/:workspaceId/api-keys/:id/disable
│                           DELETE /api/workspaces/:workspaceId/api-keys/:id
├── failover-configs/     FailoverConfigsService + FailoverConfigsController
│                           GET    /api/prompts/:id/failover-config
│                           PUT    /api/prompts/:id/failover-config
│                           DELETE /api/prompts/:id/failover-config
├── monitoring/           MonitoringService + MonitoringController + MonitoringGateway
│                         REST endpoints (all require auth):
│                           GET /api/monitoring/workspaces/:workspaceId/summary
│                               ?window=1m|5m|1h|24h|7d  &environment=dev|staging|prod
│                           GET /api/monitoring/workspaces/:workspaceId/timeseries
│                               ?from=<ISO>&to=<ISO>&bucket=1m|5m|15m|1h  [&environment=...]
│                           GET /api/monitoring/workspaces/:workspaceId/api-calls
│                               ?environment=dev|staging|prod
│                           GET /api/monitoring/prompts/:promptId/analytics
│                           GET /api/monitoring/prompts/:promptId/suggestions?lastN=5
│                         WebSocket gateway — Socket.io namespace /monitoring:
│                           emit  join_workspace   { workspaceId }  → joins workspace room
│                           emit  leave_workspace  { workspaceId }  → leaves room
│                           on    metrics_update   { workspaceId, metrics, timestamp }
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

### Deployment pipeline

`POST /api/prompts/:id/deploy` creates an append-only `Deployment` row in the requested environment (`dev`, `staging`, or `prod`) and assigns a semver-like version (`MAJOR.MINOR.PATCH.BUILD` — BUILD increments on every deployment). Subsequent actions:

- **Promote** — copies a deployment record from one environment to the next.
- **Rollback** — sets the previous deployment for the given environment back to `is_live`.
- **Go-live** — sets `is_live = true` and assigns (or refreshes) the `endpoint_hash` used by the gateway.

All state changes are append-only; `GET /api/prompts/:id/deployments/history` returns the full audit trail with actor and timestamp.

### API key format and storage

Generated keys use the prefix `sk_org_`, `sk_ws_`, or `sk_ro_` followed by 64 hex characters (`crypto.randomBytes(32)`). The `bcrypt` hash of the full key is stored in the database; the prefix is stored in plaintext for display. The complete key is returned **once** at creation and is never exposed again.

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

## Fastify Gateway — Live API Proxy (`apps/gateway`)

> Implemented in task 3.3. The gateway runs on port **3002** and handles all external live prompt calls.

### Routes

| Method | Path                 | Description                                          |
| ------ | -------------------- | ---------------------------------------------------- |
| `POST` | `/api/v1/live/:hash` | Execute a live prompt deployment; returns LLM output |
| `GET`  | `/health`            | Liveness probe — always 200 if the process is up     |
| `GET`  | `/ready`             | Readiness probe — checks Redis and PostgreSQL        |

### Request / response shape

```http
POST /api/v1/live/:hash
Authorization: Bearer sk_ws_<64-hex-chars>
Content-Type: application/json

{
  "variables": { "topic": "async programming" }
}
```

```json
{
  "output": "...",
  "latency_ms": 412,
  "tokens": { "input": 38, "output": 192 },
  "failover": true
}
```

The `failover` field is only present in the response when the secondary provider was used.

### Authentication

1. Extract `Bearer` token from the `Authorization` header.
2. Compute a SHA-256 fingerprint of the token.
3. Lookup fingerprint in Redis (TTL 60 s). On cache miss, fetch all active `api_keys` rows for the workspace and bcrypt-compare the token against each stored hash.
4. Reject with `401` if no match, if the key is disabled, or if the key has expired.

### Prompt config caching

On cache miss for a given `endpoint_hash`, the gateway issues a single SQL query joining `deployments`, `prompt_versions`, `prompt_ai_configs`, `ai_providers`, and `failover_configs`. The result is serialised and stored in Redis under `prompt:<hash>` with a **30 s TTL**.

### Rate limiting

Per-key counters are stored in Redis:

| Limit           | Counter key             | Window   |
| --------------- | ----------------------- | -------- |
| 1 000 req/min   | `ratelimit:<keyId>:min` | 60 s     |
| 100 000 req/day | `ratelimit:<keyId>:day` | 86 400 s |

Exceeded limits return `429` with a `Retry-After` header (seconds until the window resets).

A coarse global IP-level limit (10 000 req/min) is applied by `@fastify/rate-limit` before auth runs.

### Failover logic

The gateway tracks primary provider errors per `endpoint_hash` in Redis (`failover:errors:<hash>`, 1-minute window):

- **Error threshold breach** — if the error counter reaches `FailoverConfig.error_threshold`, subsequent requests are routed to the secondary provider. A `failover.triggered` event is published to Redis Pub/Sub.
- **Latency threshold breach** — if a successful primary call exceeds `FailoverConfig.latency_threshold_ms`, the error counter is incremented (same mechanism).
- **Automatic recovery** — a successful, fast primary call resets the error counter via `DEL`.
- **Both providers fail** — returns `502`.

Failover settings (`timeout_ms`, `error_threshold`, `latency_threshold_ms`, secondary provider) are managed via `PUT /api/prompts/:id/failover-config`.

### ApiCallLog persistence

After each successful response, an `ApiCallLog` row (deployment ID, API key ID, endpoint hash, token counts, latency, cost estimate, `is_failover` flag) is inserted via `setImmediate` (fire-and-forget). Errors in this path are logged but do not affect the caller.

### Supported LLM providers

OpenAI-compatible APIs (openai, together, groq, mistral, ollama, custom base URL) and Anthropic (via native `fetch` against the Anthropic Messages API).

### Load testing

A k6 script is provided at `apps/gateway/k6/load-test.js` targeting `POST /api/v1/live/:hash` at **1 000 req/s** sustained.

```bash
k6 run apps/gateway/k6/load-test.js
```

---

## Next.js Frontend — Page & Component Overview (`apps/web`)

> Implemented across tasks 1.4, 2.3, 3.4, 4.2, 4.3, 4.4, and 4.5. All routes live under `apps/web/src/app/(dashboard)/`.

### Pages

| Route                      | File                               | Description                                                                                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/prompts`                 | `prompts/page.tsx`                 | Prompt list with search, filter, and create prompt modal                                                                                                                                                                                                                                    |
| `/prompts/[id]`            | `prompts/[id]/page.tsx`            | Prompt detail — tabbed editor (Editor, AI Provider, Dataset, Environments, Failover, Analytics)                                                                                                                                                                                             |
| `/prompts/[id]/edit`       | `prompts/[id]/edit/page.tsx`       | Full-screen prompt content editor                                                                                                                                                                                                                                                           |
| `/api-keys`                | `api-keys/page.tsx`                | API key management — KPI cards (Total / Active / Expired / Disabled), tabbed key list, create-key modal; usage analytics modal per key (requests-over-time chart, success/error stacked bar, most-used endpoints)                                                                           |
| `/api-gateway`             | `api-gateway/page.tsx`             | Live Prompt APIs tab (endpoint cards with Test / Docs / Copy URL actions, API Test Modal); Live Agent APIs tab (phase 5 stub); Analytics tab (calls-over-time line chart, cost-per-hour bar chart, latency histogram, top-10 endpoints table)                                               |
| `/api-gateway/[hash]/docs` | `api-gateway/[hash]/docs/page.tsx` | Auto-generated per-endpoint docs — URL, auth header format, request/response schema, code examples in cURL / Python / Node.js                                                                                                                                                               |
| `/datasets`                | `datasets/page.tsx`                | Dataset list and upload                                                                                                                                                                                                                                                                     |
| `/evaluations`             | `evaluations/page.tsx`             | Evaluation job list                                                                                                                                                                                                                                                                         |
| `/evaluations/new`         | `evaluations/new/page.tsx`         | Evaluation wizard (prompt + dataset + metric selection)                                                                                                                                                                                                                                     |
| `/evaluations/[id]`        | `evaluations/[id]/page.tsx`        | Evaluation result viewer with metric breakdown                                                                                                                                                                                                                                              |
| `/ai-providers`            | `ai-providers/page.tsx`            | AI provider CRUD and encrypted key management                                                                                                                                                                                                                                               |
| `/live-monitoring`         | `live-monitoring/page.tsx`         | Real-time KPI dashboard — 6 KPI cards (total calls, success rate, avg latency, tokens, cost, failovers), time-window selector (1m/5m/1h/24h/7d), environment filter, live Socket.io connection badge, Recharts line chart with metric toggles, 5 s REST auto-refresh, recent-errors section |
| `/api-calls`               | `api-calls/page.tsx`               | Per-endpoint call breakdown — summary KPI cards, environment tabs (all/dev/staging/prod), expandable endpoint rows with full metrics                                                                                                                                                        |
| `/prompt-analytics/[id]`   | `prompt-analytics/[id]/page.tsx`   | Standalone prompt analytics — eval-scores chart with model filter, interactive tooltip, all-evaluations table with tabs (all/completed/failed), AI optimization suggestions panel                                                                                                           |

### Prompt detail tabs (`apps/web/src/components/prompts/`)

| Component             | Tab label    | Description                                                                                                                                                                                             |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PromptEditor.tsx`    | Editor       | Content editor with `{{variable}}` highlighting and version history                                                                                                                                     |
| `AiProviderTab.tsx`   | AI Provider  | Model and parameter configuration per prompt                                                                                                                                                            |
| `DatasetTab.tsx`      | Dataset      | Link a dataset to the prompt for evaluation                                                                                                                                                             |
| `EnvironmentsTab.tsx` | Environments | Three environment cards (DEV / STAGING / PROD) each showing the live version badge; Go Live, Promote, and Rollback action buttons; animated pipeline connector between stages; deployment history modal |
| `FailoverTab.tsx`     | Failover     | Primary and secondary provider selectors; failover settings form (timeout ms, error threshold, max latency ms, recovery interval, auto-recovery toggle)                                                 |

### API client (`apps/web/src/lib/api.ts`)

The frontend API client is grouped by domain. The following groups were added in task 3.4:

| Export               | Backend endpoints consumed                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| `deploymentsApi`     | `GET/POST /api/prompts/:id/deployments`, promote, rollback, go-live, history |
| `failoverConfigsApi` | `GET/PUT/DELETE /api/prompts/:id/failover-config`                            |
| `apiKeysApi`         | `GET/POST/PATCH/DELETE /api/workspaces/:workspaceId/api-keys`                |

The following group was added in task 4.3:

| Export             | Backend endpoints consumed                                                            |
| ------------------ | ------------------------------------------------------------------------------------- |
| `organizationsApi` | `GET /api/organizations`, `POST /api/organizations`, `DELETE /api/organizations/:id` |

The following group was extended in task 4.5:

| Export          | New endpoint added                                                 |
| --------------- | ------------------------------------------------------------------ |
| `workspacesApi` | `DELETE /api/organizations/:orgId/workspaces/:workspaceId`         |

### Org switching (task 4.4)

`WorkspaceSwitcher` in the sidebar now supports switching between organisations. When a user belongs to multiple orgs, the dropdown renders a grouped view with each org name as a clickable header. Clicking an org header auto-selects its first workspace, switching the active org context immediately. If the selected org has no workspaces yet, `CreateWorkspaceModal` opens pre-scoped to that org. A checkmark icon marks the currently active org header.

### Delete workspace / organization (task 4.5)

Owners can permanently delete the active workspace or the active organization (and all its contents) directly from the `WorkspaceSwitcher` dropdown. Two destructive menu items — "Delete workspace" and "Delete organization" — open confirmation dialogs (`DeleteWorkspaceModal` and `DeleteOrganizationModal`) before issuing the corresponding `DELETE` request. On success, the client clears the active context and redirects to the dashboard.

---

## Project Structure

```
AgentForge/
├── apps/
│   ├── api/              # NestJS 10 — REST API + WebSocket (port 3001)
│   │   ├── prisma/       # Schema, migrations, seed
│   │   │   ├── migrations/
│   │   │   │   ├── 20260312000000_foundation/
│   │   │   │   ├── 20260314193244_0002_datasets_evals/
│   │   │   │   └── 20260316000000_0003_deployments_gateway/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── auth/             # AuthGuard, @Public(), @CurrentUser()
│   │       ├── common/           # HttpExceptionFilter, ZodValidationPipe, EncryptionService
│   │       ├── organizations/    # CRUD + OrgMemberGuard
│   │       ├── prisma/           # PrismaService (@Global)
│   │       ├── prompts/          # CRUD + versioning + variable extraction
│   │       ├── users/            # Clerk webhook sync + GET /auth/me
│   │       ├── workspaces/       # CRUD + WorkspaceGuard
│   │       ├── datasets/         # CRUD + S3 upload + version diff
│   │       ├── ai-providers/     # CRUD + AES-256-GCM key encryption
│   │       ├── prompt-ai-configs/# Model params per prompt
│   │       ├── evaluations/      # BullMQ job enqueue + status polling
│   │       ├── metrics/          # Metric catalogue + /suggest proxy
│   │       ├── storage/          # S3/MinIO abstraction
│   │       ├── deployments/      # Deploy / promote / rollback / go-live
│   │       ├── api-keys/         # sk_org_ / sk_ws_ / sk_ro_ key lifecycle
│   │       ├── failover-configs/ # Failover settings per prompt
│   │       └── monitoring/       # REST metrics + Socket.io /monitoring gateway
│   ├── gateway/          # Fastify 4 — live API proxy (port 3002)
│   │   ├── k6/
│   │   │   └── load-test.js      # k6 load test (1 000 req/s)
│   │   └── src/
│   │       ├── index.ts          # Bootstrap (cors, compress, rate-limit)
│   │       ├── db.ts             # pg Pool
│   │       ├── redis.ts          # ioredis client + publisher
│   │       ├── crypto.ts         # AES-256-GCM decrypt
│   │       ├── types.ts          # PromptConfig, LlmCallConfig, etc.
│   │       ├── lib/
│   │       │   ├── llm.ts        # LLM dispatch (OpenAI-compat + Anthropic)
│   │       │   ├── variables.ts  # {{variable}} substitution
│   │       │   └── cost.ts       # Token cost estimation table
│   │       └── routes/
│   │           ├── live.ts       # POST /api/v1/live/:hash (main proxy)
│   │           └── health.ts     # GET /health, GET /ready
│   ├── web/              # Next.js 14 — dashboard frontend (port 3000)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (dashboard)/
│   │       │   │   ├── prompts/
│   │       │   │   │   ├── page.tsx          # Prompt list
│   │       │   │   │   └── [id]/
│   │       │   │   │       ├── page.tsx      # Prompt detail + tabbed editor
│   │       │   │   │       └── edit/page.tsx # Full-screen editor
│   │       │   │   ├── api-keys/
│   │       │   │   │   └── page.tsx          # API key management (KPI cards, list, create modal)
│   │       │   │   ├── api-gateway/
│   │       │   │   │   ├── page.tsx          # Live Prompt/Agent APIs (test modal, endpoint cards)
│   │       │   │   │   └── [hash]/
│   │       │   │   │       └── docs/page.tsx # Auto-generated endpoint docs (cURL/Python/Node.js)
│   │       │   │   ├── datasets/             # Dataset management + version diff
│   │       │   │   ├── evaluations/          # Evaluation wizard + result viewer
│   │       │   │   ├── ai-providers/         # AI provider CRUD + key management
│   │       │   │   ├── live-monitoring/      # Real-time monitoring dashboard
│   │       │   │   └── api-calls/            # API call log viewer
│   │       │   └── layout.tsx
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── WorkspaceSwitcher.tsx        # Sidebar switcher — grouped multi-org dropdown; switch, create, and delete org/workspace
│   │       │   │   ├── CreateOrganizationModal.tsx  # Create organisation (name + auto-slug)
│   │       │   │   ├── CreateWorkspaceModal.tsx     # Create workspace under active org (name + auto-slug)
│   │       │   │   ├── DeleteWorkspaceModal.tsx     # Confirm and delete the active workspace
│   │       │   │   └── DeleteOrganizationModal.tsx  # Confirm and delete the active org and all its contents
│   │       │   ├── prompts/
│   │       │   │   ├── EnvironmentsTab.tsx   # DEV/STAGING/PROD cards, Go Live/Promote/Rollback
│   │       │   │   ├── FailoverTab.tsx       # Primary/secondary provider + failover settings form
│   │       │   │   ├── AiProviderTab.tsx
│   │       │   │   └── DatasetTab.tsx
│   │       │   └── ui/                       # shadcn/ui primitives
│   │       └── lib/
│   │           └── api.ts                    # deploymentsApi, failoverConfigsApi, apiKeysApi, organizationsApi + prior modules
│   └── worker/           # FastAPI — eval job processor (port 8000)
│       ├── app/
│       │   ├── config.py         # pydantic-settings
│       │   ├── consumer.py       # BullMQ Redis consumer
│       │   ├── crypto.py         # AES-256-GCM decrypt
│       │   ├── worker.py         # Job processor pipeline
│       │   └── metrics/
│       │       └── scorers.py    # HuggingFace evaluate scorers
│       ├── main.py               # FastAPI app + /suggest endpoint
│       ├── pyrightconfig.json    # Pyright/Pylance venv config
│       ├── .python-version       # Pins Python 3.11 for uv
│       └── tests/
├── packages/
│   └── shared/           # Shared TypeScript types, Zod schemas, constants
│       └── src/
│           ├── constants.ts      # Enums, API_KEY_PREFIXES, GRADE_THRESHOLDS
│           ├── types.ts          # Domain interfaces (Prompt, Deployment, etc.)
│           └── schemas.ts        # Zod validation schemas
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
