import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';
import { UserRole } from '../security/rbac';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 1. Create Master Application Draft
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { organizationId, qualifications, experienceSummary, verificationDetails, documentsUrl } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId is required.' });
    }

    // Validate that target organization exists and is ACTIVE
    const orgRes = await dbClient.query('SELECT id, status FROM organizations WHERE id = $1', [organizationId]);
    if (orgRes.rowCount === 0 || orgRes.rows[0].status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Target organization does not exist or is inactive.' });
    }

    // Get applicant display name from user profile
    const userRes = await dbClient.query('SELECT full_name FROM users WHERE id = $1', [user.id]);
    const applicantName = userRes.rows[0]?.full_name || user.email;

    const appId = newId('mapp');
    const insertRes = await dbClient.query(
      `INSERT INTO master_applications (
         id, user_id, organization_id, applicant_name, qualifications, experience_summary,
         verification_details, documents_url, status, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', 1)
       RETURNING *`,
      [
        appId,
        user.id,
        organizationId,
        applicantName,
        qualifications?.trim() || null,
        experienceSummary?.trim() || null,
        verificationDetails?.trim() || null,
        documentsUrl?.trim() || null,
      ]
    );

    return res.status(201).json({
      message: 'Master application draft created successfully.',
      application: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Create master application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to create application.') });
  }
});

// 2. Get Current Master's Applications & Affiliation Status
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appsRes = await dbClient.query(
      `SELECT ma.*, o.name AS organization_name
       FROM master_applications ma
       LEFT JOIN organizations o ON o.id = ma.organization_id
       WHERE ma.user_id = $1
       ORDER BY ma.created_at DESC`,
      [user.id]
    );

    const affilsRes = await dbClient.query(
      `SELECT ma.*, o.name AS organization_name
       FROM master_affiliations ma
       LEFT JOIN organizations o ON o.id = ma.organization_id
       WHERE ma.master_id = $1
       ORDER BY ma.created_at DESC`,
      [user.id]
    );

    return res.json({
      applications: appsRes.rows,
      affiliations: affilsRes.rows,
      currentAffiliationStatus: affilsRes.rows[0]?.status || null,
    });
  } catch (err: any) {
    console.error('[Get my master applications error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch applications.') });
  }
});

// 3. Persatuan Admin Master Applications Inbox
router.get('/inbox', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.ADMIN_PERSATUAN || !user.organizationId) {
      return res.status(403).json({ error: 'Access denied: Only Persatuan Admins can access the review inbox.' });
    }

    // Exclude sensitive documents_url and verification_details from list projection
    const inboxRes = await dbClient.query(
      `SELECT id, user_id, organization_id, applicant_name, qualifications, experience_summary,
              status, version, submitted_at, created_at, updated_at
       FROM master_applications
       WHERE organization_id = $1 AND status IN ('SUBMITTED', 'NEEDS_INFORMATION')
       ORDER BY submitted_at DESC, created_at DESC`,
      [user.organizationId]
    );

    return res.json({ applications: inboxRes.rows });
  } catch (err: any) {
    console.error('[Master applications inbox error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch inbox.') });
  }
});

// 4. Get Application by ID
router.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query(
      `SELECT ma.*, o.name AS organization_name
       FROM master_applications ma
       LEFT JOIN organizations o ON o.id = ma.organization_id
       WHERE ma.id = $1`,
      [req.params.id]
    );

    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = appRes.rows[0];

    // Authorization: applicant or same-tenant admin only
    const isApplicant = application.user_id === user.id;
    const isTenantAdmin = user.role === UserRole.ADMIN_PERSATUAN && user.organizationId === application.organization_id;

    if (!isApplicant && !isTenantAdmin) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to view this application.' });
    }

    return res.json({ application });
  } catch (err: any) {
    console.error('[Get master application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch application.') });
  }
});

// 5. Update Draft / Needs_Information Application
router.patch('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query('SELECT * FROM master_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = appRes.rows[0];
    if (application.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only update your own applications.' });
    }

    if (application.status !== 'DRAFT' && application.status !== 'NEEDS_INFORMATION') {
      return res.status(400).json({ error: `Cannot update application in ${application.status} status.` });
    }

    const { qualifications, experienceSummary, verificationDetails, documentsUrl } = req.body;

    const updateRes = await dbClient.query(
      `UPDATE master_applications
       SET qualifications = COALESCE($1, qualifications),
           experience_summary = COALESCE($2, experience_summary),
           verification_details = COALESCE($3, verification_details),
           documents_url = COALESCE($4, documents_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        qualifications !== undefined ? qualifications?.trim() : null,
        experienceSummary !== undefined ? experienceSummary?.trim() : null,
        verificationDetails !== undefined ? verificationDetails?.trim() : null,
        documentsUrl !== undefined ? documentsUrl?.trim() : null,
        application.id,
      ]
    );

    return res.json({
      message: 'Application updated successfully.',
      application: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Update master application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to update application.') });
  }
});

// 6. Submit Application
router.post('/:id/submit', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query('SELECT * FROM master_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = appRes.rows[0];
    if (application.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only submit your own applications.' });
    }

    if (application.status !== 'DRAFT' && application.status !== 'NEEDS_INFORMATION') {
      return res.status(400).json({ error: `Cannot submit application currently in ${application.status} status.` });
    }

    // Validate mandatory fields
    if (!application.qualifications || !application.experience_summary) {
      return res.status(400).json({
        error: 'Missing required fields: Qualifications and Experience Summary are required before submission.',
      });
    }

    const updateRes = await dbClient.query(
      `UPDATE master_applications
       SET status = 'SUBMITTED',
           submitted_at = CURRENT_TIMESTAMP,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [application.id]
    );

    // Audit log
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId('audit'),
        'Master Application Submitted',
        `User ${user.id} submitted Master application ${application.id} for Persatuan ${application.organization_id}`,
        user.role,
        user.email,
      ]
    );

    return res.json({
      message: 'Master application submitted successfully for review.',
      application: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Submit master application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to submit application.') });
  }
});

// 7. Withdraw Application
router.post('/:id/withdraw', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query('SELECT * FROM master_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = appRes.rows[0];
    if (application.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only withdraw your own applications.' });
    }

    if (application.status === 'APPROVED' || application.status === 'REJECTED' || application.status === 'WITHDRAWN') {
      return res.status(400).json({ error: `Cannot withdraw application in ${application.status} status.` });
    }

    const updateRes = await dbClient.query(
      `UPDATE master_applications
       SET status = 'WITHDRAWN',
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [application.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId('audit'),
        'Master Application Withdrawn',
        `User ${user.id} withdrew Master application ${application.id}`,
        user.role,
        user.email,
      ]
    );

    return res.json({
      message: 'Master application withdrawn successfully.',
      application: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Withdraw master application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to withdraw application.') });
  }
});

// 8. Persatuan Admin Review (APPROVE, REQUEST_INFORMATION, REJECT)
router.post('/:id/review', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.ADMIN_PERSATUAN || !user.organizationId) {
      return res.status(403).json({ error: 'Access denied: Only Persatuan Admins can review master applications.' });
    }

    const { decision, expectedVersion, reason } = req.body;
    if (!decision || !['APPROVE', 'REQUEST_INFORMATION', 'REJECT'].includes(decision)) {
      return res.status(400).json({ error: 'Valid decision (APPROVE, REQUEST_INFORMATION, REJECT) is required.' });
    }

    const appRes = await dbClient.query('SELECT * FROM master_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const application = appRes.rows[0];

    // Cross-tenant check: must belong to admin's organization
    if (application.organization_id !== user.organizationId) {
      return res.status(403).json({ error: 'Cross-tenant review denied: Application belongs to a different Persatuan.' });
    }

    // Prevent Self-Approval
    if (application.user_id === user.id) {
      return res.status(403).json({ error: 'Self-approval rejected: You cannot review or approve your own application.' });
    }

    // Duplicate idempotent approval check
    if (application.status === 'APPROVED' && decision === 'APPROVE') {
      return res.json({
        message: 'Master application already approved.',
        application,
      });
    }

    // Version concurrency check
    if (expectedVersion !== undefined && Number(expectedVersion) !== application.version) {
      return res.status(409).json({
        error: 'Stale version detected. The application was modified by another review action.',
        code: 'STALE_VERSION',
        currentVersion: application.version,
      });
    }

    if (decision === 'APPROVE') {
      // Must be SUBMITTED before it can be APPROVED
      if (application.status !== 'SUBMITTED') {
        return res.status(400).json({ error: `Cannot approve application in ${application.status} status.` });
      }

      // Execute in atomic PostgreSQL transaction
      const updatedApp = await dbClient.transaction(async (tx) => {
        // 1. Update application status
        const appUpd = await tx.query(
          `UPDATE master_applications
           SET status = 'APPROVED',
               reviewer_id = $1,
               reviewed_at = CURRENT_TIMESTAMP,
               review_notes = $2,
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND version = $4
           RETURNING *`,
          [user.id, reason || null, application.id, application.version]
        );

        if (appUpd.rowCount === 0) {
          throw new Error('Concurrent review conflict.');
        }

        // 2. Create or activate master_affiliations record
        const existingAffil = await tx.query(
          `SELECT id FROM master_affiliations WHERE master_id = $1 AND organization_id = $2`,
          [application.user_id, application.organization_id]
        );

        if (existingAffil.rowCount > 0) {
          await tx.query(
            `UPDATE master_affiliations
             SET status = 'ACTIVE',
                 verification_provenance = 'DIRECT_REVIEW',
                 reviewed_by = $1,
                 reviewed_at = CURRENT_TIMESTAMP,
                 review_notes = $2,
                 effective_from = CURRENT_TIMESTAMP,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE master_id = $3 AND organization_id = $4`,
            [user.id, reason || null, application.user_id, application.organization_id]
          );
        } else {
          const affilId = newId('maf');
          await tx.query(
            `INSERT INTO master_affiliations (
               id, master_id, organization_id, status, effective_from,
               verification_provenance, reviewed_by, reviewed_at, review_notes, version
             ) VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP, 'DIRECT_REVIEW', $4, CURRENT_TIMESTAMP, $5, 1)
             ON CONFLICT (id) DO NOTHING`,
            [affilId, application.user_id, application.organization_id, user.id, reason || null]
          );
        }

        // 3. Ensure users table reflects organization_id and role
        await tx.query(
          `UPDATE users SET organization_id = COALESCE(organization_id, $1), role = 'MASTER' WHERE id = $2`,
          [application.organization_id, application.user_id]
        );

        // 4. Record audit event
        await tx.query(
          `INSERT INTO audit_logs (id, action, details, user_role, user_email)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newId('audit'),
            'Master Application Approved',
            `Application ${application.id} approved by Persatuan Admin ${user.email} for Master ${application.user_id}`,
            user.role,
            user.email,
          ]
        );

        // 5. Append notification outbox event
        await tx.query(
          `INSERT INTO notification_outbox (
             id, organization_id, event_type, aggregate_type, aggregate_id, payload, status
           ) VALUES ($1, $2, 'MasterApproved', 'master_application', $3, $4, 'PENDING')`,
          [
            newId('outbox'),
            application.organization_id,
            application.id,
            JSON.stringify({
              applicationId: application.id,
              masterId: application.user_id,
              organizationId: application.organization_id,
              reviewerId: user.id,
              reason: reason || null,
            }),
          ]
        );

        return appUpd.rows[0];
      });

      return res.json({
        message: 'Master application approved successfully and affiliation activated.',
        application: updatedApp,
      });
    }

    if (decision === 'REQUEST_INFORMATION') {
      if (!reason) {
        return res.status(400).json({ error: 'Reason/details of requested information is required.' });
      }

      const updateRes = await dbClient.query(
        `UPDATE master_applications
         SET status = 'NEEDS_INFORMATION',
             reviewer_id = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             requested_information = $2,
             review_notes = $2,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [user.id, reason.trim(), application.id]
      );

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Master Application Needs Information',
          `Application ${application.id}: information requested by ${user.email}`,
          user.role,
          user.email,
        ]
      );

      await dbClient.query(
        `INSERT INTO notification_outbox (
           id, organization_id, event_type, aggregate_type, aggregate_id, payload, status
         ) VALUES ($1, $2, 'MasterInformationRequested', 'master_application', $3, $4, 'PENDING')`,
        [
          newId('outbox'),
          application.organization_id,
          application.id,
          JSON.stringify({
            applicationId: application.id,
            masterId: application.user_id,
            organizationId: application.organization_id,
            reviewerId: user.id,
            requestedInformation: reason.trim(),
          }),
        ]
      );

      return res.json({
        message: 'Information request sent to Master applicant.',
        application: updateRes.rows[0],
      });
    }

    if (decision === 'REJECT') {
      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required.' });
      }

      const updateRes = await dbClient.transaction(async (tx) => {
        const appUpd = await tx.query(
          `UPDATE master_applications
           SET status = 'REJECTED',
               reviewer_id = $1,
               reviewed_at = CURRENT_TIMESTAMP,
               rejection_reason = $2,
               review_notes = $2,
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [user.id, reason.trim(), application.id]
        );

        // If there is any pending affiliation record, mark it ENDED
        await tx.query(
          `UPDATE master_affiliations
           SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP
           WHERE master_id = $1 AND organization_id = $2 AND status = 'PENDING'`,
          [application.user_id, application.organization_id]
        );

        await tx.query(
          `INSERT INTO audit_logs (id, action, details, user_role, user_email)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newId('audit'),
            'Master Application Rejected',
            `Application ${application.id} rejected by ${user.email}: ${reason.trim()}`,
            user.role,
            user.email,
          ]
        );

        await tx.query(
          `INSERT INTO notification_outbox (
             id, organization_id, event_type, aggregate_type, aggregate_id, payload, status
           ) VALUES ($1, $2, 'MasterRejected', 'master_application', $3, $4, 'PENDING')`,
          [
            newId('outbox'),
            application.organization_id,
            application.id,
            JSON.stringify({
              applicationId: application.id,
              masterId: application.user_id,
              organizationId: application.organization_id,
              reviewerId: user.id,
              rejectionReason: reason.trim(),
            }),
          ]
        );

        return appUpd.rows[0];
      });

      return res.json({
        message: 'Master application rejected.',
        application: updateRes,
      });
    }

    return res.status(400).json({ error: 'Unknown decision.' });
  } catch (err: any) {
    console.error('[Review master application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to review application.') });
  }
});

export default router;
