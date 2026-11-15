# 14 — Privacy, legal pages and accessibility, 2026-11-15

Scope chosen by the owner: the **BeltFlow web app** (`index.html`), with
customers in **Malaysia only**. The server and the mobile app were changed
where the same rules apply.

**This is not legal advice.** The legal pages were written from what the app
actually does and from law-firm summaries of Malaysian law. A Malaysian
lawyer must review them before they are relied on. Points that the sources
left unclear are listed under "Legal points to confirm".

## Owner actions

1. **Fill in `legal/business.js`**: registered business name, SSM number,
   address, e-mail, telephone, personal-data contact, and the country where
   the data is hosted. Then set `complete: true`. Until then every legal page
   shows a "Draft" notice.
2. **Have a lawyer review** the four pages in `/legal`.
3. **Decide the refund rules** (see "Decisions for the owner").
4. **Appoint a data protection officer** if the thresholds apply to you (see below).

## What was asked and what was done

| Request | Result |
|---|---|
| Privacy policy | `/legal/privacy.html`, English and Bahasa Malaysia. Covers the items a PDPA notice needs: what data, why, source, who it is shared with, whether it is compulsory, rights and how to use them, children, sensitive data, retention, hosting location, contact |
| Terms and conditions | `/legal/terms.html`, both languages. States that the academy, not BeltFlow, runs classes, sets fees and pays refunds; keeps Consumer Protection Act rights |
| Cookie policy | `/legal/cookies.html`, both languages |
| Do I need a cookie banner? | **No.** The site sets no cookies and has no analytics, advertising or tracking. The only browser storage is the sign-in session and a cache of the app's own files, both needed for the service. If analytics are ever added, consent must come first |
| Refund policy | `/legal/refunds.html`, both languages. Refunds are paid by the academy, because the academy receives the money |
| Consistent checkboxes | One `.bf-consent` style. Registration: privacy notice, terms, plus guardian consent (parent) or an age-or-guardian confirmation (student). Link-a-child: guardian confirmation. Staff adding a student: confirmation that the notice was given. All unticked by default and required |
| Server-side consent | Registration is refused without real `true` values, and each agreement is stored with the document version (`user_consents`) |
| Only collect what is needed | Registration asks for name, e-mail, phone, password, class and belt rank. No identity card number is asked at sign-up. See "Decisions" for the staff forms |
| Let users delete their data | "Privacy and my data" screen: download my data; request deletion, correction or withdrawal of consent. Handled by the academy's Admin within 21 days. Deletion removes personal details and closes the account; payment records are kept without the name |
| No analytics before consent | There are no analytics at all |
| Third-party embeds | Google Fonts and the unpkg icon CDN were the only ones. Both are now served from the site itself. The site's Content-Security-Policy allows no other host |
| Accessibility | Automated checker (axe-core, WCAG 2.1 A and AA): 1,459 problems across 98 views before, 0 after. Details below |
| Alt text | Both logo images are marked decorative (`alt=""`, the name is in the text beside them); 79 icons and 26 emoji hidden from screen readers; 28 icon-only buttons labelled |
| Colour contrast | 16 colour pairs fixed on the web app; 2 theme colours on mobile. Table in the agent report, summarised below |
| Keyboard-friendly forms | 72 labels linked to inputs, focus ring, dialogs trap focus and close on Escape, clickable cards reachable by keyboard. 41 scripted key-press checks pass |
| Remove fake reviews | There are no reviews or testimonials anywhere on the site or in the app |
| Remove unprovable claims | "Certified instructors/Masters" changed to "approved by the Persatuan"; "tamper-resistant logs" and "security compliance records" changed to plain descriptions. In English, Bahasa Malaysia and Tamil |
| Add business details | Shown on every legal page from `legal/business.js`. **Waiting for the owner's details** |
| Check the laws | See below |

## A privacy bug found and fixed

The web app's service worker stored a copy of every GET response, including
API answers with account, student and payment data. That data stayed in the
browser after sign-out and could be shown stale. It now caches only the
app's own files; API answers are never stored.

## Malaysian law checked

- **Personal Data Protection Act 2010 (PDPA), as amended in 2024.**
  - A written privacy notice is required, in **Bahasa Malaysia and English**.
  - A person **under 18** needs the consent of a parent or guardian.
  - **Health information** is sensitive personal data and needs explicit consent.
  - The 2024 amendments add mandatory **breach notification**, a **data protection officer**, and a right to **data portability**. All were in force by 1 June 2025.
  - Requests to access or correct data must be answered within **21 days**.
- **Consumer Protection Act 1999** and the **Consumer Protection (Electronic
  Trade Transactions) Regulations 2024** (in force 25 December 2024, replacing
  the 2012 regulations): an online seller must show its name, registration
  number where it has one, and contact details, plus full prices and terms.
- **No separate cookie law** was found. Cookies that process personal data
  fall under the PDPA's consent rules. BeltFlow uses none.

### Legal points to confirm with a lawyer

1. **Which role BeltFlow has for member records.** The notice says the academy
   decides what is recorded and BeltFlow handles it on the academy's behalf.
   The contract with each academy should say the same.
2. **Data protection officer.** The duty exists; whether BeltFlow or each
   academy meets the threshold that triggers it was not established.
3. **Breach notification timing.** A 72-hour deadline appeared in a
   consultation draft; the sources did not confirm the final rule.
4. **A student who registers alone.** The app asks for an "18 or older, or my
   guardian agreed" confirmation. It cannot verify age. Stricter: only let a
   guardian register a child.
5. **Whether the 2024 e-commerce regulations apply.** They target online
   marketplaces; BeltFlow lets academies sell merchandise to their own
   members. The business details are shown either way.
6. **Storing data outside Malaysia**, if the host is abroad.

Sources: [Baker McKenzie on the PDPA amendments](https://insightplus.bakermckenzie.com/bm/data-technology/malaysia-personal-data-protection-amendment-act-2024-to-come-into-force),
[Rajah & Tann on commencement dates](https://www.rajahtannasia.com/?p=161886),
[Chambers Data Protection 2026, Malaysia](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/malaysia),
[Linklaters, Data Protected: Malaysia](https://www.linklaters.com/en/insights/data-protected/data-protected---malaysia),
[Rödl on the 2024 e-commerce regulations](https://www.roedl.com/insights/newsflash-malaysia/2025_07/malaysia-consumer-protection-electronic-trade-transaction-regulations-2024),
[KPDN gazette copy](https://repositori.kpdn.gov.my/bitstream/123456789/5299/1/PERATURAN%20URUSNIAGA%20PERDAGANGAN%20DALAM%20ELEKTRONIK%202024.pdf).

## Decisions for the owner

1. **Refund rules.** The policy states only what is always true (double
   charge, wrong amount, goods not supplied, faulty goods) and leaves class-fee
   refunds to each academy. If BeltFlow should set a minimum rule or a time
   limit for all academies, say so and the policy changes.
2. **Identity card numbers.** Staff forms can record a student's IC number.
   If academies do not need it, remove the field.
3. **Outline button borders** on the web app are faint (about 1.2:1). The
   text label identifies each button, so they pass the checker, but darkening
   them would be clearer. It changes the look.
4. **Mobile amber text.** 17 places use amber text. On the navy header it
   passes; on white it does not (2.3:1). Each needs checking by screen.

## Accessibility detail (web app)

- **Checker:** axe-core 4.10.2, tags wcag2a, wcag2aa, wcag21a, wcag21aa, on 98
  views (sign-in, the 5 registration steps, every tab and 40+ dialogs for all
  five roles, desktop and 390 px). After my later additions, the sign-in
  screen, the consent step, the privacy screen and the four legal pages were
  scanned again: 0 violations.
- **Contrast fixes (before to after):** helper text 4.34 to 5.17; amber text on
  white 2.33 to 5.55; text on amber buttons 2.33 to 6.21; success green 2.54
  to 5.48; danger red 3.76 to 5.74; input borders 1.23 to 3.47.
- **Also fixed:** zoom was disabled in the viewport tag; pages scrolled
  sideways at 320 px; the hidden app behind the sign-in screen was reachable
  by Tab.
- **Not tested:** no screen reader was used, and no real phone or assistive
  device. Some dialogs (grading results, tournament medals, session
  attendance) were scanned empty because the test data has none.

## Tests

- **Browser end-to-end** (sign-up with consent, download, deletion request,
  Admin carries it out, deleted account cannot sign in, no third-party
  request, no cookie): 36 of 36 checks pass.
- **Backend:** 52/52 suites on PGlite; privacy and auth suites also pass on
  PostgreSQL 16. New suite: `privacy_compliance`.
- **Mobile:** 58 suites / 646 tests; `tsc` 0 errors; eslint 0 errors. The
  privacy screen was also run against a seeded server in the app preview:
  a parent opened it from Profile, saw their two children offered, and sent a
  correction request that the server recorded.

## Not done

- The **mobile app** has a "Privacy and my data" screen on every role's
  Profile tab (share my data, make a request, see my requests). It does not
  yet have the staff screen for carrying out requests; Admins use the web app
  for that.
- The legal pages are not translated into **Tamil**.
- **Re-consent** when the documents change is not built. The version agreed
  to is recorded, so it can be added.
- **Messages** a deleted person wrote stay in the thread, shown under
  "Deleted user".
