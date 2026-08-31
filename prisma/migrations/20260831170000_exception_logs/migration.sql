ALTER TYPE "note_parent_type_enum" ADD VALUE 'exception_log';

CREATE TABLE "exception_log" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "owner_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "archived_at" TIMESTAMPTZ(6),
  "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "level" VARCHAR(20) NOT NULL,
  "error_code" VARCHAR(100) NOT NULL,
  "exception_type" VARCHAR(255),
  "message" TEXT NOT NULL,
  "correlation_id" VARCHAR(255),
  "request_id" VARCHAR(255),
  "user_id" VARCHAR(255),
  "tenant_id" VARCHAR(255),
  "entity_id" VARCHAR(255),
  "operation" VARCHAR(255),
  "service" VARCHAR(255),
  "environment" VARCHAR(100),
  "version" VARCHAR(100),
  "dependency" VARCHAR(255),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "duration_ms" INTEGER,
  "stack_trace" TEXT,
  "cause" TEXT,
  "data" TEXT,
  CONSTRAINT "exception_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_exception_log_level" CHECK ("level" IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
  CONSTRAINT "ck_exception_log_retry_count" CHECK ("retry_count" >= 0),
  CONSTRAINT "ck_exception_log_duration" CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0)
);

CREATE INDEX "ix_exception_log_workspace_timestamp" ON "exception_log"("workspace_id", "timestamp");
CREATE INDEX "ix_exception_log_level_code" ON "exception_log"("workspace_id", "level", "error_code");
CREATE INDEX "ix_exception_log_correlation" ON "exception_log"("workspace_id", "correlation_id");
CREATE INDEX "ix_exception_log_service" ON "exception_log"("workspace_id", "service");
