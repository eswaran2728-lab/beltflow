import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ----------------------------------------------------------------------------
// 1. Publish / Create Learning Lesson (publishLesson)
// Enforces: Role-scoped publishing (MASTER / ADMIN_PERSATUAN)
// ----------------------------------------------------------------------------
router.post('/lessons', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Access denied. Only instructors and administrators can create or publish lessons.' });
    }

    const {
      title,
      description,
      category,
      contentBody,
      mediaUrls,
      quizQuestions,
      curriculumId,
      targetRankId,
      status, // 'DRAFT' | 'PUBLISHED'
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    const lessonStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    const publishedAt = lessonStatus === 'PUBLISHED' ? new Date() : null;
    const lessonId = newId('lsn');

    const result = await dbClient.query(
      `INSERT INTO learning_lessons (
         id, organization_id, curriculum_id, target_rank_id, author_master_id,
         title, description, category, content_body, media_urls, quiz_questions,
         status, published_at, version, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        lessonId,
        user.organizationId,
        curriculumId || null,
        targetRankId || null,
        user.id,
        title.trim(),
        description || '',
        category || 'THEORY',
        contentBody || '',
        JSON.stringify(Array.isArray(mediaUrls) ? mediaUrls : []),
        JSON.stringify(Array.isArray(quizQuestions) ? quizQuestions : []),
        lessonStatus,
        publishedAt,
      ]
    );

    return res.status(201).json({ lesson: result.rows[0] });
  } catch (err: any) {
    console.error('[Publish lesson error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to publish lesson.') });
  }
});

// ----------------------------------------------------------------------------
// 2. Get Learning Lessons List
// Enforces: unpublished_lesson_hidden (DRAFT strictly hidden from STUDENTS & PARENTS)
// ----------------------------------------------------------------------------
router.get('/lessons', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { category, curriculumId, status } = req.query;

    let queryText = `
      SELECT l.*, u.full_name AS author_name,
             cbr.name AS target_rank_name, cbr.color_hex AS target_rank_color
      FROM learning_lessons l
      JOIN users u ON u.id = l.author_master_id
      LEFT JOIN curriculum_belt_ranks cbr ON cbr.id = l.target_rank_id
      WHERE l.organization_id = $1
    `;
    const params: any[] = [user.organizationId];

    // CRITICAL SECURITY ENFORCEMENT: unpublished_lesson_hidden
    // Students and Parents CANNOT see DRAFT or ARCHIVED lessons under any circumstances
    if (user.role === UserRole.STUDENT || user.role === UserRole.PARENT) {
      queryText += ` AND l.status = 'PUBLISHED'`;
    } else if (status && typeof status === 'string') {
      params.push(status);
      queryText += ` AND l.status = $${params.length}`;
    }

    if (category && typeof category === 'string') {
      params.push(category);
      queryText += ` AND l.category = $${params.length}`;
    }

    if (curriculumId && typeof curriculumId === 'string') {
      params.push(curriculumId);
      queryText += ` AND l.curriculum_id = $${params.length}`;
    }

    queryText += ` ORDER BY l.created_at DESC`;

    const result = await dbClient.query(queryText, params);
    return res.json({ lessons: result.rows });
  } catch (err: any) {
    console.error('[Get lessons error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch lessons.') });
  }
});

// ----------------------------------------------------------------------------
// 3. Get Single Lesson Details
// Enforces: unpublished_lesson_hidden
// ----------------------------------------------------------------------------
router.get('/lessons/:lessonId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { lessonId } = req.params;

    const result = await dbClient.query(
      `SELECT l.*, u.full_name AS author_name,
              cbr.name AS target_rank_name, cbr.color_hex AS target_rank_color
       FROM learning_lessons l
       JOIN users u ON u.id = l.author_master_id
       LEFT JOIN curriculum_belt_ranks cbr ON cbr.id = l.target_rank_id
       WHERE l.id = $1 AND l.organization_id = $2`,
      [lessonId, user.organizationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    const lesson = result.rows[0];

    // CRITICAL SECURITY ENFORCEMENT: unpublished_lesson_hidden
    if ((user.role === UserRole.STUDENT || user.role === UserRole.PARENT) && lesson.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    return res.json({ lesson });
  } catch (err: any) {
    console.error('[Get lesson details error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch lesson details.') });
  }
});

// ----------------------------------------------------------------------------
// 4. Record Student Lesson Progress & Quiz (recordLessonProgress)
// Enforces: learning_completion_not_formal_grading
// ----------------------------------------------------------------------------
router.post('/lessons/:lessonId/progress', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { lessonId } = req.params;
    const { studentId, quizScore, quizAnswers, status } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required.' });
    }

    // Authorization check
    if (user.role === UserRole.STUDENT) {
      const studentRes = await dbClient.query('SELECT user_id, organization_id, belt_rank FROM students WHERE id = $1', [studentId]);
      if (studentRes.rowCount === 0 || studentRes.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: 'Access denied. You can only record progress for yourself.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const linkCheck = await dbClient.query(
        'SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = $3',
        [user.id, studentId, 'ACTIVE']
      );
      if (linkCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied. Guardian is not linked to this student.' });
      }
    }

    // Verify lesson existence and published status
    const lessonRes = await dbClient.query(
      'SELECT id, status, organization_id FROM learning_lessons WHERE id = $1 AND organization_id = $2',
      [lessonId, user.organizationId]
    );
    if (lessonRes.rowCount === 0) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }
    const lesson = lessonRes.rows[0];

    // Students/parents cannot complete unpublished draft lessons
    if ((user.role === UserRole.STUDENT || user.role === UserRole.PARENT) && lesson.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    const progressStatus = status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
    const completedAt = progressStatus === 'COMPLETED' ? new Date() : null;
    const progressId = newId('prog');

    const progressRes = await dbClient.query(
      `INSERT INTO student_lesson_progress (
         id, student_id, lesson_id, organization_id, status, quiz_score,
         quiz_answers, completed_at, last_accessed_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, lesson_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         quiz_score = COALESCE(EXCLUDED.quiz_score, student_lesson_progress.quiz_score),
         quiz_answers = COALESCE(EXCLUDED.quiz_answers, student_lesson_progress.quiz_answers),
         completed_at = COALESCE(EXCLUDED.completed_at, student_lesson_progress.completed_at),
         last_accessed_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        progressId,
        studentId,
        lessonId,
        user.organizationId,
        progressStatus,
        quizScore !== undefined ? Number(quizScore) : null,
        quizAnswers ? JSON.stringify(quizAnswers) : null,
        completedAt,
      ]
    );

    // CRITICAL INVARIANT: learning_completion_not_formal_grading
    // Completing learning library modules or scoring 100% on quizzes NEVER promotes belt rank,
    // NEVER generates certificates, and NEVER alters student_rank_history.
    const studentCheck = await dbClient.query('SELECT belt_rank FROM students WHERE id = $1', [studentId]);

    return res.json({
      success: true,
      progress: progressRes.rows[0],
      currentBeltRank: studentCheck.rows[0]?.belt_rank,
      formalGradingOccurred: false,
      message: 'Lesson progress recorded. Formal rank promotion requires a registered grading event.',
    });
  } catch (err: any) {
    console.error('[Record lesson progress error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to record progress.') });
  }
});

// ----------------------------------------------------------------------------
// 5. Record Formative Performance Assessment (recordAssessment)
// Enforces: versioned rubrics, cross_rubric_scores_not_falsely_compared
// ----------------------------------------------------------------------------
router.post('/assessments', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Access denied. Only instructors can record performance assessments.' });
    }

    const {
      studentId,
      curriculumId,
      rubricSchemaId,
      rubricVersion,
      skillCategory,
      score,
      maxScore,
      criteriaBreakdown,
      notes,
    } = req.body;

    if (!studentId || !curriculumId || !rubricSchemaId || score === undefined) {
      return res.status(400).json({ error: 'studentId, curriculumId, rubricSchemaId, and score are required.' });
    }

    // Verify student belongs to this organization
    const studentRes = await dbClient.query(
      'SELECT id, organization_id, class_id FROM students WHERE id = $1 AND organization_id = $2',
      [studentId, user.organizationId]
    );
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found in your organization.' });
    }

    const assessId = newId('assess');
    const versionNum = rubricVersion ? Number(rubricVersion) : 1;
    const maxScoreVal = maxScore ? Number(maxScore) : 100.00;

    const result = await dbClient.query(
      `INSERT INTO performance_assessments (
         id, organization_id, student_id, assessor_master_id, curriculum_id,
         rubric_version, rubric_schema_id, skill_category, score, max_score,
         criteria_breakdown, notes, assessed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        assessId,
        user.organizationId,
        studentId,
        user.id,
        curriculumId,
        versionNum,
        rubricSchemaId,
        skillCategory || 'TECHNIQUE',
        Number(score),
        maxScoreVal,
        JSON.stringify(criteriaBreakdown || {}),
        notes || '',
      ]
    );

    return res.status(201).json({ assessment: result.rows[0] });
  } catch (err: any) {
    console.error('[Record assessment error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to record assessment.') });
  }
});

// ----------------------------------------------------------------------------
// 6. Get Student Performance & Comparative Rubric Progress
// Enforces: cross_rubric_scores_not_falsely_compared (rubric version isolation)
// Enforces: No global child leaderboards (child privacy)
// ----------------------------------------------------------------------------
router.get('/students/:studentId/performance', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { studentId } = req.params;
    const { rubricSchemaId, rubricVersion, compareRubrics } = req.query;

    // Authorization check
    if (user.role === UserRole.STUDENT) {
      const studentRes = await dbClient.query('SELECT user_id FROM students WHERE id = $1', [studentId]);
      if (studentRes.rowCount === 0 || studentRes.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: 'Access denied. You can only view your own performance.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const linkCheck = await dbClient.query(
        'SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = $3',
        [user.id, studentId, 'ACTIVE']
      );
      if (linkCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied. Guardian not authorized for this student.' });
      }
    }

    const assessRes = await dbClient.query(
      `SELECT pa.*, u.full_name AS assessor_name
       FROM performance_assessments pa
       JOIN users u ON u.id = pa.assessor_master_id
       WHERE pa.student_id = $1 AND pa.organization_id = $2
       ORDER BY pa.assessed_at DESC`,
      [studentId, user.organizationId]
    );

    // CRITICAL SECURITY & MATHEMATICAL INVARIANT: cross_rubric_scores_not_falsely_compared
    // Partition assessments by (rubric_schema_id, rubric_version)
    const partitionedByRubric: Record<string, any[]> = {};
    const rubricVersionsEncountered = new Set<string>();

    for (const row of assessRes.rows) {
      const key = `${row.rubric_schema_id}_v${row.rubric_version}`;
      rubricVersionsEncountered.add(key);
      if (!partitionedByRubric[key]) {
        partitionedByRubric[key] = [];
      }
      partitionedByRubric[key].push(row);
    }

    // If client requested cross-rubric comparison across disparate versions without version alignment
    let crossRubricIncompatible = false;
    let comparisonWarning: string | null = null;

    if (compareRubrics === 'true' && rubricVersionsEncountered.size > 1) {
      crossRubricIncompatible = true;
      comparisonWarning =
        'Cross-rubric version comparison rejected: Assessments belong to distinct rubric scoring schemas or versions. Naive score comparison is mathematically invalid.';
    }

    return res.json({
      studentId,
      assessments: assessRes.rows,
      partitionedByRubric,
      rubricVersions: Array.from(rubricVersionsEncountered),
      crossRubricIncompatible,
      comparisonWarning,
      // PRIVACY SAFEGUARD: Global child leaderboards are explicitly omitted
      leaderboardPosition: null,
      globalRankingDisabled: true,
    });
  } catch (err: any) {
    console.error('[Get student performance error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch performance.') });
  }
});

// ----------------------------------------------------------------------------
// 7. Award Achievement (awardAchievement)
// Enforces: replay_event_one_award (event_id idempotency)
// ----------------------------------------------------------------------------
router.post('/achievements/award', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied. Only instructors can award verified achievements.' });
    }

    const { eventId, studentId, badgeCode, badgeTitle, badgeDescription, category } = req.body;

    if (!eventId || !studentId || !badgeCode || !badgeTitle) {
      return res.status(400).json({ error: 'eventId, studentId, badgeCode, and badgeTitle are required.' });
    }

    // Verify student belongs to this organization
    const studentRes = await dbClient.query(
      'SELECT id, organization_id FROM students WHERE id = $1 AND organization_id = $2',
      [studentId, user.organizationId]
    );
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found in your organization.' });
    }

    // CRITICAL INVARIANT: replay_event_one_award
    // Check if eventId was already processed
    const existingRes = await dbClient.query(
      'SELECT * FROM student_achievements WHERE event_id = $1',
      [eventId]
    );

    if (existingRes.rowCount! > 0) {
      // Idempotent replay: return existing award without duplicating
      return res.json({
        achievement: existingRes.rows[0],
        isDuplicateReplay: true,
        created: false,
        message: 'Achievement event already recorded. Duplicate award prevented.',
      });
    }

    const awardId = newId('ach');
    const insertRes = await dbClient.query(
      `INSERT INTO student_achievements (
         id, organization_id, student_id, event_id, badge_code,
         badge_title, badge_description, category, awarded_by_user_id,
         awarded_at, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, 'ACTIVE')
       RETURNING *`,
      [
        awardId,
        user.organizationId,
        studentId,
        eventId,
        badgeCode,
        badgeTitle,
        badgeDescription || '',
        category || 'SKILL',
        user.id,
      ]
    );

    return res.status(201).json({
      achievement: insertRes.rows[0],
      isDuplicateReplay: false,
      created: true,
    });
  } catch (err: any) {
    console.error('[Award achievement error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to award achievement.') });
  }
});

// ----------------------------------------------------------------------------
// 8. Revoke Achievement
// Enforces: revoked_award_audited (audit log with actor and reason)
// ----------------------------------------------------------------------------
router.post('/achievements/:awardId/revoke', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.MASTER && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Access denied. Only instructors can revoke achievements.' });
    }

    const { awardId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'Revocation reason is required for auditing purposes.' });
    }

    const result = await dbClient.transaction(async (tx) => {
      const awardRes = await tx.query(
        'SELECT * FROM student_achievements WHERE id = $1 AND organization_id = $2 FOR UPDATE',
        [awardId, user.organizationId]
      );

      if (awardRes.rowCount === 0) {
        const err: any = new Error('Achievement not found.');
        err.statusCode = 404;
        throw err;
      }

      const award = awardRes.rows[0];
      if (award.status === 'REVOKED') {
        const err: any = new Error('Achievement has already been revoked.');
        err.statusCode = 400;
        throw err;
      }

      const updateRes = await tx.query(
        `UPDATE student_achievements
         SET status = 'REVOKED',
             revoked_at = CURRENT_TIMESTAMP,
             revocation_reason = $1,
             revoked_by_user_id = $2
         WHERE id = $3
         RETURNING *`,
        [reason.trim(), user.id, awardId]
      );

      // CRITICAL SECURITY ENFORCEMENT: revoked_award_audited
      // Immutable audit log recording award revocation with rationale and actor attribution
      const auditId = newId('audit');
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          auditId,
          'ACHIEVEMENT_REVOKED',
          JSON.stringify({
            awardId,
            studentId: award.student_id,
            badgeCode: award.badge_code,
            reason: reason.trim(),
            revokedByUserId: user.id,
            timestamp: new Date().toISOString(),
          }),
          user.role,
          user.email,
        ]
      );

      return updateRes.rows[0];
    });

    return res.json({ success: true, achievement: result });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[Revoke achievement error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to revoke achievement.') });
  }
});

// ----------------------------------------------------------------------------
// 9. Get Student Achievements List
// Enforces: Child privacy (no global comparisons)
// ----------------------------------------------------------------------------
router.get('/students/:studentId/achievements', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { studentId } = req.params;

    // Authorization check
    if (user.role === UserRole.STUDENT) {
      const studentRes = await dbClient.query('SELECT user_id FROM students WHERE id = $1', [studentId]);
      if (studentRes.rowCount === 0 || studentRes.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: 'Access denied. You can only view your own achievements.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const linkCheck = await dbClient.query(
        'SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = $3',
        [user.id, studentId, 'ACTIVE']
      );
      if (linkCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied. Guardian not authorized for this student.' });
      }
    }

    const result = await dbClient.query(
      `SELECT sa.*, u.full_name AS awarded_by_name
       FROM student_achievements sa
       LEFT JOIN users u ON u.id = sa.awarded_by_user_id
       WHERE sa.student_id = $1 AND sa.organization_id = $2 AND sa.status = 'ACTIVE'
       ORDER BY sa.awarded_at DESC`,
      [studentId, user.organizationId]
    );

    return res.json({ achievements: result.rows });
  } catch (err: any) {
    console.error('[Get student achievements error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch achievements.') });
  }
});

export default router;
