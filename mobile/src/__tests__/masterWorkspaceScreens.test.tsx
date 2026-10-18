import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { clearDashboardCache } from '../services/dashboardService';
import { MasterHomeScreen, ClassesScreen, ClassWorkspaceScreen } from '../screens/roles/master';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../database/repositories/mutationQueueRepository', () => ({
  mutationQueueRepository: {
    getPendingMutations: jest.fn().mockResolvedValue([{ id: 'mut_1' }]),
  },
}));

jest.mock('../database/repositories/conflictRepository', () => ({
  conflictRepository: {
    getConflicts: jest.fn().mockResolvedValue([{ id: 'conf_1' }]),
  },
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

describe('H06: Master Class Workspace, Authorized Rosters & Operational Dashboard Screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDashboardCache();
  });

  const masterUser: AuthUser = {
    id: 'usr_master_1',
    fullName: 'Master Gurunathan',
    email: 'master@silambam.my',
    role: UserRole.MASTER,
    organizationId: 'org_selangor',
    assignedClassIds: ['cls_squad_1'],
    affiliationStatus: 'ACTIVE',
  };

  const sampleClass = {
    id: 'cls_squad_1',
    organization_id: 'org_selangor',
    organization_name: 'Persatuan Silambam Selangor',
    name: 'Silambam Advanced Squad',
    schedule: 'Mon & Wed 7:00 PM',
    location: 'Shah Alam Complex',
    venue_details: 'Court 3, Level 2',
    capacity: 25,
    operational_status: 'ACTIVE',
    enrollment_availability: 'OPEN',
    version: 1,
  };

  const sampleWorkspaceData = {
    class: sampleClass,
    activeStudentsCount: 18,
    availableSpots: 7,
    pendingApplicationsCount: 3,
    waitlistedApplicationsCount: 1,
    trainingGroups: [
      { id: 'tg_1', name: 'Junior Forms' },
      { id: 'tg_2', name: 'Senior Weapons' },
    ],
    todaySessions: [
      {
        id: 'sess_1',
        start_time: '19:00',
        end_time: '21:00',
        location: 'Shah Alam Complex',
        status: 'Scheduled',
        group_name: 'Senior Weapons',
      },
      {
        id: 'sess_2',
        start_time: '17:00',
        end_time: '18:30',
        location: 'Shah Alam Complex',
        status: 'Cancelled',
        group_name: 'Junior Forms',
      },
    ],
    upcomingSessions: [
      {
        id: 'sess_3',
        session_date: '2026-10-25',
        start_time: '19:00',
        end_time: '21:00',
        location: 'Shah Alam Complex',
        status: 'Scheduled',
      },
    ],
    recentNotices: [
      { id: 'not_1', message: 'Grading preparation this Wednesday.', sender_name: 'Master Gurunathan' },
    ],
  };

  const sampleStudents = [
    {
      id: 'stu_1',
      full_name: 'Anand Kumar',
      belt_rank: 'Green Belt',
      group_id: 'tg_2',
      group_name: 'Senior Weapons',
      enrollment_status: 'ACTIVE',
      ic_number: '******-**-1234',
      attendance_rate: '94%',
    },
    {
      id: 'stu_2',
      full_name: 'Bavani Suresh',
      belt_rank: 'White Belt',
      group_id: 'tg_1',
      group_name: 'Junior Forms',
      enrollment_status: 'ACTIVE',
      ic_number: '******-**-5678',
      attendance_rate: '88%',
    },
  ];

  // -------------------------------------------------------------------------
  // Test 27: Master Today Dashboard renders real statistics & sync alerts
  // -------------------------------------------------------------------------
  it('Scenario 27: Master Today dashboard renders operational metrics and sync alerts', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      hasApprovedClasses: true,
      todayClasses: [sampleClass],
      todaySessions: sampleWorkspaceData.todaySessions,
      activeStudentCount: 18,
      pendingApplicationsCount: 3,
      pendingProposalsCount: 1,
      recentNotices: sampleWorkspaceData.recentNotices,
    });

    const { getByTestId, findByText, findByTestId } = await renderWithTheme(
      <MasterHomeScreen user={masterUser} />
    );

    expect(await findByText('Master Home')).toBeTruthy();
    expect(getByTestId('stat-master-classes')).toBeTruthy();
    expect(getByTestId('stat-master-students')).toBeTruthy();
    expect(getByTestId('stat-master-applications')).toBeTruthy();
    expect(getByTestId('stat-master-proposals')).toBeTruthy();
    expect(await findByTestId('badge-offline-pending-sync')).toBeTruthy();
    expect(await findByTestId('badge-attendance-conflicts')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 28: Master Today Dashboard renders onboarding state when no classes
  // -------------------------------------------------------------------------
  it('Scenario 28: Master Today dashboard renders onboarding state when master has no approved classes', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      hasApprovedClasses: false,
      todayClasses: [],
      todaySessions: [],
      activeStudentCount: 0,
      pendingApplicationsCount: 0,
      pendingProposalsCount: 2,
      onboarding: {
        message: 'Welcome Master! You currently have no approved classes.',
        action: 'PROPOSE_CLASS',
      },
    });

    const mockNav = { navigate: jest.fn() };
    const { findByTestId, getByText } = await renderWithTheme(
      <MasterHomeScreen user={masterUser} navigation={mockNav} />
    );

    const onboardingCard = await findByTestId('master-onboarding-card');
    expect(onboardingCard).toBeTruthy();
    expect(getByText(/Welcome to BeltFlow Class Management/i)).toBeTruthy();

    const proposeBtn = await findByTestId('btn-onboarding-propose-class');
    fireEvent.press(proposeBtn);
    expect(mockNav.navigate).toHaveBeenCalledWith('Classes', { screen: 'CreateClass' });
  });

  // -------------------------------------------------------------------------
  // Test 29: Class Workspace screen Overview tab renders metrics and cancellations
  // -------------------------------------------------------------------------
  it('Scenario 29: Class Workspace renders overview metrics and accurate session cancellation status', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(sampleWorkspaceData) // workspace summary
      .mockResolvedValueOnce({ students: sampleStudents, pagination: { total: 2, limit: 100, offset: 0 } }); // students

    const { findByText, getByTestId } = await renderWithTheme(
      <ClassWorkspaceScreen
        user={masterUser}
        route={{ params: { classId: 'cls_squad_1', className: 'Silambam Advanced Squad' } }}
      />
    );

    expect(await findByText('Silambam Advanced Squad')).toBeTruthy();
    expect(getByTestId('stat-active-students')).toBeTruthy();
    expect(getByTestId('stat-available-spots')).toBeTruthy();
    expect(getByTestId('stat-pending-applications')).toBeTruthy();
    expect(getByTestId('badge-session-sess_1')).toBeTruthy();
    expect(getByTestId('badge-session-sess_2')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 30: Students roster tab, search, filtering & teaching profile privacy
  // -------------------------------------------------------------------------
  it('Scenario 30: Students roster filters by search and group, and profile modal protects safety data', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(sampleWorkspaceData)
      .mockResolvedValueOnce({ students: sampleStudents, pagination: { total: 2, limit: 100, offset: 0 } });

    const { getByTestId, findByText, queryByText } = await renderWithTheme(
      <ClassWorkspaceScreen
        user={masterUser}
        route={{ params: { classId: 'cls_squad_1', className: 'Silambam Advanced Squad' } }}
      />
    );

    expect(await findByText('Silambam Advanced Squad')).toBeTruthy();

    // Switch to Students tab
    const studentsTab = getByTestId('tab-workspace-students');
    fireEvent.press(studentsTab);

    // Both students should be visible initially
    expect(await findByText('Anand Kumar')).toBeTruthy();
    expect(await findByText('Bavani Suresh')).toBeTruthy();

    // Filter by search query
    const searchInput = getByTestId('input-search-roster');
    fireEvent.changeText(searchInput, 'Anand');

    await waitFor(() => {
      expect(queryByText('Anand Kumar')).toBeTruthy();
      expect(queryByText('Bavani Suresh')).toBeNull();
    });

    // Clear search
    fireEvent.changeText(searchInput, '');

    await waitFor(() => {
      expect(queryByText('Bavani Suresh')).toBeTruthy();
    });

    // Tap on Anand Kumar to open Teaching Profile
    const anandProfileBtn = getByTestId('btn-profile-stu_1');
    fireEvent.press(anandProfileBtn);

    // Profile modal should render
    expect(await findByText('Student Teaching Profile')).toBeTruthy();
    expect(await findByText('Protected Safety & Medical Data')).toBeTruthy();
    expect(await findByText(/Full medical records, allergies, and emergency contacts are restricted/i)).toBeTruthy();
    expect(await findByText(/National ID: \*\*\*\*\*\*-\*\*-1234/)).toBeTruthy();

    // Full raw IC must NOT be present
    expect(queryByText('080101-10-1234')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 31: Class Settings tab updates venue and operational status
  // -------------------------------------------------------------------------
  it('Scenario 31: Class Workspace settings allows updating venue and operational status', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce(sampleWorkspaceData)
      .mockResolvedValueOnce({ students: sampleStudents, pagination: { total: 2, limit: 100, offset: 0 } });
    (apiClient.patch as jest.Mock).mockResolvedValueOnce({
      message: 'Class settings updated successfully',
      class: { ...sampleClass, venue_details: 'Main Hall A' },
    });

    const { getByTestId, findByText, findByTestId } = await renderWithTheme(
      <ClassWorkspaceScreen
        user={masterUser}
        route={{ params: { classId: 'cls_squad_1', className: 'Silambam Advanced Squad' } }}
      />
    );

    expect(await findByText('Silambam Advanced Squad')).toBeTruthy();

    // Switch to Settings tab
    const settingsTab = getByTestId('tab-workspace-settings');
    fireEvent.press(settingsTab);

    // Edit venue details
    const venueInput = await findByTestId('input-settings-venue');
    fireEvent.changeText(venueInput, 'Main Hall A');

    // Toggle operational status to PAUSED
    const pausedBtn = await findByTestId('btn-status-paused');
    fireEvent.press(pausedBtn);

    // Save Settings
    const saveBtn = await findByTestId('btn-save-settings');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/classes/cls_squad_1/settings',
        expect.objectContaining({
          venueDetails: 'Main Hall A',
          operationalStatus: 'PAUSED',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Test 32: ClassesScreen approved class card offers Open Workspace action
  // -------------------------------------------------------------------------
  it('Scenario 32: ClassesScreen approved class card renders Open Workspace button navigating to workspace', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce({ classes: [sampleClass] })
      .mockResolvedValueOnce({ applications: [] });

    const mockNav = { navigate: jest.fn() };
    const { findByTestId } = await renderWithTheme(
      <ClassesScreen user={masterUser} navigation={mockNav} />
    );

    const workspaceBtn = await findByTestId('btn-workspace-cls_squad_1');
    expect(workspaceBtn).toBeTruthy();

    fireEvent.press(workspaceBtn);
    expect(mockNav.navigate).toHaveBeenCalledWith('ClassWorkspace', {
      classId: 'cls_squad_1',
      className: 'Silambam Advanced Squad',
    });
  });
});
