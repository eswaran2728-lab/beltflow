import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { hashPasswordServer } from '../security/crypto';
import { authenticateJWT, requirePermission } from '../middleware/auth';

const router = Router();

// Register new Coach / Master under an organization
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_COACHES), async (req: Request, res: Response) => {
  try {
    const { organizationId, fullName, email, phone, password, credentialLevel, assignedClassId } = req.body;
    if (!organizationId || !fullName || !email || !password) {
      return res.status(400).json({ error: 'organizationId, fullName, email, and password are required.' });
    }

    const orgId = req.user!.organizationId || organizationId;
    if (assignedClassId) {
      const cls = await dbClient.query('SELECT id FROM classes WHERE id = $1 AND organization_id = $2', [assignedClassId, orgId]);
      if (!cls.rowCount) return res.status(400).json({ error: 'Class must belong to this organization.' });
    }
    const existing = await dbClient.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'A user with this email already exists in PostgreSQL.' });
    }

    const coachId = `usr_coach_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passHash = hashPasswordServer(password.trim());

    const insertRes = await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status, credential_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, organization_id, email, full_name, full_name as "fullName", phone, role, status, credential_level, created_at`,
      [coachId, orgId, email.trim().toLowerCase(), passHash, fullName.trim(), phone?.trim() || null, UserRole.MASTER, 'ACTIVE', credentialLevel?.trim() || null]
    );

    if (assignedClassId) {
      await dbClient.query(
        `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [coachId, assignedClassId, false]
      );
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Coach Registered', `Registered instructor ${fullName.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Coach registered successfully in PostgreSQL.', coach: insertRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// List coaches for organization
router.get('/organization/:orgId', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_COACHES), async (req: Request, res: Response) => {
  try {
    const listRes = await dbClient.query(
      `SELECT id, organization_id, email, full_name, full_name as "fullName", phone, role, status, credential_level, created_at
       FROM users
       WHERE organization_id = $1 AND (role = 'MASTER' OR role = 'ADMIN_PERSATUAN')
       ORDER BY created_at DESC`,
      [req.params.orgId]
    );
    return res.json({ coaches: listRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: err.message });
  }
});

export default router;
