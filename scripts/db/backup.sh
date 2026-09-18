#!/usr/bin/env bash
# BeltFlow PostgreSQL backup.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:port/dbname \
#   BACKUP_DIR=/path/to/backups \
#   ./scripts/db/backup.sh
#
# Never hardcodes a connection string or password - both come from the
# environment, exactly like the running backend (server/src/db/client.ts).
# Produces a pg_dump custom-format (-Fc) archive, which is compressed and
# is the format pg_restore expects for a selective/parallel restore.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Refusing to guess a connection target." >&2
  exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/beltflow_${TIMESTAMP}.dump"

echo "Backing up to: $OUT_FILE"
pg_dump --format=custom --no-owner --no-privileges --file="$OUT_FILE" "$DATABASE_URL"

if [ ! -s "$OUT_FILE" ]; then
  echo "ERROR: backup file is missing or empty after pg_dump." >&2
  exit 1
fi

echo "Backup completed: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
