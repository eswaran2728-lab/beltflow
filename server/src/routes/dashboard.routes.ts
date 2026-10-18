import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { UserRole } from '../security/rbac';
import { authenticateJWT } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// GET /dashboard/master — Operational Today Dashboard for Master
router.get('/master', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Master role required.' });
    }

    const orgId = req.user.organizationId;
    if (!orgId) {
      return res.status(403).json({ error: 'Organization context missing.' });
    }

    // Affiliation check: pending or suspended Masters must not access operational data
    const statusCheck = await dbClient.query(
      `SELECT status FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, orgId]
    );
    if (statusCheck.rowCount > 0 && statusCheck.rows[0].status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Your Master affiliation is pending or suspended. Operational dashboard is unavailable.',
      });
    }

    // Application check
    const appCheck = await dbClient.query(
      `SELECT status FROM master_applications WHERE user_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, orgId]
    );
    if (appCheck.rowCount > 0 && appCheck.rows[0].status !== 'APPROVED') {
      return res.status(403).json({
        error: 'Your Master registration is not approved. Operational dashboard is unavailable.',
      });
    }

    // Find all classes actively led by this Master
    const leadRes = await dbClient.query(
      `SELECT DISTINCT c.id, c.name, c.schedule, c.location, c.capacity, c.operational_status, c.enrollment_availability
       FROM classes c
       LEFT JOIN class_leaderships cl ON cl.class_id = c.id AND cl.master_id = $1 AND cl.is_active = TRUE
       LEFT JOIN coach_class_assignments cca ON cca.class_id = c.id AND cca.coach_id = $1 AND cca.is_main_master = TRUE
       WHERE c.organization_id = $2
         AND (cl.id IS NOT NULL OR cca.coach_id IS NOT NULL OR c.master_id = $1 OR c.id = ANY($3::text[]))`,
      [req.user.id, orgId, req.user.assignedClassIds || []]
    );

    const classIds = leadRes.rows.map((c) => c.id);

    // Count pending proposals (classes awaiting approval)
    const propCountRes = await dbClient.query(
      `SELECT COUNT(*)::int AS count
       FROM class_applications
       WHERE proposing_master_id = $1 AND status IN ('DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION')`,
      [req.user.id]
    );
    const pendingProposalsCount = propCountRes.rows[0]?.count || 0;

    // If Master has no approved classes, return onboarding state
    if (classIds.length === 0) {
      return res.json({
        hasApprovedClasses: false,
        onboarding: {
          message: 'Welcome Master! You currently have no approved classes. You can propose a new class to your Persatuan.',
          action: 'PROPOSE_CLASS',
        },
        todayClasses: [],
        todaySessions: [],
        activeStudentCount: 0,
        pendingApplicationsCount: 0,
        pendingProposalsCount,
        recentNotices: [],
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    // Today's sessions
    const todaySessionsRes = await dbClient.query(
      `SELECT ts.*, c.name AS class_name, tg.name AS group_name
       FROM training_sessions ts
       JOIN classes c ON c.id = ts.class_id
       LEFT JOIN training_groups tg ON tg.id = ts.group_id
       WHERE ts.class_id = ANY($1::text[]) AND (ts.session_date = CURRENT_DATE::text OR ts.session_date = $2)
       ORDER BY ts.start_time ASC`,
      [classIds, todayStr]
    );

    // Active students count across all led classes
    const activeStudentsRes = await dbClient.query(
      `SELECT COUNT(DISTINCT student_id)::int AS count
       FROM class_enrollments
       WHERE class_id = ANY($1::text[]) AND status = 'ACTIVE'`,
      [classIds]
    );
    const activeStudentCount = activeStudentsRes.rows[0]?.count || 0;

    // Pending applications count across all led classes
    const pendingAppsRes = await dbClient.query(
      `SELECT COUNT(*)::int AS count
       FROM enrollment_applications
       WHERE class_id = ANY($1::text[]) AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION')`,
      [classIds]
    );
    const pendingApplicationsCount = pendingAppsRes.rows[0]?.count || 0;

    // Recent notices
    const noticesRes = await dbClient.query(
      `SELECT * FROM notices
       WHERE (class_id = ANY($1::text[]) OR (class_id IS NULL AND organization_id = $2))
       ORDER BY created_at DESC
       LIMIT 5`,
      [classIds, orgId]
    );

    return res.json({
      hasApprovedClasses: true,
      todayClasses: leadRes.rows,
      todaySessions: todaySessionsRes.rows,
      activeStudentCount,
      pendingApplicationsCount,
      pendingProposalsCount,
      recentNotices: noticesRes.rows,
    });
  } catch (err: any) {
    console.error('[Dashboard Master error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
