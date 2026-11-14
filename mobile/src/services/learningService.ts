import { apiClient } from './apiClient';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface LearningLesson {
  id: string;
  organizationId?: string;
  organization_id?: string;
  curriculumId?: string;
  curriculum_id?: string;
  targetRankId?: string;
  target_rank_id?: string;
  targetRankName?: string;
  target_rank_name?: string;
  targetRankColor?: string;
  target_rank_color?: string;
  authorMasterId?: string;
  author_master_id?: string;
  authorName?: string;
  author_name?: string;
  title: string;
  description?: string;
  category: 'POOMSAE' | 'SPARRING' | 'SELF_DEFENSE' | 'FITNESS' | 'THEORY' | 'SILAMBAM';
  contentBody?: string;
  content_body?: string;
  mediaUrls?: string[];
  media_urls?: string[] | string;
  quizQuestions?: QuizQuestion[];
  quiz_questions?: QuizQuestion[] | string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  published_at?: string;
  version: number;
  createdAt?: string;
  created_at?: string;
}

export interface StudentLessonProgress {
  id: string;
  studentId: string;
  student_id?: string;
  lessonId: string;
  lesson_id?: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  quizScore?: number;
  quiz_score?: number | string;
  quizAnswers?: Record<string, number>;
  completedAt?: string;
  completed_at?: string;
}

export interface PerformanceAssessment {
  id: string;
  studentId: string;
  student_id?: string;
  assessorMasterId: string;
  assessorName?: string;
  assessor_name?: string;
  curriculumId: string;
  rubricVersion: number;
  rubric_version?: number;
  rubricSchemaId: string;
  rubric_schema_id?: string;
  skillCategory: string;
  skill_category?: string;
  score: number | string;
  maxScore: number | string;
  max_score?: number | string;
  criteriaBreakdown?: Record<string, number>;
  criteria_breakdown?: Record<string, number> | string;
  notes?: string;
  assessedAt: string;
  assessed_at?: string;
}

export interface StudentAchievement {
  id: string;
  studentId: string;
  student_id?: string;
  eventId: string;
  event_id?: string;
  badgeCode: string;
  badge_code?: string;
  badgeTitle: string;
  badge_title?: string;
  badgeDescription?: string;
  badge_description?: string;
  category: 'SKILL' | 'ATTENDANCE' | 'LEARNING' | 'SPORTSMANSHIP';
  awardedByUserName?: string;
  awarded_by_name?: string;
  awardedAt: string;
  awarded_at?: string;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt?: string;
  revocationReason?: string;
}

export interface StudentPerformanceSummary {
  studentId: string;
  assessments: PerformanceAssessment[];
  partitionedByRubric: Record<string, PerformanceAssessment[]>;
  rubricVersions: string[];
  crossRubricIncompatible: boolean;
  comparisonWarning?: string | null;
  leaderboardPosition: null;
  globalRankingDisabled: boolean;
}

export const learningService = {
  /**
   * Fetch approved learning lessons list
   * (Students and parents will only receive PUBLISHED lessons)
   */
  async getLessons(filter?: { category?: string; curriculumId?: string; status?: string }): Promise<LearningLesson[]> {
    const params = new URLSearchParams();
    if (filter?.category) params.append('category', filter.category);
    if (filter?.curriculumId) params.append('curriculumId', filter.curriculumId);
    if (filter?.status) params.append('status', filter.status);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{ lessons: LearningLesson[] }>(`/learning/lessons${query}`);
    return res.lessons || [];
  },

  /**
   * Get single lesson details
   */
  async getLessonDetails(lessonId: string): Promise<LearningLesson> {
    const res = await apiClient.get<{ lesson: LearningLesson }>(`/learning/lessons/${lessonId}`);
    return res.lesson;
  },

  /**
   * Publish or draft a learning lesson (Master / Admin)
   */
  async publishLesson(input: {
    title: string;
    description?: string;
    category: string;
    contentBody?: string;
    mediaUrls?: string[];
    quizQuestions?: QuizQuestion[];
    curriculumId?: string;
    targetRankId?: string;
    status: 'DRAFT' | 'PUBLISHED';
  }): Promise<LearningLesson> {
    const res = await apiClient.post<{ lesson: LearningLesson }>('/learning/lessons', input);
    return res.lesson;
  },

  /**
   * Record progress / quiz answers for a lesson
   * Note: Completing learning modules never alters formal belt ranks.
   */
  async recordLessonProgress(
    lessonId: string,
    input: {
      studentId: string;
      quizScore?: number;
      quizAnswers?: Record<string, number>;
      status: 'IN_PROGRESS' | 'COMPLETED';
    }
  ): Promise<{
    success: boolean;
    progress: StudentLessonProgress;
    formalGradingOccurred: boolean;
    message: string;
  }> {
    return await apiClient.post(`/learning/lessons/${lessonId}/progress`, input);
  },

  /**
   * Record formative performance assessment using versioned rubrics
   */
  async recordAssessment(input: {
    studentId: string;
    curriculumId: string;
    rubricSchemaId: string;
    rubricVersion: number;
    skillCategory: string;
    score: number;
    maxScore?: number;
    criteriaBreakdown?: Record<string, number>;
    notes?: string;
  }): Promise<PerformanceAssessment> {
    const res = await apiClient.post<{ assessment: PerformanceAssessment }>('/learning/assessments', input);
    return res.assessment;
  },

  /**
   * Get student performance history with versioned rubric isolation
   * and strict child privacy guarantees (no child leaderboards)
   */
  async getStudentPerformance(studentId: string, compareRubrics = true): Promise<StudentPerformanceSummary> {
    const query = compareRubrics ? '?compareRubrics=true' : '';
    return await apiClient.get<StudentPerformanceSummary>(`/learning/students/${studentId}/performance${query}`);
  },

  /**
   * Award verified achievement badge
   * Event replay is strictly idempotent
   */
  async awardAchievement(input: {
    eventId: string;
    studentId: string;
    badgeCode: string;
    badgeTitle: string;
    badgeDescription?: string;
    category?: string;
  }): Promise<{ achievement: StudentAchievement; isDuplicateReplay: boolean; created: boolean }> {
    return await apiClient.post('/learning/achievements/award', input);
  },

  /**
   * Revoke achievement with mandatory audit trail
   */
  async revokeAchievement(awardId: string, reason: string): Promise<{ success: boolean; achievement: StudentAchievement }> {
    return await apiClient.post(`/learning/achievements/${awardId}/revoke`, { reason });
  },

  /**
   * Get student's verified achievements
   */
  async getStudentAchievements(studentId: string): Promise<StudentAchievement[]> {
    const res = await apiClient.get<{ achievements: StudentAchievement[] }>(`/learning/students/${studentId}/achievements`);
    return res.achievements || [];
  },
};
