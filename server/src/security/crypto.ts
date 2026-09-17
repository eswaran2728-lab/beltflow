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
