# 08 — Claude Code: Start Here

## Welcome to BeltFlow v2.0

You are developing the canonical **BeltFlow v2.0** multi-tenant martial arts academy SaaS platform.
The full repository has been verified, reconciled, and synchronized to GitHub on branch `feat/phase2-native-and-integration`.

---

## 1. Quick Verification Commands

Run these commands to verify your local environment:

```bash
# 1. Backend Verification
cd server
npm ci
npx tsc --noEmit           # Must pass with 0 errors
npm run build              # Compiles to dist/ and copies schema.sql
npm test                   # Runs all 42 test suites covering H00 to H27

# 2. Mobile Verification
cd ../mobile
npm ci
npm run typecheck          # Must pass with 0 errors across all 42 screens
npm test                   # Runs Jest component and unit test suites
```

---

## 2. Reading Order for Context

1. `docs/claude-handover/01_PROJECT_OVERVIEW.md` (Architecture, five roles, invariants)
2. `docs/claude-handover/02_ROADMAP_H00_H28.md` (Completed tasks H00–H25 and H26 spec)
3. `docs/claude-handover/03_BACKEND_DATABASE_API.md` (Express routes, PostgreSQL schema)
4. `docs/claude-handover/04_MOBILE_UI_STITCH.md` (Google Stitch tokens, 42-screen inventory)
5. `docs/claude-handover/05_TESTING_BUILD_RELEASE.md` (Automated tests, APK binary, release gates)
6. `docs/claude-handover/07_PENDING_WORK_AND_PRIORITIES.md` (H26 spec and H28 backlog)
7. `docs/claude-handover/09_H26_ROLE_AWARE_AI.md` and `10_H27_RELEASE_CERTIFICATION.md` (latest evidence)
8. Authoritative PDF: `BeltFlow_Complete_Structure_Implementation_and_Handoff_v2.pdf` at the repository root.

---

## 3. Non-Negotiable Architectural Rules

- **Five Global Roles Only**: `SUPER_ADMIN`, `ADMIN_PERSATUAN`, `MASTER`, `PARENT`, `STUDENT`. Never add new global roles (roles like Referee or Tournament Judge are scoped permissions).
- **Tenant Isolation**: Every database query must be scoped by `organization_id`. Never allow cross-academy data leaks.
- **Child Privacy**: Super Admin must NEVER be given access to individual child operational records, medical notes, or parent conversations.
- **Append-Only Financial Ledgers**: Tuition payments and merchandise orders write to append-only ledgers; never infer settlement from client-side redirects.
- **Read-Only AI in H26**: The AI Assistant must NEVER autonomously alter belt grades, approve student applications, or move money.
- **No Force-Pushing**: Never force-push or merge into `main` without explicit owner authorization.

---

## 4. Task H26 status (see `09_H26_ROLE_AWARE_AI.md`)

H26 PASS (see `09`). H27 CONDITIONAL PASS on 2026-11-10 (see `10`): 3 of 4 official tests pass on PGlite and real PostgreSQL 16; native E2E needs a real device. Release flags: `BELTFLOW_RELEASE`, `BELTFLOW_DISABLED_MODULES`. The next milestone is H28 and requires owner approval.

### Original H26 brief (kept for reference)

Your next development milestone is **Official Task H26: Role-Aware Grounded AI Assistant**.
Follow the **Superpowers methodology**:
`INSPECT → VERIFY → PLAN → TDD → IMPLEMENT → TEST → SECURITY REVIEW → CODE REVIEW → COMMIT → STOP`.

Implement the `assistant` module with the contract:
`answerAuthorizedQuestion(actor, query, context) -> answerWithSources`
enforcing all 5 official criteria:
1. `retrieval_cross_tenant_denied`
2. `document_instruction_cannot_override_policy`
3. `unknown_answer_admits_gap`
4. `no_auto_grading_or_payment`
5. `Super_Admin_no_child_data`
