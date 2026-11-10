# 03 — Backend, Database and API (GitHub `main`)

## Stack

- Express 4.19, TypeScript 5.5, Node 20 types. Entry: `server/src/index.ts` → `app.ts`.
- Database: `server/src/db/client.ts`
  - `DATABASE_URL` set → PostgreSQL via `pg.Pool` (SSL on by default in production, `DATABASE_SSL` override).
  - unset → embedded **PGlite** on disk (`PG_DATA_DIR`, default `./.beltflow_pgdata`). Tests use PGlite in a temp dir.
- Schema: `server/src/db/schema.sql`, applied idempotently at startup (no separate migration tool).
- Auth: JWT (`server/src/middleware/auth.ts`), PBKDF2-SHA256 password hashing (`security/crypto.ts`),
  12–128 char password policy (`security/passwordPolicy.ts`), in-memory rate limit on auth endpoints
  (`middleware/rateLimit.ts` — single-process only).
- RBAC: `security/rbac.ts` (permission matrix, 5 roles) + `security/access.ts`
  (`assignedMasterAccess`, class/student access helpers; assigned classes are re-derived per request).
- Production guard: refuses to start auth without `JWT_SECRET` when `NODE_ENV=production`.
- Not present on main: background workers, notification outbox, payment-gateway webhooks,
  private media storage, offline sync endpoints, Ed25519 QR signing, AI module.

## Tables (27)

organizations, users, classes, coach_class_assignments, students,
parent_student_links, class_transfer_requests, attendance_sessions,
attendance_records, invoices, payments, monthly_dues, monthly_due_payments,
training_groups, class_schedules, training_sessions, session_attendance,
notices, payment_corrections, grading_events, grading_candidates,
certificates, skills, student_skills, tournaments, tournament_participants,
audit_logs.

Every operational table carries `organization_id` (tenant). `payment_corrections`
is insert-only. Payments are recorded per Persatuan (no pooled merchant
account), but there is no live gateway yet.

## API inventory — 78 routes under `/api/v1`

"JWT" = `authenticateJWT`; "perm" = `requirePermission(...)`. Routes marked
"handler" do role/tenant checks inside the handler via `security/access.ts`.

| Method | Path | Guard |
|---|---|---|
| GET | /auth/setup-status | public |
| GET | /auth/registration-organizations | public |
| GET | /auth/registration-organizations/:orgId/classes | public |
| POST | /auth/setup-admin | public, rate-limited, one-time lock |
| POST | /auth/login | public, rate-limited |
| GET | /auth/me | JWT |
| POST | /auth/change-password | JWT, rate-limited |
| POST | /auth/register-student | public, rate-limited |
| GET | /auth/student-registrations/pending | JWT, handler |
| POST | /auth/student-registrations/:studentId/approve | JWT, handler (assigned Master) |
| POST | /auth/student-registrations/:studentId/reject | JWT, handler |
| POST | /auth/register-parent | public, rate-limited |
| POST/GET | /auth/parent-link-requests | JWT, handler |
| POST | /auth/parent-link-requests/:linkId/approve, /reject | JWT, handler |
| POST | /auth/parent-links/:linkId/revoke | JWT, handler |
| POST | /organizations | perm ORGANIZATION_CREATE |
| GET | /organizations | perm SUPER_ADMIN_MANAGE |
| GET | /organizations/:orgId | JWT, handler |
| PUT | /organizations/:orgId | perm PERSATUAN_EDIT_PROFILE |
| POST | /classes | perm PERSATUAN_MANAGE_CLASSES |
| GET | /classes/organization/:orgId | perm CLASS_VIEW |
| PATCH | /classes/:classId/fee | perm CLASS_MANAGE_FEES (assigned Master) |
| POST | /classes/masters | perm PERSATUAN_MANAGE_COACHES |
| PATCH | /classes/:classId/assign-master | perm CLASS_ASSIGN_COACH |
| POST/GET | /classes/:classId/groups | JWT, handler |
| POST/GET | /classes/:classId/schedules | JWT, handler |
| PATCH | /classes/schedules/:scheduleId | JWT, handler |
| POST/GET | /classes/:classId/sessions | JWT, handler |
| PATCH | /classes/sessions/:sessionId | JWT, handler |
| POST | /students | perm PERSATUAN_MANAGE_STUDENTS |
| GET | /students/me, /students/:studentId, /students/:studentId/sessions | JWT, handler |
| GET | /students/organization/:orgId | JWT, handler |
| PATCH | /students/:studentId/group | JWT, handler |
| POST | /students/:studentId/transfer-requests | JWT, handler |
| POST | /students/transfer-requests/:transferId/:decision | JWT, handler |
| GET | /students/transfer-requests/pending | JWT, handler |
| POST | /attendance/record | perm CLASS_MARK_ATTENDANCE |
| GET | /attendance/class/:classId | perm CLASS_VIEW_ATTENDANCE |
| GET | /attendance/session/:sessionId/roster | JWT, handler |
| POST | /attendance/session/:sessionId/mark | JWT, handler |
| GET | /attendance/student/:studentId/history | JWT, handler |
| GET | /billing/organization/:orgId, /billing/student/:studentId | JWT, handler |
| POST | /billing/monthly-dues/generate | JWT, handler (idempotent) |
| GET | /billing/monthly-dues/class/:classId, /student/:studentId | JWT, handler |
| POST | /billing/submit-payment | JWT, handler |
| POST | /billing/:paymentId/approve, /reject | perm CLASS_APPROVE_PAYMENT |
| POST | /billing/record-cash-payment | perm CLASS_RECORD_CASH_PAYMENT |
| PATCH | /billing/student/:studentId/fee | JWT, handler |
| POST | /billing/monthly-dues/correct, /billing/:paymentId/correct | JWT, handler (audited) |
| GET | /billing/corrections/student/:studentId | JWT, handler |
| POST | /grading | perm PERSATUAN_MANAGE_GRADING_EVENTS |
| GET | /grading/organization/:orgId | JWT, handler |
| POST | /grading/:eventId/register | JWT, handler |
| POST | /grading/:eventId/score | perm CLASS_SCORE_GRADING |
| POST | /certificates/verify | perm CERTIFICATE_VIEW |
| GET | /certificates/student/:studentId | JWT, handler |
| POST | /coaches | perm PERSATUAN_MANAGE_COACHES |
| GET | /coaches/organization/:orgId | perm PERSATUAN_MANAGE_COACHES |
| POST | /tournaments | perm PERSATUAN_MANAGE_TOURNAMENTS |
| GET | /tournaments/organization/:orgId | JWT, handler |
| POST | /tournaments/:id/results | perm PERSATUAN_MANAGE_TOURNAMENTS |
| POST | /skills/progress | JWT, handler |
| GET | /skills/student/:studentId | JWT, handler |
| POST | /notices | JWT, handler |
| GET | /notices/class/:classId, /notices/mine | JWT, handler |
| GET | /audit | perm AUDIT_LOG_VIEW_GLOBAL |

Implementation status of every route: present and compiled. Only the RBAC
regression (`server_rbac.test`) runs in `npm test`; the wider scratch suite
(reported 232/232 in commit `595bd0f`) is mostly gitignored and was **not**
re-run here — see `05_TESTING_BUILD_RELEASE.md`.

## Tournament security (H24 items) — status on main

Category eligibility, rulesets, assigned judges, idempotent/locked score
submissions, appeals and tie-breaking are **not implemented** on main. The
uncommitted H24 changes to `tournaments.routes.ts`, `schema.sql`,
`server/package.json` and `tournament_security_preflight.test.ts` are on the
Windows PC only and could not be reviewed or tested.
