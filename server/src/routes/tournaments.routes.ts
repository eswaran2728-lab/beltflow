import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Create Tournament (Academy Admin / Master)
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_TOURNAMENTS), async (req: Request, res: Response) => {
  try {
    const { organizationId, title, name, eventDate, tournamentDate, location, categories, description } = req.body;
    const tourneyTitle = title || name;
    if (!tourneyTitle || !organizationId) {
      return res.status(400).json({ error: 'organizationId and title/name are required.' });
    }

    const orgId = req.user!.organizationId || organizationId;
    const tourneyId = `tourn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dateVal = eventDate || tournamentDate || new Date().toISOString().split('T')[0];
    const locVal = location || 'Main Tournament Arena';
    const catVal = Array.isArray(categories) ? categories.join(', ') : (categories || 'Sparring, Forms, Weapons');

    const insertRes = await dbClient.query(
      `INSERT INTO tournaments (id, organization_id, title, event_date, location, categories, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tourneyId, orgId, tourneyTitle.trim(), dateVal, locVal, catVal, 'Upcoming']
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Tournament Scheduled', `Scheduled tournament: ${tourneyTitle.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Tournament scheduled in PostgreSQL.', tournament: insertRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// List tournaments for organization
router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user!.organizationId || req.params.orgId !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization access denied.' });
    }
    const listRes = await dbClient.query(
      `SELECT * FROM tournaments WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.params.orgId]
    );
    return res.json({ tournaments: listRes.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Record Tournament Medals & Issue Certificates
router.post('/:id/results', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_TOURNAMENTS), async (req: Request, res: Response) => {
  try {
    const tourneyId = req.params.id;
    const { organizationId, results } = req.body;
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'results array is required.' });
    }
    const tournament = await dbClient.query('SELECT organization_id, status FROM tournaments WHERE id = $1', [tourneyId]);
    if (!tournament.rowCount) return res.status(404).json({ error: 'Tournament not found.' });
    if (tournament.rows[0].organization_id !== req.user!.organizationId) return res.status(403).json({ error: 'Cross-organization access denied.' });
    if (tournament.rows[0].status === 'Completed') {
      return res.status(409).json({ error: 'Tournament results have already been finalized.' });
    }
    for (const result of results) {
      const student = await dbClient.query('SELECT organization_id FROM students WHERE id = $1', [result.studentId]);
      if (student.rows[0]?.organization_id !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Tournament student access denied.' });
      }
    }

    const orgId = req.user!.organizationId || organizationId;
    const orgRes = await dbClient.query('SELECT name, master_name FROM organizations WHERE id = $1', [orgId]);
    const orgData = orgRes.rows[0] || { name: 'Academy', master_name: 'Chief Examiner' };

    const issuedCertificates: any[] = [];
    const dateVal = new Date().toISOString().split('T')[0];

    for (const r of results) {
      if (r.medal && r.medal !== 'None') {
        const pRes = await dbClient.query(
          `INSERT INTO tournament_participants (id, tournament_id, student_id, category, medal, cert_code, awarded_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           RETURNING *`,
          [`tp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, tourneyId, r.studentId, r.category || 'Division', r.medal, null]
        );

        if (r.medal !== 'Participant') {
          const stuRes = await dbClient.query('SELECT full_name FROM students WHERE id = $1', [r.studentId]);
          const stuName = stuRes.rows[0]?.full_name || 'Student';
          const certCode = `BF-MED-${stuName.substring(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

          const certRes = await dbClient.query(
            `INSERT INTO certificates (id, code, organization_id, organization_name, student_id, student_name, master_name, rank_or_title, type, issue_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [`cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, certCode, orgId, orgData.name, r.studentId, stuName, orgData.master_name, `${r.medal} Medal`, 'Tournament Medal', dateVal, 'ACTIVE']
          );
          issuedCertificates.push(certRes.rows[0]);
        }
      }
    }

    await dbClient.query(`UPDATE tournaments SET status = 'Completed' WHERE id = $1`, [tourneyId]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Tournament Results Finalized',
       `Finalized results for tournament ${tourneyId} (${results.length} entries, ${issuedCertificates.length} certificates issued)`,
       req.user!.role, req.user!.email]
    );

    return res.json({
      message: 'Tournament results and certificates recorded in PostgreSQL.',
      count: issuedCertificates.length,
      certificates: issuedCertificates,
      issuedCertificates
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
