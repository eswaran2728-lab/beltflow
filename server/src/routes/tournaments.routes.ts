import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

export const BELT_RANK_ORDER: Record<string, number> = {
  'White Belt': 1,
  'Yellow Belt': 2,
  'Orange Belt': 3,
  'Green Belt': 4,
  'Blue Belt': 5,
  'Purple Belt': 6,
  'Brown Belt': 7,
  'Red Belt': 8,
  'Black Belt': 9,
  '1st Dan': 10,
  '2nd Dan': 11,
  '3rd Dan': 12,
  '4th Dan': 13,
  '5th Dan': 14,
};

export function calculateStudentAge(dobString?: string | null, icNumber?: string | null): number {
  if (dobString) {
    const birth = new Date(dobString);
    if (!isNaN(birth.getTime())) {
      const diffMs = Date.now() - birth.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    }
  }
  if (icNumber) {
    const cleaned = icNumber.replace(/\D/g, '');
    if (cleaned.length >= 6) {
      const yy = parseInt(cleaned.substring(0, 2), 10);
      const mm = parseInt(cleaned.substring(2, 4), 10);
      const dd = parseInt(cleaned.substring(4, 6), 10);
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      const birthYear = (currentYear % 100 >= yy) ? currentCentury + yy : (currentCentury - 100) + yy;
      const birthDate = new Date(birthYear, mm - 1, dd);
      const diffMs = Date.now() - birthDate.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    }
  }
  return 14; // Default fallback age
}

export function resolveStudentRank(beltRankStr?: string | null, rankOrderNum?: number | null): number {
  if (typeof rankOrderNum === 'number' && rankOrderNum > 0) {
    return rankOrderNum;
  }
  if (beltRankStr && BELT_RANK_ORDER[beltRankStr]) {
    return BELT_RANK_ORDER[beltRankStr];
  }
  return 1; // Default to white belt
}

// ---------------------------------------------------------------------------
// 1. Create Tournament (Academy Admin / Master)
// ---------------------------------------------------------------------------
router.post('/', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_TOURNAMENTS), async (req: Request, res: Response) => {
  try {
    const { organizationId, title, name, eventDate, tournamentDate, location, categories, description, ruleset } = req.body;
    const tourneyTitle = title || name;
    if (!tourneyTitle || !organizationId) {
      return res.status(400).json({ error: 'organizationId and title/name are required.' });
    }

    const orgId = req.user!.organizationId || organizationId;
    const tourneyId = `tourn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dateVal = eventDate || tournamentDate || new Date().toISOString().split('T')[0];
    const locVal = location || 'Main Tournament Arena';
    const catVal = Array.isArray(categories) ? categories.join(', ') : (categories || 'Sparring, Forms, Weapons');
    const rSet = ruleset || 'SILAMBAM_STANDARD';

    const insertRes = await dbClient.query(
      `INSERT INTO tournaments (id, organization_id, title, name, event_date, location, categories, ruleset, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tourneyId, orgId, tourneyTitle.trim(), tourneyTitle.trim(), dateVal, locVal, catVal, rSet, 'Upcoming']
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Tournament Scheduled', `Scheduled tournament: ${tourneyTitle.trim()}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({ message: 'Tournament scheduled in PostgreSQL.', tournament: insertRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 2. List tournaments for organization
// ---------------------------------------------------------------------------
router.get('/organization/:orgId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== UserRole.SUPER_ADMIN && (!req.user!.organizationId || req.params.orgId !== req.user!.organizationId)) {
      return res.status(403).json({ error: 'Cross-organization access denied.' });
    }
    const listRes = await dbClient.query(
      `SELECT * FROM tournaments WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.params.orgId]
    );
    return res.json({ tournaments: listRes.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 3. Create Tournament Category
// ---------------------------------------------------------------------------
router.post('/categories', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { tournamentId, name, minAge, maxAge, minBeltRank, maxBeltRank, gender } = req.body;
    if (!tournamentId || !name) {
      return res.status(400).json({ error: 'tournamentId and name are required.' });
    }

    const tRes = await dbClient.query('SELECT organization_id FROM tournaments WHERE id = $1', [tournamentId]);
    if (!tRes.rowCount) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }
    if (req.user!.role !== UserRole.SUPER_ADMIN && tRes.rows[0].organization_id !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Cross-organization access denied.' });
    }

    const catId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertRes = await dbClient.query(
      `INSERT INTO tournament_categories (id, tournament_id, name, min_age, max_age, min_belt_rank, max_belt_rank, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [catId, tournamentId, name.trim(), minAge || null, maxAge || null, minBeltRank || null, maxBeltRank || null, gender || 'OPEN']
    );

    return res.status(201).json({ category: insertRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 4. Register Competitor (H24: category_eligibility_checked)
// ---------------------------------------------------------------------------
router.post('/register', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { tournamentId, categoryId, studentId, organizationId } = req.body;
    if (!tournamentId || !categoryId || !studentId) {
      return res.status(400).json({ error: 'tournamentId, categoryId, and studentId are required.' });
    }

    // 1. Verify tournament
    const tourneyRes = await dbClient.query('SELECT organization_id, status FROM tournaments WHERE id = $1', [tournamentId]);
    if (!tourneyRes.rowCount) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }
    const tourneyOrgId = tourneyRes.rows[0].organization_id;

    // 2. Verify category
    const catRes = await dbClient.query('SELECT * FROM tournament_categories WHERE id = $1 AND tournament_id = $2', [categoryId, tournamentId]);
    if (!catRes.rowCount) {
      return res.status(404).json({ error: 'Tournament category not found.' });
    }
    const category = catRes.rows[0];

    // 3. Verify student
    const stuRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (!stuRes.rowCount) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = stuRes.rows[0];

    // Tenant check: student must belong to user's org, or org must match tournament
    if (req.user!.role !== UserRole.SUPER_ADMIN) {
      if (student.organization_id !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Cross-organization student registration denied.' });
      }
    }

    // 4. Official Criterion: category_eligibility_checked
    // Check Age
    const studentAge = calculateStudentAge(student.date_of_birth, student.ic_number);
    if (category.min_age !== null && studentAge < category.min_age) {
      return res.status(400).json({
        error: 'Ineligible',
        criterion: 'category_eligibility_checked',
        message: `Student age (${studentAge}) is below category minimum age requirement (${category.min_age}).`
      });
    }
    if (category.max_age !== null && studentAge > category.max_age) {
      return res.status(400).json({
        error: 'Ineligible',
        criterion: 'category_eligibility_checked',
        message: `Student age (${studentAge}) exceeds category maximum age requirement (${category.max_age}).`
      });
    }

    // Check Belt Rank
    const studentRank = resolveStudentRank(student.belt_rank, student.rank_order);
    if (category.min_belt_rank !== null && studentRank < category.min_belt_rank) {
      return res.status(400).json({
        error: 'Ineligible',
        criterion: 'category_eligibility_checked',
        message: `Student belt rank level (${studentRank}) does not meet category minimum requirement (${category.min_belt_rank}).`
      });
    }
    if (category.max_belt_rank !== null && studentRank > category.max_belt_rank) {
      return res.status(400).json({
        error: 'Ineligible',
        criterion: 'category_eligibility_checked',
        message: `Student belt rank level (${studentRank}) exceeds category maximum requirement (${category.max_belt_rank}).`
      });
    }

    // Check Gender
    if (category.gender && category.gender !== 'OPEN') {
      const studentGender = (student.gender || '').toUpperCase();
      if (studentGender && studentGender !== 'OPEN' && studentGender !== category.gender.toUpperCase()) {
        return res.status(400).json({
          error: 'Ineligible',
          criterion: 'category_eligibility_checked',
          message: `Student gender (${studentGender}) does not match category requirement (${category.gender}).`
        });
      }
    }

    // Check existing registration
    const existingComp = await dbClient.query(
      'SELECT id FROM tournament_competitors WHERE tournament_id = $1 AND category_id = $2 AND student_id = $3',
      [tournamentId, categoryId, studentId]
    );
    if (existingComp.rowCount) {
      return res.status(200).json({
        message: 'Competitor already registered.',
        competitor: existingComp.rows[0],
        duplicate: true
      });
    }

    const compId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertRes = await dbClient.query(
      `INSERT INTO tournament_competitors (id, tournament_id, category_id, student_id, status)
       VALUES ($1, $2, $3, $4, 'REGISTERED')
       RETURNING *`,
      [compId, tournamentId, categoryId, studentId]
    );

    return res.status(201).json({
      message: 'Competitor registered successfully and verified eligible.',
      competitor: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 5. Create Match
// ---------------------------------------------------------------------------
router.post('/matches', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { tournamentId, categoryId, matchNumber, roundName, competitorAId, competitorBId } = req.body;
    if (!tournamentId || !categoryId || !competitorAId || !competitorBId) {
      return res.status(400).json({ error: 'tournamentId, categoryId, competitorAId, and competitorBId are required.' });
    }

    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertRes = await dbClient.query(
      `INSERT INTO tournament_matches (id, tournament_id, category_id, match_number, round_name, competitor_a_id, competitor_b_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED')
       RETURNING *`,
      [matchId, tournamentId, categoryId, matchNumber || 1, roundName || 'QUARTERFINAL', competitorAId, competitorBId]
    );

    return res.status(201).json({ match: insertRes.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 6. Assign Judge (H24: assignJudge)
// ---------------------------------------------------------------------------
router.post('/assign-judge', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { tournamentId, matchId, judgeId, role } = req.body;
    if (!matchId || !judgeId) {
      return res.status(400).json({ error: 'matchId and judgeId are required.' });
    }

    const matchRes = await dbClient.query('SELECT tournament_id FROM tournament_matches WHERE id = $1', [matchId]);
    if (!matchRes.rowCount) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    const judgeRes = await dbClient.query('SELECT id, role, full_name, email FROM users WHERE id = $1', [judgeId]);
    if (!judgeRes.rowCount) {
      return res.status(404).json({ error: 'Judge user not found.' });
    }

    const assignId = `jass_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const roleVal = role || 'CORNER_JUDGE';

    const insertRes = await dbClient.query(
      `INSERT INTO tournament_judge_assignments (id, match_id, judge_id, role, status)
       VALUES ($1, $2, $3, $4, 'ASSIGNED')
       ON CONFLICT (match_id, judge_id) DO UPDATE SET role = EXCLUDED.role, status = 'ASSIGNED'
       RETURNING *`,
      [assignId, matchId, judgeId, roleVal]
    );

    return res.status(201).json({
      message: 'Judge assigned to match successfully.',
      assignment: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 7. Submit Score (H24: submitScore)
// Acceptance Criteria:
// - judge_only_assigned_match
// - locked_score_requires_appeal
// - duplicate_score_once
// ---------------------------------------------------------------------------
router.post('/matches/:matchId/score', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { competitorId, version, technicalScore, penalties, totalScore, criteriaScores } = req.body;

    if (!competitorId) {
      return res.status(400).json({ error: 'competitorId is required.' });
    }

    const clientVersion = version ? parseInt(version, 10) : 1;
    const techVal = parseFloat(technicalScore || 0);
    const penVal = parseFloat(penalties || 0);
    const totVal = totalScore !== undefined ? parseFloat(totalScore) : (techVal - penVal);
    const critJson = criteriaScores ? JSON.stringify(criteriaScores) : '{}';

    // 1. Verify Match
    const matchRes = await dbClient.query('SELECT * FROM tournament_matches WHERE id = $1', [matchId]);
    if (!matchRes.rowCount) {
      return res.status(404).json({ error: 'Match not found.' });
    }
    const match = matchRes.rows[0];

    // Acceptance Criterion 2: locked_score_requires_appeal
    if (match.status === 'LOCKED') {
      return res.status(409).json({
        error: 'Conflict',
        criterion: 'locked_score_requires_appeal',
        message: 'Match result is locked. Modification requires an approved appeal.'
      });
    }

    // Acceptance Criterion 1: judge_only_assigned_match
    const judgeAssignment = await dbClient.query(
      `SELECT * FROM tournament_judge_assignments 
       WHERE match_id = $1 AND judge_id = $2 AND status = 'ASSIGNED'`,
      [matchId, req.user!.id]
    );

    if (!judgeAssignment.rowCount) {
      return res.status(403).json({
        error: 'Forbidden',
        criterion: 'judge_only_assigned_match',
        message: 'Judge is not assigned to this match.'
      });
    }

    // Acceptance Criterion 4: duplicate_score_once (Idempotency)
    const existingScorecard = await dbClient.query(
      `SELECT * FROM tournament_scorecards 
       WHERE match_id = $1 AND judge_id = $2 AND competitor_id = $3 AND client_version = $4`,
      [matchId, req.user!.id, competitorId, clientVersion]
    );

    if (existingScorecard.rowCount) {
      // Duplicate submission: Return existing scorecard idempotently without double-counting
      return res.status(200).json({
        message: 'Duplicate scorecard submission detected. Handled idempotently.',
        criterion: 'duplicate_score_once',
        scorecard: existingScorecard.rows[0],
        duplicate: true
      });
    }

    // Insert new scorecard
    const cardId = `sc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertRes = await dbClient.query(
      `INSERT INTO tournament_scorecards (id, match_id, judge_id, competitor_id, client_version, technical_score, penalties, total_score, criteria_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [cardId, matchId, req.user!.id, competitorId, clientVersion, techVal, penVal, totVal, critJson]
    );

    // Update match status to IN_PROGRESS if SCHEDULED
    if (match.status === 'SCHEDULED') {
      await dbClient.query(`UPDATE tournament_matches SET status = 'IN_PROGRESS' WHERE id = $1`, [matchId]);
    }

    return res.status(201).json({
      message: 'Score submitted successfully.',
      scorecard: insertRes.rows[0],
      duplicate: false
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 8. Lock Result (H24: lockResult)
// Acceptance Criteria:
// - tie_rule_deterministic
// ---------------------------------------------------------------------------
router.post('/matches/:matchId/lock', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const matchRes = await dbClient.query('SELECT * FROM tournament_matches WHERE id = $1', [matchId]);
    if (!matchRes.rowCount) {
      return res.status(404).json({ error: 'Match not found.' });
    }
    const match = matchRes.rows[0];

    // Check authority: Admin Persatuan or Master
    if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.ADMIN_PERSATUAN && req.user!.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Unauthorized to lock match results.' });
    }

    // Aggregate scorecards for competitor A and competitor B
    const cardsRes = await dbClient.query(
      `SELECT competitor_id, 
              SUM(total_score) as total_sum, 
              SUM(technical_score) as tech_sum, 
              SUM(penalties) as pen_sum,
              COUNT(id) as judges_count
       FROM tournament_scorecards
       WHERE match_id = $1
       GROUP BY competitor_id`,
      [matchId]
    );

    let scoreA = 0;
    let scoreB = 0;
    let techA = 0;
    let techB = 0;
    let penA = 0;
    let penB = 0;

    for (const row of cardsRes.rows) {
      if (row.competitor_id === match.competitor_a_id) {
        scoreA = parseFloat(row.total_sum || 0);
        techA = parseFloat(row.tech_sum || 0);
        penA = parseFloat(row.pen_sum || 0);
      } else if (row.competitor_id === match.competitor_b_id) {
        scoreB = parseFloat(row.total_sum || 0);
        techB = parseFloat(row.tech_sum || 0);
        penB = parseFloat(row.pen_sum || 0);
      }
    }

    // If explicit override scores provided in request body by tournament arbitrator/head judge
    if (req.body.scoreA !== undefined) scoreA = parseFloat(req.body.scoreA);
    if (req.body.scoreB !== undefined) scoreB = parseFloat(req.body.scoreB);
    if (req.body.techA !== undefined) techA = parseFloat(req.body.techA);
    if (req.body.techB !== undefined) techB = parseFloat(req.body.techB);
    if (req.body.penA !== undefined) penA = parseFloat(req.body.penA);
    if (req.body.penB !== undefined) penB = parseFloat(req.body.penB);

    let winnerId: string;
    let tieBreakApplied = false;
    let tieBreakReason: string | null = null;

    // Acceptance Criterion 3: tie_rule_deterministic
    if (scoreA > scoreB) {
      winnerId = match.competitor_a_id;
    } else if (scoreB > scoreA) {
      winnerId = match.competitor_b_id;
    } else {
      // Scores are strictly equal: Apply deterministic tie-breaking sequence
      tieBreakApplied = true;
      if (techA > techB) {
        winnerId = match.competitor_a_id;
        tieBreakReason = 'DETERMINISTIC_TIE_BREAK: HIGHER_TECHNICAL_SCORE';
      } else if (techB > techA) {
        winnerId = match.competitor_b_id;
        tieBreakReason = 'DETERMINISTIC_TIE_BREAK: HIGHER_TECHNICAL_SCORE';
      } else if (penA < penB) {
        winnerId = match.competitor_a_id;
        tieBreakReason = 'DETERMINISTIC_TIE_BREAK: FEWER_PENALTIES';
      } else if (penB < penA) {
        winnerId = match.competitor_b_id;
        tieBreakReason = 'DETERMINISTIC_TIE_BREAK: FEWER_PENALTIES';
      } else {
        // Deterministic seed / competitor ID ordering
        winnerId = match.competitor_a_id < match.competitor_b_id ? match.competitor_a_id : match.competitor_b_id;
        tieBreakReason = 'DETERMINISTIC_TIE_BREAK: DESIGNATED_SEED_PRIORITY';
      }
    }

    const updatedMatchRes = await dbClient.query(
      `UPDATE tournament_matches 
       SET status = 'LOCKED',
           score_a = $1,
           score_b = $2,
           winner_competitor_id = $3,
           tie_break_applied = $4,
           tie_break_reason = $5,
           lock_version = lock_version + 1,
           locked_at = CURRENT_TIMESTAMP,
           locked_by = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [scoreA, scoreB, winnerId, tieBreakApplied, tieBreakReason, req.user!.id, matchId]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'MATCH_RESULT_LOCKED', `Match ${matchId} locked. Winner: ${winnerId}. Tie break applied: ${tieBreakApplied}`, req.user!.role, req.user!.email]
    );

    return res.status(200).json({
      message: 'Match result locked successfully.',
      criterion: 'tie_rule_deterministic',
      match: updatedMatchRes.rows[0]
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 9. Match Appeal (H24: locked_score_requires_appeal)
// ---------------------------------------------------------------------------
router.post('/matches/:matchId/appeal', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { competitorId, reason } = req.body;

    if (!competitorId || !reason) {
      return res.status(400).json({ error: 'competitorId and reason are required.' });
    }

    const matchRes = await dbClient.query('SELECT * FROM tournament_matches WHERE id = $1', [matchId]);
    if (!matchRes.rowCount) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    const appealId = `appl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertRes = await dbClient.query(
      `INSERT INTO tournament_appeals (id, match_id, competitor_id, submitted_by, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [appealId, matchId, competitorId, req.user!.id, reason.trim()]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'MATCH_APPEAL_SUBMITTED', `Appeal submitted for match ${matchId} on competitor ${competitorId}`, req.user!.role, req.user!.email]
    );

    return res.status(201).json({
      message: 'Appeal submitted for review.',
      appeal: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 10. Decide Appeal (Approve/Reject) -> Unlocks match on Approval
// ---------------------------------------------------------------------------
router.post('/appeals/:appealId/decide', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { appealId } = req.params;
    const { decision, decisionNotes } = req.body;

    if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      return res.status(400).json({ error: 'Valid decision ("APPROVED" or "REJECTED") is required.' });
    }

    // Role check: Only Admin Persatuan or Master can decide appeal
    if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.ADMIN_PERSATUAN && req.user!.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Unauthorized to adjudicate appeals.' });
    }

    const appealRes = await dbClient.query('SELECT * FROM tournament_appeals WHERE id = $1', [appealId]);
    if (!appealRes.rowCount) {
      return res.status(404).json({ error: 'Appeal not found.' });
    }
    const appeal = appealRes.rows[0];

    const updatedAppealRes = await dbClient.query(
      `UPDATE tournament_appeals
       SET status = $1, decision_notes = $2, decided_by = $3, decided_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [decision, decisionNotes || null, req.user!.id, appealId]
    );

    let updatedMatch = null;
    if (decision === 'APPROVED') {
      // Unlocks match so scores can be revised/adjudicated
      const mRes = await dbClient.query(
        `UPDATE tournament_matches
         SET status = 'APPEALED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [appeal.match_id]
      );
      updatedMatch = mRes.rows[0];
    }

    return res.status(200).json({
      message: `Appeal has been ${decision.toLowerCase()}.`,
      appeal: updatedAppealRes.rows[0],
      match: updatedMatch
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 11. Get Match Details with Scorecards, Judges and Appeals
// ---------------------------------------------------------------------------
router.get('/matches/:matchId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const matchRes = await dbClient.query(
      `SELECT m.*, 
              t.name as tournament_name,
              c.name as category_name,
              ca.student_id as student_a_id,
              sa.full_name as student_a_name,
              cb.student_id as student_b_id,
              sb.full_name as student_b_name
       FROM tournament_matches m
       JOIN tournaments t ON t.id = m.tournament_id
       JOIN tournament_categories c ON c.id = m.category_id
       JOIN tournament_competitors ca ON ca.id = m.competitor_a_id
       JOIN students sa ON sa.id = ca.student_id
       JOIN tournament_competitors cb ON cb.id = m.competitor_b_id
       JOIN students sb ON sb.id = cb.student_id
       WHERE m.id = $1`,
      [matchId]
    );

    if (!matchRes.rowCount) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    const judgesRes = await dbClient.query(
      `SELECT a.*, u.full_name as judge_name, u.email as judge_email
       FROM tournament_judge_assignments a
       JOIN users u ON u.id = a.judge_id
       WHERE a.match_id = $1 AND a.status = 'ASSIGNED'`,
      [matchId]
    );

    const scorecardsRes = await dbClient.query(
      `SELECT s.*, u.full_name as judge_name
       FROM tournament_scorecards s
       JOIN users u ON u.id = s.judge_id
       WHERE s.match_id = $1
       ORDER BY s.submitted_at ASC`,
      [matchId]
    );

    const appealsRes = await dbClient.query(
      `SELECT * FROM tournament_appeals WHERE match_id = $1 ORDER BY created_at DESC`,
      [matchId]
    );

    return res.json({
      match: matchRes.rows[0],
      judges: judgesRes.rows,
      scorecards: scorecardsRes.rows,
      appeals: appealsRes.rows
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 12. List Tournament Matches
// ---------------------------------------------------------------------------
router.get('/:tournamentId/matches', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const matchesRes = await dbClient.query(
      `SELECT m.*, 
              c.name as category_name,
              sa.full_name as student_a_name,
              sb.full_name as student_b_name
       FROM tournament_matches m
       JOIN tournament_categories c ON c.id = m.category_id
       JOIN tournament_competitors ca ON ca.id = m.competitor_a_id
       JOIN students sa ON sa.id = ca.student_id
       JOIN tournament_competitors cb ON cb.id = m.competitor_b_id
       JOIN students sb ON sb.id = cb.student_id
       WHERE m.tournament_id = $1
       ORDER BY m.match_number ASC`,
      [tournamentId]
    );

    return res.json({ matches: matchesRes.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// 13. Record Tournament Medals & Issue Certificates (Legacy H13 retained)
// ---------------------------------------------------------------------------
router.post('/:id/results', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_TOURNAMENTS), async (req: Request, res: Response) => {
  try {
    const tourneyId = req.params.id;
    const { organizationId, results } = req.body;
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'results array is required.' });
    }
    const tournament = await dbClient.query('SELECT organization_id, status FROM tournaments WHERE id = $1', [tourneyId]);
    if (!tournament.rowCount) return res.status(404).json({ error: 'Tournament not found.' });
    if (tournament.rows[0].organization_id !== req.user!.organizationId && req.user!.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Cross-organization access denied.' });
    }
    if (tournament.rows[0].status === 'Completed') {
      return res.status(409).json({ error: 'Tournament results have already been finalized.' });
    }
    for (const result of results) {
      const student = await dbClient.query('SELECT organization_id FROM students WHERE id = $1', [result.studentId]);
      if (student.rows[0]?.organization_id !== req.user!.organizationId && req.user!.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Tournament student access denied.' });
      }
    }

    const orgId = req.user!.organizationId || organizationId;
    const orgRes = await dbClient.query('SELECT name, master_name FROM organizations WHERE id = $1', [orgId]);
    const orgData = orgRes.rows[0] || { name: 'Academy', master_name: 'Chief Examiner' };

    const issuedCertificates: any[] = [];
    const dateVal = new Date().toISOString().split('T')[0];

    for (const r of results) {
      if (r.medal && r.medal !== 'None') {
        await dbClient.query(
          `INSERT INTO tournament_participants (id, tournament_id, student_id, category, medal, cert_code, awarded_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [`tp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, tourneyId, r.studentId, r.category || 'Division', r.medal, null]
        );

        if (r.medal !== 'Participant') {
          const stuRes = await dbClient.query('SELECT full_name FROM students WHERE id = $1', [r.studentId]);
          const stuName = stuRes.rows[0]?.full_name || 'Student';
          const certCode = `BF-MED-${stuName.substring(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

          const certRes = await dbClient.query(
            `INSERT INTO certificates (id, code, organization_id, organization_name, student_id, student_name, master_name, rank_or_title, type, issue_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [`cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, certCode, orgId, orgData.name, r.studentId, stuName, orgData.master_name, `${r.medal} Medal`, 'Tournament Medal', dateVal, 'ACTIVE']
          );
          issuedCertificates.push(certRes.rows[0]);
        }
      }
    }

    await dbClient.query(`UPDATE tournaments SET status = 'Completed' WHERE id = $1`, [tourneyId]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Tournament Results Finalized',
       `Finalized results for tournament ${tourneyId} (${results.length} entries, ${issuedCertificates.length} certificates issued)`,
       req.user!.role, req.user!.email]
    );

    return res.json({
      message: 'Tournament results and certificates recorded in PostgreSQL.',
      count: issuedCertificates.length,
      certificates: issuedCertificates,
      issuedCertificates
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
