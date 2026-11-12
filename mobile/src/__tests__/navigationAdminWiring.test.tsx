/**
 * Admin Persatuan navigation wiring: every dashboard quick action opens a
 * registered screen, and shortcuts for optional R3 modules (commerce,
 * tournaments) are hidden when the server's release switches them off.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { AdminPersatuanNavigator } from '../navigation/roleNavigators/AdminPersatuanNavigator';
import { releaseService } from '../services/releaseService';

jest.mock('../services/releaseService', () => ({
  releaseService: { getReleaseModules: jest.fn() },
}));

// Target screens only need empty lists to render; no network.
const mockApiGet = (path: string) =>
  Promise.resolve(
    path.includes('/curriculums') ? { curriculum: null, ranks: [], curriculums: [] } : {}
  );

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((path: string) => mockApiGet(path)),
    post: jest.fn(() => Promise.resolve({})),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/dashboardService', () => {
  const actual = jest.requireActual('../services/dashboardService');
  return {
    ...actual,
    dashboardService: {
      ...actual.dashboardService,
      getAdminPersatuanDashboard: jest.fn(() =>
        Promise.resolve({
          organization: {
            id: 'org_test_01',
            name: 'Test Persatuan',
            state: 'Selangor',
            martialArtStyle: 'Silambam',
            status: 'ACTIVE',
          },
          locationsCount: 0,
          classesCount: 0,
          mastersCount: 0,
          studentsCount: 0,
          totalRevenue: 0,
          paymentsCount: 0,
          classes: [],
          masters: [],
        })
      ),
    },
  };
});

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const adminUser: AuthUser = {
  id: 'usr_ap_test',
  fullName: 'Test Admin',
  email: 'admin@example.test',
  role: UserRole.ADMIN_PERSATUAN,
  organizationId: 'org_test_01',
};

const ALL_MODULES = ['commerce', 'tournaments', 'assistant'];

const renderNavigator = async (enabledModules: string[] = ALL_MODULES) => {
  (releaseService.getReleaseModules as jest.Mock).mockResolvedValue({
    release: 'R4',
    enabledModules,
  });
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider>
        <AdminPersatuanNavigator user={adminUser} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('Admin Persatuan navigation wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['shortcut-ap-class-approvals', 'admin-class-approvals-screen'],
    ['shortcut-ap-grading', 'admin-grading-screen'],
    ['shortcut-ap-curriculum', 'curriculum-management-screen'],
    ['shortcut-ap-finance', 'admin-finance-screen'],
  ])('dashboard button %s opens %s', async (buttonId, screenId) => {
    const { findByTestId } = await renderNavigator();
    fireEvent.press(await findByTestId(buttonId));
    expect(await findByTestId(screenId)).toBeTruthy();
  });

  test('dashboard button opens Handover Approvals', async () => {
    const { findByTestId, findByText } = await renderNavigator();
    fireEvent.press(await findByTestId('shortcut-ap-handover-approvals'));
    expect(await findByText('Handover Approvals')).toBeTruthy();
  });

  test('dashboard tab shortcuts still reach the Locations tab from the Home stack', async () => {
    const { findByTestId } = await renderNavigator();
    fireEvent.press(await findByTestId('shortcut-ap-locations'));
    expect(await findByTestId('admin-persatuan-locations-screen')).toBeTruthy();
  });

  test('commerce and tournaments shortcuts are shown when those modules are enabled', async () => {
    const { findByTestId } = await renderNavigator(ALL_MODULES);
    expect(await findByTestId('shortcut-ap-inventory')).toBeTruthy();
    expect(await findByTestId('shortcut-ap-tournaments')).toBeTruthy();
  });

  test('commerce and tournaments shortcuts are hidden when the server disables them', async () => {
    const { findByTestId, queryByTestId } = await renderNavigator([]);
    // Core (R1) shortcuts stay visible.
    expect(await findByTestId('shortcut-ap-class-approvals')).toBeTruthy();
    expect(await findByTestId('shortcut-ap-curriculum')).toBeTruthy();
    expect(queryByTestId('shortcut-ap-inventory')).toBeNull();
    expect(queryByTestId('shortcut-ap-tournaments')).toBeNull();
  });
});
