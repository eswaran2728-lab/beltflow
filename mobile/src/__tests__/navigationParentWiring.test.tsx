/**
 * Parent navigation wiring: every finished parent screen opens from a real
 * entry point, per-child actions carry that child's id, and entries for
 * optional release modules are hidden when the server switches them off.
 * Synthetic test data only.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { ParentNavigator } from '../navigation/roleNavigators/ParentNavigator';
import { apiClient } from '../services/apiClient';
import { releaseService } from '../services/releaseService';
import { clearDashboardCache } from '../services/dashboardService';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(),
}));

jest.mock('../services/releaseService', () => ({
  releaseService: { getReleaseModules: jest.fn() },
}));

jest.mock('../services/authService', () => ({
  authService: {
    onSessionEnded: jest.fn(() => () => undefined),
  },
}));

const ALL_MODULES = [
  'trials', 'bookings', 'transfers', 'teaching', 'family', 'learning',
  'media', 'messaging', 'analytics', 'tournaments', 'commerce', 'assistant',
];

const parentUser: AuthUser = {
  id: 'usr_parent_test',
  fullName: 'Test Parent',
  email: 'parent@example.test',
  role: UserRole.PARENT,
  organizationId: 'org_test',
  linkedStudentIds: ['stu_test_01'],
};

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function mockApi() {
  (apiClient.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/api/v1/students/stu_test_01') {
      return Promise.resolve({
        student: {
          id: 'stu_test_01',
          full_name: 'Test Child',
          belt_rank: 'Yellow Belt',
          organization_id: 'org_test',
          class_id: 'cls_test_01',
          monthly_fee: 100,
          status: 'ACTIVE',
        },
      });
    }
    if (path.includes('/monthly-dues/')) return Promise.resolve({ total_pending: 0, months_pending_count: 0, dues: [] });
    if (path.includes('/attendance')) return Promise.resolve({ attendance: [] });
    if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
    if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
    if (path.includes('/notices')) return Promise.resolve({ notices: [] });
    if (path === '/messaging/threads') return Promise.resolve([]);
    if (path === '/family/children') return Promise.resolve({ children: [] });
    if (path.includes('/available-classes')) return Promise.resolve({ classes: [] });
    if (path.startsWith('/bookings/student/')) return Promise.resolve({ bookings: [] });
    if (path.startsWith('/transfers/students/')) {
      return Promise.resolve({ enrollments: [], pauses: [], transfers: [], attendanceCount: 0, paymentsCount: 0 });
    }
    return Promise.resolve({});
  });
}

function setModules(enabledModules: string[]) {
  (releaseService.getReleaseModules as jest.Mock).mockResolvedValue({ release: 'R4', enabledModules });
}

async function renderParent() {
  const utils = await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="light">
        <ParentNavigator user={parentUser} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  // Let the release-module and dashboard requests settle.
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

async function openChildrenTab(utils: Awaited<ReturnType<typeof renderParent>>) {
  await act(async () => {
    fireEvent.press(utils.getByTestId('tab-parent-children'));
  });
  await utils.findByTestId('parent-children-screen');
}

beforeEach(() => {
  jest.clearAllMocks();
  clearDashboardCache();
  mockApi();
  setModules(ALL_MODULES);
});

describe('Parent navigation wiring', () => {
  test('home: the child card messaging button opens Parent-Master messaging', async () => {
    const utils = await renderParent();
    const btn = await utils.findByTestId('btn-message-active-child-master');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(await utils.findByTestId('parent-master-messaging-screen')).toBeTruthy();
  });

  test('home: the messaging shortcut opens Parent-Master messaging', async () => {
    const utils = await renderParent();
    const btn = await utils.findByTestId('shortcut-parent-messaging');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(await utils.findByTestId('parent-master-messaging-screen')).toBeTruthy();
  });

  test('home: the family timeline shortcut opens the family timeline hub', async () => {
    const utils = await renderParent();
    const btn = await utils.findByTestId('shortcut-parent-family-timeline');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(await utils.findByTestId('family-timeline-hub-screen')).toBeTruthy();
  });

  test('children: Find a class opens available classes', async () => {
    const utils = await renderParent();
    await openChildrenTab(utils);
    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-parent-find-class'));
    });
    expect(await utils.findByTestId('available-classes-screen')).toBeTruthy();
  });

  test('children: My applications opens the applications list', async () => {
    const utils = await renderParent();
    await openChildrenTab(utils);
    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-parent-my-applications'));
    });
    expect(await utils.findByTestId('my-applications-screen')).toBeTruthy();
  });

  test("children: Pause or transfer opens the lifecycle screen for that child's id", async () => {
    const utils = await renderParent();
    await openChildrenTab(utils);
    const btn = await utils.findByTestId('btn-child-lifecycle-stu_test_01');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(await utils.findByTestId('tab-request-transfer')).toBeTruthy();
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/transfers/students/stu_test_01/history')
    );
  });

  test("children: Book a make-up class opens make-up booking for that child's id", async () => {
    const utils = await renderParent();
    await openChildrenTab(utils);
    const btn = await utils.findByTestId('btn-child-makeup-stu_test_01');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(await utils.findByTestId('parent-makeup-booking-screen')).toBeTruthy();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/bookings/student/stu_test_01'));
  });

  test('optional-module entries are hidden when messaging, family, transfers and bookings are off', async () => {
    setModules(['trials', 'assistant']);
    const utils = await renderParent();
    await utils.findByTestId('shortcut-parent-children');
    await waitFor(() => expect(utils.queryByTestId('shortcut-parent-messaging')).toBeNull());
    expect(utils.queryByTestId('btn-message-active-child-master')).toBeNull();
    expect(utils.queryByTestId('shortcut-parent-family-timeline')).toBeNull();

    await openChildrenTab(utils);
    // Core enrolment entries stay visible.
    expect(utils.getByTestId('btn-parent-find-class')).toBeTruthy();
    expect(utils.getByTestId('btn-parent-my-applications')).toBeTruthy();
    expect(utils.queryByTestId('btn-child-lifecycle-stu_test_01')).toBeNull();
    expect(utils.queryByTestId('btn-child-makeup-stu_test_01')).toBeNull();
  });

  test('each module gates only its own entry', async () => {
    setModules(['bookings']);
    const utils = await renderParent();
    await utils.findByTestId('shortcut-parent-children');
    await waitFor(() => expect(utils.queryByTestId('shortcut-parent-messaging')).toBeNull());
    await openChildrenTab(utils);
    expect(await utils.findByTestId('btn-child-makeup-stu_test_01')).toBeTruthy();
    expect(utils.queryByTestId('btn-child-lifecycle-stu_test_01')).toBeNull();
  });
});
