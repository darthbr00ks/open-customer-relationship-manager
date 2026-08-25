-- CreateEnum
CREATE TYPE "note_parent_type_enum" AS ENUM ('entity', 'person', 'deal', 'case', 'incident', 'request');

-- CreateEnum
CREATE TYPE "note_kind_enum" AS ENUM ('note', 'system');

-- CreateTable
CREATE TABLE "note" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "parent_type" "note_parent_type_enum" NOT NULL,
    "parent_id" UUID NOT NULL,
    "kind" "note_kind_enum" NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_note_parent" ON "note"("workspace_id", "parent_type", "parent_id");
