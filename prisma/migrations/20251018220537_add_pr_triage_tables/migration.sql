-- CreateTable
CREATE TABLE "pull_requests" (
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "html_url" TEXT NOT NULL,
    "body" TEXT,
    "pr_created_at" TIMESTAMP(3) NOT NULL,
    "pr_updated_at" TIMESTAMP(3) NOT NULL,
    "merged_at" TIMESTAMP(3),
    "files_changed_count" INTEGER,
    "last_analyzed_at" TIMESTAMP(3),
    "echo_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("owner","repo","pr_number")
);

-- CreateTable
CREATE TABLE "pr_analyses" (
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "impact" JSONB NOT NULL,
    "files_changed" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_analyses_pkey" PRIMARY KEY ("owner","repo","pr_number")
);

-- CreateIndex
CREATE INDEX "pull_requests_owner_repo_idx" ON "pull_requests"("owner", "repo");

-- CreateIndex
CREATE INDEX "pull_requests_echo_user_id_idx" ON "pull_requests"("echo_user_id");

-- CreateIndex
CREATE INDEX "pull_requests_state_idx" ON "pull_requests"("state");

-- CreateIndex
CREATE INDEX "pr_analyses_relevance_idx" ON "pr_analyses"("relevance");

-- AddForeignKey
ALTER TABLE "pr_analyses" ADD CONSTRAINT "pr_analyses_owner_repo_pr_number_fkey" FOREIGN KEY ("owner", "repo", "pr_number") REFERENCES "pull_requests"("owner", "repo", "pr_number") ON DELETE CASCADE ON UPDATE CASCADE;
