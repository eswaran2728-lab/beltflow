import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

import crypto from 'crypto';

// Public-Safe Certificate Verification (Fix CERT-001 - UNAUTHENTICATED)
// Allows verification from welcome screen or QR link without leaking student PII.
// Includes rate limiting and enumeration defense via certificate_verification_attempts table.
router.post('/public-verify', async (req: Request, res: Response) => {
  try {
    const codeOrToken = req.body.codeOrToken || req.body.code;
    if (!codeOrToken || typeof codeOrToken !== 'string') {
      return res.status(400).json({ error: 'Certificate code or verification token is required.' });
    }

    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const clientIpHash = crypto.createHash('sha256').update(rawIp).digest('hex');

    // Rate Limiting & Enumeration Defense: Check attempts within last 5 minutes (max 15 attempts)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const attemptsCountRes = await dbClient.query(
      `SELECT COUNT(*) AS count FROM certificate_verification_attempts
       WHERE client_ip_hash = $1 AND attempted_at >= $2`,
      [clientIpHash, fiveMinAgo]
    );

    const attemptCount = parseInt(attemptsCountRes.rows[0]?.count || '0', 10);
    if (attemptCount >= 15) {
      // Record rate limited attempt
      await dbClient.query(
        `INSERT INTO certificate_verification_attempts (id, client_ip_hash, searched_reference, verified, result_status, is_rate_limited)
         VALUES ($1, $2, $3, FALSE, 'RATE_LIMITED', TRUE)`,
        [`cva_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, clientIpHash, codeOrToken.slice(0, 50)]
      );
      return res.status(429).json({ error: 'Too many verification attempts. Please wait 5 minutes before trying again.' });
    }

    const trimmed = codeOrToken.trim();
    // Query active or revoked certificates by code or verification token
    const certRes = await dbClient.query(
      `SELECT * FROM certificates
       WHERE UPPER(code) = UPPER($1) OR verification_token = $1`,
      [trimmed]
    );

    if (certRes.rowCount === 0) {
      await dbClient.query(
        `INSERT INTO certificate_verification_attempts (id, client_ip_hash, searched_reference, verified, result_status, is_rate_limited)
         VALUES ($1, $2, $3, FALSE, 'NOT_FOUND', FALSE)`,
        [`cva_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, clientIpHash, trimmed.slice(0, 50)]
      );
      return res.status(404).json({
        verified: false,
        status: 'NOT_FOUND',
        error: 'No certificate found matching the provided code or verification token.'
      });
    }

    const cert = certRes.rows[0];

    // Record valid check attempt
    await dbClient.query(
      `INSERT INTO certificate_verification_attempts (id, client_ip_hash, searched_reference, verified, result_status, is_rate_limited)
       VALUES ($1, $2, $3, TRUE, $4, FALSE)`,
      [`cva_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, clientIpHash, trimmed.slice(0, 50), cert.status]
    );

    // Minimal public projection - strict zero PII (NO NRIC/MyKid, NO DOB, NO phone, NO guardian, NO medical, NO finances)
    if (cert.status === 'REVOKED') {
      return res.status(200).json({
        verified: true,
        status: 'REVOKED',
        certificate: {
          code: cert.code,
          studentName: cert.student_name,
          rankOrTitle: cert.rank_or_title,
          organizationName: cert.organization_name,
          masterName: cert.master_name,
          issueDate: cert.issue_date,
          type: cert.type,
          status: 'REVOKED',
          revokedAt: cert.revoked_at,
          revocationReason: cert.revocation_reason || 'Certificate revoked by issuing academy.'
        }
      });
    }

    return res.status(200).json({
      verified: true,
      status: 'VALID',
      certificate: {
        code: cert.code,
        studentName: cert.student_name,
        rankOrTitle: cert.rank_or_title,
        organizationName: cert.organization_name,
        masterName: cert.master_name,
        issueDate: cert.issue_date,
        type: cert.type,
        status: 'VALID'
      }
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Official Certificate Verification (AUTHENTICATION REQUIRED - FOR INTERNAL VIEW)
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
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Revoke Certificate (Persatuan Admin / Issuing Authority)
router.post('/:id/revoke', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const certRes = await dbClient.query('SELECT * FROM certificates WHERE id = $1', [req.params.id]);
    if (certRes.rowCount === 0) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    const cert = certRes.rows[0];
    // Check organization scope: must belong to the caller's organization
    if (cert.organization_id !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization revocation denied.' });
    }

    const updateRes = await dbClient.query(
      `UPDATE certificates
       SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revocation_reason = $1, revoked_by_id = $2
       WHERE id = $3
       RETURNING *`,
      [reason?.trim() || 'Administrative revocation', req.user!.id, req.params.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        'Certificate Revoked',
        `Certificate ${cert.code} (${cert.id}) revoked by ${req.user!.email}. Reason: ${reason || 'Administrative revocation'}`,
        req.user!.role,
        req.user!.email,
      ]
    );

    return res.json({
      message: 'Certificate revoked successfully.',
      certificate: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Database error]', err);
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
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
