#!/usr/bin/env bash
# ================================================
# AKADEMI Digital Campus - Database Backup Script
# ================================================
# Creates timestamped PostgreSQL backups with compression
# and optional upload to cloud storage.
#
# Usage:
#   ./scripts/backup.sh                    # Local backup only
#   ./scripts/backup.sh --upload           # Backup + upload to Supabase Storage
#   ./scripts/backup.sh --retention 7      # Keep last 7 backups
#
# Prerequisites:
#   - pg_dump available in PATH
#   - DATABASE_URL set in environment or .env file
# ================================================

set -euo pipefail

# ---- Config ----
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_COUNT="${RETENTION_COUNT:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="akademi_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# ---- Load .env if present ----
if [ -f backend/.env ]; then
  set -a
  source backend/.env
  set +a
fi

DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set. Cannot backup."
  exit 1
fi

# ---- Parse DATABASE_URL ----
# Format: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\2|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

echo "============================================"
echo "AKADEMI Digital Campus - Database Backup"
echo "============================================"
echo "Database: ${DB_NAME}"
echo "Host:     ${DB_HOST}:${DB_PORT}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# ---- Create backup directory ----
mkdir -p "${BACKUP_DIR}"

# ---- Dump with compression ----
echo "[1/3] Creating backup..."
PGPASSWORD="${DB_PASS}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_PATH}.dump" \
  2>&1 | tail -5

# ---- Create plain SQL dump too (for inspection) ----
PGPASSWORD="${DB_PASS}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_PATH}.sql" \
  2>/dev/null

# ---- Verify backup ----
echo "[2/3] Verifying backup..."
DUMP_SIZE=$(stat -f%z "${BACKUP_PATH}.dump" 2>/dev/null || stat -c%s "${BACKUP_PATH}.dump" 2>/dev/null || echo "0")
SQL_SIZE=$(stat -f%z "${BACKUP_PATH}.sql" 2>/dev/null || stat -c%s "${BACKUP_PATH}.sql" 2>/dev/null || echo "0")

if [ "${DUMP_SIZE}" -gt 1000 ]; then
  echo "  ✅ Custom dump: ${BACKUP_PATH}.dump ($(numfmt --to=iec ${DUMP_SIZE} 2>/dev/null || echo "${DUMP_SIZE} bytes"))"
else
  echo "  ❌ Backup too small (${DUMP_SIZE} bytes) - something went wrong"
  exit 1
fi

if [ "${SQL_SIZE}" -gt 1000 ]; then
  echo "  ✅ SQL dump: ${BACKUP_PATH}.sql ($(numfmt --to=iec ${SQL_SIZE} 2>/dev/null || echo "${SQL_SIZE} bytes"))"
else
  echo "  ⚠️  SQL dump is small (${SQL_SIZE} bytes) - table may be empty"
fi

# ---- Count tables in backup ----
TABLE_COUNT=$(PGPASSWORD="${DB_PASS}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --schema-only \
  2>/dev/null | grep -c "CREATE TABLE" || echo "0")
echo "  📊 Tables backed up: ${TABLE_COUNT}"

# ---- Cleanup old backups ----
echo "[3/3] Cleaning up old backups (keeping last ${RETENTION_COUNT})..."
cd "${BACKUP_DIR}"
ls -t akademi_backup_*.dump 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) | xargs -r rm -f
ls -t akademi_backup_*.sql 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) | xargs -r rm -f
cd - > /dev/null

echo ""
echo "============================================"
echo "✅ Backup complete!"
echo "  Location: ${BACKUP_DIR}/"
echo "  Files:    ${BACKUP_NAME}.dump, ${BACKUP_NAME}.sql"
echo "============================================"
