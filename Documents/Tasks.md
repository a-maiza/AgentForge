# Tasks.md — LLM Governance & Prompt Management Platform

> **Stack:** Next.js 14 · NestJS 10 · FastAPI · Fastify · PostgreSQL 15 · Redis 7 · BullMQ · Prisma 5 · Clerk · Socket.io · LiteLLM · HuggingFace evaluate
> **Repo layout:** monorepo — `apps/web`, `apps/api`, `apps/worker`, `apps/gateway`, `packages/shared`

---

## Legend

| Symbol | Meaning                       |
| ------ | ----------------------------- |
| `[ ]`  | Not started                   |
| `[x]`  | Complete                      |
| `[~]`  | In progress                   |
| `[!]`  | Blocked                       |
| **P0** | Critical path                 |
| **P1** | High priority                 |
| **P2** | Normal                        |
| **P3** | Nice-to-have / Phase 6 polish |

---

## Phase 1 — Foundation (Weeks 1–4)

### 1.1 Infrastructure & DevOps

- [x] **P0** Initialise Turborepo monorepo with `apps/` and `packages/` workspaces; add root `package.json` with shared scripts (`dev`, `build`, `lint`, `test`)
- [x] **P0** Scaffold `packages/shared`: export shared TypeScript types, DTOs, Zod schemas, and constants shared between `web` and `api`
- [x] **P0** Write `docker-compose.yml` with services: `postgres` (15), `redis` (7), `minio` (latest), `api`, `worker`, `gateway`, `web`; bind env vars via `.env.local`
- [x] **P0** Add `.env.example` covering all variables from Appendix B (DATABASE_URL, REDIS_URL, JWT_SECRET, CLERK keys, S3/MinIO, ENCRYPTION_KEY, SMTP, SENTRY_DSN)
- [x] **P1** Configure GitHub Actions workflow for PR checks: ESLint + Prettier, `tsc --noEmit`, Vitest, Pytest, Docker build smoke test
- [x] **P1** Configure GitHub Actions workflow for `main` merge: all PR checks + integration tests + push images to GHCR + deploy to staging
- [x] **P1** Configure GitHub Actions workflow for version tags (`v*.*.*`): all above + Playwright E2E + deploy to prod + GitHub Release
- [x] **P2** Add Dockerfile for each app (`api`, `worker`, `gateway`, `web`) with multi-stage builds (builder → runner)
- [x] **P2** Configure ESLint (flat config), Prettier, and Ruff (Python) with shared rules; wire into Turborepo pipeline
- [x] **P2** Set up Sentry SDK in `api` (NestJS) and `web` (Next.js) with source maps upload in CI

### 1.2 Database & Schema

- [x] **P0** Initialise Prisma in `apps/api`; configure `schema.prisma` with `postgresql` datasource and `DATABASE_URL` env var
- [x] **P0** Define Prisma models for Phase 1 entities: `User`, `Organization`, `OrgMember`, `Workspace`, `WorkspaceMember`
- [x] **P0** Define Prisma models for `Prompt`, `PromptVersion`, `PromptVariable`
- [x] **P0** Add migration `0001_foundation`; verify with `prisma migrate dev`
- [x] **P1** Seed script (`prisma/seed.ts`): create a default org, workspace, and admin user for local dev
- [x] **P2** Document PgBouncer pool config (transaction mode, max 20 connections per service); add `pgbouncer` service to docker-compose

### 1.3 Backend — NestJS API (`apps/api`)

- [x] **P0** Bootstrap NestJS app with `@nestjs/config` + Joi schema validation; fail fast on missing required env vars
- [x] **P0** Implement `AuthModule`: Clerk JWT strategy (`PassportStrategy` wrapping Clerk `verifyToken`), `AuthGuard`, `CurrentUser` decorator
- [x] **P0** Implement `UsersModule`: sync Clerk webhook (`user.created`, `user.updated`, `user.deleted`) → upsert `User` row; expose `GET /auth/me`
- [x] **P0** Implement `OrganizationsModule`: CRUD endpoints, role enforcement (`owner`/`admin`/`developer`/`viewer`/`api_user`), `OrgMemberGuard`
- [x] **P0** Implement `WorkspacesModule`: CRUD, workspace-scoped resource guard (`WorkspaceGuard`); all subsequent resource modules inherit workspace scoping
- [x] **P0** Implement `PromptsModule`: `GET /api/prompts`, `POST /api/prompts`, `GET /api/prompts/:id`, `PUT /api/prompts/:id`, `DELETE /api/prompts/:id`
- [x] **P0** Implement prompt versioning: every `PUT` (content change) auto-creates a new `PromptVersion`; expose `GET /api/prompts/:id/versions` and `GET /api/prompts/:id/versions/:v`
- [x] **P0** Implement variable auto-extraction: parse `{{variable_name}}` patterns on prompt save; upsert `PromptVariable` rows
- [x] **P1** Add `PinoLogger` (`nestjs-pino`) with request-scoped `requestId`, `userId`, `workspaceId` context
- [x] **P1** Add global `ValidationPipe` (class-validator + class-transformer), `ClassSerializerInterceptor`, and HTTP exception filter returning RFC 7807 error shape
- [x] **P2** Write unit tests (Jest) for `PromptsService` version logic and variable extraction regex

### 1.4 Frontend — Next.js (`apps/web`)

- [x] **P0** Scaffold Next.js 14 App Router project with TypeScript, Tailwind CSS, shadcn/ui init (`components.json`), and path aliases
- [x] **P0** Integrate Clerk: `ClerkProvider` in root layout, `middleware.ts` protecting `/dashboard/**` routes, sign-in/sign-up pages at `/sign-in` and `/sign-up`
- [x] **P0** Implement persistent sidebar layout (`app/(dashboard)/layout.tsx`): collapsible 240px/64px, navigation per §23.3, active route highlight
- [x] **P0** Implement workspace switcher in sidebar header (fetches from `GET /api/workspaces`); store active workspace in Zustand `useWorkspaceStore`
- [x] **P0** Set up TanStack Query v5 `QueryClientProvider`; create `lib/api.ts` axios instance with Clerk token injection interceptor
- [x] **P1** Implement `/prompts` list page: grid/table/list toggle, search, filter by status/grade, sort; skeleton loaders; empty state with CTA
- [x] **P1** Implement prompt creation modal/page (`POST /api/prompts`) with React Hook Form + Zod validation
- [x] **P1** Implement prompt editor page (`/prompts/:id/edit`): CodeMirror or Monaco with `{{variable}}` syntax highlighting, live variable panel, character count, save → new version
- [x] **P1** Implement prompt detail page with tabs: Overview, Prompt, Dataset, AI Provider, Environments, Failover, Analytics (stubs for later phases)
- [x] **P2** Implement Overview dashboard (`/overview`): KPI cards (total prompts, agents, datasets, active deployments), sparkline for API call volume using Recharts
- [x] **P2** Add Sonner `<Toaster>` to root layout; create `useToast` wrapper with success/error/warning variants per §23.8

---

## Phase 2 — Datasets & Evaluation (Weeks 5–8)

### 2.1 Database & Schema

- [x] **P0** Add Prisma models: `Dataset`, `DatasetVersion`, `PromptDatasetConfig`
- [x] **P0** Add Prisma models: `AiProvider`, `PromptAiConfig`
- [x] **P0** Add Prisma models: `EvaluationJob`, `EvaluationResult`
- [x] **P0** Migration `0002_datasets_evals`
- [x] **P1** Add `storage_path` index on `DatasetVersion`; add composite index `(prompt_id, status)` on `EvaluationJob`

### 2.2 Backend — NestJS API

- [x] **P0** Implement `DatasetsModule`: CRUD + `POST /api/datasets/:id/upload` (multipart, stream to S3/MinIO via `@aws-sdk/client-s3`); parse CSV/JSON headers and row count on upload; create new `DatasetVersion`
- [x] **P0** Implement `GET /api/datasets/:id/versions/:v/preview`: retrieve file from S3, return first 50 rows as JSON
- [x] **P0** Implement `POST /api/datasets/:id/versions/compare`: compute added/removed/modified row diffs (stream both versions, hash rows)
- [x] **P0** Implement `AiProvidersModule`: CRUD; encrypt `api_key` at rest with AES-256-GCM (`Node.js crypto`); decrypt only within the service, never expose in responses
- [x] **P0** Implement `PromptAiConfigsModule`: save/update model params per prompt; validate param ranges (temp 0–2, top_p 0–1, etc.)
- [x] **P0** Implement `EvaluationsModule` (NestJS side): `POST /api/evaluations` validates prompt + dataset + metric selection, enqueues `EvaluationJob` to BullMQ `evaluations` queue, returns job record; `GET /api/evaluations/:id` streams job status
- [x] **P1** Implement `GET /api/metrics`: return static metric catalogue (20 metrics from §10.3) with category, description, and schema
- [x] **P1** Implement prompt ↔ dataset variable mapping endpoint: `PUT /api/prompts/:id/dataset-config` saves `variable_mapping` JSONB

### 2.3 Backend — FastAPI Eval Worker (`apps/worker`)

- [x] **P0** Bootstrap FastAPI app with `pydantic-settings` config, SQLAlchemy 2 async engine (same `DATABASE_URL`), and `httpx` client
- [x] **P0** Implement BullMQ job consumer: poll `evaluations` queue (via `bullmq` Python port or Redis BRPOP fallback); acquire job, update status to `running`
- [x] **P0** Implement LiteLLM call executor: for each dataset row, substitute variables into prompt template, call `litellm.acompletion()`, capture response + token counts + latency
- [x] **P0** Implement metric scorers: Accuracy, Exact Match, F1, Precision, Recall (using `evaluate` from HuggingFace), Perplexity, BLEU, ROUGE, BERTScore
- [x] **P0** Implement cost estimator: lookup model pricing table (input/output $/1M tokens), compute cost per call and total
- [x] **P1** Implement Consistency Score: run same prompt N=3 times on a sample, compute output variance
- [x] **P1** Implement Latency percentiles (p50/p90/p99): aggregate from per-row timings
- [x] **P1** Implement Carbon Footprint / Power Consumption estimates (gCO₂ per 1k tokens) using published datacenter coefficients
- [x] **P1** Implement grade computation: score → A+/A/B/C/D/F per §10.5 scale; store in `EvaluationJob.grade`
- [x] **P1** Persist per-metric `EvaluationResult` rows; update job `progress` counter after each row; publish `eval.progress` event to Redis Pub/Sub
- [x] **P1** Implement `POST /api/metrics/suggest` (NestJS endpoint): call LiteLLM with a meta-prompt that reads the user's prompt and returns top-N metric recommendations with match % — proxy to worker or handle in API
- [x] **P2** Add Pytest unit tests for each metric scorer with fixture data (ground truth vs predictions)
- [x] **P2** Add `pytest-asyncio` integration tests for the full job lifecycle against a test PostgreSQL instance

### 2.4 Frontend

- [ ] **P0** Implement `/dataset` list page: grid/table/list toggle, search, status indicator, row/version count per card
- [ ] **P0** Implement dataset creation + CSV/JSON upload flow with drag-and-drop (`react-dropzone`), progress bar, version creation confirmation
- [ ] **P0** Implement dataset detail page: data preview table, column schema, version history sidebar
- [ ] **P0** Implement `/dataset/:id/versions` page: version list with checkbox selection, compare button (2-version diff modal per §8.7)
- [ ] **P0** Implement `/ai-providers` page: provider cards, add/edit provider form with masked API key input, model dropdown (fetched per provider type)
- [ ] **P0** Implement evaluation configuration wizard (2 steps per §10.2): metric grid with category filter + AI-suggested metrics; review summary; Start Evaluation button
- [ ] **P0** Implement evaluation job detail page (`/evaluations/:id`): progress bar (polling `GET /api/evaluations/:id` or WebSocket), performance metric cards, cost/carbon section, grade badge
- [ ] **P1** Implement `/evaluation-jobs` list page: KPI header (total/pending/running/completed/failed), auto-refresh toggle, search + status filter
- [ ] **P1** Implement Dataset Tab inside prompt detail: connect/disconnect dataset, variable mapping drag-and-drop, 2-row preview
- [ ] **P1** Implement AI Provider Tab inside prompt detail: provider/model selector, parameter sliders/inputs with validation ranges
- [ ] **P2** Add Recharts performance-over-time chart component (reusable, used in both prompt analytics and gateway analytics)

---

## Phase 3 — Deployment Pipeline (Weeks 9–11)

### 3.1 Database & Schema

- [ ] **P0** Add Prisma models: `Deployment`, `FailoverConfig`, `ApiKey`, `ApiCallLog`
- [ ] **P0** Add `LiveEndpoint` model (or denormalize onto `Deployment`): `endpoint_hash`, `is_active`, environment
- [ ] **P0** Migration `0003_deployments_gateway`
- [ ] **P1** Add index `(endpoint_hash)` on `ApiCallLog` and `(api_key_id, created_at)` for usage analytics queries

### 3.2 Backend — NestJS API

- [ ] **P0** Implement `DeploymentsModule`: `POST /api/prompts/:id/deploy` (create deployment record, assign semver `MAJOR.MINOR.PATCH.BUILD`); `POST /api/prompts/:id/promote` (copy deployment to next env); `POST /api/prompts/:id/rollback`; `POST /api/prompts/:id/go-live` (set `is_live`, generate/update `endpoint_hash`)
- [ ] **P0** Implement deployment history: append-only audit log of all promotions/rollbacks with actor + timestamp
- [ ] **P0** Implement `ApiKeysModule`: generate `sk_org_` / `sk_ws_` / `sk_ro_` prefixed keys (32 random chars via `crypto.randomBytes`); store `bcrypt` hash + prefix; return full key **once** at creation; CRUD per §15.4
- [ ] **P1** Implement `FailoverConfigsModule`: CRUD for failover settings per prompt; defaults per §12.3
- [ ] **P1** Expose deployment pipeline state: `GET /api/prompts/:id/deployments` returns all three environment cards with current version, timestamps, provider config

### 3.3 Backend — Fastify Gateway (`apps/gateway`)

- [ ] **P0** Bootstrap Fastify app with `@fastify/cors`, `@fastify/rate-limit`, `@fastify/compress`; Pino logger
- [ ] **P0** Implement API key authentication plugin: extract `Bearer` token, hash it, lookup in Redis cache (TTL 60s); on miss, query PostgreSQL; reject with 401 if not found/disabled/expired
- [ ] **P0** Implement `POST /api/v1/live/:hash` route: lookup prompt config from Redis cache (TTL 30s); on miss, query `Deployment` + `PromptAiConfig` + `AiProvider`; substitute variables; call LiteLLM; return `{ output, latency_ms, tokens }`
- [ ] **P0** Implement failover logic in the gateway: wrap primary LLM call in try/catch; on timeout (configurable) or error threshold breach, retry with secondary provider; emit `failover.triggered` event to Redis Pub/Sub
- [ ] **P0** Persist `ApiCallLog` row asynchronously (fire-and-forget via Redis queue or direct DB insert on worker); include cost estimate
- [ ] **P1** Implement rate limiting per API key (req/min + req/day counters in Redis); return `429` with `Retry-After` header
- [ ] **P1** Add `GET /health` and `GET /ready` probes (checks Redis and DB connectivity)
- [ ] **P2** Write k6 load test script targeting `POST /api/v1/live/:hash`; target 1 000 req/s sustained; document baseline results

### 3.4 Frontend

- [ ] **P0** Implement Environments Tab inside prompt detail (§11): three environment cards (DEV/STAGING/PROD) with version badge, GO LIVE / Promote / Rollback actions; animated pipeline connector
- [ ] **P0** Implement deployment history view: audit log table with actor, action, versions, timestamp
- [ ] **P0** Implement `/api-keys` page: KPI header, tabbed key list (All/Active/Expired/Disabled), create key modal (shows full key once with copy button), revoke/disable actions
- [ ] **P0** Implement `/proxy` Gateway overview page: Live Prompt APIs tab (endpoint cards with Test/Docs/Copy URL), Live Agent APIs tab (stub)
- [ ] **P0** Implement API Test Modal (§14.5): dynamic variable fields, API key input, Quick Fill, response JSON viewer
- [ ] **P1** Implement auto-generated endpoint Docs page (§14.6): endpoint URL, auth header format, request/response schema, curl + Python + Node.js code snippets
- [ ] **P1** Implement Failover Tab inside prompt detail (§12): primary/secondary provider selector cards, settings form (timeout, threshold, latency, recovery interval)

---

## Phase 4 — Monitoring & Analytics (Weeks 12–14)

### 4.1 Backend — NestJS API

- [ ] **P0** Implement `MonitoringModule` with Socket.io gateway (`@nestjs/websockets`): subscribe to Redis Pub/Sub `metrics.*` channel; broadcast `metrics_update` events to connected clients in workspace room
- [ ] **P0** Implement metrics aggregation service: aggregate `ApiCallLog` rows for KPIs (total calls, success rate, avg latency, token counts) per time window; cache in Redis with 5s TTL
- [ ] **P0** Implement `GET /api/monitoring/summary` and `GET /api/monitoring/timeseries` endpoints (time-bucket queries using `date_trunc` in Postgres)
- [ ] **P1** Implement `GET /api/api-calls`: grouped by endpoint hash, with per-endpoint breakdown (total calls, last call, success rate, avg latency, cost, tokens); supports env filter
- [ ] **P1** Implement `GET /api/prompts/:id/analytics`: performance-over-time data (one row per completed evaluation job), aggregated KPIs (avg accuracy, reliability, consistency, efficiency)
- [ ] **P1** Implement AI optimization suggestions endpoint: analyze last N evaluation results for a prompt; call LiteLLM with meta-prompt to generate config + prompt improvement suggestions; cache result

### 4.2 Frontend

- [ ] **P0** Implement `/monitoring` page (§16): KPI cards, activity windows (1m/1h/24h), real-time performance chart (Socket.io-client, line chart with metric toggles), recent errors section; time range selector; auto-refresh every 5s
- [ ] **P0** Wire Socket.io client: connect on mount, join workspace room, handle `metrics_update` → update Recharts data in Zustand store (ring buffer, last 60 data points)
- [ ] **P0** Implement `/api-calls` page (§17): summary KPIs, env tabs, per-endpoint expandable sections with call log rows
- [ ] **P0** Implement Analytics Tab inside prompt detail (`/prompts/:id` → Analytics): performance-over-time chart, KPI header, recent evaluations table, optimization suggestions panel (§18.2)
- [ ] **P1** Implement `/prompt-analytics/:id` standalone analytics page (§18.1): full chart with model filter, interactive tooltip showing eval config details, all-evaluations table with tabs
- [ ] **P1** Implement Gateway-level Analytics Tab (`/proxy` → Analytics tab): aggregate charts (calls over time, cost per day, latency histogram, top endpoints)
- [ ] **P2** Implement per-API-key usage analytics modal (`/api-keys`: click key → usage drawer): requests-over-time chart, success/error breakdown, most used endpoints

---

## Phase 5 — Advanced Features (Weeks 15–18)

### 5.1 Database & Schema

- [ ] **P0** Add Prisma model: `Agent`, `AgentVersion` (stores `workflow_definition` as JSONB)
- [ ] **P0** Migration `0004_agents`
- [ ] **P2** Add `pgvector` extension and `prompt_embeddings` table for semantic prompt search (future)

### 5.2 Backend — NestJS API

- [ ] **P0** Implement `AgentsModule`: CRUD for agents; `PUT /api/agents/:id/workflow` validates and stores React Flow graph JSON; `POST /api/agents/:id/test-run` executes workflow in-process (walk node graph, call deployed prompt endpoints sequentially/in-parallel per node type)
- [ ] **P0** Implement agent version history: save snapshot of `workflow_definition` on each `PUT /api/agents/:id/workflow` call
- [ ] **P1** Implement `POST /api/prompts/:id/versions/compare`: compute character-level or line-level text diff between two `PromptVersion.content` values; return structured diff for frontend renderer
- [ ] **P1** Implement regression testing endpoint: `POST /api/prompts/:id/regression-test` — run latest prompt version against historical evaluation dataset and compare metric scores vs. baseline
- [ ] **P1** Extend `EvaluationsModule`: `POST /api/metrics/suggest` — call LiteLLM to analyse prompt content and return top-5 recommended metrics with match percentage and explanation

### 5.3 Frontend

- [ ] **P0** Implement `/agents` list page: agent cards with status/version/node count, filter by workspace/status
- [ ] **P0** Implement agent detail page with tabs: Overview (KPIs), Workflow Builder, Environments (stub → reuse deployment component), Execution, Analytics
- [ ] **P0** Implement Workflow Studio editor (`/agents/:id/edit`): React Flow canvas (dark dot-grid theme), node palette sidebar (6 node types per §13.4 with correct colors), bezier connections, node configuration sidepanels, toolbar (Import/Export/Clear/Test Run/Reset/Versions/Save)
- [ ] **P0** Implement node configuration panels: Start Node (prompt selector, env selector, variable table), Prompt Node (prompt selector, env, output key), Condition Node (expression builder), Output Node (output key + format)
- [ ] **P0** Implement Test Run panel: input variable form, execution trace (node-by-node status), final output display
- [ ] **P1** Implement version comparison UI for prompts: select two versions from dropdown → side-by-side diff viewer (highlight added/removed text)
- [ ] **P1** Implement Quality Detection badge on prompt list: background job that compares latest two versions' eval scores; surface as degradation warning icon
- [ ] **P1** Implement AI metric suggestions in evaluation wizard Step 1: call `POST /api/metrics/suggest`; render recommended metrics with match % chips above the full grid
- [ ] **P1** Implement Optimization Suggestions panel in prompt inline analytics: display config warnings and AI-generated improved prompt version with apply button
- [ ] **P2** Implement Import/Export for agents (JSON round-trip of React Flow graph)
- [ ] **P2** Implement Live Agent API tab in `/proxy` gateway: agent endpoint cards, test modal wired to `POST /api/agents/:id/test-run`

---

## Phase 6 — Polish & Scale (Weeks 19–20)

### 6.1 Performance

- [ ] **P1** Audit all `SELECT *` queries; add missing Prisma `select`/`include` scoping to avoid over-fetching
- [ ] **P1** Add Redis caching layer (`CacheModule`) for frequently read, slow-changing data: metric catalogue, provider model lists, prompt config for gateway
- [ ] **P1** Implement cursor-based pagination on all list endpoints (replace offset pagination); update frontend infinite-scroll or page controls
- [ ] **P1** Add `Content-Encoding: gzip` via Fastify compress on gateway; enable Next.js `compress: true`
- [ ] **P2** Profile and fix any N+1 queries in `PromptsService`, `EvaluationsService` using Prisma query logging

### 6.2 Security Hardening

- [ ] **P0** Verify AES-256-GCM implementation for AI provider keys: unique IV per encryption, authenticate tag verified on decrypt
- [ ] **P0** Add OWASP-compliant `helmet` headers to NestJS (`X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, CSP)
- [ ] **P0** Enforce row-level scoping: add integration tests asserting that user A cannot read/write user B's workspace resources
- [ ] **P1** Implement IP allowlist/blocklist for gateway (§14.8): store in Redis set; check on every request before auth
- [ ] **P1** Validate and sanitize all file uploads: check MIME type, enforce 100 MB limit, scan CSV/JSON for excessively deep nesting
- [ ] **P2** Add audit log table and service: record every state-changing operation (user, action, resource_type, resource_id, ip, timestamp); expose read endpoint for org admins

### 6.3 Testing Coverage

- [ ] **P1** Achieve 80% line coverage on NestJS services (Jest); enforce via `--coverage --coverageThreshold` in CI
- [ ] **P1** Achieve 80% line coverage on FastAPI worker (Pytest + `pytest-cov`); enforce in CI
- [ ] **P1** Write Supertest integration tests for all NestJS REST endpoints (auth, prompts, datasets, evaluations, deployments, agents, api-keys, gateway)
- [ ] **P1** Write Playwright E2E tests for the 4 critical flows (§4.7): prompt create→version→evaluate→result; deploy DEV→STAGING→PROD; build agent workflow→test run; create API key→call live endpoint→verify response
- [ ] **P2** Add React Testing Library tests for complex UI components: workflow studio node panels, evaluation wizard, variable mapping drag-and-drop
- [ ] **P2** Run k6 load test in CI on staging after each production release; fail if p95 > 200 ms or error rate > 0.1%

### 6.4 Observability

- [ ] **P1** Add OpenTelemetry SDK to `api` and `worker`; export traces to Jaeger (local docker-compose) and OTLP collector (prod)
- [ ] **P1** Instrument custom Prometheus metrics: `eval_jobs_total{status}`, `llm_call_duration_seconds{provider,model}`, `gateway_requests_total{endpoint,status}`, `queue_depth`
- [ ] **P2** Add Grafana dashboard JSON for the three core dashboards: infrastructure (CPU/mem/DB connections), application (eval throughput, LLM latency), gateway (req/s, error rate, p95 latency)
- [ ] **P2** Configure Loki log aggregation: tag logs with `service`, `requestId`, `workspaceId`; add Grafana log panel to dashboards

### 6.5 Documentation & DX

- [ ] **P1** Write `README.md` at repo root: prerequisites, `docker compose up` quickstart, env var reference, service ports table
- [ ] **P1** Enable NestJS Swagger (`@nestjs/swagger`): auto-generate OpenAPI spec at `/api/docs`; annotate all DTOs with `@ApiProperty`
- [ ] **P1** Enable FastAPI auto-generated docs at `/worker/docs` (built-in); ensure all Pydantic models have docstrings
- [ ] **P2** Implement in-app onboarding tour (Intro.js or Shepherd.js): triggered on first login; covers creating a prompt, connecting a dataset, running an evaluation, and going live
- [ ] **P2** Implement "Architect AI" assistant sidebar: context-aware prompt writing suggestions powered by LiteLLM; surface on prompt editor page
- [ ] **P3** Write architecture decision records (ADRs) in `docs/adr/` for: monorepo structure, split backend (NestJS + FastAPI), Clerk vs. Auth.js, PostgreSQL vs. MongoDB

---

_Tasks are derived from [Documents/Requirements.md](Requirements.md) v1.1.0. Update task status as work progresses._
