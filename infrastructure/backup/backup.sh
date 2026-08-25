#!/bin/bash
# AKADEMI Digital Campus — Database Backup Script
#
# Usage:
#   ./backup.sh                          # Full backup
#   ./backup.sh --db-url postgresql://... # Custom database URL
#   ./backup.sh --retention 7             # Keep 7 days of backups
#   ./backup.sh --verify                  # Verify backup integrity
#
# Environment variables:
#   DATABASE_URL          — PostgreSQL connection string (required)
#   BACKUP_DIR            — Directory to store backups (default: ./backups)
#   BACKUP_RETENTION_DAYS — Days to keep old backups (default: 30)

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="akademi_backup_${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"
VERIFY=false

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --db-url) DATABASE_URL="$2"; shift 2 ;;
    --retention) RETENTION_DAYS="$2"; shift 2 ;;
    --verify) VERIFY=true; shift ;;
    --help)
      echo "Usage: $0 [--db-url URL] [--retention DAYS] [--verify]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Validation ───────────────────────────────────────────────────
if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ ERROR: DATABASE_URL is not set."
  echo "Set it as an environment variable or use --db-url flag."
  echo "Example: export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "❌ ERROR: pg_dump is not installed."
  echo "Install PostgreSQL client tools: apt install postgresql-client"
  exit 1
fi

# ── Create backup directory ──────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  AKADEMI — Database Backup                           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Database:  $(echo "$DATABASE_URL" | sed 's/:[^@]*@/:***@/')"
echo "  Backup:    $BACKUP_FILE"
echo "  Retention: $RETENTION_DAYS days"
echo ""

# ── Pre-backup checks ───────────────────────────────────────────
echo "── Pre-backup checks ──"

# Test connection
if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
  echo "❌ Cannot connect to database."
  exit 1
fi
echo "  ✅ Database connection OK"

# Check database size
DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | xargs)
echo "  📊 Database size: $DB_SIZE"

# Count tables
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
echo "  📋 Tables: $TABLE_COUNT"

# ── Perform backup ───────────────────────────────────────────────
echo ""
echo "── Performing backup ──"
START_TIME=$(date +%s)

pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE" 2>&1 | tail -5

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')

echo "  ✅ Backup completed in ${DURATION}s"
echo "  📦 Backup size: $BACKUP_SIZE"

# ── Verify backup ────────────────────────────────────────────────
if [[ "$VERIFY" == true ]]; then
  echo ""
  echo "── Verifying backup ──"
  if pg_restore --list "$BACKUP_FILE" &> /dev/null; then
    echo "  ✅ Backup is valid and restorable"
  else
    echo "  ❌ Backup verification failed!"
    exit 1
  fi
fi

# ── Cleanup old backups ──────────────────────────────────────────
echo ""
echo "── Cleaning up old backups (>${RETENTION_DAYS} days) ──"
DELETED=$(find "$BACKUP_DIR" -name "akademi_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
echo "  🗑️  Deleted $DELETED old backup(s)"

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo "── Summary ──"
echo "  File:     $BACKUP_FILE"
echo "  Size:     $BACKUP_SIZE"
echo "  Duration: ${DURATION}s"
echo "  Status:   ✅ Success"
echo ""
echo "To restore: ./restore.sh $BACKUP_FILE"
