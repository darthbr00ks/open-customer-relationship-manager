-- CreateEnum
CREATE TYPE "chat_intake_mode_enum" AS ENUM ('deal', 'case', 'none');

-- CreateEnum
CREATE TYPE "chat_auth_mode_enum" AS ENUM ('none', 'optional', 'required');

-- CreateEnum
CREATE TYPE "chat_conversation_status_enum" AS ENUM ('open', 'pending', 'closed');

-- CreateEnum
CREATE TYPE "chat_author_type_enum" AS ENUM ('contact', 'user', 'system');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "note_parent_type_enum" ADD VALUE 'chat_channel';
ALTER TYPE "note_parent_type_enum" ADD VALUE 'chat_conversation';

-- CreateTable
CREATE TABLE "chat_channel" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "name" VARCHAR(255) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "intake_mode" "chat_intake_mode_enum" NOT NULL DEFAULT 'case',
    "auth_mode" "chat_auth_mode_enum" NOT NULL DEFAULT 'none',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "greeting" TEXT,
    "offline_message" TEXT,
    "collect_name" BOOLEAN NOT NULL DEFAULT true,
    "collect_email" BOOLEAN NOT NULL DEFAULT true,
    "auto_create_entity" BOOLEAN NOT NULL DEFAULT true,
    "default_assignee_user_id" UUID,
    "deal_stage" "deal_stage_enum" NOT NULL DEFAULT 'qualification',
    "deal_currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "case_priority" "case_priority_enum" NOT NULL DEFAULT 'medium',
    "case_category" VARCHAR(100),
    "allowed_origins" VARCHAR(2048),
    "session_ttl_hours" INTEGER NOT NULL DEFAULT 720,

    CONSTRAINT "chat_channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_contact" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "person_id" UUID,
    "entity_id" UUID,
    "email" VARCHAR(320),
    "display_name" VARCHAR(255),
    "verified_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_session" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "is_authenticated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_auth_code" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_auth_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversation" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "status" "chat_conversation_status_enum" NOT NULL DEFAULT 'open',
    "assigned_user_id" UUID,
    "entity_id" UUID,
    "person_id" UUID,
    "deal_id" UUID,
    "case_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_contact_message_at" TIMESTAMPTZ(6),
    "last_agent_message_at" TIMESTAMPTZ(6),
    "agent_read_at" TIMESTAMPTZ(6),
    "contact_read_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "author_type" "chat_author_type_enum" NOT NULL,
    "author_user_id" UUID,
    "author_contact_id" UUID,
    "author_name" VARCHAR(255),
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_chat_channel_key" ON "chat_channel"("key");

-- CreateIndex
CREATE INDEX "ix_chat_channel_workspace" ON "chat_channel"("workspace_id");

-- CreateIndex
CREATE INDEX "ix_chat_channel_workspace_mode" ON "chat_channel"("workspace_id", "intake_mode");

-- CreateIndex
CREATE INDEX "ix_chat_contact_workspace" ON "chat_contact"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chat_contact_channel_email" ON "chat_contact"("channel_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chat_session_token" ON "chat_session"("token_hash");

-- CreateIndex
CREATE INDEX "ix_chat_session_contact" ON "chat_session"("contact_id");

-- CreateIndex
CREATE INDEX "ix_chat_auth_code_lookup" ON "chat_auth_code"("channel_id", "email", "created_at");

-- CreateIndex
CREATE INDEX "ix_chat_conversation_workspace_status" ON "chat_conversation"("workspace_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "ix_chat_conversation_channel" ON "chat_conversation"("workspace_id", "channel_id");

-- CreateIndex
CREATE INDEX "ix_chat_conversation_contact" ON "chat_conversation"("contact_id");

-- CreateIndex
CREATE INDEX "ix_chat_message_conversation" ON "chat_message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_chat_message_workspace" ON "chat_message"("workspace_id");

-- AddForeignKey
ALTER TABLE "chat_contact" ADD CONSTRAINT "chat_contact_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_contact" ADD CONSTRAINT "chat_contact_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_contact" ADD CONSTRAINT "chat_contact_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_session" ADD CONSTRAINT "chat_session_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_session" ADD CONSTRAINT "chat_session_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "chat_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_auth_code" ADD CONSTRAINT "chat_auth_code_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "chat_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
