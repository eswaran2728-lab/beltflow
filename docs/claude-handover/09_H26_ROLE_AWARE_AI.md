# 09 — H26 Role-Aware Grounded AI: Evidence Record

> Completed: 2026-11-10 on `feat/phase2-native-and-integration`.
> Contract (governing PDF §23): `answerAuthorizedQuestion(actor, query, context) -> answerWithSources`.
> Status: **CONDITIONAL PASS**. All official acceptance tests pass with **mocked/offline providers**.
> No live AI provider has been integrated or tested (gate `AI-LIVE-001` remains open).

## 1. What was built

| Layer | Files | Purpose |
|---|---|---|
| Contract and types | `server/src/assistant/types.ts`, `index.ts` | `AnswerWithSources`, provider-neutral `AssistantProvider` |
| Scope and retrieval | `server/src/assistant/retrieval.ts` | Server-side scope resolution before any read; tenant-scoped, published-only sources; ranking |
| Policy | `server/src/assistant/policy.ts` | Fixed policy text; action and medical-advice refusal; evidence neutralising; output checks; ID/phone redaction |
| Providers | `server/src/assistant/providers.ts` | Default offline **extractive** provider; `setAssistantProvider()` hook for a live provider |
| Limits and audit | `server/src/assistant/limits.ts` | Rate limit, per-Persatuan and per-user daily token budgets, feature flag, minimal audit |
| Service | `server/src/assistant/service.ts` | `answerAuthorizedQuestion` |
| API | `server/src/routes/assistant.routes.ts` | `POST /api/v1/assistant/ask`; knowledge-source registry |
| Schema | `server/src/db/schema.sql` (appended) | `ai_knowledge_sources`, `ai_audit_events` |
| Mobile | `mobile/src/screens/shared/AssistantScreen.tsx`, `services/assistantService.ts`, `i18n/assistantStrings.ts`, five role navigators | "Ask" tab for every role |

### What each role can retrieve

| Role | Sources | Explicitly excluded |
|---|---|---|
| SUPER_ADMIN | Platform totals, Persatuan directory, platform knowledge sources | Any student, class or tenant record; any `studentId`/`classId`/`organizationId` context returns 403 |
| ADMIN_PERSATUAN | Academy settings, class statistics, approval-queue counts, H23 growth metrics, published syllabus and lessons, own-org and platform knowledge sources | Individual student records (aggregate only in v1); other tenants |
| MASTER | Classes currently led (checked with `assignedMasterAccess`, so expired or ended leadership is excluded), rosters (name and belt only), upcoming sessions, lesson plans, published syllabus and lessons | IC numbers, phone numbers, private Master notes, classes not currently led |
| PARENT | Each verified linked child: progress, attendance, schedule, notices, achievements, dues; published syllabus and lessons | Unlinked or revoked children (revocation applies on the next request) |
| STUDENT | Own progress, attendance, schedule, notices, achievements; published syllabus and lessons | Other students; payment records |

### Read-only guarantees

- No code path in `server/src/assistant` or `assistant.routes.ts` writes to any table except `ai_audit_events`, `ai_knowledge_sources` and `audit_logs`. The test suite checks this by scanning the compiled files.
- Requests to approve, reject, grade, promote, mark attendance, pay, refund, transfer, change scores, change consent or send messages return `ACTION_REFUSED` before retrieval. Provider output that claims an action was done is withheld (`BLOCKED`).

### Answer statuses

`ANSWERED` (with at least one valid citation), `INSUFFICIENT_EVIDENCE`, `ACTION_REFUSED`, `OUT_OF_SCOPE` (medical advice), `BLOCKED`.

## 2. Test evidence (2026-11-10)

| Command | Directory | Exit | Result |
|---|---|---|---|
| `npx tsc --noEmit` | `server/` | 0 | 0 errors |
| `npm run build && npm test` | `server/` | 0 | **36 / 36 suites** passing (35 existing + H26), ~73 s |
| `node dist/tests/assistant_grounded_ai_h26.test.js` | `server/` | 0 | 5 official criteria plus 14 adversarial groups; exits naturally in ~3 s |
| `npx tsc --noEmit` | `mobile/` | 0 | 0 errors |
| `npx jest --runInBand` | `mobile/` | 0 | **41 suites / 425 tests** (was 40 / 400) |
| `npx eslint` (H26 mobile files) | `mobile/` | 0 | 0 errors, 0 warnings |
| `CI=1 npx expo export --platform android` | `mobile/` | 0 | Bundle exported (~5.8 MB) |
| `CI=1 npx expo export --platform ios` | `mobile/` | 0 | Bundle exported (~5.8 MB) |

Official acceptance tests (all PASS, mocked providers):
`retrieval_cross_tenant_denied`, `document_instruction_cannot_override_policy`, `unknown_answer_admits_gap`, `no_auto_grading_or_payment`, `Super_Admin_no_child_data`.

Additional checks (all PASS): revoked guardian, expired Master authority, unpublished and revoked documents, forged role and tenant parameters, student isolation, fabricated citations, provider failure (safe 503, no leaked detail, still costed), missing evidence, input limits, medical advice, audit privacy, rate limit, per-Persatuan and per-user budget, feature flag, knowledge-source registry scoping, false-positive checks for the refusal and medical filters, quoted evidence, Malay and paraphrased questions.

**Mutation check:** each of these deliberate breaks made the suite fail:
- removing the tenant filter (knowledge sources or lessons)
- disabling action detection, evidence sanitising, citation validation or the action-claim check
- removing the Super Admin context guard
- bypassing the Master expiry check
- removing the per-user budget
- removing both guardian-link checks together

The guardian-link layers back each other up, so removing either one alone is caught by the other.

**Independent review:** a separate code review found no critical or high issues. Its medium and low findings were fixed with tests, apart from the limitations below.

## 3. Known limitations (honest)

1. **No live LLM.** Answers come from the offline extractive provider, which quotes the top matching records. Answers are therefore grounded but plain. Live behaviour of Gemini, Claude or any other model is unverified (`AI-LIVE-001`).
2. **Prompt-injection mitigation is not absolute.** The line-based filter can miss obfuscated or multi-line instructions. The main protections are authorisation before retrieval, no write path, and citation validation. A live model needs its own red-team pass (`AI-SEC-001`).
3. **Language.** The interface strings are in English, Bahasa Melayu and Tamil. Record content is quoted in its original language, usually English. Free-typed Tamil questions rarely match English records. Suggested questions send a fixed English query so they work in every language. BM and Tamil text needs native-speaker review (H28).
4. **Keyword retrieval.** Ranking is lexical: keywords, synonyms, IDF weighting and light stemming. It has no embeddings, so unusual phrasings may get "not found".
5. **Rate limiting is in-memory per process.** A multi-instance deployment needs a gateway limiter. Budgets are database-backed.
6. **Admins get aggregates only.** Persatuan admins cannot ask about an individual student in v1. This is deliberate data minimisation; it can be revisited.
7. **Not tested on devices.** Nothing has been tested on a physical device: no Android or iOS runtime check, no screen-reader check, no large-text check.

## 4. Migration and rollback

- **Migration:** additive only. `schema.sql` appends `ai_knowledge_sources` and `ai_audit_events` with `CREATE TABLE IF NOT EXISTS` and indexes. No existing table is altered. No production migration was run.
- **Turn off without a deploy:** set `AI_ASSISTANT_ENABLED=false`. All `/api/v1/assistant/*` routes then return 404 `ASSISTANT_DISABLED`, and the mobile screen shows "not enabled".
- **Full rollback:** revert commits `3f0f4b8` (backend) and `0dfbeb3` (mobile). The two tables can then be dropped (`DROP TABLE ai_audit_events; DROP TABLE ai_knowledge_sources;`); no other module references them.

## 5. Gemini provider (AI-LIVE-001) — added 2026-11-10

- **Code:** `server/src/assistant/gemini.ts` (`GeminiProvider`), selected by `createProviderFromEnv()` in `providers.ts`.
- **Settings (server only):**
  - `AI_PROVIDER=gemini` with `GEMINI_API_KEY=<key>` turns Gemini on.
  - `GEMINI_MODEL` is optional; the default is `gemini-3.5-flash-lite` (stable; Google's recommended low-cost model as of November 2026).
  - Without these settings, or with the key missing, the assistant stays on the offline extractive provider.
- **Request:**
  - Sent to `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
  - The key goes only in the `x-goog-api-key` header.
  - The fixed policy is sent as the system instruction.
  - Evidence is wrapped in escaped `<evidence>` blocks, so a document cannot open a fake block.
  - The reply must be JSON `{answer, citations}` and is requested in the user's language (EN, BM or Tamil).
- **Reply handling:**
  - Thought parts are dropped.
  - Malformed JSON, blocked prompts, safety stops and truncated replies all become "could not find".
  - HTTP errors become the generic 503, and errors never include the key or Google's reply text.
  - Token usage (including thinking tokens) feeds the daily budgets.
  - The server's citation and action-claim checks still apply to every Gemini answer.
- **Tests:**
  - `assistant_gemini_provider_h26.test.ts` covers request shape, parsing, failure handling and settings, using a fake network. It is part of `npm test`.
  - `assistant_gemini_live_smoke.ts` makes real calls with synthetic data only. It is manual and costs money. Run it with:
    ```
    GEMINI_API_KEY=... node dist/tests/assistant_gemini_live_smoke.js
    ```
- **Model choice:** avoid `gemini-2.5-flash` and `gemini-2.5-pro`. Google's deprecation page says requests to them are automatically rerouted from 1 December 2026.
- **Privacy:** on the free tier, Google may use prompts to improve its products; on the paid tier it does not. Use a paid-tier key before real student data reaches Gemini.
- **Limitation:** the action-claim check is English-pattern based. A Malay or Tamil answer that falsely claims an action may not be caught. Citation validation and the no-write design still apply.
