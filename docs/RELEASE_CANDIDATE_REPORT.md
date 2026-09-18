# BeltFlow Phase 9B — Release Candidate Certification Report

This is the result of an actually-executed Release Candidate Freeze &
Final Regression Certification pass (Phase 9B), not a theoretical
checklist. Every claim below was produced by running real commands
against a real (or embedded, where explicitly noted) PostgreSQL
instance, a real production-mode backend process, a real browser
driving the production-built web client, and the real Android Gradle
toolchain.

## RC Commit

- **RC commit: `9bb51df`** (unchanged from the Phase 9A baseline — Phase
  9B found zero defects requiring a code change, so no new commit was
  needed to reach certification).
- Working tree at time of certification: clean except two pre-existing
  untracked items not part of this repository's deliverables (see
  **Git** section below).

## Feature Freeze

**PASS.** No new features, no UI/architecture redesign, no business-rule
changes, no backend multi-class implementation, and no unrelated
refactoring were performed. All work this phase was verification
(re-running existing suites, a fresh non-authoritative-suite rewrite,
and read-only build/regression checks). No production code file was
modified during Phase 9B.

## Build

- **Node.js**: v22.14.0
- **Clean install**: `rm -rf dist node_modules && npm ci --omit=dev` →
  101 packages, 0 vulnerabilities; confirmed `typescript` is correctly
  absent from the production-only `node_modules` (devDependencies are
  not required at runtime).
- **Build**: `npm install` (restores 18 dev packages) + `npm run build`
  → `tsc` compiles cleanly to `server/dist/`.
- **Startup**: re-pruned to `--omit=dev`; `dist/index.js` starts and
  serves `/api/health` correctly using only production dependencies. No
  dev fallback required.
- **Backend build artifact hash**: `dist/index.js`
  SHA-256 = `844da6864d5403b5f81646072ed708906ee6fd34d1777bfca240d84e3bcbdf54`

## Backend Regression

**Actual current authoritative suite total: 84/84 PASS, 0 FAIL.**

| Suite | Result |
|---|---|
| `test_adversarial_security.js` | 20/20 |
| `test_receipt_integrity.js` | 7/7 |
| `test_process_restart_persistence.js` | 10/10 |
| `test_link_and_grading_gaps.js` | 8/8 |
| `test_production_hardening.js` | 15/15 |
| `test_db_pool_crash_fix.js` | 1/1 |
| `run_backend_tests.js` (RBAC) | 8/8 |
| `test_phase9b_security_matrix.js` (new, replaces the non-self-contained Phase 9A script) | 15/15 |

This is the actual current total, matching Phase 9A's count exactly
(84/84) — confirming zero regressions from any change since 9A (there
have been none; 9B is a pure verification phase). The old
`scratch/phase9a_security_matrix.js` was removed because it depended on
a manually-started server and a torn-down dataset, making it unsuitable
as a repeatable regression script; it was replaced with a fully
self-contained rewrite (`scratch/test_phase9b_security_matrix.js`) that
seeds its own minimal 2-academy/5-role dataset against an embedded
PostgreSQL engine and tears down cleanly. All `scratch/*.js` files are
gitignored test tooling, not committed deliverables.

## Security

- **Auth bypass**: unauthenticated and invalid-token requests denied
  (401/403).
- **Privilege escalation**: Student denied org-create.
- **RBAC / tenant isolation**: SUPER_ADMIN denied operational roster
  access; Admin B denied Academy A's roster and student record
  (cross-tenant IDOR blocked, 403/404).
- **Parent → unrelated student**: blocked (403/404); Parent correctly
  allowed access to their own linked child only after completing the
  full 3-step parent-link approval workflow (Student → Master → Admin).
- **Student → unrelated student**: blocked (IDOR on skills endpoint,
  403/404).
- **Master → unauthorized academy**: blocked (403/404).
- **Duplicate grading finalization**: first submission 200, duplicate
  409.
- **Duplicate tournament finalization**: first submission 200, duplicate
  409.
- **Payment/receipt integrity**: repeated payment submissions produce
  distinct receipt numbers (no financial corruption); `payments_receipt_no_unique`
  partial unique index confirmed present in schema.
- **Secret scan**: zero real secrets found in tracked files or the
  current (empty) diff. All password-like literals are throwaway test
  fixtures in gitignored `scratch/*.js` or the already-audited
  `'safe-password'` literal in `server/src/tests/server_rbac.test.ts`.
  `scripts/db/backup.sh`/`restore.sh` matches are documentation
  placeholder text, not real credentials. No `.jks`/`.keystore`/`.pem`
  tracked in git. The new Google Play upload keystore and its password
  file live outside the repository (`C:\Users\eswaranp\beltflow_signing_2026\`).
  The historically-compromised `release.keystore` exists only in old git
  history (commit `958804b`) and is confirmed NOT present at current
  HEAD. The untracked `release.keystore.base64` in the working tree is
  covered by `.gitignore` and was not inspected (per the standing rule
  against ever printing secret values).

**No P0/P1 security issue found or remains open.**

## Database

Against a fresh dedicated RC database (`beltflow_rc`, portable
PostgreSQL 16.4, port 5433):

- Schema initializes: all 19 expected tables created on first query.
- 36 foreign keys present; `payments_receipt_no_unique` partial unique
  index confirmed present.
- **Idempotent reinitialization proven**: `dbClient.runMigrations()`
  called a second time against the already-initialized database
  completes with no errors.
- Financial ops, grading, certificates, tournaments, and audit logs are
  exhaustively exercised by the 84/84 regression suite against real/embedded
  PostgreSQL — not re-duplicated as a separate manual pass.
- No production database was modified at any point in this phase.

## Web Five-Role Smoke

All five roles verified against the RC backend + a fresh minimal seeded
dataset, driven through the real browser at desktop width:

| Role | Login | Dashboard | Core Workflow | Refresh | Logout |
|---|---|---|---|---|---|
| SUPER_ADMIN | ✅ | ✅ (1 academy listed) | — | ✅ (session persisted) | ✅ |
| ADMIN | ✅ | ✅ (correct counts) | ✅ Classes tab shows correct master name (re-confirms Phase 9A `classes.routes.ts` join fix) | — | ✅ |
| MASTER | ✅ | ✅ (Coach Portal, correct counts) | ✅ Record Skills — fresh "Not started" baseline, updates live to "Current Level: Good" without reload (re-confirms Phase 9A skillProgress fix) | — | ✅ |
| PARENT | ✅ | ✅ (correct linked child, correct "Standard Tuition" label — re-confirms Phase 9A sibling-discount fix) | ✅ Digital Certificates tab shows correct rank | — | ✅ |
| STUDENT | ✅ | ✅ (Current Rank: Yellow Belt) | Bottom nav shows distinct "Progress/Syllabus/Certificates/Tournaments/More" labels (re-confirms Phase 9A P3-2 mobile-nav fix) | — | ✅ |

## Critical Lifecycle

Treated as satisfied by the existing 84/84 automated regression suite,
which already exercises the full academy → class → student →
parent-link → attendance → skill → payment → receipt → grading →
certificate → tournament chain end-to-end against real/embedded
PostgreSQL, combined with the live five-role UI smoke test above (Master
recording skills live, Parent viewing certificates, Admin viewing
classes) — consistent with the mission's allowance to treat an
already-certified UI path as a focused regression rather than
rebuilding the entire 9A dataset.

## Responsive Web

Verified at true 375×812 mobile viewport:

- Login screen renders cleanly, no clipping/overlap.
- Student login succeeds; dashboard renders correctly (Yellow Belt rank,
  correct class/academy).
- Bottom navigation renders 5 distinct labels — **Progress, Syllabus,
  Certificates, Tournaments, More** — with no "My"/"My"/"My" collision,
  re-confirming the Phase 9A P3-2 fix holds at actual mobile width (not
  just desktop width, where it was already confirmed in the five-role
  smoke test above).
- Known pre-existing, already-documented P3 UX1 finding (stale form
  field values on re-render, from Phase 9A's FINAL_UAT_REPORT.md) was
  re-observed on the password field during this pass — not a new
  defect, not fixed, consistent with its existing P3/documented status.

## Android Non-Runtime Regression

Re-run against current HEAD (`9bb51df`) using the existing portable
toolchain (Temurin JDK 17, Android SDK, standalone Gradle 8.11.1):

| Task | Result |
|---|---|
| `compileDebugKotlin` | BUILD SUCCESSFUL |
| `testDebugUnitTest` (forced fresh rerun, `--rerun-tasks`) | **26/26 PASS**, 0 failures — matches Phase 7A/8 baseline |
| `assembleDebug` | BUILD SUCCESSFUL |
| `compileReleaseKotlin` | BUILD SUCCESSFUL (release compiles without any signing secrets present) |

- **Debug APK SHA-256**: `1a556ab4ea0d29c83d6e519db53cae4606aa04f586752bdb9d28a6ebc18244d4`
  (`app/build/outputs/apk/debug/app-debug.apk`)
- **Phase 7B (real physical-device UAT): still NOT READY / OPEN.** This
  phase verifies compile/build/unit-test correctness only — it does not
  claim, and cannot substitute for, real-device runtime verification.
- No signing secrets were used; no AAB was produced or uploaded; nothing
  was published to Google Play.

## Cross-Platform Contract Check

Reviewed the Android/backend API contract for release-breaking
mismatches: **one documented, unchanged limitation remains** — the
backend's `students.class_id` is a single nullable foreign key (no join
table), so a student can belong to only one active class at a time in
the backend's relational model. Android's local `classIdsJson` cache
represents multiple classes client-side, but that is a local
convenience/history concept only; it is not, and cannot be, mirrored
into the current backend schema. This is a pre-existing, explicitly
out-of-scope-for-this-freeze architectural limitation (implementing
concurrent multi-class support is explicitly prohibited under the
Phase 9B feature freeze) — no schema change was made or attempted.

## Documentation

Reviewed `docs/FINAL_UAT_REPORT.md`, `docs/PRODUCTION_RELEASE_CHECKLIST.md`,
`docs/BACKUP_AND_RECOVERY.md`, and `docs/STAGING_DEPLOYMENT.md` together.
**No contradictions found.** All four agree that: the multi-class
limitation is unchanged and documented consistently; Android Phase 7B
remains BLOCKED/OPEN; real hosted HTTPS verification, production backup
automation, off-site backup, and monitoring/alerting all remain
external/NOT CONFIGURED; no document claims production go-live
readiness.

## Rollback

- **RC commit**: `9bb51df`.
- **Previous known-good commit**: `3730640` (Phase 8C staging hardening
  commit, immediately prior to Phase 9A's UAT fixes) — a safe rollback
  target if a defect were ever found in the 9A/9B-era code, since both
  commits share the same additive-only schema.
- **Configuration compatibility**: no environment variable was added,
  renamed, or had its meaning changed between `3730640` and `9bb51df` —
  a rollback to `3730640` would run against the same env var set with no
  configuration changes required.
- **Database compatibility**: `server/src/db/schema.sql` remains
  additive-only (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
  EXISTS`) at both commits — a rolled-back application build would
  continue to run correctly against a database already migrated by the
  newer commit's schema, since no column/table was ever removed.
- No destructive database rollback was performed or is implied by this
  section. Application rollback (git revert to a previous commit +
  redeploy) and database recovery (restore from `pg_dump`, see
  [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)) remain fully separate
  procedures.

## Artifacts

| Artifact | SHA-256 |
|---|---|
| `server/dist/index.js` (production backend build) | `844da6864d5403b5f81646072ed708906ee6fd34d1777bfca240d84e3bcbdf54` |
| `app/build/outputs/apk/debug/app-debug.apk` (Android debug build) | `1a556ab4ea0d29c83d6e519db53cae4606aa04f586752bdb9d28a6ebc18244d4` |

No signed release AAB was produced (Google Play upload key activation
is not until 2026-09-20 01:01 UTC — see **Open External Gates** below).
No binary artifact was committed to the repository.

## Defect Inventory

| ID | Severity | Status | RC Impact |
|---|---|---|---|
| (none) | — | No P0/P1/P2 defect was found during Phase 9B | None |

Zero new defects of any severity were found this phase. All Phase 9A
P1/P2/P3 fixes (`pg.Pool` error handler, `classes.routes.ts` master-name
join, tournament/grading audit-log inserts, skillProgress live-update,
sibling-discount label, mobile nav labels) were re-confirmed intact and
working during this phase's regression and smoke testing. The one P3
UX1 finding from Phase 9A (stale modal field values) was re-observed,
remains open by design (documented, not release-blocking), and is
unchanged.

## Final Classification

```
P0 OPEN: 0
P1 OPEN: 0
WEB RELEASE CANDIDATE: CERTIFIED
ANDROID RELEASE CANDIDATE: NOT READY (Phase 7B physical-device UAT still open)
PHASE 9B: COMPLETE
PRODUCTION GO-LIVE: NOT YET DECLARED
```

## Open External Gates (unchanged from Phase 9A)

1. Android Phase 7B physical-device UAT
2. Real hosted HTTPS verification
3. Production backup automation
4. Off-site backup
5. Monitoring/alerting
6. Google Play replacement upload-key activation (2026-09-20 01:01 UTC / 09:01 MYT)
7. Backend concurrent multi-class limitation (architectural, not a defect — will not be resolved during any freeze phase)

Do not deploy production. Do not publish Google Play.

## Git

- RC commit: `9bb51df` (no new code commit was required; Phase 9B's own
  deliverable — this report and the checklist update — is committed
  separately; see the final report for the exact commit hash and RC tag
  target).
- No force push performed. No git history rewritten.
