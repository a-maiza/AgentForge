-- CreateEnum
CREATE TYPE "deployment_status" AS ENUM ('pending', 'active', 'inactive', 'rolled_back');

-- CreateEnum
CREATE TYPE "deployment_environment" AS ENUM ('dev', 'staging', 'prod');

-- CreateEnum
CREATE TYPE "api_key_type" AS ENUM ('org', 'workspace', 'readonly');

-- CreateEnum
CREATE TYPE "api_key_status" AS ENUM ('active', 'disabled', 'expired');

-- CreateTable
CREATE TABLE "deployments" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "environment" "deployment_environment" NOT NULL,
    "status" "deployment_status" NOT NULL DEFAULT 'pending',
    "version_label" TEXT NOT NULL,
    "endpoint_hash" TEXT,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "deployed_by" UUID NOT NULL,
    "deployed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolled_back_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failover_configs" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "primary_provider_id" UUID NOT NULL,
    "secondary_provider_id" UUID NOT NULL,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "error_threshold" INTEGER NOT NULL DEFAULT 3,
    "latency_threshold_ms" INTEGER NOT NULL DEFAULT 5000,
    "recovery_interval_sec" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failover_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "type" "api_key_type" NOT NULL DEFAULT 'workspace',
    "status" "api_key_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_call_logs" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "api_key_id" UUID,
    "endpoint_hash" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "status_code" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION,
    "is_failover" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deployments_endpoint_hash_key" ON "deployments"("endpoint_hash");

-- CreateIndex
CREATE INDEX "deployments_prompt_id_environment_idx" ON "deployments"("prompt_id", "environment");

-- CreateIndex
CREATE INDEX "deployments_endpoint_hash_idx" ON "deployments"("endpoint_hash");

-- CreateIndex
CREATE UNIQUE INDEX "failover_configs_prompt_id_key" ON "failover_configs"("prompt_id");

-- CreateIndex
CREATE INDEX "api_keys_workspace_id_status_idx" ON "api_keys"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "api_call_logs_endpoint_hash_idx" ON "api_call_logs"("endpoint_hash");

-- CreateIndex
CREATE INDEX "api_call_logs_api_key_id_created_at_idx" ON "api_call_logs"("api_key_id", "created_at");

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_deployed_by_fkey" FOREIGN KEY ("deployed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failover_configs" ADD CONSTRAINT "failover_configs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failover_configs" ADD CONSTRAINT "failover_configs_primary_provider_id_fkey" FOREIGN KEY ("primary_provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failover_configs" ADD CONSTRAINT "failover_configs_secondary_provider_id_fkey" FOREIGN KEY ("secondary_provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_call_logs" ADD CONSTRAINT "api_call_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_call_logs" ADD CONSTRAINT "api_call_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
