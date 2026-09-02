-- CreateEnum
CREATE TYPE "email_account_status_enum" AS ENUM ('connected', 'needs_reauth', 'disconnected');

-- CreateEnum
CREATE TYPE "email_message_status_enum" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "auth_provider" VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "name" VARCHAR(255),
    "picture_url" VARCHAR(2048),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_account" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(255),
    "status" "email_account_status_enum" NOT NULL DEFAULT 'connected',
    "user_id" UUID,
    "provider_account_id" VARCHAR(255),
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "scope" TEXT,
    "last_error" TEXT,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_message" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "parent_type" "note_parent_type_enum",
    "parent_id" UUID,
    "to_addresses" TEXT NOT NULL,
    "cc_addresses" TEXT,
    "bcc_addresses" TEXT,
    "subject" VARCHAR(998) NOT NULL,
    "body_text" TEXT NOT NULL,
    "body_html" TEXT,
    "status" "email_message_status_enum" NOT NULL DEFAULT 'queued',
    "provider_message_id" VARCHAR(255),
    "provider_thread_id" VARCHAR(255),
    "error" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_app_user_email" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_app_user_provider_subject" ON "app_user"("auth_provider", "external_id");

-- CreateIndex
CREATE INDEX "ix_email_account_workspace_status" ON "email_account"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_account_address" ON "email_account"("workspace_id", "provider", "email");

-- CreateIndex
CREATE INDEX "ix_email_message_workspace" ON "email_message"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_email_message_parent" ON "email_message"("workspace_id", "parent_type", "parent_id");

-- AddForeignKey
ALTER TABLE "email_account" ADD CONSTRAINT "email_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "email_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
