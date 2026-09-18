# BeltFlow Go-Live Readiness Checklist (Phase 9C)

This is the result of an actually-executed infrastructure/readiness
audit, not a theoretical plan. It separates what is genuinely verified
in this repository from what is genuine infrastructure work that has
not been provisioned anywhere yet. No production system was touched,
created, or modified while producing this document.

## 1. Release Scope

```
WEB RELEASE SCOPE:    INCLUDED
ANDROID RELEASE SCOPE: EXCLUDED / DEFERRED
```

Android is excluded from the initial production release because Phase
7B real-device UAT remains blocked and the Android RC is NOT READY.
This is unrelated to, and does not block, the web release.

## 2. Certified RC

- **Application baseline**: `9bb51df`
- **Phase 9B documentation commit**: `42f6591` (pushed to `origin/main`
  this phase)
- **RC tag**: `beltflow-web-rc1` → `42f6591` (pushed to origin this
  phase)
- Web Release Candidate status: **CERTIFIED** (see
  [RELEASE_CANDIDATE_REPORT.md](RELEASE_CANDIDATE_REPORT.md))

## 3. Production Hosting

**PRODUCTION HOSTING: NOT CONFIGURED.**

What exists in the repository today:

- `vercel.json` at the repo root — static-hosting configuration only
  (cache headers for `sw.js`/`manifest.json`/`assets/`, and a
  catch-all rewrite to `index.html` for the PWA). There is no `.vercel`
  project link committed (correctly — that's account-specific, not
  repo state), and no evidence in this repository of an actual linked/
  deployed Vercel project, custom domain, or environment variables set
  on a real account. This file describes *how* the static web client
  would be served if deployed to Vercel; it does not itself constitute
  a deployment.
- `.github/workflows/build_aab.yml` — Android CI only (unit tests +
  debug/release compile verification). It never touches signing
  secrets and has no relationship to backend/web hosting.
- No Dockerfile, docker-compose, Railway/Render/Fly.io config,
  Procfile, or any other backend-hosting descriptor exists in this
  repository.

**What must actually be provisioned before go-live** (none of this may
be invented or assumed):

| Component | Requirement |
|---|---|
| Web static hosting | A real provider (e.g. Vercel) project actually created and linked, serving `index.html`/`assets/`/`manifest.json`/`sw.js` per `vercel.json`, at a real domain. |
| Backend hosting | A real Node.js process host (e.g. Railway, Render, Fly.io, a VM, or a container platform) running `node dist/index.js` from the certified RC build, with `NODE_ENV=production`. |
| PostgreSQL provider | A real managed or self-hosted PostgreSQL 16-compatible instance, reachable via `DATABASE_URL`, separate from any development/staging/UAT database used during Phases 8/9. |
| Domain | A real registered domain (or subdomain) pointed at both the web hosting and the backend hosting (or a reverse proxy in front of both making them same-origin, per `STAGING_DEPLOYMENT.md` §1). |
| HTTPS/TLS termination | Provided by the chosen hosting platform (most PaaS providers terminate TLS automatically) or a reverse proxy in front of a self-hosted backend. |
| Environment-secret storage | The chosen hosting platform's own secret/environment-variable store (e.g. Vercel/Railway/Render project secrets) — never a file in this repository. |
| Deployment mechanism | Not yet decided/configured. Candidates: the hosting platform's git-integration auto-deploy, or a manual `git pull` + `npm ci --omit=dev` + `npm run build` + process restart on a VM. Must deploy the certified RC (`9bb51df`/tag `beltflow-web-rc1`), not an arbitrary branch tip. |
| Rollback mechanism | Whatever the chosen hosting platform provides for "redeploy previous build/release" (most PaaS platforms keep prior deploys); for a manual VM deployment, `git checkout <previous-good-commit>` + rebuild + restart. See §18 below. |

Until every row above is actually provisioned, this gate is **BLOCKING**
for go-live — no amount of application-level testing substitutes for it.

## 4. Production Database

**PRODUCTION DATABASE: NOT CONFIGURED.**

No real production PostgreSQL instance exists yet. All database work to
date (Phases 8B, 8C, 9A, 9B) used disposable test/UAT/RC databases
(`beltflow_uat`, `beltflow_rc`, etc.) on a portable local PostgreSQL
16.4 binary, or embedded PGlite for pure unit-test runs — none of these
are, or may be mistaken for, a production database.

Requirements before go-live:

- A real PostgreSQL instance (managed provider strongly preferred: it
  removes the "who administers PostgreSQL patching/backups" question
  entirely) — version 16.x to match everything already validated
  against 16.4.
- Credentials generated fresh for production, stored only in the
  hosting platform's secret store, never reused from any Phase 8/9 test
  database, never committed anywhere.
- TLS per the provider's own requirement — most managed providers
  require it (the default `DATABASE_SSL` behavior already handles
  this: SSL-on automatically in `NODE_ENV=production` unless
  `DATABASE_SSL=disable` is explicitly set for a provider that
  genuinely has no SSL, per `server/src/db/client.ts`).
- `DATABASE_URL` set only as a platform secret.
- Network access restricted to the backend host where the provider
  supports it (e.g. managed-provider IP allowlisting or private
  networking) — not left open to the public internet if avoidable.
- This production database must be a fresh, separate instance from any
  development/staging/UAT/RC database — never the same instance
  reused with data wiped, to avoid any risk of credential or data
  carryover.
- Schema initialization: none required as a separate manual step —
  `dbClient.init()` runs `runMigrations()` automatically on backend
  startup (idempotent, `CREATE TABLE IF NOT EXISTS`/`ADD COLUMN IF NOT
  EXISTS`, no destructive statements — re-confirmed in Phase 9B). The
  first production backend startup against a brand-new empty database
  is expected to create the full schema automatically.

No production database was created, modified, or connected to during
this audit.

## 5. Production Secrets

Required environment variables, determined from current HEAD
(`server/.env.example`, `server/src/app.ts`, `server/src/db/client.ts`):

| Variable | Required? | Behavior if missing in production |
|---|---|---|
| `NODE_ENV` | Yes, must be `production` | Enables all fail-closed checks below; without it, the process runs in permissive dev mode. |
| `DATABASE_URL` | Yes | Without it, the backend silently falls back to embedded PGlite on local disk — never acceptable for production (no durability guarantees appropriate for real customer data, single-process only). |
| `JWT_SECRET` | Yes | Startup does not crash immediately, but the **first** login/token-issuing call throws `FATAL SECURITY ERROR: JWT_SECRET environment variable is not defined` and returns a sanitized 500 — verified in Phase 9B against a real reproduction. |
| `CORS_ALLOWED_ORIGINS` | Yes | Production startup throws immediately (`FATAL SECURITY ERROR: CORS_ALLOWED_ORIGINS environment variable is not defined`) and the process never starts — verified in `server/src/app.ts` lines 26-40, re-confirmed live in Phase 9B. |
| `DATABASE_SSL` | Conditional | Only needed as an override (`disable`) if the chosen production PostgreSQL provider genuinely has no SSL — unlikely for a real managed provider; leave unset otherwise. |
| `PORT` | No | Defaults to 4000; set only if the hosting platform requires a specific port. |

Verified this phase:

- No secret is hardcoded anywhere in tracked source (re-confirmed via
  the Phase 9B secret scan, re-inspected this phase — no changes since).
- No production secret is committed. `server/.env.example` documents
  variable names only, with empty values.
- Secret storage mechanism: **not yet chosen**, because the hosting
  platform itself is not yet chosen (§3). Whatever platform is selected,
  its own project-level secret/environment-variable store is the only
  acceptable place for `JWT_SECRET`/`DATABASE_URL` — never a file in
  this repository, never a CI-visible plaintext value outside of the
  encrypted secrets a chosen CI provider offers.
- `JWT_SECRET` requirement is documented here and in
  `server/.env.example`.
- Production `DATABASE_URL` handling is documented here and in
  `docs/BACKUP_AND_RECOVERY.md`/`docs/STAGING_DEPLOYMENT.md`.

No real secret value is printed anywhere in this document or in this
session's output.

## 6. Real HTTPS / Domain Gate

```
HTTPS: NOT VERIFIED / BLOCKED UNTIL HOSTING
```

No production domain exists, so DNS, TLS certificate issuance, HTTP→
HTTPS redirect behavior, and secure API reachability cannot be verified
today — there is nothing deployed to point a browser at. Phase 8C
explicitly only exercised a local sandbox backend over plain HTTP; that
was never claimed to be equivalent to real HTTPS and remains un-superseded.

**Mandatory post-deployment HTTPS smoke checklist** (to run immediately
after the web + backend are actually deployed, before any real user
traffic):

1. `curl -I http://<production-domain>` → confirm a redirect (301/308)
   to `https://<production-domain>`, not a 200 served over plain HTTP.
2. `curl -I https://<production-domain>` → confirm `200`, and inspect
   the TLS certificate (`curl -v` or a browser padlock) for a valid
   chain, correct hostname, and non-expired validity window.
3. Confirm the web app calls the API only via a same-origin or
   explicitly-HTTPS absolute URL — no `http://` API calls from an
   `https://` page (mixed content), and no browser console
   mixed-content warnings.
4. Confirm `CORS_ALLOWED_ORIGINS` on the backend contains the exact
   production HTTPS origin (see §7) — an HTTP or wrong-host origin
   value here would silently break the deployed web app's API calls.
5. Confirm the backend's HSTS header (`Strict-Transport-Security`,
   already added in Phase 8C's security-headers work) is present on a
   real HTTPS response.

This gate cannot be satisfied by this audit — it can only be satisfied
by executing the checklist above against the real deployed
infrastructure, as part of the controlled go-live procedure in §19-20.

## 7. Production CORS

- Required variable: `CORS_ALLOWED_ORIGINS`, a comma-separated list of
  exact browser origins (scheme + host [+ port]), e.g.
  `https://app.beltflow.example` (no trailing slash, no path, no
  wildcard).
- **Verified fail-closed**: `server/src/app.ts` throws
  `FATAL SECURITY ERROR: CORS_ALLOWED_ORIGINS environment variable is
  not defined` and refuses to start in `NODE_ENV=production` if this is
  unset (re-confirmed live in Phase 9B against a real production-mode
  process).
- Production must never use `*` or otherwise reflect-any-origin — the
  current code path for a set value only ever configures the `cors`
  middleware with the exact allow-list supplied, never a wildcard.
- **The production web origin is not known yet** (no domain has been
  registered/provisioned — see §3, §6). `CORS_ALLOWED_ORIGINS`
  therefore remains **pending infrastructure configuration**; it must
  be set to the real production web origin at deploy time, not before.

## 8. Backup Automation Gate

```
PRODUCTION BACKUP AUTOMATION: NOT READY
```

Phase 8B proved the backup/restore *mechanism* end-to-end
(`pg_dump` → `pg_restore` → 19/19 table reconciliation → live recovery)
against a real, disposable PostgreSQL 16.4 instance — see
[BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md). That is proof the
tooling works, not proof that anything is scheduled anywhere. No
production database exists yet (§4), so there is nothing to schedule
backups for today.

Production backup policy (to configure once a provider is chosen):

- **Automatic scheduled backup**: prefer the provider's native
  automated snapshot/backup feature (e.g. a managed PostgreSQL
  provider's daily automated backups) as the primary mechanism — it
  requires no custom infrastructure to fail silently. Use
  `scripts/db/backup.sh` (already proven in Phase 8B) as a secondary,
  provider-independent `pg_dump` copy, run on a schedule via whatever
  the chosen platform offers for scheduled jobs (a platform cron
  feature, or a small scheduled CI job with only backup-target
  credentials, never full production credentials).
- **Retention**: at minimum, daily backups retained 7-14 days plus a
  weekly backup retained 4-8 weeks — exact numbers should follow the
  chosen provider's own tiering rather than being invented here.
- **Encrypted storage**: backups must be stored encrypted at rest —
  either the provider's own encrypted snapshot storage, or (for the
  secondary `pg_dump` copy) an encrypted object-storage bucket, never
  a plaintext file on a shared filesystem.
- **Access control**: backup storage must be reachable only by the
  operator's own restore tooling/credentials, never by the application
  itself or by anything with a public URL.
- **Restore procedure**: `scripts/db/restore.sh` (already proven in
  Phase 8B) against a real target — restore must always be rehearsed
  into a *new* database, never directly onto the live production
  database, until the restored copy is verified correct.
- **Backup failure visibility**: whatever schedules the backup must
  alert (not just log) on a failed/skipped run — a silently-failing
  backup job is equivalent to having no backups.

No fake cron job or placeholder schedule has been created to mark this
"done" — it genuinely is not configured, because there is no production
database yet for it to protect.

## 9. Off-Site / Failure-Domain Backup

```
OFF-SITE BACKUP: NOT CONFIGURED
```

A managed provider's own automated snapshots protect against most
day-to-day failure modes (bad migration, accidental row deletion within
the snapshot retention window) but do **not** protect against:

- Accidental deletion of the entire database/project through the same
  provider account that also holds the snapshots.
- The provider's own account, region, or service suffering an outage or
  compromise.
- Credential compromise of the account that also controls the
  snapshots (an attacker with account access can delete both the data
  and its backups).

**Recommendation**: in addition to the provider's native backups, run
the already-proven `scripts/db/backup.sh` `pg_dump` on a schedule and
ship the resulting encrypted archive to a *separate* cloud
account/storage provider (or at minimum a separate bucket/project under
different credentials) than the one hosting the production database
itself — this is the specific failure domain a single provider's own
snapshot feature cannot cover. This has not been provisioned; it is a
recommendation for the deployment procedure in §19, not a claim of
current state.

## 10. Monitoring / Alerting

```
external monitoring: NOT CONFIGURED
```

**Required for initial go-live** (minimum viable, must exist before
real user traffic):

- A public availability check hitting the production domain over
  HTTPS on a short interval (e.g. every 1-5 minutes) from an
  external service (a free-tier uptime monitor is sufficient to start).
- That same check calling `/api/health` (liveness) — alert if it stops
  returning `200`.
- A second check calling `/api/health/ready` (readiness, actually
  queries the database) — alert if it returns `503` for longer than a
  short grace window (a single transient blip is expected and already
  handled gracefully by the `pg.Pool` error-handler fix; a sustained
  `503` indicates a real outage).
- Process-level failure visibility: whatever the hosting platform
  offers for "the process crashed/restarted" (most PaaS platforms
  surface this natively in their own dashboard/alerts) — must be
  enabled, not left as an unconfigured default.
- An alert destination that a real person actually monitors (email,
  SMS, Slack/Discord webhook, etc.) — an alert with nowhere to go is
  equivalent to no monitoring.

**Recommended post-launch improvement** (valuable, not blocking for a
small initial launch):

- Centralized log aggregation (beyond the hosting platform's own log
  retention window).
- Dedicated error-tracking (e.g. Sentry-style exception aggregation)
  rather than relying on `console.error` output alone.
- Application-level metrics (request rate, latency, error rate by
  route) beyond basic uptime.

None of the required items above are configured today — there is no
production deployment for them to monitor yet. This is correctly
classified as a **blocking** gate for real user traffic, not merely a
nice-to-have.

## 11. Logging

Reconfirmed from current HEAD (no code changed this phase):

- **Startup**: `console.log`s for DB connection mode (`🔌 Connecting to
  remote PostgreSQL...` / `📦 Initializing embedded persistent
  PostgreSQL engine...`) and schema migration success — no secret value
  is interpolated into either message (verified by reading
  `server/src/db/client.ts` in full this phase).
- **Shutdown**: the existing graceful-shutdown handler (verified in
  Phase 8B's `test_process_restart_persistence.js` and re-confirmed in
  Phase 9B's SIGTERM test) logs the shutdown event, not any credential.
- **DB errors**: `server/src/db/client.ts`'s `pgPool.on('error', ...)`
  logs the raw `Error` object from `pg`, which is a connection-level
  error (e.g. "Connection terminated unexpectedly") — `pg` does not
  embed the connection string/password in these error objects; only the
  failure description and, at most, a host/port are present.
- **Route errors**: all 12 route files (per Phase 8C's audit, unchanged
  since) `console.error` the real underlying error server-side before
  returning a sanitized generic message to the client — none of these
  call sites log `req.body` wholesale (which could contain a password
  field on auth routes), only the caught `Error`.
- Re-confirmed by direct inspection this phase: no route or
  startup/shutdown code path logs `JWT_SECRET`, a password value,
  `DATABASE_URL`, or any other secret. `console.log`/`console.error`
  call sites were grepped across `server/src/` for `password`,
  `JWT_SECRET`, and `DATABASE_URL` identifiers used together with a log
  call — none found.

**Log retention/collection for production**: whatever the chosen
hosting platform provides by default (most PaaS platforms capture
stdout/stderr with some retention window, e.g. 7 days) is the minimum
starting point; shipping logs to a longer-retention or centralized
destination is the "recommended post-launch improvement" from §10, not
required to go live.

## 12. Production Security Checklist

Reconfirmed from the Phase 9B certification evidence (no code changed
since 9B; full suites were not re-run wholesale this phase — targeted
spot-checks only, per this phase's own instruction not to re-run huge
suites without a code change):

| Control | Status | Evidence |
|---|---|---|
| JWT secret enforcement | ✅ | Phase 9B: real reproduction, `FATAL SECURITY ERROR` on first token issuance without it. |
| Fail-closed CORS | ✅ | Re-inspected `server/src/app.ts` this phase (lines 26-40) — throws before `app.listen` if unset in production. |
| Tenant isolation | ✅ | Phase 9B security matrix (`test_phase9b_security_matrix.js`), 15/15, incl. Admin B denied Academy A data. |
| RBAC | ✅ | `run_backend_tests.js` RBAC suite, 8/8; Student denied org-create in the 9B matrix. |
| IDOR/BOLA protection | ✅ | 9B matrix: Parent→unrelated student, Student→unrelated student, Master→unauthorized academy all blocked. |
| Static file protection | ✅ | Phase 9B production-config regression: `/.env`, `/package.json`, `/app/build.gradle.kts`, `/server/src/security/crypto.ts` all 404. |
| Security headers | ✅ | Phase 9B: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security` all present, re-verified live. |
| Safe error responses | ✅ | JWT-unset test returned a sanitized 500, not a stack trace/raw error. |
| Rate limiting | ✅ (single-instance) | See §13 — present, but scoped to single-process; escalate if multi-instance. |
| Receipt uniqueness | ✅ | `payments_receipt_no_unique` partial unique index confirmed present in the 9B database RC regression; repeated payments produce distinct receipts. |
| Duplicate finalization protection | ✅ | Grading and tournament finalize-once, duplicate-409 behavior both re-confirmed in the 9B matrix. |

No huge suite was re-run in this phase since no application code
changed between 9B and 9C — this table cites the 9B evidence directly,
plus this phase's own direct code re-inspection of the CORS/JWT
enforcement paths and the logging grep above.

## 13. Rate Limiting Production Limitation

`server/src/middleware/rateLimit.ts` is an in-memory, per-process
sliding-window limiter (see the file's own header comment, unchanged
this phase). Implications:

- It tracks hits in a plain `Map` inside the Node process's memory —
  state is not shared across processes, and is lost on every restart.
- **If production runs a single application instance** (the expected
  initial deployment shape for a first go-live): this is **acceptable**
  as the sole rate-limiting layer for launch. A restart resets counters,
  but a restart also means the attacker's TCP connections were dropped
  anyway; the exposure window is negligible for a low-traffic initial
  launch.
- **If production runs multiple replicas/instances** (e.g. horizontal
  scaling behind a load balancer): this middleware's limit becomes
  effectively `max * instance_count` for a distributed attacker, since
  each instance tracks its own counts independently. In that
  configuration, an infrastructure-level limiter (reverse proxy/API
  gateway/WAF, or a shared store like Redis) becomes **necessary**, not
  merely recommended.

No redesign was performed this phase — the current implementation
already documents this limitation and requires no code change for a
single-instance initial launch, which is the intended initial
deployment shape given no hosting decision (and therefore no scaling
decision) has been made yet.

## 14. Super Admin Bootstrap

Verified this phase by direct inspection of `POST /api/v1/auth/setup-admin`
(`server/src/routes/auth.routes.ts`):

- The endpoint checks `SELECT id FROM users WHERE role = 'SUPER_ADMIN'`
  first; if any row exists, it returns `403 Security Exception: Super
  Admin setup is permanently locked after initialization` and performs
  no further action.
- This means the bootstrap window is **exactly one successful call,
  ever**, per database — it cannot be reopened, re-run, or used to
  create a second Super Admin later through this endpoint.
- No default password is embedded anywhere in this code path — the
  caller must supply `fullName`, `email`, and `password` in the request
  body; there is no hardcoded fallback credential.
- Also rate-limited (`authAttemptLimit`) like other auth endpoints.

**Safe first-production setup procedure:**

1. Deploy the certified RC to production with an empty, freshly
   provisioned database (no seed data).
2. Confirm zero rows in `users` (implicit — a brand-new database has no
   tables until the first backend startup runs migrations, and no rows
   until this step).
3. Call `POST /api/v1/auth/setup-admin` exactly once, over HTTPS, with a
   strong generated password — from a trusted operator's machine, not
   from a shared/public terminal, and not logged anywhere.
4. Immediately verify the call succeeded and returned a token; store the
   Super Admin credential in the operator's own password manager, never
   in this repository or in any chat/log.
5. Any subsequent call to `/setup-admin` will now correctly 403 — this
   is the "cannot remain openly exploitable after setup" property,
   already enforced by existing code, requiring no change.

No real production Super Admin account was created during this audit —
no production database exists yet to create one in (§4).

## 15. Production Data Policy

The production launch procedure must **not** carry over:

- Phase 8 test/staging data (`p8b-*@beltflow.test` accounts, `P8B
  Recovery Test Academy`, etc.)
- Phase 9 UAT data (any `p9a-*`/`p9b-*` test accounts or academies)
- Any sample/documented password from any phase's test fixtures
- Demo academies of any kind
- Any development-only user

Because production requires its own freshly provisioned database (§4),
this is naturally satisfied as long as the production database is never
seeded from, or copied from, any Phase 8/9 test/UAT/RC database — it
must start from an empty schema and receive only the single authorized
Super Admin bootstrap record (§14) plus whatever real academies/users
real customers create afterward.

## 16. Backend Multi-Class Limitation

- **Backend**: `students.class_id` is a single nullable foreign key to
  `classes(id)` — one active class per student, enforced by the schema
  (`ON DELETE SET NULL`, no join table). Re-confirmed by direct
  inspection this phase; unchanged since Phase 8B/9A/9B.
- **Simultaneous backend multi-class enrollment: NOT IMPLEMENTED.** A
  student's history across classes is representable only sequentially,
  via `class_transfer_requests` (old class → new class), never
  concurrently.
- **Android's local multi-class representation** (`classIdsJson` cache,
  covered in Phase 7A/8) exists in the Android client only, as a local
  convenience/history concept — it has no backend counterpart and is
  not mirrored into this schema. It is also moot for this release
  since Android is excluded from the initial production release (§17).
- No redesign was performed or attempted this phase, consistent with
  the Phase 9C scope prohibition on implementing backend multi-class
  architecture.
- **Product-facing claim requirement**: any user-facing copy, marketing
  material, or onboarding documentation for this release must describe
  a student as belonging to one active class at a time — it must not
  advertise simultaneous multi-class enrollment until this is actually
  implemented in a future phase.

## 17. Android Release Separation

```
ANDROID PHASE 7B:            OPEN
ANDROID RC:                  NOT READY
Google Play App Signing:     ENABLED
Replacement upload key:      REGISTERED
Activation:                  2026-09-20 01:01 UTC / 2026-09-20 09:01 MYT
```

Android remains fully separate from, and does not block, the web-only
production release. No Android publication of any kind (Play Console
upload, internal test track, production track) is authorized by this
document or this phase. The web release proceeds independently of
Android's Phase 7B status.

## 18. Rollback Plan (Actionable Runbook)

**Identify a bad deployment:**

- `/api/health` or `/api/health/ready` failing/degraded post-deploy.
- A spike in 5xx responses immediately following a deploy.
- Any of the §21 incident triggers firing shortly after a deploy.
- A post-deployment smoke test item (§20) failing.

**Application rollback procedure:**

1. Identify the previous known-good artifact: the last successfully
   deployed commit/tag before the bad deploy (for the very first
   go-live, that is simply "do not proceed past this deploy" — there is
   no prior production deploy yet to roll back to).
2. Re-deploy that previous commit through the same deployment mechanism
   used to deploy the bad one (platform's own "redeploy previous
   build" feature, or `git checkout <previous-good-commit>` + rebuild +
   restart for a manual VM deployment).
3. Re-verify `/api/health` and `/api/health/ready` both return healthy
   immediately after the rollback.
4. Re-run the relevant subset of the post-deployment smoke test (§20)
   for the affected area before declaring the rollback complete.

**Environment compatibility:** confirm the rolled-back commit uses the
same set of required environment variables as what's currently
configured on the host — re-check §5's table against the rolled-back
commit's own `server/.env.example` if a variable was ever added/removed
between the two commits (as of this phase, `9bb51df`/`42f6591` and the
immediately prior commit `3730640` use an identical variable set — no
drift to account for yet).

**Database compatibility:** `server/src/db/schema.sql` is additive-only
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) at every
commit relevant to this release — a rolled-back application build will
continue to run correctly against a database already migrated by a
newer commit's schema, since no column/table is ever removed.

**Health verification after rollback:** `/api/health` (liveness) and
`/api/health/ready` (readiness, real DB query) both returning `200`,
plus one successful login as a real (or the bootstrap Super Admin)
account, is the minimum bar before considering a rollback complete.

**Critical rule, stated explicitly:** application rollback is a code
deployment change only. It must **never** trigger a database restore.
Rolling back application code to an older commit does not require, and
must not cause, restoring an older database backup — the schema is
forward-compatible by design (additive-only), and restoring a backup
would destroy any real customer data written since that backup was
taken. Database restore is a wholly separate, much more serious
procedure (see [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)),
invoked only for actual data corruption/loss, never merely because an
application deploy needs to be undone.

## 19. Deployment Checklist (Sequence Only — Not Executed)

This sequence is provided for when production infrastructure is
actually provisioned and go-live is explicitly authorized. **None of
these steps were executed during this audit.**

1. Provision web static hosting (per `vercel.json`'s existing
   configuration) and backend process hosting.
2. Provision a fresh production PostgreSQL instance, separate from any
   development/staging/UAT/RC database.
3. Configure automated backups on the production database (provider-
   native primary + `scripts/db/backup.sh` secondary, per §8) before any
   real data is written.
4. Configure secrets (`NODE_ENV=production`, `DATABASE_URL`,
   `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `DATABASE_SSL` if needed) in the
   hosting platform's own secret store — never in a repository file.
5. Configure the production domain (DNS pointed at the web + backend
   hosts, or a reverse proxy making them same-origin per
   `STAGING_DEPLOYMENT.md` §1).
6. Configure HTTPS/TLS (platform-automatic for most PaaS providers, or
   a reverse proxy/cert manager for a self-hosted backend).
7. Set `CORS_ALLOWED_ORIGINS` to the exact real production HTTPS web
   origin (only possible once step 5/6 are done).
8. Configure monitoring/alerting per §10's required minimum, pointed at
   the real production domain, before any real user traffic.
9. Deploy the certified RC (commit `9bb51df`, tag `beltflow-web-rc1`) —
   not an arbitrary later branch tip — to both the web and backend
   hosts.
10. Confirm schema initialization ran automatically on first backend
    startup (`runMigrations()` — no manual migration step required).
11. Check liveness: `GET /api/health` → `200`.
12. Check readiness: `GET /api/health/ready` → `200` (confirms real DB
    connectivity).
13. Verify HTTPS per the §6 post-deployment checklist (redirect, valid
    cert, no mixed content).
14. Verify security headers are present on a real HTTPS response
    (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
    `Strict-Transport-Security`).
15. Bootstrap the Super Admin exactly once, per §14's procedure, over
    HTTPS, storing the credential only in the operator's password
    manager.
16. Run the five-role smoke test (§20) as far as roles can exist yet —
    initially only Super Admin exists; Admin/Master/Parent/Student
    smoke can only run once the Super Admin has created a real first
    academy (or a designated, clearly-labeled non-production-data test
    academy created and then deleted, if the operator chooses to
    smoke-test role flows before onboarding a real customer).
17. Verify DB persistence: restart the backend process once, confirm
    previously-created data (from step 16) is still present afterward.
18. Verify logs: confirm the platform's log stream shows the expected
    startup message and no secret value anywhere in it.
19. Verify backup status: confirm the provider's automated backup (or
    the scheduled `pg_dump` job from §8) has actually produced its
    first successful backup, not merely that it's "configured."
20. Begin controlled user onboarding only after every item above is
    green.

## 20. Post-Deployment Smoke Test (Mandatory — Not Run Against Production During This Audit)

Run this in full immediately after every production deployment
(including the very first one), before onboarding real users to a new
build:

- [ ] Homepage loads over HTTPS with no console errors.
- [ ] HTTPS redirect + valid certificate (per §6).
- [ ] `GET /api/health` → `200`.
- [ ] `GET /api/health/ready` → `200`.
- [ ] Super Admin login succeeds; dashboard loads.
- [ ] Admin login succeeds (once a first academy exists); dashboard and
      one core workflow (e.g. Classes tab) load correctly.
- [ ] Master login succeeds; Coach Portal loads; Record Skills workflow
      works and reflects immediately (no stale "Not started").
- [ ] Parent login succeeds; linked child and correct tuition/discount
      label display correctly.
- [ ] Student login succeeds; dashboard and bottom navigation (5
      distinct labels, no truncation collision) render correctly.
- [ ] `CORS_ALLOWED_ORIGINS` is the exact production origin — confirm no
      browser console CORS errors on any of the above logins.
- [ ] Security headers present on a real response
      (`curl -I https://<domain>/api/health`).
- [ ] A real database write (e.g. one skill update) is immediately
      readable back (write/read consistency) and still present after
      the DB-persistence check in step 17 of §19.
- [ ] Restart/persistence: safe to verify once, immediately post-deploy,
      before real customer data volume makes a restart disruptive —
      never rehearsed against a live database with real customer
      financial/grading data outside of a planned maintenance window.
- [ ] Certificate issuance verified using **designated non-production
      test data only** (a clearly-labeled test academy/student created
      and deleted for this purpose, or deferred until the first real
      academy naturally exercises this path) — never using invented
      "test" records left behind in the production database.
- [ ] Payment/receipt uniqueness verified the same way — designated test
      data only, never left behind as real-looking financial records in
      production.

This test is not to be run against production during this audit — it
is the mandatory procedure for the actual go-live event once
authorized, and for every deployment thereafter.

## 21. Incident / Rollback Triggers

Immediate rollback or escalation is required if any of the following
occur in production:

| Trigger | Immediate response |
|---|---|
| Authentication unavailable (no user of any role can log in) | Roll back immediately per §18; treat as a full outage. |
| Cross-tenant exposure (any evidence one academy can see another's data) | Roll back immediately; treat as a security incident, not just a bug — rotate `JWT_SECRET` if session-forging is suspected. |
| Database writes failing | Check `/api/health/ready`; if the database itself is unreachable, this may resolve automatically (Phase 9A/9B's pg.Pool fix keeps the process alive and retries) — but if writes fail with the DB reachable, roll back the application immediately. |
| Duplicate financial records (a receipt number collision, or evidence the uniqueness constraint was bypassed) | Roll back immediately; freeze billing operations until root-caused — this is a P0 by definition. |
| Health/readiness failure sustained beyond a brief grace window | Roll back immediately if tied to a recent deploy; otherwise escalate as an infrastructure incident (hosting/DB provider outage). |
| Severe 5xx rate (a clear spike correlated with a deploy) | Roll back immediately. |
| Secret exposure (any real `JWT_SECRET`/`DATABASE_URL`/password value appears in a log, response, or repository) | Rotate the exposed secret immediately, independent of and in addition to any rollback; treat as a security incident. |
| Any P0/P1 production defect discovered | Roll back immediately if the defect was introduced by the most recent deploy; otherwise fix-forward only after the same defect-ID/severity/repro/root-cause/minimal-fix/regression-test discipline used throughout Phase 9B. |

## 22. Go-Live Gate Matrix

| Gate | Status | Evidence | Required Action | Blocking? |
|---|---|---|---|---|
| WEB RC certification | CERTIFIED | `docs/RELEASE_CANDIDATE_REPORT.md`, tag `beltflow-web-rc1` → `42f6591` | None | No |
| P0 count | 0 | Phase 9B certification | None | No |
| P1 count | 0 | Phase 9B certification | None | No |
| Production hosting | NOT CONFIGURED | §3 | Provision web + backend hosting | **Yes** |
| Production database | NOT CONFIGURED | §4 | Provision fresh production PostgreSQL | **Yes** |
| HTTPS / domain | NOT VERIFIED / BLOCKED UNTIL HOSTING | §6 | Provision domain + TLS, run §6 smoke checklist post-deploy | **Yes** |
| Production CORS | PENDING (value depends on domain) | §7 | Set `CORS_ALLOWED_ORIGINS` to real origin at deploy time | **Yes** |
| Production secrets | MECHANISM DOCUMENTED, NOT YET SET ON A REAL HOST | §5 | Set real values in chosen platform's secret store | **Yes** |
| Backup automation | NOT READY | §8 | Configure provider-native + secondary backup on the new production DB | **Yes** |
| Off-site backup | NOT CONFIGURED | §9 | Ship secondary encrypted copy to a separate account/provider | Recommended, not strictly launch-blocking for a small initial release, but should not be deferred long |
| Monitoring | NOT CONFIGURED | §10 | Stand up external uptime + health/readiness checks with a real alert destination | **Yes** |
| Rollback | RUNBOOK DOCUMENTED, NOT YET EXERCISED AGAINST REAL PROD | §18 | Exercise once against the real host after first deploy | No (documented; verify post-deploy) |
| Post-deployment smoke plan | DOCUMENTED, NOT YET RUN (no production to run it against) | §20 | Execute in full at actual go-live | **Yes** (must run at go-live, not before) |
| Android scope | EXCLUDED / DEFERRED | §17 | None — does not block web | No |
| Multi-class limitation | DOCUMENTED, UNCHANGED | §16 | None — architectural, out of scope for this freeze | No |

## 23. Documentation

This document is new (`docs/GO_LIVE_CHECKLIST.md`).
`docs/PRODUCTION_RELEASE_CHECKLIST.md` has been updated in the same
commit as this file to reference it and record Phase 9C's actual
status. No secret value appears in either document.

## 24. Final Classification

```
WEB APPLICATION:              RELEASE-CERTIFIED
WEB PRODUCTION INFRASTRUCTURE: NOT READY
WEB PRODUCTION GO-LIVE:        NOT READY — INFRASTRUCTURE GATES REMAIN
ANDROID RELEASE:               NOT READY
PHASE 9C:                      COMPLETE
```

This is a valid, successful Phase 9C result: the application itself is
release-certified and requires no further code work to go live, but no
production infrastructure has been provisioned yet. Go-live remains
blocked strictly on the infrastructure gates marked **Blocking** in §22
— not on any application defect, since there are none open.

**Exact remaining blocking actions, in the order they must happen:**

1. Choose and provision production hosting (web + backend) — §3.
2. Provision a fresh, separate production PostgreSQL instance — §4.
3. Register/configure the production domain and its DNS — §6.
4. Configure HTTPS/TLS for that domain — §6.
5. Set `CORS_ALLOWED_ORIGINS` to the real production web origin — §7
   (depends on step 3).
6. Set all required secrets in the chosen platform's secret store — §5
   (depends on steps 1-4).
7. Configure production backup automation on the new database — §8
   (depends on step 2).
8. Stand up minimum-required external monitoring/alerting — §10
   (depends on steps 1-4).
9. Execute the deployment sequence in §19 end-to-end.
10. Run the mandatory post-deployment smoke test in §20.
11. Only after all of the above are green: begin controlled user
    onboarding.

Do not deploy production. Do not publish Google Play.
