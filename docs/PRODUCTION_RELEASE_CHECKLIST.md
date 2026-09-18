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

Set on the actual hosting platform, never committed (`server/.env.example`
documents these, with no values):

- [ ] `JWT_SECRET` - required in production, server refuses to start
      auth without it.
- [ ] `DATABASE_URL` - a real managed PostgreSQL instance, not the
      embedded PGlite fallback used for local dev.
- [ ] `NODE_ENV=production`
- [ ] `PORT` if the platform requires a specific value.
- [ ] `CORS_ALLOWED_ORIGINS` - the real web client origin(s). If left
      unset, the server logs a warning and allows all browser origins
      (native Android calls are unaffected either way).

## 4. Database

- [ ] `server/src/db/schema.sql` is idempotent (`CREATE TABLE IF NOT
      EXISTS`, `ADD COLUMN IF NOT EXISTS`) and contains no destructive
      statements - confirmed safe to run against an existing production
      database on every startup.
- [ ] **(external)** A backup procedure exists for the production
      PostgreSQL instance (managed-provider automated backups, or a cron
      `pg_dump`) with a defined retention window. Nothing in this repo
      creates backups - the embedded PGlite mode used for local dev/tests
      is a durable local cache, not a production backup strategy.
- [ ] **(external)** A restore has actually been test-run at least once
      against a non-production database.
- [ ] Take a manual backup immediately before deploying any future schema
      change, even though current migrations are additive/non-destructive.

## 5. Web

- [ ] Production web deployment (Vercel or equivalent) points at the
      production API, not a local/dev backend.
- [ ] No debug banners, test tools, or test credentials reachable from the
      production build.

## 6. Regression (run before every release)

- [ ] Backend: `test_adversarial_security.js` (20/20), `test_receipt_integrity.js`
      (7/7), `test_process_restart_persistence.js` (10/10),
      `test_link_and_grading_gaps.js` (8/8).
- [ ] Android: `compileDebugKotlin`, `testDebugUnitTest` (26/26 baseline),
      `assembleDebug`.

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
- Phase 7B real-device UAT is complete (§2) - still blocked pending a
  physical Android device.
- Production environment variables are set on the real host, not assumed
  (§3).
- A backup has been verified restorable at least once (§4).
- The current date/time is at or after the new upload key's activation
  time (§1) before any Play Console upload is attempted.
