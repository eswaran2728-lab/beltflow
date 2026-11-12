# 05 — Testing, Build Artifacts & Release Gates

> Handover date: 2026-11-10  
> Release Candidate Status: Internal Testing Build Verified

---

## 1. Automated Test Baseline

### Backend Integration Suites (`server/`):
* **Command**: `npm test` inside `server/`
* **Test Suites**: 42 test suites covering H00 to H27 (35 before H26; H26 added 2, H27 added 5)
* **Execution Engine**: Express routes with embedded PostgreSQL (`@electric-sql/pglite`) in isolated temporary directories
* **Pass Rate**: **42 / 42 passed (100%)** on PGlite, and **42 / 42 on real PostgreSQL 16.15** (each suite on a fresh database) — 2026-11-10 — ~73 s. H26 and H24-preflight suites close the DB and exit naturally; 27 older suites still end with `process.exit(0)` (follow-up).
* **Duration**: ~40 seconds

### Mobile Unit & Component Suites (`mobile/`):
* **Command**: `npm test` inside `mobile/`
* **Test Suites**: 51 test suites, 599 total tests (565 before navigation wiring; 40 / 400 before H26; 42 / 444 after H27; 477 after H28 first pass; 496 after core journeys; 551 after all screens)
* **Pass Rate**: **51 / 51 passed (100%)** — 2026-11-12
* **Note on QR Attendance Suite**: `src/__tests__/qrAttendance.test.tsx` passes 21/21 tests in isolation; under heavy single-threaded Jest runs, grant a timeout buffer if needed.

---

## 2. Verified Android Testing Build (Issue B Resolution)

A previous audit questioned whether a native React Native APK had been built. File and cryptographic inspection confirmed the binary is present:

* **File Location**: `release-testing/beltflow-v2.0-testing.apk`
* **File Size**: `211,974,000` bytes
* **SHA-256 Checksum**:
  `51BAB6EEB4879EEA99F60FE2346F89681F3C6678C1C89A1CE09ABF547BE6FA22`
* **Variant**: Debug/Internal Testing build with multi-architecture native ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`)
* **Package Identity**: `com.beltflow.app` / `com.eswaran.beltflow`
* **Distinction**:
  - The older root `BeltFlow.apk` (`2,781,757` bytes, 2026-09-12) was an earlier PWA web wrapper.
  - The `release-testing/beltflow-v2.0-testing.apk` is the full native Expo/React Native binary.

*Important*: Do not overwrite or delete this APK. It is preserved locally for device testing.

---

## 3. Release Gates Status

To preserve release safety, no gate may be marked closed based on simulated tests alone:

| Gate ID | Description | Current Status | Blocker / Requirement |
| :--- | :--- | :---: | :--- |
| `NATIVE-001` | Physical Android device runtime | **OPEN** | Blocks H27 native E2E. Rebuild first: the existing APK predates the mobile `/api/v1` fix (`10` §6) |
| `NATIVE-002` | Physical iOS device runtime | **OPEN** | Requires testflight / physical iPhone execution |
| `CAM-001` | Physical camera QR scanning | **OPEN** | Requires hardware camera verification with physical printed/screen QR |
| `PAY-LIVE-001`| Live FPX / DuitNow settlement | **OPEN** | Requires live Malaysian bank sandbox / merchant verification |
| `DB-PG-001` | Production PostgreSQL certification | **PARTIAL** | All 42 suites, upgrade/restore rehearsal, replay concurrency and load smoke pass on local PostgreSQL 16.15 (`10`); repeat on managed production PostgreSQL with SSL |
| `RESTORE-001`| Backup & disaster recovery drill | **VERIFIED (local rehearsal)** | backup.sh → restore.sh → verify_restore.js, 76 tables match (`10`); production backup schedule + off-site copy still needed |
| `AI-LIVE-001` | Live AI provider integration | **VERIFIED (2026-11-10)** | Live Gemini (`gemini-3.5-flash-lite`) smoke test passed 4/4 with synthetic data; see `09` §6. Use a paid-tier key before real student data |
| `AI-SEC-001` | AI prompt injection and privacy audit | **VERIFIED (sample, 2026-11-10)** | Live red-team 13/13 after fixing a Tamil injection finding; see `09` §7. Re-run on any model/prompt change |
