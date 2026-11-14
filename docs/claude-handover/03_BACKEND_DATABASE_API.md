# 03 — Backend Architecture, Database & APIs

> Backend Directory: `server/`  
> Language & Runtime: TypeScript 5.5, Node.js (v20+ / LTS), Express 4  
> Database: PostgreSQL (native managed instance) with embedded `@electric-sql/pglite` for local test automation

---

## 1. Database Architecture & Schema Structure

The PostgreSQL schema is centrally maintained in `server/src/db/schema.sql`. It contains 25 logical modules executed through idempotent `CREATE TABLE IF NOT EXISTS` statements.

### Key Database Tables by Domain:

1. **Core & Multi-Tenancy**:
   - `organizations` (Persatuans / Dojangs, identified by `organization_id`)
   - `users` (Global users with hashed passwords and global role assignment)
   - `organization_members` (Tenant membership association and operational status)

2. **Master Leadership & Verification**:
   - `master_applications` (Credential submissions, certification status)
   - `class_leaderships` (Current and historical class instructor assignments)
   - `class_delegations` (Temporary substitute Master authority with explicit expiration)

3. **Curriculum, Classes & Schedules**:
   - `curricula` & `belt_ranks` (Tenant-versioned syllabus hierarchy)
   - `technique_requirements` (Granular checklist items for each belt)
   - `classes` & `class_schedules` (Weekly schedule rules, venues, capacities)
   - `class_sessions` (Dated real-world classes with cancellation and attendance locks)

4. **Enrollment, Attendance & Progress**:
   - `students` & `student_enrollments` (Enrollment state: PENDING, ACTIVE, WITHDRAWN)
   - `attendance_records` (Session attendance, check-in timestamps, verification method)
   - `student_skill_evaluations` (Technique sign-offs by authorized Masters)
   - `grading_events`, `grading_candidates` & `certificates` (Exam records and tamper-evident digital certs)

5. **Financial Operations & Merchant Isolation**:
   - `merchant_accounts` (Tenant-specific payment credentials; never pooled across academies)
   - `fee_ledger_items` (Tuition charges, monthly dues)
   - `payment_records` & `receipts` (Append-only receipt numbers, audited adjustments)

6. **Advanced Operational Modules (H16–H25)**:
   - `trial_sessions` (Trial leads, attendance, and conversion tracking)
   - `class_waitlists` & `makeup_bookings` (Seat reservation with auto-expiry worker)
   - `membership_transfers` (Inter-academy student transfers with scheduled effective dates)
   - `lesson_plans` & `student_feedbacks` (Syllabus publications and S3 video reviews)
   - `parent_messages` & `moderation_reports` (Direct parent-coach messaging)
   - `tournaments`, `tournament_categories`, `matches` & `tournament_appeals` (Competition operations)
   - `equipment_products`, `inventory_items` & `merchandise_orders` (Pro shop commerce)

---

## 2. API Endpoints Overview

All REST routes are prefixed with `/api/v1` and protected by `authenticateToken` and `enforceRole` middleware.

| Route File | Base Path | Core Responsibilities |
| :--- | :--- | :--- |
| `auth.routes.ts` | `/auth` | Login, password reset, self-service setup, profile retrieval |
| `classes.routes.ts` | `/classes` | Class proposals, approvals, active roster management, schedules |
| `attendance.routes.ts` | `/attendance` | Mobile batch sync, live session check-ins, manual corrections |
| `grading.routes.ts` | `/grading` | Exam registration, grading score finalization, certificate verification |
| `payments.routes.ts` | `/payments` | Merchant setup, dues queries, checkout intents, receipt history |
| `trials.routes.ts` | `/trials` | Trial lesson scheduling, trial check-in, student conversion |
| `bookings.routes.ts` | `/bookings` | Make-up class bookings, waitlist seat offers and cancellations |
| `transfers.routes.ts` | `/transfers` | Academy transfer proposals, parent consent, scheduled activations |
| `feedback.routes.ts` | `/feedback` | Video upload presigning, magic byte validation, review notes |
| `messaging.routes.ts` | `/messaging` | Class-scoped parent-master conversations, moderation reports |
| `analytics.routes.ts` | `/analytics` | Financial growth reports, student retention metrics, CSV exports |
| `tournaments.routes.ts`| `/tournaments`| Category creation, competitor registration, match scoring, appeals |
| `equipment.routes.ts` | `/equipment` | Inventory stock management, cart reservations, order fulfillment |

---

## 3. Running Backend Tests & Compilation

```bash
cd server
npm ci
npx tsc --noEmit           # Typecheck passes with 0 errors
npm run build              # Compiles TypeScript to dist/ and copies schema.sql
npm test                   # Executes all 36 test suites covering H00 to H25
```
