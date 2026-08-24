-- CreateEnum
CREATE TYPE "entity_type_enum" AS ENUM ('company', 'nonprofit', 'government', 'education', 'association', 'household', 'other');

-- CreateEnum
CREATE TYPE "relationship_stage_enum" AS ENUM ('prospect', 'customer', 'partner', 'former_customer', 'inactive');

-- CreateEnum
CREATE TYPE "relationship_type_enum" AS ENUM ('employee', 'owner', 'advisor', 'board_member', 'volunteer', 'contractor', 'customer_contact', 'other');

-- CreateEnum
CREATE TYPE "affiliation_status_enum" AS ENUM ('current', 'former');

-- CreateEnum
CREATE TYPE "deal_stage_enum" AS ENUM ('qualification', 'discovery', 'proposal', 'negotiation', 'won', 'lost');

-- CreateEnum
CREATE TYPE "case_status_enum" AS ENUM ('new', 'open', 'pending', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "case_priority_enum" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "case_source_enum" AS ENUM ('email', 'phone', 'web', 'internal', 'integration', 'other');

-- CreateEnum
CREATE TYPE "incident_status_enum" AS ENUM ('investigating', 'identified', 'monitoring', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "incident_severity_enum" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "impact_level_enum" AS ENUM ('minor', 'moderate', 'major', 'critical');

-- CreateEnum
CREATE TYPE "request_status_enum" AS ENUM ('submitted', 'under_review', 'planned', 'in_progress', 'completed', 'declined');

-- CreateEnum
CREATE TYPE "request_priority_enum" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "entity" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "entity_type" "entity_type_enum" NOT NULL,
    "relationship_stage" "relationship_stage_enum" NOT NULL DEFAULT 'prospect',
    "description" TEXT,
    "website_url" VARCHAR(2048),
    "primary_domain" VARCHAR(255),
    "primary_email" VARCHAR(320),
    "primary_phone" VARCHAR(50),
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100),
    "region" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country_code" VARCHAR(2),
    "notes" TEXT,

    CONSTRAINT "entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "preferred_name" VARCHAR(100),
    "primary_email" VARCHAR(320),
    "primary_phone" VARCHAR(50),
    "linkedin_url" VARCHAR(2048),
    "description" TEXT,
    "notes" TEXT,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_person" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "relationship_type" "relationship_type_enum" NOT NULL,
    "job_title" VARCHAR(255),
    "department" VARCHAR(255),
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "status" "affiliation_status_enum" NOT NULL DEFAULT 'current',
    "started_on" DATE,
    "ended_on" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entity_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "name" VARCHAR(255) NOT NULL,
    "entity_id" UUID NOT NULL,
    "primary_contact_person_id" UUID,
    "description" TEXT,
    "stage" "deal_stage_enum" NOT NULL DEFAULT 'qualification',
    "amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "probability" INTEGER,
    "expected_close_date" DATE,
    "closed_at" TIMESTAMPTZ(6),
    "next_step" TEXT,
    "lost_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "case_number" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "entity_id" UUID,
    "reported_by_person_id" UUID,
    "status" "case_status_enum" NOT NULL DEFAULT 'new',
    "priority" "case_priority_enum" NOT NULL DEFAULT 'medium',
    "category" VARCHAR(100),
    "source" "case_source_enum",
    "due_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "resolution" TEXT,

    CONSTRAINT "case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "incident_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "incident_status_enum" NOT NULL DEFAULT 'investigating',
    "severity" "incident_severity_enum" NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "identified_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "root_cause" TEXT,
    "resolution" TEXT,
    "internal_notes" TEXT,
    "public_update" TEXT,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_case" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "impact_level" "impact_level_enum",
    "impact_description" TEXT,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinked_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID,

    CONSTRAINT "incident_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "request_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "entity_id" UUID,
    "requested_by_person_id" UUID,
    "status" "request_status_enum" NOT NULL DEFAULT 'submitted',
    "priority" "request_priority_enum" NOT NULL DEFAULT 'medium',
    "category" VARCHAR(100),
    "business_need" TEXT,
    "decision_notes" TEXT,
    "target_date" DATE,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_entity_workspace_name" ON "entity"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "ix_entity_workspace_stage" ON "entity"("workspace_id", "relationship_stage");

-- CreateIndex
CREATE INDEX "ix_entity_workspace_domain" ON "entity"("workspace_id", "primary_domain");

-- CreateIndex
CREATE INDEX "ix_entity_workspace_id" ON "entity"("workspace_id");

-- CreateIndex
CREATE INDEX "ix_entity_owner_user_id" ON "entity"("owner_user_id");

-- CreateIndex
CREATE INDEX "ix_person_workspace_last_name" ON "person"("workspace_id", "last_name");

-- CreateIndex
CREATE INDEX "ix_person_workspace_email" ON "person"("workspace_id", "primary_email");

-- CreateIndex
CREATE INDEX "ix_person_workspace_id" ON "person"("workspace_id");

-- CreateIndex
CREATE INDEX "ix_entity_person_workspace" ON "entity_person"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_entity_person" ON "entity_person"("workspace_id", "entity_id", "person_id");

-- CreateIndex
CREATE INDEX "ix_deal_workspace_entity" ON "deal"("workspace_id", "entity_id");

-- CreateIndex
CREATE INDEX "ix_deal_workspace_stage" ON "deal"("workspace_id", "stage");

-- CreateIndex
CREATE INDEX "ix_deal_workspace_owner" ON "deal"("workspace_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "ix_deal_expected_close_date" ON "deal"("workspace_id", "expected_close_date");

-- CreateIndex
CREATE INDEX "ix_case_workspace_status" ON "case"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_case_workspace_priority" ON "case"("workspace_id", "priority");

-- CreateIndex
CREATE INDEX "ix_case_workspace_owner" ON "case"("workspace_id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_case_number" ON "case"("workspace_id", "case_number");

-- CreateIndex
CREATE INDEX "ix_incident_workspace_status" ON "incident"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_incident_workspace_severity" ON "incident"("workspace_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "uq_incident_number" ON "incident"("workspace_id", "incident_number");

-- CreateIndex
CREATE INDEX "ix_incident_case_workspace" ON "incident_case"("workspace_id");

-- CreateIndex
CREATE INDEX "ix_incident_case_entity" ON "incident_case"("workspace_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_incident_case" ON "incident_case"("incident_id", "case_id");

-- CreateIndex
CREATE INDEX "ix_request_workspace_status" ON "request"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_request_workspace_priority" ON "request"("workspace_id", "priority");

-- CreateIndex
CREATE INDEX "ix_request_workspace_owner" ON "request"("workspace_id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_request_number" ON "request"("workspace_id", "request_number");

-- AddForeignKey
ALTER TABLE "entity_person" ADD CONSTRAINT "entity_person_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_person" ADD CONSTRAINT "entity_person_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_reported_by_person_id_fkey" FOREIGN KEY ("reported_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_case" ADD CONSTRAINT "incident_case_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_case" ADD CONSTRAINT "incident_case_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_case" ADD CONSTRAINT "incident_case_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_requested_by_person_id_fkey" FOREIGN KEY ("requested_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
