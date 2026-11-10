# 01 — Project Overview

> Handover date: 2026-11-10  
> Source branch: `feat/phase2-native-and-integration`  
> Authoritative specification: `BeltFlow_Complete_Structure_Implementation_and_Handoff_v2.pdf`  
> Design authority: Google Stitch approved design (`BeltFlow Mobile.dc.html`, `BeltFlow.dc.html`)

---

## 1. Executive Summary

BeltFlow is a production-grade multi-tenant SaaS martial arts academy management platform built specifically for Malaysian and Southeast Asian persatuans, dojangs, and academies.

The repository contains the complete BeltFlow v2.0 application:
- **Backend**: Node.js, Express, TypeScript, and PostgreSQL (with embedded PGlite for deterministic zero-dependency local test automation and production-ready PostgreSQL migrations).
- **Mobile**: React Native and Expo SDK 52 application targeting Android and iOS, styled with the Google Stitch design system tokens and component architecture.
- **Security & Multi-Tenancy**: Zero-pooling multi-tenant data architecture strictly partitioned by `organization_id`, backed by cryptographic token verification, Ed25519 digital passes, and immutable audit ledgers.

---

## 2. Five-Role Role-Based Access Control (RBAC)

BeltFlow strictly implements exactly five global roles in `server/src/security/rbac.ts`:

1. **`SUPER_ADMIN`**:
   - Platform operator and infrastructure administrator.
   - Onboards Persatuans, manages platform settings, inspects aggregate health metrics.
   - **Crucial Boundary**: Strictly excluded from viewing individual child operational records, parent threads, or attendance details.

2. **`ADMIN_PERSATUAN`**:
   - Executive head of an individual academy / Persatuan.
   - Approves Master affiliations, approves class proposals, manages curriculum/syllabus versions, configures academy-level merchant gateways, audits finances.
   - Scoped strictly to their own `organization_id`.

3. **`MASTER`**:
   - Certified instructor or coach.
   - Proposes classes, manages class rosters, takes attendance via QR scanner or manual roster, evaluates student technique checklists, nominates students for grading examinations.
   - Can only operate on classes where they hold active, authorized leadership.

4. **`PARENT`**:
   - Verified guardian of enrolled students.
   - Views linked children's attendance, progress, and upcoming grading; receives notices; pays monthly academy dues; books trials and make-up classes.
   - Strictly isolated to verified family relationships (unlinked or revoked parents have zero access).

5. **`STUDENT`**:
   - Martial arts practitioner.
   - Digital student pass with tamper-evident cryptographic QR code, technique syllabus checklist, learning library media, personal achievements and rewards.
   - Cannot view other students' records or modify belt ranks.

*Note*: Secondary designations (e.g. Tournament Judge, Mat Referee, Substitute Instructor) are scoped permission grants or class delegations, never new global user roles.

---

## 3. Technology Stack & Directory Structure

```text
BeltFlow SaaS Platform/
├── mobile/                     # React Native / Expo Native App
│   ├── src/
│   │   ├── components/
│   │   │   ├── stitch/         # Approved Google Stitch Design Components
│   │   │   └── ...             # Reusable Card, Button, Layout primitives
│   │   ├── database/           # Offline SQLite repositories & mutation sync queue
│   │   ├── hooks/              # Data fetching, auth, and offline state hooks
│   │   ├── screens/            # 42 screens across the five user roles & auth flows
│   │   ├── services/           # Typed API clients for backend endpoints
│   │   └── theme/              # StitchTokens, color palettes, spacing & typography
│   └── package.json            # Expo 52, React 19, React Native 0.86
├── server/                     # Backend Express API Service
│   ├── src/
│   │   ├── db/                 # schema.sql (25 schema milestones) & DB client
│   │   ├── routes/             # Scoped REST routes (auth, classes, grading, etc.)
│   │   ├── security/           # RBAC middleware, Ed25519 crypto, JWT verification
│   │   ├── services/           # Business logic & outbox notification handlers
│   │   └── tests/              # 36 automated integration test suites (H00–H25)
│   └── package.json            # Node.js backend dependencies & scripts
├── docs/                       # Release checklists, UAT reports & handovers
│   ├── claude-handover/        # Claude Code handover documentation suite
│   └── ...
├── release-testing/            # Verified native testing artifacts
│   └── beltflow-v2.0-testing.apk (211,974,000 bytes, SHA-256: 51BAB6...)
└── BeltFlow_Complete_Structure_Implementation_and_Handoff_v2.pdf  # Authoritative Spec
```

---

## 4. Key Security & Multi-Tenancy Invariants

- **Authorization Before Retrieval**: Every backend endpoint verifies `actorId`, `role`, and `organizationId` from authenticated server session state before reading database tables.
- **Tenant Isolation**: All database queries enforce `WHERE organization_id = $1`. Cross-tenant querying is strictly denied.
- **Parent Row Locking**: Seat booking, trial conversion, and tournament operations acquire row-level locks on parent aggregates to prevent concurrent over-enrollment races.
- **Immutable Financial Ledgers**: Tuition payments and merchandise orders write sequential receipt numbers to append-only ledgers. Settlement cannot be inferred from client-side redirects.
