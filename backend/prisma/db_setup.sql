-- One-time local DB + app-user setup. Run as root.
-- DEV scope: the app user gets full rights on THIS database only (so Prisma can
-- run migrations with one URL). In production, split this into a privileged
-- migrate user + a CRUD-only runtime user (see README).

CREATE DATABASE IF NOT EXISTS `audit_portal`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'audit_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_local_dev_password';
GRANT ALL PRIVILEGES ON `audit_portal`.* TO 'audit_app'@'localhost';
FLUSH PRIVILEGES;
