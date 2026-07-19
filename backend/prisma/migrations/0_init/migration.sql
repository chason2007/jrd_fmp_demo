-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ResetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AUDITOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "name" VARCHAR(100),
    "id_number" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "family_id" CHAR(36) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" CHAR(64),
    "created_by_ip" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" SERIAL NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "username" VARCHAR(100),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(60),
    "entity_id" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "villas" (
    "id" SERIAL NOT NULL,
    "property_number" VARCHAR(100) NOT NULL,
    "owner_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "emirate" VARCHAR(100),
    "area" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_master" (
    "id" SERIAL NOT NULL,
    "audit_code" VARCHAR(100) NOT NULL,
    "villa_id" INTEGER NOT NULL,
    "auditor_id" INTEGER,
    "status" "AuditStatus" NOT NULL DEFAULT 'COMPLETED',
    "audit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_issues" (
    "id" SERIAL NOT NULL,
    "audit_id" INTEGER NOT NULL,
    "area" VARCHAR(50),
    "floor" VARCHAR(50),
    "room" VARCHAR(100),
    "spot_desc" TEXT,
    "category" VARCHAR(50),
    "sub_category" VARCHAR(50),
    "issue_type" VARCHAR(100),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_photos" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER,
    "wv_audit_id" INTEGER,
    "uploaded_by_id" INTEGER,
    "storage_key" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255),
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_drafts" (
    "id" SERIAL NOT NULL,
    "draft_code" VARCHAR(100) NOT NULL,
    "audit_code" VARCHAR(100),
    "auditor_id" INTEGER,
    "property_number" VARCHAR(100) NOT NULL,
    "owner_name" VARCHAR(255) NOT NULL,
    "property_address" TEXT,
    "emirate" VARCHAR(100),
    "area" VARCHAR(100),
    "issues_data" JSONB NOT NULL,
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "ResetStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "velora_audits" (
    "id" SERIAL NOT NULL,
    "audit_number" VARCHAR(50) NOT NULL,
    "service_type_id" INTEGER NOT NULL,
    "service_category" VARCHAR(20) NOT NULL,
    "audit_date" TIMESTAMP(3) NOT NULL,
    "auditor_name" VARCHAR(100),
    "auditor_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'submitted',
    "overall_score" DOUBLE PRECISION,
    "overall_rating" VARCHAR(20),
    "location_data" JSONB,
    "responses" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "velora_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "velora_audit_drafts" (
    "id" SERIAL NOT NULL,
    "draft_code" VARCHAR(100) NOT NULL,
    "audit_number" VARCHAR(50),
    "service_type_id" INTEGER,
    "service_category" VARCHAR(20),
    "audit_date" TIMESTAMP(3),
    "auditor_name" VARCHAR(100),
    "auditor_id" INTEGER,
    "location_data" JSONB,
    "responses" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "velora_audit_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "velora_pdf_reports" (
    "id" SERIAL NOT NULL,
    "report_number" VARCHAR(50) NOT NULL,
    "auditor_id" INTEGER,
    "audit_id" INTEGER,
    "audit_number" VARCHAR(50),
    "file_name" VARCHAR(200) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "title" VARCHAR(200),
    "generated_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "velora_pdf_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "velora_service_reports" (
    "id" SERIAL NOT NULL,
    "report_number" VARCHAR(50) NOT NULL,
    "report_type_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "report_date" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(100),
    "content" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "velora_service_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "velora_compliance_delivery" (
    "id" SERIAL NOT NULL,
    "compliance_item_id" INTEGER NOT NULL,
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "evidence" TEXT,
    "verified_by" VARCHAR(100),
    "verification_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "velora_compliance_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wv_audit_drafts" (
    "id" SERIAL NOT NULL,
    "draft_code" VARCHAR(100) NOT NULL,
    "audit_code" VARCHAR(100),
    "auditor_id" INTEGER,
    "audit_type" VARCHAR(30) NOT NULL DEFAULT 'rooms',
    "cluster" VARCHAR(50),
    "building" VARCHAR(50),
    "floor" VARCHAR(20),
    "room" VARCHAR(100),
    "staff_name" VARCHAR(150),
    "staff_no" VARCHAR(50),
    "audit_date" TIMESTAMP(3),
    "inspector_name" VARCHAR(150),
    "responses" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wv_audit_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wv_audits" (
    "id" SERIAL NOT NULL,
    "audit_code" VARCHAR(100) NOT NULL,
    "auditor_id" INTEGER,
    "audit_type" VARCHAR(30) NOT NULL DEFAULT 'rooms',
    "cluster" VARCHAR(50),
    "building" VARCHAR(50),
    "floor" VARCHAR(20),
    "room" VARCHAR(100),
    "staff_name" VARCHAR(150),
    "staff_no" VARCHAR(50),
    "audit_date" TIMESTAMP(3) NOT NULL,
    "inspector_name" VARCHAR(150),
    "responses" JSONB NOT NULL,
    "compliance_rate" DOUBLE PRECISION,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "compliant_count" INTEGER NOT NULL DEFAULT 0,
    "non_compliant_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wv_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_address_created_at_idx" ON "login_attempts"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_username_created_at_idx" ON "login_attempts"("username", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "villas_property_number_key" ON "villas"("property_number");

-- CreateIndex
CREATE UNIQUE INDEX "audit_master_audit_code_key" ON "audit_master"("audit_code");

-- CreateIndex
CREATE INDEX "audit_master_villa_id_idx" ON "audit_master"("villa_id");

-- CreateIndex
CREATE INDEX "audit_master_auditor_id_idx" ON "audit_master"("auditor_id");

-- CreateIndex
CREATE INDEX "audit_master_status_audit_date_idx" ON "audit_master"("status", "audit_date");

-- CreateIndex
CREATE INDEX "inspection_issues_audit_id_idx" ON "inspection_issues"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_photos_storage_key_key" ON "issue_photos"("storage_key");

-- CreateIndex
CREATE INDEX "issue_photos_issue_id_idx" ON "issue_photos"("issue_id");

-- CreateIndex
CREATE INDEX "issue_photos_wv_audit_id_idx" ON "issue_photos"("wv_audit_id");

-- CreateIndex
CREATE INDEX "issue_photos_uploaded_by_id_idx" ON "issue_photos"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "issue_photos_sha256_idx" ON "issue_photos"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_drafts_draft_code_key" ON "inspection_drafts"("draft_code");

-- CreateIndex
CREATE INDEX "inspection_drafts_auditor_id_updated_at_idx" ON "inspection_drafts"("auditor_id", "updated_at");

-- CreateIndex
CREATE INDEX "password_reset_requests_user_id_idx" ON "password_reset_requests"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_requests_status_idx" ON "password_reset_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "velora_audits_audit_number_key" ON "velora_audits"("audit_number");

-- CreateIndex
CREATE INDEX "velora_audits_auditor_id_idx" ON "velora_audits"("auditor_id");

-- CreateIndex
CREATE INDEX "velora_audits_status_audit_date_idx" ON "velora_audits"("status", "audit_date");

-- CreateIndex
CREATE UNIQUE INDEX "velora_audit_drafts_draft_code_key" ON "velora_audit_drafts"("draft_code");

-- CreateIndex
CREATE INDEX "velora_audit_drafts_auditor_id_updated_at_idx" ON "velora_audit_drafts"("auditor_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "velora_pdf_reports_report_number_key" ON "velora_pdf_reports"("report_number");

-- CreateIndex
CREATE INDEX "velora_pdf_reports_auditor_id_idx" ON "velora_pdf_reports"("auditor_id");

-- CreateIndex
CREATE INDEX "velora_pdf_reports_audit_id_idx" ON "velora_pdf_reports"("audit_id");

-- CreateIndex
CREATE INDEX "velora_pdf_reports_report_number_idx" ON "velora_pdf_reports"("report_number");

-- CreateIndex
CREATE UNIQUE INDEX "velora_service_reports_report_number_key" ON "velora_service_reports"("report_number");

-- CreateIndex
CREATE INDEX "velora_service_reports_report_date_idx" ON "velora_service_reports"("report_date");

-- CreateIndex
CREATE INDEX "velora_compliance_delivery_compliance_item_id_idx" ON "velora_compliance_delivery"("compliance_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "wv_audit_drafts_draft_code_key" ON "wv_audit_drafts"("draft_code");

-- CreateIndex
CREATE INDEX "wv_audit_drafts_auditor_id_updated_at_idx" ON "wv_audit_drafts"("auditor_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "wv_audits_audit_code_key" ON "wv_audits"("audit_code");

-- CreateIndex
CREATE INDEX "wv_audits_auditor_id_idx" ON "wv_audits"("auditor_id");

-- CreateIndex
CREATE INDEX "wv_audits_audit_date_idx" ON "wv_audits"("audit_date");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_master" ADD CONSTRAINT "audit_master_villa_id_fkey" FOREIGN KEY ("villa_id") REFERENCES "villas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_master" ADD CONSTRAINT "audit_master_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_issues" ADD CONSTRAINT "inspection_issues_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audit_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_photos" ADD CONSTRAINT "issue_photos_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "inspection_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_photos" ADD CONSTRAINT "issue_photos_wv_audit_id_fkey" FOREIGN KEY ("wv_audit_id") REFERENCES "wv_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_photos" ADD CONSTRAINT "issue_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_drafts" ADD CONSTRAINT "inspection_drafts_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "velora_audits" ADD CONSTRAINT "velora_audits_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "velora_audit_drafts" ADD CONSTRAINT "velora_audit_drafts_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "velora_pdf_reports" ADD CONSTRAINT "velora_pdf_reports_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wv_audit_drafts" ADD CONSTRAINT "wv_audit_drafts_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wv_audits" ADD CONSTRAINT "wv_audits_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

