# BeltFlow Production Release Checklist

This is a working checklist, not a guarantee. Items marked **(external)**
depend on infrastructure or Google Play Console action outside this
repository and cannot be verified by running code here.

## 1. Signing

**PRODUCTION SIGNING CLASSIFICATION: RESOLVED**

- Package: `com.eswaran.beltflow`
- Google Play App Signing: **ENABLED**
- Historical exposed key: **UPLOAD KEY ONLY** (confirmed in Play Console
  under Setup → App integrity → Upload key certificate; Google's own
  app-signing key was never exposed and was never touched by this
  rotation)
- Historical upload key: **COMPROMISED / RETIRED** — old SHA-1
  `FC:CF:02:7E:5F:CE:D9:2E:D8:F5:85:77:00:8B:D2:C3:09:B4:5E:9A`
- Replacement upload key: **REGISTERED WITH GOOGLE PLAY** — new SHA-1
  `86:30:9A:E7:F1:E3:1B:7E:4F:7D:68:4A:2B:61:90:13:AE:36:DD:95`, new
  SHA-256
  `B5:E8:5F:DC:29:59:A9:DC:9C:F4:E4:F9:DC:18:02:9C:CE:0F:1F:DA:6A:12:B1:06:29:95:F7:34:B0:1B:92:E4`
- Replacement activation: **2026-09-20 01:01 UTC / 2026-09-20 09:01 MYT**.
  Google Play will not accept any APK/AAB upload before this time - do
  not attempt a Play release until after activation.
- New private keystore lives outside this repository at
  `C:\Users\eswaranp\beltflow_signing_2026\beltflow-upload-2026.jks`
  (never committed; password stored in the user's password manager, not
  in any file in this repo).
- [ ] Set `RELEASE_KEYSTORE_BASE64` (base64 of the new `.jks`),
      `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`upload`), `KEY_PASSWORD` as
      GitHub Actions secrets before the next signed release build - never
      as repository files.
- [ ] Confirm `.github/workflows/build_aab.yml`'s `release-signing` job
      only runs on `main` and only signs when all four secrets are
      present.
- **Google Play release upload: TEMPORARILY WAITING FOR NEW KEY
  ACTIVATION** (see date above). Do not upload before then.

## 2. Android Release Configuration

- [ ] `RELEASE_API_BASE_URL` is set (build property or CI env var) to the
      real production API's HTTPS URL before building a release AAB/APK.
      A release build with this unset will crash immediately by design
      (`BeltFlowApiClient` - see `app/build.gradle.kts`) rather than
      silently talking to a developer's emulator loopback address.
- [ ] `versionCode` / `versionName` bumped.
- [ ] `./gradlew testDebugUnitTest` passes.
- [ ] `./gradlew assembleDebug` passes.
- [ ] `./gradlew compileReleaseKotlin` passes (release compiles without
      requiring signing secrets).
- [ ] Signed `bundleRelease` produced only via the CI `release-signing`
      job, never locally with the exposed/legacy keystore.
- [ ] **Phase 7B (mandatory, cannot be waived by Phase 8):** real Android
      device UAT - install, launch, all five roles, attendance, multi-class
      student behavior, session lifecycle, network failure, force-stop/
      relaunch. The emulator could not boot in this sandbox (no hardware
      acceleration / hypervisor available), so none of this has been
      runtime-verified yet.

## 3. Backend / Production Environment Variables

**Status: PARTIALLY VERIFIED** - all enforcement mechanisms below were
exercised for real in Phase 8C against a real production-mode process;
no *real* production host has had these variables set yet (external).

Set on the actual hosting platform, never committed (`server/.env.example`
documents these, with no values):

- [x] `JWT_SECRET` - required in production, server refuses to sign a
      token without it. **Verified (Phase 8C):** startup with it unset
      fails the first login attempt safely (sanitized client error, real
      error logged server-side).
- [ ] `DATABASE_URL` - a real managed PostgreSQL instance, not the
      embedded PGlite fallback used for local dev.
- [ ] `DATABASE_SSL` - **new in Phase 8C.** Leave unset for a managed
      provider (defaults to SSL-on in production). Set to `disable` only
      if your PostgreSQL instance genuinely has no SSL configured - Phase
      8C found the backend could not connect at all otherwise.
- [ ] `NODE_ENV=production`
- [ ] `PORT` if the platform requires a specific value.
- [x] `CORS_ALLOWED_ORIGINS` - the real web client origin(s).
      **Hardened in Phase 8C: production now refuses to start at all if
      this is unset** (previously silently allowed all browser origins -
      verified fixed).

## 4. Database

- [x] `server/src/db/schema.sql` is idempotent (`CREATE TABLE IF NOT
      EXISTS`, `ADD COLUMN IF NOT EXISTS`) and contains no destructive
      statements - confirmed safe to run against an existing database on
      every startup (Phase 8B).
- [x] **Backup/restore mechanism verified end-to-end (Phase 8B, commit
      `a850a4b`):** `pg_dump` → clean `pg_restore` → 19/19 table
      reconciliation → live application recovery test, all against a
      real PostgreSQL 16.4 instance. See [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md).
- [ ] **(external) Still NOT configured for any real environment:**
      automated production backup scheduling, encryption at rest,
      off-site/secondary-region copy, retention policy. Phase 8B/8C both
      ran the drill against disposable test infrastructure - this item
      remains open until a real production backup pipeline exists.
- [ ] Take a manual backup immediately before deploying any future schema
      change, even though current migrations are additive/non-destructive.

## 5. Web

- [ ] Production web deployment (Vercel or equivalent) points at the
      production API, not a local/dev backend.
- [ ] No debug banners, test tools, or test credentials reachable from the
      production build.

## 6. Regression (run before every release)

- [x] Backend: `test_adversarial_security.js` (20/20), `test_receipt_integrity.js`
      (7/7), `test_process_restart_persistence.js` (10/10),
      `test_link_and_grading_gaps.js` (8/8), `test_production_hardening.js`
      (15/15) - all still green as of Phase 9A, after the DB-pool-crash
      fix and all UI/audit-trail fixes.
- [ ] Android: `compileDebugKotlin`, `testDebugUnitTest` (26/26 baseline),
      `assembleDebug`.

## 6b. Production-Like Staging (Phase 8C)

**Status: PARTIALLY VERIFIED.** A real production-mode backend, real
PostgreSQL 16, and full five-role browser E2E against the production-built
web client were exercised - see [STAGING_DEPLOYMENT.md](STAGING_DEPLOYMENT.md).
Two real UI defects were found and fixed live (payment history / certificate
display showing "undefined" fields). **Not covered:** a real public
staging URL with actual HTTPS/TLS and reverse-proxy behavior - this
sandbox had no such environment to test against (see
STAGING_DEPLOYMENT.md §7, §16).

## 6c. Final Full-System UAT (Phase 9A)

**Status: VERIFIED (web).** A complete fresh-academy lifecycle was driven
through the real UI (five roles, class transfer, billing, grading,
tournaments, certificates, password lifecycle, security/IDOR matrix,
restart persistence, real database-outage recovery) - see
[FINAL_UAT_REPORT.md](FINAL_UAT_REPORT.md) for the full ledger and defect
list. One **P1** was found and fixed this phase: a transient database
disconnection previously crashed the entire backend process
(`server/src/db/client.ts` now handles `pg.Pool` connection errors instead
of letting them crash the process) - re-tested against a real
PostgreSQL outage, with a new regression test
(`scratch/test_db_pool_crash_fix.js`). Six P2/P3 UI/audit-trail defects
were also found and fixed. Android Phase 7B remains BLOCKED/OPEN,
unrelated to and not resolved by this phase.

## 7. Rollback

- [ ] Note the previous known-good git commit hash and, if applicable, the
      previous production AAB version code before deploying.
- [ ] **(external)** Confirm the hosting platform supports rolling back a
      backend deploy to the previous build without a database migration
      conflict (schema changes here are additive-only, so this should be
      safe, but has not been runtime-exercised).

## 8. Go-Live Gate

Do **not** proceed to publishing/go-live (Phase 9) until:

- ~~Signing-key identity is confirmed and remediated (§1).~~ **RESOLVED**
  - upload key rotated and registered with Google Play; new key is not
    valid for uploads until 2026-09-20 01:01 UTC (see §1).
- **Android Phase 7B: still BLOCKED / OPEN** - real-device UAT could not
  be completed in this sandbox (no physical device connectivity
  achievable - see the Phase 7B report). This is unrelated to and not
  resolved by Phase 8B/8C.
- Production environment variables are set on the real host, not assumed
  (§3) - the enforcement mechanisms are verified; a real host has not yet
  had them set.
- ~~A backup has been verified restorable at least once (§4).~~
  **Mechanism RESOLVED** (Phase 8B/8C, disposable test infrastructure) -
  production backup automation/off-site storage remains **NOT
  CONFIGURED** for any real environment.
- The current date/time is at or after the new upload key's activation
  time (§1) before any Play Console upload is attempted.
- A real public staging environment (with real HTTPS) has been stood up
  and this same UAT re-run against it (Phase 8C ran entirely against a
  local sandbox backend - see STAGING_DEPLOYMENT.md §16).
