import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess, classAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function generateReceiptNo(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `REC-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Receipt numbers are enforced unique at the database level (see schema.sql
// payments_receipt_no_unique). On the astronomically unlikely event of a
// random collision, regenerate and retry rather than surface a 500 to a
// legitimate payment approval.
const MAX_RECEIPT_ATTEMPTS = 5;
function isUniqueViolation(err: any): boolean {
  return err && (err.code === '23505' || /unique/i.test(String(err.message || '')));
}

const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentBillingMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// 'Overdue' is never stored — it's true whenever a bill isn't fully paid and
// its billing_month has already passed. Computing it here means it can never
// go stale the way a persisted flag would without a cron job to flip it.
function effectiveDueStatus(due: { status: string; billing_month: string }): string {
  if (due.status === 'Paid') return 'Paid';
  return due.billing_month < currentBillingMonth() ? 'Overdue' : due.status;
}

function dueView(due: any) {
  const feeAmount = Number(due.fee_amount);
  const amountPaid = Number(due.amount_paid);
  return {
    ...due,
    fee_amount: feeAmount,
    amount_paid: amountPaid,
    remaining: Math.max(0, Math.round((feeAmount - amountPaid) * 100) / 100),
    effective_status: effectiveDueStatus(due)
  };
}

// Distributes `amount` across the given monthly_dues rows, in the order
// supplied, capping what's applied to each at its own remaining balance —
// this is what makes "pay less than what's owed" (partial payment) and "one
// payment covers several months" both safe: the payment's own `amount`
// column is never touched here, only monthly_dues.amount_paid and the join
// rows that record which payment covered how much of which month.
async function applyPaymentToMonthlyDues(paymentId: string, dueIds: string[], amount: number, studentId: string, organizationId: string) {
  const duesRes = await dbClient.query(
    `SELECT * FROM monthly_dues WHERE id = ANY($1::text[]) AND student_id = $2 AND organization_id = $3 ORDER BY billing_month ASC`,
    [dueIds, studentId, organizationId]
  );
  if (duesRes.rowCount !== dueIds.length) {
    throw Object.assign(new Error('One or more selected billing months are invalid for this student.'), { httpStatus: 400 });
  }
  const totalRemaining = duesRes.rows.reduce((sum, d) => sum + Math.max(0, Number(d.fee_amount) - Number(d.amount_paid)), 0);
  if (amount > totalRemaining + 0.005) {
    throw Object.assign(new Error(`Payment amount RM ${amount.toFixed(2)} exceeds the total outstanding RM ${totalRemaining.toFixed(2)} for the selected month(s).`), { httpStatus: 400 });
  }

  let left = amount;
  for (const due of duesRes.rows) {
    if (left <= 0) break;
    const remaining = Math.max(0, Number(due.fee_amount) - Number(due.amount_paid));
    if (remaining <= 0) continue;
    const applied = Math.round(Math.min(left, remaining) * 100) / 100;
    const newPaid = Math.round((Number(due.amount_paid) + applied) * 100) / 100;
    const newStatus = newPaid >= Number(due.fee_amount) ? 'Paid' : (newPaid > 0 ? 'Partially Paid' : 'Pending');
    await dbClient.query('UPDATE monthly_dues SET amount_paid = $1, status = $2 WHERE id = $3', [newPaid, newStatus, due.id]);
    await dbClient.query(
      `INSERT INTO monthly_due_payments (id, monthly_due_id, payment_id, amount_applied)
       VALUES ($1, $2, $3, $4)`,
      [`mdp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, due.id, paymentId, applied]
    );
    left = Math.round((left - applied) * 100) / 100;
  }
}

router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.params.orgId !== req.user?.organizationId ||
        ![UserRole.ADMIN_PERSATUAN, UserRole.MASTER].includes(req.user.role)) {
      return res.status(403).json({ error: 'Finance access denied.' });
    }
    const result = req.user.role === UserRole.MASTER
      ? await dbClient.query(
        `SELECT p.*, s.full_name AS student_name, c.name AS class_name, u.full_name AS approved_by_name
         FROM payments p
         JOIN students s ON s.id = p.student_id
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN users u ON u.id = p.approved_by
         WHERE p.organization_id = $1 AND s.class_id = ANY($2::text[])
         ORDER BY p.created_at DESC`, [req.params.orgId, req.user.assignedClassIds || []])
      : await dbClient.query(
        `SELECT p.*, s.full_name AS student_name, c.name AS class_name, u.full_name AS approved_by_name
         FROM payments p
         JOIN students s ON s.id = p.student_id
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN users u ON u.id = p.approved_by
         WHERE p.organization_id = $1 ORDER BY p.created_at DESC`, [req.params.orgId]);
    return res.json({ payments: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/student/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const access = await studentAccess(req.user!, req.params.studentId);
    if (!access.allowed) return res.status(403).json({ error: 'Payment history access denied.' });
    const result = await dbClient.query('SELECT * FROM payments WHERE student_id = $1 ORDER BY created_at DESC', [req.params.studentId]);
    return res.json({ payments: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Generate one monthly_dues row per ACTIVE student in a class for the given
// billing month. Safe to call repeatedly — the UNIQUE (student_id,
// billing_month) constraint plus ON CONFLICT DO NOTHING makes this an
// idempotent no-op for any student who already has a row for that month.
// classAccess() restricts this to the class's assigned Master or the
// Persatuan Admin of the same organization — never Super Admin, an
// unassigned Master, or a cross-organization user.
router.post('/monthly-dues/generate', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { classId, billingMonth } = req.body;
    if (!classId || !billingMonth || !BILLING_MONTH_RE.test(billingMonth)) {
      return res.status(400).json({ error: 'classId and billingMonth (format YYYY-MM) are required.' });
    }
    if (!(await classAccess(req.user!, classId))) {
      return res.status(403).json({ error: 'You are not authorized to generate bills for this class.' });
    }
    const cls = (await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [classId])).rows[0];
    const students = await dbClient.query(
      "SELECT id, monthly_fee FROM students WHERE class_id = $1 AND status = 'ACTIVE'", [classId]);

    let created = 0, skipped = 0;
    for (const s of students.rows) {
      const dueId = `due_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const insertRes = await dbClient.query(
        `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (student_id, billing_month) DO NOTHING
         RETURNING id`,
        [dueId, cls.organization_id, classId, s.id, billingMonth, s.monthly_fee]
      );
      if (insertRes.rowCount) created++; else skipped++;
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Monthly Bills Generated',
       `Org ${cls.organization_id}, Class ${classId}, Month ${billingMonth}: ${created} bill(s) created, ${skipped} already existed`,
       req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Monthly bills generated.', created, skipped });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Per-student monthly-dues summary for an entire class — assigned Master or
// same-organization Persatuan Admin only (classAccess), never Super Admin.
router.get('/monthly-dues/class/:classId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await classAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to view billing for this class.' });
    }
    const students = await dbClient.query(
      "SELECT id, full_name, monthly_fee FROM students WHERE class_id = $1 AND status = 'ACTIVE' ORDER BY full_name", [req.params.classId]);
    const duesRes = await dbClient.query(
      'SELECT * FROM monthly_dues WHERE class_id = $1 ORDER BY billing_month ASC', [req.params.classId]);

    const duesByStudent = new Map<string, any[]>();
    for (const d of duesRes.rows) {
      if (!duesByStudent.has(d.student_id)) duesByStudent.set(d.student_id, []);
      duesByStudent.get(d.student_id)!.push(dueView(d));
    }

    const report = students.rows.map(s => {
      const dues = duesByStudent.get(s.id) || [];
      const pending = dues.filter(d => d.effective_status !== 'Paid');
      return {
        studentId: s.id,
        studentName: s.full_name,
        currentFee: Number(s.monthly_fee),
        dues,
        monthsPendingCount: pending.length,
        totalPending: Math.round(pending.reduce((sum, d) => sum + d.remaining, 0) * 100) / 100
      };
    });

    return res.json({ students: report });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// A single student's own monthly-dues ledger and outstanding total — self,
// linked Parent, assigned Master, or same-organization Admin (studentAccess);
// never Super Admin.
router.get('/monthly-dues/student/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const access = await studentAccess(req.user!, req.params.studentId);
    if (!access.allowed) return res.status(403).json({ error: 'Billing access denied.' });

    const duesRes = await dbClient.query(
      'SELECT * FROM monthly_dues WHERE student_id = $1 ORDER BY billing_month ASC', [req.params.studentId]);
    const dues = duesRes.rows.map(dueView);
    const pending = dues.filter(d => d.effective_status !== 'Paid');

    return res.json({
      currentFee: Number(access.student.monthly_fee),
      dues,
      monthsPendingCount: pending.length,
      totalPending: Math.round(pending.reduce((sum, d) => sum + d.remaining, 0) * 100) / 100
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Submit payment notice (Parent or Student)
router.post('/submit-payment', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, amount, method, proofNotes, billingMonthIds } = req.body;
    if (!studentId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'studentId and amount are required.' });
    }

    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentRes.rowCount === 0) return res.status(404).json({ error: 'Student not found.' });
    const student = studentRes.rows[0];

    const user = req.user!;
    let isAllowed = false;
    if (user.role === UserRole.ADMIN_PERSATUAN && user.organizationId === student.organization_id) {
      isAllowed = true;
    } else if (user.role === UserRole.PARENT && user.linkedStudentIds?.includes(studentId)) {
      isAllowed = true;
    } else if (user.role === UserRole.STUDENT && user.id === student.user_id) {
      isAllowed = true;
    }

    if (!isAllowed) {
      return res.status(403).json({ error: 'Access Denied: You cannot submit payments for unlinked students.' });
    }

    // Validate the selected billing months up front so a submission that
    // can never be allocated correctly is rejected before review, not
    // silently accepted and then failing at approval time.
    let monthIds: string[] | null = null;
    if (Array.isArray(billingMonthIds) && billingMonthIds.length > 0) {
      const check = await dbClient.query(
        `SELECT id, fee_amount, amount_paid FROM monthly_dues WHERE id = ANY($1::text[]) AND student_id = $2`,
        [billingMonthIds, studentId]
      );
      if (check.rowCount !== billingMonthIds.length) {
        return res.status(400).json({ error: 'One or more selected billing months are invalid for this student.' });
      }
      const totalRemaining = check.rows.reduce((sum, d) => sum + Math.max(0, Number(d.fee_amount) - Number(d.amount_paid)), 0);
      if (Number(amount) > totalRemaining + 0.005) {
        return res.status(400).json({ error: `Amount exceeds the total outstanding for the selected month(s) (RM ${totalRemaining.toFixed(2)}).` });
      }
      monthIds = billingMonthIds;
    }

    const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payRes = await dbClient.query(
      `INSERT INTO payments (id, organization_id, student_id, parent_id, amount, method, proof_notes, submitted_by, status, billing_month_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [payId, student.organization_id, student.id, user.role === UserRole.PARENT ? user.id : null, parseFloat(amount), method || 'DuitNow QR', proofNotes?.trim() || null, user.id, 'Pending Review', monthIds]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Payment Notice Submitted', `Submitted payment notice of RM ${amount} for ${student.full_name}`, user.role, user.email]
    );

    return res.status(201).json({ message: 'Payment notice submitted for review.', payment: payRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Approve payment and generate official receipt (ADMIN_PERSATUAN or assigned MASTER; Super Admin denied)
router.post('/:paymentId/approve', authenticateJWT, requirePermission(Permission.CLASS_APPROVE_PAYMENT), async (req: Request, res: Response) => {
  try {
    const payRes = await dbClient.query('SELECT * FROM payments WHERE id = $1', [req.params.paymentId]);
    if (payRes.rowCount === 0) return res.status(404).json({ error: 'Payment record not found.' });

    const payment = payRes.rows[0];
    const access = await studentAccess(req.user!, payment.student_id);
    if (!access.allowed || ![UserRole.ADMIN_PERSATUAN, UserRole.MASTER].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Payment approval access denied.' });
    }
    if (payment.status !== 'Pending Review') return res.status(409).json({ error: 'Payment has already been reviewed.' });

    let updatePayRes;
    let receiptNo = '';
    for (let attempt = 1; attempt <= MAX_RECEIPT_ATTEMPTS; attempt++) {
      receiptNo = generateReceiptNo();
      try {
        updatePayRes = await dbClient.query(
          `UPDATE payments
           SET status = 'Approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, receipt_no = $2
           WHERE id = $3
           RETURNING *`,
          [req.user!.id, receiptNo, payment.id]
        );
        break;
      } catch (err: any) {
        if (isUniqueViolation(err) && attempt < MAX_RECEIPT_ATTEMPTS) continue;
        throw err;
      }
    }

    // Update student billing status
    await dbClient.query("UPDATE students SET billing_status = 'Paid' WHERE id = $1", [payment.student_id]);

    // Allocate to the specific billing month(s) selected at submission time,
    // if any — never rewrites payment.amount/receipt_no, only the ledger.
    // The payment itself is already approved and receipted at this point
    // (this codebase has no cross-table transaction wrapping, matching the
    // rest of billing.routes.ts); if the outstanding balance changed since
    // submission (e.g. a concurrent cash payment on the same month), the
    // allocation is skipped rather than failing an otherwise-valid approval
    // — this is a known, narrow edge case, not silently-wrong data, since
    // nothing is double-applied or mis-recorded.
    let ledgerWarning: string | null = null;
    if (payment.billing_month_ids && payment.billing_month_ids.length > 0) {
      try {
        await applyPaymentToMonthlyDues(payment.id, payment.billing_month_ids, Number(payment.amount), payment.student_id, payment.organization_id);
      } catch (allocErr: any) {
        console.error('[Monthly dues allocation error]', allocErr);
        ledgerWarning = 'Payment approved, but it could not be applied to the selected billing month(s): ' + allocErr.message;
      }
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Payment Approved', `Approved payment ${payment.id} with receipt ${receiptNo}`, req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Payment approved successfully in PostgreSQL.', payment: updatePayRes!.rows[0], ledgerWarning });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.post('/:paymentId/reject', authenticateJWT, requirePermission(Permission.CLASS_APPROVE_PAYMENT), async (req: Request, res: Response) => {
  try {
    const result = await dbClient.query('SELECT * FROM payments WHERE id = $1', [req.params.paymentId]);
    const payment = result.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    const access = await studentAccess(req.user!, payment.student_id);
    if (!access.allowed || ![UserRole.ADMIN_PERSATUAN, UserRole.MASTER].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Payment review access denied.' });
    }
    if (payment.status !== 'Pending Review') return res.status(409).json({ error: 'Payment has already been reviewed.' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required.' });
    const updated = await dbClient.query(
      `UPDATE payments SET status = 'Rejected', proof_notes = COALESCE(proof_notes, '') || $1
       WHERE id = $2 RETURNING *`, [`\nRejected: ${reason}`, payment.id]);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Payment Rejected', `Payment ${payment.id} rejected`, req.user!.role, req.user!.email]);
    return res.json({ payment: updated.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Record direct cash payment with immediate receipt (ADMIN_PERSATUAN or assigned MASTER)
router.post('/record-cash-payment', authenticateJWT, requirePermission(Permission.CLASS_RECORD_CASH_PAYMENT), async (req: Request, res: Response) => {
  try {
    const { studentId, amount, method, proofNotes, billingMonthIds } = req.body;
    if (!studentId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'studentId and amount are required.' });
    }

    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentRes.rowCount === 0) return res.status(404).json({ error: 'Student not found.' });
    const student = studentRes.rows[0];
    const access = await studentAccess(req.user!, studentId);
    if (!access.allowed || ![UserRole.ADMIN_PERSATUAN, UserRole.MASTER].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Cash payment access denied.' });
    }

    let monthIds: string[] | null = null;
    if (Array.isArray(billingMonthIds) && billingMonthIds.length > 0) {
      const check = await dbClient.query(
        `SELECT id, fee_amount, amount_paid FROM monthly_dues WHERE id = ANY($1::text[]) AND student_id = $2`,
        [billingMonthIds, studentId]
      );
      if (check.rowCount !== billingMonthIds.length) {
        return res.status(400).json({ error: 'One or more selected billing months are invalid for this student.' });
      }
      const totalRemaining = check.rows.reduce((sum, d) => sum + Math.max(0, Number(d.fee_amount) - Number(d.amount_paid)), 0);
      if (Number(amount) > totalRemaining + 0.005) {
        return res.status(400).json({ error: `Amount exceeds the total outstanding for the selected month(s) (RM ${totalRemaining.toFixed(2)}).` });
      }
      monthIds = billingMonthIds;
    }

    const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let payRes;
    let receiptNo = '';
    for (let attempt = 1; attempt <= MAX_RECEIPT_ATTEMPTS; attempt++) {
      receiptNo = generateReceiptNo();
      try {
        payRes = await dbClient.query(
          `INSERT INTO payments (id, organization_id, student_id, amount, method, proof_notes, receipt_no, submitted_by, approved_by, approved_at, status, billing_month_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, 'Approved', $10)
           RETURNING *, receipt_no as "receiptNo"`,
          [payId, student.organization_id, student.id, parseFloat(amount), method || 'Cash / In-Person', proofNotes?.trim() || null, receiptNo, req.user!.id, req.user!.id, monthIds]
        );
        break;
      } catch (err: any) {
        if (isUniqueViolation(err) && attempt < MAX_RECEIPT_ATTEMPTS) continue;
        throw err;
      }
    }

    // Update student billing status
    await dbClient.query("UPDATE students SET billing_status = 'Paid' WHERE id = $1", [student.id]);

    // Already-validated above, so this should not throw — but guarded the
    // same way as the /approve path for consistency and defense in depth.
    if (monthIds) {
      try {
        await applyPaymentToMonthlyDues(payRes!.rows[0].id, monthIds, parseFloat(amount), student.id, student.organization_id);
      } catch (allocErr: any) {
        console.error('[Monthly dues allocation error]', allocErr);
      }
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Cash Payment Recorded', `Recorded in-person payment of RM ${amount} for ${student.full_name} (Receipt: ${receiptNo})`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Cash payment recorded and receipt generated in PostgreSQL.', payment: payRes!.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
