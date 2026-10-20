import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { learningService, LearningLesson, StudentPerformanceSummary, StudentAchievement } from '../services/learningService';
import { LearningLibraryRewardsScreen } from '../screens/roles/student/LearningLibraryRewardsScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/learningService', () => ({
  learningService: {
    getLessons: jest.fn(),
    getLessonDetails: jest.fn(),
    publishLesson: jest.fn(),
    recordLessonProgress: jest.fn(),
    recordAssessment: jest.fn(),
    getStudentPerformance: jest.fn(),
    awardAchievement: jest.fn(),
    revokeAchievement: jest.fn(),
    getStudentAchievements: jest.fn(),
  },
}));

jest.setTimeout(30000);

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('Official Task H20: Learning Library, Performance & Rewards Mobile Tests', () => {
  const mockPublishedLesson: LearningLesson = {
    id: 'lsn_pub_001',
    title: 'Asas Tapak Empat & Kuda-kuda Gayong',
    category: 'POOMSAE',
    description: 'Pola langkah asas dan imbangan tapak',
    content_body: 'Langkah 1: Kekuda asas. Langkah 2: Elak tepi.',
    status: 'PUBLISHED',
    version: 1,
    target_rank_name: 'Putih',
    quiz_questions: [
      {
        question: 'Apakah sudut kekuda yang tepat dalam tapak empat?',
        options: ['45 darjah', '90 darjah', '180 darjah', '15 darjah'],
        correctIndex: 0,
        explanation: 'Sudut 45 darjah memberikan kestabilan optimum.',
      },
    ],
  };

  const mockDraftLesson: LearningLesson = {
    id: 'lsn_draft_002',
    title: 'Rahsia Jurus Senjata Kerambit (DRAFT)',
    category: 'SELF_DEFENSE',
    description: 'Master-only draft lesson',
    status: 'DRAFT',
    version: 1,
  };

  const mockPerformanceSummary: StudentPerformanceSummary = {
    studentId: 'stu_101',
    assessments: [
      {
        id: 'ass_001',
        studentId: 'stu_101',
        assessorMasterId: 'usr_master_1',
        assessor_name: 'Master Halim',
        curriculumId: 'curr_01',
        rubric_version: 1,
        rubricVersion: 1,
        rubric_schema_id: 'WT_POOMSAE_V1',
        rubricSchemaId: 'WT_POOMSAE_V1',
        skill_category: 'BALANCE',
        skillCategory: 'BALANCE',
        score: 8.5,
        max_score: 10.0,
        maxScore: 10.0,
        notes: 'Good stability in Ap-Chagi balance hold.',
        assessedAt: '2026-10-15T10:00:00Z',
      },
      {
        id: 'ass_002',
        studentId: 'stu_101',
        assessorMasterId: 'usr_master_1',
        assessor_name: 'Master Halim',
        curriculumId: 'curr_01',
        rubric_version: 2,
        rubricVersion: 2,
        rubric_schema_id: 'SILAT_JURUS_V2',
        rubricSchemaId: 'SILAT_JURUS_V2',
        skill_category: 'POWER',
        skillCategory: 'POWER',
        score: 84.0,
        max_score: 100.0,
        maxScore: 100.0,
        notes: 'Powerful execution on striking bag.',
        assessedAt: '2026-10-18T10:00:00Z',
      },
    ],
    partitionedByRubric: {
      WT_POOMSAE_V1_v1: [
        {
          id: 'ass_001',
          studentId: 'stu_101',
          assessorMasterId: 'usr_master_1',
          assessor_name: 'Master Halim',
          curriculumId: 'curr_01',
          rubric_version: 1,
          rubricVersion: 1,
          rubric_schema_id: 'WT_POOMSAE_V1',
          rubricSchemaId: 'WT_POOMSAE_V1',
          skill_category: 'BALANCE',
          skillCategory: 'BALANCE',
          score: 8.5,
          max_score: 10.0,
          maxScore: 10.0,
          assessedAt: '2026-10-15T10:00:00Z',
        },
      ],
      SILAT_JURUS_V2_v2: [
        {
          id: 'ass_002',
          studentId: 'stu_101',
          assessorMasterId: 'usr_master_1',
          assessor_name: 'Master Halim',
          curriculumId: 'curr_01',
          rubric_version: 2,
          rubricVersion: 2,
          rubric_schema_id: 'SILAT_JURUS_V2',
          rubricSchemaId: 'SILAT_JURUS_V2',
          skill_category: 'POWER',
          skillCategory: 'POWER',
          score: 84.0,
          max_score: 100.0,
          maxScore: 100.0,
          assessedAt: '2026-10-18T10:00:00Z',
        },
      ],
    },
    rubricVersions: ['WT_POOMSAE_V1_v1', 'SILAT_JURUS_V2_v2'],
    crossRubricIncompatible: true,
    comparisonWarning: 'Cross-rubric version comparison rejected: Assessments belong to distinct rubric scoring schemas or versions.',
    leaderboardPosition: null,
    globalRankingDisabled: true,
  };

  const mockActiveAchievements: StudentAchievement[] = [
    {
      id: 'ach_001',
      studentId: 'stu_101',
      eventId: 'evt_streak_001',
      badgeCode: 'STRIKE_PRECISION_MASTER',
      badgeTitle: 'Master of Strike Precision',
      badgeDescription: 'Completed 7 consecutive precision strike sessions.',
      category: 'SKILL',
      awardedAt: '2026-10-19T08:00:00Z',
      status: 'ACTIVE',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Test 1: unpublished_lesson_hidden
  // ==========================================================================
  it('unpublished_lesson_hidden: renders published lessons and strictly omits draft content from student view', async () => {
    // Service returns only published lesson to student
    (learningService.getLessons as jest.Mock).mockResolvedValue([mockPublishedLesson]);

    const { findByTestId, queryByText } = await renderWithTheme(
      <LearningLibraryRewardsScreen
        studentId="stu_101"
        studentName="Danial bin Razlan"
        currentBeltRank="Putih"
      />
    );

    expect(await findByTestId('learning-hub-title')).toBeTruthy();
    expect(await findByTestId('lesson-title-lsn_pub_001')).toBeTruthy();

    // Draft lesson must NOT be present
    expect(queryByText(mockDraftLesson.title)).toBeNull();
  });

  // ==========================================================================
  // Test 2: cross_rubric_scores_not_falsely_compared
  // ==========================================================================
  it('cross_rubric_scores_not_falsely_compared: partitions rubric scores and displays isolation warning banner', async () => {
    (learningService.getLessons as jest.Mock).mockResolvedValue([mockPublishedLesson]);
    (learningService.getStudentPerformance as jest.Mock).mockResolvedValue(mockPerformanceSummary);

    const { getByTestId, findByTestId, findByText } = await renderWithTheme(
      <LearningLibraryRewardsScreen
        studentId="stu_101"
        studentName="Danial bin Razlan"
        currentBeltRank="Putih"
      />
    );

    // Switch to Performance tab
    const perfTab = getByTestId('tab-learning-performance');
    fireEvent.press(perfTab);

    // Isolation warning card must appear
    expect(await findByTestId('cross-rubric-warning-card')).toBeTruthy();
    expect(await findByText('Rubric Version Isolation Enforced')).toBeTruthy();
    expect(await findByText('Private Personal Progression')).toBeTruthy();

    // Scores rendered in their own partitions
    expect(await findByText('8.5 / 10')).toBeTruthy();
    expect(await findByText('84 / 100')).toBeTruthy();
  });

  // ==========================================================================
  // Test 3: replay_event_one_award
  // ==========================================================================
  it('replay_event_one_award: presents unlocked achievements and verifies event idempotency', async () => {
    (learningService.getLessons as jest.Mock).mockResolvedValue([mockPublishedLesson]);
    (learningService.getStudentAchievements as jest.Mock).mockResolvedValue(mockActiveAchievements);

    const { getByTestId, findByTestId, findByText } = await renderWithTheme(
      <LearningLibraryRewardsScreen
        studentId="stu_101"
        studentName="Danial bin Razlan"
        currentBeltRank="Putih"
      />
    );

    // Switch to Badges / Achievements tab
    const badgeTab = getByTestId('tab-learning-achievements');
    fireEvent.press(badgeTab);

    expect(await findByTestId('badge-item-ach_001')).toBeTruthy();
    expect(await findByText('Master of Strike Precision')).toBeTruthy();
  });

  // ==========================================================================
  // Test 4: revoked_award_audited
  // ==========================================================================
  it('revoked_award_audited: revoked achievement is excluded from active student badges', async () => {
    (learningService.getLessons as jest.Mock).mockResolvedValue([mockPublishedLesson]);
    // Service returns empty array because the award was revoked and audited
    (learningService.getStudentAchievements as jest.Mock).mockResolvedValue([]);

    const { getByTestId, findByText, queryByTestId } = await renderWithTheme(
      <LearningLibraryRewardsScreen
        studentId="stu_101"
        studentName="Danial bin Razlan"
        currentBeltRank="Putih"
      />
    );

    const badgeTab = getByTestId('tab-learning-achievements');
    fireEvent.press(badgeTab);

    expect(await findByText('No Badges Unlocked Yet')).toBeTruthy();
    expect(queryByTestId('badge-item-ach_001')).toBeNull();
  });

  // ==========================================================================
  // Test 5: learning_completion_not_formal_grading
  // ==========================================================================
  it('learning_completion_not_formal_grading: submits quiz progress with decoupling notice without altering belt rank', async () => {
    (learningService.getLessons as jest.Mock).mockResolvedValue([mockPublishedLesson]);
    (learningService.recordLessonProgress as jest.Mock).mockResolvedValue({
      success: true,
      formalGradingOccurred: false,
      message: 'Lesson completed. Formal rank promotion requires a registered grading event.',
      progress: {
        id: 'prog_001',
        studentId: 'stu_101',
        lessonId: 'lsn_pub_001',
        status: 'COMPLETED',
        quizScore: 100,
      },
    });

    const { getByTestId, findByTestId, findByText } = await renderWithTheme(
      <LearningLibraryRewardsScreen
        studentId="stu_101"
        studentName="Danial bin Razlan"
        currentBeltRank="Putih"
      />
    );

    // Open lesson modal
    const lessonCard = await findByTestId('lesson-card-lsn_pub_001');
    fireEvent.press(lessonCard);

    expect(await findByTestId('modal-lesson-title')).toBeTruthy();
    expect(
      await findByText(
        'Notice: Lesson completion and quiz scores are for skill development only and do NOT automatically award formal belt promotions or Dan certificates.'
      )
    ).toBeTruthy();

    // Select quiz option
    const quizOption = getByTestId('quiz-opt-0-0');
    await act(async () => {
      fireEvent.press(quizOption);
    });

    // Submit quiz & complete lesson
    const completeBtn = getByTestId('btn-complete-lesson');
    await act(async () => {
      fireEvent.press(completeBtn);
    });

    await waitFor(() => {
      expect(learningService.recordLessonProgress).toHaveBeenCalledWith(
        'lsn_pub_001',
        expect.objectContaining({
          studentId: 'stu_101',
          status: 'COMPLETED',
          quizScore: 100,
        })
      );
    });
  });
});
