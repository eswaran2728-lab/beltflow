import { tournamentService } from '../services/tournamentService';
import { apiClient } from '../services/apiClient';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

describe('Task H24: Tournament Operations and Judging Mobile Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Criterion 1: category_eligibility_checked
  // =========================================================================
  test('registerCompetitor calls /tournaments/register and validates category eligibility', async () => {
    const mockSuccessResponse = {
      message: 'Competitor registered successfully and verified eligible.',
      competitor: {
        id: 'comp_123',
        tournament_id: 'tourn_01',
        category_id: 'cat_junior_boys',
        student_id: 'stu_01',
        status: 'REGISTERED',
        registered_at: '2026-10-21T07:00:00.000Z',
      },
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);

    const result = await tournamentService.registerCompetitor({
      tournamentId: 'tourn_01',
      categoryId: 'cat_junior_boys',
      studentId: 'stu_01',
      organizationId: 'org_selangor',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/tournaments/register', {
      tournamentId: 'tourn_01',
      categoryId: 'cat_junior_boys',
      studentId: 'stu_01',
      organizationId: 'org_selangor',
    });
    expect(result.competitor.id).toBe('comp_123');
    expect(result.competitor.status).toBe('REGISTERED');
  });

  test('registerCompetitor propagates ineligibility rejection error', async () => {
    const errorResponse = {
      response: {
        status: 400,
        data: {
          error: 'Ineligible',
          criterion: 'category_eligibility_checked',
          message: 'Student age (8) is below category minimum age requirement (12).',
        },
      },
    };

    (apiClient.post as jest.Mock).mockRejectedValueOnce(errorResponse);

    await expect(
      tournamentService.registerCompetitor({
        tournamentId: 'tourn_01',
        categoryId: 'cat_junior_boys',
        studentId: 'stu_underage',
      })
    ).rejects.toEqual(errorResponse);
  });

  // =========================================================================
  // Criterion 2: judge_only_assigned_match
  // =========================================================================
  test('submitScore calls match score endpoint and enforces assigned judge authorization', async () => {
    const mockScoreResponse = {
      message: 'Score submitted successfully.',
      scorecard: {
        id: 'sc_01',
        match_id: 'match_01',
        judge_id: 'judge_assigned_01',
        competitor_id: 'comp_123',
        client_version: 1,
        technical_score: 8.8,
        penalties: 0.2,
        total_score: 8.6,
        submitted_at: '2026-10-21T07:05:00.000Z',
      },
      duplicate: false,
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockScoreResponse);

    const result = await tournamentService.submitScore('match_01', 1, {
      competitorId: 'comp_123',
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6,
    });

    expect(apiClient.post).toHaveBeenCalledWith('/tournaments/matches/match_01/score', {
      version: 1,
      competitorId: 'comp_123',
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6,
    });
    expect(result.duplicate).toBe(false);
    expect(result.scorecard.total_score).toBe(8.6);
  });

  test('submitScore throws 403 Forbidden when unassigned judge attempts scoring', async () => {
    const forbiddenError = {
      response: {
        status: 403,
        data: {
          error: 'Forbidden',
          criterion: 'judge_only_assigned_match',
          message: 'Judge is not assigned to this match.',
        },
      },
    };

    (apiClient.post as jest.Mock).mockRejectedValueOnce(forbiddenError);

    await expect(
      tournamentService.submitScore('match_01', 1, {
        competitorId: 'comp_123',
        technicalScore: 8.5,
        penalties: 0.0,
      })
    ).rejects.toEqual(forbiddenError);
  });

  // =========================================================================
  // Criterion 3: duplicate_score_once
  // =========================================================================
  test('submitScore handles duplicate scorecard idempotently without error', async () => {
    const mockDuplicateResponse = {
      message: 'Duplicate scorecard submission detected. Handled idempotently.',
      criterion: 'duplicate_score_once',
      scorecard: {
        id: 'sc_01',
        match_id: 'match_01',
        judge_id: 'judge_assigned_01',
        competitor_id: 'comp_123',
        client_version: 1,
        technical_score: 8.8,
        penalties: 0.2,
        total_score: 8.6,
        submitted_at: '2026-10-21T07:05:00.000Z',
      },
      duplicate: true,
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockDuplicateResponse);

    const result = await tournamentService.submitScore('match_01', 1, {
      competitorId: 'comp_123',
      technicalScore: 8.8,
      penalties: 0.2,
      totalScore: 8.6,
    });

    expect(result.duplicate).toBe(true);
    expect(result.scorecard.id).toBe('sc_01');
  });

  // =========================================================================
  // Criterion 4: tie_rule_deterministic
  // =========================================================================
  test('lockResult applies deterministic tie-breaking sequence and records winner', async () => {
    const mockLockResponse = {
      message: 'Match result locked successfully.',
      criterion: 'tie_rule_deterministic',
      match: {
        id: 'match_01',
        tournament_id: 'tourn_01',
        category_id: 'cat_01',
        match_number: 1,
        round_name: 'FINAL',
        competitor_a_id: 'comp_a',
        competitor_b_id: 'comp_b',
        status: 'LOCKED',
        score_a: 8.6,
        score_b: 8.6,
        winner_competitor_id: 'comp_a',
        tie_break_applied: true,
        tie_break_reason: 'DETERMINISTIC_TIE_BREAK: HIGHER_TECHNICAL_SCORE',
        lock_version: 2,
        locked_at: '2026-10-21T07:10:00.000Z',
      },
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockLockResponse);

    const result = await tournamentService.lockResult('match_01');

    expect(apiClient.post).toHaveBeenCalledWith('/tournaments/matches/match_01/lock', {});
    expect(result.criterion).toBe('tie_rule_deterministic');
    expect(result.match.status).toBe('LOCKED');
    expect(result.match.tie_break_applied).toBe(true);
    expect(result.match.tie_break_reason).toBe('DETERMINISTIC_TIE_BREAK: HIGHER_TECHNICAL_SCORE');
    expect(result.match.winner_competitor_id).toBe('comp_a');
  });

  // =========================================================================
  // Criterion 5: locked_score_requires_appeal
  // =========================================================================
  test('locked match requires appeal: submits appeal and unlocks on approval', async () => {
    // 1. Submit to locked match fails with 409 Conflict
    const conflictError = {
      response: {
        status: 409,
        data: {
          error: 'Conflict',
          criterion: 'locked_score_requires_appeal',
          message: 'Match result is locked. Modification requires an approved appeal.',
        },
      },
    };
    (apiClient.post as jest.Mock).mockRejectedValueOnce(conflictError);

    await expect(
      tournamentService.submitScore('match_01', 2, {
        competitorId: 'comp_b',
        technicalScore: 9.0,
        penalties: 0.0,
      })
    ).rejects.toEqual(conflictError);

    // 2. Submit appeal
    const mockAppealResponse = {
      message: 'Appeal submitted for review.',
      appeal: {
        id: 'appl_01',
        match_id: 'match_01',
        competitor_id: 'comp_b',
        submitted_by: 'coach_b',
        reason: 'Judges missed weapon rotation flourish.',
        status: 'PENDING',
        created_at: '2026-10-21T07:15:00.000Z',
      },
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockAppealResponse);

    const appealResult = await tournamentService.appealResult('match_01', {
      competitorId: 'comp_b',
      reason: 'Judges missed weapon rotation flourish.',
    });
    expect(appealResult.appeal.id).toBe('appl_01');
    expect(appealResult.appeal.status).toBe('PENDING');

    // 3. Head judge decides appeal
    const mockDecisionResponse = {
      message: 'Appeal has been approved.',
      appeal: {
        id: 'appl_01',
        status: 'APPROVED',
        decision_notes: 'Video review confirmed stick flourish technique.',
      },
      match: {
        id: 'match_01',
        status: 'APPEALED',
      },
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockDecisionResponse);

    const decisionResult = await tournamentService.decideAppeal('appl_01', {
      decision: 'APPROVED',
      decisionNotes: 'Video review confirmed stick flourish technique.',
    });
    expect(decisionResult.appeal.status).toBe('APPROVED');
    expect(decisionResult.match?.status).toBe('APPEALED');
  });

  test('assignJudge calls /tournaments/assign-judge', async () => {
    const mockAssignment = {
      message: 'Judge assigned to match successfully.',
      assignment: {
        id: 'jass_01',
        match_id: 'match_01',
        judge_id: 'user_master_1',
        role: 'CORNER_JUDGE',
        status: 'ASSIGNED',
        assigned_at: '2026-10-21T07:00:00.000Z',
      },
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockAssignment);

    const res = await tournamentService.assignJudge({
      matchId: 'match_01',
      judgeId: 'user_master_1',
      role: 'CORNER_JUDGE',
    });
    expect(res.assignment.id).toBe('jass_01');
    expect(res.assignment.status).toBe('ASSIGNED');
  });

  test('getMatchDetails fetches match, judges, scorecards and appeals', async () => {
    const mockDetails = {
      match: {
        id: 'match_01',
        tournament_id: 'tourn_01',
        status: 'IN_PROGRESS',
      },
      judges: [],
      scorecards: [],
      appeals: [],
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce(mockDetails);

    const res = await tournamentService.getMatchDetails('match_01');
    expect(apiClient.get).toHaveBeenCalledWith('/tournaments/matches/match_01');
    expect(res.match.id).toBe('match_01');
  });
});
