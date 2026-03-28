# REQUIREMENTS.md — LLM Governance & Prompt Management Platform

> **Version:** 1.1.0  
> **Date:** 2026-03-10  
> **Status:** Draft  
> **Inspired by:** PromptLineOps — a production-grade LLM governance platform  
> **Changelog v1.1.0:** Tech stack section expanded with full rationale, versions, and architecture diagrams. Appendix C updated to Technology Stack Quick Reference.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Target Users](#2-target-users)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Tech Stack Recommendations](#4-tech-stack-recommendations)
5. [Authentication & Organizations](#5-authentication--organizations)
6. [Workspace Management](#6-workspace-management)
7. [Prompt Engineering Hub](#7-prompt-engineering-hub)
8. [Dataset Engineering Hub](#8-dataset-engineering-hub)
9. [AI Provider Configuration](#9-ai-provider-configuration)
10. [Evaluation System](#10-evaluation-system)
11. [Deployment Environments](#11-deployment-environments)
12. [Failover System](#12-failover-system)
13. [Agent Workflow Studio](#13-agent-workflow-studio)
14. [API Gateway & Proxy](#14-api-gateway--proxy)
15. [API Keys Management](#15-api-keys-management)
16. [Live Monitoring](#16-live-monitoring)
17. [API Calls Tracking](#17-api-calls-tracking)
18. [Analytics & Insights](#18-analytics--insights)
19. [Projects](#19-projects)
20. [Non-Functional Requirements](#20-non-functional-requirements)
21. [Database Schema Overview](#21-database-schema-overview)
22. [API Endpoints Reference](#22-api-endpoints-reference)
23. [UI/UX Requirements](#23-uiux-requirements)
24. [Security Requirements](#24-security-requirements)
25. [Milestones & Phased Delivery](#25-milestones--phased-delivery)

**Appendices**

- [Appendix A — Glossary](#appendix-a--glossary)
- [Appendix B — Environment Variables](#appendix-b--environment-variables)
- [Appendix C — Technology Stack Quick Reference](#appendix-c--technology-stack-quick-reference)

---

## 1. Project Overview

### 1.1 Purpose

Build a **full-stack LLM Governance Platform** that allows engineering teams to:

- Create, version, and manage LLM prompts
- Evaluate prompt quality against datasets using configurable metrics
- Deploy prompts through DEV → STAGING → PROD pipelines
- Monitor live API usage in real-time
- Build multi-step AI agent workflows visually
- Expose prompts and agents as REST APIs via a secure gateway

### 1.2 Core Value Propositions

| Value                           | Description                                                             |
| ------------------------------- | ----------------------------------------------------------------------- |
| **Version Control for Prompts** | Full git-like versioning for every prompt change                        |
| **Automated Evaluation**        | Run batch evaluations with 15+ metrics (accuracy, F1, cost, latency...) |
| **Production Deployment**       | Promote prompts from DEV to PROD with rollback support                  |
| **Failover**                    | Automatic fallback to secondary AI provider if primary fails            |
| **Visual Agents**               | Build multi-prompt pipelines visually with a node-based editor          |
| **API Gateway**                 | Serve prompts as authenticated REST endpoints                           |
| **Observability**               | Real-time monitoring with per-endpoint analytics                        |

### 1.3 Tagline

> _"Deploy and scale AI features with confidence."_

---

## 2. Target Users

### 2.1 Primary Users

- **AI/ML Engineers** — Build and iterate on prompts
- **Platform Engineers** — Deploy and monitor LLM endpoints in production
- **Data Engineers** — Manage evaluation datasets
- **Team Leads / Tech Leads** — Review quality metrics and approve promotions

### 2.2 User Roles

| Role        | Permissions                                            |
| ----------- | ------------------------------------------------------ |
| `owner`     | Full access, billing, user management                  |
| `admin`     | Full access except billing                             |
| `developer` | Create/edit prompts, agents, datasets; run evaluations |
| `viewer`    | Read-only access to all resources                      |
| `api_user`  | API access only (service accounts)                     |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                  │
│  Prompt Hub | Dataset Hub | Eval | Agents | Monitoring  │
└────────────────────────┬────────────────────────────────┘
                         │ REST / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                   Backend API (Node.js / FastAPI)       │
│  Auth | Prompts | Datasets | Evals | Agents | Gateway   │
└──────┬──────────────┬──────────────────┬────────────────┘
       │              │                  │
┌──────▼───┐   ┌──────▼───┐    ┌─────────▼────────────┐
│PostgreSQL│   │  Redis   │    │  AI Providers        │
│  (main)  │   │ (cache/  │    │ (OpenAI, TogetherAI, │
│          │   │  queue)  │    │  Mistral, etc.)      │
└──────────┘   └──────────┘    └──────────────────────┘
       │
┌──────▼──────────────────────┐
│  S3 / Object Storage        │
│  (datasets, exports, logs)  │
└─────────────────────────────┘
```

### 3.1 Services Breakdown

| Service              | Responsibility                                       |
| -------------------- | ---------------------------------------------------- |
| `api-server`         | Main REST API, business logic                        |
| `eval-worker`        | Async evaluation job processing (queue-based)        |
| `proxy-gateway`      | Live API proxy for deployed prompts/agents           |
| `monitoring-service` | Real-time metrics aggregation (WebSocket)            |
| `scheduler`          | Cron jobs for auto-refresh, cleanup, scheduled evals |

---

## 4. Tech Stack Recommendations

> **Decision rationale:** This stack has been chosen specifically for LLMOps workloads. See [Appendix C](#appendix-c--technology-stack-quick-reference) for the full technology quick reference table with versions.

---

### 4.1 Frontend

#### 4.1.1 Core Framework

**Next.js 14 (App Router) + TypeScript** is the primary choice.

- **Why Next.js over plain React:** Next.js provides SSR/RSC for data-heavy dashboards, file-based routing, built-in API routes for lightweight BFF (Backend for Frontend) patterns, automatic code splitting, and image optimization — all out of the box. Plain React requires manually assembling these capabilities with separate libraries.
- **Why TypeScript:** Types are shared between frontend and backend (NestJS), eliminating an entire class of integration bugs. All LLM response schemas, prompt variable definitions, and API contracts are typed end-to-end.

| Layer          | Technology                   | Justification                                                  |
| -------------- | ---------------------------- | -------------------------------------------------------------- |
| Framework      | **Next.js 14 (App Router)**  | SSR, routing, BFF, built-in optimizations                      |
| Language       | **TypeScript 5+**            | End-to-end type safety with backend                            |
| Styling        | **Tailwind CSS + shadcn/ui** | Production-grade design system, zero config                    |
| State (server) | **TanStack Query v5**        | Cache, refetch, optimistic updates for API data                |
| State (client) | **Zustand**                  | Lightweight global state (workflow studio, sidebar)            |
| Node Editor    | **React Flow**               | Industry standard for node-based editors (n8n, Flowise use it) |
| Charts         | **Recharts**                 | Composable, TypeScript-native, integrates cleanly with React   |
| Forms          | **React Hook Form + Zod**    | Performance forms with schema validation                       |
| Auth Client    | **Clerk**                    | Magic link, OAuth, session management — no config needed       |
| Real-time      | **Socket.io-client**         | Live monitoring WebSocket connection                           |
| Notifications  | **Sonner**                   | Toast notifications                                            |
| Icons          | **Lucide React**             | Consistent icon set                                            |
| Date handling  | **date-fns**                 | Lightweight, tree-shakeable                                    |

#### 4.1.2 Frontend Architecture Patterns

- **App Router layouts** for persistent sidebar navigation
- **Server Components** for initial data fetching (prompt lists, dashboard KPIs)
- **Client Components** only where interactivity is needed (editors, charts, forms)
- **Route handlers** (`/app/api/...`) for proxying sensitive requests (hide API keys from client)
- **Optimistic updates** via TanStack Query for prompt saves and status changes

---

### 4.2 Backend

#### 4.2.1 Architecture Decision: Split Backend

The backend is split into **two specialized services** to leverage the best of each ecosystem:

```
┌──────────────────────────────┐    ┌───────────────────────────────┐
│   API Server (NestJS)        │    │   Eval Worker (FastAPI)       │
│   TypeScript / Node.js 20+   │    │   Python 3.11+                │
│                              │    │                               │
│  • Prompt CRUD               │    │  • Job execution              │
│  • Dataset management        │    │  • LLM calls via LiteLLM      │
│  • Deployment pipeline       │    │  • Metric scoring             │
│  • API Gateway proxy         │    │    (HuggingFace evaluate)     │
│  • Auth & API Keys           │    │  • Cost calculation           │
│  • WebSocket monitoring      │    │  • Carbon footprint           │
│  • Agent orchestration       │    │  • AI metric suggestions      │
└──────────────────────────────┘    └───────────────────────────────┘
         shares PostgreSQL + Redis
```

**Why NestJS for the main API:**

- TypeScript shared with frontend = single source of truth for all types/DTOs
- Modular architecture maps perfectly to the platform's domains (prompts, datasets, evaluations, agents...)
- Built-in support for WebSockets, Guards (auth), Interceptors (logging), Pipes (validation)
- Dependency injection makes testing straightforward
- Much faster to develop than Java Spring Boot with equivalent enterprise patterns

**Why FastAPI for the eval worker:**

- Python is the only language with a mature LLMOps ecosystem
- `LiteLLM` for unified multi-provider LLM calls
- `HuggingFace evaluate` for F1, Exact Match, BERTScore, BLEU, ROUGE natively
- `sentence-transformers` for semantic similarity metrics
- All LLMOps research and tooling is published in Python first

#### 4.2.2 API Server — NestJS

| Layer        | Technology                              | Justification                                        |
| ------------ | --------------------------------------- | ---------------------------------------------------- |
| Runtime      | **Node.js 20+**                         | Native async/await, low memory, fast I/O             |
| Framework    | **NestJS 10+**                          | Modular, enterprise patterns, TypeScript-native      |
| ORM          | **Prisma 5+**                           | Type-safe queries, auto-generated client, migrations |
| Validation   | **class-validator + class-transformer** | DTO validation with decorators                       |
| HTTP Client  | **Axios**                               | Provider SDK calls, webhook delivery                 |
| Queue Client | **BullMQ**                              | Push jobs to Redis queue                             |
| WebSockets   | **@nestjs/websockets + Socket.io**      | Live monitoring push                                 |
| Encryption   | **Node.js crypto (AES-256-GCM)**        | AI provider key encryption at rest                   |
| Logging      | **Pino**                                | Structured JSON logs, extremely fast                 |
| Config       | **@nestjs/config + Joi**                | Typed env var validation                             |

#### 4.2.3 Eval Worker — FastAPI

| Layer               | Technology                                    | Justification                                                                              |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Runtime             | **Python 3.11+**                              | Best LLM ecosystem support                                                                 |
| Framework           | **FastAPI**                                   | Async-native, automatic OpenAPI docs, fast                                                 |
| LLM Calls           | **LiteLLM**                                   | Single interface for all providers (OpenAI, Together, Mistral, Anthropic, Groq, Ollama...) |
| ML Metrics          | **HuggingFace `evaluate`**                    | F1, EM, BLEU, ROUGE, BERTScore, Perplexity                                                 |
| Semantic Similarity | **sentence-transformers**                     | Embedding-based similarity scoring                                                         |
| Queue Consumer      | **BullMQ (via bullmq Python port) or Celery** | Job consumption from Redis                                                                 |
| ORM                 | **SQLAlchemy 2+ (async)**                     | Database access for job state updates                                                      |
| HTTP Client         | **httpx**                                     | Async HTTP calls                                                                           |
| Env Config          | **pydantic-settings**                         | Type-safe config from env vars                                                             |

#### 4.2.4 Proxy Gateway Service

A lightweight dedicated service that handles all live API calls to deployed prompts and agents.

| Layer Technology | Justification           |
| ---------------- | ----------------------- | --------------------------------------------------------- |
| Framework        | **Fastify** (Node.js)   | Highest throughput Node.js framework, ideal for proxy     |
| Rate Limiting    | **@fastify/rate-limit** | Per-key rate limiting                                     |
| Auth             | **JWT verification**    | Stateless API key validation                              |
| Caching          | **Redis**               | Cache prompt configs to avoid DB lookups on every request |
| Logging          | **Pino**                | Structured request logs → API call records                |

---

### 4.3 Data Layer

| Component          | Technology                | Justification                                                 |
| ------------------ | ------------------------- | ------------------------------------------------------------- |
| Primary Database   | **PostgreSQL 15+**        | JSONB for workflow definitions and eval results, ACID, mature |
| Connection Pooling | **PgBouncer**             | Prevent connection exhaustion under load                      |
| Cache              | **Redis 7+**              | Session store, rate limit counters, prompt config cache       |
| Job Queue          | **BullMQ (Redis-backed)** | Evaluation jobs, async processing, retries, priority          |
| Object Storage     | **AWS S3 / MinIO**        | Dataset files (CSV/JSON), exports, evaluation artifacts       |
| Search (future)    | **pgvector**              | Semantic prompt search using embeddings                       |

**Why PostgreSQL over MongoDB:**
The data model is highly relational (prompts → versions → evaluations → results, datasets → versions → mappings). PostgreSQL's JSONB handles the flexible parts (workflow graphs, model configs, variable definitions) while relational integrity is maintained for the structured core.

---

### 4.4 Authentication & Security

| Component                 | Technology                                             | Justification                                                               |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Auth Provider             | **Clerk**                                              | Magic link, Google/GitHub OAuth, session management, webhooks — zero config |
| Alternative (self-hosted) | **Auth.js v5 (NextAuth)**                              | Full control, no external dependency                                        |
| JWT                       | **jose** library                                       | Standard JWT sign/verify, edge-compatible                                   |
| Password hashing          | **bcrypt**                                             | API key prefix storage                                                      |
| Encryption                | **AES-256-GCM** (Node.js crypto)                       | AI provider API keys at rest                                                |
| API Key format            | `sk_org_[random-32-chars]` / `sk_ws_[random-32-chars]` | Scoped, identifiable                                                        |

---

### 4.5 Real-Time & Messaging

| Component            | Technology                     | Justification                                               |
| -------------------- | ------------------------------ | ----------------------------------------------------------- |
| WebSocket server     | **Socket.io** (NestJS adapter) | Live monitoring dashboard, eval job progress                |
| Job Queue            | **BullMQ**                     | Evaluation jobs with retries, concurrency control, priority |
| Event Bus (internal) | **Redis Pub/Sub**              | Cross-service events (eval completed → notify frontend)     |
| Email (magic links)  | **Resend** or **SendGrid**     | Transactional email delivery                                |

---

### 4.6 Infrastructure & DevOps

#### 4.6.1 Local Development

```yaml
# docker-compose.yml services
services:
  postgres: # PostgreSQL 15
  redis: # Redis 7
  minio: # S3-compatible local storage
  api: # NestJS API server
  worker: # FastAPI eval worker
  gateway: # Fastify proxy
  frontend: # Next.js dev server
```

All services orchestrated with **Docker Compose** for a one-command local setup: `docker compose up`.

#### 4.6.2 Production Infrastructure

| Component                  | Technology                                 | Justification                            |
| -------------------------- | ------------------------------------------ | ---------------------------------------- |
| Containerization           | **Docker**                                 | Consistent environments dev→prod         |
| Container Registry         | **GitHub Container Registry (GHCR)**       | Free, integrated with GitHub Actions     |
| Hosting (startup)          | **Railway** or **Render**                  | Managed, minimal DevOps, supports Docker |
| Hosting (scale)            | **AWS ECS + Fargate**                      | Serverless containers, auto-scaling      |
| Orchestration (enterprise) | **Kubernetes (EKS/GKE)**                   | Full control, horizontal scaling         |
| CDN                        | **Vercel** (for Next.js) or **CloudFront** | Edge caching, global performance         |
| Reverse Proxy              | **Nginx** or **Traefik**                   | SSL termination, routing, rate limiting  |
| Database hosting           | **AWS RDS PostgreSQL** or **Supabase**     | Managed, automated backups               |
| Redis hosting              | **AWS ElastiCache** or **Upstash**         | Managed Redis, serverless option         |
| Object storage             | **AWS S3**                                 | Reliable, cheap, S3-standard             |

#### 4.6.3 CI/CD Pipeline (GitHub Actions)

```
Push to branch:
  └─→ Lint (ESLint, Prettier, Ruff)
  └─→ Type check (tsc --noEmit)
  └─→ Unit tests (Vitest, Pytest)
  └─→ Build Docker images

Push to main:
  └─→ All above
  └─→ Integration tests (Supertest, pytest-asyncio)
  └─→ Push images to GHCR
  └─→ Deploy to staging (Railway/Render)

Tag (v*.*.*):
  └─→ All above
  └─→ E2E tests (Playwright)
  └─→ Deploy to production
  └─→ Create GitHub Release
```

#### 4.6.4 Observability Stack

| Component             | Technology                                      | Purpose                                              |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Error tracking        | **Sentry**                                      | Frontend + backend exception capture                 |
| Application metrics   | **Prometheus**                                  | Custom metrics (eval jobs, API latency, queue depth) |
| Metrics visualization | **Grafana**                                     | Dashboards for infra and app metrics                 |
| Logs aggregation      | **Loki + Grafana** (self-hosted) or **Datadog** | Structured log search                                |
| Distributed tracing   | **OpenTelemetry + Jaeger**                      | Trace LLM calls end-to-end                           |
| Uptime monitoring     | **BetterUptime** or **UptimeRobot**             | External availability checks                         |

---

### 4.7 Testing Strategy

| Layer                 | Technology                                        | Coverage Target                  |
| --------------------- | ------------------------------------------------- | -------------------------------- |
| Unit tests (frontend) | **Vitest + React Testing Library**                | 80% coverage                     |
| Unit tests (backend)  | **Jest** (NestJS) + **Pytest** (FastAPI)          | 80% coverage                     |
| Integration tests     | **Supertest** (API) + **pytest-asyncio** (worker) | All endpoints                    |
| E2E tests             | **Playwright**                                    | Critical user flows              |
| Load tests            | **k6**                                            | API Gateway (target: 1000 req/s) |
| Visual regression     | **Percy** or **Chromatic**                        | UI component snapshots           |

**Key E2E flows to cover with Playwright:**

1. Create prompt → version → connect dataset → run evaluation → view results
2. Deploy prompt DEV → STAGING → PROD
3. Build agent workflow → connect nodes → test run
4. Create API key → call live endpoint → verify response

---

### 4.8 Full Stack Summary Table

| Layer              | Technology               | Alternative considered | Why chosen                                  |
| ------------------ | ------------------------ | ---------------------- | ------------------------------------------- |
| Frontend framework | **Next.js 14**           | Vite + React           | SSR, routing, BFF built-in                  |
| Frontend language  | **TypeScript**           | JavaScript             | Type safety, shared types                   |
| UI components      | **shadcn/ui + Tailwind** | MUI, Chakra            | Composable, no runtime overhead             |
| Node editor        | **React Flow**           | Custom canvas          | Battle-tested, feature-complete             |
| Main API           | **NestJS**               | Express, Django        | TypeScript ecosystem, fast dev              |
| Eval worker        | **FastAPI**              | Node.js                | Python LLM ecosystem (LiteLLM, HF evaluate) |
| LLM abstraction    | **LiteLLM**              | Direct SDKs            | Unified interface for all providers         |
| ML metrics         | **HuggingFace evaluate** | Custom implementations | Native F1, EM, BERTScore, BLEU              |
| Database           | **PostgreSQL**           | MongoDB                | Relational integrity + JSONB flexibility    |
| Queue              | **BullMQ**               | Kafka, RabbitMQ        | Redis-based, simple, TypeScript-native      |
| Auth               | **Clerk**                | Auth.js, Supabase Auth | Fastest to implement, feature-rich          |
| Proxy gateway      | **Fastify**              | Express, NestJS        | Highest throughput for hot path             |
| Real-time          | **Socket.io**            | SSE, raw WebSocket     | Reconnection, rooms, wide browser support   |
| Storage            | **S3 / MinIO**           | Local filesystem       | Scalable, standard, works local+cloud       |
| CI/CD              | **GitHub Actions**       | GitLab CI, CircleCI    | Free, integrated with repo                  |
| Error tracking     | **Sentry**               | Rollbar                | Best Next.js + NestJS integration           |

---

## 5. Authentication & Organizations

### 5.1 Authentication Flow

- **Magic Link** (email-based, passwordless) — primary method
- **OAuth** — Google, GitHub
- **API Key** — for programmatic access

### 5.2 Signup / Login

```
POST /auth/magic-link          → Send magic link email
GET  /auth/verify?token=...    → Verify token, create session
POST /auth/oauth/google        → OAuth callback
POST /auth/logout              → Invalidate session
GET  /auth/me                  → Get current user
```

### 5.3 Organization Model

- A **User** can belong to multiple **Organizations**
- Each Organization has multiple **Workspaces**
- An Organization has a **plan** (free, pro, enterprise) and billing settings
- Users have roles scoped to the organization

### 5.4 Data Model

```sql
users (id, email, name, avatar_url, created_at)
organizations (id, name, slug, plan, created_at)
org_members (id, org_id, user_id, role, joined_at)
workspaces (id, org_id, name, slug, created_at)
workspace_members (id, workspace_id, user_id, role)
```

---

## 6. Workspace Management

### 6.1 Features

- Each user/org can have multiple workspaces (e.g., "default", "production", "experiments")
- Resources (prompts, datasets, agents) are scoped to a workspace
- Workspace-level API keys
- Workspace-level AI provider configurations
- **Delete workspace**: owners can delete a workspace and all its contents (prompts, datasets, evaluations, deployments) via a confirmation dialog in the sidebar switcher; cascade-deletes enforced by the database
- **Delete organization**: owners can delete an organization and all its workspaces and their contents via a confirmation dialog; cascade-deletes enforced by the database

### 6.2 Overview Dashboard

The workspace overview page shows:

- Total prompts, agents, datasets
- Recent evaluation results
- Active deployments count
- Recent API call volume (sparkline)
- Quick links to recent resources

---

## 7. Prompt Engineering Hub

### 7.1 Overview

The central hub for managing all LLM prompts. Accessible at `/prompts`.

### 7.2 Prompt List View

- Grid, table, and list display modes
- Search by name
- Filter by workspace, status (LIVE / draft), quality grade (A+, B, N/A)
- Sort by: created date, last updated, evaluation count
- Show per card: name, status badge, quality grade, character count, version number, evaluation count, last updated date
- Global actions: **Version Comparison**, **Regression Testing**, **Quality Detection**
- Import prompt from JSON/YAML

### 7.3 Prompt Creation

```
POST /api/prompts
Body: {
  name: string,           // required, unique per workspace
  description: string,
  workspace_id: string,
  content: string,        // prompt text with {{variable}} syntax
  variables: Variable[]   // auto-extracted or manually defined
}
```

**Variable detection:**

- Auto-parse `{{variable_name}}` patterns from prompt content
- Each variable has: `name`, `type` (string | number | boolean | array | object), `description`, `default_value`

### 7.4 Prompt Versioning

- Every save creates a new immutable version
- Version numbering: v1, v2, v3... (sequential)
- Each version stores: content, variables, character count, created_at, created_by
- **Version Comparison**: side-by-side diff of two versions
- **Regression Testing**: run latest version against historical dataset, compare scores
- **Quality Detection**: AI-powered detection of prompt quality degradation between versions

### 7.5 Prompt Detail Page

Tabs: **Overview** | **Prompt** | **Dataset** | **AI Provider** | **Environments** | **Failover** | **Analytics**

#### 7.5.1 Overview Tab

Three cards:

1. **Version & Data Card**: current prompt version, dataset version, total versions, dataset rows, connected dataset status, total evaluations (completed count)
2. **Configuration & Performance Card**: AI provider name, model name, success rate (%), avg response time (seconds), model parameters (temp, top_p, max_tokens)
3. **Deployment & Quality Card**: failover toggle status, staging version, production version, evaluation quality (last grade, best grade), last evaluation timestamp

#### 7.5.2 Prompt Tab

- View current prompt content (read-only)
- Current version badge
- List of variables (name + type)
- Button: **Edit Prompt** → opens editor
- Button: **Back to Overview**

**Edit Mode:**

- Rich text editor with `{{variable}}` syntax highlighting
- Variables panel (left sidebar) showing all extracted variables as draggable chips
- "Create Variables" button to manually add variables
- Character count display
- Save creates new version automatically

#### 7.5.3 Dataset Tab

- Dataset selection: connect an existing dataset or disconnect
- Show connected dataset info: name, version, last updated
- **Variable Mapping**: drag-and-drop interface mapping prompt variables to dataset columns
  - Left: list of prompt variable chips (e.g., `{{inputtext}}`, `{{categories}}`)
  - Right: dataset column dropdowns
- Save Mapping button
- Dataset Preview: show first 2 rows with mapped columns
- "View Full Dataset (N rows)" link

#### 7.5.4 AI Provider Tab

- Select active AI provider (from configured providers list)
- Select model
- Configure model parameters:
  - Temperature (0.0 – 2.0, step 0.1)
  - Top P (0.0 – 1.0)
  - Top K (integer)
  - Max Tokens (integer)
  - Repetition Penalty (0.0 – 2.0)
  - Frequency Penalty (optional)
  - Stop sequences (optional)

#### 7.5.5 Environments Tab → see Section 11

#### 7.5.6 Failover Tab → see Section 12

#### 7.5.7 Analytics Tab → see Section 18

---

## 8. Dataset Engineering Hub

### 8.1 Overview

Accessible at `/dataset`. Manages evaluation datasets with full versioning.

### 8.2 Dataset List View

- Grid / table / list display
- Search by name
- 20+ datasets supported
- Show per card: name, row count, version number, version count, last updated
- Status indicator (green = active, orange = inactive/error)
- Quick actions: View, Versions, Download

### 8.3 Dataset Creation

```
POST /api/datasets
Body: {
  name: string,
  description: string,
  workspace_id: string
}
```

Upload via:

- CSV file upload
- JSON file upload
- Manual row entry (future)
- API push

### 8.4 Dataset Versioning

- Every upload creates a new version
- Versions are immutable once created
- Version metadata: row count, column count, file size (bytes), created_at
- Status: `latest` | `archived`
- Actions per version: promote to latest (↑), preview (👁), download (⬇)

### 8.5 Dataset Detail Page

- Header: name, version badge (v7), row count, created date, status (Active)
- **Data Preview**: table showing all columns and first N rows
- Column names can match prompt variable names (e.g., `{{INPUTTEXT}}`, `{{CATEGORIES}}`) and ground truth (`EXPECTED_RESULT`)
- Icons: version history, edit metadata, download

### 8.6 Version History Page (`/dataset/:id/versions`)

- Left panel: list of all versions with checkbox selection
- Each version shows: version number, status (Latest/Archived), row count, file size, timestamp
- Actions: promote (↑), preview (👁), download (⬇)
- Select 2 versions → **Compare** button appears

### 8.7 Version Comparison Modal

Side-by-side comparison showing:

- Version numbers, creation dates, row/column counts
- **Changes Summary**:
  - Row Count Diff (e.g., -8)
  - Added Rows (green)
  - Removed Rows (red)
  - Modified Rows (orange)
  - Size Change percentage
  - Column Changes count
  - Total Changes count

### 8.8 Dataset Engineering Hub Features

Quick access buttons:

- **Model Testing**: test a model against a dataset directly
- **Data Quality Analysis**: run quality checks (null values, duplicates, schema validation)
- **Performance Benchmarks**: compare dataset versions' impact on eval scores

---

## 9. AI Provider Configuration

### 9.1 Overview

Accessible at `/ai-providers`. Manage connections to external LLM providers.

### 9.2 Supported Providers (at launch)

| Provider             | Notes                            |
| -------------------- | -------------------------------- |
| OpenAI               | GPT-4, GPT-3.5, etc.             |
| TogetherAI           | Open-source models               |
| Mistral AI           | Mistral 7B, Mixtral, etc.        |
| Anthropic            | Claude models                    |
| Groq                 | Fast inference                   |
| Ollama               | Local models                     |
| Custom / Self-hosted | BYO endpoint (OpenAI-compatible) |

### 9.3 Provider Configuration

```
POST /api/providers
Body: {
  name: string,
  provider_type: enum(openai|togetherai|mistral|anthropic|groq|ollama|custom),
  api_key: string (encrypted at rest),
  base_url: string (optional, for custom),
  workspace_id: string
}
```

### 9.4 Model Selection

- Each provider exposes a list of available models
- Models can be pinned to a prompt configuration
- Model metadata: name, context window, cost per 1M tokens (input/output), supports streaming

---

## 10. Evaluation System

### 10.1 Overview

The evaluation system runs batch jobs that send each dataset row through the prompt, collect responses, and score them against expected results using configurable metrics.

### 10.2 Configure Evaluation Flow (2-step wizard)

**Step 1 — Select Metrics:**

- Grid of available metrics with category filters
- Categories: Quality, Coherence, Consistency, Cost, Performance, Relevance, Reliability, Similarity, Speed, Sustainability, Technical
- Each metric card shows: name, category, description, "Learn more" toggle, selection checkbox
- **AI-Powered Metric Suggestions**: analyze the prompt and auto-recommend top metrics with match % and AI insight explanation

**Step 2 — Review:**

- Summary of: prompt name, version, dataset name/version, row count, selected metrics list, AI config
- Status: "Ready to evaluate" (green) when all components configured
- **Start Evaluation** button

### 10.3 Available Metrics (Minimum)

| Metric                   | Category       | Description                            |
| ------------------------ | -------------- | -------------------------------------- |
| Accuracy                 | Quality        | Overall correct response rate          |
| Exact Match (EM)         | Quality        | % of exactly correct responses         |
| F1-Score                 | Quality        | Balance between precision and recall   |
| Precision                | Quality        | Correct positive predictions ratio     |
| Recall                   | Quality        | Ability to find all positive instances |
| Fluency Score            | Coherence      | Grammar and readability                |
| Grammar Score            | Coherence      | Syntactic correctness                  |
| Perplexity               | Coherence      | Model confidence measure               |
| Consistency Score        | Consistency    | Output stability across runs           |
| Response Variance        | Consistency    | Standard deviation of outputs          |
| Cost Estimate            | Cost           | Estimated cost per evaluation          |
| Cost per Request         | Performance    | Average cost per API call              |
| Eval Duration            | Performance    | Total evaluation time                  |
| Input Tokens             | Performance    | Average input token count              |
| Output Tokens            | Performance    | Average output token count             |
| Overall Efficiency Score | Composite      | Quality/cost ratio                     |
| Latency (p50/p90/p99)    | Speed          | Response time percentiles              |
| Processing Speed         | Speed          | Tokens per second                      |
| Carbon Footprint         | Sustainability | gCO₂ per 1000 tokens                   |
| Power Consumption        | Sustainability | mWh per 1000 tokens                    |

### 10.4 Evaluation Job Execution

**Job lifecycle:** `pending` → `running` → `completed` | `failed`

**Execution steps (shown in UI):**

1. Running prompts through the AI model and collecting responses
2. Evaluating responses against defined metrics
3. Calculating performance scores and generating insights
4. Preparing comprehensive results and recommendations

**Job metadata stored:**

- Job ID (UUID)
- prompt_id, prompt_version
- dataset_id, dataset_version
- provider, model
- model parameters (temp, top_p, top_k, max_tokens, rep_penalty)
- started_at, completed_at, duration
- status, error_message (if failed)

### 10.5 Evaluation Job Detail Page

Sections:

**Overview:**

- Progress bar (0-100%)
- Prompt name, Model, Provider, Created date
- Model config parameters
- Status badge + Grade badge (A+, A, B, C, D, F)

**Performance Metrics:**

- Accuracy %, Processing Speed (tok/s), Latency p50 (s), Reliability %, Consistency %
- Each with color-coded progress bar and grade badge

**Cost & Performance Analysis:**

- Cost Metrics: Cost/1k Correct Outputs ($), Cost/1M Tokens ($), Cost Efficiency %
- Performance Metrics: Cost per Second ($), Power Consumption (mWh), Carbon Footprint (gCO₂)
- Focus tags: Cost, Power, Speed, Accuracy

**Evaluation Metrics Detail (5 selected):**

- Card per metric: score %, threshold %, trend indicator (↑↓), grade badge, description, "Suggestion d'amélioration" link

**Grading Scale:**

- A+ : ≥ 95%
- A : ≥ 90%
- B : ≥ 80%
- C : ≥ 70%
- D : ≥ 60%
- F : < 60%

### 10.6 Evaluation Jobs List Page (`/evaluation-jobs`)

- KPIs: Total, Pending, Running, Completed, Failed
- Search by job ID, prompt name, or model
- Filter by status
- **Auto Refresh** toggle (polls every N seconds)
- List rows showing: job ID, status, prompt, provider, model, parameters, duration, score

---

## 11. Deployment Environments

### 11.1 Environment Pipeline

Three sequential environments: **DEV** → **STAGING** → **PROD**

```
DEV (development)
  └─→ [Promote to STAGING]
        └─→ STAGING
              └─→ [Promote to PROD]
                    └─→ PROD
```

### 11.2 Environment Detail (per environment card)

Each card shows:

- Environment name + status (LIVE badge if active)
- Version deployed (semver, e.g., 1.0.0.1)
- Deployment timestamp
- Total deployments count
- Failover config (Primary provider, Secondary provider)
- Actions: **GO LIVE** | **Promote to [next env]** | **Rollback**

### 11.3 DEV Environment

- Always uses the latest prompt version automatically
- Shows the latest evaluation run (number + timestamp)
- Total evaluations count
- Warning if published endpoint is not using latest version
- Action: **Promote to STAGING** (triggers version lock)

### 11.4 STAGING Environment

- Locked to a specific version (e.g., 1.0.0.1)
- Shows deployment timestamp
- Actions: **GO LIVE**, **Promote to PROD**, **Rollback**

### 11.5 PROD Environment

- Locked to a specific version
- Actions: **GO LIVE**, **Rollback**

### 11.6 Pipeline View

- Visual pipeline showing DEV → STAGING → PROD with connecting arrows
- Dots indicate pending state (animated while deploying)
- Status: 2 Active, 1 LIVE

### 11.7 History View

Full audit log of all deployments:

- Timestamp, actor (user), action (promoted/rolled back), from_version, to_version, environment

### 11.8 Versioning Scheme

Semver-like: `MAJOR.MINOR.PATCH.BUILD`  
Example: `1.0.0.1` → `1.0.0.2` on next deployment

---

## 12. Failover System

### 12.1 Overview

Configure automatic fallback to a secondary AI provider/model when the primary fails.

### 12.2 Provider Configuration (per environment)

- **Primary Provider**: select from configured AI providers + model
- **Secondary Provider**: select fallback provider + model
- Each provider card shows: Model name, Evaluations count, Avg Latency (ms), Success Rate %, Eligible for use status

### 12.3 Failover Triggers

| Setting                      | Default | Description                             |
| ---------------------------- | ------- | --------------------------------------- |
| Automatic Failover           | ON      | Switch to secondary when primary fails  |
| Timeout (ms)                 | 30000   | Max wait before triggering failover     |
| Error Threshold              | 3       | Number of errors before switching       |
| Max Latency (ms)             | 5000    | Latency threshold to trigger failover   |
| Auto Recovery                | ON      | Return to primary when available        |
| Recovery Check Interval (ms) | 300000  | How often to check primary availability |

### 12.4 Failover Status

- Shown in Overview card as "Failover OFF/ON"
- Status badge on environment: eligible / not eligible

---

## 13. Agent Workflow Studio

### 13.1 Overview

A visual no-code/low-code workflow builder for creating multi-step AI agent pipelines. Accessible at `/agents`.

### 13.2 Agent List View

- Cards showing: agent name, status (Draft/Live), environment, version, node count
- Filter by workspace, status, environment
- Actions: View, Edit, Delete

### 13.3 Agent Detail Page

Tabs: **Overview** | **Workflow Builder** | **Environments** | **Execution** | **Analytics**

**Overview Tab:**

- Agent Information: name, description, workspace, environment, version, created_at
- KPIs: Nodes count, Version, Success Rate, Avg Cost, Last Run timestamp

### 13.4 Workflow Studio Editor (`/agents/:id/edit`)

**Canvas:**

- Dark background dot-grid canvas (infinite, pannable, zoomable)
- Zoom controls (+ / -)
- Node counter display ("2 nodes · 1 edges")
- Top toolbar: Import, Export, Clear, Test Run, Reset, Versions, Help, Save, Close (×)
- Undo/Redo support

**Node Palette (left sidebar):**

| Node Type | Color      | Description                          |
| --------- | ---------- | ------------------------------------ |
| Start     | Green      | Entry point, defines input variables |
| Prompt    | Blue       | Calls a deployed prompt API          |
| Condition | Orange     | If/else branching logic              |
| Loop      | Purple     | Iterate over a list                  |
| Parallel  | Dark Green | Execute multiple nodes concurrently  |
| Output    | Pink       | Define the final output format       |

**Node Connections:**

- Drag from output handle (right circle) to input handle (left circle)
- Arrows/bezier curves connecting nodes

**Start Node Configuration:**

- Import Variables from Prompt (auto-extract from selected prompt)
- Prompt Environment selector: Dev / Staging / Prod
- Select Prompt dropdown (searchable, shows prompt name + description)
- Input Variables section:
  - Variable Name, Type (String/Number/Boolean/Array/Object), Default Value, Description
  - "+ Add Variable" button
  - Variables auto-populated when prompt selected

**Prompt Node Configuration:**

- Prompt Environment selector: Dev / Staging / Prod
- Select Prompt dropdown (searchable)
- Output Key: string key to store this node's output (e.g., "result", "analysis_result")
- The node displays the live API URL: `/api/v1/live/[env]-prompt-[id]`

**Test Run:**

- Opens test panel with input variable form
- Shows execution trace (node by node)
- Shows final output

### 13.5 Agent Versioning

- Each save can optionally create a new version
- Versions panel shows all saved versions with timestamp

### 13.6 Agent Analytics

- Success Rate, Avg Cost, Nodes count
- Execution history (future)

---

## 14. API Gateway & Proxy

### 14.1 Overview

The API Gateway exposes deployed prompts and agents as authenticated REST endpoints.  
Accessible at `/proxy`.

### 14.2 Gateway Overview Page

Key Features listed:

- Environment Management (dev, staging, prod)
- API Key Authentication
- Real-time Monitoring
- Version Control

Quick Start Guide:

1. Create an API Key
2. Deploy Your Prompt
3. Make Your First API Call

### 14.3 Live Prompt APIs Tab

- List of all active prompt endpoints
- Filter by environment (All / Dev / Staging / Prod) and status (All / Active / Inactive / Deprecated)
- Each endpoint card:
  - Prompt name, environment badge, status (active/inactive)
  - URL: `/api/v1/live/[hash]`
  - Last Response Time (seconds)
  - AI Model name
  - Buttons: **Test**, **Docs**, **Copy URL**

### 14.4 Live Agent APIs Tab

- Same layout as Live Prompt APIs but for agent endpoints

### 14.5 API Test Modal

- Endpoint name in header
- API Key input field (sk*org*...)
- **Quick Fill** button (populate from saved keys)
- Dynamic variable input fields (one per prompt variable)
- **Test API** button
- Response display (JSON)

### 14.6 Docs Generation

Auto-generate API documentation for each endpoint:

- Endpoint URL
- Authentication header format
- Request body schema (JSON)
- Response schema
- Example curl command
- Code snippets (Python, Node.js, curl)

### 14.7 Analytics Tab (Gateway-level)

- Aggregate stats across all endpoints:
  - Total calls, success rate, avg latency, total cost
  - Time-series graph by endpoint

### 14.8 Settings Tab

- Rate limiting configuration
- CORS settings
- IP allowlist/blocklist
- Request logging toggle

### 14.9 Proxy Request Format

```
POST /api/v1/live/{endpoint_hash}
Headers:
  Authorization: Bearer sk_org_xxx
  Content-Type: application/json
Body:
  { "[variable_name]": "value", ... }

Response:
  { "output": "...", "latency_ms": 320, "tokens": { "input": 45, "output": 30 } }
```

---

## 15. API Keys Management

### 15.1 Overview

Accessible at `/api-keys`. Manage authentication keys for API access.

### 15.2 Key Types / Scopes

| Scope        | Prefix    | Description                        |
| ------------ | --------- | ---------------------------------- |
| Organization | `sk_org_` | Access all workspaces in org       |
| Workspace    | `sk_ws_`  | Access only the specific workspace |
| Read-only    | `sk_ro_`  | GET requests only                  |

### 15.3 Key Metadata

- Name (human-readable label)
- Key prefix (first 12 chars shown, rest masked)
- Scope badge
- Status: Active / Expired / Disabled
- Rate Limits: X req/min, Y req/day
- Usage count (total requests)
- Last Used timestamp
- Created by, Created at
- Expiry date (optional)

### 15.4 Key Management

```
GET    /api/api-keys              → list all keys
POST   /api/api-keys              → create new key (returns full key once)
PUT    /api/api-keys/:id          → update name, rate limits
DELETE /api/api-keys/:id          → revoke key
POST   /api/api-keys/:id/disable  → disable without deleting
```

### 15.5 Usage Analytics per Key

- Requests over time graph
- Success/error breakdown
- Most used endpoints

### 15.6 Tabs

- All Keys, Active, Expired, Disabled, By Usage

### 15.7 KPI Header

- Total Keys, Active count + percentage bar, Expiring soon, Expired count

---

## 16. Live Monitoring

### 16.1 Overview

Accessible at `/monitoring`. Real-time API performance monitoring with auto-refresh every 5 seconds.

### 16.2 Controls

- Time range selector: Last 5 min / Last Hour / Last 24 Hours / Last 7 Days
- Filter by: All Prompts / specific prompt
- Last updated timestamp
- **Refresh Now** button

### 16.3 KPI Cards (Top Row)

| KPI             | Description                       |
| --------------- | --------------------------------- |
| Total API Calls | Count in selected time range      |
| Success Rate    | % success + "X success, Y errors" |
| Avg Latency     | Response time in seconds          |
| Total Tokens    | Input ↓ / Output ↑ counts         |

### 16.4 Activity Windows

Three cards showing call counts:

- Last Minute
- Last Hour
- Last 24 Hours

### 16.5 Real-Time Performance Chart

- Live-updating line chart (updates every 5s via WebSocket)
- Metrics toggles: Calls, Success %, Latency, Tokens
- Expandable to full-screen

### 16.6 Recent Errors Section

- List of recent failed requests with: timestamp, endpoint, error code, error message, latency

### 16.7 WebSocket Events

```json
{
  "type": "metrics_update",
  "data": {
    "calls_last_minute": 5,
    "success_rate": 100.0,
    "avg_latency_ms": 320,
    "tokens_in": 45,
    "tokens_out": 30
  }
}
```

---

## 17. API Calls Tracking

### 17.1 Overview

Accessible at `/api-calls`. Historical log and analytics of all API calls grouped by endpoint.

### 17.2 Summary KPIs

- Total Endpoints active
- Total Calls (all time)
- Avg Success Rate (%)
- Total Cost ($)

### 17.3 Filter by Environment

Tabs: All | Dev | Staging | Prod

### 17.4 Per-Endpoint Breakdown

Each endpoint section shows:

- Endpoint URL with status dot (green = healthy)
- Total Calls count
- Last Call (relative time: "1d ago")
- Success Rate %
- Avg Latency (seconds)
- Total Cost ($)
- Total Tokens (input ↓ / output ↑ / total)
- Success breakdown (N success, N error)
- **Show Recent Calls (N)** expandable section

### 17.5 Individual Call Log

Each call record:

- Timestamp
- Request ID
- Input variables (truncated)
- Output (truncated)
- Latency (ms)
- Tokens (in/out)
- Status (success/error)
- Cost ($)

---

## 18. Analytics & Insights

### 18.1 Prompt-Level Analytics (`/prompt-analytics/:id`)

**KPI Header:**

- Avg Accuracy %
- Avg Reliability %
- Avg Consistency %
- Avg Efficiency %
- Latest Grade (A+, A, B...)

**Performance Over Time Chart:**

- X-axis: evaluation number (#1 to #N)
- Y-axis left: Score % (0-100)
- Y-axis right: Latency (seconds)
- Metrics toggles: Accuracy, Reliability, Consistency, Overall Efficiency, Latency
- Model Filter dropdown: All Models / specific model
- Interactive tooltips on hover showing: eval number, date, model, config, metric value

**Tooltip data:**

```
Evaluation 47 - 13/10/2025 10:08:15
Model: ServiceNow-AI/Apriel-1.5-15b-Thinker
Config: Temp: 0.7, Top P: 1, Top K: 40, Max Tokens: 1000, Rep. Penalty: 1
Latency: 2.33s
```

**Recent Evaluations Table:**

- Tabs: All / Completed / Failed
- Columns: eval ID, status, provider, model, prompt version, dataset version, parameters, duration, score/10, grade

### 18.2 Prompt Inline Analytics (inside Prompt detail page)

Smaller version of the analytics with:

- Performance Over Time (last 10 evals)
- **Optimization Suggestions** panel (right side):
  - Config warnings (orange, with specific action)
  - **Improved Prompt Version** (AI-generated improved version of the prompt)

**Example Optimization Suggestions:**

- "Config: The model's temperature setting might be too high, leading to less reliable predictions. → Decrease the temperature setting to 0.5 or lower."
- "Config: Adjust max_tokens to 200"
- "Improved Prompt Version: [AI-rewritten prompt with improvements]"

### 18.3 Gateway-Level Analytics

- Total calls over time
- Cost per day/week
- Latency distribution histogram
- Error rate over time
- Top endpoints by usage

---

## 19. Projects

### 19.1 Overview

Projects group related prompts, datasets, agents, and evaluations together.

### 19.2 Project Features

- Create a project with name, description, color tag
- Associate prompts, datasets, and agents with a project
- Project-level dashboard showing combined metrics
- Useful for organizing by feature (e.g., "Customer Support AI", "Code Review Bot")

---

## 20. Non-Functional Requirements

### 20.1 Performance

| Metric                    | Target                        |
| ------------------------- | ----------------------------- |
| API response time (p95)   | < 200ms (excluding LLM calls) |
| Dashboard load time       | < 2 seconds                   |
| Evaluation job throughput | 10+ concurrent jobs           |
| Live monitoring refresh   | Every 5 seconds               |
| Dataset upload size       | Up to 100MB                   |
| Max dataset rows          | 100,000 rows                  |
| Max prompts per workspace | 1,000                         |
| Max versions per prompt   | Unlimited                     |

### 20.2 Scalability

- Horizontal scaling of API server and eval workers
- Redis-based job queue (BullMQ) for evaluation jobs
- Database connection pooling (PgBouncer)
- CDN for static assets
- Async processing for large dataset uploads

### 20.3 Reliability

- 99.9% uptime SLA for API Gateway (proxy)
- Eval worker auto-restart on crash
- Job retry on failure (max 3 retries with exponential backoff)
- Database daily backups
- Graceful degradation (show cached data if live data unavailable)

### 20.4 Observability

- Structured JSON logging (request ID, user ID, resource ID, duration, status)
- Error tracking (Sentry or equivalent)
- Custom application metrics exported to Prometheus
- Distributed tracing for LLM calls (trace ID propagation)

### 20.5 Internationalization

- UI in English (v1)
- Date/time formatted per user's locale
- Currency formatted per organization's currency setting (USD default)

---

## 21. Database Schema Overview

### 21.1 Core Tables

```sql
-- Prompts
prompts (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft | live | archived
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Prompt Versions
prompt_versions (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  character_count INTEGER,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Prompt Variables
prompt_variables (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  name VARCHAR(255),
  type VARCHAR(50), -- string | number | boolean | array | object
  description TEXT,
  default_value TEXT
)

-- Datasets
datasets (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Dataset Versions
dataset_versions (
  id UUID PRIMARY KEY,
  dataset_id UUID REFERENCES datasets(id),
  version_number INTEGER,
  storage_path TEXT, -- S3 path
  row_count INTEGER,
  column_count INTEGER,
  file_size_bytes INTEGER,
  columns JSONB, -- column names and types
  status VARCHAR(50) DEFAULT 'latest', -- latest | archived
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Prompt Dataset Mapping
prompt_dataset_configs (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  dataset_id UUID REFERENCES datasets(id),
  dataset_version_id UUID REFERENCES dataset_versions(id),
  variable_mapping JSONB, -- {"prompt_var": "dataset_column"}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- AI Providers
ai_providers (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR(255),
  provider_type VARCHAR(100),
  api_key_encrypted TEXT,
  base_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Prompt AI Config
prompt_ai_configs (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  provider_id UUID REFERENCES ai_providers(id),
  model_name VARCHAR(255),
  temperature FLOAT DEFAULT 0.7,
  top_p FLOAT DEFAULT 1.0,
  top_k INTEGER DEFAULT 40,
  max_tokens INTEGER DEFAULT 1000,
  repetition_penalty FLOAT DEFAULT 1.0,
  frequency_penalty FLOAT,
  stop_sequences TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Evaluation Jobs
evaluation_jobs (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  prompt_version_id UUID REFERENCES prompt_versions(id),
  dataset_id UUID REFERENCES datasets(id),
  dataset_version_id UUID REFERENCES dataset_versions(id),
  provider_id UUID REFERENCES ai_providers(id),
  model_name VARCHAR(255),
  model_config JSONB,
  metrics TEXT[],
  status VARCHAR(50) DEFAULT 'pending', -- pending|running|completed|failed
  progress INTEGER DEFAULT 0,
  grade VARCHAR(5),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Evaluation Results
evaluation_results (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES evaluation_jobs(id),
  metric_name VARCHAR(255),
  score FLOAT,
  grade VARCHAR(5),
  threshold FLOAT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Deployment Environments
deployments (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  environment VARCHAR(50), -- dev | staging | prod
  version_string VARCHAR(20), -- semver: 1.0.0.1
  prompt_version_id UUID REFERENCES prompt_versions(id),
  provider_id UUID REFERENCES ai_providers(id),
  secondary_provider_id UUID REFERENCES ai_providers(id),
  is_live BOOLEAN DEFAULT FALSE,
  deployed_by UUID REFERENCES users(id),
  deployed_at TIMESTAMPTZ DEFAULT NOW()
)

-- Failover Config
failover_configs (
  id UUID PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id),
  is_enabled BOOLEAN DEFAULT TRUE,
  timeout_ms INTEGER DEFAULT 30000,
  error_threshold INTEGER DEFAULT 3,
  max_latency_ms INTEGER DEFAULT 5000,
  auto_recovery BOOLEAN DEFAULT TRUE,
  recovery_check_interval_ms INTEGER DEFAULT 300000,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- API Keys
api_keys (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  org_id UUID REFERENCES organizations(id),
  name VARCHAR(255),
  key_hash TEXT, -- bcrypt hash of full key
  key_prefix VARCHAR(12), -- first 12 chars for display
  scope VARCHAR(50), -- organization | workspace | readonly
  rate_limit_per_min INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- API Calls Log
api_call_logs (
  id UUID PRIMARY KEY,
  endpoint_hash VARCHAR(255),
  prompt_id UUID REFERENCES prompts(id),
  api_key_id UUID REFERENCES api_keys(id),
  environment VARCHAR(50),
  request_body JSONB,
  response_body JSONB,
  status_code INTEGER,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd FLOAT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Agents
agents (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  current_version VARCHAR(20) DEFAULT 'v1.0.0',
  workflow_definition JSONB, -- full node/edge graph
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 22. API Endpoints Reference

### 22.1 Authentication

```
POST   /auth/magic-link
GET    /auth/verify
POST   /auth/logout
GET    /auth/me
```

### 22.2 Prompts

All prompt routes are workspace-scoped under `/api/workspaces/:workspaceId/prompts`.

```
GET    /api/workspaces/:workspaceId/prompts                          → list
POST   /api/workspaces/:workspaceId/prompts                          → create
GET    /api/workspaces/:workspaceId/prompts/:id                      → get detail
PUT    /api/workspaces/:workspaceId/prompts/:id                      → update
DELETE /api/workspaces/:workspaceId/prompts/:id                      → delete
GET    /api/workspaces/:workspaceId/prompts/:id/versions             → list versions
GET    /api/workspaces/:workspaceId/prompts/:id/versions/:v          → get version
POST   /api/workspaces/:workspaceId/prompts/:id/versions/compare     → diff two versions
GET    /api/workspaces/:workspaceId/prompts/:id/analytics            → analytics data
GET    /api/workspaces/:workspaceId/prompts/:id/dataset-config       → get connected dataset config
PUT    /api/workspaces/:workspaceId/prompts/:id/dataset-config       → save variable mapping
GET    /api/workspaces/:workspaceId/prompts/:id/ai-configs           → list AI configurations (returns array, use [0])
PUT    /api/workspaces/:workspaceId/prompts/:id/ai-configs           → upsert AI configuration
```

### 22.3 Datasets

Dataset CRUD routes are workspace-scoped; upload/preview/compare are dataset-scoped only.

```
GET    /api/workspaces/:workspaceId/datasets                         → list
POST   /api/workspaces/:workspaceId/datasets                         → create
GET    /api/workspaces/:workspaceId/datasets/:id                     → get detail
PUT    /api/workspaces/:workspaceId/datasets/:id                     → update
DELETE /api/workspaces/:workspaceId/datasets/:id                     → delete
POST   /api/datasets/:id/upload                                      → upload new version (multipart/form-data)
GET    /api/datasets/:id/versions
POST   /api/datasets/:id/versions/compare                            → diff two versions
GET    /api/datasets/:id/versions/:v/preview                         → get rows preview
```

### 22.4 Evaluations

```
GET    /api/evaluations                      → list jobs
POST   /api/evaluations                      → create + start job
GET    /api/evaluations/:id                  → job detail + results
DELETE /api/evaluations/:id                  → cancel job
GET    /api/metrics                          → list available metrics
POST   /api/metrics/suggest                  → AI metric suggestions for prompt
```

### 22.5 Deployments

```
GET    /api/prompts/:id/deployments          → list all envs
POST   /api/prompts/:id/deploy               → deploy to env
POST   /api/prompts/:id/promote              → promote dev→staging or staging→prod
POST   /api/prompts/:id/rollback             → rollback env
POST   /api/prompts/:id/go-live              → activate live endpoint
```

### 22.6 Agents

```
GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PUT    /api/agents/:id
DELETE /api/agents/:id
PUT    /api/agents/:id/workflow              → save workflow graph
POST   /api/agents/:id/test-run             → execute workflow with test inputs
```

### 22.7 API Keys

```
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys/:id
POST   /api/api-keys/:id/disable
GET    /api/api-keys/:id/usage
```

### 22.8 Gateway / Proxy

```
GET    /api/gateway/endpoints               → list live endpoints
GET    /api/gateway/endpoints/:hash         → endpoint detail + docs
POST   /api/v1/live/:hash                   → execute prompt (authenticated)
GET    /api/gateway/analytics
```

### 22.9 Monitoring

```
GET    /api/monitoring/summary              → KPI summary
GET    /api/monitoring/timeseries           → time-series data
WS     /ws/monitoring                       → real-time updates
```

---

## 23. UI/UX Requirements

### 23.1 Design System

- **Color Palette**:
  - Primary: `#4F46E5` (indigo-600)
  - Accent: `#7C3AED` (violet-600)
  - Success: `#10B981` (emerald-500)
  - Warning: `#F59E0B` (amber-500)
  - Danger: `#EF4444` (red-500)
  - Background: `#F8FAFC` (slate-50)
  - Dark Canvas: `#0F172A` (slate-900) — for Workflow Studio

- **Typography**: Inter font, sizes 12/14/16/20/24/32px

- **Component Library**: shadcn/ui as base with custom extensions

### 23.2 Layout

- **Sidebar navigation** (collapsible, 240px expanded / 64px collapsed)
- **Top header** per section with title + breadcrumb + action buttons
- **Purple gradient banner** inside detail pages for section titles

### 23.3 Navigation Structure

```
WORKSPACE
  ├── Overview
  └── Projects

DEVELOPMENT
  ├── Prompts
  ├── Agents
  └── Datasets

DEPLOYMENT
  ├── Evaluations
  ├── AI Providers
  ├── API Keys
  ├── API Gateway
  ├── Live Monitoring
  └── API Calls
```

### 23.4 Responsiveness

- Desktop-first (min-width 1280px for full functionality)
- Tablet support (min-width 768px) with collapsed sidebar
- Mobile: read-only views only (v1)

### 23.5 Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive elements
- ARIA labels on all form controls
- Sufficient color contrast ratios

### 23.6 Loading States

- Skeleton loaders for all data tables and cards
- Spinner for in-progress operations
- Optimistic UI updates where appropriate

### 23.7 Empty States

- Illustrated empty states with clear CTAs
- Example: "No prompts yet. Create your first prompt →"

### 23.8 Toast Notifications

- Success: green, auto-dismiss after 3s
- Error: red, persistent until dismissed
- Warning: orange, auto-dismiss after 5s

---

## 24. Security Requirements

### 24.1 Authentication

- Passwords never stored (magic link / OAuth only)
- JWT access tokens: 15 min expiry
- Refresh tokens: 30 days, stored in httpOnly cookies
- API keys: hashed with bcrypt before storage; full key shown only once at creation

### 24.2 API Security

- All endpoints require authentication except public health check
- Rate limiting per API key (configurable)
- CORS restricted to known origins
- Request size limits (10MB default, 100MB for dataset uploads)
- SQL injection prevention via parameterized queries / ORM

### 24.3 Data Security

- AI provider API keys encrypted at rest (AES-256)
- All data transmitted over HTTPS/TLS 1.3
- PII (emails, names) separated from analytics data
- Dataset files stored in private S3 buckets with signed URLs

### 24.4 Audit Logging

- All state-changing operations logged: user, action, resource, timestamp, IP
- Deployment promotions require explicit confirmation
- Sensitive actions (delete, API key creation) require re-authentication or 2FA (v2)

---

## 25. Milestones & Phased Delivery

### Phase 1 — Foundation (Weeks 1-4)

- [ ] Project scaffolding (monorepo, Docker, CI/CD)
- [ ] Auth system (magic link + JWT)
- [ ] Organizations, Workspaces, Users, Roles
- [ ] Prompt CRUD + versioning
- [ ] Basic prompt editor with variable detection

### Phase 2 — Datasets & Evaluation (Weeks 5-8)

- [ ] Dataset upload and versioning
- [ ] Variable mapping (prompt ↔ dataset)
- [ ] AI Provider configuration
- [ ] Evaluation job engine (basic metrics: accuracy, exact match, F1)
- [ ] Evaluation job detail page

### Phase 3 — Deployment Pipeline (Weeks 9-11)

- [ ] DEV / STAGING / PROD environments
- [ ] Promote / Rollback / Go Live
- [ ] API Key management
- [ ] API Gateway (proxy to deployed prompts)
- [ ] Basic API call logging

### Phase 4 — Monitoring & Analytics (Weeks 12-14)

- [ ] Live Monitoring (WebSocket, auto-refresh)
- [ ] API Calls by endpoint view
- [ ] Performance Over Time charts
- [ ] Full metrics suite (15+ metrics)
- [ ] Failover configuration + runtime switching

### Phase 5 — Advanced Features (Weeks 15-18)

- [ ] Agent Workflow Studio (node editor)
- [ ] AI-powered metric suggestions
- [ ] AI-powered optimization suggestions
- [ ] Version comparison (prompts + datasets)
- [ ] Cost & Carbon Footprint tracking
- [ ] Regression Testing feature

### Phase 6 — Polish & Scale (Weeks 19-20)

- [ ] Performance optimization
- [ ] Security hardening
- [ ] Full test coverage (unit + integration + e2e)
- [ ] Documentation site
- [ ] Onboarding tour (Retake Tour feature)
- [ ] Architect AI assistant (prompt writing help)

---

## Appendix A — Glossary

| Term           | Definition                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| Prompt         | A templated instruction sent to an LLM, with `{{variable}}` placeholders           |
| Prompt Version | An immutable snapshot of a prompt's content at a point in time                     |
| Dataset        | A collection of rows used as inputs/expected outputs for evaluation                |
| Evaluation Job | A batch run that executes a prompt against all dataset rows and scores the results |
| Workspace      | An isolated environment for organizing resources (prompts, datasets, agents)       |
| Environment    | A deployment stage: Dev, Staging, or Production                                    |
| Endpoint       | A live REST URL that executes a deployed prompt                                    |
| Node           | A single step in an agent workflow (Start, Prompt, Condition, Loop, etc.)          |
| Grade          | A letter score (A+, A, B, C, D, F) summarizing evaluation quality                  |
| Failover       | Automatic switch to a backup AI provider when the primary fails                    |
| API Proxy      | The reverse proxy layer that routes requests to the correct model/version          |

---

## Appendix B — Environment Variables

```env
# App
NODE_ENV=production
APP_URL=https://app.yourdomain.com
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/llmops

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
MAGIC_LINK_EXPIRES_IN=15m

# Email (for magic links)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key
EMAIL_FROM=noreply@yourdomain.com

# Storage
S3_BUCKET=llmops-datasets
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
# When running inside Docker Compose, set this to the service name — NOT localhost.
# Example: S3_ENDPOINT=http://minio:9000
S3_ENDPOINT=

# Encryption (for AI provider keys)
ENCRYPTION_KEY=your-32-byte-aes-key-hex

# AI Providers (default org-level)
OPENAI_API_KEY=sk-...
TOGETHER_API_KEY=...

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Appendix C — Technology Stack Quick Reference

### C.1 Complete Stack — Quick Reference Table

The following table summarizes the final technology choices for the entire platform with recommended versions:

| Layer                       | Technology                       | Version |
| --------------------------- | -------------------------------- | ------- |
| **Frontend framework**      | Next.js (App Router)             | 14+     |
| **Frontend language**       | TypeScript                       | 5+      |
| **Styling**                 | Tailwind CSS + shadcn/ui         | Latest  |
| **Node Editor**             | React Flow                       | 11+     |
| **Charts**                  | Recharts                         | 2+      |
| **Forms**                   | React Hook Form + Zod            | Latest  |
| **Server state**            | TanStack Query                   | v5      |
| **Client state**            | Zustand                          | 4+      |
| **Auth client**             | Clerk                            | Latest  |
| **Real-time client**        | Socket.io-client                 | 4+      |
| **API principale**          | NestJS (TypeScript)              | 10+     |
| **Runtime API**             | Node.js                          | 20+     |
| **ORM (Node)**              | Prisma                           | 5+      |
| **Eval Worker**             | FastAPI (Python)                 | 0.110+  |
| **Runtime Worker**          | Python                           | 3.11+   |
| **ORM (Python)**            | SQLAlchemy (async)               | 2+      |
| **Proxy Gateway**           | Fastify                          | 4+      |
| **Base de données**         | PostgreSQL                       | 15+     |
| **Connection pool**         | PgBouncer                        | Latest  |
| **Cache / Queue**           | Redis 7 + BullMQ                 | 7+ / 5+ |
| **Stockage fichiers**       | AWS S3 / MinIO                   | Latest  |
| **LLM Integration**         | LiteLLM                          | Latest  |
| **Métriques ML**            | HuggingFace `evaluate`           | Latest  |
| **Semantic similarity**     | sentence-transformers            | Latest  |
| **Auth**                    | Clerk (ou Auth.js v5)            | Latest  |
| **Temps réel (server)**     | Socket.io / NestJS WebSockets    | 4+      |
| **Email**                   | Resend ou SendGrid               | Latest  |
| **Error tracking**          | Sentry                           | Latest  |
| **Infra locale**            | Docker Compose                   | Latest  |
| **Containerization**        | Docker                           | Latest  |
| **Registry**                | GitHub Container Registry        | —       |
| **Infra prod (startup)**    | Railway / Fly.io                 | —       |
| **Infra prod (scale)**      | AWS ECS + Fargate                | —       |
| **Infra prod (enterprise)** | Kubernetes (EKS/GKE)             | —       |
| **CDN**                     | Vercel / CloudFront              | —       |
| **Reverse proxy**           | Nginx / Traefik                  | Latest  |
| **CI/CD**                   | GitHub Actions                   | —       |
| **Tests unitaires (front)** | Vitest + React Testing Library   | Latest  |
| **Tests unitaires (back)**  | Jest (NestJS) + Pytest (FastAPI) | Latest  |
| **Tests E2E**               | Playwright                       | Latest  |
| **Tests de charge**         | k6                               | Latest  |
| **Métriques infra**         | Prometheus + Grafana             | Latest  |
| **Logs**                    | Pino + Loki                      | Latest  |
| **Tracing**                 | OpenTelemetry + Jaeger           | Latest  |

---

---

## Appendix D — Implementation Notes & Constraints

Operational decisions made during implementation that are not obvious from the feature requirements.

### D.1 NestJS / Fastify Bootstrap Order

The NestJS API uses the Fastify HTTP adapter. Two registrations **must** happen before `app.init()`:

1. **CORS** — `app.enableCors(...)` must be called before `app.init()`. Calling it after silently has no effect and all browser preflight (`OPTIONS`) requests will return 404.
2. **Multipart** — `@fastify/multipart` must be registered via `app.register(require('@fastify/multipart'), { limits: { fileSize: 50 * 1024 * 1024 } })` before `app.init()`. Without this, file upload endpoints return `415 Unsupported Media Type`.

**Version constraint:** Use `@fastify/multipart@8.x`. Version 9+ requires Fastify 5; this project uses Fastify 4.

### D.2 Workspace-Scoped Routing Convention

All resource modules (prompts, datasets, AI providers, API keys, evaluations) must follow the workspace-scoped URL pattern:

```text
/api/workspaces/:workspaceId/<resource>
```

Every controller must apply `WorkspaceGuard` (which validates that the authenticated user is a member of the requested workspace). The `WorkspacesModule` must be imported by any module whose controller uses `WorkspaceGuard`.

### D.3 Docker Compose — Inter-Service URLs

When services communicate inside Docker Compose, use the **service name** as the hostname, not `localhost`. `localhost` resolves to the container itself.

| Variable       | Inside Docker                        | Outside Docker (local dev)            |
| -------------- | ------------------------------------ | ------------------------------------- |
| `DATABASE_URL` | `postgresql://...@postgres:5432/...` | `postgresql://...@localhost:5432/...` |
| `REDIS_URL`    | `redis://redis:6379`                 | `redis://localhost:6379`              |
| `S3_ENDPOINT`  | `http://minio:9000`                  | `http://localhost:9000`               |

### D.4 Prisma BigInt Serialization

PostgreSQL `BIGINT` columns (e.g. `DatasetVersion.fileSizeBytes`) are mapped by Prisma to JavaScript `BigInt`. `JSON.stringify` cannot serialize `BigInt` and will throw `TypeError: Do not know how to serialize a BigInt`.

**Pattern:** convert to `string` at the service layer before returning from the controller:

```ts
function serializeVersion(v: DatasetVersion) {
  return { ...v, fileSizeBytes: v.fileSizeBytes.toString() };
}
```

Never rely on the framework to serialize BigInt transparently.

### D.5 AI Config Response Shape

`GET /api/workspaces/:workspaceId/prompts/:id/ai-configs` returns `PromptAiConfig[]` (an array). The frontend must read `response.data[0]` to obtain the single active config. The field containing the model name is `modelName` (not `model`) in both the DTO and the database column.

### D.6 Clerk JIT User Provisioning

In local development, Clerk webhooks (`user.created`) cannot reach `localhost`. This means users authenticated via Clerk never get inserted into the local `users` table via the webhook flow. The `AuthGuard` must implement Just-In-Time (JIT) provisioning: on the first authenticated request, if the user does not exist in the database, fetch user details from the Clerk API and upsert the `User` row.

---

_This document is a living specification. Features marked for future phases should be tracked in the project issue tracker._
