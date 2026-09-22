import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { UserRole } from '../security/rbac';
import { authenticateJWT } from '../middleware/auth';
import { classAccess, assignedMasterAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_NOTICE_TYPES = ['NEW_SCHEDULE', 'SCHEDULE_CHANGE', 'CANCELLED', 'EXTRA_SESSION', 'GENERAL'];

// Send a standalone notice not tied to a specific session change (e.g. a
// general announcement to a group or the whole class) — assigned Master only.
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { classId, groupId, message, type } = req.body;
    if (!classId || !message || !message.trim()) {
      return res.status(400).json({ error: 'classId and message are required.' });
    }
    if (!(await assignedMasterAccess(req.user!, classId))) {
      return res.status(403).json({ error: 'Only the assigned Master may send notices for this class.' });
    }
    if (groupId) {
      const group = await dbClient.query('SELECT id FROM training_groups WHERE id = $1 AND class_id = $2', [groupId, classId]);
      if (!group.rowCount) return res.status(400).json({ error: 'Group must belong to this class.' });
    }
    const noticeType = VALID_NOTICE_TYPES.includes(type) ? type : 'GENERAL';
    const cls = (await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [classId])).rows[0];

    const result = await dbClient.query(
      `INSERT INTO notices (id, organization_id, class_id, group_id, type, message, sender_id, sender_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [newId('notice'), cls.organization_id, classId, groupId || null, noticeType, message.trim(), req.user!.id, req.user!.email]
    );

    return res.status(201).json({ notice: result.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Class-level notice feed — assigned Master or same-organization Admin
// (view only for Admin; both are read-only here regardless of role since
// this is a GET, but only classAccess-eligible roles at all).
router.get('/class/:classId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await classAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to view notices for this class.' });
    }
    const result = await dbClient.query(
      'SELECT * FROM notices WHERE class_id = $1 ORDER BY created_at DESC', [req.params.classId]);
    return res.json({ notices: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Notices visible to the current Parent/Student — scoped strictly to the
// class/group of their own linked student(s), never a class-wide dump of
// every notice in the organization. Never trusts a client-supplied
// recipient list: membership is re-derived server-side from
// students/parent_student_links on every call.
router.get('/mine', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let studentIds: string[] = [];
    if (user.role === UserRole.STUDENT) {
      const s = await dbClient.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
      studentIds = s.rows.map(r => r.id);
    } else if (user.role === UserRole.PARENT) {
      studentIds = user.linkedStudentIds || [];
    } else {
      return res.status(403).json({ error: 'Only Parent or Student accounts have a personal notice feed.' });
    }
    if (studentIds.length === 0) return res.json({ notices: [] });

    const result = await dbClient.query(
      `SELECT DISTINCT n.* FROM notices n
       JOIN students s ON s.class_id = n.class_id AND (n.group_id IS NULL OR n.group_id = s.group_id)
       WHERE s.id = ANY($1::text[])
       ORDER BY n.created_at DESC`,
      [studentIds]
    );
    return res.json({ notices: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
