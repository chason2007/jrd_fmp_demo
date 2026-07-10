-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPERADMIN', 'ADMIN', 'AUDITOR') NOT NULL DEFAULT 'AUDITOR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `name` VARCHAR(100) NULL,
    `id_number` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `family_id` CHAR(36) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by` CHAR(64) NULL,
    `created_by_ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_family_id_idx`(`family_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ip_address` VARCHAR(45) NOT NULL,
    `username` VARCHAR(100) NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_ip_address_created_at_idx`(`ip_address`, `created_at`),
    INDEX `login_attempts_username_created_at_idx`(`username`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(60) NULL,
    `entity_id` VARCHAR(100) NULL,
    `ip_address` VARCHAR(45) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_log_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `villas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `property_number` VARCHAR(100) NOT NULL,
    `owner_name` VARCHAR(255) NOT NULL,
    `address` TEXT NULL,
    `emirate` VARCHAR(100) NULL,
    `area` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `villas_property_number_key`(`property_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_code` VARCHAR(100) NOT NULL,
    `villa_id` INTEGER NOT NULL,
    `auditor_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'COMPLETED') NOT NULL DEFAULT 'COMPLETED',
    `audit_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issue_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `audit_master_audit_code_key`(`audit_code`),
    INDEX `audit_master_villa_id_idx`(`villa_id`),
    INDEX `audit_master_auditor_id_idx`(`auditor_id`),
    INDEX `audit_master_status_audit_date_idx`(`status`, `audit_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inspection_issues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_id` INTEGER NOT NULL,
    `area` VARCHAR(50) NULL,
    `floor` VARCHAR(50) NULL,
    `room` VARCHAR(100) NULL,
    `spot_desc` TEXT NULL,
    `category` VARCHAR(50) NULL,
    `sub_category` VARCHAR(50) NULL,
    `issue_type` VARCHAR(100) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inspection_issues_audit_id_idx`(`audit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issue_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issue_id` INTEGER NULL,
    `wv_audit_id` INTEGER NULL,
    `uploaded_by_id` INTEGER NULL,
    `storage_key` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `issue_photos_storage_key_key`(`storage_key`),
    INDEX `issue_photos_issue_id_idx`(`issue_id`),
    INDEX `issue_photos_wv_audit_id_idx`(`wv_audit_id`),
    INDEX `issue_photos_uploaded_by_id_idx`(`uploaded_by_id`),
    INDEX `issue_photos_sha256_idx`(`sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inspection_drafts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `draft_code` VARCHAR(100) NOT NULL,
    `audit_code` VARCHAR(100) NULL,
    `auditor_id` INTEGER NULL,
    `property_number` VARCHAR(100) NOT NULL,
    `owner_name` VARCHAR(255) NOT NULL,
    `property_address` TEXT NULL,
    `emirate` VARCHAR(100) NULL,
    `area` VARCHAR(100) NULL,
    `issues_data` JSON NOT NULL,
    `issue_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inspection_drafts_draft_code_key`(`draft_code`),
    INDEX `inspection_drafts_auditor_id_updated_at_idx`(`auditor_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `password_reset_requests_user_id_idx`(`user_id`),
    INDEX `password_reset_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `velora_audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_number` VARCHAR(50) NOT NULL,
    `service_type_id` INTEGER NOT NULL,
    `service_category` VARCHAR(20) NOT NULL,
    `audit_date` DATETIME(3) NOT NULL,
    `auditor_name` VARCHAR(100) NULL,
    `auditor_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'submitted',
    `overall_score` DOUBLE NULL,
    `overall_rating` VARCHAR(20) NULL,
    `location_data` JSON NULL,
    `responses` JSON NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `velora_audits_audit_number_key`(`audit_number`),
    INDEX `velora_audits_auditor_id_idx`(`auditor_id`),
    INDEX `velora_audits_status_audit_date_idx`(`status`, `audit_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `velora_audit_drafts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `draft_code` VARCHAR(100) NOT NULL,
    `audit_number` VARCHAR(50) NULL,
    `service_type_id` INTEGER NULL,
    `service_category` VARCHAR(20) NULL,
    `audit_date` DATETIME(3) NULL,
    `auditor_name` VARCHAR(100) NULL,
    `auditor_id` INTEGER NULL,
    `location_data` JSON NULL,
    `responses` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `velora_audit_drafts_draft_code_key`(`draft_code`),
    INDEX `velora_audit_drafts_auditor_id_updated_at_idx`(`auditor_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `velora_pdf_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_number` VARCHAR(50) NOT NULL,
    `auditor_id` INTEGER NULL,
    `audit_id` INTEGER NULL,
    `audit_number` VARCHAR(50) NULL,
    `file_name` VARCHAR(200) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `title` VARCHAR(200) NULL,
    `generated_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `velora_pdf_reports_report_number_key`(`report_number`),
    INDEX `velora_pdf_reports_auditor_id_idx`(`auditor_id`),
    INDEX `velora_pdf_reports_audit_id_idx`(`audit_id`),
    INDEX `velora_pdf_reports_report_number_idx`(`report_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `velora_service_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_number` VARCHAR(50) NOT NULL,
    `report_type_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `report_date` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(100) NULL,
    `content` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'published',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `velora_service_reports_report_number_key`(`report_number`),
    INDEX `velora_service_reports_report_date_idx`(`report_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `velora_compliance_delivery` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compliance_item_id` INTEGER NOT NULL,
    `delivery_date` DATETIME(3) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `evidence` TEXT NULL,
    `verified_by` VARCHAR(100) NULL,
    `verification_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `velora_compliance_delivery_compliance_item_id_idx`(`compliance_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wv_audit_drafts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `draft_code` VARCHAR(100) NOT NULL,
    `audit_code` VARCHAR(100) NULL,
    `auditor_id` INTEGER NULL,
    `audit_type` VARCHAR(30) NOT NULL DEFAULT 'rooms',
    `cluster` VARCHAR(50) NULL,
    `building` VARCHAR(50) NULL,
    `floor` VARCHAR(20) NULL,
    `room` VARCHAR(100) NULL,
    `staff_name` VARCHAR(150) NULL,
    `staff_no` VARCHAR(50) NULL,
    `audit_date` DATETIME(3) NULL,
    `inspector_name` VARCHAR(150) NULL,
    `responses` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wv_audit_drafts_draft_code_key`(`draft_code`),
    INDEX `wv_audit_drafts_auditor_id_updated_at_idx`(`auditor_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wv_audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_code` VARCHAR(100) NOT NULL,
    `auditor_id` INTEGER NULL,
    `audit_type` VARCHAR(30) NOT NULL DEFAULT 'rooms',
    `cluster` VARCHAR(50) NULL,
    `building` VARCHAR(50) NULL,
    `floor` VARCHAR(20) NULL,
    `room` VARCHAR(100) NULL,
    `staff_name` VARCHAR(150) NULL,
    `staff_no` VARCHAR(50) NULL,
    `audit_date` DATETIME(3) NOT NULL,
    `inspector_name` VARCHAR(150) NULL,
    `responses` JSON NOT NULL,
    `compliance_rate` DOUBLE NULL,
    `total_items` INTEGER NOT NULL DEFAULT 0,
    `compliant_count` INTEGER NOT NULL DEFAULT 0,
    `non_compliant_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wv_audits_audit_code_key`(`audit_code`),
    INDEX `wv_audits_auditor_id_idx`(`auditor_id`),
    INDEX `wv_audits_audit_date_idx`(`audit_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_master` ADD CONSTRAINT `audit_master_villa_id_fkey` FOREIGN KEY (`villa_id`) REFERENCES `villas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_master` ADD CONSTRAINT `audit_master_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection_issues` ADD CONSTRAINT `inspection_issues_audit_id_fkey` FOREIGN KEY (`audit_id`) REFERENCES `audit_master`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_photos` ADD CONSTRAINT `issue_photos_issue_id_fkey` FOREIGN KEY (`issue_id`) REFERENCES `inspection_issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_photos` ADD CONSTRAINT `issue_photos_wv_audit_id_fkey` FOREIGN KEY (`wv_audit_id`) REFERENCES `wv_audits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_photos` ADD CONSTRAINT `issue_photos_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection_drafts` ADD CONSTRAINT `inspection_drafts_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_requests` ADD CONSTRAINT `password_reset_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `velora_audits` ADD CONSTRAINT `velora_audits_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `velora_audit_drafts` ADD CONSTRAINT `velora_audit_drafts_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `velora_pdf_reports` ADD CONSTRAINT `velora_pdf_reports_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wv_audit_drafts` ADD CONSTRAINT `wv_audit_drafts_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wv_audits` ADD CONSTRAINT `wv_audits_auditor_id_fkey` FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

