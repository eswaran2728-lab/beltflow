# 15 — App completion (2026-11-22)

Goal: no screen in the mobile app is a "Coming soon" placeholder, and no
screen shows made-up data. Every screen below reads the real server and has
loading, empty and error-with-retry states. All new text is in English,
Bahasa Malaysia and Tamil.

Nothing here was tested on a physical phone. Jest, the server suites and a
browser run against a seeded test server were used.

## Screens that were placeholders

| Role | Screen | Now shows | Server |
|---|---|---|---|
| Master | Students | The Master's own classes as chips; the roster with belt, group and status; name search; "show more". IC numbers are never shown | `GET /classes/organization/:orgId`, `GET /classes/:classId/students` |
| Parent | Children | The existing child cards; "Link another child" by IC with a required guardian tick and a privacy link; "My link requests" with every status in plain words | `POST/GET /auth/parent-link-requests` |
| Parent | Notices | Newest first; type, date, sender, message; Acknowledge per child, remembered by the server | `GET /notices/mine`, `POST /notices/:id/acknowledge` |
| Admin | Locations | Classes grouped by venue, with schedule, Master, status and capacity | `GET /classes/organization/:orgId` |
| Admin | Reports | Period chips; enrolment, trials, retention and money figures; "switched off" message when the analytics module is disabled | `GET /analytics/metrics?period=` |
| Student | Attendance | Summary ("2 of 4 sessions attended") and history | `GET /attendance/student/:id/history` |
| Student | Certificates | One card per real certificate; only active ones are marked verified; revoked ones say so; Share | `GET /certificates/student/:id` |
| Super Admin | Persatuan management | List with counts, search, suspend (reason required, confirmation) and reactivate; feature switches | `GET /organizations`, `PUT /organizations/:id/status` |
| Super Admin | Platform audit | 24-hour security summary, recent security events, platform audit entries | `GET /security/events`, `GET /audit` |

`RolePlaceholderBase` keeps a `comingSoon` flag (default off). No screen uses it.

## Made-up data removed

- Student certificates: the fake `BF-CREDENTIAL-ACTIVE` card, the fake
  `BF-PENDING-EVAL` card on the home screen, and a "Download PDF" button that
  only showed an alert. Certificates now have a real Share action (name,
  code, date). The greyed "Certificate Pending" button is gone.
- Headers: nine Admin screens said "PERSATUAN DOJANG"; the Student home said
  "PERSATUAN DOJANG (SELANGOR)"; the header default said "(SAMPLE)". Headers
  now look up the person's own Persatuan name (`useOrganizationName`) and
  otherwise say "BeltFlow Academy".
- Student pass: it carried the user id instead of the student id, and the
  phone built the QR itself with an empty signature, so a Master's scanner
  would have refused it. The pass now shows the server-signed QR from
  `GET /students/:id/digital-pass`, kept in secure storage for offline use
  until it expires, and removed on sign-out.

## New features

- **Password reset by code (mobile and web).** An Admin creates a one-time
  code for a Master, parent or student in their own Persatuan; a Super Admin
  for a Persatuan Admin. Staff name the account by e-mail. The person enters
  e-mail, code and new password on the sign-in screen ("Forgot password? Use
  a reset code" on the web). Codes are hashed, last 30 minutes, work once and
  are cancelled after 5 wrong tries (unchanged server rules). An unknown
  e-mail and an account outside the staff member's scope get the same answer.
- **Staff privacy-request handling on mobile.** Admins and Super Admins see
  "Requests to handle" in Privacy and my data: requester, type, due date,
  overdue mark, details; Mark as done (deletion asks first) or Refuse (a
  reason is required). The server decides which requests each one handles.

## Server changes

- `POST /auth/password-reset/issue` also accepts `{ email }`.
- `GET /auth/parent-link-requests` now answers a parent with their own
  requests in every state (it answered 403 before). Only the child's name is
  added.
- `GET /notices/mine` adds `acknowledged_by_me` and
  `acknowledged_student_ids`.
- `GET /analytics/metrics` honours `period` for totals that happen over time
  (trials by date, approved transfers, money collected, discounts). Figures
  that describe today (active students, capacity, outstanding fees, pauses)
  do not change with the period. Periods start at midnight Malaysia time. An
  unknown period becomes `current_month`. The response adds
  `metadata.periodStart`.
- `PUT /organizations/:orgId/status` (Super Admin only, audited, reason
  required to suspend). `GET /organizations` adds class, active-student and
  Master counts (numbers only, no names).
- `GET /audit` also lists "Organization Status Changed".

New suites: `superadmin_persatuan_status`, `app_completion_gaps`; e-mail
checks added to `security_hardening`.

## Open points for the owner

- The suspension reason is stored in the audit log as typed. Ask staff not to
  write personal details there, or say if it should not be stored.
- Notice titles come from the notice type; "Important" is shown for
  cancellations and schedule changes. Notices sent by a Master show the
  Master's e-mail as the sender (existing server behaviour).
- Admin Locations shows capacity, not the number of students per class (the
  class list has no student count).
- BM and Tamil text needs a native speaker's review, as before.
- Not tested on a real phone: pull to refresh, the camera scanner with the
  signed pass, Share.
