#!/usr/bin/env bash
# ================================================
# AKADEMI Digital Campus - Database Restore Script
# ================================================
# Restores a PostgreSQL backup with safety checks.
#
# Usage:
#   ./scripts/restore.sh backups/akademi_backup_20260822_120000.dump
#   ./scripts/restore.sh backups/akademi_backup_20260822_120000.dump --confirm
#   ./scripts/restore.sh backups/akademi_backup_20260822_120000.sql
#
# Prerequisites:
#   - pg_restore / psql available in PATH
#   - DATABASE_URL set in environment or .env file
# ================================================

set -euo pipefail

# ---- Config ----
BACKUP_FILE="${1:-}"
CONFIRM="${2:-}"

# ---- Load .env if present ----
if [ -f backend/.env ]; then
  set -a
  source backend/.env
  set +a
fi

DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set."
  exit 1
fi

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file> [--confirm]"
  echo ""
  echo "Available backups:"
  ls -lh backups/akademi_backup_*.dump 2>/dev/null || echo "  No backups found in backups/"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# ---- Parse DATABASE_URL ----
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\2|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

echo "============================================"
echo "⚠️  AKADEMI Digital Campus - Database Restore"
echo "============================================"
echo ""
echo "  Backup file: ${BACKUP_FILE}"
echo "  Target DB:   ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo ""
echo "  ⚠️  WARNING: This will OVERWRITE the target database!"
echo "  ⚠️  All existing data will be LOST!"
echo ""

if [ "$CONFIRM" != "--confirm" ]; then
  echo "  To proceed, run:"
  echo "    $0 ${BACKUP_FILE} --confirm"
  echo ""
  echo "  Aborted."
  exit 1
fi

# ---- Create safety backup first ----
echo "[1/4] Creating safety backup before restore..."
SAFETY_BACKUP="backups/safety_backup_$(date +%Y%m%d_%H%M%S).dump"
mkdir -p backups
PGPASSWORD="${DB_PASS}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --file="${SAFETY_BACKUP}" \
  2>/dev/null && echo "  ✅ Safety backup: ${SAFETY_BACKUP}" || echo "  ⚠️  Could not create safety backup (DB may be empty)"

# ---- Disconnect existing connections ----
echo "[2/4] Disconnecting existing connections..."
PGPASSWORD="${DB_PASS}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
  2>/dev/null || echo "  (no active connections)"

# ---- Drop and recreate database ----
echo "[3/4] Dropping and recreating database..."
PGPASSWORD="${DB_PASS}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
  2>/dev/null

PGPASSWORD="${DB_PASS}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d postgres \
  -c "CREATE DATABASE ${DB_NAME};" \
  2>/dev/null

# ---- Restore ----
echo "[4/4] Restoring from backup..."
FILE_EXT="${BACKUP_FILE##*.}"

if [ "$FILE_EXT" = "dump" ]; then
  PGPASSWORD="${DB_PASS}" pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-privileges \
    --verbose \
    "${BACKUP_FILE}" \
    2>&1 | tail -10
elif [ "$FILE_EXT" = "sql" ]; then
  PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -f "${BACKUP_FILE}" \
    2>&1 | tail -10
else
  echo "ERROR: Unknown backup format: ${FILE_EXT}"
  exit 1
fi

# ---- Verify restore ----
echo ""
echo "Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${DB_PASS}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
  2>/dev/null | tr -d ' ')

echo ""
echo "============================================"
echo "✅ Restore complete!"
echo "  Tables in restored DB: ${TABLE_COUNT}"
echo "  Safety backup: ${SAFETY_BACKUP}"
echo "============================================"
