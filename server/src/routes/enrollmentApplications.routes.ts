import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import {
  approveEnrollment,
  requestInformationEnrollment,
  rejectEnrollment,
  waitlistEnrollment,
  AuthorityError,
} from '../security/authority';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 1. Submit or Draft Enrollment Application (Student or Parent)
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      classId,
      studentId: reqStudentId,
      organizationId: reqOrgId,
      status: requestedStatus,
      emergencyContactName,
      emergencyContactPhone,
      medicalNotes,
      notes,
      consentAccepted,
    } = req.body;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required.' });
    }

    // 1. Resolve target Class
    const classRes = await dbClient.query(
      `SELECT c.*, o.name AS organization_name FROM classes c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = $1`,
      [classId]
    );
    if (classRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }
    const cls = classRes.rows[0];

    // Reject cross-tenant if organizationId supplied explicitly and differs
    if (reqOrgId && reqOrgId !== cls.organization_id) {
      return res.status(403).json({ error: 'Cross-Persatuan enrollment is not permitted.' });
    }

    // Check class availability
    if (cls.approval_status !== 'APPROVED') {
      return res.status(400).json({ error: 'Class is not approved for enrollment.' });
    }
    if (cls.operational_status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Class is currently not active.' });
    }
    if (cls.enrollment_availability === 'CLOSED') {
      return res.status(400).json({ error: 'Class is closed for new enrollments.' });
    }

    // 2. Resolve Student ID and Permissions
    let targetStudentId = reqStudentId;
    let guardianId: string | null = null;
    let applicantType: 'STUDENT' | 'PARENT' = 'STUDENT';

    if (user.role === UserRole.STUDENT) {
      applicantType = 'STUDENT';
      if (!targetStudentId) {
        const sRes = await dbClient.query('SELECT id, organization_id, full_name, ic_number, phone FROM students WHERE user_id = $1', [user.id]);
        if (sRes.rowCount === 0) {
          return res.status(404).json({ error: 'Student profile not found for current user.' });
        }
        targetStudentId = sRes.rows[0].id;
      } else {
        const sRes = await dbClient.query('SELECT id, user_id, organization_id FROM students WHERE id = $1', [targetStudentId]);
        if (sRes.rowCount === 0 || sRes.rows[0].user_id !== user.id) {
          return res.status(403).json({ error: 'Students can only apply for their own profile.' });
        }
      }
    } else if (user.role === UserRole.PARENT) {
      applicantType = 'PARENT';
      guardianId = user.id;
      if (!targetStudentId) {
        return res.status(400).json({ error: 'studentId is required for parent enrollment application.' });
      }

      // Verify active parent-child link (cannot apply for unrelated child)
      const linkRes = await dbClient.query(
        `SELECT id, status FROM parent_student_links
         WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'`,
        [user.id, targetStudentId]
      );
      if (linkRes.rowCount === 0) {
        return res.status(403).json({ error: 'Parent is not linked to or verified for this child student.' });
      }
    } else if (user.role === UserRole.MASTER || user.role === UserRole.ADMIN_PERSATUAN) {
      if (!targetStudentId) {
        return res.status(400).json({ error: 'studentId is required.' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized role for enrollment application.' });
    }

    // Verify student belongs to class's organization
    const stuRes = await dbClient.query('SELECT id, organization_id, full_name, ic_number, phone FROM students WHERE id = $1', [targetStudentId]);
    if (stuRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student record not found.' });
    }
    const student = stuRes.rows[0];
    if (student.organization_id !== cls.organization_id) {
      return res.status(403).json({ error: 'Cross-Persatuan enrollment is not permitted: student and class belong to different organizations.' });
    }

    const appStatus = requestedStatus === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';
    const appId = newId('app');
    const isConsent = Boolean(consentAccepted);

    const insertRes = await dbClient.query(
      `INSERT INTO enrollment_applications (
         id, student_id, class_id, organization_id, guardian_id, submitted_by_user_id,
         applicant_type, student_name, ic_number, phone, emergency_contact_name,
         emergency_contact_phone, medical_notes, notes, consent_accepted, status, version, submitted_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, $17)
       RETURNING *`,
      [
        appId,
        student.id,
        cls.id,
        cls.organization_id,
        guardianId,
        user.id,
        applicantType,
        student.full_name,
        student.ic_number || null,
        student.phone || null,
        emergencyContactName ? String(emergencyContactName).trim() : null,
        emergencyContactPhone ? String(emergencyContactPhone).trim() : null,
        medicalNotes ? String(medicalNotes).trim() : null,
        notes ? String(notes).trim() : null,
        isConsent,
        appStatus,
        appStatus === 'SUBMITTED' ? new Date() : null,
      ]
    );

    return res.status(201).json({
      message: appStatus === 'DRAFT' ? 'Application draft saved.' : 'Enrollment application submitted successfully.',
      application: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Create enrollment application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to create application.') });
  }
});

// 2. List own or linked children's applications (Student or Parent)
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let query = '';
    let params: any[] = [];

    if (user.role === UserRole.STUDENT) {
      query = `
        SELECT ea.*, c.name AS class_name, c.schedule AS class_schedule, c.location AS class_location,
               c.monthly_fee AS class_fee, o.name AS organization_name
        FROM enrollment_applications ea
        JOIN classes c ON c.id = ea.class_id
        JOIN organizations o ON o.id = ea.organization_id
        JOIN students s ON s.id = ea.student_id
        WHERE s.user_id = $1
        ORDER BY ea.created_at DESC
      `;
      params = [user.id];
    } else if (user.role === UserRole.PARENT) {
      query = `
        SELECT ea.*, c.name AS class_name, c.schedule AS class_schedule, c.location AS class_location,
               c.monthly_fee AS class_fee, o.name AS organization_name, s.full_name AS student_full_name
        FROM enrollment_applications ea
        JOIN classes c ON c.id = ea.class_id
        JOIN organizations o ON o.id = ea.organization_id
        JOIN students s ON s.id = ea.student_id
        WHERE ea.guardian_id = $1
           OR ea.student_id IN (
             SELECT student_id FROM parent_student_links
             WHERE parent_id = $1 AND status = 'ACTIVE'
           )
        ORDER BY ea.created_at DESC
      `;
      params = [user.id];
    } else {
      return res.status(403).json({ error: 'Endpoint is for Students and Parents.' });
    }

    const result = await dbClient.query(query, params);
    return res.json({ applications: result.rows });
  } catch (err: any) {
    console.error('[List applications error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch applications.') });
  }
});

// 3. Application Details
router.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query(
      `SELECT ea.*, c.name AS class_name, c.schedule AS class_schedule, c.location AS class_location,
              c.monthly_fee AS class_fee, c.capacity, c.enrollment_availability,
              o.name AS organization_name, s.full_name AS student_full_name, s.belt_rank AS student_belt
       FROM enrollment_applications ea
       JOIN classes c ON c.id = ea.class_id
       JOIN organizations o ON o.id = ea.organization_id
       JOIN students s ON s.id = ea.student_id
       WHERE ea.id = $1`,
      [req.params.id]
    );

    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    const app = appRes.rows[0];

    // Authorization check
    if (user.role === UserRole.STUDENT) {
      const studentOwner = await dbClient.query('SELECT 1 FROM students WHERE id = $1 AND user_id = $2', [app.student_id, user.id]);
      if (studentOwner.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied to this application.' });
      }
    } else if (user.role === UserRole.PARENT) {
      if (app.guardian_id !== user.id) {
        const linkCheck = await dbClient.query('SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = \'ACTIVE\'', [user.id, app.student_id]);
        if (linkCheck.rowCount === 0) {
          return res.status(403).json({ error: 'Access denied to this application.' });
        }
      }
    } else if (user.role === UserRole.MASTER) {
      const leadCheck = await dbClient.query('SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE', [app.class_id, user.id]);
      const coachCheck = await dbClient.query('SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2', [app.class_id, user.id]);
      if (leadCheck.rowCount === 0 && coachCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Master is not assigned to this class.' });
      }
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      if (app.organization_id !== user.organizationId) {
        return res.status(403).json({ error: 'Cross-tenant access denied.' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    return res.json({ application: app });
  } catch (err: any) {
    console.error('[Get application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch application.') });
  }
});

// 4. Update Draft or Respond to Information Request (Applicant)
router.patch('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { expectedVersion, emergencyContactName, emergencyContactPhone, medicalNotes, notes, consentAccepted } = req.body;

    const appRes = await dbClient.query('SELECT * FROM enrollment_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    const app = appRes.rows[0];

    // Ownership check
    let isOwner = false;
    if (user.role === UserRole.STUDENT) {
      const sCheck = await dbClient.query('SELECT 1 FROM students WHERE id = $1 AND user_id = $2', [app.student_id, user.id]);
      isOwner = sCheck.rowCount > 0;
    } else if (user.role === UserRole.PARENT) {
      isOwner = app.guardian_id === user.id || app.submitted_by_user_id === user.id;
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the applicant can update this application.' });
    }

    if (expectedVersion !== undefined && Number(app.version) !== Number(expectedVersion)) {
      return res.status(409).json({ error: `Stale version. Expected ${expectedVersion}, but current is ${app.version}.` });
    }

    // If status is NEEDS_INFORMATION, updating fields moves it back to SUBMITTED
    const newStatus = app.status === 'NEEDS_INFORMATION' ? 'SUBMITTED' : app.status;

    const upd = await dbClient.query(
      `UPDATE enrollment_applications SET
         emergency_contact_name = COALESCE($1, emergency_contact_name),
         emergency_contact_phone = COALESCE($2, emergency_contact_phone),
         medical_notes = COALESCE($3, medical_notes),
         notes = COALESCE($4, notes),
         consent_accepted = COALESCE($5, consent_accepted),
         status = $6,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [
        emergencyContactName !== undefined ? String(emergencyContactName).trim() : null,
        emergencyContactPhone !== undefined ? String(emergencyContactPhone).trim() : null,
        medicalNotes !== undefined ? String(medicalNotes).trim() : null,
        notes !== undefined ? String(notes).trim() : null,
        typeof consentAccepted === 'boolean' ? consentAccepted : null,
        newStatus,
        app.id,
      ]
    );

    return res.json({
      message: newStatus === 'SUBMITTED' && app.status === 'NEEDS_INFORMATION' ? 'Application resubmitted with requested information.' : 'Application updated.',
      application: upd.rows[0],
    });
  } catch (err: any) {
    console.error('[Update application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to update application.') });
  }
});

// 5. Submit Draft Application
router.post('/:id/submit', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query('SELECT * FROM enrollment_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    const app = appRes.rows[0];

    // Ownership check
    let isOwner = false;
    if (user.role === UserRole.STUDENT) {
      const sCheck = await dbClient.query('SELECT 1 FROM students WHERE id = $1 AND user_id = $2', [app.student_id, user.id]);
      isOwner = sCheck.rowCount > 0;
    } else if (user.role === UserRole.PARENT) {
      isOwner = app.guardian_id === user.id || app.submitted_by_user_id === user.id;
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the applicant can submit this application.' });
    }

    if (app.status !== 'DRAFT') {
      return res.status(400).json({ error: `Application is already in ${app.status} status.` });
    }

    const isConsent = req.body.consentAccepted !== undefined ? Boolean(req.body.consentAccepted) : app.consent_accepted;
    const upd = await dbClient.query(
      `UPDATE enrollment_applications SET
         status = 'SUBMITTED',
         consent_accepted = $1,
         notes = COALESCE($2, notes),
         submitted_at = CURRENT_TIMESTAMP,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [isConsent, req.body.notes ? String(req.body.notes).trim() : null, app.id]
    );

    return res.json({
      message: 'Application submitted successfully. Awaiting Master approval.',
      application: upd.rows[0],
    });
  } catch (err: any) {
    console.error('[Submit draft error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to submit application.') });
  }
});

// 6. Withdraw Application (Applicant)
router.post('/:id/withdraw', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appRes = await dbClient.query('SELECT * FROM enrollment_applications WHERE id = $1', [req.params.id]);
    if (appRes.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    const app = appRes.rows[0];

    // Ownership check
    let isOwner = false;
    if (user.role === UserRole.STUDENT) {
      const sCheck = await dbClient.query('SELECT 1 FROM students WHERE id = $1 AND user_id = $2', [app.student_id, user.id]);
      isOwner = sCheck.rowCount > 0;
    } else if (user.role === UserRole.PARENT) {
      isOwner = app.guardian_id === user.id || app.submitted_by_user_id === user.id;
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the applicant can withdraw this application.' });
    }

    if (app.status === 'APPROVED') {
      return res.status(400).json({ error: 'Approved applications cannot be withdrawn directly. Request a class drop or transfer instead.' });
    }
    if (app.status === 'WITHDRAWN') {
      return res.status(400).json({ error: 'Application is already withdrawn.' });
    }

    const upd = await dbClient.query(
      `UPDATE enrollment_applications SET
         status = 'WITHDRAWN',
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [app.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Student Enrollment Withdrawn', $2, $3, $4)`,
      [newId('audit'), `Application ${app.id} withdrawn by applicant: ${req.body.reason || 'No reason specified'}`, user.role, user.email]
    );

    return res.json({
      message: 'Application withdrawn.',
      application: upd.rows[0],
    });
  } catch (err: any) {
    console.error('[Withdraw application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to withdraw application.') });
  }
});

// 7. Master Decision (Review: APPROVE, REQUEST_INFORMATION, REJECT, WAITLIST)
router.post('/:id/review', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { decision, expectedVersion, rejectionReason, requestedInformation, notes, idempotencyKey } = req.body;

    // Strict Role Check: Super Admin and Persatuan Admin cannot routinely approve student enrollment
    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin cannot review or approve student class enrollments.' });
    }
    if (user.role === UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Persatuan Admin cannot routinely approve student enrollment. Master approval is required.' });
    }
    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only authorized Masters can review student enrollment.' });
    }

    if (!['APPROVE', 'REQUEST_INFORMATION', 'REJECT', 'WAITLIST'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVE, REQUEST_INFORMATION, REJECT, or WAITLIST.' });
    }

    if (expectedVersion === undefined) {
      return res.status(400).json({ error: 'expectedVersion is required for concurrency control.' });
    }

    if (decision === 'APPROVE') {
      const result = await approveEnrollment({
        applicationId: req.params.id,
        expectedVersion: Number(expectedVersion),
        idempotencyKey,
        reviewerMasterId: user.id,
        notes,
      });

      return res.status(200).json({
        message: result.idempotentReplay ? 'Enrollment already approved (idempotent replay).' : 'Student enrollment approved successfully.',
        application: result.application,
        student: result.student,
        enrollment: result.enrollment,
      });
    } else if (decision === 'REQUEST_INFORMATION') {
      const app = await requestInformationEnrollment({
        applicationId: req.params.id,
        expectedVersion: Number(expectedVersion),
        idempotencyKey,
        reviewerMasterId: user.id,
        requestedInformation: requestedInformation || notes || '',
      });

      return res.status(200).json({
        message: 'Additional information requested from applicant.',
        application: app,
      });
    } else if (decision === 'REJECT') {
      const app = await rejectEnrollment({
        applicationId: req.params.id,
        expectedVersion: Number(expectedVersion),
        idempotencyKey,
        reviewerMasterId: user.id,
        rejectionReason: rejectionReason || notes || '',
      });

      return res.status(200).json({
        message: 'Enrollment application rejected.',
        application: app,
      });
    } else if (decision === 'WAITLIST') {
      const app = await waitlistEnrollment({
        applicationId: req.params.id,
        expectedVersion: Number(expectedVersion),
        idempotencyKey,
        reviewerMasterId: user.id,
        notes,
      });

      return res.status(200).json({
        message: 'Student added to class waitlist.',
        application: app,
      });
    }
  } catch (err: any) {
    if (err instanceof AuthorityError) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error('[Review application error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to process review decision.') });
  }
});

export default router;
