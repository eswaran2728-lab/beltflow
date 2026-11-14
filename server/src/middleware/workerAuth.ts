import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { authenticateJWT } from './auth';
import { UserRole } from '../security/rbac';

const MIN_KEY_LENGTH = 16;

function sameSecret(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Worker trigger routes process every Persatuan, so only the internal
 * scheduler (header x-beltflow-worker-token = BELTFLOW_WORKER_TOKEN, at least
 * 16 characters) or a Super Admin may call them. Responses carry counts only,
 * never child records.
 */
export function requireWorkerOrSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.BELTFLOW_WORKER_TOKEN || '';
  const given = req.header('x-beltflow-worker-token') || '';
  if (expected.length >= MIN_KEY_LENGTH && given && sameSecret(given, expected)) {
    return next();
  }
  return authenticateJWT(req, res, () => {
    if (req.user?.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only the scheduler or a Super Admin can run this job.' });
    }
    return next();
  });
}
