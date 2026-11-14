import { apiClient } from './apiClient';

export interface ReadinessPassport {
  studentId: string;
  fullName: string;
  currentBelt: string;
  currentBeltColor?: string;
  nextEligibleBelt: {
    id: string;
    name: string;
    orderIndex: number;
    colorHex: string;
    minDurationMonths: number;
    minSessions: number;
  } | null;
  attendance: {
    totalSessions: number;
    minSessionsRequired: number;
  };
  trainingDuration: {
    months: number;
    minMonthsRequired: number;
  };
  skills: {
    achievedCount: number;
    needingImprovementCount: number;
    skillsAchieved: any[];
    skillsNeedingImprovement: any[];
    allSkills: any[];
  };
  eligibilityStatus: 'NOT YET ELIGIBLE' | 'IN PROGRESS' | 'READY FOR REVIEW' | 'APPROVED FOR GRADING' | 'COMPLETED';
  requirements: {
    minSessions: number;
    minMonths: number;
    minSkills: number;
  };
  readinessRecommendation: string;
  rankHistory: any[];
  activeNomination?: any | null;
}

export interface SkillAssessmentInput {
  studentId: string;
  skillId: string;
  skillName?: string;
  category?: string;
  level: 'Beginner' | 'Needs Work' | 'Developing' | 'Proficient' | 'Mastered';
  criteria?: {
    technique?: number;
    accuracy?: number;
    power?: number;
    speed?: number;
    coordination?: number;
    balance?: number;
    discipline?: number;
    performance?: number;
    knowledge?: number;
    [key: string]: number | undefined;
  };
  notes?: string;
}

export interface FinalizeGradingResultItem {
  studentId: string;
  result: 'Passed' | 'Failed' | 'Double Promotion' | 'Withdrawn';
  targetBelt: string;
  examinerScore?: number;
  criteriaScores?: Record<string, number>;
  notes?: string;
}

export interface GradingEvent {
  id: string;
  organization_id: string;
  title: string;
  event_date: string;
  location?: string;
  fee?: number | string;
  curriculum_id?: string;
  chief_examiner_id?: string;
  chief_examiner_name?: string;
  status: 'DRAFT' | 'REGISTRATION_OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'FINALIZED' | 'CANCELLED';
  version: number;
  candidates?: any[];
  candidate_count?: number;
  created_at: string;
}

export const gradingService = {
  async getReadinessPassport(studentId: string): Promise<ReadinessPassport> {
    return await apiClient.get<ReadinessPassport>(`/api/v1/grading/readiness/${studentId}`);
  },

  async recordSkillAssessment(input: SkillAssessmentInput): Promise<{ message: string; assessment: any }> {
    return await apiClient.post<{ message: string; assessment: any }>('/api/v1/skills/assess', input);
  },

  async getStudentProgress(studentId: string): Promise<{
    studentId: string;
    fullName: string;
    currentBelt: string;
    rankHistory: any[];
    skills: any[];
    certificates: any[];
  }> {
    return await apiClient.get(`/api/v1/students/${studentId}/progress`);
  },

  async getGradingEvents(orgId: string): Promise<GradingEvent[]> {
    const res = await apiClient.get<{ gradingEvents: GradingEvent[] }>(`/api/v1/grading/organization/${orgId}`);
    return res.gradingEvents || [];
  },

  async getGradingEvent(eventId: string): Promise<{ event: GradingEvent; candidates: any[] }> {
    return await apiClient.get(`/api/v1/grading/${eventId}`);
  },

  async createGradingEvent(data: {
    organizationId: string;
    title: string;
    eventDate: string;
    location?: string;
    fee?: number;
    curriculumId?: string;
    chiefExaminerId?: string;
    status?: string;
  }): Promise<{ message: string; event: GradingEvent }> {
    return await apiClient.post('/api/v1/grading', data);
  },

  async nominateCandidate(
    eventId: string,
    studentId: string,
    targetBelt: string,
    notes?: string
  ): Promise<{ message: string; candidate: any }> {
    return await apiClient.post(`/api/v1/grading/${eventId}/nominate`, {
      studentId,
      targetBelt,
      notes,
    });
  },

  async finalizeGrading(
    eventId: string,
    expectedVersion: number,
    results: FinalizeGradingResultItem[]
  ): Promise<{ message: string; event: GradingEvent; issuedCertificates: any[] }> {
    return await apiClient.post(`/api/v1/grading/${eventId}/finalize`, {
      expectedVersion,
      results,
    });
  },

  async revokeCertificate(
    certificateId: string,
    reason: string
  ): Promise<{ message: string; certificate: any }> {
    return await apiClient.post(`/api/v1/certificates/${certificateId}/revoke`, { reason });
  },

  async getStudentCertificates(studentId: string): Promise<any[]> {
    const res = await apiClient.get<{ certificates: any[] }>(`/api/v1/certificates/student/${studentId}`);
    return res.certificates || [];
  },
};
