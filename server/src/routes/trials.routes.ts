import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { classAccess, assignedMasterAccess } from '../security/access';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// ============================================================================
// Task H16: Trials and Actionable Follow-Up (trials/retention)
// ============================================================================

// 1. Create Trial Booking (Public or Authenticated Parent)
router.post('/book', async (req: Request, res: Response) => {
  try {
    const {
      organizationId,
      classId,
      scheduledDate,
      candidateName,
      candidateAge,
      guardianName,
      guardianEmail,
      guardianPhone,
      emergencyPhone,
      medicalNotes,
      consentAccepted,
    } = req.body;

    if (!organizationId || !classId || !scheduledDate || !candidateName || !guardianPhone) {
      return res.status(400).json({ error: 'organizationId, classId, scheduledDate, candidateName, and guardianPhone are required.' });
    }

    if (!consentAccepted) {
      return res.status(400).json({ error: 'Legal and martial arts safety consent must be accepted.' });
    }

    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1 AND organization_id = $2', [classId, organizationId]);
    if (classRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found in specified organization.' });
    }
    const cls = classRes.rows[0];
    if (cls.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Class is currently inactive.' });
    }

    const trialId = `trl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const result = await dbClient.query(
      `INSERT INTO trial_bookings (
         id, organization_id, class_id, scheduled_date, candidate_name, candidate_age,
         guardian_name, guardian_email, guardian_phone, emergency_phone, medical_notes,
         consent_accepted, status, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'BOOKED', 1)
       RETURNING *`,
      [
        trialId,
        organizationId,
        classId,
        scheduledDate,
        candidateName.trim(),
        candidateAge ? parseInt(candidateAge, 10) : null,
        guardianName ? guardianName.trim() : null,
        guardianEmail ? guardianEmail.trim().toLowerCase() : null,
        guardianPhone.trim(),
        emergencyPhone ? emergencyPhone.trim() : null,
        medicalNotes ? medicalNotes.trim() : null,
        Boolean(consentAccepted),
      ]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        'Trial Booked',
        `Booked martial arts trial for ${candidateName.trim()} in class ${cls.name} on ${scheduledDate}`,
        'LEAD',
        guardianEmail?.trim() || guardianPhone.trim(),
      ]
    );

    return res.status(201).json({
      message: 'Trial booked successfully.',
      trial: result.rows[0],
    });
  } catch (err: any) {
    console.error('[Book trial error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to book trial.') });
  }
});

// 2. List Trial Bookings for a Class (Assigned Master or Persatuan Admin)
router.get('/class/:classId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const classId = req.params.classId;
    if (!(await classAccess(req.user!, classId))) {
      return res.status(403).json({ error: 'Class access denied.' });
    }

    const trialsRes = await dbClient.query(
      `SELECT * FROM trial_bookings WHERE class_id = $1 ORDER BY scheduled_date DESC, created_at DESC`,
      [classId]
    );

    return res.json({ trials: trialsRes.rows });
  } catch (err: any) {
    console.error('[Get class trials error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch trials.') });
  }
});

// 3. Mark Trial Attendance (Assigned Master only)
router.post('/:trialId/attendance', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { status } = req.body; // 'ATTENDED' | 'MISSED' | 'CANCELLED'
    if (!['ATTENDED', 'MISSED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ATTENDED, MISSED, or CANCELLED.' });
    }

    const trialRes = await dbClient.query('SELECT * FROM trial_bookings WHERE id = $1', [req.params.trialId]);
    if (trialRes.rowCount === 0) {
      return res.status(404).json({ error: 'Trial booking not found.' });
    }
    const trial = trialRes.rows[0];

    if (!(await assignedMasterAccess(req.user!, trial.class_id)) && req.user!.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Only the assigned Master or Admin may update trial attendance.' });
    }

    const updated = await dbClient.query(
      `UPDATE trial_bookings SET status = $1, version = version + 1 WHERE id = $2 RETURNING *`,
      [status, trial.id]
    );

    return res.json({ message: `Trial marked as ${status}.`, trial: updated.rows[0] });
  } catch (err: any) {
    console.error('[Trial attendance error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to update attendance.') });
  }
});

// 4. Convert Trial to Canonical Student Enrollment (Master-Approved, Idempotent)
router.post('/:trialId/convert', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const trialRes = await dbClient.query('SELECT * FROM trial_bookings WHERE id = $1', [req.params.trialId]);
    if (trialRes.rowCount === 0) {
      return res.status(404).json({ error: 'Trial booking not found.' });
    }
    const trial = trialRes.rows[0];

    // Acceptance Test: conversion_requires_master & TRIAL-AUTH-001
    // Student enrollment approval remains the exclusive responsibility of the authorized class Master.
    // Persatuan Admin cannot routinely bypass student approval.
    if (req.user!.role === UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({
        error: 'Persatuan Admin cannot routinely bypass student approval. Student enrollment approval requires the authorized class Master.',
      });
    }
    if (req.user!.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Only authorized Masters can convert trial bookings into canonical enrollments.' });
    }

    // Verify active Master affiliation
    const affilRes = await dbClient.query(
      `SELECT id, status, effective_from, effective_to FROM master_affiliations
       WHERE master_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id, trial.organization_id]
    );
    if (affilRes.rowCount > 0 && affilRes.rows[0].status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Master affiliation is not active. Suspended or former Masters cannot convert trials.' });
    }
    if (affilRes.rowCount === 0) {
      const legacyCheck = await dbClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE coach_id = $1 AND class_id = $2',
        [req.user!.id, trial.class_id]
      );
      if (legacyCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Master does not have an active verified affiliation with this organization.' });
      }
    } else {
      const affil = affilRes.rows[0];
      const now = new Date();
      if (affil.effective_from && new Date(affil.effective_from) > now) {
        return res.status(403).json({ error: 'Master affiliation effective date is in the future.' });
      }
      if (affil.effective_to && new Date(affil.effective_to) < now) {
        return res.status(403).json({ error: 'Master affiliation has expired.' });
      }
    }

    // Verify Master leadership over this class
    const isAssignedMaster = await assignedMasterAccess(req.user!, trial.class_id);
    if (!isAssignedMaster) {
      return res.status(403).json({ error: 'Only the assigned Master for this class can convert trial bookings.' });
    }

    // Acceptance Test: trial_conversion_no_duplicate
    if (trial.status === 'CONVERTED') {
      return res.status(409).json({ error: 'Trial has already been converted into a student enrollment.' });
    }

    const studentId = `stu_conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const beltRank = req.body.beltRank?.trim() || 'White Belt';

    const result = await dbClient.transaction(async (tx) => {
      // 1. Transactional class lock and capacity enforcement
      const classRes = await tx.query('SELECT * FROM classes WHERE id = $1 FOR UPDATE', [trial.class_id]);
      if (classRes.rowCount === 0) {
        throw new Error('Class not found.');
      }
      const cls = classRes.rows[0];

      const capRes = await tx.query(
        "SELECT count(*)::int AS active_count FROM class_enrollments WHERE class_id = $1 AND status = 'ACTIVE'",
        [cls.id]
      );
      const activeCount = Number(capRes.rows[0]?.active_count || 0);
      const capacityLimit = Number(cls.capacity || 30);
      if (activeCount >= capacityLimit) {
        const capErr: any = new Error(`Class capacity reached (${activeCount}/${capacityLimit}). Cannot enroll student from trial.`);
        capErr.statusCode = 409;
        throw capErr;
      }

      const monthlyFee = parseFloat(cls.monthly_fee) || 120.0;

      // 2. Create canonical student record
      const newStudentRes = await tx.query(
        `INSERT INTO students (
           id, organization_id, class_id, full_name, ic_number, phone, email,
           belt_rank, monthly_fee, status, billing_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', 'Unpaid')
         RETURNING *`,
        [
          studentId,
          trial.organization_id,
          trial.class_id,
          trial.candidate_name,
          req.body.icNumber?.trim() || 'N/A',
          trial.guardian_phone,
          trial.guardian_email,
          beltRank,
          monthlyFee,
        ]
      );

      // 3. Create canonical class_enrollments record with Master approval provenance
      const enrollmentId = `enr_conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await tx.query(
        `INSERT INTO class_enrollments (
           id, student_id, class_id, organization_id, status, is_primary, provenance,
           approved_by_master_id, approved_at
         ) VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, 'TRIAL_CONVERSION', $5, CURRENT_TIMESTAMP)`,
        [enrollmentId, studentId, trial.class_id, trial.organization_id, req.user!.id]
      );

      // 4. Create approved enrollment_application record for historical & audit integrity
      const appId = `app_conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await tx.query(
        `INSERT INTO enrollment_applications (
           id, student_id, class_id, organization_id, status, student_name,
           phone, emergency_contact_name, emergency_contact_phone, medical_notes,
           consent_accepted, reviewed_by_master_id, reviewed_at, review_notes, submitted_at
         ) VALUES ($1, $2, $3, $4, 'APPROVED', $5, $6, $7, $8, $9, TRUE, $10, CURRENT_TIMESTAMP, 'Approved via trial conversion', CURRENT_TIMESTAMP)`,
        [
          appId,
          studentId,
          trial.class_id,
          trial.organization_id,
          trial.candidate_name,
          trial.guardian_phone,
          trial.guardian_name || 'Guardian',
          trial.emergency_phone || trial.guardian_phone,
          trial.medical_notes || 'None reported',
          req.user!.id,
        ]
      );

      // 5. Create student safety profile if medical notes or emergency contact were recorded
      if (trial.emergency_phone || trial.medical_notes) {
        const safetyId = `safe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await tx.query(
          `INSERT INTO student_safety_profiles (
             id, student_id, organization_id, emergency_contact_name, emergency_contact_phone,
             emergency_contact_relationship, medical_conditions, allergies,
             activity_consent_given, medical_consent_given, consent_signed_by, updated_by
           ) VALUES ($1, $2, $3, $4, $5, 'Guardian', $6, 'None reported', TRUE, TRUE, $7, $8)
           ON CONFLICT (student_id) DO NOTHING`,
          [
            safetyId,
            studentId,
            trial.organization_id,
            trial.guardian_name || 'Guardian',
            trial.emergency_phone || trial.guardian_phone,
            trial.medical_notes || 'None reported',
            trial.guardian_name || 'Guardian',
            req.user!.id,
          ]
        );
      }

      // 6. Update trial record to CONVERTED
      const updatedTrialRes = await tx.query(
        `UPDATE trial_bookings
         SET status = 'CONVERTED',
             converted_student_id = $1,
             converted_at = CURRENT_TIMESTAMP,
             converted_by = $2,
             version = version + 1
         WHERE id = $3
         RETURNING *`,
        [studentId, req.user!.id, trial.id]
      );

      // 7. Audit log
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          'Trial Converted to Student',
          `Trial ${trial.id} for ${trial.candidate_name} converted to canonical student ${studentId} in class ${cls.name}`,
          req.user!.role,
          req.user!.email,
        ]
      );

      return {
        student: newStudentRes.rows[0],
        trial: updatedTrialRes.rows[0],
      };
    });

    return res.json({
      message: 'Trial converted successfully into canonical student enrollment.',
      student: result.student,
      trial: result.trial,
    });
  } catch (err: any) {
    console.error('[Convert trial error]', err);
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to convert trial.') });
  }
});

// 5. Evaluate Retention & Follow-Up Rules for a Class
router.post('/follow-ups/evaluate/:classId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const classId = req.params.classId;

    // Acceptance Test: follow_up_only_own_class
    if (!(await classAccess(req.user!, classId))) {
      return res.status(403).json({ error: 'Class access denied.' });
    }
    if (req.user!.role === UserRole.MASTER && !req.user!.assignedClassIds?.includes(classId)) {
      return res.status(403).json({ error: 'Master can only evaluate follow-up rules for their assigned class.' });
    }

    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
    if (classRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }
    const cls = classRes.rows[0];

    // Rule 1: Consecutive Unexcused Absences (2+ consecutive sessions marked Absent)
    const activeStudents = await dbClient.query(
      `SELECT id, full_name FROM students WHERE class_id = $1 AND status = 'ACTIVE'`,
      [classId]
    );

    for (const student of activeStudents.rows) {
      const recentAttendance = await dbClient.query(
        `SELECT status, session_date FROM attendance_records
         WHERE class_id = $1 AND student_id = $2
         ORDER BY session_date DESC
         LIMIT 2`,
        [classId, student.id]
      );

      const hasTwoConsecutiveAbsences =
        recentAttendance.rowCount === 2 &&
        recentAttendance.rows[0].status === 'Absent' &&
        recentAttendance.rows[1].status === 'Absent';

      if (hasTwoConsecutiveAbsences) {
        const d1 = recentAttendance.rows[1].session_date;
        const d2 = recentAttendance.rows[0].session_date;
        const reason = `2 CONSECUTIVE ABSENCES: Student missed recent sessions on ${d1} and ${d2}. Proactive check-in recommended.`;

        const existingPending = await dbClient.query(
          `SELECT id FROM follow_up_items WHERE class_id = $1 AND student_id = $2 AND type = 'CONSECUTIVE_ABSENCE' AND status = 'PENDING'`,
          [classId, student.id]
        );

        if (existingPending.rowCount === 0) {
          const fupId = `fup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await dbClient.query(
            `INSERT INTO follow_up_items (
               id, organization_id, class_id, student_id, type, reason, severity, status
             ) VALUES ($1, $2, $3, $4, 'CONSECUTIVE_ABSENCE', $5, 'HIGH', 'PENDING')`,
            [fupId, cls.organization_id, classId, student.id, reason]
          );
        }
      } else {
        // Acceptance Test: corrected_attendance_recalculates_flag
        // If attendance was corrected or no longer has 2 consecutive absences, resolve pending absence flag automatically
        await dbClient.query(
          `UPDATE follow_up_items
           SET status = 'RESOLVED',
               outcome = 'ATTENDANCE_CORRECTED',
               notes = 'Absence condition cleared by attendance update.',
               updated_at = CURRENT_TIMESTAMP
           WHERE class_id = $1 AND student_id = $2 AND type = 'CONSECUTIVE_ABSENCE' AND status = 'PENDING'`,
          [classId, student.id]
        );
      }
    }

    // Rule 2: Missed Trial Bookings
    const today = new Date().toISOString().slice(0, 10);
    const missedTrials = await dbClient.query(
      `SELECT * FROM trial_bookings
       WHERE class_id = $1 AND (status = 'MISSED' OR (status = 'BOOKED' AND scheduled_date < $2))`,
      [classId, today]
    );

    for (const trl of missedTrials.rows) {
      const reason = `MISSED TRIAL: Candidate ${trl.candidate_name} missed scheduled trial session on ${trl.scheduled_date}. Contact guardian at ${trl.guardian_phone}.`;
      const existingPending = await dbClient.query(
        `SELECT id FROM follow_up_items WHERE class_id = $1 AND trial_id = $2 AND type = 'MISSED_TRIAL' AND status = 'PENDING'`,
        [classId, trl.id]
      );
      if (existingPending.rowCount === 0) {
        const fupId = `fup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await dbClient.query(
          `INSERT INTO follow_up_items (
             id, organization_id, class_id, trial_id, type, reason, severity, status
           ) VALUES ($1, $2, $3, $4, 'MISSED_TRIAL', $5, 'MEDIUM', 'PENDING')`,
          [fupId, cls.organization_id, classId, trl.id, reason]
        );
      }
    }

    // Rule 3: Overdue Unpaid Tuition Fees
    const overdueStudents = await dbClient.query(
      `SELECT id, full_name, monthly_fee FROM students
       WHERE class_id = $1 AND status = 'ACTIVE' AND billing_status = 'Unpaid'`,
      [classId]
    );

    for (const student of overdueStudents.rows) {
      const reason = `OVERDUE TUITION: Student ${student.full_name} has unpaid monthly tuition dues (RM ${student.monthly_fee}).`;
      const existingPending = await dbClient.query(
        `SELECT id FROM follow_up_items WHERE class_id = $1 AND student_id = $2 AND type = 'OVERDUE_TUITION' AND status = 'PENDING'`,
        [classId, student.id]
      );
      if (existingPending.rowCount === 0) {
        const fupId = `fup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await dbClient.query(
          `INSERT INTO follow_up_items (
             id, organization_id, class_id, student_id, type, reason, severity, status
           ) VALUES ($1, $2, $3, $4, 'OVERDUE_TUITION', $5, 'MEDIUM', 'PENDING')`,
          [fupId, cls.organization_id, classId, student.id, reason]
        );
      }
    }

    return res.json({
      message: 'Follow-up rules evaluated successfully.',
      classId,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Evaluate follow-up rules error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to evaluate follow-up rules.') });
  }
});

// 6. View Active Follow-Up Queue for Class (Assigned Master or Persatuan Admin)
router.get('/follow-ups/class/:classId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const classId = req.params.classId;

    // Acceptance Test: follow_up_only_own_class
    if (!(await classAccess(req.user!, classId))) {
      return res.status(403).json({ error: 'Class access denied.' });
    }
    if (req.user!.role === UserRole.MASTER && !req.user!.assignedClassIds?.includes(classId)) {
      return res.status(403).json({ error: 'Master can only view follow-up queue for their assigned class.' });
    }

    const itemsRes = await dbClient.query(
      `SELECT f.*,
              s.full_name AS student_name,
              s.phone AS student_phone,
              s.belt_rank AS student_belt,
              t.candidate_name,
              t.guardian_phone,
              c.name AS class_name
       FROM follow_up_items f
       LEFT JOIN students s ON s.id = f.student_id
       LEFT JOIN trial_bookings t ON t.id = f.trial_id
       JOIN classes c ON c.id = f.class_id
       WHERE f.class_id = $1 AND f.status = 'PENDING'
       ORDER BY CASE f.severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, f.created_at DESC`,
      [classId]
    );

    return res.json({ items: itemsRes.rows });
  } catch (err: any) {
    console.error('[Get follow-up queue error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch follow-up queue.') });
  }
});

// 7. Record Action & Outcome for a Follow-Up Item (Assigned Master or Admin)
router.post('/follow-ups/:followUpId/action', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { outcome, notes } = req.body;
    if (!outcome) {
      return res.status(400).json({ error: 'outcome is required.' });
    }

    const itemRes = await dbClient.query('SELECT * FROM follow_up_items WHERE id = $1', [req.params.followUpId]);
    if (itemRes.rowCount === 0) {
      return res.status(404).json({ error: 'Follow-up item not found.' });
    }
    const item = itemRes.rows[0];

    // Acceptance Test: follow_up_only_own_class & no_auto_contact_without_authorized_action
    if (!(await classAccess(req.user!, item.class_id))) {
      return res.status(403).json({ error: 'Access denied to this class follow-up item.' });
    }
    if (req.user!.role === UserRole.MASTER && !req.user!.assignedClassIds?.includes(item.class_id)) {
      return res.status(403).json({ error: 'Only the assigned Master or Admin may record follow-up actions.' });
    }
    if (req.user!.role === UserRole.PARENT || req.user!.role === UserRole.STUDENT) {
      return res.status(403).json({ error: 'Parents and students cannot record Master follow-up actions.' });
    }

    const updated = await dbClient.query(
      `UPDATE follow_up_items
       SET status = 'RESOLVED',
           outcome = $1,
           notes = $2,
           actioned_by = $3,
           actioned_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [outcome, notes || null, req.user!.id, item.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        'Follow-Up Action Recorded',
        `Follow-up ${item.id} (${item.type}) actioned with outcome ${outcome} by ${req.user!.email}`,
        req.user!.role,
        req.user!.email,
      ]
    );

    return res.json({
      message: 'Follow-up outcome recorded successfully.',
      item: updated.rows[0],
    });
  } catch (err: any) {
    console.error('[Record follow-up action error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to record action.') });
  }
});

export default router;
