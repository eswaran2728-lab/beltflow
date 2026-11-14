import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StudentHomeScreen } from '../screens/roles/student';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { clearDashboardCache } from '../services/dashboardService';
import { BeltLevelConfig } from '../theme/belts';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Google Stitch Student UI/UX Workstream Tests (Task H24)', () => {
  const studentUser: AuthUser = {
    id: 'usr_stu_001',
    fullName: 'Aryan Suresh',
    email: 'aryan@example.com',
    role: UserRole.STUDENT,
    organizationId: 'org_selangor_silambam',
  };

  const mockCustomBelts: readonly BeltLevelConfig[] = [
    { id: 'b_white', name: 'Novice White Belt', order: 1, colorHex: '#F8FAFC' },
    { id: 'b_yellow', name: 'Yellow Belt', order: 2, colorHex: '#EAB308' },
    { id: 'b_green', name: 'Intermediate Green Belt', order: 3, colorHex: '#22C55E' },
    { id: 'b_blue', name: 'Advanced Blue Belt', order: 4, colorHex: '#3B82F6' },
    { id: 'b_black_1dan', name: '1st Dan Black Sash', order: 5, colorHex: '#0F172A' },
  ];

  const mockDashboardData = {
    student: {
      id: 'usr_stu_001',
      full_name: 'Aryan Suresh',
      belt_rank: 'Intermediate Green Belt',
      status: 'ACTIVE',
      monthly_fee: 120,
    },
    organization: {
      name: 'Persatuan Silambam Selangor',
    },
    sessions: [
      {
        id: 'sess_01',
        session_date: '2026-11-01',
        start_time: '08:00',
        end_time: '10:00',
        location: 'Dojang Shah Alam',
        group_name: 'Youth Silambam',
      },
    ],
    attendance: [
      { id: 'att_1', status: 'Present' },
      { id: 'att_2', status: 'Present' },
      { id: 'att_3', status: 'Present' },
      { id: 'att_4', status: 'Absent' },
    ],
    skills: [
      { id: 'sk_1', skill_name: 'Kaaladi Stance Movement', level: 'Mastered' },
      { id: 'sk_2', skill_name: 'Veechu Stick Rotation', level: 'Mastered' },
      { id: 'sk_3', skill_name: 'Thadappu Defense Drill', level: 'Mastered' },
      { id: 'sk_4', skill_name: 'Padam Salutation Form', level: 'Mastered' },
      { id: 'sk_5', skill_name: 'Distance & Sparring Control', level: 'Learning' },
    ],
    certificates: [
      {
        id: 'cert_01',
        belt_rank: 'Yellow Belt',
        certificate_number: 'BF-YEL-8891',
        issue_date: '2026-06-15',
        status: 'ACTIVE',
      },
    ],
    notices: [
      {
        id: 'not_01',
        title: 'Grading Preparation Seminar',
        content: 'Extra sparring workshop this Saturday at 9 AM.',
      },
    ],
  };

  const setupDefaultMocks = (customData = mockDashboardData) => {
    clearDashboardCache();
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/api/v1/students/me') return Promise.resolve({ student: customData.student });
      if (path.includes('/sessions')) return Promise.resolve({ sessions: customData.sessions });
      if (path.includes('/attendance')) return Promise.resolve({ attendance: customData.attendance });
      if (path.includes('/skills')) return Promise.resolve({ skills: customData.skills });
      if (path.includes('/certificates')) return Promise.resolve({ certificates: customData.certificates });
      if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: customData.notices });
      if (path.includes('/organizations/')) return Promise.resolve({ organization: customData.organization });
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
  };

  const renderWithTheme = async (ui: React.ReactElement, belts = mockCustomBelts) => {
    return await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider persatuanBelts={belts}>
          {ui}
        </ThemeProvider>
      </SafeAreaProvider>
    );
  };

  beforeEach(() => {
    clearDashboardCache();
    setupDefaultMocks();
  });

  test('1. Renders StitchAppHeader with Dojang name and STUDENT role chip', async () => {
    const { findByText, getByTestId, getAllByText } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    expect(await findByText('Student Home')).toBeTruthy();
    expect(getByTestId('stitch-app-header')).toBeTruthy();
    expect(getByTestId('header-role-chip')).toBeTruthy();
    expect(getAllByText('STUDENT').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/PERSATUAN/i).length).toBeGreaterThanOrEqual(1);
  });

  test('2. Renders StitchStatCards with attendance and syllabus progress', async () => {
    const { findByText, getByTestId, getAllByText } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    expect(await findByText('ATTENDANCE')).toBeTruthy();
    expect(getByTestId('stat-student-attendance')).toBeTruthy();
    expect(getByTestId('stat-student-skills')).toBeTruthy();
    expect(getAllByText('ATTENDANCE').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('SYLLABUS PROGRESS').length).toBeGreaterThanOrEqual(1);
  });

  test('3. Dynamic Persatuan Belt Progression renders arbitrary curricula without hardcoding 8 belts', async () => {
    const { findAllByText, getByTestId } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    const beltMatches = await findAllByText(/Intermediate Green Belt/i);
    expect(beltMatches.length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('student-current-belt-badge')).toBeTruthy();

    // Resolves Next Target from organization's arbitrary curricula:
    const targetMatches = await findAllByText(/Advanced Blue Belt/i);
    expect(targetMatches.length).toBeGreaterThanOrEqual(1);
  });

  test('4. Renders TechniqueChecklistCard with syllabus title and readiness counter', async () => {
    const { findByText, getByTestId, getAllByText } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    expect(await findByText(/Intermediate Green Belt Syllabus/i)).toBeTruthy();
    expect(getByTestId('technique-checklist-card')).toBeTruthy();
    expect(getAllByText(/Intermediate Green Belt Syllabus/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/4\/5 Ready/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Kaaladi Stance Movement/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Veechu Stick Rotation/i).length).toBeGreaterThanOrEqual(1);
  });

  test('5. Digital Certificate Card displays QR VERIFIED badge for verified active certificates', async () => {
    const { findByText, getByTestId, getAllByText } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    expect(await findByText('QR VERIFIED')).toBeTruthy();
    expect(getByTestId('digital-certificate-card')).toBeTruthy();
    expect(getByTestId('qr-verified-badge')).toBeTruthy();
    expect(getAllByText('QR VERIFIED').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Promotion to Yellow Belt/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/BF-YEL-8891/i).length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('btn-download-cert')).toBeTruthy();
  });

  test('6. Never shows QR VERIFIED for unverified or revoked certificate', async () => {
    const unverifiedData = {
      ...mockDashboardData,
      certificates: [
        {
          id: 'cert_revoked',
          belt_rank: 'Yellow Belt',
          certificate_number: 'BF-REVOKED-01',
          issue_date: '2026-06-15',
          status: 'REVOKED',
        },
      ],
    };
    setupDefaultMocks(unverifiedData);

    const { findByText, queryByTestId } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    expect(await findByText('Promotion to Yellow Belt')).toBeTruthy();
    // Must NOT have QR VERIFIED badge!
    expect(queryByTestId('qr-verified-badge')).toBeNull();
  });

  test('7. Governance Note: learning completion does not grant formal belt promotion', async () => {
    const { findByText } = await renderWithTheme(<StudentHomeScreen user={studentUser} />);

    expect(
      await findByText(/Self-directed video and quiz completion awards practice badges but does not grant a formal belt promotion/i)
    ).toBeTruthy();
  });

  test('8. Multilingual long text formatting: renders long Malay/Tamil student name cleanly', async () => {
    clearDashboardCache();
    const multilingualUser: AuthUser = {
      id: 'usr_stu_tamil',
      fullName: 'தருண் சுரேஷ் குமார் (Tharun Suresh Kumar)',
      email: 'tharun@example.com',
      role: UserRole.STUDENT,
      organizationId: 'org_selangor_silambam',
    };

    const multiData = {
      ...mockDashboardData,
      student: {
        ...mockDashboardData.student,
        id: multilingualUser.id,
        full_name: multilingualUser.fullName,
      },
    };
    setupDefaultMocks(multiData);

    const { findAllByText } = await renderWithTheme(<StudentHomeScreen user={multilingualUser} />);
    const matches = await findAllByText(/Tharun Suresh Kumar/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
