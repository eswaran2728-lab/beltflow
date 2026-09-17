import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { hashPasswordServer } from '../security/crypto';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Onboard new Organization / Persatuan (Super Admin only)
router.post('/', authenticateJWT, requirePermission(Permission.ORGANIZATION_CREATE), async (req: Request, res: Response) => {
  try {
    const { name, state, martialArtStyle, masterName, phone, email, password, baseMonthlyFee, siblingDiscountPercent } = req.body;

    if (!name || !masterName || !email || !password) {
      return res.status(400).json({ error: 'Name, masterName, email, and password are required.' });
    }

    const existingOrg = await dbClient.query('SELECT id FROM organizations WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existingOrg.rowCount > 0) {
      return res.status(400).json({ error: 'An academy with this email already exists in PostgreSQL.' });
    }

    const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const masterId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const baseFee = parseFloat(baseMonthlyFee) || 120.0;
    const siblingDisc = parseFloat(siblingDiscountPercent) || 10.0;
    const style = martialArtStyle?.trim() || 'Silambam';
    const stateVal = state?.trim() || 'Selangor';

    // Insert Organization
    const orgRes = await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, sibling_discount_percent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [orgId, name.trim(), stateVal, style, masterName.trim(), phone?.trim() || '', email.trim().toLowerCase(), baseFee, siblingDisc, 'ACTIVE']
    );

    // Insert Admin Persatuan User
    const masterPassHash = hashPasswordServer(password.trim());
    const adminRes = await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, organization_id, email, full_name, role, status`,
      [masterId, orgId, email.trim().toLowerCase(), masterPassHash, masterName.trim(), phone?.trim() || null, UserRole.ADMIN_PERSATUAN, 'ACTIVE']
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Organization Onboarded', `Super Admin created academy: ${name.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({
      message: 'Organization onboarded successfully in PostgreSQL database.',
      organization: orgRes.rows[0],
      admin: adminRes.rows[0]
    });
  } catch (err: any) {
    console.error('Organization onboarding error:', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// List all organizations (Super Admin)
router.get('/', authenticateJWT, requirePermission(Permission.SUPER_ADMIN_MANAGE), async (req: Request, res: Response) => {
  try {
    const listRes = await dbClient.query('SELECT * FROM organizations ORDER BY created_at DESC');
    return res.json({ organizations: listRes.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Get organization details (Tenant-scoped)
router.get('/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user?.organizationId || req.user.organizationId !== req.params.orgId) {
      return res.status(403).json({ error: 'Organization access denied.' });
    }
    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [req.params.orgId]);
    if (orgRes.rowCount === 0) return res.status(404).json({ error: 'Organization not found.' });
    return res.json({ organization: orgRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Update organization settings (Tenant-scoped)
router.put('/:orgId', authenticateJWT, requirePermission(Permission.PERSATUAN_EDIT_PROFILE), async (req: Request, res: Response) => {
  try {
    const { name, martialArtStyle, baseMonthlyFee, siblingDiscountPercent, phone } = req.body;
    const orgRes = await dbClient.query(
      `UPDATE organizations
       SET name = COALESCE($1, name),
           martial_art_style = COALESCE($2, martial_art_style),
           base_monthly_fee = COALESCE($3, base_monthly_fee),
           sibling_discount_percent = COALESCE($4, sibling_discount_percent),
           phone = COALESCE($5, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name || null, martialArtStyle || null, baseMonthlyFee || null, siblingDiscountPercent || null, phone || null, req.params.orgId]
    );

    if (orgRes.rowCount === 0) return res.status(404).json({ error: 'Organization not found.' });

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Organization Settings Updated', `Updated profile for organization ${req.params.orgId}`, req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Settings updated successfully.', organization: orgRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
