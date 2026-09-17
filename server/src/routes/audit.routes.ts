import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Platform actions only. The legacy audit table has no organization key, so
// academy activity cannot safely be returned from this endpoint.
router.get('/', authenticateJWT, requirePermission(Permission.AUDIT_LOG_VIEW_GLOBAL), async (req: Request, res: Response) => {
  try {
    const logsRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE action IN ('Super Admin Setup', 'Organization Onboarded')
       ORDER BY timestamp DESC LIMIT 200`);
    return res.json({ logs: logsRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
