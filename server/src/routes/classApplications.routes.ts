import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';
import { UserRole } from '../security/rbac';
import { assignClassLeadership } from '../security/authority';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 1. Create Class Proposal Draft (Verified Master only)
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only Masters can create class proposals.' });
    }

    const {
      organizationId,
      name,
      location,
      venueDetails,
      schedule,
      ageEligibility,
      trainingLevel,
      programType,
      capacity,
      enrollmentAvailability,
      monthlyFee,
      description,
      contactChannel,
    } = req.body;

    const targetOrgId = organizationId || user.organizationId;
    if (!targetOrgId) {
      return res.status(400).json({ error: 'organizationId is required.' });
    }

    // Verify Master has ACTIVE verified affiliation with this organization
    const affilRes = await dbClient.query(
      `SELECT id, status FROM master_affiliations
       WHERE master_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
      [user.id, targetOrgId]
    );

    if (affilRes.rowCount === 0) {
      return res.status(403).json({
        error: 'Master does not have an active verified affiliation with this organization.',
      });
    }

    const appId = newId('capp');
    const fee = monthlyFee !== undefined ? parseFloat(monthlyFee) : 120.0;
    const cap = capacity !== undefined ? parseInt(capacity, 10) : 30;

    const insertRes = await dbClient.query(
      `INSERT INTO class_applications (
         id, organization_id, proposing_master_id, name, location, venue_details,
         schedule, age_eligibility, training_level, program_type, capacity,
         enrollment_availability, monthly_fee, description, contact_channel,
         status, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'DRAFT', 1)
       RETURNING *`,
      [
        appId,
        targetOrgId,
        user.id,
        name ? String(name).trim() : '',
        location ? String(location).trim() : '',
        venueDetails ? String(venueDetails).trim() : null,
        schedule ? String(schedule).trim() : '',
        ageEligibility ? String(ageEligibility).trim() : null,
        trainingLevel ? String(trainingLevel).trim() : null,
        programType ? String(programType).trim() : null,
        cap > 0 ? cap : 30,
        ['OPEN', 'WAITLIST', 'CLOSED'].includes(enrollmentAvailability) ? enrollmentAvailability : 'OPEN',
        fee > 0 ? fee : 120.0,
        description ? String(description).trim() : null,
        contactChannel ? String(contactChannel).trim() : null,
      ]
    );

    return res.status(201).json({
      message: 'Class proposal draft created successfully.',
      application: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Create class proposal draft error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to create proposal.') });
  }
});

// 2. List own Class Proposals (Master)
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only Masters can view their class proposals.' });
    }

    const listRes = await dbClient.query(
      `SELECT ca.*, o.name AS organization_name
       FROM class_applications ca
       LEFT JOIN organizations o ON o.id = ca.organization_id
       WHERE ca.proposing_master_id = $1
       ORDER BY ca.created_at DESC`,
      [user.id]
    );

    return res.json({ applications: listRes.rows });
  } catch (err: any) {
    console.error('[List own class proposals error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to list proposals.') });
  }
});

// 3. Persatuan Admin Inbox
router.get('/inbox', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin cannot inspect Persatuan class proposals inbox.' });
    }
    if (user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Only Persatuan Admins can access the class proposals inbox.' });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Admin has no organization assigned.' });
    }

    const inboxRes = await dbClient.query(
      `SELECT ca.*, u.full_name AS proposing_master_name, u.email AS proposing_master_email
       FROM class_applications ca
       LEFT JOIN users u ON u.id = ca.proposing_master_id
       WHERE ca.organization_id = $1
       ORDER BY ca.created_at DESC`,
      [orgId]
    );

    return res.json({ applications: inboxRes.rows });
  } catch (err: any) {
    console.error('[Class applications inbox error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to retrieve inbox.') });
  }
});

// 4. Get Proposal Details
router.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appId = req.params.id;

    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin cannot inspect Persatuan class proposals.' });
    }

    const appRes = await dbClient.query(
      `SELECT ca.*, o.name AS organization_name, u.full_name AS proposing_master_name, u.email AS proposing_master_email
       FROM class_applications ca
       LEFT JOIN organizations o ON o.id = ca.organization_id
       LEFT JOIN users u ON u.id = ca.proposing_master_id
       WHERE ca.id = $1`,
      [appId]
    );

    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class proposal not found.' });
    }

    const application = appRes.rows[0];

    // Authorization checks
    if (user.role === UserRole.MASTER) {
      if (application.proposing_master_id !== user.id) {
        return res.status(403).json({ error: 'Access denied: not your class proposal.' });
      }
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      if (application.organization_id !== user.organizationId) {
        return res.status(403).json({ error: 'Cross-tenant proposal inspection denied.' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized to view this proposal.' });
    }

    return res.json({ application });
  } catch (err: any) {
    console.error('[Get class proposal detail error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to get proposal.') });
  }
});

// 5. Edit Proposal Draft / Address Needs Information (Proposing Master)
router.patch('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appId = req.params.id;

    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only Masters can modify their class proposals.' });
    }

    const appRes = await dbClient.query('SELECT * FROM class_applications WHERE id = $1', [appId]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class proposal not found.' });
    }

    const existing = appRes.rows[0];
    if (existing.proposing_master_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: cannot edit another Master\'s proposal.' });
    }

    if (!['DRAFT', 'NEEDS_INFORMATION'].includes(existing.status)) {
      return res.status(400).json({ error: 'Only proposals in DRAFT or NEEDS_INFORMATION status can be modified.' });
    }

    const {
      name,
      location,
      venueDetails,
      schedule,
      ageEligibility,
      trainingLevel,
      programType,
      capacity,
      enrollmentAvailability,
      monthlyFee,
      description,
      contactChannel,
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(name).trim());
    }
    if (location !== undefined) {
      updates.push(`location = $${idx++}`);
      values.push(String(location).trim());
    }
    if (venueDetails !== undefined) {
      updates.push(`venue_details = $${idx++}`);
      values.push(venueDetails ? String(venueDetails).trim() : null);
    }
    if (schedule !== undefined) {
      updates.push(`schedule = $${idx++}`);
      values.push(String(schedule).trim());
    }
    if (ageEligibility !== undefined) {
      updates.push(`age_eligibility = $${idx++}`);
      values.push(ageEligibility ? String(ageEligibility).trim() : null);
    }
    if (trainingLevel !== undefined) {
      updates.push(`training_level = $${idx++}`);
      values.push(trainingLevel ? String(trainingLevel).trim() : null);
    }
    if (programType !== undefined) {
      updates.push(`program_type = $${idx++}`);
      values.push(programType ? String(programType).trim() : null);
    }
    if (capacity !== undefined) {
      const capNum = parseInt(capacity, 10);
      if (isNaN(capNum) || capNum <= 0) {
        return res.status(400).json({ error: 'Capacity must be a positive integer.' });
      }
      updates.push(`capacity = $${idx++}`);
      values.push(capNum);
    }
    if (enrollmentAvailability !== undefined) {
      if (!['OPEN', 'WAITLIST', 'CLOSED'].includes(enrollmentAvailability)) {
        return res.status(400).json({ error: 'Invalid enrollment availability status.' });
      }
      updates.push(`enrollment_availability = $${idx++}`);
      values.push(enrollmentAvailability);
    }
    if (monthlyFee !== undefined) {
      const feeNum = parseFloat(monthlyFee);
      if (isNaN(feeNum) || feeNum <= 0) {
        return res.status(400).json({ error: 'monthlyFee must be greater than zero.' });
      }
      updates.push(`monthly_fee = $${idx++}`);
      values.push(feeNum);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description ? String(description).trim() : null);
    }
    if (contactChannel !== undefined) {
      updates.push(`contact_channel = $${idx++}`);
      values.push(contactChannel ? String(contactChannel).trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No update fields provided.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(appId);

    const updateRes = await dbClient.query(
      `UPDATE class_applications SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return res.json({
      message: 'Class proposal updated successfully.',
      application: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Update class proposal error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to update proposal.') });
  }
});

// 6. Submit Proposal (Proposing Master)
router.post('/:id/submit', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appId = req.params.id;

    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only Masters can submit class proposals.' });
    }

    const appRes = await dbClient.query('SELECT * FROM class_applications WHERE id = $1', [appId]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class proposal not found.' });
    }

    const application = appRes.rows[0];
    if (application.proposing_master_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: not your class proposal.' });
    }

    if (!['DRAFT', 'NEEDS_INFORMATION'].includes(application.status)) {
      return res.status(400).json({ error: 'Only proposals in DRAFT or NEEDS_INFORMATION can be submitted.' });
    }

    // Validate required fields
    const name = application.name?.trim();
    const location = application.location?.trim();
    const schedule = application.schedule?.trim();
    const monthlyFee = Number(application.monthly_fee);
    const capacity = Number(application.capacity);

    if (!name || !location || !schedule || !monthlyFee || monthlyFee <= 0 || !capacity || capacity <= 0) {
      return res.status(400).json({
        error: 'Missing required fields or monthly fee/capacity must be greater than zero.',
      });
    }

    const submitRes = await dbClient.query(
      `UPDATE class_applications
       SET status = 'SUBMITTED',
           submitted_at = CURRENT_TIMESTAMP,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appId]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId('audit'),
        'Class Proposal Submitted',
        `Class proposal ${appId} ("${name}") submitted by Master ${user.id} (${user.email}) for Org ${application.organization_id}`,
        user.role,
        user.email,
      ]
    );

    await dbClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ($1, $2, 'ClassSubmitted', 'class_application', $3, $4, 'PENDING')`,
      [
        newId('outbox'),
        application.organization_id,
        appId,
        JSON.stringify({ applicationId: appId, masterId: user.id, className: name }),
      ]
    );

    return res.json({
      message: 'Class proposal submitted for Persatuan review.',
      application: submitRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Submit class proposal error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to submit proposal.') });
  }
});

// 7. Withdraw Proposal (Proposing Master)
router.post('/:id/withdraw', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appId = req.params.id;

    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only Masters can withdraw class proposals.' });
    }

    const appRes = await dbClient.query('SELECT * FROM class_applications WHERE id = $1', [appId]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class proposal not found.' });
    }

    const application = appRes.rows[0];
    if (application.proposing_master_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: not your class proposal.' });
    }

    if (application.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot withdraw an approved class proposal.' });
    }

    const withdrawRes = await dbClient.query(
      `UPDATE class_applications
       SET status = 'WITHDRAWN',
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appId]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId('audit'),
        'Class Proposal Withdrawn',
        `Class proposal ${appId} withdrawn by Master ${user.id} (${user.email})`,
        user.role,
        user.email,
      ]
    );

    return res.json({
      message: 'Class proposal withdrawn successfully.',
      application: withdrawRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Withdraw class proposal error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to withdraw proposal.') });
  }
});

// 8. Review Proposal (Persatuan Admin only)
router.post('/:id/review', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appId = req.params.id;

    // Boundary checks
    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only Persatuan Admins can review operational class proposals.' });
    }
    if (user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Only Persatuan Admins can review class proposals.' });
    }

    const { decision, expectedVersion, reason, requestedInformation } = req.body;

    if (!['APPROVE', 'REQUEST_INFORMATION', 'REJECT'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid review decision. Must be APPROVE, REQUEST_INFORMATION, or REJECT.' });
    }

    // Initial check without lock
    const checkRes = await dbClient.query('SELECT * FROM class_applications WHERE id = $1', [appId]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class proposal not found.' });
    }

    const application = checkRes.rows[0];

    // Tenant check
    if (application.organization_id !== user.organizationId) {
      return res.status(403).json({ error: 'Cross-tenant review denied.' });
    }

    // Anti-self-approval
    if (application.proposing_master_id === user.id) {
      return res.status(403).json({ error: 'Masters cannot approve their own class proposals.' });
    }

    // Idempotency: duplicate approval
    if (application.status === 'APPROVED' && decision === 'APPROVE') {
      return res.json({
        message: 'Class application is already approved.',
        application,
      });
    }

    // Stale version optimistic locking check
    if (expectedVersion !== undefined && expectedVersion !== null && application.version !== Number(expectedVersion)) {
      return res.status(409).json({
        error: 'Conflict: proposal was modified by applicant since review.',
        code: 'STALE_VERSION',
      });
    }

    if (decision === 'REQUEST_INFORMATION') {
      if (application.status !== 'SUBMITTED') {
        return res.status(400).json({ error: 'Information can only be requested for submitted proposals.' });
      }

      const reqInfoRes = await dbClient.query(
        `UPDATE class_applications
         SET status = 'NEEDS_INFORMATION',
             requested_information = $1,
             reviewer_id = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND version = $4
         RETURNING *`,
        [requestedInformation?.trim() || null, user.id, appId, application.version]
      );

      if (reqInfoRes.rowCount === 0) {
        return res.status(409).json({
          error: 'Conflict: proposal was modified concurrently.',
          code: 'STALE_VERSION',
        });
      }

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Class Information Requested',
          `Information requested for proposal ${appId} by Admin ${user.id} (${user.email}): "${requestedInformation}"`,
          user.role,
          user.email,
        ]
      );

      await dbClient.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ($1, $2, 'ClassInformationRequested', 'class_application', $3, $4, 'PENDING')`,
        [
          newId('outbox'),
          application.organization_id,
          appId,
          JSON.stringify({ applicationId: appId, requestedInformation }),
        ]
      );

      return res.json({
        message: 'Information requested from applicant.',
        application: reqInfoRes.rows[0],
      });
    }

    if (decision === 'REJECT') {
      if (!['SUBMITTED', 'NEEDS_INFORMATION'].includes(application.status)) {
        return res.status(400).json({ error: 'Cannot reject proposal in current status.' });
      }

      const rejectReason = reason?.trim() || null;
      const rejectRes = await dbClient.query(
        `UPDATE class_applications
         SET status = 'REJECTED',
             rejection_reason = $1,
             review_notes = $1,
             reviewer_id = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND version = $4
         RETURNING *`,
        [rejectReason, user.id, appId, application.version]
      );

      if (rejectRes.rowCount === 0) {
        return res.status(409).json({
          error: 'Conflict: proposal was modified concurrently.',
          code: 'STALE_VERSION',
        });
      }

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Class Proposal Rejected',
          `Class proposal ${appId} rejected by Admin ${user.id} (${user.email}): "${rejectReason}"`,
          user.role,
          user.email,
        ]
      );

      await dbClient.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ($1, $2, 'ClassRejected', 'class_application', $3, $4, 'PENDING')`,
        [
          newId('outbox'),
          application.organization_id,
          appId,
          JSON.stringify({ applicationId: appId, reason: rejectReason }),
        ]
      );

      return res.json({
        message: 'Class proposal rejected.',
        application: rejectRes.rows[0],
      });
    }

    // decision === 'APPROVE': Atomic PostgreSQL Transaction
    const approvalResult = await dbClient.transaction(async (tx) => {
      // 1. Lock the application row FOR UPDATE
      const lockedRes = await tx.query(
        'SELECT * FROM class_applications WHERE id = $1 FOR UPDATE',
        [appId]
      );

      if (lockedRes.rowCount === 0) {
        const err: any = new Error('Class proposal not found.');
        err.status = 404;
        throw err;
      }

      const lockedApp = lockedRes.rows[0];

      // Check if already approved inside transaction
      if (lockedApp.status === 'APPROVED') {
        return { alreadyApproved: true, application: lockedApp };
      }

      // Check expected version inside transaction
      if (expectedVersion !== undefined && expectedVersion !== null && lockedApp.version !== Number(expectedVersion)) {
        const err: any = new Error('Conflict: proposal was modified by applicant since review.');
        err.status = 409;
        err.code = 'STALE_VERSION';
        throw err;
      }

      if (!['SUBMITTED', 'NEEDS_INFORMATION'].includes(lockedApp.status)) {
        const err: any = new Error('Application must be in SUBMITTED or NEEDS_INFORMATION status to be approved.');
        err.status = 400;
        throw err;
      }

      // 2. Reverify applicant's active Master affiliation
      const affilCheck = await tx.query(
        `SELECT id FROM master_affiliations
         WHERE master_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
        [lockedApp.proposing_master_id, lockedApp.organization_id]
      );

      if (affilCheck.rowCount === 0) {
        const err: any = new Error('Master does not have an active verified affiliation with this organization.');
        err.status = 403;
        throw err;
      }

      // 3. Create or activate canonical class
      let classId = lockedApp.class_id;
      if (!classId) {
        classId = newId('cls');
        await tx.query(
          `INSERT INTO classes (
             id, organization_id, name, schedule, location, venue_details,
             age_eligibility, training_level, program_type, capacity,
             enrollment_availability, monthly_fee, description, contact_channel,
             status, operational_status, approval_status, proposing_master_id, application_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVE', 'ACTIVE', 'APPROVED', $15, $16)`,
          [
            classId,
            lockedApp.organization_id,
            lockedApp.name,
            lockedApp.schedule,
            lockedApp.location,
            lockedApp.venue_details,
            lockedApp.age_eligibility,
            lockedApp.training_level,
            lockedApp.program_type,
            lockedApp.capacity || 30,
            lockedApp.enrollment_availability || 'OPEN',
            lockedApp.monthly_fee || 120.0,
            lockedApp.description,
            lockedApp.contact_channel,
            lockedApp.proposing_master_id,
            lockedApp.id,
          ]
        );
      } else {
        await tx.query(
          `UPDATE classes
           SET operational_status = 'ACTIVE',
               approval_status = 'APPROVED',
               status = 'ACTIVE'
           WHERE id = $1`,
          [classId]
        );
      }

      // 4. Establish PRIMARY leadership (synchronizes classes.main_master_id & coach_class_assignments)
      await assignClassLeadership({
        classId,
        masterId: lockedApp.proposing_master_id,
        organizationId: lockedApp.organization_id,
        leadershipType: 'PRIMARY',
        appointedBy: user.id,
        provenance: 'DIRECT_ASSIGNMENT',
        client: tx,
      });

      // 5. Update class_applications status
      const updatedAppRes = await tx.query(
        `UPDATE class_applications
         SET status = 'APPROVED',
             class_id = $1,
             reviewer_id = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [classId, user.id, lockedApp.id]
      );

      // 6. Append audit event
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId('audit'),
          'Class Proposal Approved',
          `Class proposal ${lockedApp.id} ("${lockedApp.name}") approved by Admin ${user.id} (${user.email}). Class ${classId} created with Primary Master ${lockedApp.proposing_master_id}`,
          user.role,
          user.email,
        ]
      );

      // 7. Append notification outbox event
      await tx.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ($1, $2, 'ClassApproved', 'class_application', $3, $4, 'PENDING')`,
        [
          newId('outbox'),
          lockedApp.organization_id,
          lockedApp.id,
          JSON.stringify({ applicationId: lockedApp.id, classId, masterId: lockedApp.proposing_master_id, className: lockedApp.name }),
        ]
      );

      return {
        alreadyApproved: false,
        application: updatedAppRes.rows[0],
        classId,
      };
    });

    if (approvalResult.alreadyApproved) {
      return res.json({
        message: 'Class application is already approved.',
        application: approvalResult.application,
      });
    }

    return res.json({
      message: 'Class proposal approved and class activated.',
      application: approvalResult.application,
      classId: approvalResult.classId,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.message,
        code: err.code,
      });
    }
    console.error('[Review class proposal error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to review proposal.') });
  }
});

export default router;
