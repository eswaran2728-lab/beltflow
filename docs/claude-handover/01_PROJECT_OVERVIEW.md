# 01 — Project Overview

> Handover audit date: 2026-11-10. Audited from a fresh clone of
> `https://github.com/eswaran2728-lab/beltflow` in a Claude Code cloud
> session. Everything below describes **what GitHub contains**, which is
> not the same as the "BeltFlow v2.0 / H00–H28" codebase described in the
> Antigravity status reports. Read §0 first.

## 0. Critical finding — two different codebases

| | GitHub (`eswaran2728-lab/beltflow`) | Reported "BeltFlow v2.0" (Windows PC) |
|---|---|---|
| Branch | `main` @ `595bd0f` (22 Sep 2026) | `feat/phase2-native-and-integration` @ `358a618` |
| Mobile app | Kotlin + Jetpack Compose (`app/`) | React Native / Expo with Google Stitch components |
| Web app | Single-file PWA (`index.html`) served by Express | Not described |
| Roadmap | "Phase" numbering (Phase 7B, 9B, 9C …) | H00–H28 task numbering |
| Governing PDF | **Not in the repository** | `BeltFlow_Complete_Structure_Implementation_and_Handoff_v2.pdf` |

Verified facts:

- Commits `358a618` and `9bd235a` do **not exist** on any GitHub branch, PR ref or tag.
- Branch `feat/phase2-native-and-integration` does **not exist** on GitHub.
- No file on any branch contains `StitchAppHeader`, `adminPersatuan`, an Expo
  `app.json`, `tournament_security_preflight`, Ed25519 signing, waitlists,
  equipment/merchandise, judging/appeals, video feedback, or Tamil/Bahasa
  localisation strings.
- No other repository in the account is a BeltFlow repository (checked with
  `list_repos`; GitHub code search returned 0 results even for known terms, so
  it could not be used as extra evidence).
- No Remote Control folder from the Windows PC was attached to the session, so
  the local BeltFlow project folder on the PC could not be read.

**Conclusion:** the entire v2.0 work (local commits and the uncommitted Admin
Persatuan / H24 changes) exists only on the Windows PC. It is not backed up.
See `06_GITHUB_SYNC_AUDIT.md` for the exact push procedure.

It is also possible that the Windows folder is a *different* Git repository
(different remote, or no remote). `git remote -v` must be run on the PC to
confirm.

## 1. What GitHub contains (verified)

| Area | Path | Stack |
|---|---|---|
| Backend API | `server/` | Node + Express 4, TypeScript 5.5, `pg` 8, PGlite 0.5 (embedded fallback), JWT (`jsonwebtoken` 9) |
| Database schema | `server/src/db/schema.sql` | 27 PostgreSQL tables, idempotent `CREATE … IF NOT EXISTS` migrations |
| Web client | `index.html` (≈300 KB), `support.js`, `sw.js`, `manifest.json` | Vanilla JS PWA, served by Express static |
| Android app | `app/` | Kotlin, Jetpack Compose (Material 3), Room, Navigation Compose; package `com.eswaran.beltflow`, versionName `1.0.15`, versionCode 16 |
| CI | `.github/workflows/build_aab.yml` | Android unit tests, debug APK, signed release (main only, secrets-gated) |
| DB tooling | `scripts/db/` | backup.sh, restore.sh, baseline_manifest.js, verify_restore.js |
| Regression scripts | `scratch/` (5 tracked, directory is gitignored) | Node E2E scripts against a running server |
| Release docs | `docs/*.md` | RC report, go-live checklist, UAT report, backup & recovery, staging |
| Design exports | `BeltFlow.dc.html`, `BeltFlow Mobile.dc.html`, `_ds/` | Static design references (mock data only) |

Older branches (`claude/beltflow-v2-rebuild`, PRs 1–4, etc.) contain an earlier
Next.js + Supabase version. `main` no longer contains Next.js, so the
`AGENTS.md` "This is NOT the Next.js you know" rule does not apply to `main`.

## 2. Roles (verified in `server/src/security/rbac.ts`)

Exactly five global roles: `SUPER_ADMIN`, `ADMIN_PERSATUAN`, `MASTER`,
`PARENT`, `STUDENT`. "Main Master" is a class assignment, not a role. Do not
add global roles.

## 3. Business workflows on `main` (verified from code + commit messages)

- Persatuan (organisation) onboarding by Super Admin; first-run `/auth/setup-admin` lock.
- Persatuan Admin creates classes and assigns/replaces the Master
  (`PATCH /classes/:classId/assign-master`). **Note:** on `main` the Admin
  creates classes; the v2.0 rule "Master proposes, Admin approves" is not
  implemented here.
- Student self-registration with class registration codes → assigned Master approves/rejects.
- Parent registration → parent-link request → approval; links are revocable.
- Training groups → schedules → dated sessions → per-session attendance (assigned Master only).
- Monthly dues ledger, per-student fee overrides, payment submission/approval,
  cash payments, audited payment corrections, sequential receipts.
- Grading events, candidate registration, scoring, certificate issuance and verification.
- Tournaments with results/medals; skills progress; in-app notices; audit log.
- Super Admin is excluded from child operational data by the access helpers.
