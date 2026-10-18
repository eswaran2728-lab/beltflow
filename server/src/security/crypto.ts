import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AuthUserContext } from './rbac';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is not defined.');
    }
    // In dev / test, generate ephemeral secure 256-bit key per process instance
    if (!(global as any).__ephemeralJwtSecret) {
      (global as any).__ephemeralJwtSecret = crypto.randomBytes(32).toString('hex');
    }
    return (global as any).__ephemeralJwtSecret;
  }
  return secret;
}

const JWT_EXPIRES_IN = '7d';

/**
 * Generates a cryptographic salt and hashes password with PBKDF2/SHA-256.
 */
export function hashPasswordServer(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies password against stored salt:hash string.
 */
export function verifyPasswordServer(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  
  if (storedHash.includes(':')) {
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
    return hash === originalHash;
  }

  // Direct SHA-256 hex string fallback
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  return legacyHash === storedHash;
}

/**
 * Signs JWT session token for authenticated user.
 */
export function generateAuthToken(user: AuthUserContext): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      assignedClassIds: user.assignedClassIds || [],
      linkedStudentIds: user.linkedStudentIds || []
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Decodes and verifies incoming JWT session token.
 */
export function verifyAuthToken(token: string): AuthUserContext {
  return jwt.verify(token, getJwtSecret()) as AuthUserContext;
}

// ============================================================================
// Cryptographically Secure QR Attendance Pass Signing (SEC-QR-001)
// ============================================================================

export const ACTIVE_QR_KEY_ID = 'bf_qr_k1';
export const DEFAULT_QR_SECRET = 'bf_qr_secret_phase2_key_2026';

export function getQrKeyRing(): Record<string, string> {
  const primarySecret = process.env.QR_SIGNING_SECRET || DEFAULT_QR_SECRET;
  const keys: Record<string, string> = {
    [ACTIVE_QR_KEY_ID]: primarySecret,
  };
  if (process.env.QR_PREVIOUS_KEY_SECRET) {
    keys.bf_qr_k0 = process.env.QR_PREVIOUS_KEY_SECRET;
  }
  return keys;
}

export function generateQrPassCanonicalString(params: {
  v: number;
  kid: string;
  oid: string;
  sid: string;
  iat: number;
  exp: number;
  nonce?: string;
}): string {
  return `BF_PASS:${params.v}:${params.kid}:${params.oid}:${params.sid}:${params.iat}:${params.exp}:${params.nonce || ''}`;
}

export function signQrPassPayload(params: {
  v?: number;
  kid?: string;
  oid: string;
  sid: string;
  iat: number;
  exp: number;
  nonce?: string;
}): { sig: string; kid: string; v: number; nonce: string } {
  const v = params.v ?? 2;
  const kid = params.kid ?? ACTIVE_QR_KEY_ID;
  const nonce = params.nonce ?? crypto.randomBytes(8).toString('hex');
  const keyRing = getQrKeyRing();
  const secret = keyRing[kid] || keyRing[ACTIVE_QR_KEY_ID];
  const canonical = generateQrPassCanonicalString({ ...params, v, kid, nonce });
  const sig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  return { sig, kid, v, nonce };
}

export interface QrPassVerificationResult {
  valid: boolean;
  errorCode?: 'MISSING_SIGNATURE' | 'UNKNOWN_KEY_ID' | 'INVALID_SIGNATURE' | 'EXPIRED_PASS';
  errorMessage?: string;
}

export function verifyQrPassPayload(params: {
  v: number;
  kid?: string;
  oid: string;
  sid: string;
  iat: number;
  exp: number;
  nonce?: string;
  sig?: string;
  currentTimeSeconds?: number;
}): QrPassVerificationResult {
  if (!params.sig) {
    return { valid: false, errorCode: 'MISSING_SIGNATURE', errorMessage: 'Digital pass signature is missing.' };
  }

  const now = params.currentTimeSeconds ?? Math.floor(Date.now() / 1000);
  if (params.exp < now) {
    return { valid: false, errorCode: 'EXPIRED_PASS', errorMessage: 'Student digital pass has expired.' };
  }

  const kid = params.kid || ACTIVE_QR_KEY_ID;
  const keyRing = getQrKeyRing();
  const secret = keyRing[kid];
  if (!secret) {
    return { valid: false, errorCode: 'UNKNOWN_KEY_ID', errorMessage: 'Pass signed with unknown or revoked key ID.' };
  }

  const canonical = generateQrPassCanonicalString({ ...params, kid });
  const expectedSig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

  const actualBuf = Buffer.from(params.sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return {
      valid: false,
      errorCode: 'INVALID_SIGNATURE',
      errorMessage: 'Tampered pass or invalid cryptographic signature (SEC-QR-001).',
    };
  }

  return { valid: true };
}
