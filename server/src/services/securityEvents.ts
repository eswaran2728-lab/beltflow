import crypto from 'crypto';
import type { Request } from 'express';
import { dbClient } from '../db/client';

/**
 * Suspicious-activity log.
 *
 * Every event is written to the security_events table and to the process
 * log as one JSON line (so a log collector can alert on it). It never
 * records passwords, tokens, request bodies or child data, and the client
 * address is stored only as a salted one-way hash: enough to see "the same
 * client did this 40 times" without keeping the address itself.
 *
 * Recording never throws and never blocks the request it describes.
 */
export type SecurityEventType =
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCESS_DENIED'
  | 'RATE_LIMITED'
  | 'INSECURE_REQUEST_BLOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_ISSUED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_RESET_FAILED'
  | 'SUSPICIOUS_ACTIVITY';

type Severity = 'INFO' | 'WARN' | 'ALERT';

const HASH_SALT = crypto.randomBytes(16).toString('hex');
/** One-way, per-process hash of the client address. */
export function clientHash(req: Pick<Request, 'ip'> | undefined): string | null {
  const ip = req?.ip;
  return ip ? crypto.createHash('sha256').update(`${HASH_SALT}:${ip}`).digest('hex').slice(0, 32) : null;
}

// A noisy client must not be able to fill the table: at most this many rows
// per client and type per minute are stored (the rest are only counted).
const MAX_ROWS_PER_CLIENT_PER_MINUTE = 20;
// This many refusals from one client in ten minutes raises one ALERT.
const SUSPICIOUS_THRESHOLD = 30;
const recent = new Map<string, { count: number; resetAt: number }>();
const refusals = new Map<string, { count: number; resetAt: number; alerted: boolean }>();

function bump<T extends { count: number; resetAt: number }>(map: Map<string, T>, key: string, windowMs: number, fresh: () => T): T {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    entry = fresh();
    entry.resetAt = now + windowMs;
    map.set(key, entry);
  }
  entry.count += 1;
  if (map.size > 5000) {
    for (const [k, v] of map) if (now > v.resetAt) map.delete(k);
    if (map.size > 5000) map.clear();
  }
  return entry;
}

export interface SecurityEventInput {
  type: SecurityEventType;
  severity?: Severity;
  req?: Request;
  userId?: string | null;
  status?: number;
  /** Short, non-sensitive description. Never put secrets or personal data here. */
  detail?: string;
}

export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const client = clientHash(input.req);
    const path = input.req ? String(input.req.originalUrl || input.req.path || '').split('?')[0].slice(0, 255) : null;
    const key = `${client}:${input.type}`;
    const seen = bump(recent, key, 60_000, () => ({ count: 0, resetAt: 0 }));
    const store = seen.count <= MAX_ROWS_PER_CLIENT_PER_MINUTE;

    const row = {
      type: input.type,
      severity: input.severity || 'WARN',
      client,
      userId: input.userId || null,
      method: input.req?.method || null,
      path,
      status: input.status ?? null,
      detail: input.detail ? input.detail.slice(0, 500) : null,
    };
    if (store) {
      console.warn(`[security] ${JSON.stringify(row)}`);
      await dbClient.query(
        `INSERT INTO security_events (id, type, severity, client_hash, user_id, method, path, status, detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [`sev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`, row.type, row.severity, row.client, row.userId, row.method, row.path, row.status, row.detail]
      );
    }

    // Many refusals from one client in a short time: raise a single alert.
    if (client && ['LOGIN_FAILED', 'ACCESS_DENIED', 'RATE_LIMITED', 'PASSWORD_RESET_FAILED'].includes(input.type)) {
      const r = bump(refusals, client, 10 * 60_000, () => ({ count: 0, resetAt: 0, alerted: false }));
      if (r.count >= SUSPICIOUS_THRESHOLD && !r.alerted) {
        r.alerted = true;
        const detail = `${r.count} refused requests from one client within 10 minutes`;
        console.error(`[security] ${JSON.stringify({ type: 'SUSPICIOUS_ACTIVITY', severity: 'ALERT', client, detail })}`);
        await dbClient.query(
          `INSERT INTO security_events (id, type, severity, client_hash, detail) VALUES ($1, 'SUSPICIOUS_ACTIVITY', 'ALERT', $2, $3)`,
          [`sev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`, client, detail]
        );
      }
    }
  } catch (err) {
    // Logging must never break the request.
    console.error('[security] could not record event', err instanceof Error ? err.message : err);
  }
}
