import { Request, Response, NextFunction } from 'express';
import { recordSecurityEvent } from '../services/securityEvents';

/**
 * In production every request must arrive over HTTPS: directly (req.secure)
 * or through a TLS-terminating proxy that sets X-Forwarded-Proto: https.
 * Plain HTTP is refused with 403 rather than redirected, because an API
 * client that sent a password or token over HTTP has already exposed it and
 * should be fixed, not silently redirected.
 *
 * Health probes are exempt (load balancers probe over the private network).
 * ALLOW_INSECURE_HTTP=true switches the check off for a deployment whose TLS
 * is handled somewhere this process cannot see.
 */
const EXEMPT_PATHS = new Set(['/api/health', '/api/health/ready']);

export function insecureRequestBlocked(
  request: { path: string; secure: boolean; forwardedProto?: string },
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.NODE_ENV !== 'production') return false;
  if (env.ALLOW_INSECURE_HTTP === 'true') return false;
  if (EXEMPT_PATHS.has(request.path)) return false;
  if (request.secure) return false;
  const proto = (request.forwardedProto || '').split(',')[0].trim().toLowerCase();
  return proto !== 'https';
}

export function httpsOnly(req: Request, res: Response, next: NextFunction) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const blocked = insecureRequestBlocked({
    path: req.path,
    secure: req.secure,
    forwardedProto: Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto,
  });
  if (!blocked) return next();
  (res.locals as any).securityEventRecorded = true;
  void recordSecurityEvent({ type: 'INSECURE_REQUEST_BLOCKED', severity: 'WARN', req, status: 403 });
  return res.status(403).json({ error: 'HTTPS is required.', code: 'HTTPS_REQUIRED' });
}
