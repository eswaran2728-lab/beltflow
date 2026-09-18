# BeltFlow Database Backup & Recovery

This document is the result of an actual, executed backup → restore →
verify drill (Phase 8B), not a theoretical plan. Every claim below that
isn't marked "(recommended, not yet measured)" was produced by running
real commands against a real PostgreSQL 16 server with a seeded test
dataset. See the Phase 8B report for the full evidence trail.

## 1. Architecture

- **Engine**: PostgreSQL. Production/staging connect via `DATABASE_URL`
  (a real PostgreSQL server, `pg` driver - [server/src/db/client.ts](../server/src/db/client.ts)).
  When `DATABASE_URL` is unset, the backend falls back to an embedded
  PGlite (WASM PostgreSQL 16-compatible) engine for local dev/tests only
  - that fallback has no `pg_dump`-compatible server socket and is never
    the production path.
- **Schema/migration mechanism**: a single idempotent `server/src/db/schema.sql`,
  applied in full on every backend startup (`CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, guarded `DO $$ ... $$` blocks for backfills).
  No destructive statement exists in it - verified by inspection during
  Phase 8, re-confirmed during Phase 8B.
- **Tenant model**: `organizations` is the tenant boundary; almost every
  other table carries `organization_id` (directly or transitively via
  `students`/`classes`), enforced with `ON DELETE CASCADE` foreign keys.
- **Class membership**: `students.class_id` is a single nullable foreign
  key to `classes(id)` (`ON DELETE SET NULL`). **The backend relational
  model does not support a student belonging to multiple classes
  simultaneously** - there is no join table for it. (Android's local
  `classIdsJson` multi-class cache, covered in Phase 7A/8, is a
  client-side concept only; it is not mirrored in this schema.) A
  student's multi-class *history* is representable via
  `class_transfer_requests` (old class → new class, sequential, not
  concurrent).
- **Financial records**: `payments.receipt_no` is enforced unique at the
  database level via a partial unique index
  (`payments_receipt_no_unique`, `WHERE receipt_no IS NOT NULL`) -
  pending/rejected payments have no receipt.
- **Grading/tournament/certificates**: `grading_events` → `grading_candidates`
  (result state machine: Registered → Passed/Failed/Double Promotion,
  each candidate scored exactly once); `tournaments` → `tournament_participants`
  (medal results); both a passing grading result and a non-"Participant"
  tournament medal issue a row in `certificates`, keyed by a unique `code`.

## 2. Backup Strategy

`pg_dump` in custom format (`-Fc`, gzip-compressed, produced by
[scripts/db/backup.sh](../scripts/db/backup.sh)) is the primary
mechanism - it is compatible with `pg_restore`'s selective/parallel
restore and works against any real PostgreSQL `DATABASE_URL`, which
matches the actual production connection path.

For a managed PostgreSQL provider (Railway, RDS, Supabase, etc.),
**prefer the provider's native automated snapshot/backup feature as the
primary safety net**, with `pg_dump` as a portable, provider-independent
secondary copy (see §11 scenario F).

## 3. Backup Procedure

```bash
DATABASE_URL="postgres://<user>:<password>@<host>:<port>/<dbname>" \
BACKUP_DIR="/path/outside/the/repo/backups" \
./scripts/db/backup.sh
```

- Requires `DATABASE_URL`; refuses to guess a target if unset.
- Fails loudly (non-zero exit) if `pg_dump` fails, or if the resulting
  file is missing/empty.
- Never place `BACKUP_DIR` inside this repository. `.gitignore` blocks
  `*.dump`, `*.sql.gz`, `*.backup`, `*.pgdump`, `backups/`, `db_backups/`
  as a second layer of protection, but the primary control is: don't put
  backups in the repo at all.

## 4. Restore Procedure

```bash
TARGET_DATABASE_URL="postgres://<user>:<password>@<host>:<port>/<clean_target_dbname>" \
BACKUP_FILE="/path/to/backups/beltflow_<timestamp>.dump" \
I_UNDERSTAND_THIS_TARGET_IS_CORRECT=yes \
./scripts/db/restore.sh
```

- Deliberately reads `TARGET_DATABASE_URL`, never `DATABASE_URL` - this
  means a restore can never accidentally reuse the same environment
  variable a backup or the running application uses.
- Requires the explicit `I_UNDERSTAND_THIS_TARGET_IS_CORRECT=yes`
  confirmation flag - there is no default target, and there must never
  be one.
- `pg_restore --clean --if-exists` drops and recreates objects inside the
  target database before restoring, so the target should be an empty or
  disposable database, never a database you need to keep in its current
  state.

## 5. Verification Procedure

```bash
SOURCE_DATABASE_URL="postgres://.../beltflow_source" \
RESTORED_DATABASE_URL="postgres://.../beltflow_recovery_test" \
node scripts/db/verify_restore.js
```

Compares row counts across all 19 application tables, plus payment
count/total/distinct-receipt-count, plus a duplicate-receipt scan on the
restored database. Exits non-zero on any mismatch. **Executed for real**
in Phase 8B: 19/19 tables matched, financial totals matched, zero
duplicate receipts found.

## 6. Financial Integrity Checks

- `payments_receipt_no_unique` (partial unique index) survives restore
  unchanged - confirmed via `\d payments` on the restored database.
- A genuinely new payment recorded against the restored database
  generated a fresh, non-colliding receipt number, proving the
  constraint (and the app's retry-on-collision logic in
  `server/src/routes/billing.routes.ts`) still functions post-restore,
  not just at restore-time.
- Payment count and total amount matched exactly between source and
  restored databases in the executed drill.

## 7. Multi-Tenant Integrity Checks

- `organizations` → `users`/`classes`/`students` counts matched exactly
  after restore.
- Cross-tenant/role isolation was re-verified against the *restored*
  database with a live API call: a parent linked only to Student A
  received 403/404 when attempting to look up Student B (a student in
  the same organization but a different family) - proving RBAC
  middleware evaluates correctly against restored data, not just
  against the original database's connection state.

## 8. Certificate Verification Checks

Certificate issuance (grading-exam promotion and tournament medal) was
seeded, restored, and then verified live: `POST /api/v1/certificates/verify`
against the restored database returned the correct certificate for a
valid code, and rejected an unauthenticated request with 401.

## 9. Backup Security

- **Where backups live**: outside this repository, outside any directory
  served by the backend's static file handler. Never on a developer's
  desktop long-term - a managed object store (S3-compatible, provider
  snapshot storage) with restricted IAM access is the production target.
- **Encryption at rest**: `pg_dump` output is not encrypted by itself.
  Production backups should be encrypted at rest by the storage layer
  (provider-managed encryption, or `gpg`/age-encrypting the dump file
  before upload) - this repository does not implement that, since there
  is no production backup destination configured yet. **(recommended,
  not yet measured/implemented)**
- **Access control**: only the credentials that can reach
  `TARGET_DATABASE_URL` can restore; backup storage access should be
  restricted separately (least-privilege IAM role, not the same
  credential the application uses day-to-day).
- **Credential handling**: both scripts take connection strings only via
  environment variables; neither script nor this document contains a
  real credential.
- **Retention**: not yet configured for a real production target -
  see §10.
- **Off-site copy**: not yet configured - see §10.
- **Auditability**: `audit_logs` captures application-level mutations,
  but does not currently record *backup/restore operations themselves*.
  Recommend logging each production backup/restore invocation (who, when,
  which file) outside the database (e.g. CI job history or a dedicated
  ops log). **(recommended, not yet implemented)**

## 10. Retention Recommendations

**(recommended targets, not yet measured against a real production
volume)**

- Daily automated backups, retained 14 days.
- Weekly backup retained 90 days.
- Monthly backup retained 1 year (financial/audit-adjacent data).
- At least one off-site/secondary-region copy of the most recent backup.

## 11. RPO / RTO

**RECOMMENDED TARGET** (not yet measured against production-scale data
or infrastructure):
- RPO: 24 hours (daily backup cadence) as an initial target; tighten to
  hourly or continuous WAL archiving once transaction volume justifies it.
- RTO: under 1 hour for a single-tenant restore drill; production actual
  RTO also depends on how fast a replacement database/hosting instance
  can be provisioned, which this drill did not test.

**MEASURED TEST RESULT** (this Phase 8B drill, on a locally-provisioned
PostgreSQL 16 instance, a seeded dataset of 1 organization / 6 users / 2
classes / 2 students / 19-table full workflow coverage):
- Backup (`pg_dump`, custom format): **~0.8 seconds**, 48KB output.
- Restore (`pg_restore --clean --if-exists`): **~0.5 seconds**.
- These numbers demonstrate the *mechanism* works correctly and quickly
  at this dataset size - they are not a projection for a production
  database with real data volume, and must not be quoted as a production
  RTO/RPO guarantee.

## 12. Disaster Scenarios

| Scenario | Detection | Containment | Recovery | Verification |
|---|---|---|---|---|
| A. Database process crashes | Health check (`/api/health`) fails; connection errors in app logs | Stop routing traffic to the affected instance | Restart the database process; if data files are intact, no restore needed | Re-run `/api/health`, then `verify_restore.js`-style row-count spot checks |
| B. Application server crashes | Process monitor / platform health check | Platform auto-restarts the process (existing `SIGTERM`/`SIGINT` graceful shutdown already closes the DB client cleanly - [server/src/index.ts](../server/src/index.ts)) | Restart the app process; DB state is untouched since the crash was app-side | Confirm `/api/health`; spot-check a few known records |
| C. Database files are lost | Startup fails to connect / data directory missing | Provision a fresh database instance | Restore the most recent backup via `restore.sh` into the new instance, point `DATABASE_URL` at it | Run `verify_restore.js` against the last known-good manifest; run backend smoke tests |
| D. Latest backup is corrupt | `pg_restore -l` fails to list the archive, or restore.sh exits non-zero | Do not delete the corrupt file; do not attempt production restore from it | Fall back to the next-most-recent backup; investigate why the latest one was corrupt (disk, transfer, truncation) | Same as C once a good backup is found |
| E. Restore fails halfway | `pg_restore` exits non-zero mid-run | The target database is a clean/disposable database (never overwrite a live one in place - see §4), so a failed restore only pollutes the disposable target | Drop the partially-restored target database, create a new clean one, retry | Re-run `verify_restore.js` after a successful retry |
| F. Backup credentials unavailable | Backup job fails to authenticate | Alert immediately - a silently-failing backup job is worse than a loud one | Rotate/restore access to the credential store; re-run the missed backup manually once access is restored | Confirm the next scheduled backup succeeds and its manifest matches expectations |
| G. Backup exists but app version/schema differs | Restore succeeds, but the running application errors on missing/renamed columns | Do not force a schema migration against a restored backup without review | Check out the application version that matches the backup's schema, restore, migrate forward deliberately, then upgrade the app version | Run the full backend regression suite against the restored+migrated database before serving traffic |
| H. Accidental tenant data deletion | Support/customer report, or an audit_logs entry showing an unexpected delete | Do not attempt row-level "undo" against the live database without a full backup first | Restore the most recent backup into a scratch database, extract only the affected tenant's rows, re-insert them into the live database inside a transaction | Verify the tenant's row counts and a few key aggregates (payment totals, student count) match pre-incident state |

## 13. Recovery Checklist

1. Confirm the actual failure mode (one of §12's scenarios).
2. Never restore directly onto a live/production database in place -
   always restore into a clean/disposable target first (§4).
3. Run `scripts/db/verify_restore.js` against the restored target before
   promoting it to serve traffic.
4. Run the backend regression suite (§ Regression in the Phase 8B report)
   against the restored database.
5. Only then repoint `DATABASE_URL` (or the load balancer / DNS) at the
   recovered instance.
6. Record what happened and when in an incident note (outside this repo
   if it might contain real tenant data).

## 14. Restore Drill Procedure

This is exactly what Phase 8B executed, and should be re-run
periodically (recommended: quarterly, and after any schema change) as a
"can we actually restore" fire drill, not just a documentation review:

1. Seed or snapshot a representative dataset in a **test** database.
2. Capture a baseline manifest (`scripts/db/baseline_manifest.js`).
3. `scripts/db/backup.sh` the test database.
4. Create a fresh, empty target database.
5. `scripts/db/restore.sh` into that fresh target.
6. `scripts/db/verify_restore.js` comparing source vs. restored.
7. Point a real backend instance's `DATABASE_URL` at the restored
   database and run through auth, lookups, and at least one write +
   restart-persistence check (exactly as done in Phase 8B).
8. Tear down the test/target databases and any local PostgreSQL
   instance used for the drill - none of this should be left running
   or committed.

## 15. Known Limitations

- No production backup destination is configured yet (no managed
  provider, no encrypted off-site storage) - this is a **deployment
  requirement**, not something this repository can satisfy on its own.
- No point-in-time recovery (WAL archiving) is set up. `pg_dump` gives
  point-in-time-of-backup only, not continuous recovery to an arbitrary
  moment.
- The measured backup/restore timings (§11) are from a small local test
  dataset and do not represent production-scale timing.
- The backend's `class_id` model does not support concurrent multi-class
  membership (§1) - this is a real, current schema limitation, not a
  backup/recovery defect, and is unrelated to Android's local multi-class
  cache.
- Backup/restore operations are not yet themselves audit-logged (§9).
