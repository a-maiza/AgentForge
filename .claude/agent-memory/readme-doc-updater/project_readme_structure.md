---
name: README structure and section inventory
description: Documents which sections exist in README.md, their order, and key conventions used in this project's documentation
type: project
---

The README.md at the repo root has the following top-level sections in order:

1. Project title + one-liner
2. **Architecture** — Services table (ports), Request flows (4 flows as ASCII diagrams)
3. **Prerequisites** — table of tools + versions
4. **Quick Start** — numbered bash steps
5. **Database Migrations (Prisma)** — migration commands, PgBouncer warning, migration history table
6. **Development Commands** — monorepo, NestJS API, Next.js, Fastify Gateway, FastAPI Worker sub-sections
7. **Environment Variables** — grouped by concern (Database, Auth, Security, Object Storage, Frontend URLs, AI Providers, Monitoring)
8. **Tech Stack** — two-column table
9. **NestJS API — Module Overview (`apps/api`)** — Auth mechanism table, module map (tree), prompt versioning narrative, deployment pipeline narrative, API key format narrative, error format example
10. **Fastify Gateway — Live API Proxy (`apps/gateway`)** — Routes table, request/response shape, auth flow, prompt config caching, rate limiting, failover logic, ApiCallLog persistence, supported providers, k6 load testing (added task 3.3)
11. **Project Structure** — directory tree

**Formatting conventions:**
- Section dividers use `---` (three dashes) on its own line
- Module map uses a monospace tree with inline endpoint lists
- Tables use aligned pipes; all columns padded to the same width within a table
- Code blocks for bash commands always include the language hint
- No emoji anywhere in the file

**Migration history table columns:** Migration name | Phase | Tables added
The table already marks 0003_deployments_gateway as complete (no "todo" marker).

**Task coverage:** README has been updated through task 4.5 (delete workspace/organization). The Next.js Frontend section sits between the Gateway section and Project Structure. Its intro line lists all tasks covered (currently 1.4, 2.3, 3.4, 4.2, 4.3, 4.4, 4.5).

The API client sub-section uses two separate tables — one for task 3.4 groups and one paragraph + table per subsequent task that adds new exports. Task 4.3 extended `organizationsApi`; task 4.5 extended `workspacesApi` with a DELETE endpoint and updated `organizationsApi` to include DELETE.

The `## Project Structure` tree includes `apps/web/src/components/layout/` with `WorkspaceSwitcher.tsx`, `CreateOrganizationModal.tsx`, `CreateWorkspaceModal.tsx`, `DeleteWorkspaceModal.tsx`, and `DeleteOrganizationModal.tsx` as of task 4.5.

**Why:** Needed to update README after tasks 3.1, 3.2, 3.3, 4.2, 4.3.
**How to apply:** When adding new sections, insert them in the order above. The Gateway section sits between NestJS API and Project Structure. The Next.js Frontend section sits between Gateway and Project Structure.
