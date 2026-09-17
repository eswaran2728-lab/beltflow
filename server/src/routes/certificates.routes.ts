import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Official Certificate Verification (AUTHENTICATION REQUIRED)
router.post('/verify', authenticateJWT, requirePermission(Permission.CERTIFICATE_VIEW), async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Certificate code is required for verification.' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const certRes = await dbClient.query("SELECT * FROM certificates WHERE UPPER(code) = UPPER($1) AND status = 'ACTIVE'", [normalizedCode]);

    if (certRes.rowCount === 0) {
      return res.status(404).json({ error: 'No active official certificate matches the specified code in PostgreSQL.' });
    }

    const cert = certRes.rows[0];
    const access = await studentAccess(req.user!, cert.student_id);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied.' });
    return res.json({
      verified: true,
      certificate: {
        code: cert.code,
        studentName: cert.student_name,
        rankOrTitle: cert.rank_or_title,
        organizationName: cert.organization_name,
        masterName: cert.master_name,
        issueDate: cert.issue_date,
        type: cert.type
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// List certificates for a student
router.get('/student/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const access = await studentAccess(req.user!, req.params.studentId);
    if (!access.allowed) return res.status(403).json({ error: 'Access denied.' });
    const certsRes = await dbClient.query('SELECT * FROM certificates WHERE student_id = $1 ORDER BY created_at DESC', [req.params.studentId]);
    return res.json({ certificates: certsRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
