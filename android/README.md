# BeltFlow — Martial Arts Academy Management (Android Native)

BeltFlow is a full-featured martial arts academy management application built for Android using **Kotlin**, **Jetpack Compose (Material 3)**, and **Room Database**.

Originally imported from Next.js, this project has been completely rewritten as a native Android application, faithfully preserving and enhancing all core business features, role portals, grading workflows, sibling billing discounts, and certificate verification.

---

## 🥋 Core Ported Features & Modules

1. **Multi-Role Authentication & Portals**:
   - **Admin Portal (Master Eswaran)**: Academy overview, KPI metrics, student retention risk alerts, pending account approvals, financial summaries.
   - **Coach Portal (Master Ravi)**: Assigned martial arts classes, quick session attendance marker, pending cash approval sheet.
   - **Parent Portal (Suresh Kumar)**: Multi-child switcher, attendance %, fee payment claims with cash proof submission, instructor observation notes.
   - **Student Portal (Aryan Suresh)**: Belt milestone progress, technique syllabus mastery tracker, verifiable certificates & tournament medals gallery.

2. **Student Bio & Lifecycle Tracking**:
   - Comprehensive bio tracking: IC/MyKid number, DOB, age, gender, guardian details with WhatsApp integration, medical notes.
   - Belt rank progression, assigned classes, and active/trial/frozen lifecycle management.

3. **Attendance & Retention Alerts**:
   - Session roster marking with 4 status options: **Present**, **Late**, **Absent**, **Excused**.
   - **At-Risk Detection**: Automatically identifies students with 3+ consecutive absences and provides 1-tap WhatsApp communication with parents.

4. **Fee Billing, Sibling Discounts & Official Receipts**:
   - Monthly invoice generation with automated **10% Sibling Discount** for 2nd and subsequent enrolled siblings.
   - Cash claim workflow with coach/admin verification.
   - Sequential official receipt generation with formatted printable dialogs.

5. **Belt Gradings & Examinations**:
   - Examination event scheduler (Examiner, location, grading fees).
   - Candidate registration (current belt $\rightarrow$ target belt).
   - Scoring (Pass, Double Promotion, Retest, Fail) with **automatic belt promotion** and **instant digital certificate issuance**.

6. **Curriculum & Technique Syllabus**:
   - Categorized techniques: *Foundation*, *Weapons*, *Sparring*, *Forms*.
   - 4-Tier mastery tracking: *Not Started*, *Learning*, *Good*, *Mastered*.

7. **Tournaments & Medal Tally**:
   - Medal registry (Gold 🥇, Silver 🥈, Bronze 🥉, Participation) with automatic tournament achievement certificates.

8. **Public Certificate Verification**:
   - Dedicated verification portal to validate authentic certificates by verification code (e.g., `BF-ORANGE-9821`).

---

## 🛠️ Technology Stack & Architecture

- **UI**: Jetpack Compose, Material 3 Design System, Edge-to-Edge window insets.
- **Architecture**: MVVM with Repository Pattern, Kotlin Coroutines, and reactive `StateFlow`/`Flow`.
- **Data Persistence**: Room Database (`BeltFlowDatabase`) with automated sample data seeding.
- **Navigation**: Navigation Compose with type-safe `@Serializable` routes.
