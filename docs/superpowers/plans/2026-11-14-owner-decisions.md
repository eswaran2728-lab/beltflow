# Owner Decisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four approved owner decisions:
- one in-flight payment per billing month;
- remove the dead Inventory/Tournaments buttons;
- lesson-plan starter text in the app language;
- the guardian WhatsApp message in the app language.

**Architecture:**
- **Server:** `POST /api/v1/payments/intents` refuses to create an intent when a requested month is already covered by a live intent (409 `PAYMENT_IN_PROGRESS` plus the existing intent). The Parent fees screen reopens that intent.
- **Mobile:** the other three changes are mobile-only text and UI changes using the existing `useI18n().t()` modules.

**Tech Stack:**
- **Server:** Express 4, TypeScript, PostgreSQL (`pg`) / PGlite, node-script tests run by `server/scripts/run-tests.js`.
- **Mobile:** Expo 57 / React Native 0.86, Jest + @testing-library/react-native v14.

**Spec:** `docs/superpowers/specs/2026-11-14-owner-decisions-design.md`

## Global Constraints

- **Live intent:** status `REQUIRES_PAYMENT_METHOD` or `PENDING_PROCESSING` AND `expires_at > CURRENT_TIMESTAMP`, same `student_id`, `billing_month_ids && requested ids` (array overlap).
- **409 body:** `{ error, code: 'PAYMENT_IN_PROGRESS', intent: { id, amountCents, amountRM, currency, status, paymentMethod, providerSessionUrl, providerTxId, expiresAt } }`.
- **Idempotency first:** an exact idempotency-key retry still returns the existing intent (200) before the overlap check runs.
- **Ledgers:** append-only financial ledgers; no new cancel endpoint; no server data-shape changes besides the 409.
- **English elsewhere unchanged:** English output elsewhere stays the same; existing tests pin English strings.
- **New text:** goes in `mobile/src/i18n/locales/modules/<area>.ts` in EN/BM/Tamil. Every Tamil value must contain Tamil script and only the characters allowed by `ALLOWED_IN_TAMIL` in `mobile/src/__tests__/localizationUsabilityH28.test.tsx` (no arrows or emoji). Use the same `{placeholders}` in all three languages. Terms: Master = ஆசான், Persatuan = சங்கம்.
- **Green suites:** backend `npm run build && npm test` must give 48/48. Mobile `npx tsc --noEmit -p .`, `npx eslint src` (0 errors) and `npx jest` must all pass. The payment tests also run on PostgreSQL 16.
- **Data:** synthetic test data only (public repo).
- **Commits:** each commit message ends with the attribution lines:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FZvNx7MvKfdWDPd6tU2KXC
  ```

  Push to `feat/phase2-native-and-integration`; never force-push.

## Review Focus

1. **Idempotent retry:** the same `idempotencyKey` sent while that intent is pending returns 200 with the same intent, not 409. (Task 1, test H1.)
2. **Partial overlap:** a request for one pending month plus one new month is refused (409); the new month is not charged separately. (Task 1, test H2.)
3. **Overdue but not yet swept:** an intent whose `expires_at` has passed, but which the worker has not marked `EXPIRED`, does not block a new payment. (Task 1, test H3.)
4. **Different student or failed attempt:** a live intent for a different student does not block, and a FAILED intent does not block a retry. (Task 1, test H4.)
5. **Older server:** a 409 without an `intent` in the body, or any other error, shows the existing failure alert and never crashes the fees screen. (Task 2, second test.)

---

### Task 1: Server: one in-flight payment per billing month

**Files:**
- Modify: `server/src/routes/paymentGateway.routes.ts`. In `POST /intents` (starts ~line 215), add the check after the idempotency block ("// 4. Idempotency Check") and before "// 5. Create Payment Intent Row".
- Modify: `server/src/tests/ops_payment_safety_followups.test.ts`. Add section H and adapt sections C and F.
- Modify: `server/src/tests/persatuan_payments_h13.test.ts`. Change steps 9 and 10, which create overlapping intents for `due1Id` while the 16000-sen intent is pending, and add a 409 check.

**Interfaces:**
- Produces: HTTP 409 with `code: 'PAYMENT_IN_PROGRESS'` and `intent` as in Global Constraints. Task 2 consumes it.

- [ ] **Step 1: Write the failing tests (ops suite, new section H before "G")**

  Each check uses fresh dues inserted with the suite's `due()` helper:

  - **H1 (idempotent retry):** create an intent with `idempotencyKey: 'idem_ops_h1'`, then POST again with the same key. Assert status 200, the same `intent.id`, and `code !== 'PAYMENT_IN_PROGRESS'`.
  - **H2 (overlap refused):** with `due_ops_h2a` pending in intent `h2`, POST `[due_ops_h2a, due_ops_h2b]`. Assert:
    - `status === 409`;
    - `data.code === 'PAYMENT_IN_PROGRESS'`;
    - `data.intent.id === h2.id`;
    - `data.intent.providerSessionUrl` is truthy;
    - no new `payment_intents` row exists for that student and `due_ops_h2b`.
  - **H3 (overdue, not swept):** set `expires_at = now - 1 minute` on the pending intent for `due_ops_h3` (status still `PENDING_PROCESSING`). POST `[due_ops_h3]` and assert 201.
  - **H4 (failed attempt and other student):** send a failure webhook for the intent on `due_ops_h4`, then POST `[due_ops_h4]` and assert 201. Then insert a second student `stu_ops_2`, linked to the same parent, with due `due_ops_h4s`. Assert that their POST returns 201 while the first student has a live intent.
  - **Adapt C:** before creating `fresh`, set `stale.expires_at` into the past, so `fresh` is allowed.
  - **Adapt F:** after creating `f1`, set its `expires_at` into the past before creating `f2`. The duplicate-settlement flag is still tested: the bank can still confirm an expired link.

- [ ] **Step 2: Run and confirm the failure**

  Run: `cd server && npm run build && node scripts/run-tests.js ops_payment`.
  Expected: FAIL at H2 (got 201, expected 409).

- [ ] **Step 3: Implement the check**

  In `POST /intents`, after the idempotency block:
  - query `payment_intents` for the student where `billing_month_ids && $ids::text[]` and the status/`expires_at` rule from Global Constraints;
  - if a row exists, return 409 with the body from Global Constraints;
  - order by `created_at DESC` and take the first row;
  - use the message `'A payment for these months is already in progress.'`.

- [ ] **Step 4: Update H13**

  In `persatuan_payments_h13.test.ts`:
  - **Steps 9 and 10:** insert two dedicated dues, `due_pay_forged_test` and `due_pay_duitnow_test`, for `studentA1Id` (80.00 each, months `'2027-01'` and `'2027-02'`). Use them in place of `due1Id`. Keep the assertions: forged amount gives 8000 sen; DuitNow gives `paymentMethod === 'DUITNOW_QR'`.
  - **Cleanup:** after step 10, delete those two intents and dues with SQL, so Requirement 23 (billing status) is unchanged.
  - **New check:** right after step 8, add a numbered check that posts `[due1Id]` and asserts `409` and `code === 'PAYMENT_IN_PROGRESS'` and `intent.id === intentId`. Log line: `'✅ Requirement 26 Passed: A second payment for a month already in progress is refused.'`.

- [ ] **Step 5: Run the payment suites**

  Run: `cd server && npm run build && node scripts/run-tests.js ops_payment persatuan_payments core_pilot billing_status`.
  Expected: `4/4 suites passed`.

- [ ] **Step 6: Run them on PostgreSQL 16**

  Start a throwaway cluster as in `docs/claude-handover/10_H27_RELEASE_CERTIFICATION.md` §6 (port 55432 under `/var/tmp/beltflow-pg`). Then run each of the same suites with `DATABASE_URL=postgres://postgres@127.0.0.1:55432/t_<suite> DATABASE_SSL=disable` on a fresh database.
  Expected: each prints its PASSED line. Stop the cluster and remove the folder afterwards.

- [ ] **Step 7: Commit**

  Message: `fix(server): refuse a second payment for months already in progress`.

### Task 2: Mobile: reopen the payment already in progress

**Files:**
- Modify: `mobile/src/screens/roles/parent/ParentFeesPaymentScreen.tsx`. In `handlePayNow`'s `catch` (~line 257), handle the 409.
- Modify: `mobile/src/i18n/locales/modules/parentHome.ts`. Add keys:
  - `parentHome.fees.inProgressTitle`: "Payment Already in Progress"
  - `parentHome.fees.inProgressMessage`: "A payment for these months is already in progress. Finish it at your bank or check its status before paying again."
- Test: `mobile/src/__tests__/nextStepCardsH28.test.tsx`.

**Interfaces:**
- Consumes: Task 1's 409. `ApiError` from `mobile/src/services/apiClient.ts` has `.status === 409` and `.details` holding the parsed body `{ code, intent }`.

- [ ] **Step 1: Write the failing tests**

  - **`payment screen: a payment already in progress is reopened instead of starting a second`:** mock `paymentGatewayService.createPaymentIntent` to reject with `Object.assign(new Error('A payment for these months is already in progress.'), { status: 409, details: { code: 'PAYMENT_IN_PROGRESS', intent: { id: 'intent_live', amountCents: 8000, amountRM: '80.00', currency: 'MYR', paymentMethod: 'FPX', status: 'PENDING_PROCESSING', providerSessionUrl: 'https://sandbox.example.test/x' } } })`. Press `btn-pay-now`. Assert:
    - `active-intent-card` is shown;
    - `payment-next-step` is shown;
    - `btn-check-payment-status` is shown;
    - `Alert.alert` was called with `en['parentHome.fees.inProgressTitle']` and `en['parentHome.fees.inProgressMessage']`.
  - **`payment screen: other payment errors still show the failure alert`:** reject with `Object.assign(new Error('boom'), { status: 409, details: {} })`. Assert:
    - `Alert.alert` was called with `en['parentHome.fees.initiationFailedTitle']`;
    - no `active-intent-card` is shown.

- [ ] **Step 2: Run and confirm the failure**

  Run: `cd mobile && npx jest src/__tests__/nextStepCardsH28.test.tsx -t "in progress"`.
  Expected: FAIL (no `active-intent-card`).

- [ ] **Step 3: Implement**

  In the `catch`: if `err?.status === 409 && err?.details?.code === 'PAYMENT_IN_PROGRESS' && err.details.intent`, then:
  - call `setActiveIntent(err.details.intent)`;
  - show `Alert.alert(t('parentHome.fees.inProgressTitle'), t('parentHome.fees.inProgressMessage'))`;
  - do not open the URL automatically.

  Otherwise keep the existing alert. Add the two keys to En/Ms/Ta.

- [ ] **Step 4: Run the tests**

  Run: `npx jest src/__tests__/nextStepCardsH28.test.tsx src/__tests__/paymentGatewayScreens.test.tsx src/__tests__/localizationUsabilityH28.test.tsx`.
  Expected: all pass.

- [ ] **Step 5: Commit**

  Message: `mobile: reopen a payment already in progress instead of starting a second`.

### Task 3: Remove the Inventory and Tournaments dashboard buttons

**Files:**
- Modify: `mobile/src/screens/roles/adminPersatuan/index.tsx`. Remove the `release.isEnabled('commerce')` block (`shortcut-ap-inventory`, ~line 438) and the `release.isEnabled('tournaments')` block (`shortcut-ap-tournaments`, ~line 450). Remove any `t()` keys and icon imports used only by them, and the `release` variable if it is now unused.
- Modify: `mobile/src/__tests__/adminDashboardStitch.test.tsx`. Change the test at ~line 219 ("renders quick navigation shortcuts including H25 inventory..."): rename it to `'renders quick navigation shortcuts and no dead Inventory or Tournaments buttons'` and assert `queryByTestId('shortcut-ap-inventory') === null` and `queryByTestId('shortcut-ap-tournaments') === null`. Keep its other shortcut assertions.
- Modify: `mobile/src/__tests__/navigationAdminWiring.test.tsx`. Replace the tests that expect Inventory/Tournaments to show when `commerce`/`tournaments` are on with one test asserting that both are absent with all modules on.
- Modify: `mobile/src/__tests__/navigationTargets.test.ts`. Empty `KNOWN_UNREGISTERED` (`{}`).
- Modify: `mobile/src/i18n/locales/modules/adminHome.ts`. Delete the keys only those buttons used.

- [ ] **Step 1: Update the three tests to the new expectations**

  Make the edits described in Files.

- [ ] **Step 2: Run and confirm the failure**

  Run: `cd mobile && npx jest src/__tests__/adminDashboardStitch.test.tsx src/__tests__/navigationAdminWiring.test.tsx src/__tests__/navigationTargets.test.ts`.
  Expected: FAIL (the buttons still exist; the known-gaps test fails because the targets are still referenced).

- [ ] **Step 3: Remove the buttons and their now-unused keys and imports**

- [ ] **Step 4: Run the checks**

  Run the three tests plus `npx tsc --noEmit -p .`, `npx eslint src/screens/roles/adminPersatuan/index.tsx` and `npx jest src/__tests__/i18nCoverageRatchetH28.test.ts src/__tests__/localizationUsabilityH28.test.tsx`.
  Expected: all pass, 0 lint errors.

- [ ] **Step 5: Commit**

  Message: `mobile: remove the dead Inventory and Tournaments dashboard buttons`.

### Task 4: Lesson-plan starter text in the app language

**Files:**
- Modify: `mobile/src/screens/roles/master/LessonPlanModal.tsx`. Change the new-plan branch (~lines 99-107) and `handleAddDrill` (~line 130).
- Modify: `mobile/src/i18n/locales/modules/masterClasses.ts`. Add keys:
  - `masterClasses.lessonPlan.defaultTitle`: "Lesson Plan - {session}"
  - `masterClasses.lessonPlan.defaultSession`: "Session"
  - `masterClasses.lessonPlan.defaultEquipment`: "Taegeuk Mats, Kick Targets"
  - `masterClasses.lessonPlan.drillWarmupName`: "Warm-up & Joint Mobility"
  - `masterClasses.lessonPlan.drillWarmupInstructions`: "Standard dynamic warm up"
  - `masterClasses.lessonPlan.drillPatternName`: "Pattern Practice (Poomsae)"
  - `masterClasses.lessonPlan.drillPatternInstructions`: "Focus on stances and hip rotation"
  - `masterClasses.lessonPlan.newDrillName`: "New Drill"
- Test: `mobile/src/__tests__/lessonPlansFamilyHubScreens.test.tsx` (add tests; reuse its existing mocks for `teachingService`).

- [ ] **Step 1: Write the failing test**

  `lesson plan starter text follows the app language`: render `LessonPlanModal` for a session with no existing plan, inside `<I18nProvider initialLocale="ta">`. Assert that:
  - the title input value equals `translate('ta', 'masterClasses.lessonPlan.defaultTitle', { session: <sessionTitle> })`;
  - the equipment input equals `translate('ta', 'masterClasses.lessonPlan.defaultEquipment')`;
  - the first drill name equals `translate('ta', 'masterClasses.lessonPlan.drillWarmupName')`;
  - after pressing the add-drill button, a drill named `translate('ta', 'masterClasses.lessonPlan.newDrillName')` exists.

  Also assert that the English render still shows `'Taegeuk Mats, Kick Targets'`.

- [ ] **Step 2: Run and confirm the failure**

  Run: `npx jest src/__tests__/lessonPlansFamilyHubScreens.test.tsx -t "starter text"`.
  Expected: FAIL (English shown in Tamil).

- [ ] **Step 3: Implement**

  Replace the literals with `t(...)` keys in En/Ms/Ta. The existing `loadData` dependency list already includes `t`.

- [ ] **Step 4: Run the tests**

  Run: `npx jest src/__tests__/lessonPlansFamilyHubScreens.test.tsx src/__tests__/masterWorkspaceScreens.test.tsx src/__tests__/localizationUsabilityH28.test.tsx`.
  Expected: all pass.

- [ ] **Step 5: Commit**

  Message: `mobile: lesson-plan starter text in the Master's app language`.

### Task 5: Guardian WhatsApp message in the app language

**Files:**
- Modify: `mobile/src/components/stitch/AtRiskAttendanceAlert.tsx`. The `wa.me` text (~line 47) uses `t('components.atRisk.whatsappMessage', { name: student.name })`.
- Modify: `mobile/src/i18n/locales/modules/components.ts`. Add `components.atRisk.whatsappMessage`, with English exactly "Salam, this is your Master from the Dojang regarding {name}'s attendance."
- Test: `mobile/src/__tests__/components.test.tsx`, or the suite that already renders `AtRiskAttendanceAlert` (find it with `grep -rl AtRiskAttendanceAlert src/__tests__`).

- [ ] **Step 1: Write the failing test**

  `guardian WhatsApp message follows the app language`: render `AtRiskAttendanceAlert` with a student `{ name: 'Test Child', parentPhone: '+60 12-000 0000' }` inside `<I18nProvider initialLocale="ms">`. Spy on `Linking.openURL` and on `Alert.alert`. Press the guardian action, then call the alert's `openWhatsApp` button `onPress`. Assert:
  - the URL starts with `https://wa.me/60120000000?text=`;
  - `decodeURIComponent` of the text equals `translate('ms', 'components.atRisk.whatsappMessage', { name: 'Test Child' })`.

  Also assert that the English locale gives the original sentence.

- [ ] **Step 2: Run and confirm the failure**

  Run the test file with `-t "WhatsApp"`.
  Expected: FAIL (English text).

- [ ] **Step 3: Implement**

  Use the key; add En/Ms/Ta values with `{name}`.

- [ ] **Step 4: Run the tests**

  Run the test file plus `src/__tests__/localizationUsabilityH28.test.tsx`.
  Expected: pass.

- [ ] **Step 5: Commit**

  Message: `mobile: guardian WhatsApp message in the Master's app language`.

### Task 6: Full verification, docs, push

**Files:**
- Modify: `docs/claude-handover/10_H27_RELEASE_CERTIFICATION.md`. Change §8 "Owner decision (not changed)" to say it was decided and implemented on 2026-11-14 (409 `PAYMENT_IN_PROGRESS`).
- Modify: `docs/claude-handover/11_H28_LOCALIZATION_USABILITY.md`. Mark §6 "Decisions for the owner" as decided: lesson-plan text and WhatsApp in the app language.
- Modify: `docs/claude-handover/05_TESTING_BUILD_RELEASE.md`. Update the mobile test count.
- Regenerate: `docs/translation-review/beltflow-translations.csv` via `cd mobile && node scripts/export-translations.js`.

- [ ] **Step 1: Run the backend suite**

  Run: `cd server && npm run build && npm test`.
  Expected: `48/48 suites passed`.

- [ ] **Step 2: Run the mobile checks**

  Run: `cd mobile && npx tsc --noEmit -p . && npx eslint src && npx jest --silent && npx expo export --platform android --output-dir <scratchpad>/export`.
  Expected: 0 type errors; 0 lint errors; all suites pass; "Exported".

- [ ] **Step 3: Update the docs and regenerate the CSV; commit**

  Message: `docs: record the four owner decisions as implemented`.

- [ ] **Step 4: Push and check parity**

  Run: `git push -u origin feat/phase2-native-and-integration` (retry on 503 with 2/4/8/16 s waits), then `git fetch` and compare `git rev-parse HEAD` with `origin/feat/phase2-native-and-integration`.
  Expected: they are equal, and `git status --short` is empty.
