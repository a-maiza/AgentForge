DB_URL=postgresql://agentforge:agentforge@localhost:5432/agentforge

.PHONY: setup migrate seed generate dev down reset help

## First-time setup: infra + migration + seed + generate + build
setup:
	@echo "→ Starting infrastructure..."
	docker compose up -d postgres pgbouncer redis minio minio-init
	@echo "→ Waiting for postgres to be ready..."
	@until docker compose exec -T postgres pg_isready -U agentforge -d agentforge > /dev/null 2>&1; do sleep 1; done
	@echo "→ Running Prisma migration..."
	DATABASE_URL=$(DB_URL) pnpm --filter @agentforge/api db:migrate
	@echo "→ Seeding default org / workspace / admin user..."
	DATABASE_URL=$(DB_URL) pnpm --filter @agentforge/api db:seed
	@echo "→ Generating Prisma client..."
	pnpm --filter @agentforge/api db:generate
	@echo "→ Building and starting all services..."
	docker compose up --build

## Apply pending migrations + regenerate Prisma client (run after schema changes)
migrate:
	DATABASE_URL=$(DB_URL) pnpm --filter @agentforge/api db:migrate
	pnpm --filter @agentforge/api db:generate

## Seed default data only
seed:
	DATABASE_URL=$(DB_URL) pnpm --filter @agentforge/api db:seed

## Regenerate Prisma client only
generate:
	pnpm --filter @agentforge/api db:generate

## Start all services (rebuild images)
dev:
	docker compose up --build

## Stop all services
down:
	docker compose down

## Reset database (drops all data) + re-run migration + seed
reset:
	@echo "→ Resetting database..."
	DATABASE_URL=$(DB_URL) pnpm --filter @agentforge/api db:migrate:reset
	@echo "→ Seeding..."
	DATABASE_URL=$(DB_URL) pnpm --filter @agentforge/api db:seed
	@echo "→ Regenerating Prisma client..."
	pnpm --filter @agentforge/api db:generate

## Show available commands
help:
	@echo ""
	@echo "  make setup     — First-time setup (infra + migrate + seed + generate + build)"
	@echo "  make dev       — docker compose up --build"
	@echo "  make migrate   — Apply pending migrations + regenerate Prisma client"
	@echo "  make seed      — Seed default org / workspace / admin user"
	@echo "  make generate  — Regenerate Prisma client"
	@echo "  make down      — Stop all services"
	@echo "  make reset     — Drop DB + migrate + seed (dev only)"
	@echo ""
