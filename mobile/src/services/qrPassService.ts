/**
 * BeltFlow — Asymmetric Ed25519 QR Pass & Scanner Service (SEC-QR-001 Resolved)
 * Cryptographically secure QR-based student identification, offline signature verification,
 * key rotation support, and roll-call validation.
 *
 * Implements Ed25519 asymmetric signatures (TweetNaCl) with key ID ('kid'),
 * explicit issuer/audience scope, and anti-replay nonces.
 * PRIVATE SIGNING KEYS ARE NEVER EMBEDDED IN OR DISTRIBUTED TO THE MOBILE APP.
 */

import nacl from 'tweetnacl';
import { CachedStudent, CachedSession, AttendanceStatus } from '../database/types';
import { hexToBytes, utf8Encode } from '../utils/crypto';

export interface StudentQRPayload {
  type: 'BF_PASS';
  v: number;
  kid: string; // Key ID for key rotation (e.g. 'bf_ed25519_k1')
  iss?: string; // Issuer authority (default: 'beltflow-authority')
  aud?: string; // Audience scope (default: 'beltflow-attendance')
  oid: string; // organizationId (Tenant isolation)
  sid: string; // studentId (Opaque identifier)
  name?: string; // Optional client-side display hint
  belt?: string; // Optional client-side display hint
  iat: number; // Issued at (Unix seconds)
  exp: number; // Expires at (Unix seconds)
  nonce?: string; // Anti-replay nonce
  sig?: string; // Ed25519 64-byte signature (128 hex chars)
}

export type QRScanErrorCode =
  | 'INVALID_QR_FORMAT'
  | 'INVALID_SIGNATURE'
  | 'UNKNOWN_KEY_ID'
  | 'CROSS_PERSATUAN_REJECTED'
  | 'EXPIRED_PASS'
  | 'STUDENT_NOT_FOUND'
  | 'UNASSIGNED_STUDENT_REJECTED'
  | 'STUDENT_INACTIVE_REJECTED'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_ISSUER'
  | 'INVALID_AUDIENCE';

export interface QRScanResult {
  isValid: boolean;
  errorCode?: QRScanErrorCode;
  errorMessage?: string;
  payload?: StudentQRPayload;
  student?: CachedStudent;
}

export const ACTIVE_QR_KEY_ID = 'bf_ed25519_k1';
export const HISTORICAL_QR_KEY_ID = 'bf_ed25519_k0';
export const QR_ISSUER = 'beltflow-authority';
export const QR_AUDIENCE = 'beltflow-attendance';

// Default pinned Ed25519 public verification keys (32 bytes = 64 hex characters).
// PRIVATE KEYS NEVER RESIDE ON UNTRUSTED MOBILE CLIENTS.
export const DEFAULT_PINNED_PUBLIC_KEY = '9be104dc180101c12e16df1ca611f72818268fa376522891b3513edcab53fd17';
export const HISTORICAL_PINNED_PUBLIC_KEY = '34d15fa471ca6fc1bbbdfefdfe5db0290fefe85b0016d489178588e365811569';

export class QRPassService {
  private trustedPublicKeyRing: Record<string, string> = {
    [ACTIVE_QR_KEY_ID]: DEFAULT_PINNED_PUBLIC_KEY,
    [HISTORICAL_QR_KEY_ID]: HISTORICAL_PINNED_PUBLIC_KEY,
  };

  /**
   * Updates trusted public key ring (e.g. synchronized from authenticated /qr/verification-keys).
   * Only stores public verification keys.
   */
  public setTrustedKeyRing(publicKeys: Record<string, string>): void {
    this.trustedPublicKeyRing = { ...publicKeys };
  }

  /**
   * Adds or updates a single public key in the trusted ring.
   */
  public addTrustedKey(kid: string, publicKeyHex: string): void {
    this.trustedPublicKeyRing[kid] = publicKeyHex.trim();
  }

  /**
   * Returns current trusted public keys.
   */
  public getTrustedKeyRing(): Record<string, string> {
    return { ...this.trustedPublicKeyRing };
  }

  /**
   * Resets trusted keys to default pinned public keys.
   */
  public resetTrustedKeys(): void {
    this.trustedPublicKeyRing = {
      [ACTIVE_QR_KEY_ID]: DEFAULT_PINNED_PUBLIC_KEY,
      [HISTORICAL_QR_KEY_ID]: HISTORICAL_PINNED_PUBLIC_KEY,
    };
  }

  /**
   * Constructs the exact canonical string for Ed25519 signature verification.
   */
  public generateCanonicalString(payload: {
    v: number;
    kid: string;
    iss?: string;
    aud?: string;
    oid: string;
    sid: string;
    iat: number;
    exp: number;
    nonce?: string;
  }): string {
    const iss = payload.iss || QR_ISSUER;
    const aud = payload.aud || QR_AUDIENCE;
    const nonce = payload.nonce || '';
    return `BF_PASS:v=${payload.v}:kid=${payload.kid}:iss=${iss}:aud=${aud}:oid=${payload.oid}:sid=${payload.sid}:iat=${payload.iat}:exp=${payload.exp}:nonce=${nonce}`;
  }

  /**
   * Constructs a student pass payload structure.
   * In production, the signature 'sig' is issued exclusively by the backend authority.
   */
  public createStudentPassPayload(
    student: {
      id: string;
      organizationId: string;
      fullName?: string;
      beltRank?: string;
      status?: string;
    },
    options: {
      expiresInDays?: number;
      issuedAt?: number;
      version?: number;
      kid?: string;
      nonce?: string;
      sig?: string;
      iss?: string;
      aud?: string;
    } = {}
  ): StudentQRPayload {
    const iat = options.issuedAt ?? Math.floor(Date.now() / 1000);
    const expiresInDays = options.expiresInDays ?? 30;
    const exp = iat + expiresInDays * 86400;
    const version = options.version ?? 2;
    const kid = options.kid ?? ACTIVE_QR_KEY_ID;
    const nonce = options.nonce ?? Math.random().toString(36).substring(2, 10);

    return {
      type: 'BF_PASS',
      v: version,
      kid,
      iss: options.iss ?? QR_ISSUER,
      aud: options.aud ?? QR_AUDIENCE,
      oid: student.organizationId,
      sid: student.id,
      name: student.fullName,
      belt: student.beltRank,
      iat,
      exp,
      nonce,
      sig: options.sig || '',
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
        typeof parsed.v === 'number' &&
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
   * Validates a scanned QR payload against Ed25519 cryptographic signature,
   * organization scope, active session, and authorized offline cached roster.
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

    // 2. Reject Legacy Insecure v1 Credentials (SEC-QR-001)
    if (payload.v !== 2) {
      return {
        isValid: false,
        errorCode: 'UNSUPPORTED_VERSION',
        errorMessage: 'Legacy v1 pass rejected. Asymmetric Ed25519 credentials required.',
        payload,
      };
    }

    // 3. Cryptographic Signature Presence Check
    if (!payload.sig) {
      return {
        isValid: false,
        errorCode: 'INVALID_SIGNATURE',
        errorMessage: 'Digital pass signature is missing. Potential forgery.',
        payload,
      };
    }

    // 4. Authority & Scope Validation
    if (payload.iss && payload.iss !== QR_ISSUER) {
      return {
        isValid: false,
        errorCode: 'INVALID_ISSUER',
        errorMessage: 'Invalid pass issuer authority.',
        payload,
      };
    }

    if (payload.aud && payload.aud !== QR_AUDIENCE) {
      return {
        isValid: false,
        errorCode: 'INVALID_AUDIENCE',
        errorMessage: 'Invalid pass audience scope.',
        payload,
      };
    }

    // 5. Key ID & Public Key Lookup
    const kid = payload.kid || ACTIVE_QR_KEY_ID;
    const publicKeyHex = this.trustedPublicKeyRing[kid];
    if (!publicKeyHex) {
      return {
        isValid: false,
        errorCode: 'UNKNOWN_KEY_ID',
        errorMessage: `Pass signed with unknown or revoked key (${kid}).`,
        payload,
      };
    }

    // 6. Asymmetric Ed25519 Offline Verification
    const canonicalData = this.generateCanonicalString(payload);
    const msgBytes = utf8Encode(canonicalData);
    const sigBytes = hexToBytes(payload.sig);
    const pubBytes = hexToBytes(publicKeyHex);

    if (sigBytes.length !== 64 || pubBytes.length !== 32) {
      return {
        isValid: false,
        errorCode: 'INVALID_SIGNATURE',
        errorMessage: 'Malformed signature or public key length.',
        payload,
      };
    }

    const isValidSig = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    if (!isValidSig) {
      return {
        isValid: false,
        errorCode: 'INVALID_SIGNATURE',
        errorMessage: 'Tampered pass or invalid Ed25519 cryptographic signature (SEC-QR-001).',
        payload,
      };
    }

    // 7. Expiration Check
    const now = context.currentTimeSeconds ?? Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return {
        isValid: false,
        errorCode: 'EXPIRED_PASS',
        errorMessage: 'Student digital pass has expired. Please refresh pass while online.',
        payload,
      };
    }

    // 8. Cross-Persatuan Protection
    if (payload.oid !== context.currentOrgId) {
      return {
        isValid: false,
        errorCode: 'CROSS_PERSATUAN_REJECTED',
        errorMessage: 'Cross-Persatuan scan rejected. Student belongs to a different academy.',
        payload,
      };
    }

    // 9. Session Validity Check
    if (!context.session) {
      return {
        isValid: false,
        errorCode: 'UNASSIGNED_STUDENT_REJECTED',
        errorMessage: 'No active training session selected for attendance.',
        payload,
      };
    }

    // 10. Match Student against Cached Authorized Roster
    const student = context.roster.find((s) => s.id === payload.sid);
    if (!student) {
      return {
        isValid: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Student not found in authorized class roster.',
        payload,
      };
    }

    // 11. Active Membership Check
    if (student.status !== 'ACTIVE') {
      return {
        isValid: false,
        errorCode: 'STUDENT_INACTIVE_REJECTED',
        errorMessage: 'Student membership is suspended, inactive, or removed.',
        payload,
        student,
      };
    }

    // 12. Class & Group Matching
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
}

export const qrPassService = new QRPassService();
