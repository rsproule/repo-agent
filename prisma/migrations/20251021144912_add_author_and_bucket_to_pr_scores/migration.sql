/*
  Warnings:

  - Added the required column `author` to the `pr_scores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bucket` to the `pr_scores` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pr_scores" ADD COLUMN     "author" TEXT NOT NULL,
ADD COLUMN     "bucket" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "pr_scores_author_idx" ON "pr_scores"("author");

-- CreateIndex
CREATE INDEX "pr_scores_bucket_idx" ON "pr_scores"("bucket");
