-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "progress" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "triggered_by" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_owner_repo_idx" ON "job_runs"("owner", "repo");

-- CreateIndex
CREATE INDEX "job_runs_status_idx" ON "job_runs"("status");

-- CreateIndex
CREATE INDEX "job_runs_started_at_idx" ON "job_runs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "job_runs_job_type_idx" ON "job_runs"("job_type");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_owner_repo_job_type_running_idx" ON "job_runs"("owner", "repo", "job_type") WHERE status = 'running';