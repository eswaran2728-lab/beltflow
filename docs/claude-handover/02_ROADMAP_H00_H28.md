# 02 — Roadmap H00–H28 Verification & Status

> Official Roadmap: 29 milestone tasks (H00 through H28).  
> Current status as of 2026-11-10: H00–H25 COMPLETED (100% test passing), H26 NOT STARTED, H27 NOT STARTED, H28 ~65% PARTIALLY COMPLETE.

---

## 1. Verified Roadmap Status Matrix

| Task | Title | Status | Backend Test Suite | Key Invariants Verified |
| :--- | :--- | :---: | :--- | :--- |
| **H00** | Phase 2 Architecture & RBAC | **DONE** | `server_rbac.test.ts` | 5 global roles; Super Admin excluded from child data |
| **H01** | Multi-Tenant Schema & Isolation | **DONE** | `transaction_pool.test.ts` | Connection pool safety, transaction rollback, tenant scoping |
| **H02** | Authority & Legacy Migration | **DONE** | `authority_relationships.test.ts` | 22 migration & leadership scenarios verified |
| **H03** | Master Verification & Affiliation | **DONE** | `master_verification.test.ts` | Admin verification required before Master acts |
| **H04** | Class Lifecycle & Discovery | **DONE** | `class_lifecycle.test.ts` | Master proposes; Admin approves; discovery excludes pending |
| **H05** | Student Enrollment & Approvals | **DONE** | `student_enrollment.test.ts` | Master approves applications; capacity limits enforced |
| **H06** | Master Workspace & Rosters | **DONE** | `master_class_workspace.test.ts` | Active roster filtering, today's sessions derivation |
| **H07** | Master Handover & Substitution | **DONE** | `master_handover.test.ts` | Delegated leadership; revoked substitute auto-cutoff |
| **H08** | Tamper-Evident QR Digital Pass | **DONE** | `qr_pass_security.test.ts` | Ed25519 signatures, zero PII, offline scan cache |
| **H09** | Persatuan Curriculum & Syllabus | **DONE** | `persatuan_curriculum.test.ts` | Versioned belt ranks, technique checklists, requirements |
| **H10** | Class Scheduling & Sessions | **DONE** | `class_scheduling.test.ts` | Schedule recurrence, holiday blackout, cancellation |
| **H11** | Student Safety & Notices | **DONE** | `student_safety_notices.test.ts` | Emergency contacts, mandatory guardian acknowledgements |
| **H12** | Grading Examinations & Certs | **DONE** | `grading_progression_h12.test.ts` | Atomic rank progression, public cert verification (CERT-001) |
| **H13** | Payments & Merchant Separation | **DONE** | `persatuan_payments_h13.test.ts` | Tenant merchant isolation, append-only receipt ledgers |
| **H14** | Academy Setup & Legacy Imports | **DONE** | `academy_onboarding_imports_h14.test.ts` | Dry-run validation, idempotent batch commits |
| **H15** | Core Pilot Certification | **DONE** | `core_pilot_certification_h15.test.ts` | Multi-tenant pilot benchmark, zero data leakage |
| **H16** | Trial Sessions & Conversions | **DONE** | `trials_retention_h16.test.ts` | Trial booking, conversion to enrolled student |
| **H17** | Waitlists & Make-Up Lessons | **DONE** | `makeup_waitlist_h17.test.ts` | Last-seat race protection, waitlist expiry worker |
| **H18** | Academy Transfers & Roaming | **DONE** | `membership_transfers_h18.test.ts` | Inter-academy transfers, future-dated activation |
| **H19** | Lesson Plans & Family Hub | **DONE** | `lesson_plans_family_hub_h19.test.ts` | Published syllabus visibility, family timeline feeds |
| **H20** | Learning Library & Rewards | **DONE** | `learning_library_rewards_h20.test.ts` | Role-gated videos, achievements, points ledger |
| **H21** | Private Video Feedback | **DONE** | `media_feedback_h21.test.ts` | S3 magic-byte validation, signed URLs, minor consent |
| **H22** | Parent-Master Messaging | **DONE** | `messaging_parent_master_h22.test.ts` | Active-enrollment thread gating, moderation reporting |
| **H23** | Growth Analytics & Exports | **DONE** | `growth_analytics_h23.test.ts` | Server-side financial aggregation, CSV formula sanitization |
| **H24** | Tournament Operations | **DONE** | `tournament_operations_h24.test.ts` | Category eligibility, match locking, appeals, preflight checks |
| **H25** | Equipment Commerce | **DONE** | `equipment_merchandise_h25.test.ts` | Stock reservations, inventory locking, cross-tenant denial |
| **H26** | **Role-Aware Grounded AI** | **NOT STARTED** | *(To be implemented)* | **Immediate next milestone** (Read-only, tenant-isolated) |
| **H27** | Advanced Release Certification | **NOT STARTED** | — | Production smoke test, recovery rehearsal certification |
| **H28** | Usability & Localization | **~65% DONE** | — | Staging & production runbooks written; 31 UI screens pending |

---

## 2. Immediate Next Objective: Task H26

**Task H26 Specification**:
* **Official Title**: Role-Aware Grounded AI Assistant
* **Contract**: `answerAuthorizedQuestion(actor, query, context) -> answerWithSources`
* **Mandatory Acceptance Criteria**:
  1. `retrieval_cross_tenant_denied` (Strictly zero knowledge leakage across Persatuans)
  2. `document_instruction_cannot_override_policy` (Prompt injection cannot alter system rules)
  3. `unknown_answer_admits_gap` (No hallucination when evidence is absent)
  4. `no_auto_grading_or_payment` (AI is informational only; no automated transactions)
  5. `Super_Admin_no_child_data` (Platform admins cannot query minor records)
