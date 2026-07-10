#!/usr/bin/env bash
#
# Backup the Audit Portal: MySQL database + the on-disk photo/PDF storage.
# Designed for the self-hosted Linux deployment (see DEPLOY.md).
#
#   ./scripts/backup.sh
#
# Reads DATABASE_URL from backend/.env (or the environment). Writes a timestamped,
# gzipped dump + a storage tarball into $BACKUP_DIR, prunes backups older than
# $RETENTION_DAYS, and — if $BACKUP_PASSPHRASE is set — encrypts each artifact
# with gpg so it's safe to sync off-box.
#
# Cron example (daily 02:30, log to file):
#   30 2 * * *  cd /opt/audit-portal && ./scripts/backup.sh >> /var/log/audit-backup.log 2>&1
#
set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
STORAGE_DIR="${STORAGE_DIR:-$BACKEND_DIR/storage}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# ── Load DATABASE_URL from backend/.env if not already set ───────────────────
if [ -z "${DATABASE_URL:-}" ] && [ -f "$BACKEND_DIR/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -n1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set and backend/.env has none." >&2
  exit 1
fi

# ── Parse mysql://user:pass@host:port/dbname ─────────────────────────────────
rest="${DATABASE_URL#*://}"
creds="${rest%%@*}"
hostpart="${rest#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
hostport="${hostpart%%/*}"
DB_NAME="${hostpart##*/}"; DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport##*:}"; [ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=3306

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
DB_FILE="$BACKUP_DIR/db-$TS.sql.gz"
STORAGE_FILE="$BACKUP_DIR/storage-$TS.tar.gz"

echo "[backup] Database '$DB_NAME' on $DB_HOST:$DB_PORT → $DB_FILE"
# MYSQL_PWD avoids the password appearing in the process list.
MYSQL_PWD="$DB_PASS" mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --routines --triggers --no-tablespaces \
  "$DB_NAME" | gzip > "$DB_FILE"

echo "[backup] Storage '$STORAGE_DIR' → $STORAGE_FILE"
if [ -d "$STORAGE_DIR" ]; then
  tar -czf "$STORAGE_FILE" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
else
  echo "[backup] WARNING: storage dir '$STORAGE_DIR' not found — skipping." >&2
fi

# ── Optional encryption (recommended for off-box copies) ─────────────────────
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  for f in "$DB_FILE" "$STORAGE_FILE"; do
    [ -f "$f" ] || continue
    echo "[backup] Encrypting $(basename "$f")"
    gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 "$f"
    rm -f "$f"   # keep only the encrypted .gpg
  done
fi

# ── Prune old backups ────────────────────────────────────────────────────────
echo "[backup] Pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -type f \( -name 'db-*.sql.gz*' -o -name 'storage-*.tar.gz*' \) \
  -mtime +"$RETENTION_DAYS" -print -delete

echo "[backup] Done. Now copy $BACKUP_DIR off this server (rsync / object storage)."
