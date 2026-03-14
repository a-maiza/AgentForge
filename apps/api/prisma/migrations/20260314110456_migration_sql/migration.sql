-- DropForeignKey
ALTER TABLE "prompt_versions" DROP CONSTRAINT "prompt_versions_created_by_fkey";

-- DropForeignKey
ALTER TABLE "prompts" DROP CONSTRAINT "prompts_created_by_fkey";

-- AlterTable
ALTER TABLE "org_members" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prompt_variables" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prompt_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prompts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspace_members" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspaces" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
