/**
 * BeltFlow Mobile Local SQLite Database Models & Types
 * Multi-Tenant Offline Attendance Foundation
 */

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused';

export type QueueStatus = 'PENDING' | 'IN_FLIGHT' | 'SYNCED' | 'FAILED' | 'CONFLICT' | 'QUARANTINED';

export type ConflictResolution = 'PENDING' | 'RESOLVED_LOCAL' | 'RESOLVED_SERVER' | 'MANUAL_REQUIRED';

/**
 * 1. Cached Class (Authorized Mat Sessions for the Master/Student)
 */
export interface CachedClass {
  id: string;
  organization_id: string;
  name: string;
  schedule?: string | null;
  location?: string | null;
  monthly_fee: number;
  master_id?: string | null;
  cached_at?: string;
  updated_at?: string;
}

/**
 * 2. Cached Training Group (Kids, Teenagers, Seniors, Sparring Squad)
 */
export interface CachedTrainingGroup {
  id: string;
  organization_id: string;
  class_id: string;
  name: string;
  status: string;
  cached_at?: string;
  updated_at?: string;
}

/**
 * 3. Cached Student Roster (Authorized for check-in)
 * PRIVACY NOTICE: Sensitive PII (IC/NRIC numbers, financial bank accounts,
 * parent phone numbers) are deliberately EXCLUDED from local SQLite storage.
 */
export interface CachedStudent {
  id: string;
  organization_id: string;
  class_id?: string | null;
  group_id?: string | null;
  full_name: string;
  belt_rank: string;
  status?: string;
  photo_url?: string | null;
  cached_at?: string;
  updated_at?: string;
}

/**
 * 4. Cached Training Session
 */
export interface CachedSession {
  id: string;
  organization_id: string;
  class_id: string;
  group_id?: string | null;
  schedule_id?: string | null;
  session_date: string;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  status?: string;
  cached_at?: string;
  updated_at?: string;
}

/**
 * 5. Offline Attendance Mutation
 */
export interface AttendanceMutation {
  id: string;
  idempotency_key: string;
  organization_id: string;
  actor_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  base_version: number;
  retry_count: number;
  queue_status: QueueStatus;
  last_error: string | null;
  client_timestamp: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  correction_of_mutation_id: string | null;
  sequence_number: number;
  quarantine_reason?: string | null;
}

/**
 * Enqueue attendance input payload
 */
export interface EnqueueAttendanceParams {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  clientTimestamp?: string;
}

/**
 * 6. Synchronization Conflict Record
 */
export interface SyncConflict {
  id: string;
  mutation_id: string;
  organization_id: string;
  session_id: string;
  student_id: string;
  local_status: string;
  server_status: string;
  server_timestamp: string;
  conflict_reason: string;
  resolution: ConflictResolution;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateConflictParams {
  mutationId: string;
  sessionId: string;
  studentId: string;
  localStatus: string;
  serverStatus: string;
  serverTimestamp: string;
  conflictReason: string;
}

/**
 * 7. Sync Metadata Cache
 */
export interface SyncMetadata {
  key: string;
  organization_id: string;
  value: string;
  updated_at: string;
}
