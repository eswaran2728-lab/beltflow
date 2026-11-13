import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';
import {
  RELEASE_MODULES,
  clearTenantModuleCache,
  getTenantModuleSettings,
  isModuleEnabled,
  isModuleEnabledForTenant,
  releaseInfoFor,
} from '../release/modules';

/**
 * Release modules. GET /modules is public; with a signed-in caller it returns
 * that caller's Persatuan's effective modules. Per-Persatuan settings are
 * Super Admin only (platform rollout governance; no child data involved).
 */
const router = Router();

router.get('/modules', async (req: Request, res: Response) => {
  try {
    return res.json(await releaseInfoFor(req));
  } catch (err: any) {
    console.error('[Release modules error]', err);
    return res.status(500).json({ error: 'Failed to load modules.', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

function superAdminOnly(req: Request, res: Response): boolean {
  if (req.user?.role !== UserRole.SUPER_ADMIN) {
    res.status(403).json({ error: 'Only a Super Admin can manage feature rollout per Persatuan.' });
    return false;
  }
  return true;
}

async function orgExists(orgId: string): Promise<boolean> {
  const r = await dbClient.query(`SELECT id FROM organizations WHERE id = $1`, [orgId]);
  return r.rows.length > 0;
}

router.get('/tenants/:orgId/modules', authenticateJWT, async (req: Request, res: Response) => {
  if (!superAdminOnly(req, res)) return;
  try {
    if (!(await orgExists(req.params.orgId))) return res.status(404).json({ error: 'Persatuan not found.' });
    const settings = await getTenantModuleSettings(req.params.orgId);
    return res.json({
      organizationId: req.params.orgId,
      modules: RELEASE_MODULES.map(m => ({
        key: m.key,
        title: m.title,
        release: m.release,
        platformEnabled: isModuleEnabled(m.key),
        setting: settings[m.key] ?? 'INHERIT',
        effective: isModuleEnabledForTenant(m.key, settings[m.key]),
      })),
    });
  } catch (err: any) {
    console.error('[Tenant modules list error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.put('/tenants/:orgId/modules/:key', authenticateJWT, async (req: Request, res: Response) => {
  if (!superAdminOnly(req, res)) return;
  const { orgId, key } = req.params;
  const setting = String(req.body?.setting || '').toUpperCase();
  if (!RELEASE_MODULES.some(m => m.key === key)) {
    return res.status(400).json({ error: 'Only optional release modules can be set per Persatuan; core features are always on.' });
  }
  if (!['ON', 'OFF', 'INHERIT'].includes(setting)) {
    return res.status(400).json({ error: 'setting must be ON, OFF or INHERIT.' });
  }
  try {
    if (!(await orgExists(orgId))) return res.status(404).json({ error: 'Persatuan not found.' });
    if (setting === 'INHERIT') {
      await dbClient.query(`DELETE FROM organization_module_settings WHERE organization_id = $1 AND module_key = $2`, [orgId, key]);
    } else {
      await dbClient.query(
        `INSERT INTO organization_module_settings (organization_id, module_key, setting, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (organization_id, module_key) DO UPDATE
           SET setting = EXCLUDED.setting, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [orgId, key, setting, req.user!.id]);
    }
    clearTenantModuleCache(orgId);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, 'Tenant Module Setting Changed',
       `Persatuan ${orgId}: module ${key} set to ${setting}`, req.user!.role, req.user!.email]);
    const settings = await getTenantModuleSettings(orgId);
    return res.json({ organizationId: orgId, key, setting, effective: isModuleEnabledForTenant(key, settings[key]) });
  } catch (err: any) {
    console.error('[Tenant module update error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
