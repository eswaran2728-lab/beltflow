import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { MasterGradingScreen } from '../screens/roles/master/MasterGradingScreen';
import { AdminGradingScreen } from '../screens/roles/adminPersatuan/AdminGradingScreen';
import { VerifyCertificateScreen } from '../screens/auth/VerifyCertificateScreen';
import { StudentHomeScreen } from '../screens/roles/student';
import { ParentHomeScreen } from '../screens/roles/parent';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

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

describe('H12: Grading, Student Readiness, Belt Progression & Certificate Verification Screens', () => {
  const masterUser: AuthUser = {
    id: 'usr_master_01',
    fullName: 'Master Arumugam',
    email: 'master@silambam.org',
    role: UserRole.MASTER,
    organizationId: 'org_silambam_01',
    affiliationStatus: 'ACTIVE',
  };

  const adminUser: AuthUser = {
    id: 'usr_admin_01',
    fullName: 'Persatuan Admin Aminah',
    email: 'admin@silambam.org',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_silambam_01',
    affiliationStatus: 'ACTIVE',
  };

  const studentUser: AuthUser = {
    id: 'usr_stu_01',
    fullName: 'Dinesh Kumar',
    email: 'dinesh@student.my',
    role: UserRole.STUDENT,
    organizationId: 'org_silambam_01',
  };

  const parentUser: AuthUser = {
    id: 'usr_parent_01',
    fullName: 'Priya Devi',
    email: 'priya@family.my',
    role: UserRole.PARENT,
    organizationId: 'org_silambam_01',
    linkedStudentIds: ['stu_dinesh_01'],
  };

  const mockStudents = [
    { id: 'stu_dinesh_01', full_name: 'Dinesh Kumar', belt_rank: 'White Belt', status: 'ACTIVE' },
  ];

  const mockGradingEvents = [
    {
      id: 'grd_spring_2026',
      organization_id: 'org_silambam_01',
      title: 'Spring 2026 Belt Examination',
      event_date: '2026-05-20',
      location: 'Main Hall',
      fee: 60,
      status: 'REGISTRATION_OPEN',
      version: 1,
    },
  ];

  const mockReadinessPassport = {
    studentId: 'stu_dinesh_01',
    fullName: 'Dinesh Kumar',
    currentBelt: 'White Belt',
    nextEligibleBelt: {
      id: 'rank_yellow',
      name: 'Yellow Belt',
      orderIndex: 2,
      colorHex: '#FFFF00',
      minDurationMonths: 3,
      minSessions: 24,
    },
    attendance: {
      totalSessions: 28,
      minSessionsRequired: 24,
    },
    trainingDuration: {
      months: 4,
      minMonthsRequired: 3,
    },
    skills: {
      achievedCount: 4,
      needingImprovementCount: 1,
      skillsAchieved: [{ skill_id: 'skl_01', level: 'Proficient' }],
      skillsNeedingImprovement: [],
      allSkills: [
        { skill_id: 'skl_01', skill_name: 'Footwork & Stance', level: 'Proficient', notes: 'Solid balance' },
      ],
    },
    eligibilityStatus: 'READY FOR REVIEW',
    requirements: {
      minSessions: 24,
      minMonths: 3,
      minSkills: 3,
    },
    readinessRecommendation: 'Student has satisfied attendance and curriculum drill targets.',
    rankHistory: [
      { id: 'h_01', rank_name: 'White Belt', certificate_number: 'BF-DI-1001', awarded_at: '2025-12-01' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Test 1: Master Readiness Passport UI
  // --------------------------------------------------------------------------
  test('Master inspects student readiness passport with eligibility metrics', async () => {
    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/students/organization/')) return Promise.resolve({ students: mockStudents });
      if (path.includes('/grading/organization/')) return Promise.resolve({ gradingEvents: mockGradingEvents });
      if (path.includes('/grading/readiness/')) return Promise.resolve(mockReadinessPassport);
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const { findByText, getByText, getByTestId } = await renderWithTheme(
      <MasterGradingScreen user={masterUser} />
    );

    expect(await findByText('Dinesh Kumar')).toBeTruthy();
    expect(getByText('READY FOR REVIEW')).toBeTruthy();
    expect(getByText('NEXT TARGET RANK')).toBeTruthy();
    expect(getByText('Yellow Belt')).toBeTruthy();
    expect(getByText('28 / 24')).toBeTruthy(); // Attendance stat
    expect(getByText('Footwork & Stance')).toBeTruthy();
    expect(getByTestId('btn-nominate-candidate')).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Test 2: Master Records Structured Skill Assessment
  // --------------------------------------------------------------------------
  test('Master records structured skill assessment with criteria scores', async () => {
    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/students/organization/')) return Promise.resolve({ students: mockStudents });
      if (path.includes('/grading/organization/')) return Promise.resolve({ gradingEvents: mockGradingEvents });
      if (path.includes('/grading/readiness/')) return Promise.resolve(mockReadinessPassport);
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    (apiClient.post as jest.Mock).mockResolvedValue({
      message: 'Assessment recorded',
      assessment: { level: 'Mastered' },
    });

    const { findByText, getByTestId, getByText } = await renderWithTheme(
      <MasterGradingScreen user={masterUser} />
    );

    expect(await findByText('Dinesh Kumar')).toBeTruthy();

    // Switch to Skill Assessment tab
    await act(async () => {
      fireEvent.press(getByTestId('tab-btn-assess'));
    });

    expect(getByText('Master Skill Evaluation')).toBeTruthy();

    // Select proficiency level pill
    await act(async () => {
      fireEvent.press(getByTestId('pill-level-mastered'));
    });

    // Enter notes inside act
    await act(async () => {
      fireEvent.changeText(getByTestId('input-assessment-notes'), 'Exemplary form and balance.');
    });

    // Submit assessment
    await act(async () => {
      fireEvent.press(getByTestId('btn-record-assessment'));
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/skills/assess',
        expect.objectContaining({
          studentId: 'stu_dinesh_01',
          level: 'Mastered',
          notes: 'Exemplary form and balance.',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: Admin Grading Screen & Atomic Finalization
  // --------------------------------------------------------------------------
  test('Admin views grading candidates and executes atomic finalization', async () => {
    const mockEventDetails = {
      event: mockGradingEvents[0],
      candidates: [
        {
          id: 'cand_01',
          student_id: 'stu_dinesh_01',
          student_name: 'Dinesh Kumar',
          current_belt: 'White Belt',
          target_belt: 'Yellow Belt',
          result: 'Nominated',
        },
      ],
    };

    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('/grading/organization/')) return Promise.resolve({ gradingEvents: mockGradingEvents });
      if (path.includes('/grading/grd_spring_2026')) return Promise.resolve(mockEventDetails);
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    (apiClient.post as jest.Mock).mockResolvedValue({
      message: 'Grading finalized',
      event: { ...mockGradingEvents[0], status: 'FINALIZED', version: 2 },
      issuedCertificates: [{ id: 'cert_01', code: 'BF-DI-1002' }],
    });

    const { findByText, getByTestId, getByText } = await renderWithTheme(
      <AdminGradingScreen user={adminUser} />
    );

    expect(await findByText('Spring 2026 Belt Examination')).toBeTruthy();
    expect(getByText('Dinesh Kumar')).toBeTruthy();
    expect(getByText('Current: White Belt → Target: Yellow Belt')).toBeTruthy();
    expect(getByTestId('btn-finalize-grading')).toBeTruthy();

    // Finalize
    await act(async () => {
      fireEvent.press(getByTestId('btn-finalize-grading'));
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/grading/grd_spring_2026/finalize',
        expect.objectContaining({
          expectedVersion: 1,
          results: expect.arrayContaining([
            expect.objectContaining({
              studentId: 'stu_dinesh_01',
              targetBelt: 'Yellow Belt',
              result: 'Passed',
            }),
          ]),
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Test 4: FIX CERT-001 — Public-Safe Certificate Verification
  // --------------------------------------------------------------------------
  test('Public-safe certificate verification succeeds with zero PII leaks', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      verified: true,
      status: 'VALID',
      certificate: {
        code: 'BF-DI-1002',
        studentName: 'Dinesh Kumar',
        rankOrTitle: 'Yellow Belt',
        organizationName: 'Persatuan Silambam Selangor',
        masterName: 'Master Arumugam',
        issueDate: '2026-05-20',
        type: 'Promotion Exam',
        status: 'VALID',
      },
    });

    const onBack = jest.fn();
    const { getByTestId, findByText, getByText, getAllByText, queryByText } = await renderWithTheme(
      <VerifyCertificateScreen onBack={onBack} initialCode="BF-DI-1002" />
    );

    await act(async () => {
      fireEvent.press(getByTestId('btn-verify-submit'));
    });

    // Verify endpoint called was public-verify with requiresAuth: false
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/certificates/public-verify',
      expect.objectContaining({ codeOrToken: 'BF-DI-1002' }),
      expect.objectContaining({ requiresAuth: false })
    );

    // Verify projection rendered
    expect(await findByText('OFFICIALLY VERIFIED')).toBeTruthy();
    expect(getByText('Dinesh Kumar')).toBeTruthy();
    expect(getAllByText('Yellow Belt').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Persatuan Silambam Selangor')).toBeTruthy();

    // ZERO sensitive PII leaked
    expect(queryByText(/080101-10-1234/)).toBeNull();
    expect(queryByText(/Phone/)).toBeNull();
    expect(queryByText(/Allergy/)).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test 5: Public Verification Handles Revoked Certificate with Reason
  // --------------------------------------------------------------------------
  test('Public verification correctly flags and displays REVOKED certificate notice', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      verified: true,
      status: 'REVOKED',
      certificate: {
        code: 'BF-REV-9999',
        studentName: 'Suresh Rao',
        rankOrTitle: 'Brown Belt',
        organizationName: 'Persatuan Silambam Selangor',
        masterName: 'Chief Examiner',
        issueDate: '2025-01-10',
        type: 'Promotion Exam',
        status: 'REVOKED',
        revocationReason: 'Administrative duplicate resolution',
      },
    });

    const { getByTestId, findByText, getByText } = await renderWithTheme(
      <VerifyCertificateScreen onBack={jest.fn()} initialCode="BF-REV-9999" />
    );

    await act(async () => {
      fireEvent.press(getByTestId('btn-verify-submit'));
    });

    expect(await findByText('CERTIFICATE REVOKED')).toBeTruthy();
    expect(getByText('Revoked')).toBeTruthy();
    expect(getByText('Administrative duplicate resolution')).toBeTruthy();
  });
});
