# 08 — Claude Code: Start Here

## Read this first

1. As of 2026-11-10, **the BeltFlow v2.0 (H00–H28, Expo + Stitch) code is not
   on GitHub.** GitHub `main` holds an earlier Kotlin + Express + web PWA
   version. Before doing any H-task work, check whether `SYNC-001` in `07` is
   done: `git ls-remote origin | grep phase2`.
2. If the v2 branch is still missing, do not implement anything — ask the
   owner to follow `06_GITHUB_SYNC_AUDIT.md`.

## Repository

- URL: https://github.com/eswaran2728-lab/beltflow (public)
- `main`: `595bd0f` — do not merge into it without owner approval.
- Handover branch: `claude/stoic-franklin-g59igo`.
- Expected v2 branch (once pushed): `feat/phase2-native-and-integration`.

## Reading order

`01` overview → `06` sync → `07` pending work → `02` roadmap → `03` backend →
`05` testing → `04` mobile. Then the governing PDF in `docs/governing/` (once
added) — it overrides these notes on functional scope.

## Commands (main branch)

```bash
cd server && npm ci
npx tsc --noEmit
npm run build && npm test      # PGlite in a temp dir; no DB server needed
npm run dev                    # API + web client on :4000
```

Android: `./gradlew testDebugUnitTest assembleDebug` (needs JDK 17 + Android SDK).
Environment: copy `server/.env.example` to `server/.env`; never commit it.

## Non-negotiable safeguards

- Exactly five global roles: SUPER_ADMIN, ADMIN_PERSATUAN, MASTER, PARENT, STUDENT.
  Judging/inventory are scoped permissions, never new roles.
- Masters request affiliation → Admin Persatuan verifies; Masters propose
  classes → Admin approves; the class's current Master approves students.
- Every query is tenant-scoped by `organization_id`; re-check authority server-side.
- Super Admin does not see individual children's operational records.
- Payments belong to each Persatuan's own merchant; never infer settlement from
  redirects; ledgers are append-only.
- AI never promotes students or moves money.
- Never commit secrets, signing keys, real student data or media.
- No force push, no branch deletion, no merge to `main`, no production deploy
  without explicit approval.

## Workflow

INSPECT → UNDERSTAND → PLAN → TEST FIRST → IMPLEMENT MINIMAL → VERIFY →
REVIEW → COMMIT (separate logical commits) → PUSH → VERIFY REMOTE SHA →
REPORT → STOP. Never mark a task complete from a previous report; reproduce
its acceptance tests. Mock-only tests are not production evidence.

## Known defects

- Android CI red since 17 Sep 2026 (`gradlew` not executable) — fixed on the handover branch, not yet on `main`.
- Only one backend test is in `npm test`; most regressions live in gitignored `scratch/`.
- Rate limiting is in-memory (single process only).
- Root `npm run lint` is a placeholder.

## Next milestone

`SYNC-001` (push v2 from the PC), then `AUDIT-001`, `UI-001`, `H24-SEC-001`.
H26 is **not ready to start** until those are done and the owner approves.
