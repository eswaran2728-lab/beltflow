import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { hashPasswordServer } from '../security/crypto';
import { validatePassword } from '../security/passwordPolicy';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { classAccess, assignedMasterAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

// Master class enrollment inbox (assigned Master only)
router.get('/:classId/enrollment-applications', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Master role required.' });
    }

    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [req.params.classId]);
    if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
    const cls = classRes.rows[0];

    if (cls.organization_id !== user.organizationId) {
      return res.status(403).json({ error: 'Cross-organization class access denied.' });
    }

    // Verify Master is assigned or holds leadership
    const leadershipRes = await dbClient.query(
      'SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE',
      [cls.id, user.id]
    );
    if (leadershipRes.rowCount === 0) {
      const coachRes = await dbClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
        [cls.id, user.id]
      );
      if (coachRes.rowCount === 0) {
        return res.status(403).json({ error: 'Master is not assigned to this class.' });
      }
    }

    const result = await dbClient.query(
      `SELECT ea.*, s.full_name AS student_full_name, s.ic_number AS student_ic, s.belt_rank AS student_belt,
              s.phone AS student_phone, u.full_name AS guardian_name, u.phone AS guardian_phone
       FROM enrollment_applications ea
       JOIN students s ON s.id = ea.student_id
       LEFT JOIN users u ON u.id = ea.guardian_id
       WHERE ea.class_id = $1
       ORDER BY ea.created_at DESC`,
      [cls.id]
    );

    return res.json({ applications: result.rows });
  } catch (err: any) {
    console.error('[Class enrollment applications error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch applications.') });
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
       WHERE o.id = s.organization_id AND s.class_id = $2 AND s.status = 'ACTIVE' AND s.fee_override = FALSE`,
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

// Update class operational settings (Assigned Master or Persatuan Admin)
router.patch('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const classId = req.params.id;
    const user = req.user!;
    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [classId]);
    if (classRes.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }
    const cls = classRes.rows[0];

    // Check authorization:
    // If MASTER, must be assigned to this class or active primary leader in class_leaderships
    if (user.role === UserRole.MASTER) {
      const isAssigned = user.assignedClassIds?.includes(cls.id);
      const isPrimary = await dbClient.query(
        'SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE',
        [cls.id, user.id]
      );
      if (!isAssigned && isPrimary.rowCount === 0) {
        return res.status(403).json({ error: 'You are not authorized to configure this class.' });
      }
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      if (user.organizationId !== cls.organization_id) {
        return res.status(403).json({ error: 'Cross-organization class update denied.' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized to configure class.' });
    }

    const { description, venueDetails, schedule, capacity, enrollmentAvailability, operationalStatus, contactChannel } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description?.trim() || null);
    }
    if (venueDetails !== undefined) {
      updates.push(`venue_details = $${idx++}`);
      values.push(venueDetails?.trim() || null);
    }
    if (schedule !== undefined) {
      updates.push(`schedule = $${idx++}`);
      values.push(schedule?.trim());
    }
    if (capacity !== undefined) {
      const capNum = Number(capacity);
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
    if (operationalStatus !== undefined) {
      if (!['NOT_STARTED', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(operationalStatus)) {
        return res.status(400).json({ error: 'Invalid operational status.' });
      }
      updates.push(`operational_status = $${idx++}`);
      values.push(operationalStatus);
    }
    if (contactChannel !== undefined) {
      updates.push(`contact_channel = $${idx++}`);
      values.push(contactChannel?.trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No update fields provided.' });
    }

    values.push(classId);
    const updateRes = await dbClient.query(
      `UPDATE classes SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Class Updated',
       `Class ${cls.id} (${cls.name}) operational details updated by ${user.role} ${user.id}`,
       user.role, user.email]
    );

    return res.json({ message: 'Class updated successfully.', class: updateRes.rows[0] });
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

// ================= PERSATUAN: ASSIGN / REPLACE / REMOVE MASTER =================
// The Persatuan assigns a Master to a class/location ONCE here — never
// repeatedly per group/session. Replacing or removing revokes the previous
// Master's coach_class_assignments row for this class immediately: since
// authenticateJWT re-derives assignedClassIds fresh from that table on
// every request, the old Master loses access on their very next request,
// with no stale token able to retain it.
router.patch('/:classId/assign-master', authenticateJWT, requirePermission(Permission.CLASS_ASSIGN_COACH), async (req: Request, res: Response) => {
  try {
    const { masterId } = req.body; // null/omitted = remove the current Master, no replacement
    const classRes = await dbClient.query('SELECT * FROM classes WHERE id = $1', [req.params.classId]);
    if (classRes.rowCount === 0) return res.status(404).json({ error: 'Class not found.' });
    const cls = classRes.rows[0];
    if (cls.organization_id !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization assignment denied.' });
    }

    if (masterId) {
      const master = await dbClient.query(
        "SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND role = 'MASTER' AND status = 'ACTIVE'",
        [masterId, cls.organization_id]
      );
      if (!master.rowCount) return res.status(400).json({ error: 'Master must be an active Master in this organization.' });
    }

    const previousMasterId = cls.main_master_id;

    // Revoke the previous Master's assignment to THIS class immediately —
    // they may still be assigned to other classes, so only this class's row
    // is removed, never every assignment the coach holds.
    if (previousMasterId) {
      await dbClient.query('DELETE FROM coach_class_assignments WHERE coach_id = $1 AND class_id = $2', [previousMasterId, req.params.classId]);
    }

    if (masterId) {
      await dbClient.query(
        `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (coach_id, class_id) DO UPDATE SET is_main_master = TRUE`,
        [masterId, req.params.classId]
      );
    }

    const updated = await dbClient.query(
      'UPDATE classes SET master_id = $1, main_master_id = $1 WHERE id = $2 RETURNING *',
      [masterId || null, req.params.classId]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [newId('audit'), masterId ? 'Master Assigned' : 'Master Removed',
       `Class ${cls.id} (${cls.name}): previous Master ${previousMasterId || 'none'} -> ${masterId ? `new Master ${masterId}` : 'none'}`,
       req.user!.role, req.user!.email]
    );

    return res.json({ message: masterId ? 'Master assigned. Previous Master access revoked immediately.' : 'Master removed. Access revoked immediately.', class: updated.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ================= TRAINING GROUPS (assigned MASTER only; Admin view-only via GET) =================

// Create a training group under the assigned class/location (e.g. Kids,
// Teenagers, All Ages). Master-only — the Persatuan creates the
// class/location itself, but never its internal groups.
router.post('/:classId/groups', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required.' });
    if (!(await assignedMasterAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'Only the assigned Master may create groups for this class.' });
    }
    const cls = (await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [req.params.classId])).rows[0];
    const groupId = newId('grp');
    const result = await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [groupId, cls.organization_id, req.params.classId, name.trim(), req.user!.id]
    );
    return res.status(201).json({ group: result.rows[0] });
  } catch (err: any) {
    if (err && err.code === '23505') return res.status(400).json({ error: 'A group with this name already exists in this class.' });
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// View groups for a class — assigned Master OR same-organization Admin (read-only).
router.get('/:classId/groups', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await classAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to view this class.' });
    }
    const result = await dbClient.query(
      "SELECT * FROM training_groups WHERE class_id = $1 AND status = 'ACTIVE' ORDER BY created_at", [req.params.classId]);
    return res.json({ groups: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ================= SCHEDULES (assigned MASTER only to write; view is classAccess) =================

// Manual day/place/time schedule entry — no fixed weekday/location choices;
// the Master types day_of_week, location, start_time, end_time freely.
router.post('/:classId/schedules', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { groupId, dayOfWeek, startTime, endTime, location, recurring, notes } = req.body;
    if (!groupId || !dayOfWeek || !startTime || !endTime || !location) {
      return res.status(400).json({ error: 'groupId, dayOfWeek, startTime, endTime, and location are required.' });
    }
    if (!(await assignedMasterAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'Only the assigned Master may create schedules for this class.' });
    }
    const group = await dbClient.query('SELECT id, organization_id FROM training_groups WHERE id = $1 AND class_id = $2', [groupId, req.params.classId]);
    if (!group.rowCount) return res.status(400).json({ error: 'Group must belong to this class.' });

    const scheduleId = newId('sched');
    const result = await dbClient.query(
      `INSERT INTO class_schedules (id, organization_id, class_id, group_id, day_of_week, start_time, end_time, location, recurring, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [scheduleId, group.rows[0].organization_id, req.params.classId, groupId, dayOfWeek.trim(), startTime.trim(), endTime.trim(), location.trim(), recurring !== false, notes?.trim() || null, req.user!.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [newId('audit'), 'Schedule Created', `Class ${req.params.classId}, Group ${groupId}: ${dayOfWeek} ${startTime}-${endTime} at ${location}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ schedule: result.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/:classId/schedules', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await classAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to view this class.' });
    }
    const result = await dbClient.query(
      "SELECT * FROM class_schedules WHERE class_id = $1 AND status = 'ACTIVE' ORDER BY created_at", [req.params.classId]);
    return res.json({ schedules: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.patch('/schedules/:scheduleId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const schedRes = await dbClient.query('SELECT * FROM class_schedules WHERE id = $1', [req.params.scheduleId]);
    if (schedRes.rowCount === 0) return res.status(404).json({ error: 'Schedule not found.' });
    const sched = schedRes.rows[0];
    if (!(await assignedMasterAccess(req.user!, sched.class_id))) {
      return res.status(403).json({ error: 'Only the assigned Master may edit this schedule.' });
    }
    const { dayOfWeek, startTime, endTime, location, recurring, notes, status } = req.body;
    const updated = await dbClient.query(
      `UPDATE class_schedules SET
         day_of_week = COALESCE($1, day_of_week),
         start_time = COALESCE($2, start_time),
         end_time = COALESCE($3, end_time),
         location = COALESCE($4, location),
         recurring = COALESCE($5, recurring),
         notes = COALESCE($6, notes),
         status = COALESCE($7, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [dayOfWeek?.trim() || null, startTime?.trim() || null, endTime?.trim() || null, location?.trim() || null,
       typeof recurring === 'boolean' ? recurring : null, notes?.trim() ?? null, status || null, sched.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [newId('audit'), 'Schedule Updated', `Schedule ${sched.id} (Class ${sched.class_id}) updated`, req.user!.role, req.user!.email]
    );

    return res.json({ schedule: updated.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ================= SESSIONS (assigned MASTER only to write; view via classAccess or self) =================

// Generate (or create ad-hoc) an actual dated session. If scheduleId is
// supplied, the session inherits day/time/location/group from that
// schedule and generation is idempotent (UNIQUE(schedule_id, session_date)
// — regenerating the same date is a safe no-op). Without scheduleId, this
// creates a genuine one-time extra session, decided entirely by the Master.
router.post('/:classId/sessions', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { groupId, scheduleId, sessionDate, dayOfWeek, startTime, endTime, location, isExtra, notes } = req.body;
    if (!groupId || !sessionDate) {
      return res.status(400).json({ error: 'groupId and sessionDate are required.' });
    }
    if (!(await assignedMasterAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'Only the assigned Master may create sessions for this class.' });
    }
    const group = await dbClient.query('SELECT id, organization_id FROM training_groups WHERE id = $1 AND class_id = $2', [groupId, req.params.classId]);
    if (!group.rowCount) return res.status(400).json({ error: 'Group must belong to this class.' });

    let sess = { dayOfWeek, startTime, endTime, location };
    if (scheduleId) {
      const sched = await dbClient.query('SELECT * FROM class_schedules WHERE id = $1 AND class_id = $2 AND group_id = $3', [scheduleId, req.params.classId, groupId]);
      if (!sched.rowCount) return res.status(400).json({ error: 'Schedule must belong to this class and group.' });
      const s = sched.rows[0];
      sess = { dayOfWeek: s.day_of_week, startTime: s.start_time, endTime: s.end_time, location: s.location };
    }
    if (!sess.dayOfWeek || !sess.startTime || !sess.endTime || !sess.location) {
      return res.status(400).json({ error: 'dayOfWeek, startTime, endTime, and location are required (or provide scheduleId).' });
    }

    const sessionId = newId('tsess');
    const insertRes = await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, schedule_id, session_date, day_of_week, start_time, end_time, location, is_extra, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (schedule_id, session_date) DO NOTHING
       RETURNING *`,
      [sessionId, group.rows[0].organization_id, req.params.classId, groupId, scheduleId || null, sessionDate,
       sess.dayOfWeek.trim(), sess.startTime.trim(), sess.endTime.trim(), sess.location.trim(),
       !!isExtra || !scheduleId, notes?.trim() || null, req.user!.id]
    );

    if (insertRes.rowCount === 0) {
      const existing = await dbClient.query('SELECT * FROM training_sessions WHERE schedule_id = $1 AND session_date = $2', [scheduleId, sessionDate]);
      return res.status(200).json({ message: 'Session already existed for this schedule and date.', session: existing.rows[0] });
    }

    // Persistent in-app notice for the relevant group's students/parents.
    await dbClient.query(
      `INSERT INTO notices (id, organization_id, class_id, group_id, session_id, type, message, sender_id, sender_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [newId('notice'), group.rows[0].organization_id, req.params.classId, groupId, sessionId,
       insertRes.rows[0].is_extra ? 'EXTRA_SESSION' : 'NEW_SCHEDULE',
       insertRes.rows[0].is_extra
         ? `Extra session added: ${sess.dayOfWeek} ${sessionDate}, ${sess.startTime}-${sess.endTime} at ${sess.location}.`
         : `New session scheduled: ${sess.dayOfWeek} ${sessionDate}, ${sess.startTime}-${sess.endTime} at ${sess.location}.`,
       req.user!.id, req.user!.email]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [newId('audit'), 'Session Created', `Class ${req.params.classId}, Group ${groupId}, ${sessionDate}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ session: insertRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/:classId/sessions', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await classAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to view this class.' });
    }
    const result = await dbClient.query(
      'SELECT * FROM training_sessions WHERE class_id = $1 ORDER BY session_date DESC, start_time', [req.params.classId]);
    return res.json({ sessions: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Edit, reschedule, or cancel a session — assigned Master only.
router.patch('/sessions/:sessionId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const sessRes = await dbClient.query('SELECT * FROM training_sessions WHERE id = $1', [req.params.sessionId]);
    if (sessRes.rowCount === 0) return res.status(404).json({ error: 'Session not found.' });
    const sess = sessRes.rows[0];
    if (!(await assignedMasterAccess(req.user!, sess.class_id))) {
      return res.status(403).json({ error: 'Only the assigned Master may edit this session.' });
    }

    const { sessionDate, startTime, endTime, location, notes, status, cancelledReason, message } = req.body;
    const isCancelling = status === 'Cancelled';
    const isRescheduling = (sessionDate && sessionDate !== sess.session_date) || (startTime && startTime !== sess.start_time) || (location && location !== sess.location);

    const updated = await dbClient.query(
      `UPDATE training_sessions SET
         session_date = COALESCE($1, session_date),
         start_time = COALESCE($2, start_time),
         end_time = COALESCE($3, end_time),
         location = COALESCE($4, location),
         notes = COALESCE($5, notes),
         status = COALESCE($6, status),
         cancelled_reason = COALESCE($7, cancelled_reason),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [sessionDate || null, startTime?.trim() || null, endTime?.trim() || null, location?.trim() || null,
       notes?.trim() ?? null, status || null, cancelledReason?.trim() || null, sess.id]
    );

    if (isCancelling) {
      await dbClient.query(
        `INSERT INTO notices (id, organization_id, class_id, group_id, session_id, type, message, sender_id, sender_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newId('notice'), sess.organization_id, sess.class_id, sess.group_id, sess.id, 'CANCELLED',
         message?.trim() || `Session on ${updated.rows[0].session_date} (${updated.rows[0].start_time}-${updated.rows[0].end_time} at ${updated.rows[0].location}) has been cancelled.${cancelledReason ? ' Reason: ' + cancelledReason.trim() : ''}`,
         req.user!.id, req.user!.email]
      );
    } else if (isRescheduling) {
      await dbClient.query(
        `INSERT INTO notices (id, organization_id, class_id, group_id, session_id, type, message, sender_id, sender_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newId('notice'), sess.organization_id, sess.class_id, sess.group_id, sess.id, 'SCHEDULE_CHANGE',
         message?.trim() || `Session rescheduled: now ${updated.rows[0].session_date}, ${updated.rows[0].start_time}-${updated.rows[0].end_time} at ${updated.rows[0].location}.`,
         req.user!.id, req.user!.email]
      );
    } else if (message && message.trim()) {
      await dbClient.query(
        `INSERT INTO notices (id, organization_id, class_id, group_id, session_id, type, message, sender_id, sender_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newId('notice'), sess.organization_id, sess.class_id, sess.group_id, sess.id, 'GENERAL', message.trim(), req.user!.id, req.user!.email]
      );
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [newId('audit'), isCancelling ? 'Session Cancelled' : 'Session Updated', `Session ${sess.id} (Class ${sess.class_id})`, req.user!.role, req.user!.email]
    );

    return res.json({ session: updated.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// -------------------------------------------------------------------------
// TASK H06: Master Class Workspace, Authorized Rosters & Class Settings
// -------------------------------------------------------------------------

// GET /classes/:classId/workspace — Master Operational Workspace Summary
router.get('/:classId/workspace', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await assignedMasterAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to access this class workspace.' });
    }

    const classRes = await dbClient.query(
      `SELECT c.*, o.name AS organization_name
       FROM classes c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = $1`,
      [req.params.classId]
    );
    if (!classRes.rowCount) {
      return res.status(404).json({ error: 'Class not found.' });
    }
    const classRow = classRes.rows[0];

    // Canonical active enrollment count
    const activeCountRes = await dbClient.query(
      "SELECT COUNT(*)::int AS count FROM class_enrollments WHERE class_id = $1 AND status = 'ACTIVE'",
      [req.params.classId]
    );
    const activeStudentsCount = activeCountRes.rows[0]?.count || 0;
    const capacity = classRow.capacity || 30;
    const availableSpots = Math.max(0, capacity - activeStudentsCount);

    // Pending and waitlisted enrollment application counts
    const appsCountRes = await dbClient.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'SUBMITTED' OR status = 'UNDER_REVIEW' OR status = 'NEEDS_INFORMATION')::int AS pending_count,
         COUNT(*) FILTER (WHERE status = 'WAITLISTED')::int AS waitlisted_count
       FROM enrollment_applications
       WHERE class_id = $1`,
      [req.params.classId]
    );
    const pendingApplicationsCount = appsCountRes.rows[0]?.pending_count || 0;
    const waitlistedApplicationsCount = appsCountRes.rows[0]?.waitlisted_count || 0;

    // Training groups for this class
    const groupsRes = await dbClient.query(
      'SELECT * FROM training_groups WHERE class_id = $1 ORDER BY name ASC',
      [req.params.classId]
    );

    // Today's sessions
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySessionsRes = await dbClient.query(
      `SELECT ts.*, tg.name AS group_name
       FROM training_sessions ts
       LEFT JOIN training_groups tg ON tg.id = ts.group_id
       WHERE ts.class_id = $1 AND (ts.session_date = CURRENT_DATE::text OR ts.session_date = $2)
       ORDER BY ts.start_time ASC`,
      [req.params.classId, todayStr]
    );

    // Upcoming sessions
    const upcomingSessionsRes = await dbClient.query(
      `SELECT ts.*, tg.name AS group_name
       FROM training_sessions ts
       LEFT JOIN training_groups tg ON tg.id = ts.group_id
       WHERE ts.class_id = $1 AND ts.session_date >= $2
       ORDER BY ts.session_date ASC, ts.start_time ASC
       LIMIT 10`,
      [req.params.classId, todayStr]
    );

    // Recent notices for this class or organization
    const noticesRes = await dbClient.query(
      `SELECT * FROM notices
       WHERE class_id = $1 OR (class_id IS NULL AND organization_id = $2)
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.params.classId, classRow.organization_id]
    );

    return res.json({
      class: classRow,
      activeStudentsCount,
      availableSpots,
      pendingApplicationsCount,
      waitlistedApplicationsCount,
      trainingGroups: groupsRes.rows,
      todaySessions: todaySessionsRes.rows,
      upcomingSessions: upcomingSessionsRes.rows,
      recentNotices: noticesRes.rows,
    });
  } catch (err: any) {
    console.error('[Class Workspace error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// GET /classes/:classId/students — Authorized Canonical Class Roster
router.get('/:classId/students', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await assignedMasterAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to view this class roster.' });
    }

    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const search = (req.query.search as string || '').trim();
    const groupId = (req.query.groupId as string || '').trim();

    const conditions = ["ce.class_id = $1", "ce.status = 'ACTIVE'"];
    const params: any[] = [req.params.classId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.full_name ILIKE $${params.length} OR s.ic_number ILIKE $${params.length})`);
    }
    if (groupId) {
      params.push(groupId);
      conditions.push(`s.group_id = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await dbClient.query(
      `SELECT COUNT(*)::int AS total
       FROM class_enrollments ce
       JOIN students s ON s.id = ce.student_id
       WHERE ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataRes = await dbClient.query(
      `SELECT
         s.id,
         s.full_name,
         s.belt_rank,
         s.group_id,
         tg.name AS group_name,
         s.status AS student_status,
         ce.status AS enrollment_status,
         ce.effective_from AS enrolled_at,
         s.ic_number
       FROM class_enrollments ce
       JOIN students s ON s.id = ce.student_id
       LEFT JOIN training_groups tg ON tg.id = s.group_id
       WHERE ${whereClause}
       ORDER BY s.full_name ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    // Protect sensitive child data: mask IC in standard roster views
    const students = dataRes.rows.map((row) => ({
      ...row,
      ic_number: row.ic_number && row.ic_number.length > 4 ? `******-**-${row.ic_number.slice(-4)}` : '****',
    }));

    return res.json({
      students,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    console.error('[Class Students error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// PATCH /classes/:classId/settings — Update Permitted Class Settings
router.patch('/:classId/settings', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!(await assignedMasterAccess(req.user!, req.params.classId))) {
      return res.status(403).json({ error: 'You are not authorized to update this class settings.' });
    }

    const {
      venueDetails,
      contactChannel,
      operationalStatus,
      enrollmentAvailability,
      description,
      expectedVersion,
    } = req.body;

    if (expectedVersion !== undefined) {
      const vCheck = await dbClient.query('SELECT version FROM classes WHERE id = $1', [req.params.classId]);
      if (vCheck.rowCount && vCheck.rows[0].version !== expectedVersion) {
        return res.status(409).json({ error: 'Version conflict. Settings have been modified by another request.' });
      }
    }

    const updated = await dbClient.query(
      `UPDATE classes SET
         venue_details = COALESCE($1, venue_details),
         contact_channel = COALESCE($2, contact_channel),
         operational_status = COALESCE($3, operational_status),
         enrollment_availability = COALESCE($4, enrollment_availability),
         description = COALESCE($5, description),
         version = COALESCE(version, 1) + 1
       WHERE id = $6
       RETURNING *`,
      [
        venueDetails?.trim() ?? null,
        contactChannel?.trim() ?? null,
        operationalStatus?.trim() ?? null,
        enrollmentAvailability?.trim() ?? null,
        description?.trim() ?? null,
        req.params.classId,
      ]
    );

    if (!updated.rowCount) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId('audit'),
        'Class Settings Updated',
        `Class ${req.params.classId} settings updated by Master`,
        req.user!.role,
        req.user!.email,
      ]
    );

    return res.json({
      message: 'Class settings updated successfully',
      class: updated.rows[0],
    });
  } catch (err: any) {
    console.error('[Class Settings error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
