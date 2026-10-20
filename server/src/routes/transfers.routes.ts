import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { assignedMasterAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ----------------------------------------------------------------------------
// 1. Request Membership Pause (Parent, Student, or Master)
// Contract: requestPause(input)
// ----------------------------------------------------------------------------
router.post('/pause/request', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { studentId, startDate, expectedEndDate, reason, notes } = req.body;

    if (!studentId || !reason) {
      return res.status(400).json({ error: 'studentId and reason are required.' });
    }

    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = studentRes.rows[0];

    // Authorization
    if (user.role === UserRole.STUDENT) {
      if (student.user_id !== user.id) {
        return res.status(403).json({ error: 'Students can only request a pause for their own account.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const link = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, student.id]
      );
      if (link.rowCount === 0) {
        return res.status(403).json({ error: 'Parent is not verified for this child student.' });
      }
    } else if (user.role === UserRole.MASTER) {
      const isMaster = await assignedMasterAccess(user, student.class_id);
      if (!isMaster && user.organizationId !== student.organization_id) {
        return res.status(403).json({ error: 'Master not authorized for this student.' });
      }
    } else if (user.role !== UserRole.ADMIN_PERSATUAN || user.organizationId !== student.organization_id) {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }

    // Active status check
    if (student.status !== 'ACTIVE') {
      return res.status(400).json({ error: `Cannot pause student with status ${student.status}. Only ACTIVE students can request a pause.` });
    }

    // Check duplicate active/pending pause
    const dupCheck = await dbClient.query(
      "SELECT id FROM membership_pauses WHERE student_id = $1 AND status IN ('REQUESTED', 'APPROVED')",
      [student.id]
    );
    if (dupCheck.rowCount && dupCheck.rowCount > 0) {
      return res.status(409).json({ error: 'Student already has a pending or active membership pause.' });
    }

    const pauseId = newId('pause');
    const start = startDate || new Date().toISOString().slice(0, 10);

    const insertRes = await dbClient.query(
      `INSERT INTO membership_pauses (
         id, organization_id, student_id, class_id, requested_by_user_id,
         reason, start_date, expected_end_date, status, notes, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'REQUESTED', $9, 1)
       RETURNING *`,
      [
        pauseId,
        student.organization_id,
        student.id,
        student.class_id,
        user.id,
        reason.trim(),
        start,
        expectedEndDate || null,
        notes?.trim() || null,
      ]
    );

    // Audit log
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Membership Pause Requested', $2, $3, $4)`,
      [
        newId('audit'),
        `Pause requested for student ${student.full_name} (${student.id}) from ${start} to ${expectedEndDate || 'unspecified'}. Reason: ${reason}`,
        user.role,
        user.email,
      ]
    );

    // Outbox notification
    await dbClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, 'MembershipPauseRequested', 'membership_pause', $3, $4)`,
      [
        newId('ntf'),
        student.organization_id,
        pauseId,
        JSON.stringify({
          pauseId,
          studentId: student.id,
          studentName: student.full_name,
          startDate: start,
          expectedEndDate,
          reason,
        }),
      ]
    );

    return res.status(201).json({
      message: 'Membership pause requested successfully. Awaiting Master approval.',
      pause: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Request pause error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to request pause.') });
  }
});

// ----------------------------------------------------------------------------
// 2. Approve Membership Pause (Assigned Master or Admin)
// Contract: approvePause(id)
// Acceptance Test: pause_no_silent_bill_erasure
// ----------------------------------------------------------------------------
router.post('/pause/:pauseId/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { expectedVersion } = req.body;

    const pauseRes = await dbClient.query('SELECT * FROM membership_pauses WHERE id = $1', [req.params.pauseId]);
    if (pauseRes.rowCount === 0) {
      return res.status(404).json({ error: 'Membership pause record not found.' });
    }
    const pause = pauseRes.rows[0];

    // Master authority check for the class
    const isMaster = user.role === UserRole.MASTER && (await assignedMasterAccess(user, pause.class_id));
    const isAdmin = user.role === UserRole.ADMIN_PERSATUAN && user.organizationId === pause.organization_id;
    if (!isMaster && !isAdmin) {
      return res.status(403).json({ error: 'Only the assigned Master or Persatuan Admin can approve membership pauses.' });
    }

    if (expectedVersion !== undefined && Number(pause.version) !== Number(expectedVersion)) {
      return res.status(409).json({ error: `Version conflict: Expected version ${expectedVersion}, found ${pause.version}.` });
    }

    if (pause.status === 'APPROVED') {
      return res.json({ message: 'Pause is already approved.', pause, idempotentReplay: true });
    }

    const updated = await dbClient.transaction(async (tx) => {
      // 1. Lock pause record
      const lockedPauseRes = await tx.query('SELECT * FROM membership_pauses WHERE id = $1 FOR UPDATE', [pause.id]);
      const currentPause = lockedPauseRes.rows[0];

      // 2. Update pause record
      const updPauseRes = await tx.query(
        `UPDATE membership_pauses
         SET status = 'APPROVED',
             approved_by_master_id = $1,
             approved_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [user.id, currentPause.id]
      );

      // 3. Update canonical student status to 'PAUSED'
      await tx.query(
        `UPDATE students
         SET status = 'PAUSED'
         WHERE id = $1`,
        [currentPause.student_id]
      );

      // 4. Update active primary class enrollment to 'PAUSED'
      await tx.query(
        `UPDATE class_enrollments
         SET status = 'PAUSED',
             updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND class_id = $2 AND is_primary = TRUE`,
        [currentPause.student_id, currentPause.class_id]
      );

      // 5. Invariant: pause_no_silent_bill_erasure
      // All existing monthly_dues, payments, and ledger entries remain strictly untouched and un-erased.

      // 6. Audit log
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, 'Membership Pause Approved', $2, $3, $4)`,
        [
          newId('audit'),
          `Pause ${currentPause.id} approved for student ${currentPause.student_id} by ${user.email} (Status set to PAUSED)`,
          user.role,
          user.email,
        ]
      );

      // 7. Notification Outbox
      await tx.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, 'MembershipPauseApproved', 'membership_pause', $3, $4)`,
        [
          newId('ntf'),
          currentPause.organization_id,
          currentPause.id,
          JSON.stringify({
            pauseId: currentPause.id,
            studentId: currentPause.student_id,
            startDate: currentPause.start_date,
            expectedEndDate: currentPause.expected_end_date,
            approvedBy: user.id,
          }),
        ]
      );

      return updPauseRes.rows[0];
    });

    return res.json({
      message: 'Membership pause approved successfully.',
      pause: updated,
    });
  } catch (err: any) {
    console.error('[Approve pause error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to approve pause.') });
  }
});

// ----------------------------------------------------------------------------
// 3. Resume Membership (Student, Parent, Master, or Admin)
// Contract: resumeMembership(id)
// Acceptance Test: return_restores_correct_status
// ----------------------------------------------------------------------------
router.post('/resume/:pauseId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const pauseRes = await dbClient.query('SELECT * FROM membership_pauses WHERE id = $1', [req.params.pauseId]);
    if (pauseRes.rowCount === 0) {
      return res.status(404).json({ error: 'Membership pause record not found.' });
    }
    const pause = pauseRes.rows[0];

    // Authorization
    if (user.role === UserRole.STUDENT) {
      const stu = await dbClient.query('SELECT user_id FROM students WHERE id = $1', [pause.student_id]);
      if (stu.rowCount === 0 || stu.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: 'Unauthorized.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const link = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, pause.student_id]
      );
      if (link.rowCount === 0) {
        return res.status(403).json({ error: 'Parent not authorized for this child student.' });
      }
    } else if (user.role === UserRole.MASTER) {
      const isMaster = await assignedMasterAccess(user, pause.class_id);
      if (!isMaster && user.organizationId !== pause.organization_id) {
        return res.status(403).json({ error: 'Master not authorized for this student.' });
      }
    } else if (user.role !== UserRole.ADMIN_PERSATUAN || user.organizationId !== pause.organization_id) {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }

    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [pause.student_id]);
    const student = studentRes.rows[0];
    if (student.status === 'ACTIVE') {
      return res.json({ message: 'Student membership is already active.', student, pause });
    }
    if (student.status !== 'PAUSED') {
      return res.status(400).json({ error: `Cannot resume student with status ${student.status}. Student must be PAUSED.` });
    }

    // Verify class operational status
    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [pause.class_id]);
    if (classRes.rowCount === 0 || classRes.rows[0].operational_status === 'CLOSED') {
      return res.status(400).json({ error: 'Class is closed or no longer operational. Cannot return to closed class.' });
    }

    const resumed = await dbClient.transaction(async (tx) => {
      // 1. Update pause record
      const updPauseRes = await tx.query(
        `UPDATE membership_pauses
         SET status = 'RESUMED',
             actual_return_date = CURRENT_DATE,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [pause.id]
      );

      // 2. Restore student status to 'ACTIVE'
      const updStudentRes = await tx.query(
        `UPDATE students
         SET status = 'ACTIVE'
         WHERE id = $1 RETURNING *`,
        [pause.student_id]
      );

      // 3. Restore primary class enrollment to 'ACTIVE'
      await tx.query(
        `UPDATE class_enrollments
         SET status = 'ACTIVE',
             updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND class_id = $2 AND is_primary = TRUE`,
        [pause.student_id, pause.class_id]
      );

      // 4. Invariant: return_restores_correct_status
      // Original belt rank, attendance history, safety profiles, past certificates, and fee schedule preserved.

      // 5. Audit log
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, 'Membership Resumed', $2, $3, $4)`,
        [
          newId('audit'),
          `Student ${student.full_name} (${student.id}) returned from pause to ACTIVE status in class ${pause.class_id}`,
          user.role,
          user.email,
        ]
      );

      // 6. Outbox notification
      await tx.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, 'MembershipResumed', 'membership_pause', $3, $4)`,
        [
          newId('ntf'),
          pause.organization_id,
          pause.id,
          JSON.stringify({
            pauseId: pause.id,
            studentId: student.id,
            returnedAt: new Date().toISOString(),
          }),
        ]
      );

      return {
        pause: updPauseRes.rows[0],
        student: updStudentRes.rows[0],
      };
    });

    return res.json({
      message: 'Membership resumed successfully. Student is now active.',
      pause: resumed.pause,
      student: resumed.student,
    });
  } catch (err: any) {
    console.error('[Resume membership error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to resume membership.') });
  }
});

// ----------------------------------------------------------------------------
// 4. Request Class Transfer (Parent, Student, or Master)
// Contract: requestTransfer(input)
// ----------------------------------------------------------------------------
router.post('/request', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { studentId, targetClassId, reason, effectiveDate, consentAccepted } = req.body;

    if (!studentId || !targetClassId) {
      return res.status(400).json({ error: 'studentId and targetClassId are required.' });
    }

    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = studentRes.rows[0];

    // Authorization
    if (user.role === UserRole.STUDENT) {
      if (student.user_id !== user.id) {
        return res.status(403).json({ error: 'Students can only request a transfer for their own account.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const link = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, student.id]
      );
      if (link.rowCount === 0) {
        return res.status(403).json({ error: 'Parent is not verified for this child student.' });
      }
    } else if (user.role === UserRole.MASTER) {
      const isMaster = await assignedMasterAccess(user, student.class_id);
      if (!isMaster && user.organizationId !== student.organization_id) {
        return res.status(403).json({ error: 'Master not authorized for this student.' });
      }
    } else if (user.role !== UserRole.ADMIN_PERSATUAN || user.organizationId !== student.organization_id) {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }

    // Target class validation
    const targetClassRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [targetClassId]);
    if (targetClassRes.rowCount === 0) {
      return res.status(404).json({ error: 'Target class not found.' });
    }
    const targetClass = targetClassRes.rows[0];

    if (student.class_id === targetClass.id) {
      return res.status(400).json({ error: 'Cannot transfer to the student\'s existing class.' });
    }

    if (targetClass.operational_status === 'CLOSED' || targetClass.approval_status !== 'APPROVED') {
      return res.status(400).json({ error: 'Target class is closed or pending approval.' });
    }

    // Cross-tenant check
    const isCrossTenant = student.organization_id !== targetClass.organization_id;
    if (isCrossTenant && !consentAccepted) {
      return res.status(400).json({
        error: 'Explicit guardian consent is required for cross-organization transfer.',
      });
    }

    // Check duplicate pending transfer
    const dupCheck = await dbClient.query(
      `SELECT id FROM class_transfer_requests
       WHERE student_id = $1 AND status IN ('PENDING_OLD_MASTER', 'PENDING_NEW_MASTER', 'REQUESTED', 'PENDING_RECEIVING')`,
      [student.id]
    );
    if (dupCheck.rowCount && dupCheck.rowCount > 0) {
      return res.status(409).json({ error: 'A transfer request is already pending for this student.' });
    }

    const transferId = newId('trans');
    const effDate = effectiveDate || new Date().toISOString().slice(0, 10);

    const insertRes = await dbClient.query(
      `INSERT INTO class_transfer_requests (
         id, student_id, organization_id, target_organization_id,
         old_class_id, new_class_id, effective_date, reason,
         consent_accepted, requested_by_user_id, status, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING_RECEIVING', 1)
       RETURNING *`,
      [
        transferId,
        student.id,
        student.organization_id,
        targetClass.organization_id,
        student.class_id,
        targetClass.id,
        effDate,
        reason?.trim() || 'Class transfer request',
        Boolean(consentAccepted),
        user.id,
      ]
    );

    // Audit log
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Class Transfer Requested', $2, $3, $4)`,
      [
        newId('audit'),
        `Transfer requested for ${student.full_name} (${student.id}) from class ${student.class_id} to ${targetClass.id} (effective: ${effDate})`,
        user.role,
        user.email,
      ]
    );

    // Outbox notification
    await dbClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, 'ClassTransferRequested', 'class_transfer_request', $3, $4)`,
      [
        newId('ntf'),
        targetClass.organization_id,
        transferId,
        JSON.stringify({
          transferId,
          studentId: student.id,
          sourceClassId: student.class_id,
          targetClassId: targetClass.id,
          effectiveDate: effDate,
          isCrossTenant,
        }),
      ]
    );

    return res.status(201).json({
      message: 'Class transfer requested successfully. Awaiting receiving Master approval.',
      transfer: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Request transfer error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to request transfer.') });
  }
});

// ----------------------------------------------------------------------------
// 5. Approve Class Transfer (Authorized Receiving Master)
// Contract: approveTransfer(id, expectedVersion)
// Acceptance Tests:
// - transfer_preserves_student_id
// - concurrent_transfer_rejected
// - cross_tenant_no_implicit_history_copy
// - target_capacity_checked
// ----------------------------------------------------------------------------
router.post('/:transferId/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { expectedVersion } = req.body;

    const transferRes = await dbClient.query('SELECT * FROM class_transfer_requests WHERE id = $1', [req.params.transferId]);
    if (transferRes.rowCount === 0) {
      return res.status(404).json({ error: 'Transfer request not found.' });
    }
    const transfer = transferRes.rows[0];

    // Receiving Master authority check
    const isReceivingMaster = user.role === UserRole.MASTER && (await assignedMasterAccess(user, transfer.new_class_id));
    if (!isReceivingMaster) {
      return res.status(403).json({ error: 'Only the authorized Master of the target class can approve transfers.' });
    }

    // Acceptance Test: concurrent_transfer_rejected
    if (expectedVersion !== undefined && Number(transfer.version) !== Number(expectedVersion)) {
      return res.status(409).json({ error: `Version conflict: Expected version ${expectedVersion}, found ${transfer.version}.` });
    }

    if (transfer.status === 'APPROVED') {
      return res.json({ message: 'Transfer is already approved.', transfer, idempotentReplay: true });
    }

    // Atomic transaction for transfer execution
    const updated = await dbClient.transaction(async (tx) => {
      // 1. Lock transfer row
      const lockedTransRes = await tx.query('SELECT * FROM class_transfer_requests WHERE id = $1 FOR UPDATE', [transfer.id]);
      const currentTransfer = lockedTransRes.rows[0];

      if (expectedVersion !== undefined && Number(currentTransfer.version) !== Number(expectedVersion)) {
        const err: any = new Error(`Version conflict: Expected version ${expectedVersion}, found ${currentTransfer.version}.`);
        err.statusCode = 409;
        throw err;
      }

      // 2. Lock target class and check capacity (Acceptance Test: target_capacity_checked)
      const targetClassRes = await tx.query('SELECT * FROM classes WHERE id = $1 FOR UPDATE', [currentTransfer.new_class_id]);
      if (targetClassRes.rowCount === 0) {
        throw new Error('Target class not found.');
      }
      const targetClass = targetClassRes.rows[0];

      const capRes = await tx.query(
        "SELECT count(*)::int AS count FROM class_enrollments WHERE class_id = $1 AND status = 'ACTIVE'",
        [targetClass.id]
      );
      const activeCount = Number(capRes.rows[0]?.count || 0);
      const capacityLimit = Number(targetClass.capacity || 30);

      if (activeCount >= capacityLimit) {
        const err: any = new Error(`Target class capacity reached (${activeCount}/${capacityLimit}). Cannot transfer student into full class.`);
        err.statusCode = 409;
        throw err;
      }

      // 3. Lock student record
      const studentRes = await tx.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [currentTransfer.student_id]);
      const student = studentRes.rows[0];

      // 4. Close former primary class enrollment
      await tx.query(
        `UPDATE class_enrollments
         SET status = 'TRANSFERRED',
             is_primary = FALSE,
             effective_to = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 AND class_id = $2 AND is_primary = TRUE`,
        [currentTransfer.student_id, currentTransfer.old_class_id]
      );

      // 5. Insert new active primary class enrollment
      const targetOrgId = currentTransfer.target_organization_id || targetClass.organization_id;
      await tx.query(
        `INSERT INTO class_enrollments (
           id, student_id, class_id, organization_id, status, is_primary, provenance,
           approved_by_master_id, effective_from, approved_at
         ) VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, 'CLASS_TRANSFER', $5, $6, CURRENT_TIMESTAMP)`,
        [
          newId('enr'),
          currentTransfer.student_id,
          currentTransfer.new_class_id,
          targetOrgId,
          user.id,
          currentTransfer.effective_date,
        ]
      );

      // 6. Update student record (Acceptance Test: transfer_preserves_student_id)
      // Canonical student ID is preserved! Only class, organization, and prospective fee are updated.
      const newMonthlyFee = parseFloat(targetClass.monthly_fee) || 120.00;
      await tx.query(
        `UPDATE students
         SET class_id = $1,
             organization_id = $2,
             monthly_fee = $3
         WHERE id = $4`,
        [currentTransfer.new_class_id, targetOrgId, newMonthlyFee, currentTransfer.student_id]
      );

      // 7. Update transfer request record
      const updTransRes = await tx.query(
        `UPDATE class_transfer_requests
         SET status = 'APPROVED',
             new_master_approved = TRUE,
             receiving_master_id = $1,
             approved_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [user.id, currentTransfer.id]
      );

      // 8. Invariant: cross_tenant_no_implicit_history_copy
      // Former Persatuan A's monthly_dues, payments, and receipts remain strictly isolated in Org A.

      // 9. Audit log
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, 'Class Transfer Approved', $2, $3, $4)`,
        [
          newId('audit'),
          `Transfer approved for student ${currentTransfer.student_id} to class ${targetClass.name} by Master ${user.email}`,
          user.role,
          user.email,
        ]
      );

      // 10. Outbox notification
      await tx.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, 'ClassTransferApproved', 'class_transfer_request', $3, $4)`,
        [
          newId('ntf'),
          targetOrgId,
          currentTransfer.id,
          JSON.stringify({
            transferId: currentTransfer.id,
            studentId: currentTransfer.student_id,
            sourceClassId: currentTransfer.old_class_id,
            targetClassId: currentTransfer.new_class_id,
            effectiveDate: currentTransfer.effective_date,
            approvedBy: user.id,
          }),
        ]
      );

      return updTransRes.rows[0];
    });

    return res.json({
      message: 'Class transfer approved successfully.',
      transfer: updated,
    });
  } catch (err: any) {
    console.error('[Approve transfer error]', err);
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to approve transfer.') });
  }
});

// ----------------------------------------------------------------------------
// 6. Get Pending Transfers for Master
// ----------------------------------------------------------------------------
router.get('/pending', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const assigned = user.assignedClassIds || [];
    const result = await dbClient.query(
      `SELECT t.*, s.full_name AS student_name, s.belt_rank,
              c_old.name AS old_class_name, c_new.name AS new_class_name
       FROM class_transfer_requests t
       JOIN students s ON s.id = t.student_id
       JOIN classes c_old ON c_old.id = t.old_class_id
       JOIN classes c_new ON c_new.id = t.new_class_id
       WHERE t.status IN ('PENDING_RECEIVING', 'PENDING_NEW_MASTER', 'REQUESTED')
         AND (t.new_class_id = ANY($1::text[]) OR t.organization_id = $2 OR t.target_organization_id = $2)
       ORDER BY t.created_at DESC`,
      [assigned, user.organizationId]
    );

    return res.json({ transfers: result.rows });
  } catch (err: any) {
    console.error('[Get pending transfers error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch pending transfers.') });
  }
});

// ----------------------------------------------------------------------------
// 7. Get Pending Pauses for Master
// ----------------------------------------------------------------------------
router.get('/pauses/pending', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const assigned = user.assignedClassIds || [];
    const result = await dbClient.query(
      `SELECT p.*, s.full_name AS student_name, s.belt_rank, c.name AS class_name
       FROM membership_pauses p
       JOIN students s ON s.id = p.student_id
       JOIN classes c ON c.id = p.class_id
       WHERE p.status = 'REQUESTED'
         AND (p.class_id = ANY($1::text[]) OR p.organization_id = $2)
       ORDER BY p.created_at DESC`,
      [assigned, user.organizationId]
    );

    return res.json({ pauses: result.rows });
  } catch (err: any) {
    console.error('[Get pending pauses error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch pending pauses.') });
  }
});

// ----------------------------------------------------------------------------
// 8. Get Student Membership Lifecycle History
// ----------------------------------------------------------------------------
router.get('/students/:studentId/history', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [req.params.studentId]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = studentRes.rows[0];

    // Authorization
    if (user.role === UserRole.STUDENT && student.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (user.role === UserRole.PARENT) {
      const link = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, student.id]
      );
      if (link.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    // Enrollments
    const enrollments = await dbClient.query(
      `SELECT ce.*, c.name AS class_name
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
       WHERE ce.student_id = $1
       ORDER BY ce.effective_from DESC`,
      [student.id]
    );

    // Pauses
    const pauses = await dbClient.query(
      `SELECT * FROM membership_pauses WHERE student_id = $1 ORDER BY created_at DESC`,
      [student.id]
    );

    // Transfers
    const transfers = await dbClient.query(
      `SELECT t.*, c_old.name AS old_class_name, c_new.name AS new_class_name
       FROM class_transfer_requests t
       JOIN classes c_old ON c_old.id = t.old_class_id
       JOIN classes c_new ON c_new.id = t.new_class_id
       WHERE t.student_id = $1
       ORDER BY t.created_at DESC`,
      [student.id]
    );

    return res.json({
      student,
      enrollments: enrollments.rows,
      pauses: pauses.rows,
      transfers: transfers.rows,
    });
  } catch (err: any) {
    console.error('[Get student history error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch student history.') });
  }
});

export default router;
