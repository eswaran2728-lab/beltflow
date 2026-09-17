import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
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

router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.params.orgId !== req.user?.organizationId ||
        ![UserRole.ADMIN_PERSATUAN, UserRole.MASTER].includes(req.user.role)) {
      return res.status(403).json({ error: 'Finance access denied.' });
    }
    const result = req.user.role === UserRole.MASTER
      ? await dbClient.query(
        `SELECT p.*, s.full_name AS student_name FROM payments p
         JOIN students s ON s.id = p.student_id
         WHERE p.organization_id = $1 AND s.class_id = ANY($2::text[])
         ORDER BY p.created_at DESC`, [req.params.orgId, req.user.assignedClassIds || []])
      : await dbClient.query(
        `SELECT p.*, s.full_name AS student_name FROM payments p
         JOIN students s ON s.id = p.student_id
         WHERE p.organization_id = $1 ORDER BY p.created_at DESC`, [req.params.orgId]);
    return res.json({ payments: result.rows });
  } catch (err: any) {
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
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Submit payment notice (Parent or Student)
router.post('/submit-payment', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, amount, method, proofNotes } = req.body;
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

    const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payRes = await dbClient.query(
      `INSERT INTO payments (id, organization_id, student_id, parent_id, amount, method, proof_notes, submitted_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [payId, student.organization_id, student.id, user.role === UserRole.PARENT ? user.id : null, parseFloat(amount), method || 'DuitNow QR', proofNotes?.trim() || null, user.id, 'Pending Review']
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Payment Notice Submitted', `Submitted payment notice of RM ${amount} for ${student.full_name}`, user.role, user.email]
    );

    return res.status(201).json({ message: 'Payment notice submitted for review.', payment: payRes.rows[0] });
  } catch (err: any) {
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

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Payment Approved', `Approved payment ${payment.id} with receipt ${receiptNo}`, req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Payment approved successfully in PostgreSQL.', payment: updatePayRes!.rows[0] });
  } catch (err: any) {
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
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Record direct cash payment with immediate receipt (ADMIN_PERSATUAN or assigned MASTER)
router.post('/record-cash-payment', authenticateJWT, requirePermission(Permission.CLASS_RECORD_CASH_PAYMENT), async (req: Request, res: Response) => {
  try {
    const { studentId, amount, method, proofNotes } = req.body;
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

    const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let payRes;
    let receiptNo = '';
    for (let attempt = 1; attempt <= MAX_RECEIPT_ATTEMPTS; attempt++) {
      receiptNo = generateReceiptNo();
      try {
        payRes = await dbClient.query(
          `INSERT INTO payments (id, organization_id, student_id, amount, method, proof_notes, receipt_no, submitted_by, approved_by, approved_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, 'Approved')
           RETURNING *, receipt_no as "receiptNo"`,
          [payId, student.organization_id, student.id, parseFloat(amount), method || 'Cash / In-Person', proofNotes?.trim() || null, receiptNo, req.user!.id, req.user!.id]
        );
        break;
      } catch (err: any) {
        if (isUniqueViolation(err) && attempt < MAX_RECEIPT_ATTEMPTS) continue;
        throw err;
      }
    }

    // Update student billing status
    await dbClient.query("UPDATE students SET billing_status = 'Paid' WHERE id = $1", [student.id]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Cash Payment Recorded', `Recorded in-person payment of RM ${amount} for ${student.full_name} (Receipt: ${receiptNo})`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Cash payment recorded and receipt generated in PostgreSQL.', payment: payRes!.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
