/**
 * The signed-in student's own records: attendance history and certificates.
 *
 * Every call takes the student record id (students.id). The login account id
 * (users.id) is a different value and is never used in these paths. The
 * server checks access per student (self, linked Parent, assigned Master,
 * same-organization Admin; never Super Admin).
 *
 * Field names confirmed against the server:
 *  - GET /api/v1/students/me                                -> { student: students.* + class_name }
 *  - GET /api/v1/attendance/student/:studentId/history      -> { attendance: session_attendance.* + session_date,
 *        day_of_week, start_time, end_time, location, is_extra, group_name }
 *  - GET /api/v1/certificates/student/:studentId            -> { certificates: certificates.* }
 */
import { apiClient } from './apiClient';

export interface StudentSelfRecord {
  id: string;
  organizationId: string;
  fullName: string;
  beltRank: string;
  status: string;
}

/** 'Booked' is a pre-registered entitlement, not yet marked. */
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'BOOKED' | 'OTHER';

export interface StudentAttendanceEntry {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  location: string;
  groupName: string;
  status: AttendanceStatus;
  isExtra: boolean;
}

export interface StudentAttendanceSummary {
  attended: number;
  total: number;
}

export interface StudentCertificate {
  id: string;
  code: string;
  rankOrTitle: string;
  type: string;
  issueDate: string;
  status: string;
  isRevoked: boolean;
  masterName: string;
}

/** Loads one kind of record for a student record id. */
export type StudentRecordLoader<T> = (studentId: string) => Promise<T>;

// Last student record per login, so the pass can still be shown when the
// phone is offline after a first successful load in this app session.
let cachedSelf: { userId: string; record: StudentSelfRecord } | null = null;

export function clearStudentRecordCache(): void {
  cachedSelf = null;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function normaliseStatus(raw: unknown): AttendanceStatus {
  const s = str(raw).trim().toUpperCase();
  if (s === 'PRESENT' || s === 'LATE' || s === 'ABSENT' || s === 'EXCUSED' || s === 'BOOKED') return s;
  return 'OTHER';
}

export const studentRecordsService = {
  async getMyStudentRecord(userId: string): Promise<StudentSelfRecord> {
    try {
      const res = await apiClient.get<{ student?: any }>('/api/v1/students/me');
      const s = res?.student;
      if (!s?.id) throw new Error('Student profile not found.');
      const record: StudentSelfRecord = {
        id: str(s.id),
        organizationId: str(s.organization_id),
        fullName: str(s.full_name),
        beltRank: str(s.belt_rank),
        status: str(s.status),
      };
      cachedSelf = { userId, record };
      return record;
    } catch (err) {
      if (cachedSelf && cachedSelf.userId === userId) return cachedSelf.record;
      throw err;
    }
  },

  async getAttendanceHistory(studentId: string): Promise<StudentAttendanceEntry[]> {
    const res = await apiClient.get<{ attendance?: any[] }>(
      `/api/v1/attendance/student/${encodeURIComponent(studentId)}/history`
    );
    const rows = Array.isArray(res?.attendance) ? res.attendance : [];
    const entries: StudentAttendanceEntry[] = rows.map(r => ({
      id: str(r.id),
      sessionDate: str(r.session_date),
      startTime: str(r.start_time),
      endTime: str(r.end_time),
      location: str(r.location),
      groupName: str(r.group_name),
      status: normaliseStatus(r.status),
      isExtra: Boolean(r.is_extra),
    }));
    // Newest first (the server already orders this way; keep it stable here too).
    return entries.sort((a, b) =>
      a.sessionDate === b.sessionDate
        ? b.startTime.localeCompare(a.startTime)
        : b.sessionDate.localeCompare(a.sessionDate)
    );
  },

  summarise(entries: StudentAttendanceEntry[]): StudentAttendanceSummary {
    const marked = entries.filter(e => e.status !== 'BOOKED' && e.status !== 'OTHER');
    return {
      attended: marked.filter(e => e.status === 'PRESENT' || e.status === 'LATE').length,
      total: marked.length,
    };
  },

  async getCertificates(studentId: string): Promise<StudentCertificate[]> {
    const res = await apiClient.get<{ certificates?: any[] }>(
      `/api/v1/certificates/student/${encodeURIComponent(studentId)}`
    );
    const rows = Array.isArray(res?.certificates) ? res.certificates : [];
    return rows.map(c => {
      const status = str(c.status).toUpperCase();
      return {
        id: str(c.id),
        code: str(c.code),
        rankOrTitle: str(c.rank_or_title),
        type: str(c.type),
        issueDate: str(c.issue_date),
        status,
        isRevoked: status === 'REVOKED' || Boolean(c.revoked_at),
        masterName: str(c.master_name),
      };
    });
  },
};
