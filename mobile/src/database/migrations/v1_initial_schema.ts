import { Migration } from './types';
import { DatabaseConnection } from '../adapter';

export const v1InitialSchema: Migration = {
  version: 1,
  name: 'v1_initial_schema',
  up: async (db: DatabaseConnection) => {
    await db.execAsync(`
      -- 1. Cached Classes (Authorized classes belonging to organization)
      CREATE TABLE IF NOT EXISTS cached_classes (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        schedule TEXT,
        location TEXT,
        monthly_fee REAL NOT NULL DEFAULT 0.0,
        master_id TEXT,
        cached_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cached_classes_org
        ON cached_classes(organization_id);

      -- 2. Cached Training Groups (Kids, Juniors, Seniors, Sparring Squad)
      CREATE TABLE IF NOT EXISTS cached_training_groups (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        class_id TEXT NOT NULL REFERENCES cached_classes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        cached_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cached_groups_class
        ON cached_training_groups(class_id);

      -- 3. Cached Students Roster
      -- PRIVACY HARDENING: No IC/NRIC, banking, or credential fields are stored here.
      CREATE TABLE IF NOT EXISTS cached_students (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        class_id TEXT REFERENCES cached_classes(id) ON DELETE SET NULL,
        group_id TEXT REFERENCES cached_training_groups(id) ON DELETE SET NULL,
        full_name TEXT NOT NULL,
        belt_rank TEXT NOT NULL DEFAULT 'White Belt',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        photo_url TEXT,
        cached_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cached_students_class_group
        ON cached_students(class_id, group_id);
      CREATE INDEX IF NOT EXISTS idx_cached_students_org
        ON cached_students(organization_id);

      -- 4. Cached Training Sessions
      CREATE TABLE IF NOT EXISTS cached_training_sessions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        class_id TEXT NOT NULL REFERENCES cached_classes(id) ON DELETE CASCADE,
        group_id TEXT REFERENCES cached_training_groups(id) ON DELETE SET NULL,
        schedule_id TEXT,
        session_date TEXT NOT NULL,
        day_of_week TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        status TEXT NOT NULL DEFAULT 'Scheduled',
        cached_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cached_sessions_class_date
        ON cached_training_sessions(class_id, session_date);

      -- 5. Offline Attendance Mutation Queue
      CREATE TABLE IF NOT EXISTS attendance_mutation_queue (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        status TEXT NOT NULL,
        base_version INTEGER NOT NULL DEFAULT 1,
        retry_count INTEGER NOT NULL DEFAULT 0,
        queue_status TEXT NOT NULL DEFAULT 'PENDING',
        last_error TEXT,
        client_timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        correction_of_mutation_id TEXT REFERENCES attendance_mutation_queue(id) ON DELETE SET NULL,
        sequence_number INTEGER NOT NULL DEFAULT 1,
        UNIQUE(idempotency_key, sequence_number)
      );

      CREATE INDEX IF NOT EXISTS idx_mutation_queue_pending
        ON attendance_mutation_queue(organization_id, queue_status);
      CREATE INDEX IF NOT EXISTS idx_mutation_queue_session_student
        ON attendance_mutation_queue(session_id, student_id);

      -- 6. Synchronization Conflict Log
      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        mutation_id TEXT REFERENCES attendance_mutation_queue(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        local_status TEXT NOT NULL,
        server_status TEXT NOT NULL,
        server_timestamp TEXT,
        conflict_reason TEXT NOT NULL,
        resolution TEXT NOT NULL DEFAULT 'PENDING',
        resolved_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sync_conflicts_org
        ON sync_conflicts(organization_id, resolution);

      -- 7. Sync Metadata Storage
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
