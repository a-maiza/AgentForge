-- CreateTable
CREATE TABLE "evaluation_traces" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "input_data" JSONB NOT NULL,
    "prediction" TEXT NOT NULL,
    "reference" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_traces_job_id_row_index_idx" ON "evaluation_traces"("job_id", "row_index");

-- AddForeignKey
ALTER TABLE "evaluation_traces" ADD CONSTRAINT "evaluation_traces_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "evaluation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
