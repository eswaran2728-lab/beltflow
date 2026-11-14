import { apiClient } from './apiClient';

export interface Tournament {
  id: string;
  organization_id: string;
  name?: string;
  title?: string;
  ruleset?: string;
  status: string;
  event_date?: string;
  location?: string;
  categories?: string;
  created_at: string;
}

export interface TournamentCategory {
  id: string;
  tournament_id: string;
  name: string;
  min_age?: number | null;
  max_age?: number | null;
  min_belt_rank?: number | null;
  max_belt_rank?: number | null;
  gender: string;
  created_at: string;
}

export interface TournamentCompetitor {
  id: string;
  tournament_id: string;
  category_id: string;
  student_id: string;
  status: string;
  registered_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  category_id: string;
  match_number: number;
  round_name: string;
  competitor_a_id: string;
  competitor_b_id: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'SCORED' | 'LOCKED' | 'APPEALED';
  score_a: number;
  score_b: number;
  winner_competitor_id?: string | null;
  tie_break_applied: boolean;
  tie_break_reason?: string | null;
  lock_version: number;
  locked_at?: string | null;
  locked_by?: string | null;
  student_a_name?: string;
  student_b_name?: string;
  category_name?: string;
}

export interface TournamentScorecard {
  id: string;
  match_id: string;
  judge_id: string;
  competitor_id: string;
  client_version: number;
  technical_score: number;
  penalties: number;
  total_score: number;
  criteria_scores?: any;
  submitted_at: string;
}

export interface TournamentJudgeAssignment {
  id: string;
  match_id: string;
  judge_id: string;
  role: 'CORNER_JUDGE' | 'HEAD_JUDGE' | 'REFEREE' | 'ARBITRATOR';
  status: 'ASSIGNED' | 'ACTIVE' | 'REVOKED';
  assigned_at: string;
  judge_name?: string;
}

export interface TournamentAppeal {
  id: string;
  match_id: string;
  competitor_id: string;
  submitted_by: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decision_notes?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export const tournamentService = {
  async getTournaments(orgId: string): Promise<Tournament[]> {
    const res = await apiClient.get<{ tournaments: Tournament[] }>(`/tournaments/organization/${encodeURIComponent(orgId)}`);
    return res.tournaments || [];
  },

  async createTournament(data: {
    organizationId: string;
    title: string;
    eventDate?: string;
    location?: string;
    ruleset?: string;
    categories?: string | string[];
  }): Promise<Tournament> {
    const res = await apiClient.post<{ tournament: Tournament }>('/tournaments', data);
    return res.tournament;
  },

  async createCategory(data: {
    tournamentId: string;
    name: string;
    minAge?: number;
    maxAge?: number;
    minBeltRank?: number;
    maxBeltRank?: number;
    gender?: string;
  }): Promise<TournamentCategory> {
    const res = await apiClient.post<{ category: TournamentCategory }>('/tournaments/categories', data);
    return res.category;
  },

  async registerCompetitor(data: {
    tournamentId: string;
    categoryId: string;
    studentId: string;
    organizationId?: string;
  }): Promise<{ competitor: TournamentCompetitor; message: string; duplicate?: boolean }> {
    return apiClient.post('/tournaments/register', data);
  },

  async createMatch(data: {
    tournamentId: string;
    categoryId: string;
    matchNumber: number;
    roundName?: string;
    competitorAId: string;
    competitorBId: string;
  }): Promise<TournamentMatch> {
    const res = await apiClient.post<{ match: TournamentMatch }>('/tournaments/matches', data);
    return res.match;
  },

  async assignJudge(data: {
    tournamentId?: string;
    matchId: string;
    judgeId: string;
    role?: string;
  }): Promise<{ message: string; assignment: TournamentJudgeAssignment }> {
    return apiClient.post('/tournaments/assign-judge', data);
  },

  async submitScore(
    matchId: string,
    version: number,
    score: {
      competitorId: string;
      technicalScore: number;
      penalties: number;
      totalScore?: number;
      criteriaScores?: any;
    }
  ): Promise<{ message: string; scorecard: TournamentScorecard; duplicate: boolean }> {
    return apiClient.post(`/tournaments/matches/${encodeURIComponent(matchId)}/score`, {
      version,
      ...score,
    });
  },

  async lockResult(
    matchId: string,
    overrides?: {
      scoreA?: number;
      scoreB?: number;
      techA?: number;
      techB?: number;
      penA?: number;
      penB?: number;
    }
  ): Promise<{ message: string; criterion: string; match: TournamentMatch }> {
    return apiClient.post(`/tournaments/matches/${encodeURIComponent(matchId)}/lock`, overrides || {});
  },

  async appealResult(
    matchId: string,
    data: {
      competitorId: string;
      reason: string;
    }
  ): Promise<{ message: string; appeal: TournamentAppeal }> {
    return apiClient.post(`/tournaments/matches/${encodeURIComponent(matchId)}/appeal`, data);
  },

  async decideAppeal(
    appealId: string,
    data: {
      decision: 'APPROVED' | 'REJECTED';
      decisionNotes?: string;
    }
  ): Promise<{ message: string; appeal: TournamentAppeal; match?: TournamentMatch }> {
    return apiClient.post(`/tournaments/appeals/${encodeURIComponent(appealId)}/decide`, data);
  },

  async getMatchDetails(matchId: string): Promise<{
    match: TournamentMatch;
    judges: TournamentJudgeAssignment[];
    scorecards: TournamentScorecard[];
    appeals: TournamentAppeal[];
  }> {
    return apiClient.get(`/tournaments/matches/${encodeURIComponent(matchId)}`);
  },

  async getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
    const res = await apiClient.get<{ matches: TournamentMatch[] }>(`/tournaments/${encodeURIComponent(tournamentId)}/matches`);
    return res.matches || [];
  },
};
