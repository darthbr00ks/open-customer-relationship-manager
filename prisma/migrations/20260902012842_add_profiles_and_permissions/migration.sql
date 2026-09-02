-- CreateEnum
CREATE TYPE "field_access_enum" AS ENUM ('hidden', 'read', 'edit');

-- CreateTable
CREATE TABLE "profile" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_assignment" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profile_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_permission" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "object_key" VARCHAR(64) NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "object_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_permission" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "object_key" VARCHAR(64) NOT NULL,
    "field_key" VARCHAR(64) NOT NULL,
    "access" "field_access_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "field_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_profile_workspace" ON "profile"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_profile_workspace_key" ON "profile"("workspace_id", "key");

-- CreateIndex
CREATE INDEX "ix_profile_assignment_profile" ON "profile_assignment"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_profile_assignment_user" ON "profile_assignment"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_object_permission" ON "object_permission"("profile_id", "object_key");

-- CreateIndex
CREATE INDEX "ix_field_permission_object" ON "field_permission"("profile_id", "object_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_field_permission" ON "field_permission"("profile_id", "object_key", "field_key");

-- AddForeignKey
ALTER TABLE "profile_assignment" ADD CONSTRAINT "profile_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_assignment" ADD CONSTRAINT "profile_assignment_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_permission" ADD CONSTRAINT "object_permission_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_permission" ADD CONSTRAINT "field_permission_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
