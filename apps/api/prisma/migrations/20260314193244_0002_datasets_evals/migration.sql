-- CreateEnum
CREATE TYPE "dataset_status" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "dataset_version_status" AS ENUM ('latest', 'archived');

-- CreateEnum
CREATE TYPE "eval_job_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "datasets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "dataset_status" NOT NULL DEFAULT 'active',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_versions" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "column_count" INTEGER NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "columns" JSONB NOT NULL,
    "status" "dataset_version_status" NOT NULL DEFAULT 'latest',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_dataset_configs" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "dataset_version_id" UUID NOT NULL,
    "variable_mapping" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "prompt_dataset_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "base_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_ai_configs" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_name" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "top_p" DOUBLE PRECISION,
    "top_k" INTEGER,
    "max_tokens" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "prompt_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_jobs" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "dataset_version_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_config" JSONB NOT NULL,
    "metrics" TEXT[],
    "status" "eval_job_status" NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "grade" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_results" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "metric_name" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "threshold" DOUBLE PRECISION,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dataset_versions_storage_path_idx" ON "dataset_versions"("storage_path");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_versions_dataset_id_version_number_key" ON "dataset_versions"("dataset_id", "version_number");

-- CreateIndex
CREATE INDEX "evaluation_jobs_prompt_id_status_idx" ON "evaluation_jobs"("prompt_id", "status");

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_dataset_configs" ADD CONSTRAINT "prompt_dataset_configs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_dataset_configs" ADD CONSTRAINT "prompt_dataset_configs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_dataset_configs" ADD CONSTRAINT "prompt_dataset_configs_dataset_version_id_fkey" FOREIGN KEY ("dataset_version_id") REFERENCES "dataset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_ai_configs" ADD CONSTRAINT "prompt_ai_configs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_ai_configs" ADD CONSTRAINT "prompt_ai_configs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_dataset_version_id_fkey" FOREIGN KEY ("dataset_version_id") REFERENCES "dataset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "evaluation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
