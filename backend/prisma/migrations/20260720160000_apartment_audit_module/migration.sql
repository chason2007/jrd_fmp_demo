-- AlterTable
ALTER TABLE "issue_photos" ADD COLUMN     "apartment_audit_id" INTEGER;

-- CreateTable
CREATE TABLE "apartment_audit_drafts" (
    "id" SERIAL NOT NULL,
    "draft_code" VARCHAR(100) NOT NULL,
    "audit_code" VARCHAR(100),
    "auditor_id" INTEGER,
    "tenant_name" VARCHAR(150),
    "apartment_type" VARCHAR(100),
    "room_no" VARCHAR(50),
    "location" VARCHAR(255),
    "move_in_date" TIMESTAMP(3),
    "landlord_name" VARCHAR(150),
    "audit_date" TIMESTAMP(3),
    "inspector_name" VARCHAR(150),
    "bedroom_count" INTEGER NOT NULL DEFAULT 1,
    "bathroom_count" INTEGER NOT NULL DEFAULT 1,
    "responses" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apartment_audit_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apartment_audits" (
    "id" SERIAL NOT NULL,
    "audit_code" VARCHAR(100) NOT NULL,
    "auditor_id" INTEGER,
    "tenant_name" VARCHAR(150),
    "apartment_type" VARCHAR(100),
    "room_no" VARCHAR(50),
    "location" VARCHAR(255),
    "move_in_date" TIMESTAMP(3),
    "landlord_name" VARCHAR(150),
    "audit_date" TIMESTAMP(3) NOT NULL,
    "inspector_name" VARCHAR(150),
    "bedroom_count" INTEGER NOT NULL DEFAULT 1,
    "bathroom_count" INTEGER NOT NULL DEFAULT 1,
    "responses" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "rating" VARCHAR(20),
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "satisfactory_count" INTEGER NOT NULL DEFAULT 0,
    "needs_improvement_count" INTEGER NOT NULL DEFAULT 0,
    "unsatisfactory_count" INTEGER NOT NULL DEFAULT 0,
    "na_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apartment_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apartment_audit_drafts_draft_code_key" ON "apartment_audit_drafts"("draft_code");

-- CreateIndex
CREATE INDEX "apartment_audit_drafts_auditor_id_updated_at_idx" ON "apartment_audit_drafts"("auditor_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "apartment_audits_audit_code_key" ON "apartment_audits"("audit_code");

-- CreateIndex
CREATE INDEX "apartment_audits_auditor_id_idx" ON "apartment_audits"("auditor_id");

-- CreateIndex
CREATE INDEX "apartment_audits_audit_date_idx" ON "apartment_audits"("audit_date");

-- CreateIndex
CREATE INDEX "issue_photos_apartment_audit_id_idx" ON "issue_photos"("apartment_audit_id");

-- AddForeignKey
ALTER TABLE "issue_photos" ADD CONSTRAINT "issue_photos_apartment_audit_id_fkey" FOREIGN KEY ("apartment_audit_id") REFERENCES "apartment_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_audit_drafts" ADD CONSTRAINT "apartment_audit_drafts_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_audits" ADD CONSTRAINT "apartment_audits_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

