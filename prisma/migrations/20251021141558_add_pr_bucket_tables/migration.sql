-- CreateTable
CREATE TABLE "pr_bucket_classification_runs" (
    "run_id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "lowest_pr_number" INTEGER NOT NULL,
    "highest_pr_number" INTEGER NOT NULL,
    "pr_count" INTEGER NOT NULL,
    "version" TEXT,
    "model" TEXT,
    "total_cost" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_bucket_classification_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "pr_buckets" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_id" BIGINT NOT NULL,
    "bucket" INTEGER NOT NULL,
    "additions" INTEGER,
    "deletions" INTEGER,
    "changed_files" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_bucket_classification_runs_owner_repo_idx" ON "pr_bucket_classification_runs"("owner", "repo");

-- CreateIndex
CREATE INDEX "pr_bucket_classification_runs_created_at_idx" ON "pr_bucket_classification_runs"("created_at");

-- CreateIndex
CREATE INDEX "pr_buckets_owner_repo_idx" ON "pr_buckets"("owner", "repo");

-- CreateIndex
CREATE INDEX "pr_buckets_bucket_idx" ON "pr_buckets"("bucket");

-- CreateIndex
CREATE INDEX "pr_buckets_run_id_idx" ON "pr_buckets"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_buckets_run_id_owner_repo_pr_number_key" ON "pr_buckets"("run_id", "owner", "repo", "pr_number");

-- AddForeignKey
ALTER TABLE "pr_buckets" ADD CONSTRAINT "pr_buckets_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pr_bucket_classification_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_buckets" ADD CONSTRAINT "pr_buckets_owner_repo_pr_number_fkey" FOREIGN KEY ("owner", "repo", "pr_number") REFERENCES "pull_requests"("owner", "repo", "pr_number") ON DELETE CASCADE ON UPDATE CASCADE;
