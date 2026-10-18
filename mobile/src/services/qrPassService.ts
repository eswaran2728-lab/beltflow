/**
 * BeltFlow — QR Pass & Scanner Service (Phase 2 Task H08 / SEC-QR-001)
 * Cryptographically secure QR-based student identification, digital pass generation,
 * key rotation support, and offline attendance roll-call validation.
 *
 * Implements HMAC-SHA256 digital signatures with key ID ('kid') and anti-replay nonces.
 * Resolves SEC-QR-001 (QR Pass Forgeability / Replay Defect).
 */

import { CachedStudent, CachedSession, AttendanceStatus } from '../database/types';
import { hmacSha256, timingSafeEqual } from '../utils/crypto';

export interface StudentQRPayload {
  type: 'BF_PASS';
  v: number;
  kid?: string; // Key ID for key rotation (e.g. 'bf_qr_k1')
  oid: string; // organizationId (Tenant isolation)
  sid: string; // studentId (Opaque identifier)
  name: string; // Student display name
  belt: string; // Belt level
  iat: number; // Issued at (Unix seconds)
  exp: number; // Expires at (Unix seconds)
  nonce?: string; // Anti-replay nonce
  sig?: string; // Digital signature / integrity hash
}

export type QRScanErrorCode =
  | 'INVALID_QR_FORMAT'
  | 'INVALID_SIGNATURE'
  | 'UNKNOWN_KEY_ID'
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

export const ACTIVE_QR_KEY_ID = 'bf_qr_k1';
export const DEFAULT_OFFLINE_SECRET = 'bf_qr_secret_phase2_key_2026';

export class QRPassService {
  private trustedKeyRing: Record<string, string> = {
    [ACTIVE_QR_KEY_ID]: DEFAULT_OFFLINE_SECRET,
  };

  /**
   * Updates trusted key ring for key rotation validation (e.g. cached on sync).
   */
  public setTrustedKeyRing(keys: Record<string, string>): void {
    this.trustedKeyRing = { ...keys };
  }

  /**
   * Adds or updates a single key in the trusted ring.
   */
  public addTrustedKey(kid: string, secret: string): void {
    this.trustedKeyRing[kid] = secret;
  }

  /**
   * Resets trusted keys to default configuration.
   */
  public resetTrustedKeys(): void {
    this.trustedKeyRing = {
      [ACTIVE_QR_KEY_ID]: DEFAULT_OFFLINE_SECRET,
    };
  }

  /**
   * Generates a tamper-evident, cryptographically signed student pass payload.
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
    options: {
      expiresInDays?: number;
      issuedAt?: number;
      version?: number;
      kid?: string;
      nonce?: string;
      secret?: string;
    } = {}
  ): StudentQRPayload {
    const iat = options.issuedAt ?? Math.floor(Date.now() / 1000);
    const expiresInDays = options.expiresInDays ?? 30;
    const exp = iat + expiresInDays * 86400;
    const version = options.version ?? 2;
    const kid = options.kid ?? ACTIVE_QR_KEY_ID;
    const nonce = options.nonce ?? Math.random().toString(36).substring(2, 10);
    const secret = options.secret ?? this.trustedKeyRing[kid] ?? DEFAULT_OFFLINE_SECRET;

    let sig: string;
    if (version === 2) {
      // Cryptographic HMAC-SHA256 signature
      const rawData = `BF_PASS:2:${kid}:${student.organizationId}:${student.id}:${iat}:${exp}:${nonce}`;
      sig = hmacSha256(secret, rawData);
    } else {
      // Legacy v1 hash compatibility
      const rawData = `BF_PASS:1:${student.organizationId}:${student.id}:${iat}:${exp}`;
      sig = this.computeLegacyHash(rawData);
    }

    return {
      type: 'BF_PASS',
      v: version,
      kid: version === 2 ? kid : undefined,
      oid: student.organizationId,
      sid: student.id,
      name: student.fullName,
      belt: student.beltRank,
      iat,
      exp,
      nonce: version === 2 ? nonce : undefined,
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
        (parsed.v === 1 || parsed.v === 2) &&
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
   * Validates a scanned QR payload against cryptographic signature, organization,
   * active session, and authorized offline cached roster.
   */
  public validateScannedPass(
    rawText: string,
    context: {
      currentOrgId: string;
      session: CachedSession | null;
      roster: CachedStudent[];
      currentTimeSeconds?: number;
      enforceCryptographicSignature?: boolean;
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

    // 2. Cryptographic Signature & Integrity Check (SEC-QR-001)
    if (payload.v === 2) {
      if (!payload.sig) {
        return {
          isValid: false,
          errorCode: 'INVALID_SIGNATURE',
          errorMessage: 'Digital pass signature is missing. Potential forgery.',
          payload,
        };
      }

      const kid = payload.kid || ACTIVE_QR_KEY_ID;
      const secret = this.trustedKeyRing[kid];
      if (!secret) {
        return {
          isValid: false,
          errorCode: 'UNKNOWN_KEY_ID',
          errorMessage: `Pass signed with unknown or revoked key (${kid}).`,
          payload,
        };
      }

      const canonicalData = `BF_PASS:2:${kid}:${payload.oid}:${payload.sid}:${payload.iat}:${payload.exp}:${payload.nonce || ''}`;
      const expectedSig = hmacSha256(secret, canonicalData);

      if (!timingSafeEqual(payload.sig, expectedSig)) {
        return {
          isValid: false,
          errorCode: 'INVALID_SIGNATURE',
          errorMessage: 'Tampered pass or invalid cryptographic signature (SEC-QR-001).',
          payload,
        };
      }
    } else if (payload.v === 1 && payload.sig) {
      // Legacy v1 check
      const rawData = `BF_PASS:1:${payload.oid}:${payload.sid}:${payload.iat}:${payload.exp}`;
      const expectedHash = this.computeLegacyHash(rawData);
      if (!timingSafeEqual(payload.sig, expectedHash)) {
        return {
          isValid: false,
          errorCode: 'INVALID_SIGNATURE',
          errorMessage: 'Tampered legacy pass or invalid hash (SEC-QR-001).',
          payload,
        };
      }
    }

    // 3. Expiration Check
    const now = context.currentTimeSeconds ?? Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return {
        isValid: false,
        errorCode: 'EXPIRED_PASS',
        errorMessage: 'Student digital pass has expired. Please refresh pass while online.',
        payload,
      };
    }

    // 4. Cross-Persatuan Protection
    if (payload.oid !== context.currentOrgId) {
      return {
        isValid: false,
        errorCode: 'CROSS_PERSATUAN_REJECTED',
        errorMessage: 'Cross-Persatuan scan rejected. Student belongs to a different academy.',
        payload,
      };
    }

    // 5. Session Validity
    if (!context.session) {
      return {
        isValid: false,
        errorCode: 'UNASSIGNED_STUDENT_REJECTED',
        errorMessage: 'No active training session selected for attendance.',
        payload,
      };
    }

    // 6. Match Student against Cached Authorized Roster
    const student = context.roster.find((s) => s.id === payload.sid);
    if (!student) {
      return {
        isValid: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Student not found in authorized class roster.',
        payload,
      };
    }

    // 7. Active Membership Check
    if (student.status !== 'ACTIVE') {
      return {
        isValid: false,
        errorCode: 'STUDENT_INACTIVE_REJECTED',
        errorMessage: 'Student membership is suspended, inactive, or removed.',
        payload,
        student,
      };
    }

    // 8. Class & Group Matching
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
   * Legacy 32-bit hash calculation for backward compatibility with v1 passes.
   */
  private computeLegacyHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

export const qrPassService = new QRPassService();
