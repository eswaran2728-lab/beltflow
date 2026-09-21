import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { hashPasswordServer } from '../security/crypto';
import { validatePassword } from '../security/passwordPolicy';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Sensible bounds for a monthly tuition fee: must be a positive number, at
// most two decimal places (currency), and below an upper limit that catches
// obvious fat-finger/abuse input (e.g. accidentally entering cents as
// ringgit, or a malicious 1e30-style payload) without constraining any
// realistic tuition price.
const MAX_MONTHLY_FEE = 100000;

function validateMonthlyFee(value: unknown): { valid: boolean; amount?: number; error?: string } {
  const amount = Number(value);
  if (typeof value !== 'number' && typeof value !== 'string') {
    return { valid: false, error: 'monthlyFee is required.' };
  }
  if (!Number.isFinite(amount)) {
    return { valid: false, error: 'monthlyFee must be a valid number.' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'monthlyFee must be greater than zero.' };
  }
  if (amount > MAX_MONTHLY_FEE) {
    return { valid: false, error: `monthlyFee must not exceed RM ${MAX_MONTHLY_FEE}.` };
  }
  // Reject more than 2 decimal places (e.g. 120.005) without relying on
  // floating-point string formatting, which can misround.
  if (Math.round(amount * 100) !== amount * 100) {
    return { valid: false, error: 'monthlyFee must have at most two decimal places.' };
  }
  return { valid: true, amount: Math.round(amount * 100) / 100 };
}

// Create new class (ADMIN_PERSATUAN)
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CLASSES), async (req: Request, res: Response) => {
  try {
    const { organizationId, name, schedule, location, mainMasterId } = req.body;
    const orgId = organizationId || req.user?.organizationId;

    if (!name || !orgId) {
      return res.status(400).json({ error: 'Class name and organizationId are required.' });
    }

    const classId = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const masterId = mainMasterId || null;
    const effectiveMainMasterId = masterId;
    if (effectiveMainMasterId) {
      const master = await dbClient.query("SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND role = 'MASTER' AND status = 'ACTIVE'", [effectiveMainMasterId, orgId]);
      if (!master.rowCount) return res.status(400).json({ error: 'Main Master must be an active Master in this organization.' });
    }

    // New classes start at the organization's legacy base fee as a
    // reasonable default — the assigned Master can change it afterward via
    // PATCH /:classId/fee. This is the only place base_monthly_fee is still
    // read; it is no longer editable by the admin (see organizations.routes.ts).
    const orgRes = await dbClient.query('SELECT base_monthly_fee FROM organizations WHERE id = $1', [orgId]);
    const initialFee = orgRes.rows[0]?.base_monthly_fee ?? 120.0;

    const classRes = await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, monthly_fee, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [classId, orgId, masterId, effectiveMainMasterId, name.trim(), schedule?.trim() || 'Mon & Wed 7:00 PM - 8:30 PM', location?.trim() || 'Mat A', initialFee, 'ACTIVE']
    );

    if (effectiveMainMasterId) {
      await dbClient.query(
        `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
         VALUES ($1, $2, $3)
         ON CONFLICT (coach_id, class_id) DO UPDATE SET is_main_master = EXCLUDED.is_main_master`,
        [effectiveMainMasterId, classId, true]
      );
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Class Created', `Created class: ${name.trim()} (Main Master ID: ${effectiveMainMasterId})`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Class created successfully in PostgreSQL.', class: classRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// List classes for organization (ADMIN_PERSATUAN or assigned MASTER)
router.get('/organization/:orgId', authenticateJWT, requirePermission(Permission.CLASS_VIEW), async (req: Request, res: Response) => {
  try {
    const listRes = req.user!.role === UserRole.MASTER
      ? await dbClient.query(`SELECT c.*, u.full_name AS master_name FROM classes c
                              JOIN coach_class_assignments a ON a.class_id = c.id
                              LEFT JOIN users u ON u.id = c.main_master_id
                              WHERE c.organization_id = $1 AND a.coach_id = $2 ORDER BY c.created_at DESC`, [req.params.orgId, req.user!.id])
      : await dbClient.query(`SELECT c.*, u.full_name AS master_name FROM classes c
                              LEFT JOIN users u ON u.id = c.main_master_id
                              WHERE c.organization_id = $1 ORDER BY c.created_at DESC`, [req.params.orgId]);
    return res.json({ classes: listRes.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Set a class's monthly tuition fee (assigned MASTER only). requirePermission
// derives targetClassId from req.params.classId and rejects any Master not
// assigned to it (see rbac.ts) — Persatuan Admins, Super Admin, Parents,
// Students, and Masters assigned to OTHER classes are all denied by RBAC
// before this handler body runs, not merely hidden in the UI. Changing the
// fee here only affects future billing: existing payments/receipts store
// their own independent amount and are never touched by this endpoint.
router.patch('/:classId/fee', authenticateJWT, requirePermission(Permission.CLASS_MANAGE_FEES), async (req: Request, res: Response) => {
  try {
    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [req.params.classId]);
    if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
    const cls = classRes.rows[0];

    // Defense-in-depth beyond RBAC: explicitly re-confirm this class belongs
    // to the caller's own organization and that they are actually assigned
    // to it, rather than relying solely on the permission check above.
    if (cls.organization_id !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization fee change denied.' });
    }
    if (!req.user!.assignedClassIds?.includes(cls.id)) {
      return res.status(403).json({ error: 'You are not assigned to this class.' });
    }

    const feeCheck = validateMonthlyFee(req.body.monthlyFee);
    if (!feeCheck.valid) {
      return res.status(400).json({ error: feeCheck.error });
    }
    const newFee = feeCheck.amount!;
    const oldFee = Number(cls.monthly_fee);

    const updateRes = await dbClient.query(
      'UPDATE classes SET monthly_fee = $1 WHERE id = $2 RETURNING *',
      [newFee, cls.id]
    );

    // Propagate to every currently-enrolled ACTIVE student's tuition
    // reference so dashboards/outstanding-fee/payment-default displays show
    // the new amount going forward (requirement: dashboards/totals/
    // outstanding fee must reflect the correct, current class fee). This
    // never touches the `payments` table — every payment already recorded
    // keeps its own independently-stored `amount` and `receipt_no` forever,
    // so historical receipts are provably unaffected by this fee change.
    await dbClient.query(
      `UPDATE students s SET monthly_fee = CASE
         WHEN s.has_sibling_discount THEN ROUND($1::numeric * (1 - o.sibling_discount_percent / 100))
         ELSE $1::numeric
       END
       FROM organizations o
       WHERE o.id = s.organization_id AND s.class_id = $2 AND s.status = 'ACTIVE'`,
      [newFee, cls.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Class Fee Changed',
       `Org ${cls.organization_id}, Class ${cls.id} (${cls.name}): RM ${oldFee.toFixed(2)} -> RM ${newFee.toFixed(2)} by Master ${req.user!.id} (${req.user!.email})`,
       req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Class monthly fee updated. Future billing will use the new amount.', class: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Register Master / Instructor (ADMIN_PERSATUAN)
router.post('/masters', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_COACHES), async (req: Request, res: Response) => {
  try {
    const { organizationId, fullName, email, password, phone, assignedClassIds } = req.body;
    const orgId = organizationId || req.user?.organizationId;

    if (!fullName || !email || !password || !orgId) {
      return res.status(400).json({ error: 'Full name, email, password, and organizationId are required.' });
    }
    const masterPasswordCheck = validatePassword(password);
    if (!masterPasswordCheck.valid) {
      return res.status(400).json({ error: masterPasswordCheck.error });
    }
    const classIds = Array.isArray(assignedClassIds) ? assignedClassIds : [];
    for (const cid of classIds) {
      const cls = await dbClient.query('SELECT id FROM classes WHERE id = $1 AND organization_id = $2', [cid, orgId]);
      if (!cls.rowCount) return res.status(400).json({ error: 'Assigned class must belong to this organization.' });
    }

    const masterId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passHash = hashPasswordServer(password.trim());

    const userRes = await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, organization_id, email, full_name, phone, role, status`,
      [masterId, orgId, email.trim().toLowerCase(), passHash, fullName.trim(), phone?.trim() || null, UserRole.MASTER, 'ACTIVE']
    );

    for (const cid of classIds) {
      await dbClient.query(
        `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [masterId, cid, false]
      );
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Master Registered', `Registered instructor: ${fullName.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({
      message: 'Master registered successfully in PostgreSQL.',
      master: {
        ...userRes.rows[0],
        assignedClassIds: classIds
      }
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
