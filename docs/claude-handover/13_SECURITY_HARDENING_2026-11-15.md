# 13 — Security hardening pass, 2026-11-15

This pass follows the access-control review in `12_SECURITY_REVIEW_2026-11-14.md`.
It covers the owner's 27-point checklist. Each item was checked against the
code, gaps were fixed with tests, and the result was attacked on a running
test server.

## Actions only the owner can take (do these first)

These secrets are in the **public git history**. Removing a file later does
not remove it from history, and anyone may already have copied them. Code
changes cannot fix this; the secrets must be replaced.

| # | What leaked | Where | What to do |
|---|---|---|---|
| 1 | A personal password next to the owner's e-mail address | `lib/auth.ts`, commits from 2026-06-22 until its removal on 2026-07-02 | Change that password everywhere it is used, today. Turn on two-step sign-in for the e-mail account and GitHub |
| 2 | The Android **release signing keystore**, with its default store/key password and alias in the old Gradle file | `release.keystore.base64`, added 2026-09-08, removed 2026-09-17 | Treat the key as compromised. In Play Console, request an upload-key reset (Play App Signing) and create a new keystore that is never committed. Update the GitHub Actions secrets |
| 3 | An old Supabase project address | old `.env.example` and web client | If the project is unused, delete it. If it is used, rotate its keys and check its row-level security |
| 4 | The old media link key and the development QR seeds | source code (already replaced) | Nothing to revoke: production now refuses to start without its own values. Generate fresh values for the first production deployment |

Rewriting git history was not done: the project rules forbid force-pushing,
and it would not un-leak anything already copied.

## The checklist

| Item | Before | Now |
|---|---|---|
| Proper authentication | JWT bearer tokens; role, academy and links re-read from the database on every request | Unchanged, plus sessions end when a password changes |
| Hide API keys | No real key in the current tree. One fake key in a test. History: see above | Production refuses to start without its own secrets; `.env` stays git-ignored and is now loaded by the server |
| Secure the database | Parameterised queries; tenant scoping | TLS required in production (`DATABASE_SSL=disable` refused); the embedded dev database is refused in production |
| Enforce HTTPS | HSTS header only | Plain HTTP gets 403 in production. The mobile app's production builds refuse an `http://` server |
| Hash passwords | PBKDF2-SHA256, 10,000 rounds; an unsalted SHA-256 fallback; comparison not constant-time | scrypt with per-password salt and constant-time comparison. Old hashes are upgraded at the next sign-in |
| Validate forms on the server | Mostly present | Sign-in refuses non-text input; request bodies over 200 KB get 413; malformed JSON gets 400 |
| Protect against XSS | Web client built pages with unescaped server text in 52 places and 54 inline handlers | All escaped or moved to `data-` attributes. API answers carry `default-src 'none'` and `nosniff`. Icon script pinned with an integrity hash |
| Log and monitor suspicious activity | Audit log of normal actions only | `security_events` table and log lines: failed sign-ins, lockouts, refused requests, rate limiting, blocked HTTP, password changes and resets, plus an ALERT at 30 refusals in 10 minutes. Super Admin reads it at `GET /api/v1/security/events` |
| Lock down admin routes | Fixed in doc 12 | Re-tested live with a parent account: all refused |
| Parameterised queries | Yes | Re-audited: dynamic SQL is built only from fixed column names |
| Check environment variables | Scattered checks | One startup check (`server/src/config/validateEnv.ts`) lists every problem and stops |
| Rate limiting | Sign-in only; memory unbounded | Whole-API limit per client (600/min, configurable) plus the stricter sign-in limit; memory bounded; account lock after 10 wrong passwords |
| Restrict CORS | Required in production | Also refused: wildcard or non-HTTPS origins |
| Security headers | nosniff, frame deny, referrer, HSTS | Adds `no-store` and CSP on API answers, removes `X-Powered-By`; full header set for the Vercel site |
| Secure session cookies | Not applicable: no cookies are used | Tokens live in the phone's secure storage (mobile) or `sessionStorage` (web) |
| CSRF protection | Not applicable: no cookies, so a forged cross-site request carries no session | Documented; CORS limits which sites may call the API |
| Password reset links expire | No reset existed ("contact your administrator") | Staff-issued one-time codes: stored hashed, expire in 30 minutes, work once, cancelled after 5 wrong tries, same academy only |
| Restrict upload types and sizes | 50 MB and type checked at request time; the upload endpoint buffered the whole body first | Type and size checked before buffering; stream stops at the limit; bytes re-checked at finalize |
| Verify prices and payments | Fixed in doc 12 (server-computed amounts, signed webhooks, staff-only confirmation) | Unchanged |
| Disable production debug mode | Most errors wrapped | 24 responses that echoed raw exception text on a 500 now use the safe wrapper; `DEBUG` set in production is reported |
| Update vulnerable dependencies | Server 2 (1 high), mobile 13 (3 high) | Server 0. Mobile 3 moderate, all in build tooling (`glob`/`minimatch`); fixing them needs a breaking upgrade |
| Remove unused packages | — | Removed `beltflow` (the server depended on the whole repository) and `ts-jest` |
| Check for exposed files | The server served the entire repository root | Explicit allow-list: only the web client's own files. `.vercelignore` limits the Vercel site the same way |
| Scan git history for secrets | — | Done over all 234 commits; results above |
| Revoke and replace compromised keys | — | Owner actions above |
| Thorough security review | Doc 12 | This document |
| Test the protections | — | See below |

## Test results

- **Live attack on a seeded test server** (`server/scripts/security-probe.js`): 38 of 38 protections held.
  - SQL injection, forged and unsigned tokens, admin routes as a parent, 12 exposed-file paths, headers, oversized and malformed bodies, account lock, both rate limits.
  - The security log recorded the attack and contained no password.
- **Backend:** 51/51 suites on embedded PGlite. The 11 security and auth suites also pass on PostgreSQL 16.
- **Mobile:** 57 suites / 638 tests; `tsc` 0 errors; eslint 0 errors; Android bundle builds.
- **Web client:** loads under the new Content-Security-Policy with 0 violations and 0 script errors in a headless browser.
- **Not tested:** no physical device and no production deployment were used.

## Limits and open items

1. **Web client CSP still allows inline scripts.** The whole client is one
   inline script with inline handlers. A strict policy needs the script moved
   to a file. Until then, the escaping is the XSS defence.
2. **Web client keeps its token in `sessionStorage`.** Any future XSS could
   read it. Moving to an HttpOnly cookie would need CSRF protection as well.
3. **Rate limits and lock counters are per server process.** With several
   instances, also rate-limit at the proxy.
4. **Password reset has no screen in the mobile app yet.** The server
   endpoints exist; staff can issue a code, but the app needs a screen for
   issuing and entering it.
5. **No alert delivery.** Alerts are written to the log and the table. Wire
   the `[security]` log lines to e-mail or chat alerts at the host.
6. **Open owner decisions from doc 12** are unchanged: video consent,
   certificate codes, online shop payments, payment provider secrets.

## New production settings

- `QR_ED25519_PRIVATE_KEY_SEED`, `QR_ED25519_PREVIOUS_SEED`: required, 32+ characters, all secrets different.
- `API_RATE_LIMIT_PER_MINUTE`: optional, default 600.
- `ALLOW_INSECURE_HTTP`: leave unset.

All are described in `server/.env.example`. Never commit real values.
