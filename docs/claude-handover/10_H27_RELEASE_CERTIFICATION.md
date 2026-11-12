# 10 — H27 Advanced Release Certification: Evidence Record

> Date: 2026-11-10. Branch `feat/phase2-native-and-integration`.
> Governing PDF §23. Contract: produce R2/R3/R4 evidence independently.
> **Verdict: CONDITIONAL PASS.** Three of the four official acceptance tests pass on the embedded engine and on real
> PostgreSQL 16. `release_specific_native_E2E_pass` is **BLOCKED**: there is no physical device, and the sandbox has no
> hardware virtualisation for an emulator. H27 found and fixed **seven real defects** that the existing mocked and
> PGlite-only tests could not see (§4).

## 1. Official acceptance tests

| Test | Status | Evidence |
|---|---|---|
| `disabled_module_inaccessible` | **PASS** | `server/src/tests/release_certification_h27.test.ts` (in `npm test`). See below. |
| `migration_restore_pass` | **PASS** | `scripts/db/h27_migration_restore_rehearsal.js`: 26/26 checks on PostgreSQL 16.15. See below. |
| `worker_replay_safe` | **PASS** | `server/src/tests/worker_replay_h27.test.ts` (in `npm test`). See below. |
| `release_specific_native_E2E_pass` | **BLOCKED** | Needs a real Android device or iPhone, or an emulator host with virtualisation (§6). |

**`disabled_module_inaccessible` checks:**
- For each of R1, R2, R3 and R4, every later-release module returns 404 `MODULE_DISABLED` for unauthenticated callers and for all five roles.
- Core routes keep working in every release.
- Kill switches turn off a single module.
- Core modules cannot be switched off.
- An invalid release setting fails closed to R1.

**`migration_restore_pass` checks:**
- Upgrades from `595bd0f` (main) and `1faf876` (pre-H26 v2) start from data written by those versions' own code.
- Migrations are idempotent, and every original row is unchanged after the upgrade.
- First-time setup stays locked after an upgrade.
- Current test suites pass on the upgraded data.
- Schema changes are additive only.
- `backup.sh` → `restore.sh` → `verify_restore.js`: all 76 tables match by count and checksum.
- The server reports ready on the restored copy.

**`worker_replay_safe` checks:**
- Each path is fired 6 times concurrently, then again in sequence:
  - transfer activation
  - waitlist expiry
  - payment webhook: the same event 7 times, plus a retried event 4 times
  - offline attendance sync
- The final state must equal a single run.
- Passes on PGlite (serialised) and on PostgreSQL 16 (truly concurrent): 20/20 repeated runs.

## 2. Release modules and feature flags (`server/src/release/modules.ts`)

| Release | Modules (task) | Gate |
|---|---|---|
| R1 core | Auth, organisations, classes, students, attendance, billing, grading, certificates, curriculum, approvals, handover, payments, onboarding, notices, dashboard | Always on |
| R2 teaching & retention | trials (H16), bookings (H17), transfers/memberships (H18), teaching + family (H19), learning (H20), media (H21) | `moduleGate` |
| R3 events & commerce | messaging (H22), analytics (H23), tournaments (H24), commerce (H25) | `moduleGate` |
| R4 assisted | assistant (H26) | `moduleGate` (plus `AI_ASSISTANT_ENABLED`) |

**Settings:**
- `BELTFLOW_RELEASE=R1|R2|R3|R4`: unset means R4, today's behaviour; an unknown value means R1.
- `BELTFLOW_DISABLED_MODULES=key,key`: per-module kill switches.
- `GET /api/v1/release/modules`: public and tenant-free. The mobile app uses it to hide the Ask tab when the assistant is off.

**Staged rollout (PDF §25):**
1. Back up.
2. Deploy the additive schema and the server with `BELTFLOW_RELEASE` at the currently certified release.
3. Release the mobile build.
4. Raise the release, or remove a kill switch, after evidence.

**Rollback:**
- First: set the kill switch or lower `BELTFLOW_RELEASE` and restart. No data is touched.
- Then: deploy the previous code. This is safe because all schema changes since `595bd0f` and `1faf876` are additive (verified).
- Never drop new tables that hold real records.

## 3. Per-release evidence (independent)

Commands:
- Backend on the embedded engine: `cd server && npm run build && npm test`.
- Backend on PostgreSQL: each suite run with `DATABASE_URL` pointing at a fresh database on a local PostgreSQL 16.15 server.
- Mobile: `cd mobile && npx jest --runInBand`.

| Release | Backend suites (PGlite and PostgreSQL 16, fresh DB each) | Mobile suites | Result |
|---|---|---|---|
| R1 core | transaction_pool, server_rbac, attendance_sync, authority_relationships, master_verification, class_lifecycle, student_enrollment, master_class_workspace, master_handover, qr_pass_security, persatuan_curriculum, class_scheduling, student_safety_notices, grading_progression_h12, persatuan_payments_h13, academy_onboarding_imports_h14, core_pilot_certification_h15 | core screens, offline DB/sync, QR, auth, navigation | PASS / PASS |
| R2 | trials_retention_h16, trial_auth_001, makeup_waitlist_h17, booking_safety_h17, booking_expiry_001, membership_transfers_h18, transfer_auth_001, transfer_date_001, lesson_plans_family_hub_h19, sub_auth_001, learning_library_rewards_h20, media_feedback_h21, media_feedback_security_preflight | H16–H21 screens | PASS / PASS (media fixed, §4.1) |
| R3 | messaging_parent_master_h22, growth_analytics_h23, tournament_operations_h24, tournament_security_preflight, equipment_merchandise_h25 | H22–H25 | PASS / PASS (commerce fixed, §4.5) |
| R4 | assistant_grounded_ai_h26, assistant_gemini_provider_h26; live Gemini smoke 4/4 and red-team 13/13 (`09`) | assistantH26 (36 tests) | PASS |
| Cross-release | release_certification_h27, worker_replay_h27, postgres_type_compat_h27, db_init_concurrency_h27, no_response_inside_transaction_h27 | apiRouteContractH27 | PASS |

**Totals on 2026-11-10:**
- **Backend:** 42/42 suites on PGlite (`npm test`, exit 0, ~88 s) and 42/42 on PostgreSQL 16, each on a fresh database.
- **Mobile:** 42 suites / 444 tests; `tsc` 0 errors; `expo export` succeeds for Android and iOS.

### Load smoke (indicative only)

`server/src/tests/load_smoke_h27.ts` runs the real server process on PostgreSQL 16 with a synthetic Persatuan (5 classes, 200 students, 100 parents). 50 users for 30 seconds produced:

| Measure | Result |
|---|---|
| Requests | **26,400** (876 per second) |
| Errors | **0** |
| Worst p95 | **208 ms** (budget 500 ms) |
| Slowest endpoint | assistant (offline extractive provider) |

Limits of this test: a single sandbox machine, no network latency, and live Gemini (about 1 s per question) excluded.

### Privacy, media, messaging, scoring and commerce

These are covered by the R2 and R3 suites above, re-run on real PostgreSQL:
- H21 consent, signed URLs and magic bytes
- H22 enrolment gating and moderation
- H24 judge scope, locks, appeals and minor-data exclusion
- H25 stock races, late payment and tenant denial

The assistant's privacy controls are in `09`.

## 4. Defects found and fixed during H27

| # | Defect | Impact before the fix | Fix and test |
|---|---|---|---|
| 1 | Video finalize compared a PostgreSQL BIGINT (a string) with `!==` | **Every video upload failed on real PostgreSQL** | Compare as numbers; `postgres_type_compat_h27` (`17a2c1f`) |
| 2 | Database initialisation not shared across concurrent first requests | A fresh production server under traffic applied the schema many times; on PostgreSQL the first requests failed (duplicate key) | One shared initialisation promise, started at boot; `db_init_concurrency_h27` (`da7d96a`) |
| 3 | Mobile API client lacked the `/api/v1` prefix in 15 of 19 services | **Every H16–H26 screen got 404 on a real device**; mocked tests could not see it | `apiPath()` prefix plus the `apiRouteContractH27` contract test (`bd99bae`) |
| 4 | Mobile default port 3000 vs backend 4000 | Emulator builds pointed at the static file server | Default 4000 (`bd99bae`) |
| 5 | Commerce replied 201/200 before COMMIT | Intermittent "Order not found"; a failed commit could report success | Respond after commit; `no_response_inside_transaction_h27` guard (`a2e8bb1`) |
| 6 | A concurrent resend of the same sync mutation got CONCURRENT_MODIFICATION | False conflict shown to the Master | Acknowledge as synced (`04ea87d`) |
| 7 | A second variant of #6 surfaced as a raw constraint error | Error (with database text outside production) instead of "synced" | Acknowledge as synced when already applied (`d73937e`) |

`verify_restore.js` was also upgraded: it previously checked only 19 legacy tables. It now checks every table by count and content checksum.

## 5. Known gaps (not fixed in H27)

1. ~~**The notification outbox is never delivered.**~~ **Delivered in-app since 2026-11-12** (§9). Push/SMS/email still need a provider. Rows are written to `notification_outbox`, but nothing sends them. Families receive no push, SMS or email notifications yet.
2. ~~**Worker trigger routes are callable by any signed-in user.**~~ **Fixed 2026-11-12:** only Super Admin or the scheduler key (`BELTFLOW_WORKER_TOKEN`) may call them, and an in-process scheduler (`server/src/workers/scheduler.ts`) runs them every 5 minutes. See §8.
   - Affected: `POST /bookings/waitlist/sweep-expired` and `POST /transfers/activate-scheduled`.
   - Each call processes every Persatuan; only counts are returned.
   - Recommendation: run these on a scheduler, and restrict the routes to Super Admin or an internal token.
3. **27 older backend test files still end with `process.exit(0)`.** The H24, H26 and H27 suites close the database instead.
4. **The R1 web client (`index.html`) still calls `/tournaments`,** which is R3. In an R1-only deployment that tab would show "not enabled".
5. **Feature flags are global, not per tenant.** The PDF says "enable feature by tenant"; per-Persatuan flags are a follow-up.
6. ~~**Mobile hides only the Ask tab.**~~ Fixed in H28 (`11` §8): optional-module entry points follow the release modules. Other R2/R3 entry points still show and get "not enabled" from the server. Hiding them is H28 UI work.
7. **`attendance_sync` and `server_rbac` need an empty database** (one-time setup); this is a test-isolation limitation.

## 6. Open release gates after H27

| Gate | Status | Evidence / what remains |
|---|---|---|
| `DB-PG-001` | **PARTIAL** | All 42 suites, the upgrade and restore rehearsal, the replay concurrency test and the load smoke pass on **local PostgreSQL 16.15**. Still to do: repeat on the managed production PostgreSQL (Cloud SQL / RDS) with SSL. |
| `RESTORE-001` | **VERIFIED (local rehearsal)** | `backup.sh` → `restore.sh` → `verify_restore.js` (76 tables), server ready on the restored copy. Still to do: scheduled production backups and an off-site copy. |
| `NATIVE-001` | **OPEN / BLOCKS H27** | Install the latest build on a real Android phone (steps below). |
| `NATIVE-002` | **OPEN** | iPhone / TestFlight. |
| `CAM-001` | **OPEN** | QR scan with a real camera. |
| `PAY-LIVE-001` | **OPEN** | Live FPX/DuitNow merchant. |
| `VIDEO-STORAGE-001` | **OPEN** | Production object storage (local adapter only). |
| `AI-LIVE-001` / `AI-SEC-001` | **VERIFIED** | See `09`. |

### Steps to close `release_specific_native_E2E_pass` (human, with a device)

1. Rebuild the app from this branch, which now includes the `/api/v1` and port fixes; the old APK predates them:
   ```
   cd mobile && npx eas build --profile preview --platform android
   ```
   Or use `npx expo run:android` with a connected device.
2. Run the server on a reachable host. Set `EXPO_PUBLIC_API_URL=http://<host>:4000` for the build.
3. For each release, set `BELTFLOW_RELEASE` (R1, then R2, R3, R4), restart the server, then on the phone:
   - Log in as each role.
   - Check that the Ask tab appears only at R4.
   - Check that one feature per enabled module loads, and that disabled modules show "not enabled".
4. **R1 journeys:**
   - Master proposes a class → Admin approves.
   - Parent applies → Master approves.
   - QR attendance online and **offline (flight mode) → reconnect → sync**.
   - Grading → certificate verify.
   - Fee payment (sandbox).
5. Record the device and OS, build, commit, screenshots (synthetic data only) and results in this file.

**Rebuild-impact check:** the existing `release-testing/beltflow-v2.0-testing.apk` was built before defect #3 was fixed, so its H16–H26 screens would fail against a real server. Rebuild before device testing.

## 8. Follow-up fixes (2026-11-12)

Suite `server/src/tests/ops_payment_safety_followups.test.ts` (in `npm test`, 43 suites). Passes on PGlite and on PostgreSQL 16 (together with H13, H15, H17, H18, H27 release and worker-replay suites).

| Check | Problem before | Now |
|---|---|---|
| A | `POST /bookings/waitlist/sweep-expired` and `POST /transfers/activate-scheduled` process every Persatuan but any signed-in user could call them | Super Admin or header `x-beltflow-worker-token` = `BELTFLOW_WORKER_TOKEN` (16+ chars, timing-safe compare); everyone else 403 |
| B | Nothing ran the jobs on a schedule | `startBackgroundWorkers()` in `index.ts`: transfers, waitlist expiry, payment expiry every `BELTFLOW_WORKER_INTERVAL_MINUTES` (default 5); skips disabled modules; `BELTFLOW_WORKERS=off` to disable |
| C | Payment intent `expires_at` (30 min) never enforced; parent saw "pending" forever | Unpaid intents past the window become `EXPIRED` (worker, and on `GET /payments/intents/:id`). A genuine bank success webhook still settles an expired intent. Mobile shows "Payment link expired", warns that a bank payment already made will still produce a receipt, offers Start Again |
| D | A failure webhook after a success set the intent to `FAILED` while the receipt existed | Failure never overwrites `SUCCEEDED` |
| F | Money for dues already paid (second payment for the same months) was dropped silently and recorded `MATCHED` | Recorded `DISCREPANCY_AMOUNT` with "Refund or credit the payer"; dues never over-applied; visible in admin reconciliation |
| G | Any Admin Persatuan could read any Persatuan's payment intent (`GET /payments/intents/:id`) — tenant leak | Only the owning Persatuan's admin (plus the payer / linked parent / student access as before) |

**Owner decision (not changed):** the official H13 test starts several overlapping payments for the same months and expects each to succeed. Blocking a new payment while one for the same months is still pending would prevent most double payments, but changes that H13 behaviour. F makes any double payment visible for refund in the meantime.

Still open: push/SMS/email delivery (needs a provider and credentials; in-app delivery done, §9); `students.billing_status` is set to `Paid` on any settlement even if other months remain unpaid (existing behaviour).

## 9. In-app notifications (2026-11-12)

The 22 outbox event types are now delivered to a per-person inbox.

- **Server:** `services/notifications/deliver.ts` runs in the background scheduler. Recipients are resolved from database relationships (applicant, student and active linked parents, class leader, Persatuan admins, payer, thread participant); a user id in the payload is used only if the database confirms it. Super Admin never receives one; only active users do. Only display-safe params are copied (never free-text reasons, requested information, certificate tokens or message text). Idempotent per `(outbox_id, user_id)`; outbox rows become `PROCESSED`. Table `user_notifications`. API (own only): `GET /api/v1/notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`.
- **Mobile:** the home bell for Admin Persatuan, Master, Parent and Student shows a dot only for real unread notifications and opens an inbox (EN/BM/Tamil text per event type). Previously the dot meant "notices exist" or "pending items", and never lit on Admin.
- **Evidence:** `notification_inbox.test.ts` (server, 44 suites pass); `notificationInbox.test.tsx` (mobile, 52 suites / 609 tests). Real flows from 9 feature suites on PostgreSQL 16: all 22 event types delivered (33 events, 36 notifications), none to Super Admin, no private fields copied.
- **Not done:** push notifications to the phone's lock screen (needs Expo push tokens on devices and, for production, an Expo access token), SMS or email. The message event is already lock-screen safe (no message text).
