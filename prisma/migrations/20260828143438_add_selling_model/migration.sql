-- CreateEnum
CREATE TYPE "product_status_enum" AS ENUM ('draft', 'active', 'retired', 'archived');

-- CreateEnum
CREATE TYPE "offering_type_enum" AS ENUM ('good', 'service', 'subscription', 'bundle');

-- CreateEnum
CREATE TYPE "fulfillment_policy_enum" AS ENUM ('shipping', 'digital_activation', 'scheduled_work', 'none');

-- CreateEnum
CREATE TYPE "charge_type_enum" AS ENUM ('one_time', 'recurring', 'usage');

-- CreateEnum
CREATE TYPE "pricing_model_enum" AS ENUM ('flat', 'per_unit', 'tiered', 'volume', 'graduated');

-- CreateEnum
CREATE TYPE "billing_period_enum" AS ENUM ('day', 'week', 'month', 'quarter', 'year');

-- CreateEnum
CREATE TYPE "inventory_status_enum" AS ENUM ('available', 'reserved', 'in_transit', 'quarantine', 'damaged');

-- CreateEnum
CREATE TYPE "service_scope_enum" AS ENUM ('fixed', 'flexible');

-- CreateEnum
CREATE TYPE "quote_status_enum" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "order_status_enum" AS ENUM ('draft', 'open', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "fulfillment_status_enum" AS ENUM ('not_started', 'in_progress', 'partially_fulfilled', 'fulfilled', 'returned', 'canceled');

-- CreateEnum
CREATE TYPE "billing_status_enum" AS ENUM ('not_invoiced', 'invoiced', 'partially_paid', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "shipment_status_enum" AS ENUM ('pending', 'packed', 'shipped', 'in_transit', 'delivered', 'returned', 'canceled');

-- CreateEnum
CREATE TYPE "subscription_status_enum" AS ENUM ('trial', 'active', 'paused', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "amendment_type_enum" AS ENUM ('quantity_change', 'plan_change', 'price_change', 'billing_frequency_change', 'renewal', 'pause', 'resume', 'cancel');

-- CreateEnum
CREATE TYPE "service_delivery_status_enum" AS ENUM ('not_started', 'scheduled', 'in_progress', 'blocked', 'completed', 'accepted', 'canceled');

-- CreateEnum
CREATE TYPE "milestone_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'accepted', 'canceled');

-- CreateEnum
CREATE TYPE "discount_type_enum" AS ENUM ('percentage', 'fixed_amount');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "note_parent_type_enum" ADD VALUE 'product';
ALTER TYPE "note_parent_type_enum" ADD VALUE 'offering';
ALTER TYPE "note_parent_type_enum" ADD VALUE 'quote';
ALTER TYPE "note_parent_type_enum" ADD VALUE 'order';
ALTER TYPE "note_parent_type_enum" ADD VALUE 'subscription';
ALTER TYPE "note_parent_type_enum" ADD VALUE 'service_delivery';

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "status" "product_status_enum" NOT NULL DEFAULT 'draft',
    "tax_category" VARCHAR(100),
    "notes" TEXT,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "offering_type" "offering_type_enum" NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'each',
    "fulfillment_policy" "fulfillment_policy_enum" NOT NULL DEFAULT 'none',
    "active_from" DATE,
    "active_until" DATE,
    "attributes" JSONB,
    "notes" TEXT,

    CONSTRAINT "offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_book" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "currency_code" VARCHAR(3),
    "entity_id" UUID,
    "region" VARCHAR(100),
    "channel" VARCHAR(100),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active_from" DATE,
    "active_until" DATE,

    CONSTRAINT "price_book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "offering_id" UUID NOT NULL,
    "price_book_id" UUID,
    "name" VARCHAR(255),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "charge_type" "charge_type_enum" NOT NULL DEFAULT 'one_time',
    "pricing_model" "pricing_model_enum" NOT NULL DEFAULT 'flat',
    "unit_amount" DECIMAL(18,4),
    "billing_period" "billing_period_enum",
    "billing_interval_count" INTEGER NOT NULL DEFAULT 1,
    "minimum_quantity" DECIMAL(18,4),
    "included_quantity" DECIMAL(18,4),
    "effective_from" DATE,
    "effective_until" DATE,

    CONSTRAINT "price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_tier" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "price_id" UUID NOT NULL,
    "up_to" DECIMAL(18,4),
    "unit_amount" DECIMAL(18,4),
    "flat_amount" DECIMAL(18,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_component" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "parent_offering_id" UUID NOT NULL,
    "child_offering_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "default_quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "minimum_quantity" DECIMAL(18,4),
    "maximum_quantity" DECIMAL(18,4),
    "is_separately_priced" BOOLEAN NOT NULL DEFAULT false,
    "is_visible_to_customer" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bundle_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "offering_id" UUID NOT NULL,
    "location_code" VARCHAR(100) NOT NULL,
    "location_name" VARCHAR(255),
    "quantity_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantity_reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(18,4),
    "requires_serial_number" BOOLEAN NOT NULL DEFAULT false,
    "requires_lot_number" BOOLEAN NOT NULL DEFAULT false,
    "lot_number" VARCHAR(100),
    "status" "inventory_status_enum" NOT NULL DEFAULT 'available',
    "notes" TEXT,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_definition" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "offering_id" UUID NOT NULL,
    "scope_type" "service_scope_enum" NOT NULL DEFAULT 'fixed',
    "scope_summary" TEXT,
    "estimated_hours" DECIMAL(12,2),
    "delivery_location" VARCHAR(255),
    "required_skills" VARCHAR(1000),
    "service_level_agreement" TEXT,
    "scheduling_notes" TEXT,
    "cancellation_policy" TEXT,
    "included_deliverables" TEXT,

    CONSTRAINT "service_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_line" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "deal_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "discount_type" "discount_type_enum",
    "discount_value" DECIMAL(18,4),
    "term_months" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "deal_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "quote_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "deal_id" UUID,
    "entity_id" UUID NOT NULL,
    "bill_to_entity_id" UUID,
    "ship_to_entity_id" UUID,
    "primary_contact_person_id" UUID,
    "billing_contact_person_id" UUID,
    "status" "quote_status_enum" NOT NULL DEFAULT 'draft',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "price_book_id" UUID,
    "subtotal_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_type" "discount_type_enum",
    "discount_value" DECIMAL(18,4),
    "valid_from" DATE,
    "valid_until" DATE,
    "payment_terms" VARCHAR(100),
    "contract_term_months" INTEGER,
    "sent_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "declined_at" TIMESTAMPTZ(6),
    "decline_reason" TEXT,
    "terms" TEXT,
    "notes" TEXT,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "quote_id" UUID NOT NULL,
    "deal_line_id" UUID,
    "offering_id" UUID,
    "price_id" UUID,
    "parent_quote_line_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sku" VARCHAR(64),
    "offering_type" "offering_type_enum" NOT NULL,
    "charge_type" "charge_type_enum" NOT NULL DEFAULT 'one_time',
    "pricing_model" "pricing_model_enum" NOT NULL DEFAULT 'flat',
    "fulfillment_policy" "fulfillment_policy_enum" NOT NULL DEFAULT 'none',
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'each',
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "billing_period" "billing_period_enum",
    "billing_interval_count" INTEGER NOT NULL DEFAULT 1,
    "included_quantity" DECIMAL(18,4),
    "term_months" INTEGER,
    "discount_type" "discount_type_enum",
    "discount_value" DECIMAL(18,4),
    "subtotal_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "quote_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "order_number" VARCHAR(50) NOT NULL,
    "quote_id" UUID,
    "deal_id" UUID,
    "entity_id" UUID NOT NULL,
    "bill_to_entity_id" UUID,
    "ship_to_entity_id" UUID,
    "primary_contact_person_id" UUID,
    "billing_contact_person_id" UUID,
    "status" "order_status_enum" NOT NULL DEFAULT 'draft',
    "fulfillment_status" "fulfillment_status_enum" NOT NULL DEFAULT 'not_started',
    "billing_status" "billing_status_enum" NOT NULL DEFAULT 'not_invoiced',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ordered_at" TIMESTAMPTZ(6),
    "payment_terms" VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "ship_to_name" VARCHAR(255),
    "ship_to_address_line_1" VARCHAR(255),
    "ship_to_address_line_2" VARCHAR(255),
    "ship_to_city" VARCHAR(100),
    "ship_to_region" VARCHAR(100),
    "ship_to_postal_code" VARCHAR(20),
    "ship_to_country_code" VARCHAR(2),
    "canceled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "order_id" UUID NOT NULL,
    "quote_line_id" UUID,
    "offering_id" UUID,
    "price_id" UUID,
    "parent_order_line_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sku" VARCHAR(64),
    "offering_type" "offering_type_enum" NOT NULL,
    "charge_type" "charge_type_enum" NOT NULL DEFAULT 'one_time',
    "pricing_model" "pricing_model_enum" NOT NULL DEFAULT 'flat',
    "fulfillment_policy" "fulfillment_policy_enum" NOT NULL DEFAULT 'none',
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'each',
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "billing_period" "billing_period_enum",
    "billing_interval_count" INTEGER NOT NULL DEFAULT 1,
    "included_quantity" DECIMAL(18,4),
    "term_months" INTEGER,
    "discount_type" "discount_type_enum",
    "discount_value" DECIMAL(18,4),
    "subtotal_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "fulfillment_status" "fulfillment_status_enum" NOT NULL DEFAULT 'not_started',
    "quantity_fulfilled" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "service_recipient_entity_id" UUID,
    "end_user_person_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "order_id" UUID NOT NULL,
    "shipment_number" VARCHAR(50) NOT NULL,
    "status" "shipment_status_enum" NOT NULL DEFAULT 'pending',
    "carrier" VARCHAR(100),
    "service_level" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "tracking_url" VARCHAR(2048),
    "ship_from_location_code" VARCHAR(100),
    "ship_to_name" VARCHAR(255),
    "ship_to_address_line_1" VARCHAR(255),
    "ship_to_address_line_2" VARCHAR(255),
    "ship_to_city" VARCHAR(100),
    "ship_to_region" VARCHAR(100),
    "ship_to_postal_code" VARCHAR(20),
    "ship_to_country_code" VARCHAR(2),
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "canceled_at" TIMESTAMPTZ(6),
    "is_return" BOOLEAN NOT NULL DEFAULT false,
    "return_reason" TEXT,
    "replacement_for_shipment_id" UUID,
    "notes" TEXT,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_line" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "shipment_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "backordered_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "serial_numbers" VARCHAR(1000),
    "lot_number" VARCHAR(100),
    "notes" TEXT,

    CONSTRAINT "shipment_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "subscription_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "entity_id" UUID NOT NULL,
    "bill_to_entity_id" UUID,
    "order_id" UUID,
    "order_line_id" UUID,
    "offering_id" UUID,
    "status" "subscription_status_enum" NOT NULL DEFAULT 'active',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "current_period_start" DATE,
    "current_period_end" DATE,
    "commitment_end_date" DATE,
    "billing_period" "billing_period_enum" NOT NULL DEFAULT 'month',
    "billing_interval_count" INTEGER NOT NULL DEFAULT 1,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'each',
    "unit_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "trial_end_date" DATE,
    "paused_at" TIMESTAMPTZ(6),
    "resumes_on" DATE,
    "canceled_at" TIMESTAMPTZ(6),
    "cancellation_effective_date" DATE,
    "cancellation_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_amendment" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "subscription_id" UUID NOT NULL,
    "amendment_type" "amendment_type_enum" NOT NULL,
    "effective_date" DATE NOT NULL,
    "applied_at" TIMESTAMPTZ(6),
    "previous_quantity" DECIMAL(18,4),
    "new_quantity" DECIMAL(18,4),
    "previous_unit_amount" DECIMAL(18,4),
    "new_unit_amount" DECIMAL(18,4),
    "previous_offering_id" UUID,
    "new_offering_id" UUID,
    "previous_billing_period" "billing_period_enum",
    "new_billing_period" "billing_period_enum",
    "previous_billing_interval_count" INTEGER,
    "new_billing_interval_count" INTEGER,
    "previous_status" "subscription_status_enum",
    "new_status" "subscription_status_enum",
    "previous_commitment_end_date" DATE,
    "new_commitment_end_date" DATE,
    "proration_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3),
    "reason" TEXT,

    CONSTRAINT "subscription_amendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "subscription_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "order_line_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'each',
    "included_quantity" DECIMAL(18,4),
    "used_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "overage_unit_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3),
    "effective_from" DATE,
    "effective_until" DATE,
    "notes" TEXT,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_record" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "entity_id" UUID NOT NULL,
    "subscription_id" UUID,
    "entitlement_id" UUID,
    "order_line_id" UUID,
    "metric_code" VARCHAR(64) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL DEFAULT 'each',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "source" VARCHAR(100),
    "external_reference" VARCHAR(255),
    "notes" TEXT,

    CONSTRAINT "usage_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_delivery" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "delivery_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "order_id" UUID,
    "order_line_id" UUID,
    "offering_id" UUID,
    "entity_id" UUID NOT NULL,
    "contact_person_id" UUID,
    "assigned_user_id" UUID,
    "assigned_team" VARCHAR(100),
    "status" "service_delivery_status_enum" NOT NULL DEFAULT 'not_started',
    "scheduled_start_at" TIMESTAMPTZ(6),
    "scheduled_end_at" TIMESTAMPTZ(6),
    "actual_start_at" TIMESTAMPTZ(6),
    "actual_end_at" TIMESTAMPTZ(6),
    "estimated_hours" DECIMAL(12,2),
    "hours_consumed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_location" VARCHAR(255),
    "service_level_agreement" TEXT,
    "customer_accepted_at" TIMESTAMPTZ(6),
    "customer_accepted_by_person_id" UUID,
    "acceptance_notes" TEXT,
    "case_id" UUID,
    "incident_id" UUID,
    "notes" TEXT,

    CONSTRAINT "service_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_milestone" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "service_delivery_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "milestone_status_enum" NOT NULL DEFAULT 'pending',
    "billing_percent" DECIMAL(9,4),
    "billing_amount" DECIMAL(18,4),
    "currency_code" VARCHAR(3),
    "due_on" DATE,
    "completed_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "service_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_product_workspace_name" ON "product"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "ix_product_workspace_status" ON "product"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_product_workspace_category" ON "product"("workspace_id", "category");

-- CreateIndex
CREATE INDEX "ix_offering_workspace_product" ON "offering"("workspace_id", "product_id");

-- CreateIndex
CREATE INDEX "ix_offering_workspace_type" ON "offering"("workspace_id", "offering_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_offering_sku" ON "offering"("workspace_id", "sku");

-- CreateIndex
CREATE INDEX "ix_price_book_workspace" ON "price_book"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_price_book_code" ON "price_book"("workspace_id", "code");

-- CreateIndex
CREATE INDEX "ix_price_workspace_offering" ON "price"("workspace_id", "offering_id");

-- CreateIndex
CREATE INDEX "ix_price_workspace_book" ON "price"("workspace_id", "price_book_id");

-- CreateIndex
CREATE INDEX "ix_price_tier_workspace_price" ON "price_tier"("workspace_id", "price_id");

-- CreateIndex
CREATE INDEX "ix_bundle_component_parent" ON "bundle_component"("workspace_id", "parent_offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bundle_component" ON "bundle_component"("parent_offering_id", "child_offering_id");

-- CreateIndex
CREATE INDEX "ix_inventory_item_workspace_offering" ON "inventory_item"("workspace_id", "offering_id");

-- CreateIndex
CREATE INDEX "ix_inventory_item_location" ON "inventory_item"("workspace_id", "location_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_definition_offering" ON "service_definition"("offering_id");

-- CreateIndex
CREATE INDEX "ix_service_definition_workspace" ON "service_definition"("workspace_id");

-- CreateIndex
CREATE INDEX "ix_deal_line_workspace_deal" ON "deal_line"("workspace_id", "deal_id");

-- CreateIndex
CREATE INDEX "ix_quote_workspace_entity" ON "quote"("workspace_id", "entity_id");

-- CreateIndex
CREATE INDEX "ix_quote_workspace_status" ON "quote"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_quote_workspace_deal" ON "quote"("workspace_id", "deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_quote_number" ON "quote"("workspace_id", "quote_number");

-- CreateIndex
CREATE INDEX "ix_quote_line_workspace_quote" ON "quote_line"("workspace_id", "quote_id");

-- CreateIndex
CREATE INDEX "ix_order_workspace_entity" ON "order"("workspace_id", "entity_id");

-- CreateIndex
CREATE INDEX "ix_order_workspace_status" ON "order"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_order_workspace_quote" ON "order"("workspace_id", "quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_order_number" ON "order"("workspace_id", "order_number");

-- CreateIndex
CREATE INDEX "ix_order_line_workspace_order" ON "order_line"("workspace_id", "order_id");

-- CreateIndex
CREATE INDEX "ix_shipment_workspace_order" ON "shipment"("workspace_id", "order_id");

-- CreateIndex
CREATE INDEX "ix_shipment_workspace_status" ON "shipment"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_shipment_number" ON "shipment"("workspace_id", "shipment_number");

-- CreateIndex
CREATE INDEX "ix_shipment_line_workspace_shipment" ON "shipment_line"("workspace_id", "shipment_id");

-- CreateIndex
CREATE INDEX "ix_shipment_line_order_line" ON "shipment_line"("workspace_id", "order_line_id");

-- CreateIndex
CREATE INDEX "ix_subscription_workspace_entity" ON "subscription"("workspace_id", "entity_id");

-- CreateIndex
CREATE INDEX "ix_subscription_workspace_status" ON "subscription"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_subscription_workspace_order" ON "subscription"("workspace_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subscription_number" ON "subscription"("workspace_id", "subscription_number");

-- CreateIndex
CREATE INDEX "ix_amendment_workspace_subscription" ON "subscription_amendment"("workspace_id", "subscription_id");

-- CreateIndex
CREATE INDEX "ix_entitlement_workspace_subscription" ON "entitlement"("workspace_id", "subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_entitlement_code" ON "entitlement"("subscription_id", "code");

-- CreateIndex
CREATE INDEX "ix_usage_record_subscription" ON "usage_record"("workspace_id", "subscription_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ix_usage_record_entitlement" ON "usage_record"("workspace_id", "entitlement_id");

-- CreateIndex
CREATE INDEX "ix_service_delivery_workspace_entity" ON "service_delivery"("workspace_id", "entity_id");

-- CreateIndex
CREATE INDEX "ix_service_delivery_workspace_status" ON "service_delivery"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ix_service_delivery_workspace_order" ON "service_delivery"("workspace_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_delivery_number" ON "service_delivery"("workspace_id", "delivery_number");

-- CreateIndex
CREATE INDEX "ix_service_milestone_delivery" ON "service_milestone"("workspace_id", "service_delivery_id");

-- AddForeignKey
ALTER TABLE "offering" ADD CONSTRAINT "offering_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price" ADD CONSTRAINT "price_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price" ADD CONSTRAINT "price_price_book_id_fkey" FOREIGN KEY ("price_book_id") REFERENCES "price_book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_tier" ADD CONSTRAINT "price_tier_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "price"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_component" ADD CONSTRAINT "bundle_component_parent_offering_id_fkey" FOREIGN KEY ("parent_offering_id") REFERENCES "offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_component" ADD CONSTRAINT "bundle_component_child_offering_id_fkey" FOREIGN KEY ("child_offering_id") REFERENCES "offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_definition" ADD CONSTRAINT "service_definition_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_line" ADD CONSTRAINT "deal_line_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_line" ADD CONSTRAINT "deal_line_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "quote_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_line" ADD CONSTRAINT "shipment_line_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_line" ADD CONSTRAINT "shipment_line_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_amendment" ADD CONSTRAINT "subscription_amendment_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_delivery" ADD CONSTRAINT "service_delivery_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_delivery" ADD CONSTRAINT "service_delivery_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_delivery" ADD CONSTRAINT "service_delivery_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_milestone" ADD CONSTRAINT "service_milestone_service_delivery_id_fkey" FOREIGN KEY ("service_delivery_id") REFERENCES "service_delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
