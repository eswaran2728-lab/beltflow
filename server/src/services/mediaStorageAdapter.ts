import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface StoragePresignedUploadResult {
  uploadUrl: string;
  presignedToken: string;
  expiresAt: Date;
  storageKey: string;
  headers: Record<string, string>;
}

export interface StoragePresignedPlaybackResult {
  playbackUrl: string;
  presignedToken: string;
  expiresAt: Date;
}

export interface ObjectVerificationResult {
  exists: boolean;
  sizeBytes?: number;
  mimeType?: string;
  checksumSha256?: string;
  magicValid: boolean;
  detectedFormat?: string;
  error?: string;
}

export interface IMediaStorageProvider {
  generatePresignedUploadUrl(
    storageKey: string,
    options: { maxSizeBytes: number; mimeType: string; expiresInSeconds: number }
  ): Promise<StoragePresignedUploadResult>;

  generatePresignedPlaybackUrl(
    storageKey: string,
    options: { expiresInSeconds: number }
  ): Promise<StoragePresignedPlaybackResult>;

  verifyObject(storageKey: string, expectedSize?: number, expectedMime?: string): Promise<ObjectVerificationResult>;

  saveObject(storageKey: string, data: Buffer, mimeType: string): Promise<{ sizeBytes: number; checksumSha256: string }>;

  getObject(storageKey: string, token?: string): Promise<{ buffer: Buffer; contentType: string } | null>;

  deleteObject(storageKey: string): Promise<boolean>;

  revokeTokensForStudent(studentId: string): void;

  isTokenRevoked(token: string): boolean;

  verifyToken(key: string, token: string, expiryTimestamp: number, operation?: MediaStorageOperation): boolean;
}

export type MediaStorageOperation = 'upload' | 'playback';

/** Signed storage links never live longer than this, whatever expiry a link claims. */
export const MAX_STORAGE_TOKEN_LIFETIME_SECONDS = 3600;

/**
 * The HMAC key for storage links. There is no built-in default: production
 * refuses to start without MEDIA_STORAGE_SECRET (32+ characters); other
 * environments get a random per-process key.
 */
export function resolveMediaStorageSecret(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string {
  const configured = env.MEDIA_STORAGE_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: MEDIA_STORAGE_SECRET must be set to at least 32 characters in production.');
  }
  if (configured) return configured;
  return crypto.randomBytes(32).toString('hex');
}

const STORAGE_SIGNING_SECRET = resolveMediaStorageSecret();

/** Signs a storage link. The operation is part of the signed data, so an upload link is not a playback link. */
export function signMediaStorageToken(operation: MediaStorageOperation, key: string, expiryTimestamp: number): string {
  return crypto
    .createHmac('sha256', STORAGE_SIGNING_SECRET)
    .update(`${operation}:${key}:${expiryTimestamp}`)
    .digest('hex');
}

// In-memory revocation registry for active tokens
const revokedTokensSet = new Set<string>();
const revokedStudentPrefixes = new Set<string>();

/**
 * Validates file magic bytes to verify video content beyond client-supplied MIME string
 */
export function validateVideoMagicBytes(buffer: Buffer): { valid: boolean; detectedFormat?: string } {
  if (!buffer || buffer.length < 8) {
    return { valid: false };
  }

  // MP4 / MOV / QuickTime: Check for 'ftyp' atom in bytes 4..7
  const atom = buffer.slice(4, 8).toString('ascii');
  if (atom === 'ftyp') {
    const majorBrand = buffer.slice(8, 12).toString('ascii');
    if (majorBrand.startsWith('qt') || majorBrand.startsWith('moov')) {
      return { valid: true, detectedFormat: 'video/quicktime' };
    }
    return { valid: true, detectedFormat: 'video/mp4' };
  }

  // WebM / MKV: Check for EBML ID (\x1A\x45\xDF\xA3) in first 4 bytes
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { valid: true, detectedFormat: 'video/webm' };
  }

  // Raw QuickTime atom checks ('moov', 'mdat', 'wide' in first 8 bytes)
  const firstFour = buffer.slice(4, 8).toString('ascii');
  if (firstFour === 'moov' || firstFour === 'mdat' || firstFour === 'wide') {
    return { valid: true, detectedFormat: 'video/quicktime' };
  }

  return { valid: false };
}

/**
 * Local file-system implementation of IMediaStorageProvider for development, test, and on-premises verification
 */
export class LocalMediaStorageProvider implements IMediaStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), '.storage', 'media');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(storageKey: string): string {
    // Sanitize storage key to prevent directory traversal
    const safeKey = storageKey.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.baseDir, safeKey);
  }

  public verifyToken(key: string, token: string, expiryTimestamp: number, operation: MediaStorageOperation = 'playback'): boolean {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(expiryTimestamp) || expiryTimestamp < now || expiryTimestamp > now + MAX_STORAGE_TOKEN_LIFETIME_SECONDS) {
      return false;
    }
    if (revokedTokensSet.has(token)) {
      return false;
    }
    for (const prefix of revokedStudentPrefixes) {
      if (key.includes(prefix)) {
        return false;
      }
    }
    const expected = signMediaStorageToken(operation, key, expiryTimestamp);
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  }

  public async generatePresignedUploadUrl(
    storageKey: string,
    options: { maxSizeBytes: number; mimeType: string; expiresInSeconds: number }
  ): Promise<StoragePresignedUploadResult> {
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);
    const presignedToken = signMediaStorageToken('upload', storageKey, expiryTimestamp);

    const uploadUrl = `/api/v1/media/storage/upload/${encodeURIComponent(storageKey)}?token=${presignedToken}&expires=${expiryTimestamp}`;

    return {
      uploadUrl,
      presignedToken,
      expiresAt,
      storageKey,
      headers: {
        'Content-Type': options.mimeType,
        'X-Max-Bytes': options.maxSizeBytes.toString(),
      },
    };
  }

  public async generatePresignedPlaybackUrl(
    storageKey: string,
    options: { expiresInSeconds: number }
  ): Promise<StoragePresignedPlaybackResult> {
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);
    const presignedToken = signMediaStorageToken('playback', storageKey, expiryTimestamp);

    const playbackUrl = `/api/v1/media/storage/playback/${encodeURIComponent(storageKey)}?token=${presignedToken}&expires=${expiryTimestamp}`;

    return {
      playbackUrl,
      presignedToken,
      expiresAt,
    };
  }

  public async verifyObject(
    storageKey: string,
    expectedSize?: number,
    expectedMime?: string
  ): Promise<ObjectVerificationResult> {
    const filePath = this.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return { exists: false, magicValid: false, error: 'Object not found on storage provider' };
    }

    const stat = fs.statSync(filePath);
    // node-postgres returns BIGINT columns as strings ("16"); PGlite returns
    // numbers. Compare numerically so real PostgreSQL behaves the same.
    const expectedBytes = expectedSize === undefined || expectedSize === null ? undefined : Number(expectedSize);
    if (expectedBytes && stat.size !== expectedBytes) {
      return {
        exists: true,
        sizeBytes: stat.size,
        magicValid: false,
        error: `Size mismatch: expected ${expectedBytes} bytes, found ${stat.size} bytes`,
      };
    }

    // Read header bytes to validate magic bytes
    const fd = fs.openSync(filePath, 'r');
    const headerBuffer = Buffer.alloc(32);
    fs.readSync(fd, headerBuffer, 0, 32, 0);
    fs.closeSync(fd);

    const magic = validateVideoMagicBytes(headerBuffer);
    if (!magic.valid) {
      return {
        exists: true,
        sizeBytes: stat.size,
        magicValid: false,
        error: 'Binary magic byte verification failed: file is not a valid MP4, WebM, or QuickTime video',
      };
    }

    // Compute SHA-256 checksum
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
      exists: true,
      sizeBytes: stat.size,
      mimeType: magic.detectedFormat || expectedMime,
      checksumSha256: hash,
      magicValid: true,
      detectedFormat: magic.detectedFormat,
    };
  }

  public async saveObject(
    storageKey: string,
    data: Buffer,
    mimeType: string
  ): Promise<{ sizeBytes: number; checksumSha256: string }> {
    const filePath = this.getFilePath(storageKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data);

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return {
      sizeBytes: data.length,
      checksumSha256: hash,
    };
  }

  public async getObject(storageKey: string, token?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const filePath = this.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    const magic = validateVideoMagicBytes(buffer);
    const contentType = magic.detectedFormat || 'video/mp4';
    return { buffer, contentType };
  }

  public async deleteObject(storageKey: string): Promise<boolean> {
    const filePath = this.getFilePath(storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  public revokeTokensForStudent(studentId: string): void {
    revokedStudentPrefixes.add(`students/${studentId}/videos`);
  }

  public isTokenRevoked(token: string): boolean {
    return revokedTokensSet.has(token);
  }
}

// Global active instance of storage provider
export const mediaStorageAdapter: IMediaStorageProvider = new LocalMediaStorageProvider();
