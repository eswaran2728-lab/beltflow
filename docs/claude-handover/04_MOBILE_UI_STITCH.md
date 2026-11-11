# 04 — Mobile UI, Architecture & Google Stitch Migration

> Directory: `mobile/`  
> Framework: React Native 0.86, Expo SDK 52, TypeScript 5.7  
> Design System: Google Stitch Approved Visual System (`BeltFlow Mobile.dc.html`, `BeltFlow.dc.html`)

---

## 1. Google Stitch Design System

All modern screens consume tokens and reusable components from `mobile/src/components/stitch/` and `mobile/src/theme/tokens.ts`:

### Design Tokens (`StitchTokens`):
* **Brand Navy**: `#0D2B47` (`brandNavy`), `#123A5E` (`brandNavyLight`), `#EAF1F7` (`brandNavyTint`), `#091E32` (`brandNavySurface`).
* **Accent Amber**: `#F2941C` (`colorAccent`), `#D97E0F` (`colorAccentHover`), `#FFF7ED` (`colorAccentSoft`).
* **Semantic Colors**: `#10B981` (`bfGreen`), `#EF4444` (`bfRed`), `#F8FAFC` (`slateBackground`), `#E2E8F0` (`slateBorder`).
* **Typography**: Space Grotesk for headings and KPI metrics; Inter for body copy.

### Reusable Stitch Components:
* `StitchAppHeader`: Branded BeltFlow header with dojang badge, role chip, and unread notification bell.
* `StitchStatCard`: KPI metric cards with accent borders, trend indicators, and subtitle badges.
* `StitchCard`: Standard and elevated surfaces with Stitch borders and background tints.
* `StitchBadge`: Status chips (Success, Warning, Danger, Info).
* `StitchActionButton`: Primary amber, navy outline, and ghost action buttons.

---

## 2. Complete 42-Screen Inventory & Migration Status

The mobile application contains exactly 42 screen files:

| Category | Screen File | Role | Stitch Status | API Connected |
| :--- | :--- | :---: | :---: | :---: |
| **Auth (6)** | `WelcomeScreen.tsx` | All | Pending (H28) | Yes |
| | `LoginScreen.tsx` | All | Pending (H28) | Yes |
| | `ForgotPasswordScreen.tsx` | All | Pending (H28) | Yes |
| | `SplashScreen.tsx` | All | Pending (H28) | Yes |
| | `VerifyCertificateScreen.tsx`| Public | Pending (H28) | Yes |
| | `AuthenticatedPlaceholderScreen.tsx` | All | Pending (H28) | Yes |
| **System (1)**| `UnauthorizedRoleScreen.tsx`| All | Pending (H28) | Yes |
| **Super Admin (1)**| `superAdmin/index.tsx` | Super Admin | Pending (H26/H28) | Yes |
| **Admin Persatuan (8)**| `adminPersatuan/index.tsx` | Admin Persatuan | **MIGRATED** | Yes |
| | `AdminAcademySetupScreen.tsx` | Admin Persatuan | **MIGRATED** | Yes |
| | `AdminFinanceScreen.tsx` | Admin Persatuan | **MIGRATED** | Yes |
| | `AdminGradingScreen.tsx` | Admin Persatuan | **MIGRATED** | Yes |
| | `ClassApprovalsScreen.tsx` | Admin Persatuan | **MIGRATED** | Yes |
| | `CurriculumManagementScreen.tsx`| Admin Persatuan | **MIGRATED** | Yes |
| | `MasterApprovalsScreen.tsx` | Admin Persatuan | **MIGRATED** | Yes |
| | `HandoverApprovalsScreen.tsx` | Admin Persatuan | Pending (H28) | Yes |
| **Master (14)**| `master/index.tsx` | Master | **MIGRATED** | Yes |
| | `ClassWorkspaceScreen.tsx` | Master | **MIGRATED** | Yes |
| | `AttendanceScreen.tsx` | Master | Pending (H28) | Yes |
| | `ClassesScreen.tsx` | Master | Pending (H28) | Yes |
| | `CreateClassScreen.tsx` | Master | Pending (H28) | Yes |
| | `ClassProposalStatusScreen.tsx`| Master | Pending (H28) | Yes |
| | `ClassEnrollmentInboxScreen.tsx`| Master | Pending (H28) | Yes |
| | `ClassHandoverScreen.tsx` | Master | Pending (H28) | Yes |
| | `IncomingHandoversScreen.tsx` | Master | Pending (H28) | Yes |
| | `MasterApplicationStatusScreen.tsx`| Master | Pending (H28) | Yes |
| | `MasterGradingScreen.tsx` | Master | Pending (H28) | Yes |
| | `MasterMakeUpManagementScreen.tsx`| Master | Pending (H28) | Yes |
| | `MasterTransferManagementScreen.tsx`| Master | Pending (H28) | Yes |
| | `MasterTrialsFollowUpScreen.tsx`| Master | Pending (H28) | Yes |
| **Parent (8)** | `parent/index.tsx` | Parent | **MIGRATED** | Yes |
| | `FamilyTimelineHubScreen.tsx` | Parent | Pending (H28) | Yes |
| | `AvailableClassesScreen.tsx` | Parent | Pending (H28) | Yes |
| | `ParentBookTrialScreen.tsx` | Parent | Pending (H28) | Yes |
| | `ParentFeesPaymentScreen.tsx` | Parent | Pending (H28) | Yes |
| | `ParentMakeUpBookingScreen.tsx`| Parent | Pending (H28) | Yes |
| | `ParentMasterMessagingScreen.tsx`| Parent | Pending (H28) | Yes |
| | `ParentStudentLifecycleScreen.tsx`| Parent | Pending (H28) | Yes |
| **Student (4)**| `student/index.tsx` | Student | **MIGRATED** | Yes |
| | `LearningLibraryRewardsScreen.tsx`| Student | Pending (H28) | Yes |
| | `MyApplicationsScreen.tsx` | Student | Pending (H28) | Yes |
| | `VideoFeedbackScreen.tsx` | Student | Pending (H28) | Yes |

### Migration Summary:
* **Fully Migrated Screens**: 11 / 42 screens (**26.2%** of all screens, or **31.4%** of role screens).
* **Remaining Screens for H28 Backlog**: 31 screens.
* **TypeScript Compilation**: `npm run typecheck` passes with **0 errors**.

---

## 3. Running Mobile Tests & Verification

```bash
cd mobile
npm ci
npm run typecheck          # Verifies 0 TypeScript errors across all 42 screens
npm test                   # Runs Jest test suites across components and screens
```

---

## 4. H28 localisation and accessibility (2026-11-11)

See `11_H28_LOCALIZATION_USABILITY.md`. App-wide EN/BM/Tamil via `src/i18n` (`useI18n`, `I18nProvider`), `LanguageSelector` on all Profile screens, translated tab labels, `StatusBadge` icons + text, and `PendingNextStep` on the three approval-status screens. 978 hard-coded strings remain (ratchet test prevents growth).
