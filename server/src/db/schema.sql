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

-- 4. Classes / Mat Sessions (Main Master is a class assignment)
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    master_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    main_master_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    schedule VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
