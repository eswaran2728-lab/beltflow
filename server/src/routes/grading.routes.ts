import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';
import { getOrCreateActiveCurriculum } from './curriculum.routes';

const router = Router();

// Student Readiness Passport (Task H12)
// Calculates attendance, training duration, skills, and belt progression status according to active Persatuan curriculum.
router.get('/readiness/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    const access = await studentAccess(req.user!, studentId);
    if (!access.allowed || !access.student) {
      return res.status(403).json({ error: 'Access denied to student readiness passport.' });
    }

    const student = access.student;
    const orgId = student.organization_id;

    // Retrieve active published curriculum for this Persatuan
    const curriculumData = await getOrCreateActiveCurriculum(orgId);
    const ranks = curriculumData.ranks || [];

    // Identify student's current belt rank in the curriculum
    const currentBeltName = student.belt_rank || 'White Belt';
    const currentRank = ranks.find(
      (r: any) => r.name.toLowerCase() === currentBeltName.toLowerCase()
    ) || ranks[0] || { id: 'default', name: currentBeltName, rank_order: 1, color_hex: '#FFFFFF', min_months: 3, min_sessions: 24 };

    const currentOrder = currentRank.rank_order ?? currentRank.order_index ?? 1;

    // Next eligible belt is the next rank in the ordered progression
    const nextRank = ranks.find(
      (r: any) => (r.rank_order ?? r.order_index ?? 0) > currentOrder
    ) || null;

    // Calculate attendance records from session_attendance
    const attendanceRes = await dbClient.query(
      `SELECT COUNT(*) AS count
       FROM session_attendance
       WHERE student_id = $1 AND status IN ('Present', 'Late')`,
      [studentId]
    );
    const attendedCount = parseInt(attendanceRes.rows[0]?.count || '0', 10);

    // Calculate training duration (months since last rank award or registration)
    const rankHistoryRes = await dbClient.query(
      `SELECT * FROM student_rank_history
       WHERE student_id = $1
       ORDER BY awarded_at DESC`,
      [studentId]
    );

    let monthsInCurrentRank = 1;
    const referenceDateStr = rankHistoryRes.rows[0]?.awarded_at || student.created_at;
    if (referenceDateStr) {
      const refDate = new Date(referenceDateStr);
      const diffMs = Math.max(0, Date.now() - refDate.getTime());
      monthsInCurrentRank = Math.max(1, Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000)));
    }

    // Retrieve assessed skills
    const skillsRes = await dbClient.query(
      `SELECT ss.*, s.name as skill_name, s.category
       FROM student_skills ss
       JOIN skills s ON ss.skill_id = s.id
       WHERE ss.student_id = $1`,
      [studentId]
    );

    const skillsAchieved = skillsRes.rows.filter(
      (s: any) => ['Proficient', 'Mastered'].includes(s.level)
    ).length;
    const skillsNeedingImprovement = skillsRes.rows.filter(
      (s: any) => ['Beginner', 'Needs Work', 'Developing'].includes(s.level)
    );

    // Minimum requirement thresholds
    const minSessionsRequired = nextRank?.min_sessions || nextRank?.min_sessions_required || nextRank?.min_training_hours || 24;
    const minMonthsRequired = nextRank?.min_months || nextRank?.min_duration_months || 3;
    const minSkillsRequired = 3;

    // Check for any active grading candidate registrations/nominations
    const activeCandRes = await dbClient.query(
      `SELECT gc.*, ge.title AS event_title, ge.event_date, ge.status AS event_status
       FROM grading_candidates gc
       JOIN grading_events ge ON ge.id = gc.grading_event_id
       WHERE gc.student_id = $1 AND ge.status != 'FINALIZED'
       ORDER BY ge.created_at DESC LIMIT 1`,
      [studentId]
    );

    let eligibilityStatus = 'NOT YET ELIGIBLE';
    if (!nextRank) {
      eligibilityStatus = 'COMPLETED';
    } else if (activeCandRes.rowCount && activeCandRes.rowCount > 0) {
      eligibilityStatus = 'APPROVED FOR GRADING';
    } else if (attendedCount >= minSessionsRequired && monthsInCurrentRank >= minMonthsRequired && skillsAchieved >= minSkillsRequired) {
      eligibilityStatus = 'READY FOR REVIEW';
    } else if (attendedCount > 0 || skillsAchieved > 0) {
      eligibilityStatus = 'IN PROGRESS';
    } else {
      eligibilityStatus = 'NOT YET ELIGIBLE';
    }

    const recommendation =
      eligibilityStatus === 'READY FOR REVIEW'
        ? 'Eligible and recommended for upcoming belt promotion exam.'
        : eligibilityStatus === 'APPROVED FOR GRADING'
        ? 'Nominated and registered for scheduled promotion examination.'
        : eligibilityStatus === 'COMPLETED'
        ? 'Master rank achieved. No further student ranks in standard curriculum.'
        : 'Continue regular attendance and skill drills to meet promotion criteria.';

    return res.json({
      studentId: student.id,
      fullName: student.full_name,
      currentBelt: currentRank.name,
      currentBeltColor: currentRank.color_hex || currentRank.belt_color_hex || '#FFFFFF',
      nextEligibleBelt: nextRank
        ? {
            id: nextRank.id,
            name: nextRank.name,
            orderIndex: nextRank.rank_order ?? nextRank.order_index ?? (currentOrder + 1),
            colorHex: nextRank.color_hex || nextRank.belt_color_hex || '#FFFF00',
            minDurationMonths: minMonthsRequired,
            minSessions: minSessionsRequired,
          }
        : null,
      attendance: {
        totalSessions: attendedCount,
        minSessionsRequired,
      },
      trainingDuration: {
        months: monthsInCurrentRank,
        minMonthsRequired,
      },
      skills: {
        achievedCount: skillsAchieved,
        needingImprovementCount: skillsNeedingImprovement.length,
        skillsAchieved: skillsRes.rows.filter((s: any) => ['Proficient', 'Mastered'].includes(s.level)),
        skillsNeedingImprovement,
        allSkills: skillsRes.rows,
      },
      eligibilityStatus,
      requirements: {
        minSessions: minSessionsRequired,
        minMonths: minMonthsRequired,
        minSkills: minSkillsRequired,
      },
      readinessRecommendation: recommendation,
      rankHistory: rankHistoryRes.rows,
      activeNomination: activeCandRes.rows[0] || null,
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Create grading exam session (ADMIN_PERSATUAN)
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_GRADING_EVENTS), async (req: Request, res: Response) => {
  try {
    const {
      organizationId,
      title,
      eventDate,
      location,
      fee,
      curriculumId,
      chiefExaminerId,
      registrationDeadline,
      status,
    } = req.body;
    const orgId = organizationId || req.user?.organizationId;

    if (!title || !orgId) {
      return res.status(400).json({ error: 'title and organizationId are required.' });
    }

    const eventId = `grd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventRes = await dbClient.query(
      `INSERT INTO grading_events (
         id, organization_id, title, event_date, location, fee,
         curriculum_id, chief_examiner_id, registration_deadline, status, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
       RETURNING *`,
      [
        eventId,
        orgId,
        title.trim(),
        eventDate || new Date().toISOString().slice(0, 10),
        location?.trim() || 'Community Hall',
        parseFloat(fee) || 60.0,
        curriculumId || null,
        chiefExaminerId || null,
        registrationDeadline || null,
        status || 'REGISTRATION_OPEN',
      ]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Grading Event Created', `Created promotion exam: ${title.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Grading event created successfully in PostgreSQL.', event: eventRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// List grading events for an organization, with registered-candidate counts
router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user!.organizationId || req.params.orgId !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization access denied.' });
    }
    const listRes = await dbClient.query(
      `SELECT e.*, COUNT(c.id) AS candidate_count,
              COALESCE(array_agg(c.student_id) FILTER (WHERE c.student_id IS NOT NULL), '{}') AS candidate_student_ids
       FROM grading_events e LEFT JOIN grading_candidates c ON c.grading_event_id = e.id
       WHERE e.organization_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.params.orgId]
    );
    return res.json({ gradingEvents: listRes.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Master Nominate Candidate for Grading Event (Task H12)
router.post('/:eventId/nominate', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, targetBelt, notes } = req.body;
    if (!studentId || !targetBelt) {
      return res.status(400).json({ error: 'studentId and targetBelt are required.' });
    }

    // Role check: Only MASTER or ADMIN_PERSATUAN can nominate candidates
    if (req.user!.role === UserRole.STUDENT || req.user!.role === UserRole.PARENT) {
      return res.status(403).json({ error: 'Students and parents cannot nominate grading candidates.' });
    }

    const eventRes = await dbClient.query('SELECT * FROM grading_events WHERE id = $1', [req.params.eventId]);
    if (eventRes.rowCount === 0) {
      return res.status(404).json({ error: 'Grading event not found.' });
    }
    const event = eventRes.rows[0];

    const access = await studentAccess(req.user!, studentId);
    if (!access.allowed || !access.student) {
      return res.status(403).json({ error: 'Access denied to nominate this student.' });
    }
    const student = access.student;

    if (student.organization_id !== event.organization_id) {
      return res.status(403).json({ error: 'Cross-organization nomination denied.' });
    }

    // Membership status check: Inactive students cannot be nominated
    if (student.status !== 'ACTIVE') {
      return res.status(400).json({ error: `Cannot nominate student with INACTIVE status (current: ${student.status}).` });
    }

    // Check duplicate nomination
    const existing = await dbClient.query(
      'SELECT id FROM grading_candidates WHERE grading_event_id = $1 AND student_id = $2',
      [event.id, student.id]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ error: 'Candidate already nominated for this grading event.' });
    }

    const candidateId = `gcand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const resultRes = await dbClient.query(
      `INSERT INTO grading_candidates (
         id, grading_event_id, student_id, current_belt, target_belt, notes, result, examiner_id, version
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Nominated', $7, 1)
       RETURNING *`,
      [candidateId, event.id, student.id, student.belt_rank, targetBelt, notes || null, req.user!.id]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        'Candidate Nominated',
        `Nominated student ${student.full_name} for target belt ${targetBelt} in event ${event.title}`,
        req.user!.role,
        req.user!.email,
      ]
    );

    return res.status(201).json({
      message: 'Candidate nominated successfully.',
      candidate: resultRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Self / Parent Registration for open grading event
router.post('/:eventId/register', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, targetBelt } = req.body;
    if (!studentId || !targetBelt) return res.status(400).json({ error: 'Student and target belt are required.' });
    const event = await dbClient.query('SELECT * FROM grading_events WHERE id = $1', [req.params.eventId]);
    if (!event.rowCount) return res.status(404).json({ error: 'Grading event not found.' });
    const access = await studentAccess(req.user!, studentId);
    if (!access.allowed || access.student?.organization_id !== event.rows[0].organization_id ||
        req.user!.role === UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Registration access denied.' });
    }
    const existing = await dbClient.query('SELECT id FROM grading_candidates WHERE grading_event_id = $1 AND student_id = $2', [req.params.eventId, studentId]);
    if (existing.rowCount) return res.status(409).json({ error: 'Already registered.' });
    const id = `gcand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await dbClient.query(
      `INSERT INTO grading_candidates (id, grading_event_id, student_id, current_belt, target_belt, result)
       VALUES ($1, $2, $3, $4, $5, 'Registered') RETURNING *`,
      [id, req.params.eventId, studentId, access.student.belt_rank, targetBelt]);
    return res.status(201).json({ candidate: result.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Score grading candidates and auto-issue certificates (ADMIN_PERSATUAN or assigned MASTER; Super Admin denied)
router.post('/:eventId/score', authenticateJWT, requirePermission(Permission.CLASS_SCORE_GRADING), async (req: Request, res: Response) => {
  try {
    const eventRes = await dbClient.query('SELECT * FROM grading_events WHERE id = $1', [req.params.eventId]);
    if (eventRes.rowCount === 0) return res.status(404).json({ error: 'Grading event not found.' });

    const event = eventRes.rows[0];
    if (event.organization_id !== req.user!.organizationId) return res.status(403).json({ error: 'Cross-organization grading denied.' });
    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [event.organization_id]);
    const org = orgRes.rows[0];

    const { results } = req.body;
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'results array is required.' });
    }
    for (const result of results) {
      const access = await studentAccess(req.user!, result.studentId);
      if (!access.allowed || access.student?.organization_id !== event.organization_id) {
        return res.status(403).json({ error: 'Grading student access denied.' });
      }
      const candidate = await dbClient.query(
        'SELECT id, result AS current_result FROM grading_candidates WHERE grading_event_id = $1 AND student_id = $2',
        [event.id, result.studentId]);
      if (!candidate.rowCount) return res.status(400).json({ error: 'Student is not registered for this grading.' });
      if (candidate.rows[0].current_result !== 'Registered' && candidate.rows[0].current_result !== 'Nominated') {
        return res.status(409).json({ error: `Candidate has already been graded (result: ${candidate.rows[0].current_result}).` });
      }
    }

    const issuedCerts: any[] = [];

    for (const r of results) {
      const stuRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [r.studentId]);
      if (stuRes.rowCount === 0) continue;
      const student = stuRes.rows[0];
      await dbClient.query(
        `UPDATE grading_candidates SET result = $1, notes = $2, graded_at = CURRENT_TIMESTAMP
         WHERE grading_event_id = $3 AND student_id = $4`,
        [r.result, r.notes || null, event.id, student.id]);

      if (r.result === 'Passed' || r.result === 'Double Promotion') {
        // Update student belt rank in PostgreSQL
        await dbClient.query('UPDATE students SET belt_rank = $1 WHERE id = $2', [r.targetBelt, student.id]);

        const certCode = `BF-${student.full_name.substring(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const certId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const verificationToken = `cvr_${crypto.randomBytes(16).toString('hex')}`;

        const certRes = await dbClient.query(
          `INSERT INTO certificates (
             id, code, verification_token, organization_id, organization_name,
             student_id, student_name, master_name, rank_or_title, type, issue_date, status, grading_event_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', $12)
           RETURNING *`,
          [
            certId,
            certCode,
            verificationToken,
            student.organization_id,
            org ? org.name : 'BeltFlow Academy',
            student.id,
            student.full_name,
            org ? org.master_name : 'Chief Examiner',
            r.targetBelt,
            'Promotion Exam',
            new Date().toISOString().slice(0, 10),
            event.id,
          ]
        );

        issuedCerts.push(certRes.rows[0]);

        await dbClient.query(
          `INSERT INTO audit_logs (id, action, details, user_role, user_email)
           VALUES ($1, $2, $3, $4, $5)`,
          [`audit_${Date.now()}`, 'Certificate Issued', `Issued cert ${certCode} (${r.targetBelt}) to ${student.full_name}`, req.user!.role, req.user!.email]
        );
      }
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Grading Results Recorded',
       `Recorded results for grading event ${event.id} (${results.length} candidates, ${issuedCerts.length} certificates issued)`,
       req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Grading results saved and certificates issued in PostgreSQL.', issuedCertificates: issuedCerts });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Atomic Final Grading Transaction (Task H12)
// Enforces optimistic concurrency (expectedVersion), atomic row updates, rank history snapshot, and certificate issuance.
router.post('/:eventId/finalize', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { expectedVersion, results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'results array is required.' });
    }

    const eventId = req.params.eventId;

    // Execute within atomic database transaction
    const finalizationResult = await dbClient.transaction(async (txClient) => {
      // 1. Fetch event with row-level lock
      const eventRes = await txClient.query(
        'SELECT * FROM grading_events WHERE id = $1 FOR UPDATE',
        [eventId]
      );
      if (eventRes.rowCount === 0) {
        const notFoundErr: any = new Error('Grading event not found.');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      const event = eventRes.rows[0];

      // 2. Validate tenant and state
      if (event.organization_id !== req.user!.organizationId) {
        const deniedErr: any = new Error('Cross-organization grading finalization denied.');
        deniedErr.statusCode = 403;
        throw deniedErr;
      }

      if (event.status === 'FINALIZED') {
        const conflictErr: any = new Error('Grading event has already been finalized.');
        conflictErr.statusCode = 409;
        throw conflictErr;
      }

      // 3. Concurrency check (expectedVersion)
      if (expectedVersion !== undefined && Number(event.version) !== Number(expectedVersion)) {
        const staleErr: any = new Error(`Concurrency conflict: expected version ${expectedVersion}, but event is version ${event.version}.`);
        staleErr.statusCode = 409;
        throw staleErr;
      }

      const orgRes = await txClient.query('SELECT * FROM organizations WHERE id = $1', [event.organization_id]);
      const org = orgRes.rows[0];

      // Retrieve curriculum and ranks for historical snapshots
      const curriculumId = event.curriculum_id;
      const rankRowsRes = curriculumId
        ? await txClient.query('SELECT * FROM curriculum_belt_ranks WHERE curriculum_id = $1 ORDER BY rank_order ASC', [curriculumId])
        : await txClient.query(
            `SELECT cbr.* FROM curriculum_belt_ranks cbr
             JOIN persatuan_curriculums pc ON pc.id = cbr.curriculum_id
             WHERE pc.organization_id = $1 AND pc.status = 'PUBLISHED'
             ORDER BY cbr.rank_order ASC`,
            [event.organization_id]
          );
      const curriculumRanks = rankRowsRes.rows;

      const issuedCertificates: any[] = [];

      for (const item of results) {
        const { studentId, result, targetBelt, examinerScore, criteriaScores, notes } = item;

        // Verify candidate registration
        const candidateRes = await txClient.query(
          'SELECT * FROM grading_candidates WHERE grading_event_id = $1 AND student_id = $2 FOR UPDATE',
          [eventId, studentId]
        );
        if (candidateRes.rowCount === 0) {
          const candErr: any = new Error(`Student ${studentId} is not a candidate for this grading event.`);
          candErr.statusCode = 400;
          throw candErr;
        }

        const candidate = candidateRes.rows[0];
        const studentRes = await txClient.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [studentId]);
        if (studentRes.rowCount === 0) continue;
        const student = studentRes.rows[0];

        const isPassing = result === 'Passed' || result === 'Double Promotion';
        let certificateRecord: any = null;

        if (isPassing) {
          // 4. Update student current belt rank
          await txClient.query(
            'UPDATE students SET belt_rank = $1 WHERE id = $2',
            [targetBelt, student.id]
          );

          // Find curriculum rank definition snapshot
          const rankDef = curriculumRanks.find(
            (r: any) => r.name.toLowerCase() === targetBelt.toLowerCase()
          ) || {
            id: null,
            rank_order: 1,
            is_dan_rank: false,
            dan_level: null,
            color_hex: '#FFFF00',
          };

          // 5. Generate tamper-resistant certificate
          const certCode = `BF-${student.full_name.substring(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          const certId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const verificationToken = `cvr_${crypto.randomBytes(16).toString('hex')}`;

          const certRes = await txClient.query(
            `INSERT INTO certificates (
               id, code, verification_token, organization_id, organization_name,
               student_id, student_name, master_name, rank_or_title, type, issue_date,
               status, curriculum_id, curriculum_version, rank_id, grading_event_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, 'ACTIVE', $11, $12, $13, $14)
             RETURNING *`,
            [
              certId,
              certCode,
              verificationToken,
              student.organization_id,
              org?.name || 'BeltFlow Academy',
              student.id,
              student.full_name,
              org?.master_name || 'Chief Examiner',
              targetBelt,
              'Promotion Exam',
              curriculumId || null,
              1,
              rankDef.id,
              eventId,
            ]
          );
          certificateRecord = certRes.rows[0];
          issuedCertificates.push(certificateRecord);

          // 6. Record immutable student rank history
          const historyId = `srh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await txClient.query(
            `INSERT INTO student_rank_history (
               id, student_id, rank_name, awarded_at, notes, certificate_number,
               organization_id, rank_id, grading_event_id, certificate_id, rank_order,
               is_dan_rank, dan_level, belt_color_hex, awarded_by_master_id, curriculum_id
             ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              historyId,
              student.id,
              targetBelt,
              notes || `Graded ${result} with score ${examinerScore || 0}`,
              certCode,
              student.organization_id,
              rankDef.id,
              eventId,
              certId,
              rankDef.rank_order ?? 1,
              Boolean(rankDef.is_dan_rank),
              rankDef.dan_level || null,
              rankDef.color_hex || rankDef.belt_color_hex || '#FFFFFF',
              req.user!.id,
              curriculumId || null,
            ]
          );

          // 7. Push outbox notification
          await txClient.query(
            `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
             VALUES ($1, $2, 'BeltPromotionAwarded', 'student', $3, $4, 'PENDING')`,
            [
              `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              student.organization_id,
              student.id,
              JSON.stringify({
                type: 'BELT_PROMOTION',
                studentName: student.full_name,
                newBelt: targetBelt,
                certificateCode: certCode,
                verificationToken,
              }),
            ]
          );
        }

        // 8. Update candidate result
        const criteriaJson = typeof criteriaScores === 'object' && criteriaScores !== null ? JSON.stringify(criteriaScores) : null;
        await txClient.query(
          `UPDATE grading_candidates
           SET result = $1,
               notes = $2,
               examiner_score = $3,
               assessment_criteria = $4,
               examiner_id = $5,
               certificate_id = $6,
               graded_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            result,
            notes || null,
            parseFloat(examinerScore) || null,
            criteriaJson,
            req.user!.id,
            certificateRecord ? certificateRecord.id : null,
            candidate.id,
          ]
        );
      }

      // 9. Mark grading event as FINALIZED and increment version
      const updatedEventRes = await txClient.query(
        `UPDATE grading_events
         SET status = 'FINALIZED', version = version + 1
         WHERE id = $1
         RETURNING *`,
        [eventId]
      );

      // 10. Audit log finalization
      await txClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          'Grading Finalized',
          `Finalized grading event ${eventId} (${results.length} results recorded, ${issuedCertificates.length} certificates issued)`,
          req.user!.role,
          req.user!.email,
        ]
      );

      return {
        event: updatedEventRes.rows[0],
        issuedCertificates,
      };
    });

    return res.status(200).json({
      message: 'Grading finalized and results committed atomically.',
      event: finalizationResult.event,
      issuedCertificates: finalizationResult.issuedCertificates,
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[Database error during finalization]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
