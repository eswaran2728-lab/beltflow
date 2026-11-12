# 11 — H28 Continuous Localization and Usability: Evidence Record

> Date: 2026-11-11. Branch `feat/phase2-native-and-integration`. Governing PDF §23 (H28).
> Contract: localized role journeys and accessibility evidence.
> **Verdict: PARTIAL.** All five official acceptance tests pass (component and screen level, Jest), and the
> localisation foundation is in place. H28 is "continuous", and most of the work remains:
> - Every screen and shared component now takes its text from EN/BM/Tamil keys (core journeys 2026-11-11 §5, the rest 2026-11-12 §6). Hard-coded English UI strings: 978 → 0.
> - Malay and Tamil need native-speaker review.
> - Real-device checks (large text, TalkBack/VoiceOver, low-memory phones, slow networks) and real-user sessions have not been done.
> - The remaining Stitch screen migration has not been done.

## 1. Official acceptance tests — `mobile/src/__tests__/localizationUsabilityH28.test.tsx`

| Test | Result | What it proves (and its limit) |
|---|---|---|
| `Tamil_font_coverage` | PASS | Every key exists in BM and Tamil with the same placeholders. Tamil strings are in Tamil script and contain only covered characters. No CSS font stacks or unbundled fonts are used anywhere in the app source, so Tamil renders with the platform system font (Noto Sans Tamil / Tamil Sangam MN). *Limit: glyph rendering itself needs a device screenshot check.* |
| `large_text_no_clipping` | PASS | Font scaling is never disabled or capped below 2×. Status, next-step and language text has no line limits or fixed heights in all three languages. *Limit: Jest has no layout engine; pixel clipping at 200% text must be checked on devices.* |
| `focus_order_usable` | PASS | On a pending class proposal the order is status badge → next steps → action. The next-step card reads heading → who → next → action. Language options form a labelled radio group with selection state. *Limit: real TalkBack/VoiceOver traversal is not run.* |
| `status_not_color_only` | PASS | Every badge has text, a screen-reader label ("Status: …") and a **different icon shape** per meaning; the comparison ignores colour. Badges without a label get a translated default. |
| `pending_approval_next_step_clear` | PASS | For Master applications, class proposals and enrolment applications, every pending state (draft, submitted, needs information, waitlisted, rejected) in EN/BM/Tamil explains who decides, what happens next and what to do now. Finished states show no card. The real screens render it. |

**Mutation checks:** each of the following made the suite fail:
- restoring the CSS font stack
- putting Latin text in a Tamil string
- truncating next-step text
- disabling font scaling
- moving the next-step card after the actions
- removing the badge icon
- using the same icon for two meanings
- removing the enrolment card
- deleting a Tamil key

## 2. What was built

- **`src/i18n`:**
  - English source dictionary, Bahasa Melayu and Tamil dictionaries
  - `translate()` with English fallback and `{placeholder}` filling
  - `I18nProvider` at the app root, which remembers the choice in secure storage
  - `useI18n()`, which works without a provider (English) so older screens are unaffected
- **`LanguageSelector`** on all five Profile screens. The assistant's language chips and the Admin dashboard switch now change the whole app (the Admin label changed from "MY" to "BM").
- **Tab labels** and tab screen-reader labels translated in all five role navigators. English output is unchanged.
- **`StatusBadge`:**
  - an icon per meaning (tick = success, clock = waiting, cross = problem, info, dash = neutral)
  - wrapping text
  - a "Status: …" accessibility label
  - translated default labels
- **`PendingNextStep`** on `MasterApplicationStatusScreen`, `ClassProposalStatusScreen` and `MyApplicationsScreen`. Badge labels on these screens are translated.
- **Fonts:** see commit `145641a`. The theme used CSS stacks for fonts that were never bundled; it now uses system fonts.
- **`i18nCoverageRatchetH28`:**
  - Since 2026-11-12 it checks **every** `.tsx` file under `src/` (83 files, plus any added later) and fails on any hard-coded English UI text.
  - Four pattern matches that are code, not text, are listed exactly in `KNOWN_NON_TEXT`.

**Native-speaker review needed:** `mobile/src/i18n/locales/ms.ts` and `ta.ts`, and the H26 `assistantStrings.ts`. The Tamil uses ஆசான் for Master and சங்கம் for Persatuan.

## 3. Test evidence (2026-11-11)

| Command (in `mobile/`) | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx jest --runInBand` | **44 suites / 477 tests passed** (42 / 444 before H28) |
| `npx eslint` (H28 files) | 0 errors; 4 pre-existing unused-import warnings in `adminPersatuan/index.tsx` |
| `CI=1 npx expo export --platform android` / `ios` | Both succeed |

Backend unchanged by H28 (42/42 suites, see `10`).

## 4. Remaining H28 work (backlog, in suggested order)

1. ~~Translate the remaining screens~~ — done 2026-11-12 (§6). New screens must use `t()`; the guard test enforces it.
2. **Native-speaker review** of all BM and Tamil strings, including the assistant's.
3. **Device checks:**
   - Android at the largest text size plus TalkBack, and iPhone at the largest Dynamic Type plus VoiceOver, for each role's core journey.
   - Screenshots of Tamil text to confirm glyphs.
   - A low-memory Android phone.
   - Throttled or offline network for attendance sync and payments.
4. **Real-user sessions** with Persatuan admins, Masters, parents and students (PDF "Pilot acceptance").
5. **Server-side text:** notices, notification templates and API error messages are still English; the notification outbox has no sender yet (`10` §5).
6. **Stitch migration** of the remaining 31 screens (`04`, `07`). Keep the system-font decision, or bundle Space Grotesk/Inter for Latin text only with a Tamil fallback.
7. **Next-step cards** for other waiting states: parent-link approval, transfer requests, payment verification, make-up and waitlist offers, Master handover.

## 5. Core role journeys translated (2026-11-11)

Keys live in per-area files under `mobile/src/i18n/locales/modules/` (`auth`, `superAdminHome`, `adminHome`, `masterHome`, `masterOps`, `parentHome`, `studentHome`), spread into `en.ts`/`ms.ts`/`ta.ts`. 689 keys in total, each in EN/BM/Tamil.

| Area | Screens | Keys |
|---|---|---|
| Sign-in | Welcome (now with language picker), Login, Forgot Password, Splash, Verify Certificate, signed-in placeholder, Unauthorized Role, role placeholder base | 81 |
| Super Admin | home, Persatuan management, audit, profile | 29 |
| Admin Persatuan | dashboard (old in-file EN/BM/TA dictionary moved to keys; BM "Guru Utama" → "Master"), placeholders, finance | 117 |
| Master | home, students, profile, classes | 67 |
| Master operations | attendance, grading, QR scanner | 148 |
| Parent | home, children, notices, profile, fees and payment | 109 |
| Student | home, attendance, certificates, profile | 63 |

Rules followed: English output unchanged (existing tests pin it); server data, role codes, enum values sent to the API, and "RM" formatting are not translated; payment wording only says "settled/confirmed" where the server data already says so.

Evidence: all 19 files above are in the ratchet's fully-localised list (0 hard-coded strings); a key-usage scan found no `t('…')` key missing from the dictionaries; `tsc` 0 errors; ESLint 0 errors; Jest 44 suites / 496 tests pass; `expo export --platform android` succeeds.

Not done: native-speaker review of the new BM/Tamil text, and on-device checks of longer BM/Tamil labels on small screens.

## 6. Remaining screens and shared components translated (2026-11-12)

Nine more area modules under `mobile/src/i18n/locales/modules/`. Total dictionary: 2,156 keys, each in EN/BM/Tamil.

| Area module | Screens / files | Keys |
|---|---|---|
| `adminOps` | Academy setup, grading, curriculum | 166 |
| `adminApprovals` | Class, handover and Master approvals | 163 |
| `masterClasses` | Class workspace, lesson plan editor | 140 |
| `masterLifecycle` | Enrollment inbox, class proposal status, create class, Master application status | 187 |
| `masterHandover` | Class handover, incoming handovers, make-ups, transfers, trial follow-up | 244 |
| `parentFlows` | Available classes, book trial, make-up booking, family timeline | 164 |
| `parentLifecycle` | Student lifecycle (pause/transfer), Master messaging | 135 |
| `studentFlows` | Learning library and rewards, my applications, video feedback | 141 |
| `components` | Billing card, student profile, digital pass, certificate card, attendance row, sync/offline banners, dialogs, dev panel | 140 |

Code fixes made along the way:
- Two screens chose a message colour by searching the English text ("Error…", "…successfully"); they now use a success/error flag, so the colour stays right in BM/Tamil.
- `ParentMasterMessagingScreen` had its own EN/BM/TA table fixed to English; moved to keys. Its BM/Tamil safety notices had lost meaning and now match the English.
- Server statuses shown as labels use a key lookup that falls back to the raw value (as before) when the server sends a value with no key.
- Four TypeScript errors from optional values passed to `t()` fixed.

Left in English on purpose: values sent to the server (default reasons, lesson-plan defaults, upload titles, enum values), names and messages written by people or returned by the server, role codes, "RM" formatting, test-account names in the dev panel, and machine-readable error-code prefixes at the start of consent/policy messages.

**Decisions for the owner:**
- Lesson-plan starting text (drill names, "New Drill", equipment) is saved with the plan, so it stays English. Translating it would store plans in mixed languages.
- The WhatsApp message pre-filled for a guardian from the at-risk attendance alert stays English.

Evidence (2026-11-12): guard test 84/84 (all 83 files clean, and a deliberately added English string makes it fail); key scan finds no key used in code that is missing from the dictionary; `tsc` 0 errors; ESLint 0 errors (59 old warnings, unchanged); Jest 44 suites / 551 tests pass; `expo export` for Android and iOS succeeds.

Still needed before release: native-speaker review of all BM and Tamil text (now ~2,150 strings), and on-device checks that longer BM/Tamil labels fit on small screens and at large text sizes.
