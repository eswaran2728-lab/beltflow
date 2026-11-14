# Owner decisions: double payments, dead buttons, lesson-plan and WhatsApp language

Date: 2026-11-14. Approved by the owner ("Proceed") after the options below were laid out.
Size: four small changes.

## Intent
Close the four questions left open during H28 and the payment follow-ups, so families are never charged twice, no button does nothing, and starter text follows the user's language.

## Decisions

### 1. One in-flight payment per billing month
- **Rule:** `POST /payments/intents` refuses to create a new intent when any requested billing month is already covered by an intent of the same student that is `REQUIRES_PAYMENT_METHOD` or `PENDING_PROCESSING` and not past `expires_at` (30 min). It answers 409 with code `PAYMENT_IN_PROGRESS` and the existing intent (id, amount, method, status, session URL, expiry) so the app can reopen it. An exact idempotency-key retry keeps returning the same intent as today.
- **App:** the Parent fees screen shows "A payment for these months is already in progress", with a button to reopen the bank page and one to check its status.
- **Approaches considered:**
  - (a) Block. **Chosen**, because money safety comes first.
  - (b) Keep allowing overlaps and rely on the DISCREPANCY_AMOUNT refund flag. Rejected: the parent is still charged twice.
  - (c) Cancel the older intent automatically. Rejected: the bank may already have taken that money.
- **Trade-off accepted:** after abandoning a payment, a parent waits up to 30 minutes for it to expire.
- **Official test:** H13 deliberately creates overlapping intents (forged-amount and DuitNow checks). Those checks move to their own billing months; a new H13 check asserts the 409.

### 2. Remove the Inventory and Tournaments dashboard buttons
- The app has no Inventory or Tournaments screens, so these Admin Persatuan dashboard buttons are dead even when their modules are on. Remove both, update `adminDashboardStitch.test.tsx` "Requirement 5" to assert they are absent, and drop both from `navigationTargets.test.ts` KNOWN_UNREGISTERED.
- **Approaches considered:**
  - Remove. **Chosen.**
  - Keep them gated (the current state). Rejected: still dead when the module is on.
  - Build the screens. Out of scope.

### 3. Lesson-plan starter text in the Master's app language
- Default drill names and instructions, "New Drill", the equipment list and the default title in `LessonPlanModal` come from translation keys (EN/BM/Tamil). Saved plans store whatever the Master saves.
- **Approaches considered:**
  - Translate. **Chosen.**
  - Keep English. Rejected: it looks broken in a BM/Tamil app.

### 4. Guardian WhatsApp message in the Master's app language
- The pre-filled message in `AtRiskAttendanceAlert` comes from translation keys with the student's name and the attendance figures as parameters. The Master can still edit it in WhatsApp.
- **Approaches considered:**
  - App language. **Chosen.**
  - Ask each time. Rejected: an extra step.
  - Keep English.

## Non-goals
No new payment cancel endpoint, no Inventory/Tournaments screens, no change to server data shapes beyond the 409 response.

## Constraints
- Append-only financial ledgers.
- Tenant isolation.
- English output elsewhere unchanged.
- Every Tamil string uses Tamil script and only the characters the H28 test allows.
- Backend 48 suites and the mobile suite must stay green; payment tests also run on PostgreSQL 16.

## Left to the builder
- Exact wording of the new strings.
- Test placement.
