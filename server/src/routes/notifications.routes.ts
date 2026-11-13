import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';
import { PUSH_TOKEN_PATTERN, registerDevice, unregisterDevice } from '../services/notifications/push';

/**
 * The caller's own in-app notifications. Every query is scoped to
 * req.user.id; there is no way to read or change anyone else's.
 */
const router = Router();

router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const list = await dbClient.query(
      `SELECT id, event_type, aggregate_type, aggregate_id, params, read_at, created_at
       FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
    const unread = await dbClient.query(
      `SELECT id FROM user_notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]);
    return res.json({
      unreadCount: unread.rows.length,
      notifications: list.rows.map((n: any) => ({
        id: n.id,
        eventType: n.event_type,
        aggregateType: n.aggregate_type,
        aggregateId: n.aggregate_id,
        params: typeof n.params === 'string' ? JSON.parse(n.params) : n.params || {},
        read: !!n.read_at,
        createdAt: n.created_at,
      })),
    });
  } catch (err: any) {
    console.error('[Notifications list error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to load notifications.') });
  }
});

// Register this phone for push notifications (the token is never returned).
router.post('/devices', authenticateJWT, async (req: Request, res: Response) => {
  const { token, platform, locale } = req.body || {};
  if (typeof token !== 'string' || !PUSH_TOKEN_PATTERN.test(token)) {
    return res.status(400).json({ error: 'A valid push token is required.' });
  }
  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be android or ios.' });
  }
  const lang = ['en', 'ms', 'ta'].includes(locale) ? locale : 'en';
  try {
    await registerDevice(req.user!.id, token, platform, lang);
    return res.json({ registered: true });
  } catch (err: any) {
    console.error('[Push device register error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to register device.') });
  }
});

// Stop push to this phone (logout). Only the caller's own device is affected.
router.delete('/devices', authenticateJWT, async (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || !PUSH_TOKEN_PATTERN.test(token)) {
    return res.status(400).json({ error: 'A valid push token is required.' });
  }
  try {
    await unregisterDevice(req.user!.id, token);
    return res.json({ unregistered: true });
  } catch (err: any) {
    console.error('[Push device unregister error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to unregister device.') });
  }
});

router.post('/read-all', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const r = await dbClient.query(
      `UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL RETURNING id`, [req.user!.id]);
    return res.json({ updated: r.rows.length });
  } catch (err: any) {
    console.error('[Notifications read-all error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to update notifications.') });
  }
});

router.post('/:id/read', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const r = await dbClient.query(
      `UPDATE user_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND user_id = $2 RETURNING id`, [req.params.id, req.user!.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Notification not found.' });
    return res.json({ id: r.rows[0].id, read: true });
  } catch (err: any) {
    console.error('[Notifications read error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to update notification.') });
  }
});

export default router;
