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
      if (!member.rowCount) {
        const makeupCheck = await dbClient.query(
          "SELECT 1 FROM make_up_bookings WHERE session_id = $1 AND student_id = $2 AND status = 'CONFIRMED'",
          [sess.id, r.studentId]
        );
        if (!makeupCheck.rowCount) {
          return res.status(400).json({ error: 'Attendance contains a student outside this session\'s class/group.' });
        }
      }
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

// ================= AUTOMATIC OFFLINE ATTENDANCE SYNC (Task 2.3) =================
// Accepts batch attendance mutations from the mobile SQLite queue.
// Guarantees server-authoritative validation, replay protection, and structured conflict codes.
router.post('/sync', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only assigned Masters can synchronize attendance mutations.' });
    }

    const { mutations } = req.body;
    if (!Array.isArray(mutations)) {
      return res.status(400).json({ error: 'mutations array is required.' });
    }

    const synced: string[] = [];
    const conflicts: Array<{
      mutationId: string;
      code: string;
      reason: string;
      serverStatus?: string | null;
      serverTimestamp?: string | null;
      serverVersion?: number | null;
    }> = [];
    const errors: Array<{ mutationId: string; error: string }> = [];

    for (const m of mutations) {
      const {
        mutationId,
        sessionId,
        studentId,
        status,
        clientTimestamp,
        baseVersion,
      } = m;

      if (!mutationId || !sessionId || !studentId || !status) {
        errors.push({ mutationId: mutationId || 'unknown', error: 'Missing required mutation fields.' });
        continue;
      }

      try {
        // 1. Idempotency Check (Persistent Replay Protection)
        const replayRes = await dbClient.query(
          'SELECT mutation_id FROM processed_sync_mutations WHERE mutation_id = $1',
          [mutationId]
        );
        if (replayRes.rowCount > 0) {
          // Already successfully processed: acknowledge idempotently
          synced.push(mutationId);
          continue;
        }

        // 2. Session Validation & Tenant Ownership
        const sessRes = await dbClient.query(
          `SELECT ts.*, c.organization_id AS class_org_id
           FROM training_sessions ts
           JOIN classes c ON c.id = ts.class_id
           WHERE ts.id = $1`,
          [sessionId]
        );

        if (sessRes.rowCount === 0) {
          conflicts.push({
            mutationId,
            code: 'SESSION_NOT_FOUND',
            reason: 'The specified training session does not exist on the server.',
          });
          continue;
        }

        const sess = sessRes.rows[0];

        // Cross-Tenant Protection
        if (!user.organizationId || sess.class_org_id !== user.organizationId) {
          conflicts.push({
            mutationId,
            code: 'CROSS_TENANT_REJECTED',
            reason: 'Session belongs to a different organization.',
          });
          continue;
        }

        // Session Closed / Cancelled
        if (sess.status === 'Cancelled') {
          conflicts.push({
            mutationId,
            code: 'SESSION_CLOSED',
            reason: 'Training session has been cancelled on the server.',
          });
          continue;
        }

        // 3. Master Assignment Verification (Re-derived dynamically)
        const hasAccess = await assignedMasterAccess(user, sess.class_id);
        if (!hasAccess) {
          conflicts.push({
            mutationId,
            code: 'MASTER_ASSIGNMENT_REVOKED',
            reason: 'Master is no longer assigned to teach this class.',
          });
          continue;
        }

        // 4. Allowed Status
        if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
          conflicts.push({
            mutationId,
            code: 'INVALID_STATUS',
            reason: `Status "${status}" is not permitted. Must be one of ${VALID_ATTENDANCE_STATUSES.join(', ')}.`,
          });
          continue;
        }

        // 5. Student Enrollment & Active Status
        const studentRes = await dbClient.query(
          'SELECT id, class_id, group_id, status, organization_id FROM students WHERE id = $1',
          [studentId]
        );

        if (studentRes.rowCount === 0 || studentRes.rows[0].organization_id !== user.organizationId) {
          conflicts.push({
            mutationId,
            code: 'STUDENT_NOT_FOUND',
            reason: 'Student does not exist in this organization.',
          });
          continue;
        }

        const student = studentRes.rows[0];
        if (student.status !== 'ACTIVE') {
          conflicts.push({
            mutationId,
            code: 'STUDENT_REMOVED',
            reason: 'Student is inactive or has been removed from the roster.',
          });
          continue;
        }

        if (student.class_id !== sess.class_id || (sess.group_id && student.group_id !== sess.group_id)) {
          conflicts.push({
            mutationId,
            code: 'STUDENT_TRANSFERRED',
            reason: 'Student has been transferred to another class or training group.',
          });
          continue;
        }

        // 6 & 7. Scoped Transaction with Optimistic Concurrency & Replay Protection
        const txResult = await dbClient.transaction(async (tx) => {
          // Inner idempotency check to guard against concurrent replay
          const replayInTx = await tx.query(
            'SELECT mutation_id FROM processed_sync_mutations WHERE mutation_id = $1',
            [mutationId]
          );
          if (replayInTx.rowCount > 0) {
            return { outcome: 'synced' as const };
          }

          // Lock or inspect existing session_attendance record
          const existingAtt = await tx.query(
            'SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2 FOR UPDATE',
            [sessionId, studentId]
          );

          if (existingAtt.rowCount > 0) {
            const currentRec = existingAtt.rows[0];
            const serverVersion = Number(currentRec.version ?? 1);

            // Optimistic concurrency check if baseVersion provided
            if (baseVersion !== undefined && baseVersion !== null) {
              if (Number(baseVersion) !== serverVersion) {
                return {
                  outcome: 'conflict' as const,
                  conflict: {
                    mutationId,
                    code: 'CONCURRENT_MODIFICATION',
                    reason: `Attendance version mismatch (client baseVersion ${baseVersion}, server version ${serverVersion}).`,
                    serverStatus: currentRec.status,
                    serverTimestamp: currentRec.marked_at,
                    serverVersion,
                  },
                };
              }
            } else {
              // Legacy conflict check: marked by another user and server mark was created after client mutation
              if (
                currentRec.marked_by &&
                currentRec.marked_by !== user.id &&
                clientTimestamp &&
                new Date(currentRec.marked_at).getTime() > new Date(clientTimestamp).getTime()
              ) {
                return {
                  outcome: 'conflict' as const,
                  conflict: {
                    mutationId,
                    code: 'CONCURRENT_MODIFICATION',
                    reason: 'Attendance was updated by another instructor on the server.',
                    serverStatus: currentRec.status,
                    serverTimestamp: currentRec.marked_at,
                    serverVersion,
                  },
                };
              }
            }

            // Atomic SQL UPDATE enforcing version matching
            const updateRes = await tx.query(
              `UPDATE session_attendance
               SET status = $1, marked_by = $2, marked_at = CURRENT_TIMESTAMP,
                   version = version + 1, updated_at = CURRENT_TIMESTAMP
               WHERE session_id = $3 AND student_id = $4 AND version = $5
               RETURNING *`,
              [status, user.id, sessionId, studentId, serverVersion]
            );

            if (updateRes.rowCount === 0) {
              const reFetch = await tx.query(
                'SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2',
                [sessionId, studentId]
              );
              const reRec = reFetch.rows[0];
              return {
                outcome: 'conflict' as const,
                conflict: {
                  mutationId,
                  code: 'CONCURRENT_MODIFICATION',
                  reason: 'Concurrent modification detected. Server record was modified concurrently.',
                  serverStatus: reRec?.status,
                  serverTimestamp: reRec?.marked_at,
                  serverVersion: reRec ? Number(reRec.version) : undefined,
                },
              };
            }
          } else {
            // First attendance mark: no existing record
            if (baseVersion !== undefined && baseVersion !== null && Number(baseVersion) > 0) {
              return {
                outcome: 'conflict' as const,
                conflict: {
                  mutationId,
                  code: 'CONCURRENT_MODIFICATION',
                  reason: `Attendance record does not exist on server (client specified baseVersion ${baseVersion}).`,
                  serverStatus: null,
                  serverTimestamp: null,
                  serverVersion: 0,
                },
              };
            }

            // Atomic INSERT with ON CONFLICT DO NOTHING to prevent race conditions
            const insertRes = await tx.query(
              `INSERT INTO session_attendance (id, session_id, student_id, status, marked_by, marked_at, version, updated_at)
               VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
               ON CONFLICT (session_id, student_id) DO NOTHING
               RETURNING *`,
              [newId('satt'), sessionId, studentId, status, user.id]
            );

            if (insertRes.rowCount === 0) {
              const reFetch = await tx.query(
                'SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2',
                [sessionId, studentId]
              );
              const reRec = reFetch.rows[0];
              return {
                outcome: 'conflict' as const,
                conflict: {
                  mutationId,
                  code: 'CONCURRENT_MODIFICATION',
                  reason: 'Concurrent attendance mark already recorded by another user.',
                  serverStatus: reRec?.status,
                  serverTimestamp: reRec?.marked_at,
                  serverVersion: reRec ? Number(reRec.version) : undefined,
                },
              };
            }
          }

          // Atomically update session status to Completed
          await tx.query(
            'UPDATE training_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['Completed', sess.id]
          );

          // Atomically record in processed_sync_mutations for replay protection
          await tx.query(
            `INSERT INTO processed_sync_mutations (mutation_id, organization_id, actor_id, session_id, student_id, status, client_timestamp, processed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [mutationId, user.organizationId, user.id, sessionId, studentId, status, clientTimestamp ? new Date(clientTimestamp) : new Date()]
          );

          // Atomically write audit log entry
          await tx.query(
            `INSERT INTO audit_logs (id, action, details, user_role, user_email)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              newId('audit'),
              'Offline Attendance Synchronized',
              `Mutation ${mutationId}: Session ${sessionId}, Student ${studentId} marked ${status} by Master ${user.email}`,
              user.role,
              user.email,
            ]
          );

          return { outcome: 'synced' as const };
        });

        if (txResult.outcome === 'conflict') {
          // A concurrent duplicate of this SAME mutation (e.g. a client resend
          // while the first request was still running) waits for the first to
          // commit and then sees its row. It is already applied, so acknowledge
          // it rather than showing the Master a false conflict.
          const alreadyApplied = await dbClient.query(
            'SELECT 1 FROM processed_sync_mutations WHERE mutation_id = $1',
            [mutationId]
          );
          if (alreadyApplied.rowCount > 0) {
            synced.push(mutationId);
          } else {
            conflicts.push(txResult.conflict);
          }
        } else {
          synced.push(mutationId);
        }
      } catch (mutationErr: any) {
        errors.push({ mutationId, error: safeErrorMessage(mutationErr, 'Failed to process mutation.') });
      }
    }

    return res.json({
      message: `Processed ${mutations.length} mutations.`,
      synced,
      conflicts,
      errors,
    });
  } catch (err: any) {
    console.error('[Sync error]', err);
    return res.status(500).json({ error: 'Database error during sync', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
