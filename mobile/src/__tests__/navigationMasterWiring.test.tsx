/**
 * Master navigation wiring: screens that used to be unreachable now open from
 * a visible entry point, and entry points for optional release modules are
 * hidden when the server switches the module off.
 * Synthetic test data only.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { releaseService } from '../services/releaseService';
import { clearDashboardCache } from '../services/dashboardService';
import { MasterNavigator } from '../navigation/roleNavigators/MasterNavigator';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
  ApiError: class ApiError extends Error {},
}));

jest.mock('../services/releaseService', () => ({
  releaseService: { getReleaseModules: jest.fn() },
}));

jest.mock('../services/trialsService', () => ({
  trialsService: {
    getClassFollowUps: jest.fn().mockResolvedValue([]),
    getClassTrials: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/membershipService', () => ({
  membershipService: {
    getPendingPauses: jest.fn().mockResolvedValue([]),
    getPendingTransfers: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/bookingsService', () => ({
  bookingsService: {
    getSessionBookings: jest.fn().mockResolvedValue({
      session: { id: 'sess_test_1', class_name: 'Synthetic Squad', capacity: 20, session_date: '2026-11-20' },
      bookings: [],
      confirmedCount: 0,
      waitlistCount: 0,
      capacity: { maxCapacity: 20, availableMakeUpPlaces: 2 },
    }),
  },
}));

jest.mock('../services/teachingService', () => ({
  teachingService: {
    getLessonPlan: jest.fn().mockResolvedValue({ session: {}, lessonPlan: null }),
    getSubstituteBrief: jest.fn().mockResolvedValue(null),
    saveLessonPlan: jest.fn(),
  },
}));

jest.mock('../database/repositories/mutationQueueRepository', () => ({
  mutationQueueRepository: { getPendingMutations: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../database/repositories/conflictRepository', () => ({
  conflictRepository: { getConflicts: jest.fn().mockResolvedValue([]) },
}));

const ALL_OPTIONAL = [
  'trials', 'bookings', 'transfers', 'teaching', 'family', 'learning', 'media',
  'messaging', 'analytics', 'tournaments', 'commerce', 'assistant',
];

const masterUser: AuthUser = {
  id: 'usr_master_test',
  fullName: 'Master Test',
  email: 'master.test@example.com',
  role: UserRole.MASTER,
  organizationId: 'org_test',
  assignedClassIds: ['cls_test_1'],
  affiliationStatus: 'ACTIVE',
};

const testClass = {
  id: 'cls_test_1',
  name: 'Synthetic Squad',
  schedule: 'Mon 7:00 PM',
  location: 'Test Hall',
  capacity: 20,
  operational_status: 'ACTIVE',
  enrollment_availability: 'OPEN',
};

const upcomingSession = {
  id: 'sess_test_1',
  class_id: 'cls_test_1',
  session_date: '2026-11-20',
  start_time: '19:00',
  end_time: '20:30',
  location: 'Test Hall',
  status: 'Scheduled',
};

function routeGet(path: string): Promise<any> {
  if (path.includes('/dashboard/master')) {
    return Promise.resolve({
      hasApprovedClasses: true,
      todayClasses: [testClass],
      todaySessions: [],
      activeStudentCount: 0,
    });
  }
  if (path.startsWith('/classes/organization/')) return Promise.resolve({ classes: [testClass] });
  if (path === '/class-applications/me') return Promise.resolve({ applications: [] });
  if (path === '/handovers/incoming') {
    return Promise.resolve({
      incomingHandovers: [
        {
          id: 'ho_test_1',
          class_name: 'Synthetic Handover Class',
          outgoing_master_name: 'Outgoing Master',
          status: 'PENDING',
          reason: 'Relocation',
          effective_date: '2026-12-01',
        },
      ],
    });
  }
  if (path === `/classes/${testClass.id}/workspace`) {
    return Promise.resolve({
      class: testClass,
      activeStudentsCount: 0,
      availableSpots: 20,
      trainingGroups: [],
      todaySessions: [],
      upcomingSessions: [upcomingSession],
      recentNotices: [],
    });
  }
  if (path.startsWith(`/classes/${testClass.id}/students`)) return Promise.resolve({ students: [] });
  return Promise.resolve({});
}

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderMaster(enabledModules: string[]) {
  (releaseService.getReleaseModules as jest.Mock).mockResolvedValue({ release: 'R4', enabledModules });
  const utils = await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="dark">
        <MasterNavigator user={masterUser} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(releaseService.getReleaseModules).toHaveBeenCalled());
  return utils;
}

async function openWorkspace(utils: Awaited<ReturnType<typeof renderMaster>>) {
  await act(async () => {
    fireEvent.press(utils.getByTestId('tab-master-classes'));
  });
  const btn = await utils.findByTestId(`btn-workspace-${testClass.id}`);
  await act(async () => {
    fireEvent.press(btn);
  });
  await utils.findByTestId('class-workspace-screen');
}

describe('Master navigation wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDashboardCache();
    (apiClient.get as jest.Mock).mockImplementation(routeGet);
  });

  test('Incoming handovers open from the Master home quick actions', async () => {
    const utils = await renderMaster(ALL_OPTIONAL);
    const shortcut = await utils.findByTestId('shortcut-master-incoming-handovers');
    expect(shortcut.props.accessibilityRole ?? 'button').toBe('button');
    await act(async () => {
      fireEvent.press(shortcut);
    });
    expect(await utils.findByTestId('btn-accept-handover-ho_test_1')).toBeTruthy();
    expect(utils.getByText('Synthetic Handover Class')).toBeTruthy();
  });

  test('Incoming handovers open from the Classes list', async () => {
    const utils = await renderMaster([]);
    await act(async () => {
      fireEvent.press(utils.getByTestId('tab-master-classes'));
    });
    await act(async () => {
      fireEvent.press(await utils.findByTestId('btn-incoming-handovers'));
    });
    expect(await utils.findByTestId('btn-accept-handover-ho_test_1')).toBeTruthy();
  });

  test('home messaging shortcut is shown when the messaging module is enabled', async () => {
    const utils = await renderMaster(['messaging']);
    expect(await utils.findByTestId('shortcut-master-messaging')).toBeTruthy();
  });

  test('home messaging shortcut is hidden when the messaging module is disabled', async () => {
    const utils = await renderMaster([]);
    await utils.findByTestId('shortcut-master-incoming-handovers');
    await waitFor(() => expect(utils.queryByTestId('shortcut-master-messaging')).toBeNull());
  });

  test('workspace trials link opens Trials & Retention when enabled', async () => {
    const utils = await renderMaster(ALL_OPTIONAL);
    await openWorkspace(utils);

    expect(utils.getByTestId('btn-quick-messages')).toBeTruthy();

    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-quick-trials'));
    });
    expect(await utils.findByText('Trials & Retention')).toBeTruthy();
  });

  test('workspace transfers link opens Pauses & Transfers', async () => {
    const utils = await renderMaster(['transfers']);
    await openWorkspace(utils);
    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-quick-transfers'));
    });
    expect(await utils.findAllByText('Pauses & Transfers')).toBeTruthy();
  });

  test('per-session lesson plan and make-up buttons open their screens', async () => {
    const utils = await renderMaster(['teaching', 'bookings']);
    await openWorkspace(utils);
    await act(async () => {
      fireEvent.press(utils.getByTestId('tab-workspace-schedule'));
    });

    await act(async () => {
      fireEvent.press(await utils.findByTestId('btn-lesson-plan-sess_test_1'));
    });
    expect(await utils.findByTestId('lesson-plan-modal')).toBeTruthy();
    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-close-lesson-modal'));
    });

    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-makeup-sess_test_1'));
    });
    expect(await utils.findByTestId('master-makeup-screen')).toBeTruthy();
  });

  test('workspace hides optional-module entries when the modules are disabled', async () => {
    const utils = await renderMaster([]);
    await openWorkspace(utils);
    await waitFor(() => expect(utils.queryByTestId('btn-quick-trials')).toBeNull());
    expect(utils.queryByTestId('btn-quick-transfers')).toBeNull();
    expect(utils.queryByTestId('btn-quick-messages')).toBeNull();
    expect(utils.getByTestId('btn-quick-rollcall')).toBeTruthy();

    await act(async () => {
      fireEvent.press(utils.getByTestId('tab-workspace-schedule'));
    });
    await utils.findByText('2026-11-20 • 19:00 - 20:30');
    expect(utils.queryByTestId('btn-lesson-plan-sess_test_1')).toBeNull();
    expect(utils.queryByTestId('btn-makeup-sess_test_1')).toBeNull();
  });
});
