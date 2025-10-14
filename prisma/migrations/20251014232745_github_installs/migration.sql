-- CreateTable
CREATE TABLE "github_installations" (
    "echo_user_id" TEXT NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "account_login" TEXT,
    "account_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("echo_user_id","installation_id")
);

-- CreateIndex
CREATE INDEX "github_installations_echo_user_id_idx" ON "github_installations"("echo_user_id");
