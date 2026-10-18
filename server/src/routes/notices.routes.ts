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
    const { classId, groupId, message, type, requiresAcknowledgement, acknowledgementDeadline } = req.body;
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
      `INSERT INTO notices (
         id, organization_id, class_id, group_id, type, message, sender_id, sender_name,
         requires_acknowledgement, acknowledgement_deadline
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        newId('notice'),
        cls.organization_id,
        classId,
        groupId || null,
        noticeType,
        message.trim(),
        req.user!.id,
        req.user!.email,
        Boolean(requiresAcknowledgement),
        acknowledgementDeadline ? new Date(acknowledgementDeadline).toISOString() : null,
      ]
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

// ============================================================================
// Task H11: Notice Acknowledgement Endpoints
// ============================================================================

// Acknowledge a notice (Parent or Student)
router.post('/:noticeId/acknowledge', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.PARENT && user.role !== UserRole.STUDENT) {
      return res.status(403).json({ error: 'Only parents or students may acknowledge notices.' });
    }

    const { noticeId } = req.params;
    const { studentId: reqStudentId, notes } = req.body;

    // Fetch notice
    const noticeRes = await dbClient.query('SELECT * FROM notices WHERE id = $1', [noticeId]);
    if (noticeRes.rowCount === 0) {
      return res.status(404).json({ error: 'Notice not found.' });
    }
    const notice = noticeRes.rows[0];

    // Determine target student ID
    let studentId: string | null = null;
    if (user.role === UserRole.PARENT) {
      if (!reqStudentId) {
        return res.status(400).json({ error: 'studentId is required for parent acknowledgement.' });
      }
      if (!user.linkedStudentIds?.includes(reqStudentId)) {
        return res.status(403).json({ error: 'You are not authorized to acknowledge for this student.' });
      }
      studentId = reqStudentId;
    } else if (user.role === UserRole.STUDENT) {
      const stuRes = await dbClient.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
      if (stuRes.rowCount === 0) {
        return res.status(404).json({ error: 'Student record not found.' });
      }
      studentId = stuRes.rows[0].id;
    }

    // Verify student is actually enrolled in this class
    const enrollCheck = await dbClient.query(
      `SELECT id FROM students WHERE id = $1 AND class_id = $2 AND organization_id = $3`,
      [studentId, notice.class_id, notice.organization_id]
    );
    if (enrollCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Student is not enrolled in the class for this notice.' });
    }

    const ackId = `ack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ackRes = await dbClient.query(
      `INSERT INTO notice_acknowledgements (id, notice_id, user_id, student_id, notes, acknowledged_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (notice_id, user_id, student_id)
       DO UPDATE SET acknowledged_at = CURRENT_TIMESTAMP, notes = EXCLUDED.notes
       RETURNING *`,
      [ackId, noticeId, user.id, studentId, notes || null]
    );

    return res.status(200).json({
      acknowledged: true,
      acknowledgement: ackRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// View notice acknowledgements & roster compliance metrics (Assigned Master or Admin Persatuan)
router.get('/:noticeId/acknowledgements', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { noticeId } = req.params;
    const noticeRes = await dbClient.query('SELECT * FROM notices WHERE id = $1', [noticeId]);
    if (noticeRes.rowCount === 0) {
      return res.status(404).json({ error: 'Notice not found.' });
    }
    const notice = noticeRes.rows[0];

    // Master or Admin access check
    const hasAccess =
      (req.user?.role === UserRole.ADMIN_PERSATUAN && req.user.organizationId === notice.organization_id) ||
      (req.user?.role === UserRole.MASTER && (await assignedMasterAccess(req.user, notice.class_id)));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Only assigned Masters or Persatuan Admins may inspect notice acknowledgements.' });
    }

    // Acknowledgements list
    const acksRes = await dbClient.query(
      `SELECT na.*, u.full_name AS user_name, u.email AS user_email, u.role AS user_role,
              s.full_name AS student_name, s.belt_rank AS student_belt
       FROM notice_acknowledgements na
       JOIN users u ON u.id = na.user_id
       LEFT JOIN students s ON s.id = na.student_id
       WHERE na.notice_id = $1
       ORDER BY na.acknowledged_at DESC`,
      [noticeId]
    );

    // Total required: active enrolled students in this class/group
    const studentsRes = notice.group_id
      ? await dbClient.query(
          `SELECT id, full_name, belt_rank FROM students WHERE class_id = $1 AND group_id = $2 AND status = 'ACTIVE'`,
          [notice.class_id, notice.group_id]
        )
      : await dbClient.query(
          `SELECT id, full_name, belt_rank FROM students WHERE class_id = $1 AND status = 'ACTIVE'`,
          [notice.class_id]
        );

    const acknowledgedStudentIds = new Set(acksRes.rows.map(r => r.student_id).filter(Boolean));
    const totalRequired = studentsRes.rowCount;
    const totalAcknowledged = acknowledgedStudentIds.size;
    const totalPending = Math.max(0, totalRequired - totalAcknowledged);

    const pendingStudents = studentsRes.rows.filter(s => !acknowledgedStudentIds.has(s.id));

    return res.json({
      notice,
      acknowledgements: acksRes.rows,
      summary: {
        totalRequired,
        totalAcknowledged,
        totalPending,
        complianceRatePercent: totalRequired > 0 ? Math.round((totalAcknowledged / totalRequired) * 100) : 100,
      },
      pendingStudents,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
