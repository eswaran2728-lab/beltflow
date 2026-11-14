# 07 — Pending Work & Development Priorities

> Current Milestone: H26 PASS, H27 CONDITIONAL PASS, H28 PARTIAL (2026-11-12; all screens translated, native review and device/user tests remain). H28 backlog is in `11` §4. All role screens are now reachable (`11` §8); Inventory/Tournaments have no app screens; H27 device steps in `10` §6.
>
> H27 follow-ups (see `10` §5–6): rebuild the APK and run native E2E on a real Android phone (`NATIVE-001`); notifications delivered in-app (`10` §9); push built, needs EAS project + FCM + `PUSH_PROVIDER=expo` to switch on (`10` §10); SMS/email not done; worker routes restricted and scheduled (`10` §8); per-tenant feature flags done (`10` §12); hide other disabled R2/R3 entry points in the app; repeat PostgreSQL checks on the managed production database.
>
> H26 follow-ups: Gemini integrated and live-verified (`AI-LIVE-001` closed); live red-team passed (`AI-SEC-001`); still open: paid-tier Gemini key for real data, native-speaker review of BM/Tamil assistant strings, physical-device check of the Ask tab, and removal of `process.exit(0)` from the 27 older backend test files.

---

## 1. Task H26 (implemented — see `09_H26_ROLE_AWARE_AI.md`)

**Task H26: Role-Aware Grounded AI Assistant**
* **Dependencies**: H20 (Learning Library) / H23 (Growth Analytics)
* **Contract**: `answerAuthorizedQuestion(actor, query, context) -> answerWithSources`
* **Release Mode**: Strictly **READ-ONLY** in initial release.
* **Non-Negotiable Boundaries**:
  - No autonomous operational changes.
  - No autonomous grading or belt rank changes.
  - No autonomous payment processing or refunds.
  - Server-side authorization *before* retrieval.
  - Zero cross-tenant data retrieval.
  - Super Admin is strictly denied access to individual child operational records.
* **Provider Strategy**: Maintainable server-side provider abstraction (Gemini API integration with deterministic test doubles). Provider credentials must never be bundled in mobile builds.

---

## 2. Roadmap Work Beyond H26

### Task H27: Advanced Release Certification
* Comprehensive cross-role end-to-end regression across all 25 modules.
* Formal rehearsal of backup and recovery runbooks (`docs/BACKUP_AND_RECOVERY.md`).
* Production database migration dry-run on managed PostgreSQL.
* Physical device smoke tests for QR scanning and offline queue syncing.

### Task H28: Continuous Localization and Usability
* Complete the Google Stitch design system migration for the remaining 31 screens.
* Finalize trilingual string verification (English, Bahasa Melayu, Tamil) across all screens and notification outbox templates.
* Accessibility audits (minimum 44x44 touch targets, color contrast, screen reader labels).

---

## 3. Stitch Screen Migration Backlog for H28

* **Auth & Public Screens (6)**: `WelcomeScreen`, `LoginScreen`, `ForgotPasswordScreen`, `SplashScreen`, `VerifyCertificateScreen`, `AuthenticatedPlaceholderScreen`.
* **System (1)**: `UnauthorizedRoleScreen`.
* **Super Admin (1)**: `superAdmin/index.tsx`.
* **Admin Persatuan (1)**: `HandoverApprovalsScreen.tsx`.
* **Master (12)**: `AttendanceScreen`, `ClassesScreen`, `CreateClassScreen`, `ClassProposalStatusScreen`, `ClassEnrollmentInboxScreen`, `ClassHandoverScreen`, `IncomingHandoversScreen`, `MasterApplicationStatusScreen`, `MasterGradingScreen`, `MasterMakeUpManagementScreen`, `MasterTransferManagementScreen`, `MasterTrialsFollowUpScreen`.
* **Parent (7)**: `FamilyTimelineHubScreen`, `AvailableClassesScreen`, `ParentBookTrialScreen`, `ParentFeesPaymentScreen`, `ParentMakeUpBookingScreen`, `ParentMasterMessagingScreen`, `ParentStudentLifecycleScreen`.
* **Student (3)**: `LearningLibraryRewardsScreen`, `MyApplicationsScreen`, `VideoFeedbackScreen`.
