import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';

const router = Router();

// Create grading exam session (ADMIN_PERSATUAN)
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_GRADING_EVENTS), async (req: Request, res: Response) => {
  try {
    const { organizationId, title, eventDate, location, fee, candidates } = req.body;
    const orgId = organizationId || req.user?.organizationId;

    if (!title || !orgId) {
      return res.status(400).json({ error: 'title and organizationId are required.' });
    }

    const eventId = `grd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventRes = await dbClient.query(
      `INSERT INTO grading_events (id, organization_id, title, event_date, location, fee)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [eventId, orgId, title.trim(), eventDate || new Date().toISOString().slice(0, 10), location?.trim() || 'Community Hall', parseFloat(fee) || 60.0]
    );

    // Candidates require their own authorized registration flow.

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Grading Event Created', `Created promotion exam: ${title.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Grading event created successfully in PostgreSQL.', event: eventRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// List grading events for an organization, with registered-candidate counts
router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user!.organizationId || req.params.orgId !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization access denied.' });
    }
    const listRes = await dbClient.query(
      `SELECT e.*, COUNT(c.id) AS candidate_count
       FROM grading_events e LEFT JOIN grading_candidates c ON c.grading_event_id = e.id
       WHERE e.organization_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.params.orgId]
    );
    return res.json({ gradingEvents: listRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: err.message });
  }
});

router.post('/:eventId/register', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, targetBelt } = req.body;
    if (!studentId || !targetBelt) return res.status(400).json({ error: 'Student and target belt are required.' });
    const event = await dbClient.query('SELECT * FROM grading_events WHERE id = $1', [req.params.eventId]);
    if (!event.rowCount) return res.status(404).json({ error: 'Grading event not found.' });
    const access = await studentAccess(req.user!, studentId);
    if (!access.allowed || access.student?.organization_id !== event.rows[0].organization_id ||
        req.user!.role === UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Registration access denied.' });
    }
    const existing = await dbClient.query('SELECT id FROM grading_candidates WHERE grading_event_id = $1 AND student_id = $2', [req.params.eventId, studentId]);
    if (existing.rowCount) return res.status(409).json({ error: 'Already registered.' });
    const id = `gcand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await dbClient.query(
      `INSERT INTO grading_candidates (id, grading_event_id, student_id, current_belt, target_belt, result)
       VALUES ($1, $2, $3, $4, $5, 'Registered') RETURNING *`,
      [id, req.params.eventId, studentId, access.student.belt_rank, targetBelt]);
    return res.status(201).json({ candidate: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Score grading candidates and auto-issue certificates (ADMIN_PERSATUAN or assigned MASTER; Super Admin denied)
router.post('/:eventId/score', authenticateJWT, requirePermission(Permission.CLASS_SCORE_GRADING), async (req: Request, res: Response) => {
  try {
    const eventRes = await dbClient.query('SELECT * FROM grading_events WHERE id = $1', [req.params.eventId]);
    if (eventRes.rowCount === 0) return res.status(404).json({ error: 'Grading event not found.' });

    const event = eventRes.rows[0];
    if (event.organization_id !== req.user!.organizationId) return res.status(403).json({ error: 'Cross-organization grading denied.' });
    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [event.organization_id]);
    const org = orgRes.rows[0];

    const { results } = req.body;
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'results array is required.' });
    }
    for (const result of results) {
      const access = await studentAccess(req.user!, result.studentId);
      if (!access.allowed || access.student?.organization_id !== event.organization_id) {
        return res.status(403).json({ error: 'Grading student access denied.' });
      }
      const candidate = await dbClient.query(
        'SELECT id, result AS current_result FROM grading_candidates WHERE grading_event_id = $1 AND student_id = $2',
        [event.id, result.studentId]);
      if (!candidate.rowCount) return res.status(400).json({ error: 'Student is not registered for this grading.' });
      if (candidate.rows[0].current_result !== 'Registered') {
        return res.status(409).json({ error: `Candidate has already been graded (result: ${candidate.rows[0].current_result}).` });
      }
    }

    const issuedCerts: any[] = [];

    for (const r of results) {
      const stuRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [r.studentId]);
      if (stuRes.rowCount === 0) continue;
      const student = stuRes.rows[0];
      await dbClient.query(
        `UPDATE grading_candidates SET result = $1, notes = $2, graded_at = CURRENT_TIMESTAMP
         WHERE grading_event_id = $3 AND student_id = $4`,
        [r.result, r.notes || null, event.id, student.id]);

      if (r.result === 'Passed' || r.result === 'Double Promotion') {
        // Update student belt rank in PostgreSQL
        await dbClient.query('UPDATE students SET belt_rank = $1 WHERE id = $2', [r.targetBelt, student.id]);

        const certCode = `BF-${student.full_name.substring(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const certId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const certRes = await dbClient.query(
          `INSERT INTO certificates (id, code, organization_id, organization_name, student_id, student_name, master_name, rank_or_title, type, issue_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [certId, certCode, student.organization_id, org ? org.name : 'BeltFlow Academy', student.id, student.full_name, org ? org.master_name : 'Chief Examiner', r.targetBelt, 'Promotion Exam', new Date().toISOString().slice(0, 10), 'ACTIVE']
        );

        issuedCerts.push(certRes.rows[0]);

        await dbClient.query(
          `INSERT INTO audit_logs (id, action, details, user_role, user_email)
           VALUES ($1, $2, $3, $4, $5)`,
          [`audit_${Date.now()}`, 'Certificate Issued', `Issued cert ${certCode} (${r.targetBelt}) to ${student.full_name}`, req.user!.role, req.user!.email]
        );
      }
    }

    return res.json({ message: 'Grading results saved and certificates issued in PostgreSQL.', issuedCertificates: issuedCerts });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: err.message });
  }
});

export default router;
