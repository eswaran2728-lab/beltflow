import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

/**
 * Security monitoring for the platform operator (Super Admin only).
 *
 * Shows the suspicious-activity log: refused requests, failed sign-ins,
 * lockouts, rate limiting and alerts. The log holds no passwords, tokens,
 * request bodies or child data; client addresses are one-way hashes.
 */
const router = Router();

router.get('/events', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only the platform Super Admin can view security events.' });
    }
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const type = typeof req.query.type === 'string' && /^[A-Z_]{3,50}$/.test(req.query.type) ? req.query.type : null;

    const events = await dbClient.query(
      `SELECT id, type, severity, client_hash, user_id, method, path, status, detail, created_at
       FROM security_events
       WHERE ($1::text IS NULL OR type = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [type, limit]
    );
    const summary = await dbClient.query(
      `SELECT type, COUNT(*)::int AS count
       FROM security_events
       WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
       GROUP BY type`
    );
    const noisiest = await dbClient.query(
      `SELECT client_hash, COUNT(*)::int AS count
       FROM security_events
       WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' AND client_hash IS NOT NULL
       GROUP BY client_hash
       ORDER BY COUNT(*) DESC
       LIMIT 5`
    );
    const last24h: Record<string, number> = {};
    for (const r of summary.rows) last24h[r.type] = Number(r.count);

    return res.json({
      events: events.rows.map((e: any) => ({
        id: e.id, type: e.type, severity: e.severity, client: e.client_hash, userId: e.user_id,
        method: e.method, path: e.path, status: e.status, detail: e.detail, at: e.created_at,
      })),
      summary: {
        last24h,
        noisiestClients: noisiest.rows.map((r: any) => ({ client: r.client_hash, events: Number(r.count) })),
      },
    });
  } catch (err: any) {
    console.error('[Security events error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Failed to load security events.') });
  }
});

export default router;
