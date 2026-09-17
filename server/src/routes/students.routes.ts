import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { hashPasswordServer } from '../security/crypto';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  if (req.user?.role !== UserRole.STUDENT) return res.status(403).json({ error: 'Student account required.' });
  try {
    const result = await dbClient.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Student profile not found.' });
    const access = await studentAccess(req.user, result.rows[0].id);
    return res.json({ student: access.student });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Enroll new student (ADMIN_PERSATUAN)
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_STUDENTS), async (req: Request, res: Response) => {
  try {
    const { organizationId, classId, fullName, icNumber, phone, email, password, beltRank, hasSiblingDiscount } = req.body;
    const orgId = organizationId || req.user?.organizationId;

    if (!fullName || !orgId) {
      return res.status(400).json({ error: 'Full name and organizationId are required.' });
    }
    if (classId) {
      const assigned = await dbClient.query('SELECT id FROM classes WHERE id = $1 AND organization_id = $2', [classId, orgId]);
      if (!assigned.rowCount) return res.status(400).json({ error: 'Class must belong to this organization.' });
    }

    const orgRes = await dbClient.query('SELECT base_monthly_fee, sibling_discount_percent FROM organizations WHERE id = $1', [orgId]);
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }

    const baseFee = parseFloat(orgRes.rows[0].base_monthly_fee) || 120.0;
    const siblingDiscPct = orgRes.rows[0].sibling_discount_percent !== undefined ? parseFloat(orgRes.rows[0].sibling_discount_percent) : 10.0;
    const isSibling = Boolean(hasSiblingDiscount);
    const calculatedFee = isSibling ? Math.round(baseFee * (1 - (siblingDiscPct / 100))) : baseFee;

    const studentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let userId: string | null = null;

    if (email && password) {
      userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const passHash = hashPasswordServer(password.trim());
      await dbClient.query(
        `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, orgId, email.trim().toLowerCase(), passHash, fullName.trim(), phone?.trim() || null, UserRole.STUDENT, 'ACTIVE']
      );
    }

    const studentRes = await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, has_sibling_discount, billing_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [studentId, orgId, classId || null, userId, fullName.trim(), icNumber?.trim() || '', phone?.trim() || null, email?.trim()?.toLowerCase() || null, beltRank?.trim() || 'White Belt', calculatedFee, isSibling, 'Unpaid', 'ACTIVE']
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Student Enrolled', `Enrolled student ${fullName.trim()} with fee RM ${calculatedFee} (10% Sibling Discount: ${isSibling})`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({
      message: 'Student enrolled successfully in PostgreSQL.',
      student: studentRes.rows[0]
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// List students for organization (ADMIN_PERSATUAN or assigned MASTER; Super Admin denied)
router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.params.orgId !== req.user?.organizationId ||
        ![UserRole.ADMIN_PERSATUAN, UserRole.MASTER].includes(req.user.role)) {
      return res.status(403).json({ error: 'Roster access denied.' });
    }
    const listRes = req.user.role === UserRole.MASTER
      ? await dbClient.query(`SELECT * FROM students WHERE organization_id = $1 AND class_id = ANY($2::text[])
                              ORDER BY registered_at DESC`, [req.params.orgId, req.user.assignedClassIds || []])
      : await dbClient.query('SELECT * FROM students WHERE organization_id = $1 ORDER BY registered_at DESC', [req.params.orgId]);
    return res.json({ students: listRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.post('/:studentId/transfer-requests', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.STUDENT) return res.status(403).json({ error: 'Student account required.' });
    const access = await studentAccess(req.user, req.params.studentId);
    if (!access.allowed) return res.status(403).json({ error: 'Student access denied.' });
    const oldClassId = access.student.class_id;
    const newClassId = req.body.newClassId;
    if (!oldClassId || !newClassId || oldClassId === newClassId) {
      return res.status(400).json({ error: 'A different current and destination class are required.' });
    }
    const target = await dbClient.query(
      'SELECT id FROM classes WHERE id = $1 AND organization_id = $2 AND status = $3',
      [newClassId, access.student.organization_id, 'ACTIVE']);
    if (!target.rowCount) return res.status(400).json({ error: 'Destination class is unavailable.' });
    const reviewers = await dbClient.query(
      `SELECT a.class_id FROM coach_class_assignments a JOIN users u ON u.id = a.coach_id
       WHERE a.class_id = ANY($1::text[]) AND u.status = 'ACTIVE'`, [[oldClassId, newClassId]]);
    const reviewable = new Set(reviewers.rows.map(r => r.class_id));
    if (!reviewable.has(oldClassId) || !reviewable.has(newClassId)) {
      return res.status(400).json({ error: 'Both classes need an assigned active Master before transfer.' });
    }
    const existing = await dbClient.query(
      `SELECT id FROM class_transfer_requests WHERE student_id = $1
       AND status IN ('PENDING_OLD_MASTER', 'PENDING_NEW_MASTER')`, [access.student.id]);
    if (existing.rowCount) return res.status(409).json({ error: 'A transfer is already pending.' });
    const id = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await dbClient.query(
      `INSERT INTO class_transfer_requests (id, student_id, organization_id, old_class_id, new_class_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, access.student.id, access.student.organization_id, oldClassId, newClassId]);
    return res.status(201).json({ transfer: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.post('/transfer-requests/:transferId/:decision', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.MASTER || !['approve', 'reject'].includes(req.params.decision)) {
      return res.status(403).json({ error: 'Assigned Master decision required.' });
    }
    const result = await dbClient.query('SELECT * FROM class_transfer_requests WHERE id = $1', [req.params.transferId]);
    const transfer = result.rows[0];
    if (!transfer) return res.status(404).json({ error: 'Transfer not found.' });
    if (transfer.organization_id !== req.user.organizationId) return res.status(403).json({ error: 'Cross-organization transfer denied.' });
    const expectedClass = transfer.status === 'PENDING_OLD_MASTER' ? transfer.old_class_id
      : transfer.status === 'PENDING_NEW_MASTER' ? transfer.new_class_id : null;
    if (!expectedClass) return res.status(409).json({ error: 'Transfer is no longer pending.' });
    if (!req.user.assignedClassIds?.includes(expectedClass)) {
      return res.status(403).json({ error: 'Master is not assigned to this approval step.' });
    }
    const current = await dbClient.query('SELECT class_id FROM students WHERE id = $1', [transfer.student_id]);
    if (current.rows[0]?.class_id !== transfer.old_class_id) return res.status(409).json({ error: 'Student class changed while transfer was pending.' });
    if (req.params.decision === 'reject') {
      await dbClient.query("UPDATE class_transfer_requests SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [transfer.id]);
      return res.json({ status: 'REJECTED' });
    }
    if (transfer.status === 'PENDING_OLD_MASTER') {
      await dbClient.query(
        `UPDATE class_transfer_requests SET old_master_approved = true, status = 'PENDING_NEW_MASTER',
         updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [transfer.id]);
      return res.json({ status: 'PENDING_NEW_MASTER' });
    }
    await dbClient.query('UPDATE students SET class_id = $1 WHERE id = $2 AND class_id = $3',
      [transfer.new_class_id, transfer.student_id, transfer.old_class_id]);
    await dbClient.query(
      `UPDATE class_transfer_requests SET new_master_approved = true, status = 'APPROVED',
       updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [transfer.id]);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Class Transfer Approved',
       `Student ${transfer.student_id} transferred from ${transfer.old_class_id} to ${transfer.new_class_id}`,
       req.user.role, req.user.email]);
    return res.json({ status: 'APPROVED' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/transfer-requests/pending', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER) return res.status(403).json({ error: 'Master account required.' });
    const result = await dbClient.query(
      `SELECT t.*, s.full_name AS student_name FROM class_transfer_requests t
       JOIN students s ON s.id = t.student_id WHERE t.organization_id = $1
       AND ((t.status = 'PENDING_OLD_MASTER' AND t.old_class_id = ANY($2::text[]))
         OR (t.status = 'PENDING_NEW_MASTER' AND t.new_class_id = ANY($2::text[])))
       ORDER BY t.created_at DESC`, [user.organizationId, user.assignedClassIds || []]);
    return res.json({ transfers: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Get student details (Self, linked Parent, assigned Master, or Admin Persatuan)
router.get('/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const access = await studentAccess(req.user!, req.params.studentId);
    if (!access.student) return res.status(404).json({ error: 'Student not found.' });
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access Denied: Not authorized to view this student record.' });
    }

    return res.json({ student: access.student });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
