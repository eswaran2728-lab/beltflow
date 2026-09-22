import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { classAccess, assignedMasterAccess, studentAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent', 'Excused'];

// Record session attendance (ADMIN_PERSATUAN or assigned MASTER; Super Admin denied)
router.post('/record', authenticateJWT, requirePermission(Permission.CLASS_MARK_ATTENDANCE), async (req: Request, res: Response) => {
  try {
    const { classId, sessionDate, records } = req.body;

    if (!classId || !sessionDate || !Array.isArray(records)) {
      return res.status(400).json({ error: 'classId, sessionDate, and records array are required.' });
    }
    if (!await classAccess(req.user!, classId)) return res.status(403).json({ error: 'Class access denied.' });
    for (const record of records) {
      const member = await dbClient.query('SELECT id FROM students WHERE id = $1 AND class_id = $2', [record.studentId, classId]);
      if (!member.rowCount) return res.status(400).json({ error: 'Attendance contains a student outside this class.' });
    }

    // Insert session header
    await dbClient.query(
      `INSERT INTO attendance_sessions (id, class_id, session_date, status, completed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (class_id, session_date) DO UPDATE SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP`,
      [`sess_${classId}_${sessionDate}`, classId, sessionDate, 'COMPLETED']
    );

    // Insert attendance item records
    for (const r of records) {
      const recId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await dbClient.query(
        `INSERT INTO attendance_records (id, class_id, session_date, student_id, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (class_id, session_date, student_id) DO UPDATE SET status = EXCLUDED.status, marked_at = CURRENT_TIMESTAMP`,
        [recId, classId, sessionDate, r.studentId, r.status || 'present']
      );
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Attendance Recorded', `Recorded attendance for class ${classId} on ${sessionDate} (${records.length} students)`, req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Attendance recorded successfully in PostgreSQL.', count: records.length });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Get attendance for a class
router.get('/class/:classId', authenticateJWT, requirePermission(Permission.CLASS_VIEW_ATTENDANCE), async (req: Request, res: Response) => {
  try {
    if (!await classAccess(req.user!, req.params.classId)) return res.status(403).json({ error: 'Class access denied.' });
    const listRes = await dbClient.query('SELECT * FROM attendance_records WHERE class_id = $1 ORDER BY marked_at DESC', [req.params.classId]);
    return res.json({ attendance: listRes.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ================= SESSION-SCOPED ATTENDANCE (new group/session-aware model) =================
// Distinct from the legacy /record above: this operates on training_sessions
// + session_attendance, is group-aware, and is assigned-Master-only (never
// the Persatuan Admin — they may view but not mark attendance).

// The eligible roster for a session's attendance list — only students
// enrolled in that exact class/location AND that exact group.
router.get('/session/:sessionId/roster', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const sessRes = await dbClient.query('SELECT * FROM training_sessions WHERE id = $1', [req.params.sessionId]);
    if (sessRes.rowCount === 0) return res.status(404).json({ error: 'Session not found.' });
    const sess = sessRes.rows[0];
    if (!(await classAccess(req.user!, sess.class_id))) {
      return res.status(403).json({ error: 'You are not authorized to view this session.' });
    }
    const students = await dbClient.query(
      "SELECT id, full_name, belt_rank FROM students WHERE class_id = $1 AND group_id = $2 AND status = 'ACTIVE' ORDER BY full_name",
      [sess.class_id, sess.group_id]
    );
    const marked = await dbClient.query('SELECT * FROM session_attendance WHERE session_id = $1', [req.params.sessionId]);
    const markedByStudent = new Map(marked.rows.map(r => [r.student_id, r]));
    return res.json({
      session: sess,
      roster: students.rows.map(s => ({ ...s, attendance: markedByStudent.get(s.id) || null }))
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Mark attendance for one actual session — assigned Master only. Rejects
// any student not enrolled in this exact class AND group, and rejects a
// Master not currently assigned to this class (assignedMasterAccess is
// re-derived fresh from coach_class_assignments on every request, so a
// just-revoked Master is rejected immediately, not on some future sync).
router.post('/session/:sessionId/mark', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { records } = req.body; // [{ studentId, status }]
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array is required.' });
    }
    const sessRes = await dbClient.query('SELECT * FROM training_sessions WHERE id = $1', [req.params.sessionId]);
    if (sessRes.rowCount === 0) return res.status(404).json({ error: 'Session not found.' });
    const sess = sessRes.rows[0];
    if (!(await assignedMasterAccess(req.user!, sess.class_id))) {
      return res.status(403).json({ error: 'Only the Master assigned to this class may mark attendance.' });
    }

    for (const r of records) {
      if (!VALID_ATTENDANCE_STATUSES.includes(r.status)) {
        return res.status(400).json({ error: `Invalid status "${r.status}". Must be one of ${VALID_ATTENDANCE_STATUSES.join(', ')}.` });
      }
      const member = await dbClient.query(
        "SELECT id FROM students WHERE id = $1 AND class_id = $2 AND group_id = $3 AND status = 'ACTIVE'",
        [r.studentId, sess.class_id, sess.group_id]
      );
      if (!member.rowCount) return res.status(400).json({ error: 'Attendance contains a student outside this session\'s class/group.' });
    }

    for (const r of records) {
      await dbClient.query(
        `INSERT INTO session_attendance (id, session_id, student_id, status, marked_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = CURRENT_TIMESTAMP`,
        [newId('satt'), req.params.sessionId, r.studentId, r.status, req.user!.id]
      );
    }

    await dbClient.query('UPDATE training_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['Completed', sess.id]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [newId('audit'), 'Session Attendance Recorded', `Session ${sess.id} (Class ${sess.class_id}, Group ${sess.group_id}): ${records.length} students marked`, req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Attendance recorded for session.', count: records.length });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// A single student's own session-attendance history — self, linked Parent,
// assigned Master, or same-organization Admin (view only); Super Admin
// excluded (studentAccess never grants it).
router.get('/student/:studentId/history', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const access = await studentAccess(req.user!, req.params.studentId);
    if (!access.allowed) return res.status(403).json({ error: 'Attendance history access denied.' });
    const result = await dbClient.query(
      `SELECT sa.*, ts.session_date, ts.day_of_week, ts.start_time, ts.end_time, ts.location, ts.is_extra, tg.name AS group_name
       FROM session_attendance sa
       JOIN training_sessions ts ON ts.id = sa.session_id
       JOIN training_groups tg ON tg.id = ts.group_id
       WHERE sa.student_id = $1
       ORDER BY ts.session_date DESC, ts.start_time DESC`,
      [req.params.studentId]
    );
    return res.json({ attendance: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
