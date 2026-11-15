import { Request, Response, NextFunction } from 'express';
import { recordSecurityEvent } from '../services/securityEvents';

/**
 * Records every refused API request (401/403 = access denied, 429 = rate
 * limited) once the response has been sent. Sign-in failures are recorded
 * by the sign-in route itself with more detail, so they are skipped here.
 */
export function securityAudit(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const status = res.statusCode;
    if (status !== 401 && status !== 403 && status !== 429) return;
    if (!req.originalUrl.startsWith('/api/')) return;
    if ((res.locals as any).securityEventRecorded) return;
    void recordSecurityEvent({
      type: status === 429 ? 'RATE_LIMITED' : 'ACCESS_DENIED',
      severity: 'WARN',
      req,
      userId: req.user?.id,
      status,
    });
  });
  next();
}
