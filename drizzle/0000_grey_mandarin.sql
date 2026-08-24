CREATE TYPE "public"."affiliation_status_enum" AS ENUM('current', 'former');--> statement-breakpoint
CREATE TYPE "public"."case_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."case_source_enum" AS ENUM('email', 'phone', 'web', 'internal', 'integration', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_status_enum" AS ENUM('new', 'open', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."deal_stage_enum" AS ENUM('qualification', 'discovery', 'proposal', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."entity_type_enum" AS ENUM('company', 'nonprofit', 'government', 'education', 'association', 'household', 'other');--> statement-breakpoint
CREATE TYPE "public"."impact_level_enum" AS ENUM('minor', 'moderate', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_severity_enum" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status_enum" AS ENUM('investigating', 'identified', 'monitoring', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."relationship_stage_enum" AS ENUM('prospect', 'customer', 'partner', 'former_customer', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."relationship_type_enum" AS ENUM('employee', 'owner', 'advisor', 'board_member', 'volunteer', 'contractor', 'customer_contact', 'other');--> statement-breakpoint
CREATE TYPE "public"."request_priority_enum" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."request_status_enum" AS ENUM('submitted', 'under_review', 'planned', 'in_progress', 'completed', 'declined');--> statement-breakpoint
CREATE TABLE "deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"entity_id" uuid NOT NULL,
	"primary_contact_person_id" uuid,
	"description" text,
	"stage" "deal_stage_enum" DEFAULT 'qualification' NOT NULL,
	"amount" numeric(18, 4),
	"currency_code" varchar(3) DEFAULT 'USD' NOT NULL,
	"probability" integer,
	"expected_close_date" date,
	"closed_at" timestamp with time zone,
	"next_step" text,
	"lost_reason" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "entity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"entity_type" "entity_type_enum" NOT NULL,
	"relationship_stage" "relationship_stage_enum" DEFAULT 'prospect' NOT NULL,
	"description" text,
	"website_url" varchar(2048),
	"primary_domain" varchar(255),
	"primary_email" varchar(320),
	"primary_phone" varchar(50),
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"city" varchar(100),
	"region" varchar(100),
	"postal_code" varchar(20),
	"country_code" varchar(2),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "entity_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"relationship_type" "relationship_type_enum" NOT NULL,
	"job_title" varchar(255),
	"department" varchar(255),
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"status" "affiliation_status_enum" DEFAULT 'current' NOT NULL,
	"started_on" date,
	"ended_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_entity_person" UNIQUE("workspace_id","entity_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"incident_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"status" "incident_status_enum" DEFAULT 'investigating' NOT NULL,
	"severity" "incident_severity_enum" NOT NULL,
	"started_at" timestamp with time zone,
	"identified_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"root_cause" text,
	"resolution" text,
	"internal_notes" text,
	"public_update" text,
	CONSTRAINT "uq_incident_number" UNIQUE("workspace_id","incident_number")
);
--> statement-breakpoint
CREATE TABLE "incident_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"impact_level" "impact_level_enum",
	"impact_description" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlinked_at" timestamp with time zone,
	"created_by_user_id" uuid,
	CONSTRAINT "uq_incident_case" UNIQUE("incident_id","case_id")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"preferred_name" varchar(100),
	"primary_email" varchar(320),
	"primary_phone" varchar(50),
	"linkedin_url" varchar(2048),
	"description" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"request_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"entity_id" uuid,
	"requested_by_person_id" uuid,
	"status" "request_status_enum" DEFAULT 'submitted' NOT NULL,
	"priority" "request_priority_enum" DEFAULT 'medium' NOT NULL,
	"category" varchar(100),
	"business_need" text,
	"decision_notes" text,
	"target_date" date,
	"completed_at" timestamp with time zone,
	CONSTRAINT "uq_request_number" UNIQUE("workspace_id","request_number")
);
--> statement-breakpoint
CREATE TABLE "case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"archived_at" timestamp with time zone,
	"case_number" varchar(50) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"entity_id" uuid,
	"reported_by_person_id" uuid,
	"status" "case_status_enum" DEFAULT 'new' NOT NULL,
	"priority" "case_priority_enum" DEFAULT 'medium' NOT NULL,
	"category" varchar(100),
	"source" "case_source_enum",
	"due_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	CONSTRAINT "uq_case_number" UNIQUE("workspace_id","case_number")
);
--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_primary_contact_person_id_person_id_fk" FOREIGN KEY ("primary_contact_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_person" ADD CONSTRAINT "entity_person_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_person" ADD CONSTRAINT "entity_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_case" ADD CONSTRAINT "incident_case_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_case" ADD CONSTRAINT "incident_case_case_id_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_case" ADD CONSTRAINT "incident_case_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_requested_by_person_id_person_id_fk" FOREIGN KEY ("requested_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case" ADD CONSTRAINT "case_reported_by_person_id_person_id_fk" FOREIGN KEY ("reported_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_deal_workspace_entity" ON "deal" USING btree ("workspace_id","entity_id");--> statement-breakpoint
CREATE INDEX "ix_deal_workspace_stage" ON "deal" USING btree ("workspace_id","stage");--> statement-breakpoint
CREATE INDEX "ix_deal_workspace_owner" ON "deal" USING btree ("workspace_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "ix_deal_expected_close_date" ON "deal" USING btree ("workspace_id","expected_close_date");--> statement-breakpoint
CREATE INDEX "ix_entity_workspace_name" ON "entity" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "ix_entity_workspace_stage" ON "entity" USING btree ("workspace_id","relationship_stage");--> statement-breakpoint
CREATE INDEX "ix_entity_workspace_domain" ON "entity" USING btree ("workspace_id","primary_domain");--> statement-breakpoint
CREATE INDEX "ix_entity_workspace_id" ON "entity" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ix_entity_owner_user_id" ON "entity" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "ix_entity_person_workspace" ON "entity_person" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ix_incident_workspace_status" ON "incident" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ix_incident_workspace_severity" ON "incident" USING btree ("workspace_id","severity");--> statement-breakpoint
CREATE INDEX "ix_incident_case_workspace" ON "incident_case" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ix_incident_case_entity" ON "incident_case" USING btree ("workspace_id","entity_id");--> statement-breakpoint
CREATE INDEX "ix_person_workspace_last_name" ON "person" USING btree ("workspace_id","last_name");--> statement-breakpoint
CREATE INDEX "ix_person_workspace_email" ON "person" USING btree ("workspace_id","primary_email");--> statement-breakpoint
CREATE INDEX "ix_person_workspace_id" ON "person" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ix_request_workspace_status" ON "request" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ix_request_workspace_priority" ON "request" USING btree ("workspace_id","priority");--> statement-breakpoint
CREATE INDEX "ix_request_workspace_owner" ON "request" USING btree ("workspace_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "ix_case_workspace_status" ON "case" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ix_case_workspace_priority" ON "case" USING btree ("workspace_id","priority");--> statement-breakpoint
CREATE INDEX "ix_case_workspace_owner" ON "case" USING btree ("workspace_id","owner_user_id");