# 05 — Testing, Build and Release

All results below were produced in this session on 2026-11-10 against
commit `595bd0f` (plus the mode-only `gradlew` fix). Nothing was run against
production.

## Commands actually run

| # | Check | Directory | Command | Exit | Result |
|---|---|---|---|---|---|
| 1 | Install backend deps | `server/` | `npm ci` | 0 | OK |
| 2 | Backend TypeScript | `server/` | `npx tsc --noEmit` | 0 | 0 errors |
| 3 | Backend build | `server/` | `npm run build` | 0 | OK |
| 4 | Backend tests | `server/` | `npm test` (`node dist/tests/server_rbac.test.js`) | 0 | 1 suite PASS; exits by itself in ~3 s (no hang) |
| 5 | Android unit tests | repo root | via GitHub Actions | — | **Was failing since 17 Sep 2026** — see below |

## Not verified in this session

| Check | Reason |
|---|---|
| Mobile (Expo) tests, mobile TypeScript, Android/iOS Expo export | Expo project not on GitHub |
| Tournament security preflight (12 checks) | Test file not on GitHub |
| `scratch/*.js` regression scripts (5 tracked; ~10 more referenced in commit messages are gitignored) | Need a running server + seeded data; not re-run here |
| Android Gradle build locally | No Android SDK in the sandbox (CI covers it) |
| Lint | Root `npm run lint` is a placeholder `echo`; there is no real linter configured |

## Android CI defect (fixed in this session)

`gradlew` was committed with mode `100644` in `3639a41` (17 Sep 2026), so the
"Run Android Unit Tests" step failed in 0 seconds on every push (runs #76–#80,
all red). Fix: commit on `claude/stoic-franklin-g59igo` restoring `100755`.
The CI result of that push is recorded in `06_GITHUB_SYNC_AUDIT.md`.

## APK evidence

`release-testing/beltflow-v2.0-testing.apk` (211,974,000 bytes, SHA-256
`51BAB6EE…FA22`) is **not on GitHub** (APKs are gitignored, which is
correct). It could not be checked. Verify on the PC with:

```powershell
Get-FileHash "release-testing\beltflow-v2.0-testing.apk" -Algorithm SHA256
(Get-Item "release-testing\beltflow-v2.0-testing.apk").Length
```

Only previously recorded debug APK hash on GitHub: `docs/RELEASE_CANDIDATE_REPORT.md`
(Kotlin debug build, `1a556ab4…44d4`).

## Release gates

| Gate | Status | Evidence / what is needed |
|---|---|---|
| NATIVE-001 Physical Android | OPEN | No device evidence on GitHub; Phase 7B UAT open |
| NATIVE-002 Physical iOS | OPEN | No iOS project on GitHub; needs macOS/EAS + Apple account |
| CAM-001 QR camera | OPEN | No signed-QR implementation on GitHub |
| PAY-LIVE-001 Live payment | OPEN | No gateway integration; needs merchant accounts per Persatuan |
| DB-PG-001 Managed PostgreSQL | OPEN | Go-live checklist §4: not provisioned |
| RESTORE-001 Backup/restore | PARTIAL | Drill executed on test DB (`docs/BACKUP_AND_RECOVERY.md`); production automation not set up |
| VIDEO-STORAGE-001 | OPEN | No media storage on GitHub |
| AI-LIVE-001 / AI-SEC-001 | NOT APPLICABLE YET | H26 not started |

Web application: release-certified RC1 (tag `beltflow-web-rc1`) but go-live
blocked on infrastructure (hosting, domain/HTTPS, production DB, backups,
monitoring) per `docs/GO_LIVE_CHECKLIST.md` §22–24.
