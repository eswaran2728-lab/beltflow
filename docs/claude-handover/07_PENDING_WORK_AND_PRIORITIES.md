# 07 — Pending Work and Priorities

Execution order is top to bottom. Nothing below H26 may start without the
owner's approval.

| ID | H-task | Priority | Description | Impacted files | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| SYNC-001 | all | **P0** | Push the v2.0 branch, uncommitted work and gitignored regression scripts from the Windows PC (see `06` §"How to push") | whole v2 repo | Owner at PC | `git rev-parse HEAD` = remote branch SHA; `358a618` visible on GitHub |
| SYNC-002 | all | P0 | Add governing PDF to `docs/governing/` | new | SYNC-001 | PDF on GitHub |
| SEC-001 | — | P0 | Decide whether repo stays public; confirm old upload keystore (history `8845faf`) is revoked | repo settings | Owner | Recorded decision |
| AUDIT-001 | H00–H25 | P1 | Re-run this audit on the v2 branch: per-task evidence, tests, commits | all | SYNC-001/002 | Every task classified with evidence |
| UI-001 | H28 (reconciliation) | P1 | Fix ~27 TS errors in 7 Admin Persatuan screens without placeholders | `adminPersatuan/*` | SYNC-001 | Mobile `tsc` 0 errors; mobile tests still pass |
| H24-SEC-001 | H24 | P1 | Reproduce 12 tournament security checks; fix hang by closing DB pools/servers/timers (no `process.exit`) | `tournaments.routes.ts`, `schema.sql`, `tournament_security_preflight.test.ts` | SYNC-001 | Tests pass and process exits naturally |
| TEST-001 | — | P1 | Track the gitignored `scratch/` regression scripts properly (move to `server/src/tests/` or un-ignore) and wire into `npm test` | `scratch/`, `.gitignore`, `server/package.json` | SYNC-001 | CI runs the full suite |
| CI-001 | — | P1 | Confirm Android CI green after `gradlew` fix; add backend `npm test` job | `.github/workflows` | — | Green run on branch |
| UI-002 | H28 | P2 | Full screen inventory + Stitch migration backlog | mobile | AUDIT-001 | Inventory doc |
| H26 | H26 | P2 (after approval) | Role-aware grounded AI | new | AUDIT-001 | 5 official acceptance tests |
| H27 | H27 | P3 | Advanced release certification | — | H26 | 4 official acceptance tests |
| H28 | H28 | P3 | Localisation and usability | mobile | UI-002 | 5 official acceptance tests |
| GATES | — | P3 | NATIVE-001/002, CAM-001, PAY-LIVE-001, DB-PG-001, RESTORE-001, VIDEO-STORAGE-001 | infra | Owner actions | See `05` |
