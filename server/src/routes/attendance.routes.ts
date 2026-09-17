import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { classAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

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
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
