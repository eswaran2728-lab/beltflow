#!/usr/bin/env bash
# BeltFlow PostgreSQL restore.
#
# Usage:
#   TARGET_DATABASE_URL=postgres://user:pass@host:port/beltflow_recovery_test \
#   BACKUP_FILE=/path/to/backups/beltflow_20260101T000000Z.dump \
#   ./scripts/db/restore.sh
#
# Deliberately requires TARGET_DATABASE_URL (not DATABASE_URL) so a
# restore can never be run by accidentally reusing the same environment
# variable a backup or the running application uses - there is no
# fallback/default target, and there never should be one.
set -euo pipefail

if [ -z "${TARGET_DATABASE_URL:-}" ]; then
  echo "ERROR: TARGET_DATABASE_URL is not set. Refusing to restore without an explicit target." >&2
  echo "This intentionally will not fall back to DATABASE_URL - that guards against" >&2
  echo "accidentally restoring on top of a live database." >&2
  exit 2
fi

if [ -z "${BACKUP_FILE:-}" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: BACKUP_FILE is not set or does not exist: ${BACKUP_FILE:-<unset>}" >&2
  exit 2
fi

if [ "${I_UNDERSTAND_THIS_TARGET_IS_CORRECT:-}" != "yes" ]; then
  echo "ERROR: set I_UNDERSTAND_THIS_TARGET_IS_CORRECT=yes to confirm TARGET_DATABASE_URL" >&2
  echo "really is the intended restore target (never production) before proceeding." >&2
  echo "Target: $TARGET_DATABASE_URL" >&2
  exit 2
fi

echo "Restoring $BACKUP_FILE into: $TARGET_DATABASE_URL"
pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$TARGET_DATABASE_URL" "$BACKUP_FILE"

echo "Restore completed."
