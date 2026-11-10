# 06 — GitHub Synchronisation Audit

## Repository

| Item | Value |
|---|---|
| Repository | https://github.com/eswaran2728-lab/beltflow |
| Visibility | **Public** |
| Owner | `eswaran2728-lab` (push access confirmed) |
| Default branch | `main` @ `595bd0f46598abc85dd14c94bb0dd440f0dc7063` (2026-09-22) |
| Handover branch | `claude/stoic-franklin-g59igo` (this session's branch; started at `595bd0f`) |
| Other branches | `ci-debug-log`, `claude/beltflow-v2-rebuild`, `claude/if-have-pause-activate-12d5kw`, `claude/security-check-realtime-app-l4qlfi` (older Next.js/Supabase era) |
| Tags | `beltflow-web-rc1` → `42f6591` |
| Reported v2 branch `feat/phase2-native-and-integration` | **Not on GitHub** |
| Reported commits `358a618`, `9bd235a` | **Not on GitHub** |

## Answers to the sync questions

| Question | Answer |
|---|---|
| A. On GitHub | Kotlin Android app, Express/TS backend, web PWA, docs (up to 22 Sep 2026) |
| B. Local-only commits | All v2.0 / H00–H25 commits (on the Windows PC) |
| C. Uncommitted | 7 Admin Persatuan screens, H24 tournament changes (Windows PC) |
| D. Untracked | `tournament_security_preflight.test.ts`; gitignored scratch regressions such as `test_monthly_dues.js`, `test_class_workflow_redesign.js`, `test_password_policy.js`, `test_class_fee_management.js` |
| E. Intentionally ignored | `.env*`, keystores, APK/AAB, DB dumps, `node_modules`, `server/dist`, PGlite data |
| F. H00–H25 on GitHub | **No** |
| G. Latest security fixes on GitHub | Security fixes up to `1baf4b1` (password policy) yes; H24 security work no |
| H. Stitch migration pushed | **No** |
| I. Database migrations pushed | Only `server/src/db/schema.sql` for main; v2 migrations no |
| J. Assets / config templates | `server/.env.example` present and sanitised; logos present |
| K. Can another computer reproduce v2.0 from GitHub | **No.** It can reproduce the main-branch backend/web/Android only |

## Security scan (current tree + full history)

- No live API keys, private keys, payment secrets, real DB passwords or JWTs found in the current tree.
- `scratch/restart_e2e_server_keep_data.js` contains a hard-coded **test-only** JWT secret. Harmless as long as it is never used in production.
- **History exposure:** `release.keystore.base64` was committed in `8845faf` (2026-09-08) and removed in `5eee18a` (2026-09-17). It remains readable in history of a public repo. `docs/` records that the Google Play upload key was rotated (`0d2b2dd`); confirm the old key is no longer trusted anywhere.
- IC/MyKid numbers, phone numbers and emails found are demo/mock values in design files and placeholders.
- Because the repo is **public**, consider making it private before pushing v2.0 (children's data model, security design and test fixtures).

## Commits pushed by this session

| Commit | Purpose |
|---|---|
| `ci: restore executable bit on gradlew…` | Mode-only fix; Android CI had been failing since 17 Sep |
| `docs: add Claude Code handover documentation` | This folder + `CLAUDE.md` pointer |

The final pushed SHA and local=remote check are in the takeover report given
in the chat, and can be re-checked with:

```bash
git fetch origin claude/stoic-franklin-g59igo && git rev-parse HEAD origin/claude/stoic-franklin-g59igo
```

## How to push the v2.0 work from the Windows PC (required next step)

Run in **PowerShell** inside the local BeltFlow project folder on the PC.
Nothing here deletes or rewrites anything.

1. Record the state and confirm the remote:

   ```powershell
   git rev-parse --show-toplevel
   git status --short --branch
   git remote -v
   git log -5 --oneline --decorate
   ```

   If `origin` is not `https://github.com/eswaran2728-lab/beltflow`, stop and
   tell Claude Code what it is. If there is no remote, add it:
   `git remote add origin https://github.com/eswaran2728-lab/beltflow.git`

2. Make a safety backup of the current commit and the uncommitted work:

   ```powershell
   git branch backup/pre-handover-2026-11-10
   git stash push --include-untracked -m "pre-handover backup"
   git stash apply
   ```

   (`stash apply` puts everything back while keeping a copy in the stash.)

3. Check that no secrets are about to be committed:

   ```powershell
   git status --short
   git diff --stat
   git ls-files --others --exclude-standard
   ```

   Make sure none of these are staged: `.env`, any Ed25519 private key,
   keystores, `*.apk`, `*.aab`, database dumps, real student photos/videos.

4. Commit the two pieces of unfinished work separately (WIP is fine — Claude
   Code will repair them next session):

   ```powershell
   git add server/package.json server/src/db/schema.sql server/src/routes/tournaments.routes.ts server/src/tests/tournament_security_preflight.test.ts
   git commit -m "wip(H24): tournament security changes (unverified, test runner hangs)"
   git add <path-to>/adminPersatuan
   git commit -m "wip(H28): Admin Persatuan Stitch screens (TypeScript errors outstanding)"
   ```

5. Add the governing PDF so future sessions can read it:

   ```powershell
   mkdir docs\governing
   copy "<path>\BeltFlow_Complete_Structure_Implementation_and_Handoff_v2.pdf" docs\governing\
   git add docs/governing
   git commit -m "docs: add governing BeltFlow v2 handoff PDF"
   ```

6. Push the branch (no force):

   ```powershell
   git push -u origin feat/phase2-native-and-integration
   git push origin backup/pre-handover-2026-11-10
   git fetch origin
   git rev-parse HEAD origin/feat/phase2-native-and-integration
   ```

   The two SHAs must match.

7. Start a new Claude Code session on `feat/phase2-native-and-integration`
   and ask it to continue the handover (TS repair, H24 test cleanup, screen
   inventory, full H00–H25 audit).

If the push is rejected as "non-fast-forward", do **not** force push — share
the error with Claude Code.
