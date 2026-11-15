# 12 — Security review, 2026-11-14

Scope: everything merged in PR #5 (`595bd0f..06fd62d`, H26–H28, native app
integration, release hardening). Five parallel reviews covered:

- auth and tenant isolation;
- payments and commerce;
- media, messaging and imports;
- mobile, crypto and config;
- AI, notifications and workers.

Every finding below was reproduced against a running server before it was
fixed. Each fix has a test that failed first:

- `server/src/tests/security_review_commerce.test.ts`
- `server/src/tests/security_review_access.test.ts`
- the H21 media preflight
- the per-tenant flag test
- `mobile/src/__tests__/qrTrustedKeysSecurity.test.ts`
- `mobile/src/__tests__/devPanelReleaseGate.test.ts`

## Fixed

| Sev | Finding | Fix |
|---|---|---|
| High | A buyer could mark their own merchandise order PAID (`POST /commerce/orders/:id/confirm-payment`) and drive stock negative | The route is staff-only (Admin Persatuan / Master of the order's Persatuan). Only RESERVED orders are fulfilled, and the stock decrement is conditional |
| High | A client-supplied `paymentId` overwrote any `payments` row in any tenant (approve or refund tuition) via `ON CONFLICT DO UPDATE`. `forceExpired` came from the body | `paymentId` and `forceExpired` are ignored. Ledger rows are always new INSERTs carrying `order_id` (append-only) |
| High | The media link HMAC key fell back to a literal committed in this public repo. The storage routes need no login, and the expiry was attacker-chosen | `MEDIA_STORAGE_SECRET` is required in production (32+ characters); otherwise a random key is generated per process. The operation is signed into the token. Links live at most 1 h. Upload only while `PENDING_UPLOAD`. Playback re-checks deletion and consent in the DB. Only the uploader finalizes |
| High | The family timeline and transfer history let any Master (any Persatuan) and Super Admin read a child's full record | `studentAccess` applies; for history, Masters in the student's transfers also qualify. Super Admin is refused |
| High | Family summary showed a child's IC number, class and schedule on an *unapproved* link request | Only `ACTIVE` links |
| High | A Master could pull another Master's student into their own class through an enrollment application, then read medical data | A Master applies only for their own or unassigned students. Approval refuses `USE_TRANSFER` for a student active in another class |
| Med | Enrollment applications from another Persatuan's Admin/Master were accepted, and IC/phone were echoed | Staff limited to their own Persatuan; IC/phone no longer returned |
| Med | A Master application approval changed the role of another Persatuan's user | Such applications are refused; the role update is guarded |
| Med | A parent could order merchandise naming another tenant's child (name leaked). Super Admin's order list had child names | `studentId` is validated with `studentAccess`. The Super Admin list has no child data |
| Med | Any student could read private parent–Master threads; revoked guardians kept access | Participants and Admin only. A guardian needs an ACTIVE link to read or send |
| Med | Any member could revoke certificates | `CERTIFICATE_REVOKE` permission is required |
| Med | The public certificate check's rate limit could be bypassed with `X-Forwarded-For` | Uses `req.ip`. Forwarded headers are trusted only with `TRUST_PROXY_HOPS` |
| Med | The QR scanner trusted keys from development seeds that are public in this repo | Release builds trust no built-in key. Keys are fetched from the authenticated `/students/qr/verification-keys` and cached for offline use |
| Med | The login screen's developer panel (server override and test accounts) was in every build | Shown only in dev builds and testing builds (`EXPO_PUBLIC_BELTFLOW_TESTING_BUILD=1`, set by the CI testing APK). Production ignores a saved override |
| Med-Low | The per-tenant module switch did not apply to signed-out requests (public trial booking) | `moduleGate` applies the addressed Persatuan's setting |
| Low | Trial status changes, make-up booking lists and admin bookings were not scoped to the Persatuan. Super Admin could read and edit lesson plans. Any Master could delete any video | All scoped; Super Admin refused |
| Low | An unknown payment provider silently fell back to the sandbox | Production fails closed |
| Low | A payment intent's retry (idempotency) key returned another payer's intent and bank link to a same-Persatuan user who sent the same key | Another payer's key gets 409 `IDEMPOTENCY_KEY_CONFLICT` with no details (fixed 2026-11-15) |

## Open — owner decisions or later work

1. **Media consent is opt-out.** No record means a video is allowed, and no
   endpoint records a guardian's GRANTED consent. Making it opt-in needs a
   consent-capture screen for guardians first (product decision).
2. **Certificate codes are guessable** (`BF-XX-1000..9999`). The rate limit
   now holds, but high-entropy codes would change printed certificates.
3. **Merchandise orders have no online gateway path.** Payment is recorded by
   staff. Add a payment intent and verified webhook for orders before online
   merchandise sales.
4. **Before live payments:** the Persatuan Admin currently chooses the
   merchant webhook secret; move to provider-issued secrets in a KMS.
5. **Developer panel code is still in production JS bundles** (hidden). Its
   accounts are the synthetic seed (`seed_test_env.ts`), which must never run
   against production data.

## Production configuration added

- `MEDIA_STORAGE_SECRET`: 32+ random characters, required. The server will not start without it.
- `TRUST_PROXY_HOPS`: the number of reverse proxies in front of the server.

Both are documented in `server/.env.example`. Never commit real values.

## Verification (2026-11-14)

- **Backend:** 50/50 suites on embedded PGlite. The changed suites (17) also pass on real PostgreSQL 16.
- **Mobile:** 56 suites / 631 tests; `tsc` 0 errors; eslint 0 errors.
- **Not tested:** no physical device testing was done.
