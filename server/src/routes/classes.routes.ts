import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { hashPasswordServer } from '../security/crypto';
import { validatePassword } from '../security/passwordPolicy';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

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

    const classRes = await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [classId, orgId, masterId, effectiveMainMasterId, name.trim(), schedule?.trim() || 'Mon & Wed 7:00 PM - 8:30 PM', location?.trim() || 'Mat A', 'ACTIVE']
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
