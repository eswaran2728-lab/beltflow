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
// Asymmetric Ed25519 QR Attendance Pass Cryptography (SEC-QR-001 Resolved)
// ============================================================================

import nacl from 'tweetnacl';

export const ACTIVE_QR_KEY_ID = 'bf_ed25519_k1';
export const HISTORICAL_QR_KEY_ID = 'bf_ed25519_k0';
export const QR_ISSUER = 'beltflow-authority';
export const QR_AUDIENCE = 'beltflow-attendance';

interface Ed25519KeyEntry {
  publicKeyHex: string;
  secretKey: Uint8Array;
}

let ed25519KeyRingCache: Record<string, Ed25519KeyEntry> | null = null;

function initEd25519KeyRing(): Record<string, Ed25519KeyEntry> {
  if (ed25519KeyRingCache) return ed25519KeyRingCache;

  // Active Key (k1)
  const seedK1 = crypto
    .createHash('sha256')
    .update(process.env.QR_ED25519_PRIVATE_KEY_SEED || 'beltflow_ed25519_primary_seed_phase2_2026')
    .digest();
  const kp1 = nacl.sign.keyPair.fromSeed(new Uint8Array(seedK1));

  // Historical Key (k0) for rotation continuity
  const seedK0 = crypto
    .createHash('sha256')
    .update(process.env.QR_ED25519_PREVIOUS_SEED || 'beltflow_ed25519_previous_seed_phase2_2025')
    .digest();
  const kp0 = nacl.sign.keyPair.fromSeed(new Uint8Array(seedK0));

  ed25519KeyRingCache = {
    [ACTIVE_QR_KEY_ID]: {
      publicKeyHex: Buffer.from(kp1.publicKey).toString('hex'),
      secretKey: kp1.secretKey,
    },
    [HISTORICAL_QR_KEY_ID]: {
      publicKeyHex: Buffer.from(kp0.publicKey).toString('hex'),
      secretKey: kp0.secretKey,
    },
  };

  return ed25519KeyRingCache;
}

export function getEd25519PrivateKey(kid: string): Uint8Array | null {
  const ring = initEd25519KeyRing();
  return ring[kid]?.secretKey || null;
}

export function getQrVerificationKeys(): {
  activeKid: string;
  supportedKids: string[];
  algorithm: 'Ed25519';
  publicKeys: Record<string, string>;
} {
  const ring = initEd25519KeyRing();
  const publicKeys: Record<string, string> = {};
  for (const [kid, entry] of Object.entries(ring)) {
    publicKeys[kid] = entry.publicKeyHex;
  }
  return {
    activeKid: ACTIVE_QR_KEY_ID,
    supportedKids: Object.keys(publicKeys),
    algorithm: 'Ed25519',
    publicKeys,
  };
}

export function generateQrPassCanonicalString(params: {
  v: number;
  kid: string;
  iss: string;
  aud: string;
  oid: string;
  sid: string;
  iat: number;
  exp: number;
  nonce: string;
}): string {
  return `BF_PASS:v=${params.v}:kid=${params.kid}:iss=${params.iss}:aud=${params.aud}:oid=${params.oid}:sid=${params.sid}:iat=${params.iat}:exp=${params.exp}:nonce=${params.nonce}`;
}

export function signQrPassPayload(params: {
  v?: number;
  kid?: string;
  iss?: string;
  aud?: string;
  oid: string;
  sid: string;
  iat: number;
  exp: number;
  nonce?: string;
}): { sig: string; kid: string; v: number; iss: string; aud: string; nonce: string } {
  const v = params.v ?? 2;
  const kid = params.kid ?? ACTIVE_QR_KEY_ID;
  const iss = params.iss ?? QR_ISSUER;
  const aud = params.aud ?? QR_AUDIENCE;
  const nonce = params.nonce ?? crypto.randomBytes(8).toString('hex');

  const secretKey = getEd25519PrivateKey(kid);
  if (!secretKey) {
    throw new Error(`Signing key not found for kid: ${kid}`);
  }

  const canonical = generateQrPassCanonicalString({
    v,
    kid,
    iss,
    aud,
    oid: params.oid,
    sid: params.sid,
    iat: params.iat,
    exp: params.exp,
    nonce,
  });

  const canonicalBytes = Buffer.from(canonical, 'utf8');
  const sigBytes = nacl.sign.detached(new Uint8Array(canonicalBytes), secretKey);
  const sig = Buffer.from(sigBytes).toString('hex');

  return { sig, kid, v, iss, aud, nonce };
}

export interface QrPassVerificationResult {
  valid: boolean;
  errorCode?:
    | 'MISSING_SIGNATURE'
    | 'UNKNOWN_KEY_ID'
    | 'INVALID_SIGNATURE'
    | 'EXPIRED_PASS'
    | 'UNSUPPORTED_VERSION'
    | 'INVALID_ISSUER'
    | 'INVALID_AUDIENCE';
  errorMessage?: string;
}

export function verifyQrPassPayload(params: {
  v: number;
  kid?: string;
  iss?: string;
  aud?: string;
  oid: string;
  sid: string;
  iat: number;
  exp: number;
  nonce?: string;
  sig?: string;
  currentTimeSeconds?: number;
}): QrPassVerificationResult {
  if (params.v !== 2) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_VERSION',
      errorMessage: 'Unsupported pass version. Only v2 asymmetric Ed25519 passes are accepted.',
    };
  }

  if (!params.sig) {
    return { valid: false, errorCode: 'MISSING_SIGNATURE', errorMessage: 'Digital pass signature is missing.' };
  }

  const now = params.currentTimeSeconds ?? Math.floor(Date.now() / 1000);
  if (params.exp < now) {
    return { valid: false, errorCode: 'EXPIRED_PASS', errorMessage: 'Student digital pass has expired.' };
  }

  if (params.iss && params.iss !== QR_ISSUER) {
    return { valid: false, errorCode: 'INVALID_ISSUER', errorMessage: 'Invalid pass issuer authority.' };
  }

  if (params.aud && params.aud !== QR_AUDIENCE) {
    return { valid: false, errorCode: 'INVALID_AUDIENCE', errorMessage: 'Invalid pass audience scope.' };
  }

  const kid = params.kid || ACTIVE_QR_KEY_ID;
  const keyRing = getQrVerificationKeys().publicKeys;
  const publicKeyHex = keyRing[kid];
  if (!publicKeyHex) {
    return { valid: false, errorCode: 'UNKNOWN_KEY_ID', errorMessage: 'Pass signed with unknown or revoked key ID.' };
  }

  const canonical = generateQrPassCanonicalString({
    v: params.v,
    kid,
    iss: params.iss || QR_ISSUER,
    aud: params.aud || QR_AUDIENCE,
    oid: params.oid,
    sid: params.sid,
    iat: params.iat,
    exp: params.exp,
    nonce: params.nonce || '',
  });

  const canonicalBytes = new Uint8Array(Buffer.from(canonical, 'utf8'));
  const sigBytes = new Uint8Array(Buffer.from(params.sig, 'hex'));
  const pubBytes = new Uint8Array(Buffer.from(publicKeyHex, 'hex'));

  if (sigBytes.length !== 64 || pubBytes.length !== 32) {
    return { valid: false, errorCode: 'INVALID_SIGNATURE', errorMessage: 'Malformed signature or public key length.' };
  }

  const isValid = nacl.sign.detached.verify(canonicalBytes, sigBytes, pubBytes);
  if (!isValid) {
    return {
      valid: false,
      errorCode: 'INVALID_SIGNATURE',
      errorMessage: 'Cryptographic signature verification failed.',
    };
  }

  return { valid: true };
}
