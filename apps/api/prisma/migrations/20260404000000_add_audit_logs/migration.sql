-- CreateEnum
CREATE TYPE "audit_action" AS ENUM (
  'dataset_created',
  'dataset_updated',
  'dataset_deleted',
  'dataset_version_uploaded',
  'deployment_created',
  'deployment_rolled_back',
  'deployment_went_live',
  'api_key_created',
  'api_key_disabled',
  'api_key_deleted',
  'agent_created',
  'agent_updated',
  'agent_deleted',
  'agent_workflow_saved'
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"       UUID         NOT NULL,
    "workspace_id"  UUID,
    "action"        "audit_action" NOT NULL,
    "resource_type" TEXT         NOT NULL,
    "resource_id"   TEXT         NOT NULL,
    "metadata"      JSONB,
    "ip_address"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
