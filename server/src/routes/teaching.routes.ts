import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Helper: Check if user is an authorized master for a class
async function verifyMasterClassAccess(user: any, classId: string, orgId: string): Promise<boolean> {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if (user.role === UserRole.ADMIN_PERSATUAN) {
    return user.organizationId === orgId;
  }
  if (user.role !== UserRole.MASTER) return false;

  // Check direct assignment in JWT
  if (user.assignedClassIds && user.assignedClassIds.includes(classId)) {
    return true;
  }

  // Check database class leadership or assignment
  const check = await dbClient.query(
    `SELECT 1 FROM class_leaderships
     WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE
     UNION
     SELECT 1 FROM coach_class_assignments
     WHERE class_id = $1 AND coach_id = $2
     UNION
     SELECT 1 FROM classes
     WHERE id = $1 AND (master_id = $2 OR main_master_id = $2)`,
    [classId, user.id]
  );
  return check.rowCount! > 0;
}

// ----------------------------------------------------------------------------
// 1. Save / Update Lesson Plan (saveLessonPlan)
// Enforces: lesson_edit_version_conflict (Optimistic concurrency)
// ----------------------------------------------------------------------------
router.put('/sessions/:sessionId/lesson-plan', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;
    const {
      title,
      objectives,
      drills,
      equipment,
      coveredMaterial,
      privateMasterNotes,
      expectedVersion,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Lesson plan title is required.' });
    }

    // Verify session existence
    const sessionRes = await dbClient.query(
      `SELECT s.*, c.organization_id AS class_org_id
       FROM training_sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ error: 'Training session not found.' });
    }
    const session = sessionRes.rows[0];

    // Authorization: Master assigned to class or Admin Persatuan
    const hasAccess = await verifyMasterClassAccess(user, session.class_id, session.organization_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to instruct this class session.' });
    }

    // Normalized data
    const drillsJson = Array.isArray(drills) ? JSON.stringify(drills) : '[]';
    const equipmentArr = Array.isArray(equipment) ? equipment : [];

    const result = await dbClient.transaction(async (tx) => {
      // Check existing lesson plan
      const existingRes = await tx.query(
        'SELECT * FROM lesson_plans WHERE session_id = $1 FOR UPDATE',
        [sessionId]
      );

      if (existingRes.rowCount! > 0) {
        const existing = existingRes.rows[0];

        // Enforce Optimistic Concurrency (lesson_edit_version_conflict)
        if (expectedVersion !== undefined && expectedVersion !== null) {
          const expected = Number(expectedVersion);
          if (existing.version !== expected) {
            const err: any = new Error(
              `Version conflict: Lesson plan has been modified by another user (expected version ${expected}, current version ${existing.version}).`
            );
            err.statusCode = 409;
            err.currentVersion = existing.version;
            throw err;
          }
        }

        const updateRes = await tx.query(
          `UPDATE lesson_plans
           SET title = $1,
               objectives = $2,
               drills = $3,
               equipment = $4,
               covered_material = $5,
               private_master_notes = $6,
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING *`,
          [
            title.trim(),
            objectives || '',
            drillsJson,
            equipmentArr,
            coveredMaterial || '',
            privateMasterNotes || '',
            existing.id,
          ]
        );

        return updateRes.rows[0];
      } else {
        // Create initial lesson plan
        const newPlanId = newId('lp');
        const insertRes = await tx.query(
          `INSERT INTO lesson_plans (
             id, session_id, organization_id, class_id, author_master_id,
             title, objectives, drills, equipment, covered_material,
             private_master_notes, version, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            newPlanId,
            sessionId,
            session.organization_id,
            session.class_id,
            user.id,
            title.trim(),
            objectives || '',
            drillsJson,
            equipmentArr,
            coveredMaterial || '',
            privateMasterNotes || '',
          ]
        );

        return insertRes.rows[0];
      }
    });

    return res.json({
      message: 'Lesson plan saved successfully.',
      lessonPlan: result,
    });
  } catch (err: any) {
    console.error('[Save lesson plan error]', err);
    if (err?.statusCode) {
      return res.status(err.statusCode).json({
        error: err.message,
        currentVersion: err.currentVersion,
      });
    }
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to save lesson plan.') });
  }
});

// ----------------------------------------------------------------------------
// 2. Get Full Lesson Plan (For Author / Assigned Master)
// ----------------------------------------------------------------------------
router.get('/sessions/:sessionId/lesson-plan', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const sessionRes = await dbClient.query(
      `SELECT s.*, c.name AS class_name
       FROM training_sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ error: 'Training session not found.' });
    }
    const session = sessionRes.rows[0];

    const hasAccess = await verifyMasterClassAccess(user, session.class_id, session.organization_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. You do not have permission to view this class lesson plan.' });
    }

    const planRes = await dbClient.query(
      `SELECT lp.*, u.full_name AS author_name
       FROM lesson_plans lp
       JOIN users u ON u.id = lp.author_master_id
       WHERE lp.session_id = $1`,
      [sessionId]
    );

    return res.json({
      session,
      lessonPlan: planRes.rows[0] || null,
    });
  } catch (err: any) {
    console.error('[Get lesson plan error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch lesson plan.') });
  }
});

// ----------------------------------------------------------------------------
// 3. Get Substitute Brief (getSubstituteBrief)
// Enforces: substitute_brief_hides_private_messages
// ----------------------------------------------------------------------------
router.get('/sessions/:sessionId/substitute-brief', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const sessionRes = await dbClient.query(
      `SELECT s.*, c.name AS class_name, c.location AS class_location, tg.name AS group_name
       FROM training_sessions s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN training_groups tg ON tg.id = s.group_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ error: 'Training session not found.' });
    }
    const session = sessionRes.rows[0];

    // SUB-AUTH-001: Strict Authorization Enforcement
    // Accessible ONLY to a Master holding valid, active, session-scoped delegation or approved class leadership in the same Persatuan,
    // or Admin Persatuan within the same organization. Super Admin and cross-tenant users are denied operational access.
    if (user.role === UserRole.MASTER) {
      if (user.organizationId !== session.organization_id) {
        return res.status(403).json({
          error: 'Access denied. Cross-Persatuan instructors cannot access substitute briefs for another academy.',
        });
      }

      // Check for approved active leadership or valid unexpired session delegation
      const leadershipCheck = await dbClient.query(
        `SELECT id, leadership_type, session_id
         FROM class_leaderships
         WHERE class_id = $1
           AND master_id = $2
           AND organization_id = $3
           AND is_active = TRUE
           AND (effective_from IS NULL OR effective_from <= CURRENT_TIMESTAMP)
           AND (effective_to IS NULL OR effective_to >= CURRENT_TIMESTAMP)
           AND (session_id IS NULL OR session_id = $4)`,
        [session.class_id, user.id, session.organization_id, sessionId]
      );

      if (leadershipCheck.rowCount === 0) {
        return res.status(403).json({
          error: 'Access denied. You do not hold approved class leadership or an active, unexpired delegation for this session.',
        });
      }
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      if (user.organizationId !== session.organization_id) {
        return res.status(403).json({
          error: 'Access denied. You can only access substitute briefs within your own Persatuan.',
        });
      }
    } else {
      return res.status(403).json({
        error: 'Access denied. Only authorized instructors or academy administrators can access substitute briefs.',
      });
    }

    // Fetch lesson plan
    const planRes = await dbClient.query(
      `SELECT lp.id, lp.session_id, lp.class_id, lp.title, lp.objectives,
              lp.drills, lp.equipment, lp.covered_material, lp.version,
              u.full_name AS author_name
       FROM lesson_plans lp
       JOIN users u ON u.id = lp.author_master_id
       WHERE lp.session_id = $1`,
      [sessionId]
    );

    // CRITICAL SECURITY ENFORCEMENT: substitute_brief_hides_private_messages
    // private_master_notes and any private session messages are STRICTLY EXCLUDED!
    let substitutePlan: any = null;
    if (planRes.rowCount! > 0) {
      const raw = planRes.rows[0];
      substitutePlan = {
        id: raw.id,
        sessionId: raw.session_id,
        classId: raw.class_id,
        title: raw.title,
        objectives: raw.objectives,
        drills: typeof raw.drills === 'string' ? JSON.parse(raw.drills) : raw.drills,
        equipment: raw.equipment,
        coveredMaterial: raw.covered_material,
        version: raw.version,
        authorName: raw.author_name,
        // Explicitly ensuring private_master_notes is UNDEFINED
        private_master_notes: undefined,
        privateMasterNotes: undefined,
      };
    }

    // Fetch student safety notes (allergies, medical conditions) for substitute awareness
    const safetyRes = await dbClient.query(
      `SELECT s.id AS student_id, s.full_name AS student_name, s.belt_rank,
              sp.medical_conditions, sp.allergies, sp.emergency_contact_phone
       FROM students s
       LEFT JOIN student_safety_profiles sp ON sp.student_id = s.id
       WHERE s.class_id = $1 AND s.status = 'ACTIVE'`,
      [session.class_id]
    );

    return res.json({
      isSubstituteBrief: true,
      session: {
        id: session.id,
        classId: session.class_id,
        className: session.class_name,
        groupName: session.group_name,
        sessionDate: session.session_date,
        dayOfWeek: session.day_of_week,
        startTime: session.start_time,
        endTime: session.end_time,
        location: session.location || session.class_location,
        status: session.status,
      },
      lessonPlan: substitutePlan,
      studentSafetyBrief: safetyRes.rows,
      // CONFIDENTIAL NOTICE: Private notes and private master messages are withheld
      confidentialityNotice: 'Private master notes and confidential communications have been redacted for substitute briefing.',
    });
  } catch (err: any) {
    console.error('[Get substitute brief error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch substitute brief.') });
  }
});

export default router;
