/**
 * H26 assistant routes.
 *
 *   POST /api/v1/assistant/ask                         all five roles, read-only
 *   GET  /api/v1/assistant/knowledge-sources           Admin Persatuan (own org) / Super Admin (platform)
 *   POST /api/v1/assistant/knowledge-sources           create a DRAFT source
 *   POST /api/v1/assistant/knowledge-sources/:id/publish
 *   POST /api/v1/assistant/knowledge-sources/:id/revoke
 *
 * The actor is always req.user (set by authenticateJWT). Role, tenant or
 * user fields in the request body are ignored.
 */
import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { answerAuthorizedQuestion, AssistantContext, AssistantError, isAssistantEnabled } from '../assistant';

const router = Router();

const ALL_ROLES = Object.values(UserRole) as string[];
const ORG_AUDIENCE = [UserRole.ADMIN_PERSATUAN, UserRole.MASTER, UserRole.PARENT, UserRole.STUDENT] as string[];

// Second line of defence: app.ts already wraps this router in moduleGate('assistant').
function featureGate(_req: Request, res: Response, next: NextFunction) {
  if (!isAssistantEnabled()) {
    return res.status(404).json({ error: 'This feature is not enabled.', code: 'MODULE_DISABLED', module: 'assistant' });
  }
  next();
}

const shortString = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : undefined);

/** Accepts only known context keys; everything else in the body is ignored. */
function readContext(raw: any): AssistantContext {
  const ctx = raw && typeof raw === 'object' ? raw : {};
  return {
    studentId: shortString(ctx.studentId),
    classId: shortString(ctx.classId),
    organizationId: shortString(ctx.organizationId),
    locale: ['en', 'ms', 'ta'].includes(ctx.locale) ? ctx.locale : undefined,
  };
}

function sendError(res: Response, err: unknown) {
  if (err instanceof AssistantError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error('[Assistant route error]', err instanceof Error ? err.message : err);
  return res.status(500).json({ error: 'The assistant could not answer right now.', code: 'ASSISTANT_ERROR' });
}

router.use(featureGate);

router.post('/ask', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await answerAuthorizedQuestion(req.user!, req.body?.query, readContext(req.body?.context));
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// ------------------------------------------------ knowledge-source registry

function registryOwner(req: Request): { orgId: string | null } {
  const user = req.user!;
  if (user.role === UserRole.SUPER_ADMIN) return { orgId: null };
  if (user.role === UserRole.ADMIN_PERSATUAN && user.organizationId) return { orgId: user.organizationId };
  throw new AssistantError(403, 'REGISTRY_FORBIDDEN', 'Only Persatuan admins and Super Admin can manage assistant knowledge sources.');
}

async function audit(db: { query: typeof dbClient.query }, req: Request, action: string, details: string) {
  await db.query(
    `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
    [`audit_${crypto.randomUUID()}`, action, details, req.user!.role, req.user!.email]);
}

router.get('/knowledge-sources', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { orgId } = registryOwner(req);
    const rows = await dbClient.query(
      `SELECT id, organization_id, title, audience_roles, status, version, published_at, revoked_at, created_at
       FROM ai_knowledge_sources WHERE organization_id IS NOT DISTINCT FROM $1 ORDER BY created_at DESC`, [orgId]);
    return res.json({ sources: rows.rows });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/knowledge-sources', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { orgId } = registryOwner(req);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const roles: unknown = req.body?.audienceRoles;
    if (!title || title.length > 255) throw new AssistantError(400, 'INVALID_TITLE', 'Title is required (max 255 characters).');
    if (!body || body.length > 20_000) throw new AssistantError(400, 'INVALID_BODY', 'Body is required (max 20,000 characters).');
    const allowed = orgId ? ORG_AUDIENCE : ALL_ROLES;
    if (!Array.isArray(roles) || roles.length === 0 || roles.some(r => !allowed.includes(String(r)))) {
      throw new AssistantError(400, 'INVALID_AUDIENCE', `audienceRoles must be a non-empty list of: ${allowed.join(', ')}.`);
    }
    const id = `kb_${crypto.randomUUID()}`;
    // Source row and audit row are written together or not at all.
    const created = await dbClient.transaction(async tx => {
      const row = await tx.query(
      `INSERT INTO ai_knowledge_sources (id, organization_id, title, body, audience_roles, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6)
       RETURNING id, organization_id, title, audience_roles, status, version, created_at`,
      [id, orgId, title, body, Array.from(new Set(roles.map(String))), req.user!.id]);
      await audit(tx, req, 'AI Knowledge Source Drafted', `Drafted assistant knowledge source ${id}`);
      return row;
    });
    return res.status(201).json({ source: created.rows[0] });
  } catch (err) {
    return sendError(res, err);
  }
});

async function changeStatus(req: Request, res: Response, target: 'PUBLISHED' | 'REVOKED') {
  try {
    const { orgId } = registryOwner(req);
    const fromStatuses = target === 'PUBLISHED' ? ['DRAFT'] : ['DRAFT', 'PUBLISHED'];
    const updated = await dbClient.transaction(async tx => {
      const row = await tx.query(
      `UPDATE ai_knowledge_sources
       SET status = $1::varchar, updated_at = CURRENT_TIMESTAMP,
           published_at = CASE WHEN $1::varchar = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE published_at END,
           revoked_at = CASE WHEN $1::varchar = 'REVOKED' THEN CURRENT_TIMESTAMP ELSE revoked_at END
       WHERE id = $2 AND organization_id IS NOT DISTINCT FROM $3 AND status = ANY($4)
       RETURNING id, organization_id, title, audience_roles, status, version, published_at, revoked_at`,
      [target, req.params.id, orgId, fromStatuses]);
      if (row.rowCount === 0) {
        throw new AssistantError(404, 'SOURCE_NOT_FOUND', 'Knowledge source not found in your scope, or not in a state that allows this change.');
      }
      await audit(tx, req, target === 'PUBLISHED' ? 'AI Knowledge Source Published' : 'AI Knowledge Source Revoked', `Source ${req.params.id}`);
      return row;
    });
    return res.json({ source: updated.rows[0] });
  } catch (err) {
    return sendError(res, err);
  }
}

router.post('/knowledge-sources/:id/publish', authenticateJWT, (req, res) => changeStatus(req, res, 'PUBLISHED'));
router.post('/knowledge-sources/:id/revoke', authenticateJWT, (req, res) => changeStatus(req, res, 'REVOKED'));

export default router;
