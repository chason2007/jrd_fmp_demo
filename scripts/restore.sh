#!/usr/bin/env bash
#
# Restore the Audit Portal from a backup produced by scripts/backup.sh.
#
#   ./scripts/restore.sh <TIMESTAMP>
#   ./scripts/restore.sh 20260709-023000
#
# Restores BOTH the database and the storage directory for that timestamp.
# This OVERWRITES the current database and storage — it asks for confirmation.
# Run a restore drill periodically against a scratch DB so you know it works.
#
# Env:
#   DATABASE_URL        (or read from backend/.env) — target to restore INTO
#   BACKUP_DIR          where backups live (default: <root>/backups)
#   BACKUP_PASSPHRASE   set if the backups were encrypted (.gpg)
#   STORAGE_DIR         storage location (default: backend/storage)
#
set -euo pipefail

TS="${1:-}"
if [ -z "$TS" ]; then
  echo "Usage: $0 <TIMESTAMP>   (e.g. 20260709-023000)" >&2
  echo "Available backups:" >&2
  ls -1 "${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}" 2>/dev/null || true
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
STORAGE_DIR="${STORAGE_DIR:-$BACKEND_DIR/storage}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$BACKEND_DIR/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -n1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set and backend/.env has none." >&2
  exit 1
fi

rest="${DATABASE_URL#*://}"; creds="${rest%%@*}"; hostpart="${rest#*@}"
DB_USER="${creds%%:*}"; DB_PASS="${creds#*:}"
hostport="${hostpart%%/*}"
DB_NAME="${hostpart##*/}"; DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${hostport%%:*}"; DB_PORT="${hostport##*:}"; [ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=3306

# Locate the artifacts (plain or encrypted).
DB_FILE="$BACKUP_DIR/db-$TS.sql.gz"
STORAGE_FILE="$BACKUP_DIR/storage-$TS.tar.gz"
ENC=""
if [ ! -f "$DB_FILE" ] && [ -f "$DB_FILE.gpg" ]; then ENC=1; fi

echo "About to restore backup '$TS' INTO database '$DB_NAME' on $DB_HOST:$DB_PORT"
echo "and overwrite storage at '$STORAGE_DIR'. This is DESTRUCTIVE."
read -r -p "Type the database name ('$DB_NAME') to confirm: " CONFIRM
[ "$CONFIRM" = "$DB_NAME" ] || { echo "Aborted."; exit 1; }

decrypt() { # decrypt() <file-without-.gpg>
  if [ -n "$ENC" ]; then
    [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "ERROR: backups are encrypted; set BACKUP_PASSPHRASE." >&2; exit 1; }
    gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" --decrypt "$1.gpg"
  else
    cat "$1"
  fi
}

echo "[restore] Restoring database…"
decrypt "$DB_FILE" | gunzip | MYSQL_PWD="$DB_PASS" mysql \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME"

if [ -f "$STORAGE_FILE" ] || [ -f "$STORAGE_FILE.gpg" ]; then
  echo "[restore] Restoring storage…"
  # Move the current storage aside rather than deleting outright.
  if [ -d "$STORAGE_DIR" ]; then
    mv "$STORAGE_DIR" "$STORAGE_DIR.pre-restore-$(date +%s)"
  fi
  decrypt "$STORAGE_FILE" | tar -xzf - -C "$(dirname "$STORAGE_DIR")"
else
  echo "[restore] No storage artifact for '$TS' — skipping storage restore." >&2
fi

echo "[restore] Done. Restart the app (pm2 restart audit-portal / systemctl restart audit-portal)."
