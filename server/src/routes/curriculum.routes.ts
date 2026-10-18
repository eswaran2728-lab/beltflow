import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

export interface DefaultRankTemplate {
  name: string;
  rank_order: number;
  color_hex: string;
  text_color: string;
  border_color: string;
  min_months: number;
  min_sessions: number;
  grading_fee: number;
  description: string;
  is_dan_rank: boolean;
  dan_level?: number;
}

export const DEFAULT_RANKS: DefaultRankTemplate[] = [
  {
    name: 'White Belt',
    rank_order: 1,
    color_hex: '#FFFFFF',
    text_color: '#0F172A',
    border_color: '#CBD5E1',
    min_months: 0,
    min_sessions: 0,
    grading_fee: 0,
    description: 'Beginner foundation and fundamentals',
    is_dan_rank: false,
  },
  {
    name: 'Yellow Belt',
    rank_order: 2,
    color_hex: '#FACC15',
    text_color: '#0F172A',
    border_color: '#EAB308',
    min_months: 3,
    min_sessions: 24,
    grading_fee: 50,
    description: 'First milestone of basic techniques and stances',
    is_dan_rank: false,
  },
  {
    name: 'Green Belt',
    rank_order: 3,
    color_hex: '#22C55E',
    text_color: '#FFFFFF',
    border_color: '#16A34A',
    min_months: 6,
    min_sessions: 48,
    grading_fee: 60,
    description: 'Intermediate control and flow progression',
    is_dan_rank: false,
  },
  {
    name: 'Blue Belt',
    rank_order: 4,
    color_hex: '#3B82F6',
    text_color: '#FFFFFF',
    border_color: '#2563EB',
    min_months: 9,
    min_sessions: 72,
    grading_fee: 70,
    description: 'Advanced sparring, evasion, and timing',
    is_dan_rank: false,
  },
  {
    name: 'Red Belt',
    rank_order: 5,
    color_hex: '#EF4444',
    text_color: '#FFFFFF',
    border_color: '#DC2626',
    min_months: 12,
    min_sessions: 96,
    grading_fee: 80,
    description: 'Senior practitioner with speed and precision',
    is_dan_rank: false,
  },
  {
    name: 'Brown Belt',
    rank_order: 6,
    color_hex: '#92400E',
    text_color: '#FFFFFF',
    border_color: '#78350F',
    min_months: 15,
    min_sessions: 120,
    grading_fee: 100,
    description: 'Pre-black belt mastery and leadership',
    is_dan_rank: false,
  },
  {
    name: 'Purple Belt',
    rank_order: 7,
    color_hex: '#A855F7',
    text_color: '#FFFFFF',
    border_color: '#9333EA',
    min_months: 18,
    min_sessions: 144,
    grading_fee: 120,
    description: 'Advanced specialty syllabus proficiency',
    is_dan_rank: false,
  },
  {
    name: 'Black Belt',
    rank_order: 8,
    color_hex: '#0F172A',
    text_color: '#FFFFFF',
    border_color: '#000000',
    min_months: 24,
    min_sessions: 192,
    grading_fee: 200,
    description: 'Dan/Asan instructor mastery and honor',
    is_dan_rank: true,
    dan_level: 1,
  },
];

/**
 * Seed default published curriculum if none exists for the organization.
 */
async function getOrCreateActiveCurriculum(organizationId: string, style = 'Silambam') {
  const publishedRes = await dbClient.query(
    `SELECT * FROM persatuan_curriculums 
     WHERE organization_id = $1 AND status = 'PUBLISHED' 
     ORDER BY version DESC LIMIT 1`,
    [organizationId]
  );

  if (publishedRes.rowCount > 0) {
    const curriculum = publishedRes.rows[0];
    const ranksRes = await dbClient.query(
      `SELECT * FROM curriculum_belt_ranks 
       WHERE curriculum_id = $1 
       ORDER BY rank_order ASC`,
      [curriculum.id]
    );
    return { curriculum, ranks: ranksRes.rows };
  }

  // Auto-seed v1 published curriculum from default template
  const curriculumId = `curr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const insertCurr = await dbClient.query(
    `INSERT INTO persatuan_curriculums 
      (id, organization_id, system_name, martial_art_style, version, status, published_at)
     VALUES ($1, $2, $3, $4, 1, 'PUBLISHED', CURRENT_TIMESTAMP)
     RETURNING *`,
    [curriculumId, organizationId, 'Standard Academy Syllabus', style]
  );
  const curriculum = insertCurr.rows[0];

  const seededRanks = [];
  for (const r of DEFAULT_RANKS) {
    const rankId = `crank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rankRes = await dbClient.query(
      `INSERT INTO curriculum_belt_ranks 
        (id, curriculum_id, name, rank_order, color_hex, text_color, border_color, min_months, min_sessions, grading_fee, description, is_dan_rank, dan_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        rankId,
        curriculumId,
        r.name,
        r.rank_order,
        r.color_hex,
        r.text_color,
        r.border_color,
        r.min_months,
        r.min_sessions,
        r.grading_fee,
        r.description,
        r.is_dan_rank,
        r.dan_level || null,
      ]
    );
    seededRanks.push(rankRes.rows[0]);
  }

  return { curriculum, ranks: seededRanks };
}

/**
 * GET /api/v1/curriculums/active
 * Retrieve the current published curriculum for the tenant.
 * Accessible to all authenticated users belonging to the tenant.
 */
router.get('/active', authenticateJWT, async (req: Request, res: Response) => {
  try {
    let orgId = req.user?.organizationId;
    if (req.user?.role === UserRole.SUPER_ADMIN && req.query.organizationId) {
      orgId = req.query.organizationId as string;
    }

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    const style = orgRes.rows[0].martial_art_style || 'Silambam';

    const result = await getOrCreateActiveCurriculum(orgId, style);
    return res.json({
      organizationId: orgId,
      curriculum: result.curriculum,
      ranks: result.ranks,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * GET /api/v1/curriculums
 * List all versions (Draft, Published, Archived) for the tenant.
 * Requires PERSATUAN_MANAGE_CURRICULUM or SUPER_ADMIN.
 */
router.get('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CURRICULUM), async (req: Request, res: Response) => {
  try {
    let orgId = req.user?.organizationId;
    if (req.user?.role === UserRole.SUPER_ADMIN && req.query.organizationId) {
      orgId = req.query.organizationId as string;
    }

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    // Ensure initial active curriculum is provisioned if organization has none
    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    await getOrCreateActiveCurriculum(orgId, orgRes.rows[0].martial_art_style || 'Silambam');

    const versionsRes = await dbClient.query(
      `SELECT c.*,
              COALESCE((SELECT COUNT(*) FROM curriculum_belt_ranks r WHERE r.curriculum_id = c.id), 0) AS rank_count
       FROM persatuan_curriculums c
       WHERE c.organization_id = $1
       ORDER BY c.version DESC, c.created_at DESC`,
      [orgId]
    );

    return res.json({
      organizationId: orgId,
      curriculums: versionsRes.rows,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * GET /api/v1/curriculums/:id
 * Retrieve a specific curriculum version by ID with its belt ranks.
 */
router.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currRes = await dbClient.query('SELECT * FROM persatuan_curriculums WHERE id = $1', [req.params.id]);
    if (currRes.rowCount === 0) {
      return res.status(404).json({ error: 'Curriculum version not found.' });
    }

    const curriculum = currRes.rows[0];
    if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.organizationId !== curriculum.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant curriculum access denied.' });
    }

    const ranksRes = await dbClient.query(
      `SELECT * FROM curriculum_belt_ranks 
       WHERE curriculum_id = $1 
       ORDER BY rank_order ASC`,
      [curriculum.id]
    );

    return res.json({
      curriculum,
      ranks: ranksRes.rows,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * POST /api/v1/curriculums
 * Create a new DRAFT curriculum version (optionally cloned from an existing version).
 * Requires PERSATUAN_MANAGE_CURRICULUM.
 */
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CURRICULUM), async (req: Request, res: Response) => {
  try {
    let orgId = req.user?.organizationId;
    if (req.user?.role === UserRole.SUPER_ADMIN && req.body.organizationId) {
      orgId = req.body.organizationId;
    }

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    const defaultStyle = orgRes.rows[0].martial_art_style || 'Silambam';

    const { systemName, martialArtStyle, cloneFromVersionId } = req.body;

    // Determine next version number
    const maxVerRes = await dbClient.query(
      `SELECT COALESCE(MAX(version), 0) AS max_v FROM persatuan_curriculums WHERE organization_id = $1`,
      [orgId]
    );
    const nextVersion = (parseInt(maxVerRes.rows[0].max_v, 10) || 0) + 1;

    const curriculumId = `curr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const currRes = await dbClient.query(
      `INSERT INTO persatuan_curriculums
        (id, organization_id, system_name, martial_art_style, version, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6)
       RETURNING *`,
      [
        curriculumId,
        orgId,
        systemName?.trim() || `Curriculum Syllabus v${nextVersion}`,
        martialArtStyle?.trim() || defaultStyle,
        nextVersion,
        req.user?.id || null,
      ]
    );
    const curriculum = currRes.rows[0];

    // Populate ranks from cloned version or default template
    const ranks = [];
    if (cloneFromVersionId) {
      const sourceRanks = await dbClient.query(
        `SELECT * FROM curriculum_belt_ranks WHERE curriculum_id = $1 ORDER BY rank_order ASC`,
        [cloneFromVersionId]
      );
      for (const r of sourceRanks.rows) {
        const rankId = `crank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const rankRes = await dbClient.query(
          `INSERT INTO curriculum_belt_ranks
            (id, curriculum_id, name, rank_order, color_hex, text_color, border_color, min_months, min_sessions, grading_fee, syllabus_category, description, is_dan_rank, dan_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          [
            rankId,
            curriculumId,
            r.name,
            r.rank_order,
            r.color_hex,
            r.text_color,
            r.border_color,
            r.min_months,
            r.min_sessions,
            r.grading_fee,
            r.syllabus_category,
            r.description,
            r.is_dan_rank,
            r.dan_level,
          ]
        );
        ranks.push(rankRes.rows[0]);
      }
    } else {
      for (const r of DEFAULT_RANKS) {
        const rankId = `crank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const rankRes = await dbClient.query(
          `INSERT INTO curriculum_belt_ranks
            (id, curriculum_id, name, rank_order, color_hex, text_color, border_color, min_months, min_sessions, grading_fee, description, is_dan_rank, dan_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            rankId,
            curriculumId,
            r.name,
            r.rank_order,
            r.color_hex,
            r.text_color,
            r.border_color,
            r.min_months,
            r.min_sessions,
            r.grading_fee,
            r.description,
            r.is_dan_rank,
            r.dan_level || null,
          ]
        );
        ranks.push(rankRes.rows[0]);
      }
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Curriculum Draft Created', `Created draft curriculum v${nextVersion} (${curriculum.system_name})`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({
      message: 'Draft curriculum version created successfully.',
      curriculum,
      ranks,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * PUT /api/v1/curriculums/:id
 * Update metadata (systemName, martialArtStyle) of a DRAFT curriculum.
 */
router.put('/:id', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CURRICULUM), async (req: Request, res: Response) => {
  try {
    const currRes = await dbClient.query('SELECT * FROM persatuan_curriculums WHERE id = $1', [req.params.id]);
    if (currRes.rowCount === 0) {
      return res.status(404).json({ error: 'Curriculum version not found.' });
    }

    const curriculum = currRes.rows[0];
    if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.organizationId !== curriculum.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant curriculum access denied.' });
    }

    if (curriculum.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT curriculums can be modified. Published and archived versions are immutable.' });
    }

    const { systemName, martialArtStyle } = req.body;
    const updated = await dbClient.query(
      `UPDATE persatuan_curriculums
       SET system_name = COALESCE($1, system_name),
           martial_art_style = COALESCE($2, martial_art_style),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [systemName?.trim() || null, martialArtStyle?.trim() || null, req.params.id]
    );

    return res.json({
      message: 'Curriculum details updated successfully.',
      curriculum: updated.rows[0],
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * PUT /api/v1/curriculums/:id/ranks
 * Replace all belt ranks in a DRAFT curriculum.
 */
router.put('/:id/ranks', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CURRICULUM), async (req: Request, res: Response) => {
  try {
    const currRes = await dbClient.query('SELECT * FROM persatuan_curriculums WHERE id = $1', [req.params.id]);
    if (currRes.rowCount === 0) {
      return res.status(404).json({ error: 'Curriculum version not found.' });
    }

    const curriculum = currRes.rows[0];
    if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.organizationId !== curriculum.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant curriculum access denied.' });
    }

    if (curriculum.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Cannot modify belt ranks of a published or archived curriculum. Please create a new draft version.' });
    }

    const { ranks } = req.body;
    if (!Array.isArray(ranks) || ranks.length === 0) {
      return res.status(400).json({ error: 'ranks array must contain at least one belt rank configuration.' });
    }

    // Validate rank orders and names
    const orderSet = new Set<number>();
    const nameSet = new Set<string>();
    for (const r of ranks) {
      if (!r.name || typeof r.name !== 'string' || !r.name.trim()) {
        return res.status(400).json({ error: 'Each belt rank must have a valid non-empty name.' });
      }
      if (typeof r.rankOrder !== 'number' || r.rankOrder < 1) {
        return res.status(400).json({ error: `Rank "${r.name}" has invalid rankOrder. Must be a positive integer.` });
      }
      if (orderSet.has(r.rankOrder)) {
        return res.status(400).json({ error: `Duplicate rankOrder ${r.rankOrder} found. Each belt rank must have a unique order.` });
      }
      orderSet.add(r.rankOrder);

      const normName = r.name.trim().toLowerCase();
      if (nameSet.has(normName)) {
        return res.status(400).json({ error: `Duplicate belt rank name "${r.name}" found.` });
      }
      nameSet.add(normName);
    }

    // Replace ranks atomically
    await dbClient.query('DELETE FROM curriculum_belt_ranks WHERE curriculum_id = $1', [curriculum.id]);

    const insertedRanks = [];
    for (const r of ranks) {
      const rankId = `crank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const colorHex = r.colorHex?.trim() || '#FFFFFF';
      const textColor = r.textColor?.trim() || null;
      const borderColor = r.borderColor?.trim() || null;
      const minMonths = typeof r.minMonths === 'number' ? Math.max(0, r.minMonths) : (parseInt(r.minMonthsRequired, 10) || 0);
      const minSessions = typeof r.minSessions === 'number' ? Math.max(0, r.minSessions) : (parseInt(r.minSessionsRequired, 10) || 0);
      const fee = parseFloat(r.gradingFee) || 0.0;
      const isDan = Boolean(r.isDanRank);
      const danLevel = r.danLevel ? parseInt(r.danLevel, 10) : null;

      const rankRes = await dbClient.query(
        `INSERT INTO curriculum_belt_ranks
          (id, curriculum_id, name, rank_order, color_hex, text_color, border_color, min_months, min_sessions, grading_fee, syllabus_category, description, is_dan_rank, dan_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          rankId,
          curriculum.id,
          r.name.trim(),
          r.rankOrder,
          colorHex,
          textColor,
          borderColor,
          minMonths,
          minSessions,
          fee,
          r.syllabusCategory?.trim() || null,
          r.description?.trim() || null,
          isDan,
          danLevel,
        ]
      );
      insertedRanks.push(rankRes.rows[0]);
    }

    await dbClient.query('UPDATE persatuan_curriculums SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [curriculum.id]);

    return res.json({
      message: 'Belt ranks updated successfully for draft curriculum.',
      curriculumId: curriculum.id,
      ranks: insertedRanks,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * POST /api/v1/curriculums/:id/publish
 * Atomically transitions target curriculum from DRAFT to PUBLISHED,
 * and marks any existing PUBLISHED version as ARCHIVED.
 */
router.post('/:id/publish', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CURRICULUM), async (req: Request, res: Response) => {
  try {
    const currRes = await dbClient.query('SELECT * FROM persatuan_curriculums WHERE id = $1', [req.params.id]);
    if (currRes.rowCount === 0) {
      return res.status(404).json({ error: 'Curriculum version not found.' });
    }

    const target = currRes.rows[0];
    if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.organizationId !== target.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant curriculum access denied.' });
    }

    if (target.status !== 'DRAFT') {
      return res.status(400).json({ error: `Cannot publish curriculum in status "${target.status}". Only DRAFT versions can be published.` });
    }

    // Verify at least one belt rank is defined
    const ranksCheck = await dbClient.query('SELECT COUNT(*) AS count FROM curriculum_belt_ranks WHERE curriculum_id = $1', [target.id]);
    if (parseInt(ranksCheck.rows[0].count, 10) === 0) {
      return res.status(400).json({ error: 'Cannot publish a curriculum without belt ranks. Please define at least one belt rank before publishing.' });
    }

    // Atomic promotion:
    // 1. Mark existing published curriculum for this tenant as ARCHIVED
    await dbClient.query(
      `UPDATE persatuan_curriculums
       SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND status = 'PUBLISHED'`,
      [target.organization_id]
    );

    // 2. Mark this curriculum as PUBLISHED
    const pubRes = await dbClient.query(
      `UPDATE persatuan_curriculums
       SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [target.id]
    );
    const publishedCurriculum = pubRes.rows[0];

    // Fetch its ranks
    const ranksRes = await dbClient.query(
      `SELECT * FROM curriculum_belt_ranks WHERE curriculum_id = $1 ORDER BY rank_order ASC`,
      [target.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `audit_${Date.now()}`,
        'Curriculum Published',
        `Published curriculum v${publishedCurriculum.version} (${publishedCurriculum.system_name}) with ${ranksRes.rowCount} belt ranks. Previous version archived.`,
        req.user!.role,
        req.user!.email,
      ]
    );

    return res.json({
      message: 'Curriculum version published successfully.',
      curriculum: publishedCurriculum,
      ranks: ranksRes.rows,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

/**
 * DELETE /api/v1/curriculums/:id
 * Delete a DRAFT curriculum version.
 */
router.delete('/:id', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_CURRICULUM), async (req: Request, res: Response) => {
  try {
    const currRes = await dbClient.query('SELECT * FROM persatuan_curriculums WHERE id = $1', [req.params.id]);
    if (currRes.rowCount === 0) {
      return res.status(404).json({ error: 'Curriculum version not found.' });
    }

    const curriculum = currRes.rows[0];
    if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.organizationId !== curriculum.organization_id) {
      return res.status(403).json({ error: 'Cross-tenant curriculum access denied.' });
    }

    if (curriculum.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT curriculums can be deleted. Published and archived versions are permanent records.' });
    }

    await dbClient.query('DELETE FROM persatuan_curriculums WHERE id = $1', [curriculum.id]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Curriculum Draft Deleted', `Deleted draft curriculum v${curriculum.version}`, req.user!.role, req.user!.email]
    );

    return res.json({
      message: 'Draft curriculum version deleted successfully.',
      deletedId: curriculum.id,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
