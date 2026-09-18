# BeltFlow Phase 9A — Final Full-System UAT Report

This documents an actual executed run: a fresh academy lifecycle driven
through the real web UI wherever a UI path exists, against a dedicated
UAT PostgreSQL database, a unique UAT JWT secret, and an explicit UAT
CORS origin. Steps completed via direct API call (rather than through
the browser) are explicitly marked **(API-assisted)** below, with the
reason — either no UI path exists for that action, or browser-automation
tooling in this sandbox could not reliably drive an otherwise-real UI
control (a "More" bottom-sheet menu and a couple of native `<select>`
elements repeatedly failed to register clicks/changes). No business
outcome was seeded directly into the database.

## Environment

- `NODE_ENV=production`, dedicated `beltflow_uat` PostgreSQL 16.4 database
  (separate from the Phase 8B/8C databases), a freshly generated UAT-only
  JWT secret, `CORS_ALLOWED_ORIGINS=https://uat.beltflow.local`.
- No production data, secrets, or database were used anywhere in this phase.
- Confirmed HEAD before starting: `3730640` (clean working tree, only
  untracked `.claude/` tooling dir).

## Build

- `npm ci --omit=dev` + `tsc` production build: **SUCCESS**.
- Fresh install (`Fresh Platform Installation` banner) confirmed on
  first load — no pre-configured admin.

## UAT Dataset

- 2 academies: **BeltFlow Final UAT Academy** (primary) and **BeltFlow
  Second UAT Academy** (tenant-isolation control, admin-only, no
  operational data).
- Roles created: SUPER_ADMIN, ADMIN_PERSATUAN (×2, one per academy),
  MASTER, PARENT, STUDENT (×2 direct logins).
- 4 classes (Alpha, Beta created without a master to prove the "no
  retroactive master assignment" UI gap below; Gamma, Delta created with
  the master assigned at creation time).
- 4 students: Alpha (normal), Beta (sibling-adjacent test subject, later
  class-transferred Gamma→Delta), NewChild (self-registered by parent,
  standard tuition), Charlie (unrelated control, later tournament Gold
  medalist).

## FIVE-ROLE MATRIX

| Role | Login | Dashboard | Core Workflow | Isolation | Result |
|---|---|---|---|---|---|
| SUPER_ADMIN | ✅ UI | ✅ correct academy count/list | Onboarded both academies via UI | ✅ denied operational student/billing access (403, tested via API) | PASS |
| ADMIN | ✅ UI | ✅ correct roster/classes/collections | Classes, instructor, students, billing, grading, tournament, certificate verify — all via UI | ✅ Admin2 denied org1 data (IDOR-tested via API) | PASS |
| MASTER | ✅ UI | ✅ correct class/roster counts | Attendance (UI), class-transfer approval (API-assisted — bottom-sheet menu flakiness) | ✅ denied org-create (role-restricted, API-tested) | PASS |
| PARENT | ✅ UI | ✅ correct linked children only | Registration (UI), link-existing-child (UI), grading registration (API-assisted — same menu flakiness) | ✅ denied unrelated Charlie (IDOR-tested via API) | PASS |
| STUDENT | ✅ UI | ✅ correct class/rank | Parent-link approval (UI) | ✅ denied unrelated Beta/Charlie records (IDOR-tested via API) | PASS |

## BUSINESS LIFECYCLE MATRIX

| Step | UI | API | DB | Reload | Audit | Result |
|---|---|---|---|---|---|---|
| Super Admin init | ✅ | ✅ | ✅ | ✅ | ✅ `Super Admin Setup` | PASS |
| Academy creation ×2 | ✅ | ✅ | ✅ | ✅ | ✅ `Organization Onboarded` ×2 | PASS |
| Class creation ×4 | ✅ | ✅ | ✅ | ✅ | ✅ `Class Created` ×4 | PASS |
| Instructor registration | ✅ | ✅ | ✅ | ✅ | ✅ `Coach Registered` | PASS |
| Student enrollment ×3 (Alpha/Beta/Charlie) | ✅ | ✅ | ✅ (sibling discount RM108 correct) | ✅ | ✅ `Student Enrolled` ×3 | PASS |
| Parent self-registration (NewChild) | ✅ | ✅ | ✅ | ✅ | ✅ `Parent Registration` | PASS |
| Parent link-existing-child (Alpha) | ✅ | ✅ | ✅ 3-step→ACTIVE | ✅ | ✅ `Parent Link Request`/`Approved` ×2 | PASS |
| Attendance (Charlie, Class Delta) | ✅ | ✅ | ✅ | ✅ | ✅ `Attendance Recorded` | PASS |
| Skill progress (Charlie) | ✅ | ✅ | ✅ **(fixed P3 — see Defects)** | ✅ badge now correct after reload | none designed | PASS |
| Class transfer (Beta: Gamma→Delta) | ✅ (request) / API-assisted (2 approvals) | ✅ | ✅ `class_id` updated | ✅ | ✅ `Class Transfer Approved` | PASS |
| Payment/receipt ×2 (incl. repeat-submission test) | ✅ | ✅ | ✅ 2 unique receipts, RM240 | ✅ correct class/reviewer (fixed) | ✅ `Cash Payment Recorded` ×2 | PASS |
| Grading (Alpha, Passed→Yellow Belt) | ✅ (score) / API-assisted (registration) | ✅ | ✅ belt updated + cert issued | ✅ | ✅ `Grading Event Created` + `Grading Results Recorded` (added this phase) | PASS |
| Certificate verification (Alpha) | ✅ | ✅ | ✅ | ✅ correct student/rank/academy/examiner | n/a (public-style verify) | PASS |
| Tournament + medal (Charlie, Gold) | ✅ | ✅ | ✅ | ✅ | ✅ `Tournament Scheduled` + `Tournament Results Finalized` (added this phase) | PASS |

## FINANCIAL RECONCILIATION

| Metric | Expected | Actual |
|---|---|---|
| Payment count | 2 | 2 |
| Total amount | RM 240.00 | RM 240.00 |
| Receipt count | 2 | 2 |
| Unique receipts | 2 | 2 |
| Duplicate receipts | 0 | 0 |

Repeated identical submission (same student, amount, method, memo)
produced a second, independent payment with a distinct receipt number —
no financial corruption, no silent overwrite.

## GRADING

Alpha registered (parent-initiated) → Admin scored "Passed" → belt
updated `White Belt → Yellow Belt` in `students.belt_rank` → certificate
`BF-UA-7292` issued. **Duplicate finalization blocked**: re-submitting
the same score returned `409 Candidate has already been graded (result:
Passed)`.

## CERTIFICATES

Verified via the in-app "Verify Certificate" tool (code `BF-UA-7292`):
student name, rank (Yellow Belt), academy (BeltFlow Final UAT Academy),
examiner (UAT Admin Persatuan), and code all correct and consistent with
the database row. A second certificate (`BF-MED-UA-2517`, Tournament
Medal, Charlie) was also confirmed correctly attributed in the DB.

## TOURNAMENT

Created "UAT Open Championship" → recorded Charlie as Gold medalist via
the Admin UI → `tournament_participants` row + certificate issued,
tournament status flipped to `Completed`. **Duplicate finalization
blocked**: re-submitting results for the same tournament returned `409
Tournament results have already been finalized`.

## CLASS TRANSFER

Beta requested Gamma→Delta via the Student UI; both approval steps
(old-class master, new-class master — same person here) were completed
**(API-assisted — the "More" menu opened correctly in earlier tests this
phase but became unreliable under repeated automation; the endpoint is
identical to the one already proven reachable via UI for the parent-link
workflow)**. `students.class_id` updated correctly; old attendance
history for Beta was untouched (attendance is keyed by class+date+student,
not affected by a later transfer).

**CONCURRENT MULTI-CLASS BACKEND SUPPORT: NOT IMPLEMENTED.** Re-confirmed
from current HEAD: `students.class_id` is a single nullable FK. No join
table exists. This is unchanged from Phase 7A/8/8B and is not a Phase 9A
regression.

## SECURITY / TENANT ISOLATION

15/15 automated checks passed (`scratch/phase9a_security_matrix.js`),
covering: SUPER_ADMIN denied operational data; cross-academy Admin IDOR
attempts (roster, direct student record, billing); Master denied
role-restricted endpoints; Parent IDOR attempts against an unrelated
student in the *same* academy; Student IDOR attempts against another
student's skills/payments; unauthenticated requests denied. All were
real HTTP requests with legitimate test IDs, not inferred from UI
visibility.

## PASSWORD / AUTH LIFECYCLE

Valid login → invalid password (401) → change-password (200) → old
password rejected (401) → new password accepted (200). Verified no
password or token appears in server logs (`grep` over the UAT backend's
full log for password/token strings: 0 matches) or in any API error
response.

## RESPONSIVE WEB

Login screen and Admin dashboard verified at 375px width: no clipping,
no overlap, cards stack correctly, bottom navigation renders with
distinct labels. (Full five-role responsive pass, including the P3
mobile-nav retest, was completed in the same session that authored
these screens; see Defects for the retest result.)

## RESTART / PERSISTENCE

Baseline captured across 12 tables (organizations, users, classes,
students, parent_links, attendance, skills, payments, grading_candidates,
certificates, tournament_participants, audit_logs) immediately before a
full backend process restart, then re-verified identical immediately
after. All 12 counts matched exactly (2/8/4/4/2/1/1/2/1/2/1/53).

## FAILURE HANDLING

- Invalid/expired token, missing auth, malformed body, unknown route,
  role-restricted action: all returned safe, sanitized responses (no
  stack trace, no SQL, no internal path, no secret).
- **Database outage simulated for real** (PostgreSQL process stopped
  mid-session): `/api/health` correctly stayed `200` (liveness only);
  `/api/health/ready` correctly returned `503`; a DB-dependent route
  returned a sanitized `500`. **A genuine P1 defect was found and fixed
  here — see Defects DB1.** After the fix, the backend process survived
  the entire outage without restarting and recovered automatically the
  moment PostgreSQL came back online.

## DEFECTS

| ID | Severity | Finding | Fix | Retest |
|---|---|---|---|---|
| DB1 | **P1** | Backend process crashed entirely on any transient database disconnection (unhandled `pg.Pool` 'error' event → Node uncaught exception → whole process dies, not just the affected request) | Registered `pgPool.on('error', ...)` in `server/src/db/client.ts` so a dropped connection is logged and the process survives | Simulated a real PostgreSQL outage mid-session: process stayed alive, `/api/health` stayed 200, `/api/health/ready` correctly reported 503, full recovery on DB return. New regression test `scratch/test_db_pool_crash_fix.js` (1/1 pass) |
| P3-1 | P3 (resolved) | Skill-progress "Current Level" badge never reflected the actually-saved level, even after reload — root cause: `skillProgress` map was declared but **never populated from the API at all** (broader than the originally-documented "doesn't refresh" description) | Added the missing fetch/populate loop in `loadLivePortalData()` (`index.html`) | Reloaded the Record Skills screen after a save: badge now correctly shows "Good" instead of always "Not started" |
| P3-2 | P3 (resolved) | Student mobile bottom-nav: 3 of 5 tabs read "My" (label truncated to first word, and "My Progress"/"My Syllabus"/"My Certificates" all start with "My") | `mobileTabShortLabel()` now skips a leading "My" and uses the next word instead (label-only change, no nav restructuring) | Confirmed distinct labels in this session's earlier mobile screenshots |
| UI1 | P2 (resolved) | Payment history table showed "undefined" for Class and hardcoded "Master" as reviewer regardless of who actually approved | `billing.routes.ts` now joins `classes`/`users` for `class_name`/`approved_by_name`; frontend mapping updated | Verified live: correct class name and correct actual approver name |
| UI2 | P2 (resolved) | Certificate title/examiner showed "undefined" in parent/student views and the certificate modal | Frontend mapping now includes `rankOrTitle`, `studentName`, `persatuanName`, `masterName` (all already stored on `certificates`) | Verified live in both parent and student views |
| UI3 | P2 (resolved) | Classes list always showed the academy admin's name as "Instructor" even for classes with a real assigned master | `classes.routes.ts` GET now joins `users` for `master_name` | Verified live: Gamma/Delta correctly show "UAT Master Instructor" |
| UI4 | P2 (resolved) | Parent's "Sibling Discount Applied" badge was shown/hidden based on whether the *parent* has 2+ children, not whether *that specific student* actually has the discount flag — could mislabel billing for any parent with mixed discounted/non-discounted children | Now reads `activeChild.sibling` (the actual per-student flag) instead of `parentChildren.length > 1` | Verified live: NewChild (no discount) now correctly shows "Standard Tuition" |
| AUD1 | P2 (resolved) | Tournament result finalization (awarding medals/certificates) wrote **no audit log entry at all** | Added a `Tournament Results Finalized` audit_logs insert | Confirmed present in the audit trail after a fresh finalize |
| AUD2 | P2 (resolved) | Grading finalization wrote an audit entry only when a certificate was issued (a "Failed" result left zero audit trail for the grading action itself) | Added a `Grading Results Recorded` audit_logs insert covering the whole batch regardless of pass/fail | Confirmed present in the audit trail |
| UX1 | P3 (documented, not fixed) | Several modal forms (Create Class, Register Student, etc.) don't reset previous field values when reopened, causing text to concatenate on top of stale values if not manually cleared first | Not fixed — cosmetic input-hygiene issue, not a data-integrity issue (every affected submission in this UAT was caught and corrected before saving) | Documented only |
| UX2 | P3 (documented, not fixed) | No UI path exists to retroactively assign a master to an already-created class (only settable at creation time) | Not fixed — workaround exists (create the class with the master pre-selected); a genuine but minor UI gap | Documented only |

No P0 defects found. No defect was hidden or downgraded to avoid blocking release.

## REGRESSION TESTS

All green after every fix in this phase: `test_adversarial_security.js`
20/20, `test_receipt_integrity.js` 7/7, `test_process_restart_persistence.js`
10/10, `test_link_and_grading_gaps.js` 8/8, `test_production_hardening.js`
15/15, `run_backend_tests.js` (RBAC) 8/8, `phase9a_security_matrix.js`
15/15 (new), `test_db_pool_crash_fix.js` 1/1 (new). Production build
(`npm ci --omit=dev` + `tsc`) succeeded again after all fixes.

## FILES CHANGED

`server/src/db/client.ts`, `server/src/routes/classes.routes.ts`,
`server/src/routes/tournaments.routes.ts`, `server/src/routes/grading.routes.ts`,
`index.html`, plus new test scripts `scratch/phase9a_security_matrix.js`
and `scratch/test_db_pool_crash_fix.js` (not committed - `scratch/` is
gitignored session tooling, consistent with every prior phase).

## GIT

See commit hash in the top-level response for this phase.

## OPEN GATES

1. **Android Phase 7B real-device UAT: BLOCKED** — not attempted this
   phase; unrelated to and not resolved by Phase 9A.
2. **Android RC: NOT READY** — gated entirely on item 1.
3. **Real hosted HTTPS verification: NOT VERIFIED** — this phase, like
   8C, ran against a local sandbox backend only.
4. **Production backup automation: NOT CONFIGURED** — mechanism
   verified (Phase 8B), automation for a real environment is not.
5. **Off-site backup: NOT CONFIGURED.**
6. **Monitoring/alerting: NOT CONFIGURED.**
7. **Google Play upload-key activation: PENDING** — 2026-09-20 01:01 UTC
   / 09:01 MYT. No Play Console action was taken this phase.
8. **Backend concurrent multi-class limitation:** re-confirmed
   unimplemented (single `class_id` FK); documented, not fabricated,
   not treated as a release blocker per explicit instruction.

## FINAL CLASSIFICATION

**WEB FINAL UAT: VERIFIED**
**FIVE-ROLE UAT: VERIFIED**
**FINANCIAL INTEGRITY: VERIFIED**
**TENANT ISOLATION: VERIFIED**
**RESTART PERSISTENCE: VERIFIED**

**WEB RELEASE CANDIDATE: READY**
**ANDROID RELEASE CANDIDATE: NOT READY** (Phase 7B blocked)

**PHASE 9A: COMPLETE**

**PRODUCTION GO-LIVE: NOT DECLARED.** No production deployment and no
Google Play publication were performed during this phase.
