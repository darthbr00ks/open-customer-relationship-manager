CREATE TYPE "email_policy_scope_enum" AS ENUM ('system', 'alias', 'profile', 'user');
CREATE TYPE "email_record_type_enum" AS ENUM ('none', 'case', 'deal');
CREATE TYPE "email_owner_type_enum" AS ENUM ('user', 'queue', 'round_robin');
CREATE TYPE "email_direction_enum" AS ENUM ('inbound', 'outbound');

CREATE TABLE "email_alias" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "email_address" VARCHAR(320) NOT NULL,
  "display_name" VARCHAR(255),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "email_alias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_automation_policy" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "scope_type" "email_policy_scope_enum" NOT NULL,
  "alias_id" UUID,
  "profile_id" UUID,
  "user_id" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "record_type" "email_record_type_enum" NOT NULL DEFAULT 'none',
  "only_create_for_net_new" BOOLEAN NOT NULL DEFAULT true,
  "default_owner_type" "email_owner_type_enum",
  "default_owner_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "email_automation_policy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_email_policy_scope_target" CHECK (
    ("scope_type" = 'system' AND "alias_id" IS NULL AND "profile_id" IS NULL AND "user_id" IS NULL) OR
    ("scope_type" = 'alias' AND "alias_id" IS NOT NULL AND "profile_id" IS NULL AND "user_id" IS NULL) OR
    ("scope_type" = 'profile' AND "alias_id" IS NULL AND "profile_id" IS NOT NULL AND "user_id" IS NULL) OR
    ("scope_type" = 'user' AND "alias_id" IS NULL AND "profile_id" IS NULL AND "user_id" IS NOT NULL)
  ),
  CONSTRAINT "ck_email_policy_owner" CHECK (
    ("default_owner_type" IS NULL AND "default_owner_id" IS NULL) OR
    ("default_owner_type" IS NOT NULL AND "default_owner_id" IS NOT NULL)
  )
);

CREATE TABLE "email_thread" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "external_reference_id" VARCHAR(64) NOT NULL,
  "related_record_type" "email_record_type_enum" NOT NULL DEFAULT 'none',
  "related_record_id" UUID,
  "case_id" UUID,
  "deal_id" UUID,
  "participants" TEXT[],
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_thread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_email_thread_record" CHECK (
    ("related_record_type" = 'none' AND "related_record_id" IS NULL AND "case_id" IS NULL AND "deal_id" IS NULL) OR
    ("related_record_type" = 'case' AND "related_record_id" = "case_id" AND "case_id" IS NOT NULL AND "deal_id" IS NULL) OR
    ("related_record_type" = 'deal' AND "related_record_id" = "deal_id" AND "deal_id" IS NOT NULL AND "case_id" IS NULL)
  )
);

CREATE TABLE "email_message" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "external_message_id" VARCHAR(998) NOT NULL,
  "thread_id" UUID,
  "direction" "email_direction_enum" NOT NULL DEFAULT 'inbound',
  "from_address" VARCHAR(320) NOT NULL,
  "to_addresses" TEXT[],
  "cc_addresses" TEXT[],
  "bcc_addresses" TEXT[],
  "subject" VARCHAR(998) NOT NULL,
  "text_body" TEXT,
  "html_body" TEXT,
  "in_reply_to" VARCHAR(998),
  "reference_message_ids" TEXT[],
  "received_alias_id" UUID,
  "received_user_id" UUID,
  "related_record_type" "email_record_type_enum" NOT NULL DEFAULT 'none',
  "related_record_id" UUID,
  "raw_headers" JSONB,
  "raw_storage_key" VARCHAR(2048),
  "received_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_email_alias_address" ON "email_alias"("workspace_id", "email_address");
CREATE INDEX "ix_email_alias_workspace_active" ON "email_alias"("workspace_id", "active");
CREATE UNIQUE INDEX "uq_email_policy_alias" ON "email_automation_policy"("workspace_id", "scope_type", "alias_id");
CREATE UNIQUE INDEX "uq_email_policy_profile" ON "email_automation_policy"("workspace_id", "scope_type", "profile_id");
CREATE UNIQUE INDEX "uq_email_policy_user" ON "email_automation_policy"("workspace_id", "scope_type", "user_id");
CREATE UNIQUE INDEX "uq_email_policy_system" ON "email_automation_policy"("workspace_id") WHERE "scope_type" = 'system';
CREATE INDEX "ix_email_policy_scope" ON "email_automation_policy"("workspace_id", "scope_type");
CREATE UNIQUE INDEX "uq_email_thread_reference" ON "email_thread"("workspace_id", "external_reference_id");
CREATE INDEX "ix_email_thread_record" ON "email_thread"("workspace_id", "related_record_type", "related_record_id");
CREATE UNIQUE INDEX "uq_email_message_provider_id" ON "email_message"("workspace_id", "provider", "external_message_id");
CREATE INDEX "ix_email_message_in_reply_to" ON "email_message"("workspace_id", "in_reply_to");
CREATE INDEX "ix_email_message_thread" ON "email_message"("workspace_id", "thread_id", "received_at");

ALTER TABLE "email_automation_policy" ADD CONSTRAINT "email_automation_policy_alias_id_fkey"
  FOREIGN KEY ("alias_id") REFERENCES "email_alias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "email_thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_received_alias_id_fkey"
  FOREIGN KEY ("received_alias_id") REFERENCES "email_alias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
