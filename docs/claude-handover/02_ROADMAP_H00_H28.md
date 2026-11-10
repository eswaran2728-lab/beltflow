# 02 — Roadmap H00–H28

> Status rule used here: a task can only be marked VERIFIED COMPLETE when its
> source and tests are on GitHub and were checked. Reports from earlier agents
> are not evidence on their own.

## Summary

| Measure | Value |
|---|---|
| Tasks verified complete on GitHub | **0 / 29** |
| Tasks UNVERIFIED (reported done, source not on GitHub) | 26 (H00–H25) |
| Tasks NOT STARTED (per your brief) | 3 (H26, H27, H28) |
| Roadmap completion that can be proven from GitHub | **0 %** |
| Roadmap completion as previously *reported* | 26/29 ≈ 90 % (unverified) |

Why: the governing PDF, the H-task commits (`9bd235a` for H25, HEAD `358a618`)
and the Expo/Stitch mobile code are not in the repository. See
`01_PROJECT_OVERVIEW.md` §0.

Some *business capabilities* that overlap with H-tasks do exist on `main` in
the older Kotlin/Express/PWA architecture. They are listed as "related
capability on main" so the next session can compare once the v2.0 code is
pushed. They are **not** evidence that the H-task acceptance criteria are met.

## Task table

| ID | Task | Status | Related capability on `main` (different architecture) |
|---|---|---|---|
| H00 | Repository Discovery and Compatibility Map | UNVERIFIED | — |
| H01 | Native and Sync Readiness | UNVERIFIED | No offline SQLite queue in server; Android uses Room |
| H02 | Authority Relationships and Legacy Migration | UNVERIFIED | `coach_class_assignments`, `assignedMasterAccess()` |
| H03 | Master Verification | UNVERIFIED | Admin creates Masters (`POST /classes/masters`); no affiliation-request flow |
| H04 | Master-Created Class Approval | UNVERIFIED | Not on main: Admin creates classes directly |
| H05 | Student Application and Master Approval | UNVERIFIED | `/auth/register-student`, `/auth/student-registrations/:id/approve` |
| H06 | Master Class Workspace and Basic Rosters | UNVERIFIED | Coach portal, training groups |
| H07 | Permanent Handover and Temporary Substitution | UNVERIFIED | Assign/replace Master only; no temporary substitution or leadership history table |
| H08 | QR Attendance and Digital Pass | UNVERIFIED | No Ed25519 signing anywhere on main |
| H09 | Persistent Configurable Belts | UNVERIFIED | Belt fields on students/certificates |
| H10 | Scheduling and Membership Foundation | UNVERIFIED | `class_schedules`, `training_sessions` |
| H11 | Safety Notices and Acknowledgements | UNVERIFIED | `notices` table; no acknowledgement records |
| H12 | Grading, Readiness and Certificate Verification | UNVERIFIED | `grading_events`, `grading_candidates`, `certificates` |
| H13 | Payments, Receipts and Membership Renewals | UNVERIFIED | Manual/cash payments, receipts, dues ledger; no payment-gateway callbacks |
| H14 | Academy Setup, Imports and Essential Family View | UNVERIFIED | Setup wizard; parent portal; no import |
| H15 | Core Certification and Pilot Release Gate | UNVERIFIED | `docs/RELEASE_CANDIDATE_REPORT.md` (web RC1, tag `beltflow-web-rc1`) |
| H16 | Trials and Actionable Follow-Up | UNVERIFIED | — |
| H17 | Make-Up Classes and Waitlists | UNVERIFIED | — |
| H18 | Pauses, Returns and Controlled Transfers | UNVERIFIED | `class_transfer_requests` only |
| H19 | Lesson Plans and Family Hub Depth | UNVERIFIED | — |
| H20 | Learning Library, Performance and Rewards | UNVERIFIED | `skills`, `student_skills` |
| H21 | Private Video Feedback | UNVERIFIED | — |
| H22 | Parent-Master Messaging | UNVERIFIED | — |
| H23 | Growth Analytics and Authorized Exports | UNVERIFIED | — |
| H24 | Tournament Operations and Judging | UNVERIFIED | Basic `tournaments` + `tournament_participants`; no categories, rulesets, judges, score locking, appeals |
| H25 | Equipment and Merchandise | UNVERIFIED | — |
| H26 | Role-Aware Grounded AI | NOT STARTED | No `answerAuthorizedQuestion` anywhere on GitHub |
| H27 | Advanced Release Certification | NOT STARTED | — |
| H28 | Continuous Localization and Usability | NOT STARTED | No BM/Tamil strings on main |

## Official acceptance tests still to be met (from your brief)

- **H26:** `retrieval_cross_tenant_denied`, `document_instruction_cannot_override_policy`,
  `unknown_answer_admits_gap`, `no_auto_grading_or_payment`, `Super_Admin_no_child_data`.
- **H27:** `disabled_module_inaccessible`, `migration_restore_pass`,
  `worker_replay_safe`, `release_specific_native_E2E_pass`.
- **H28:** `Tamil_font_coverage`, `large_text_no_clipping`, `focus_order_usable`,
  `status_not_color_only`, `pending_approval_next_step_clear`.

The exact criteria must be copied from the governing PDF once it is added to
the repository (`docs/governing/`), not from this summary.
