# 04 — Mobile, UI and Google Stitch

## Reported vs verified

| Reported (Antigravity / earlier inspection) | Verified on GitHub |
|---|---|
| 42 React Native screens | No React Native / Expo project on any branch |
| 4 committed Stitch-migrated screens | No Stitch component (`StitchAppHeader`, `StitchTokens`) on any branch |
| 7 uncommitted Admin Persatuan screens (~27 TS errors) | Not present — local to the Windows PC |
| Mobile: 40 suites / 400 tests | Not present |

The screen inventory, TypeScript repair and Stitch migration counts **cannot
be produced** until the v2.0 mobile code is pushed. Do not build the H28
backlog from the reported numbers.

## What exists on GitHub

### Android (Kotlin / Jetpack Compose) — `app/src/main/java/com/example/beltflow/ui/screens/`

17 screens: AdminDashboard, Attendance, Auth, Billing, Certificates,
CoachPortal, Curriculum, Grading, MasterPortal, ParentPortal, Settings,
StudentDetail, StudentPortal, StudentsList, SuperAdminDashboard, Tournaments,
VerifyCert. Status per `docs/GO_LIVE_CHECKLIST.md`: Android release NOT READY
(Phase 7B physical-device UAT open). None are Stitch-styled.

### Web PWA — `index.html`

Role portals rendered by: `renderSuperAdminPortal`, `renderPersatuanPortal`,
`renderCoachPortal` (Master), `renderParentPortal`, `renderStudentPortal`,
`renderVerifyPortal`, setup wizard. This is the client certified as web RC1.

### Design references

- `BeltFlow.dc.html`, `BeltFlow Mobile.dc.html` — static design exports (mock data).
- Approved Stitch palette (from your brief): Navy `#0D2B47`, Deep navy `#061828`,
  Secondary navy `#153C61`, Amber `#F2941C`, Emerald `#10B981`.
- Stitch preview link was not opened in this audit (requires your Google login).

## Localisation and accessibility on main

- No Bahasa Melayu or Tamil strings in server, Android or web code.
- No accessibility audit has been recorded.

## H28 backlog

To be generated after the v2.0 mobile code is on GitHub. Minimum items from
your brief: EN/BM/Tamil string coverage, Tamil font coverage, large-text
no-clipping, screen-reader labels, focus order, status not colour-only,
clear pending/approved/rejected next steps, slow-network states, remaining
Stitch screens.
