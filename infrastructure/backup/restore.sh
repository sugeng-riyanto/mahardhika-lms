#!/bin/bash
# AKADEMI Digital Campus — Database Restore Script
#
# Usage:
#   ./restore.sh backup_file.sql.gz              # Restore from backup
#   ./restore.sh backup_file.sql.gz --dry-run    # Preview without restoring
#   ./restore.sh backup_file.sql.gz --target db  # Restore to specific database
#   ./restore.sh backup_file.sql.gz --confirm    # Skip confirmation prompt
#
# WARNING: This will DROP and recreate tables in the target database.
# Always use --dry-run first to preview what will be restored.

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:-}"
DRY_RUN=false
TARGET_DB=""
CONFIRM=false

# Parse args
BACKUP_FILE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --target) TARGET_DB="$2"; shift 2 ;;
    --confirm) CONFIRM=true; shift ;;
    --db-url) DATABASE_URL="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 <backup_file> [--dry-run] [--target db] [--confirm] [--db-url URL]"
      exit 0
      ;;
    *)
      if [[ -z "$BACKUP_FILE" ]]; then
        BACKUP_FILE="$1"
      else
        echo "Unknown option: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

# ── Validation ───────────────────────────────────────────────────
if [[ -z "$BACKUP_FILE" ]]; then
  echo "❌ ERROR: No backup file specified."
  echo "Usage: $0 <backup_file.sql.gz> [--dry-run]"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "❌ ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ ERROR: DATABASE_URL is not set."
  exit 1
fi

if ! command -v pg_restore &> /dev/null; then
  echo "❌ ERROR: pg_restore is not installed."
  exit 1
fi

# ── Safety checks ────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════╗"
echo "║  AKADEMI — Database Restore                          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  ⚠️  WARNING: This will DROP and recreate tables!"
echo ""
echo "  Backup file: $BACKUP_FILE"
echo "  Backup size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
echo "  Target DB:   $(echo "$DATABASE_URL" | sed 's/:[^@]*@/:***@/')"
echo "  Dry run:     $DRY_RUN"
echo ""

# ── Verify backup integrity ─────────────────────────────────────
echo "── Verifying backup integrity ──"
if ! pg_restore --list "$BACKUP_FILE" &> /dev/null; then
  echo "❌ Backup file is corrupted or invalid."
  exit 1
fi
echo "  ✅ Backup file is valid"

# Count objects in backup
OBJ_COUNT=$(pg_restore --list "$BACKUP_FILE" 2>/dev/null | grep -c "^[0-9]" || echo "0")
echo "  📦 Objects in backup: $OBJ_COUNT"

# ── Connection test ──────────────────────────────────────────────
echo ""
echo "── Testing database connection ──"
if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
  echo "❌ Cannot connect to target database."
  exit 1
fi
echo "  ✅ Database connection OK"

# Current table count
CURRENT_TABLES=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
echo "  📋 Current tables: $CURRENT_TABLES"

# ── Confirmation ─────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "── Dry Run — Preview ──"
  echo "  Objects that would be restored:"
  pg_restore --list "$BACKUP_FILE" 2>/dev/null | head -30
  echo "  ..."
  echo ""
  echo "  ℹ️  No changes made. Run without --dry-run to restore."
  exit 0
fi

if [[ "$CONFIRM" != true ]]; then
  echo ""
  read -p "⚠️  Are you sure you want to restore? This will DROP existing tables! (yes/no): " answer
  if [[ "$answer" != "yes" ]]; then
    echo "❌ Restore cancelled."
    exit 0
  fi
fi

# ── Perform restore ──────────────────────────────────────────────
echo ""
echo "── Performing restore ──"
START_TIME=$(date +%s)

pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  "$BACKUP_FILE" 2>&1 | tail -10

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ── Post-restore verification ────────────────────────────────────
echo ""
echo "── Post-restore verification ──"
NEW_TABLES=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
echo "  📋 Tables after restore: $NEW_TABLES"

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo "── Summary ──"
echo "  Backup:    $BACKUP_FILE"
echo "  Duration:  ${DURATION}s"
echo "  Tables:    $CURRENT_TABLES → $NEW_TABLES"
echo "  Status:    ✅ Restore completed"
