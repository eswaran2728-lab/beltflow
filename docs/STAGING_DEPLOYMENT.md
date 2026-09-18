# BeltFlow Staging Deployment

This documents an actual executed Phase 8C staging run - a real
production-mode backend, a real PostgreSQL 16 server, and real browser
E2E against the production-built web client - not a theoretical plan.
See the Phase 8C report for the full evidence trail. This was run
entirely inside a single local sandbox (no public hosting provider was
provisioned); see §16 for exactly what that does and doesn't prove.

## 1. Architecture

- Single Node.js/Express process (`server/`) serves both the JSON API
  (`/api/v1/...`) and the static PWA (the repo root - `index.html`,
  `/assets`, `manifest.json`, `sw.js`) from the same origin. The web
  client's API calls are relative (`/api/v1`), so it must be served from
  the same origin as the API in this topology (or behind a reverse proxy
  that makes them appear same-origin).
- PostgreSQL via `DATABASE_URL` (the `pg` driver). No ORM; hand-written
  parameterized SQL throughout `server/src/routes/`.
- Build: `tsc` compiles `server/src/**/*.ts` to `server/dist/`; the
  runtime (`npm start` → `node dist/index.js`) needs only the
  dependencies in `server/package.json` `dependencies` - `devDependencies`
  (including `typescript` itself) are never required at runtime.
  Verified in this drill: a clean `npm ci --omit=dev` install still ran
  the built `dist/` correctly.

## 2. Environment Variables

| Variable | Required in production? | Notes |
|---|---|---|
| `NODE_ENV` | Yes (`production`) | Enables `JWT_SECRET`/`CORS_ALLOWED_ORIGINS` enforcement and suppresses verbose error messages. |
| `DATABASE_URL` | Yes | Real PostgreSQL connection string. Without it, the backend falls back to an embedded PGlite engine - fine for local dev, never for staging/production. |
| `JWT_SECRET` | Yes | Startup fails closed (throws on first signing attempt) if unset in production. |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated browser origins. **Startup now fails closed** (throws immediately, before listening) if unset in production - this was hardened during this phase; it previously fell back to allowing any origin. |
| `DATABASE_SSL` | No (new this phase) | `require` / `disable` / unset. Defaults to SSL-on in production. **Real finding from this drill**: a self-hosted/staging PostgreSQL without SSL configured could not be reached at all until this override existed - see the Phase 8C report's defects. |
| `PORT` | No | Defaults to 4000. |
| `PG_DATA_DIR` | No | Only used in the PGlite (no-`DATABASE_URL`) fallback. |

## 3. Secret Handling

- No secret is ever committed. `server/.env.example` documents variable
  names only.
- This drill's staging JWT secret was generated with `openssl rand -hex 24`
  and written to a file outside the repository - never printed to any
  log, report, or command echoed back in this session's output.
- Rotate the staging JWT secret and staging DB credentials independently
  from production's - they must never be shared.

## 4. Build Procedure

```bash
cd server
npm ci --omit=dev   # runtime dependencies only - what actually ships
npm install         # add back devDependencies (typescript etc.) to build
npm run build       # tsc -> dist/, plus copies schema.sql into dist/db/
```

Verified in this drill: build succeeds, and the resulting `dist/` runs
with only the `--omit=dev` dependency set installed (devDependencies are
not a runtime requirement).

## 5. Deployment Procedure (as exercised in this drill)

```bash
NODE_ENV=production \
DATABASE_URL="postgres://<user>@<host>:<port>/<staging_db>" \
DATABASE_SSL=disable   # only if your staging PostgreSQL has no SSL configured \
JWT_SECRET="<strong random secret, from your secret store>" \
CORS_ALLOWED_ORIGINS="https://staging.beltflow.example" \
PORT=4900 \
node dist/index.js
```

A real hosting provider (Railway, Render, Fly.io, etc.) would set these
as platform-managed environment variables/secrets rather than shell
exports - the variables themselves are unchanged either way.

## 6. PostgreSQL Setup

- This drill provisioned a real, standalone PostgreSQL 16.4 server
  (portable binaries, no installer) and created a dedicated
  `beltflow_staging` database - never reusing the Phase 8B recovery-test
  database.
- Schema is applied automatically on first query via the app's own
  `runMigrations()` - no separate migration step to run. Confirmed
  idempotent and non-destructive (Phase 8B).
- A managed provider's PostgreSQL almost always requires SSL
  (`DATABASE_SSL` unset, i.e. defaulting on, is correct there); a
  self-hosted instance without SSL configured needs `DATABASE_SSL=disable`
  - this exact scenario is what this drill hit and fixed (§2).

## 7. HTTPS/TLS

**HTTPS: NOT VERIFIED (no public/reverse-proxy staging environment
exists in this sandbox).** This drill ran the backend as plain HTTP on
localhost - there was no TLS-terminating reverse proxy or public DNS
name to test against, and no certificate warnings could be meaningfully
checked. A real staging deployment must sit behind HTTPS (a platform's
built-in TLS, or a reverse proxy like Caddy/Nginx/Cloudflare) - the
`Strict-Transport-Security` header is already sent in production mode
(verified) so it takes effect the moment real HTTPS is in front of it,
but that has not itself been exercised.

## 8. CORS

- `CORS_ALLOWED_ORIGINS=https://staging.beltflow.local` was set; verified
  via direct HTTP requests: the configured origin received
  `Access-Control-Allow-Origin`, an arbitrary unauthorized origin did not.
- Verified production now **fails to start at all** if this variable is
  missing (previously silently permissive) - this is the fix made this
  phase.

## 9. Health Checks

- `GET /api/health` - liveness only (process is up), does not touch the
  database. Always returns 200 if the process is running, even if the
  database is completely unreachable.
- `GET /api/health/ready` - **new this phase**. Actually queries the
  database; returns 200 `{"status":"ready"}` when reachable, 503
  `{"status":"not_ready"}` otherwise. Verified against both a working and
  a deliberately-broken (bad credentials) database connection. Use this
  one for load-balancer/orchestrator routing decisions, and `/api/health`
  for liveness/restart decisions - restarting the process won't fix a
  database outage.

## 10. Logging

- Startup, shutdown, and migration steps log to stdout/stderr.
- **Fixed this phase**: most route handlers previously caught and
  sanitized errors for the client but never logged the real error
  server-side at all - there was no way to diagnose a production failure
  from logs. All 12 route files now `console.error` the real error
  before returning the sanitized client response. This is exactly what
  surfaced this drill's `DATABASE_SSL` defect (§2) - without it, the
  first production-mode connection failure would have been invisible.
- No secret (password, JWT, connection string) is included in any log
  line produced by this codebase - verified by triggering real
  auth-failure and DB-failure error paths and inspecting the log output.

## 11. Backup Dependency

Phase 8C does not re-verify backup/restore - see
[docs/BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) (Phase 8B). Status
carried forward unchanged: mechanism verified end-to-end, but production
backup automation, encryption at rest, and off-site storage are not yet
configured for any real environment (including this staging drill -
this staging database has no backup at all; it is disposable test
infrastructure).

## 12. Rollback

**Application rollback** (independent of the database):
- Deploy the previous known-good git commit/build. Since the schema is
  additive-only (Phase 8B) and this phase made no destructive schema
  change, an older application build can safely run against the current
  database schema - it simply won't use newer columns/tables.
- Never assume this holds for every future change - re-verify additivity
  before rolling back application code across a release that changed the
  schema.

**Database rollback** (a distinct, higher-risk action):
- Never roll back the database just to undo a bad application release -
  that discards real data written since the bad release went out.
- Database rollback (restoring an older backup) is only appropriate for
  actual data corruption/loss, and only via the drill in
  `docs/BACKUP_AND_RECOVERY.md` §14, into a clean target first.

## 13. Security Checks (this drill's results)

| Control | Result |
|---|---|
| Production CORS fails closed if unset | PASS (fixed this phase) |
| Production JWT signing fails closed if unset | PASS (pre-existing, re-verified) |
| Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS) | PASS (added this phase) |
| Static file exposure (`.env`, `.git`, backend source, keystore, root `package.json`, `build.gradle.kts`) | PASS (root `package.json`/`build.gradle.kts` fixed this phase; rest pre-existing) |
| Rate limiting on login | PASS - 20 requests/15min then 429 (pre-existing, re-verified) |
| Error responses leak no internals | PASS |
| RBAC / tenant isolation (9 cross-role/cross-academy checks) | PASS |
| Dependency audit (`npm audit --omit=dev`) | 0 vulnerabilities |

## 14. Staging UAT

Full five-role browser E2E was performed against the production-built
web client (SUPER_ADMIN, ADMIN, MASTER, PARENT, STUDENT) - see the Phase
8C report's five-role matrix and critical business flow. Two real UI
defects were found and fixed live during this drill (payment history
showing "undefined" class / hardcoded "Master" reviewer regardless of
actual approver; certificate title/examiner showing "undefined"). One
minor (P3) mobile label-truncation issue was found and documented, not
fixed (see the Phase 8C report's Defects table).

## 15. Known Limitations

- No public staging URL / reverse proxy / TLS was exercised - see §7.
  This is a genuine gap versus a real staging environment: HTTPS
  behavior, real-world CORS interaction with a browser enforcing it, and
  reverse-proxy header forwarding are unverified.
- Backend `students.class_id` remains a single nullable FK - no
  concurrent multi-class support at the database level. Android's local
  multi-class cache is a client-side concept only (Phase 7A/8/8B).
  Unchanged and out of scope for this phase.
- Windows-hosted sandbox: `taskkill` cannot deliver a real SIGTERM to an
  already-detached background process (no controlling console); the
  graceful-shutdown code path itself was verified separately via Node's
  own child-process signal handling, which does work cross-platform.
- No external log aggregation, uptime monitoring, alerting, or error
  tracking is configured - see the Phase 8C report's Observability
  section.
- In-memory rate limiting is per-process; a multi-instance production
  deployment needs an infrastructure-level limiter in front of it too
  (documented in Phase 8, unchanged).

## 16. Go-Live Prerequisites

Do not go live until, in addition to
[docs/PRODUCTION_RELEASE_CHECKLIST.md](PRODUCTION_RELEASE_CHECKLIST.md):

- A real public staging environment (actual hosting provider, real
  domain, real TLS certificate) has been stood up and this same UAT
  re-run against it - this drill proves the *application* is
  production-configuration-correct, not that a specific hosting
  provider's network/TLS/CORS integration works.
- Android Phase 7B (real-device UAT) is complete - still BLOCKED,
  unrelated to and not resolved by this phase.
- Production backup automation is configured and a restore has been
  verified against it (Phase 8B drill was against disposable test
  infrastructure, not a real production backup pipeline).
