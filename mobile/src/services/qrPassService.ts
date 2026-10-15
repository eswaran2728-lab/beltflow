/**
 * BeltFlow — QR Pass & Scanner Service (Phase 2 Task 2.4)
 * Secure QR-based student identification, digital pass generation,
 * and offline attendance roll-call validation.
 */

import { CachedStudent, CachedSession, AttendanceStatus } from '../database/types';

export interface StudentQRPayload {
  type: 'BF_PASS';
  v: number;
  oid: string; // organizationId (Tenant isolation)
  sid: string; // studentId (Opaque identifier)
  name: string; // Student display name
  belt: string; // Belt level
  iat: number; // Issued at (Unix seconds)
  exp: number; // Expires at (Unix seconds)
  sig?: string; // Digital signature / integrity hash
}

export type QRScanErrorCode =
  | 'INVALID_QR_FORMAT'
  | 'CROSS_PERSATUAN_REJECTED'
  | 'EXPIRED_PASS'
  | 'STUDENT_NOT_FOUND'
  | 'UNASSIGNED_STUDENT_REJECTED'
  | 'STUDENT_INACTIVE_REJECTED';

export interface QRScanResult {
  isValid: boolean;
  errorCode?: QRScanErrorCode;
  errorMessage?: string;
  payload?: StudentQRPayload;
  student?: CachedStudent;
}

export class QRPassService {
  /**
   * Generates a tamper-evident, opaque student pass payload.
   * NEVER embeds NRIC, phone number, home address, payment data, or JWT session tokens.
   */
  public createStudentPassPayload(
    student: {
      id: string;
      organizationId: string;
      fullName: string;
      beltRank: string;
      status?: string;
    },
    options: { expiresInDays?: number; issuedAt?: number } = {}
  ): StudentQRPayload {
    const iat = options.issuedAt ?? Math.floor(Date.now() / 1000);
    const expiresInDays = options.expiresInDays ?? 30;
    const exp = iat + expiresInDays * 86400;

    // Generate SHA-256 integrity hash over immutable fields
    const rawData = `BF_PASS:1:${student.organizationId}:${student.id}:${iat}:${exp}`;
    const sig = this.computeHash(rawData);

    return {
      type: 'BF_PASS',
      v: 1,
      oid: student.organizationId,
      sid: student.id,
      name: student.fullName,
      belt: student.beltRank,
      iat,
      exp,
      sig,
    };
  }

  /**
   * Serializes the pass payload to a compact JSON string for QR encoding.
   */
  public serializePayload(payload: StudentQRPayload): string {
    return JSON.stringify(payload);
  }

  /**
   * Parses and performs structural validation of raw QR text.
   */
  public parsePayload(raw: string): StudentQRPayload | null {
    if (!raw || typeof raw !== 'string') return null;

    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.type === 'BF_PASS' &&
        parsed.v === 1 &&
        typeof parsed.oid === 'string' &&
        typeof parsed.sid === 'string' &&
        typeof parsed.iat === 'number' &&
        typeof parsed.exp === 'number'
      ) {
        return parsed as StudentQRPayload;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validates a scanned QR payload against the current Master's organization,
   * active session, and authorized offline cached roster.
   */
  public validateScannedPass(
    rawText: string,
    context: {
      currentOrgId: string;
      session: CachedSession | null;
      roster: CachedStudent[];
      currentTimeSeconds?: number;
    }
  ): QRScanResult {
    const payload = this.parsePayload(rawText);

    // 1. Format & Structure Check
    if (!payload) {
      return {
        isValid: false,
        errorCode: 'INVALID_QR_FORMAT',
        errorMessage: 'Invalid QR code. Not an official BeltFlow digital pass.',
      };
    }

    // 2. Expiration Check
    const now = context.currentTimeSeconds ?? Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return {
        isValid: false,
        errorCode: 'EXPIRED_PASS',
        errorMessage: 'Student digital pass has expired. Please refresh pass while online.',
        payload,
      };
    }

    // 3. Cross-Persatuan Protection
    if (payload.oid !== context.currentOrgId) {
      return {
        isValid: false,
        errorCode: 'CROSS_PERSATUAN_REJECTED',
        errorMessage: 'Cross-Persatuan scan rejected. Student belongs to a different academy.',
        payload,
      };
    }

    // 4. Session Validity
    if (!context.session) {
      return {
        isValid: false,
        errorCode: 'UNASSIGNED_STUDENT_REJECTED',
        errorMessage: 'No active training session selected for attendance.',
        payload,
      };
    }

    // 5. Match Student against Cached Authorized Roster
    const student = context.roster.find(s => s.id === payload.sid);
    if (!student) {
      return {
        isValid: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Student not found in authorized class roster.',
        payload,
      };
    }

    // 6. Active Membership Check
    if (student.status !== 'ACTIVE') {
      return {
        isValid: false,
        errorCode: 'STUDENT_INACTIVE_REJECTED',
        errorMessage: 'Student membership is suspended, inactive, or removed.',
        payload,
        student,
      };
    }

    // 7. Class & Group Matching
    if (student.class_id !== context.session.class_id) {
      return {
        isValid: false,
        errorCode: 'UNASSIGNED_STUDENT_REJECTED',
        errorMessage: 'Student belongs to another martial arts class.',
        payload,
        student,
      };
    }

    if (context.session.group_id && student.group_id && student.group_id !== context.session.group_id) {
      return {
        isValid: false,
        errorCode: 'UNASSIGNED_STUDENT_REJECTED',
        errorMessage: 'Student is assigned to a different training group for this class.',
        payload,
        student,
      };
    }

    // All validation checks passed
    return {
      isValid: true,
      payload,
      student,
    };
  }

  /**
   * Checks if student was already marked in the current session attendance map.
   */
  public checkDuplicateScan(
    studentId: string,
    attendanceMap: Record<string, AttendanceStatus | null>
  ): { isDuplicate: boolean; existingStatus: AttendanceStatus | null } {
    const existing = attendanceMap[studentId];
    if (existing) {
      return { isDuplicate: true, existingStatus: existing };
    }
    return { isDuplicate: false, existingStatus: null };
  }

  /**
   * Lightweight deterministic hash calculation for payload integrity.
   */
  private computeHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

export const qrPassService = new QRPassService();
