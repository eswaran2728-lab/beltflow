-- BeltFlow PostgreSQL Relational Schema
-- Enforces Multi-Tenant Isolation, Foreign Keys, and RBAC Boundaries
-- Approved Roles: SUPER_ADMIN, ADMIN_PERSATUAN, MASTER, STUDENT, PARENT

-- 1. Custom Role Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN_PERSATUAN', 'MASTER', 'STUDENT', 'PARENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Organizations (Persatuans / Academies)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(100) NOT NULL,
    martial_art_style VARCHAR(100) NOT NULL,
    master_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    base_monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 120.00,
    sibling_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users (Server-side password hashing with PBKDF2/SHA-256)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Instructor rank/title (e.g. "3rd Dan Instructor"). Additive column so it
-- applies to a database created before this field existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_level VARCHAR(255);

-- 4. Classes / Mat Sessions (Main Master is a class assignment)
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    master_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    main_master_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    schedule VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    -- Monthly tuition fee, owned and set exclusively by the class's assigned
    -- Master (see classes.routes.ts PATCH /:classId/fee). Persatuan Admins
    -- may view it but may not edit it. Changing this value only affects
    -- future billing — it is never applied retroactively to existing
    -- payments/receipts, which store their own independent amount.
    monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 120.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migration guard: existing deployments created before per-class fees existed
-- get the column added and backfilled exactly once, from each class's own
-- organization's legacy base_monthly_fee, so no class silently starts at the
-- schema default (120.00) instead of the fee it was actually operating under.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='monthly_fee') THEN
        ALTER TABLE classes ADD COLUMN monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 120.00;
        UPDATE classes c SET monthly_fee = o.base_monthly_fee
        FROM organizations o WHERE o.id = c.organization_id;
    END IF;
END $$;

-- 5. Coach / Master Class Assignments
CREATE TABLE IF NOT EXISTS coach_class_assignments (
    coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    is_main_master BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (coach_id, class_id)
);

-- 6. Students Roster
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    ic_number VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    belt_rank VARCHAR(100) NOT NULL DEFAULT 'White Belt',
    monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 120.00,
    has_sibling_discount BOOLEAN NOT NULL DEFAULT FALSE,
    billing_status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Parent-Student Links (3-step approval workflow)
CREATE TABLE IF NOT EXISTS parent_student_links (
    id TEXT NOT NULL DEFAULT ('plink_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6)),
    parent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    -- PENDING_STUDENT → PENDING_MASTER → PENDING_ADMIN → ACTIVE (or REJECTED)
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_STUDENT',
    student_approved BOOLEAN NOT NULL DEFAULT false,
    master_approved BOOLEAN NOT NULL DEFAULT false,
    admin_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS class_transfer_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    old_class_id TEXT NOT NULL REFERENCES classes(id),
    new_class_id TEXT NOT NULL REFERENCES classes(id),
    old_master_approved BOOLEAN NOT NULL DEFAULT FALSE,
    new_master_approved BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_OLD_MASTER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Migration guard: add new columns to existing deployments that have the old schema
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parent_student_links' AND column_name='student_approved') THEN
        ALTER TABLE parent_student_links
            ADD COLUMN id TEXT,
            ADD COLUMN student_approved BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN master_approved BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN admin_approved BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        -- Back-fill existing ACTIVE rows so all approvals are set
        UPDATE parent_student_links SET student_approved=true, master_approved=true, admin_approved=true WHERE status='ACTIVE';
    END IF;
END $$;

-- 8. Attendance Sessions & Records
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_date VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (class_id, session_date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_date VARCHAR(20) NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'present',
    marked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, session_date, student_id)
);

-- 9. Invoices & Payments
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    billing_month VARCHAR(7) NOT NULL,
    base_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    final_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL DEFAULT 'DuitNow QR',
    proof_notes TEXT,
    receipt_no VARCHAR(100),
    submitted_by TEXT NOT NULL REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Receipt numbers are the audit/financial identifier for an approved payment.
-- Pending/rejected payments have no receipt (NULL, unconstrained); once issued,
-- a receipt number must be unique across the whole platform.
CREATE UNIQUE INDEX IF NOT EXISTS payments_receipt_no_unique
    ON payments (receipt_no) WHERE receipt_no IS NOT NULL;

-- Which specific billing month(s) (monthly_dues.id) a payment was submitted
-- to cover. Nullable/legacy: older payments predating this ledger, and any
-- payment not tied to a specific month, simply have this unset — never
-- backfilled, since that would be inventing a fact that was never recorded.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_month_ids TEXT[];

-- 9b. Monthly Billing Ledger — one immutable-once-generated row per student
-- per calendar month. This is the actual source of truth for "how many
-- months are pending" and "how much is outstanding" — never derived solely
-- from students.billing_status, which is only a coarse last-payment flag.
--
-- fee_amount is captured AT GENERATION TIME from the student's current
-- monthly_fee (itself kept in sync with the assigned class's monthly_fee —
-- see classes.routes.ts PATCH /:classId/fee). A later class fee change can
-- therefore only ever affect months generated AFTER the change; every
-- already-generated row keeps the fee it was actually billed at, forever.
CREATE TABLE IF NOT EXISTS monthly_dues (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    billing_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    fee_amount NUMERIC(10, 2) NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    -- 'Pending' | 'Partially Paid' | 'Paid'. 'Overdue' is deliberately NOT a
    -- stored state — it is purely a function of the current date vs
    -- billing_month and is computed at read time, so it can never go stale.
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- One bill per student per month, full stop. Re-running generation for
    -- a month that already has a row for that student is a safe no-op.
    UNIQUE (student_id, billing_month)
);

-- Which payment(s) were applied to which monthly bill, and how much of that
-- payment went to it — this is what makes partial payments and a single
-- payment covering multiple months both safely representable without ever
-- rewriting a payment's own stored amount/receipt_no.
CREATE TABLE IF NOT EXISTS monthly_due_payments (
    id TEXT PRIMARY KEY,
    monthly_due_id TEXT NOT NULL REFERENCES monthly_dues(id) ON DELETE CASCADE,
    payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount_applied NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9c. Training Groups, Schedules, Sessions & Notices
--
-- Real academy hierarchy: Persatuan -> class/location (existing `classes`
-- table, e.g. "Sungai Pelek") -> assigned Master (existing
-- coach_class_assignments) -> training groups (Kids/Teenagers/All Ages) ->
-- schedules (the Master's recurring or one-time plan) -> sessions (an
-- actual dated training event) -> attendance (one status per student per
-- session). The Persatuan assigns a Master to a class/location ONCE via
-- coach_class_assignments; everything below this level is the assigned
-- Master's own operational domain, never the Persatuan's.
--
-- This block is purely additive: it introduces new tables only and never
-- alters attendance_sessions/attendance_records, so every existing class,
-- assignment, student, payment, due, receipt and attendance row is
-- preserved exactly as-is. There is nothing to "migrate" data-wise for
-- groups/schedules/sessions/notices, since they are new concepts with no
-- prior representation — an existing class simply starts with zero groups
-- until its assigned Master creates real ones.

CREATE TABLE IF NOT EXISTS training_groups (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, name)
);

-- The assigned Master's manually-entered recurring or one-time plan. No
-- fixed weekday/location enum by design — day_of_week and location are
-- free text the Master types; start_time/end_time are free text (e.g.
-- "5:00 PM") to match how the Master would naturally write it.
CREATE TABLE IF NOT EXISTS class_schedules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES training_groups(id) ON DELETE CASCADE,
    day_of_week VARCHAR(50) NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    location VARCHAR(255) NOT NULL,
    recurring BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An actual dated training event, whether generated from a recurring
-- schedule or created directly as a one-time extra session (schedule_id is
-- NULL for a pure extra session with no template). Deliberately a separate
-- table from the legacy attendance_sessions (class_id, session_date) —
-- that table has no concept of a group, so two groups meeting on the same
-- calendar date under the same class/location could never coexist there.
CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES training_groups(id) ON DELETE CASCADE,
    schedule_id TEXT REFERENCES class_schedules(id) ON DELETE SET NULL,
    session_date VARCHAR(20) NOT NULL, -- 'YYYY-MM-DD'
    day_of_week VARCHAR(50) NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    location VARCHAR(255) NOT NULL,
    is_extra BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    -- 'Scheduled' | 'Completed' | 'Cancelled'
    status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    cancelled_reason TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Re-generating from the same schedule for the same date is a safe
    -- no-op; a schedule-less (schedule_id NULL) extra session is never
    -- deduplicated this way since NULL never equals NULL in a UNIQUE index.
    UNIQUE (schedule_id, session_date)
);

-- One attendance status per student per actual session — distinct from the
-- legacy attendance_records table, which has no session/group concept.
CREATE TABLE IF NOT EXISTS session_attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    -- 'Present' | 'Late' | 'Absent' | 'Excused'
    status VARCHAR(20) NOT NULL DEFAULT 'Present',
    marked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (session_id, student_id)
);

-- Persistent in-app notices — no external email/SMS/paid service. Visible
-- only to students enrolled in the relevant class/group and their linked
-- parents (enforced in notices.routes.ts by joining students/parent_student_links,
-- never by trusting a client-supplied recipient list).
CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES training_groups(id) ON DELETE CASCADE, -- NULL = whole class
    session_id TEXT REFERENCES training_sessions(id) ON DELETE SET NULL,
    -- 'NEW_SCHEDULE' | 'SCHEDULE_CHANGE' | 'CANCELLED' | 'EXTRA_SESSION' | 'GENERAL'
    type VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A student's individually-set fee/discount ALWAYS takes precedence over
-- the class's whole fee. When fee_override is true, changing the class fee
-- (classes.routes.ts PATCH /:classId/fee) must skip this student entirely —
-- their monthly_fee stays exactly what the Master set for them until the
-- Master explicitly changes or clears the override.
ALTER TABLE students ADD COLUMN IF NOT EXISTS fee_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES training_groups(id) ON DELETE SET NULL;

-- Audited, immutable, insert-only correction trail for an already-approved
-- payment or an already-generated monthly due. Approved payments/issued
-- receipts/generated dues are NEVER edited in place — every correction is a
-- new row here recording the original and corrected values, who made the
-- change and why, so the history can never be silently altered.
CREATE TABLE IF NOT EXISTS payment_corrections (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
    monthly_due_id TEXT REFERENCES monthly_dues(id) ON DELETE SET NULL,
    original_amount NUMERIC(10, 2) NOT NULL,
    corrected_amount NUMERIC(10, 2) NOT NULL,
    original_status VARCHAR(50),
    corrected_status VARCHAR(50),
    reason TEXT NOT NULL,
    corrected_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    corrected_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Belt Gradings & Candidates
CREATE TABLE IF NOT EXISTS grading_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    event_date VARCHAR(20) NOT NULL,
    location VARCHAR(255) NOT NULL,
    fee NUMERIC(10, 2) NOT NULL DEFAULT 60.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grading_candidates (
    id TEXT PRIMARY KEY,
    grading_event_id TEXT NOT NULL REFERENCES grading_events(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    current_belt VARCHAR(100) NOT NULL,
    target_belt VARCHAR(100) NOT NULL,
    result VARCHAR(50) NOT NULL DEFAULT 'Registered',
    notes TEXT,
    graded_at TIMESTAMPTZ
);

-- 11. Certificates (Authenticated Verification Required)
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    master_name VARCHAR(255) NOT NULL,
    rank_or_title VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Promotion Exam',
    issue_date VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Curriculum Skills & Student Progress
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_skills (
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level VARCHAR(50) NOT NULL DEFAULT 'Learning',
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, skill_id)
);

-- 13. Tournaments & Medals
CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    event_date VARCHAR(20) NOT NULL,
    location VARCHAR(255) NOT NULL,
    categories TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Upcoming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_participants (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    medal VARCHAR(50) NOT NULL DEFAULT 'Participant',
    cert_code VARCHAR(50),
    awarded_at TIMESTAMPTZ
);

-- 14. Platform & Tenant Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Offline Attendance Synchronization & Replay Protection (Task 2.3)
CREATE TABLE IF NOT EXISTS processed_sync_mutations (
    mutation_id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    client_timestamp TIMESTAMPTZ,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processed_sync_org_actor ON processed_sync_mutations(organization_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_processed_sync_session_student ON processed_sync_mutations(session_id, student_id);

ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 16. Authority Relationships & Persatuan Approval Foundation (Task H02)

-- A. Master Affiliations (durable relationship between a Master and an individual Persatuan)
CREATE TABLE IF NOT EXISTS master_affiliations (
    id TEXT PRIMARY KEY,
    master_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED'
    effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMPTZ,
    verification_provenance VARCHAR(50) NOT NULL DEFAULT 'DIRECT_REVIEW', -- 'LEGACY_MIGRATION', 'DIRECT_REVIEW', 'FEDERATION_TRANSFER'
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_affiliations_active
    ON master_affiliations (master_id, organization_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_master_affiliations_org_status
    ON master_affiliations (organization_id, status);

-- B. Master Applications (supports future H03 lifecycle)
CREATE TABLE IF NOT EXISTS master_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED', -- 'DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'WITHDRAWN'
    documents_url TEXT,
    experience_summary TEXT,
    version INT NOT NULL DEFAULT 1,
    reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- C. Class Proposals & Approval States (H04 lifecycle)
CREATE TABLE IF NOT EXISTS class_applications (
    id TEXT PRIMARY KEY,
    class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    proposing_master_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    schedule VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    venue_details TEXT,
    age_eligibility VARCHAR(100),
    training_level VARCHAR(100),
    program_type VARCHAR(100),
    capacity INT NOT NULL DEFAULT 30,
    enrollment_availability VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'WAITLIST', 'CLOSED'
    description TEXT,
    contact_channel VARCHAR(255),
    monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 120.00,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'WITHDRAWN'
    requested_information TEXT,
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migration guard: add new columns to class_applications if already created
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS venue_details TEXT;
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS age_eligibility VARCHAR(100);
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS training_level VARCHAR(100);
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS program_type VARCHAR(100);
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 30;
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS enrollment_availability VARCHAR(50) NOT NULL DEFAULT 'OPEN';
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS contact_channel VARCHAR(255);
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS requested_information TEXT;
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE class_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Additive operational, enrollment and proposal provenance columns on classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'; -- 'NOT_STARTED', 'ACTIVE', 'PAUSED', 'CLOSED'
ALTER TABLE classes ADD COLUMN IF NOT EXISTS enrollment_availability VARCHAR(50) NOT NULL DEFAULT 'OPEN'; -- 'OPEN', 'WAITLIST', 'CLOSED'
ALTER TABLE classes ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED'; -- 'APPROVED', 'PENDING', 'REJECTED'
ALTER TABLE classes ADD COLUMN IF NOT EXISTS venue_details TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS age_eligibility VARCHAR(100);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS training_level VARCHAR(100);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS program_type VARCHAR(100);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 30;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS contact_channel VARCHAR(255);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS proposing_master_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS application_id TEXT REFERENCES class_applications(id) ON DELETE SET NULL;

-- D. Class Leadership History (prevents overlapping primary leaders, tracks substitutes)
CREATE TABLE IF NOT EXISTS class_leaderships (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    master_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    leadership_type VARCHAR(50) NOT NULL DEFAULT 'PRIMARY', -- 'PRIMARY', 'SUBSTITUTE', 'INTERN'
    effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    appointed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    provenance VARCHAR(50) NOT NULL DEFAULT 'DIRECT_ASSIGNMENT', -- 'LEGACY_MIGRATION', 'DIRECT_ASSIGNMENT', 'HANDOVER'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_leaderships_active_primary
    ON class_leaderships (class_id) WHERE is_active = TRUE AND leadership_type = 'PRIMARY';
CREATE INDEX IF NOT EXISTS idx_class_leaderships_master
    ON class_leaderships (master_id, is_active);

-- E. Canonical Student Enrollments & Applications (supports future H05 lifecycle)
CREATE TABLE IF NOT EXISTS class_enrollments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'APPLIED', 'ACTIVE', 'TRANSFERRED', 'PAUSED', 'ENDED'
    effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMPTZ,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    provenance VARCHAR(50) NOT NULL DEFAULT 'MASTER_APPROVED', -- 'LEGACY_MIGRATION', 'MASTER_APPROVED', 'ADMIN_REGISTERED', 'TRANSFER'
    approved_by_master_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_enrollments_active_class
    ON class_enrollments (student_id, class_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student
    ON class_enrollments (student_id, status);

CREATE TABLE IF NOT EXISTS enrollment_applications (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    guardian_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED', -- 'DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'WAITLISTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'
    version INT NOT NULL DEFAULT 1,
    reviewed_by_master_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Additive columns on master_applications (Task H03)
ALTER TABLE master_applications ADD COLUMN IF NOT EXISTS applicant_name VARCHAR(255);
ALTER TABLE master_applications ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE master_applications ADD COLUMN IF NOT EXISTS verification_details TEXT;
ALTER TABLE master_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE master_applications ADD COLUMN IF NOT EXISTS requested_information TEXT;
ALTER TABLE master_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 17. Notification & Event Outbox (Task H03)
CREATE TABLE IF NOT EXISTS notification_outbox (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'MasterApproved', 'MasterRejected', 'MasterInformationRequested'
    aggregate_type VARCHAR(50) NOT NULL, -- 'master_application', 'class_application'
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_org_status ON notification_outbox(organization_id, status);



