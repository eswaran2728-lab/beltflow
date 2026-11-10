# 07 — Pending Work & Development Priorities

> Current Milestone: Handover complete; ready for Task H26.

---

## 1. Immediate Next Development Task: Task H26

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
