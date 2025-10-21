-- CreateTable
CREATE TABLE "pr_scores" (
    "id" TEXT NOT NULL,
    "pr_id" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "author_github_id" BIGINT,
    "score" DOUBLE PRECISION NOT NULL,
    "init_run_id" TEXT NOT NULL,
    "init_version" TEXT NOT NULL DEFAULT 'bts1.0',
    "updater_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_scores_owner_repo_idx" ON "pr_scores"("owner", "repo");

-- CreateIndex
CREATE INDEX "pr_scores_pr_id_idx" ON "pr_scores"("pr_id");

-- CreateIndex
CREATE INDEX "pr_scores_init_run_id_idx" ON "pr_scores"("init_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_scores_owner_repo_pr_number_key" ON "pr_scores"("owner", "repo", "pr_number");

-- AddForeignKey
ALTER TABLE "pr_scores" ADD CONSTRAINT "pr_scores_owner_repo_pr_number_fkey" FOREIGN KEY ("owner", "repo", "pr_number") REFERENCES "pull_requests"("owner", "repo", "pr_number") ON DELETE CASCADE ON UPDATE CASCADE;
