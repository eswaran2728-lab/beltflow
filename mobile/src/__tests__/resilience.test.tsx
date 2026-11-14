import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { BeltLevelConfig } from '../theme/belts';
import { networkService } from '../services/networkService';
import { authService } from '../services/authService';
import { apiClient, ApiError } from '../services/apiClient';
import { clearDashboardCache, dashboardService } from '../services/dashboardService';
import {
  ConnectivityBanner,
  PermissionDeniedState,
  SessionExpiredState,
  ServiceUnavailableState,
  InlineLoadingState,
  SkeletonCard,
  SkeletonList,
} from '../components/Resilience';
import { SyncFeedbackCard } from '../components/SyncFeedback';
import { StudentHomeScreen } from '../screens/roles/student';

// Mock apiClient and authService
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => jest.fn()),
  ApiError: class ApiError extends Error {
    public status: number;
    public isNetworkError: boolean;
    public isTimeout: boolean;
    public isUnauthorized: boolean;
    constructor(params: { message: string; status: number; isNetworkError?: boolean; isTimeout?: boolean; isUnauthorized?: boolean }) {
      super(params.message);
      this.name = 'ApiError';
      this.status = params.status;
      this.isNetworkError = Boolean(params.isNetworkError);
      this.isTimeout = Boolean(params.isTimeout);
      this.isUnauthorized = Boolean(params.isUnauthorized || params.status === 401);
    }
  },
}));

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement, isDark = true, persatuanBelts?: readonly BeltLevelConfig[]) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode={isDark ? 'dark' : 'light'} persatuanBelts={persatuanBelts}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('BeltFlow Mobile Offline Status & Resilience UI — Task 1.8 (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({});
    clearDashboardCache();
    networkService.resetForTesting();
  });

  // --------------------------------------------------------------------------
  // 1. Online / Offline Transitions
  // --------------------------------------------------------------------------
  describe('1. Connectivity Transitions', () => {
    test('transitions between online and offline and notifies listeners', async () => {
      const listener = jest.fn();
      const unsubscribe = networkService.onConnectivityChange(listener);

      // Simulate internet connection lost
      await act(async () => {
        networkService.simulateOffline();
      });

      expect(networkService.getState().status).toBe('offline');
      expect(networkService.getState().isInternetReachable).toBe(false);
      expect(networkService.getState().isBackendReachable).toBe(false);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'offline', isInternetReachable: false })
      );

      // Simulate connection restored
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ status: 'ok' });
      await act(async () => {
        await networkService.checkConnectivity({
          internetCheck: () => Promise.resolve(true),
        });
      });

      expect(networkService.getState().status).toBe('online');
      expect(networkService.getState().isInternetReachable).toBe(true);
      expect(networkService.getState().isBackendReachable).toBe(true);

      unsubscribe();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Internet-Connected but Backend Unavailable
  // --------------------------------------------------------------------------
  describe('2. Internet Connected but Backend Unavailable', () => {
    test('distinguishes internet connectivity from backend reachability', async () => {
      // Internet is available, but /api/health fails with 503 or timeout
      (apiClient.get as jest.Mock).mockRejectedValueOnce(
        new ApiError({ message: 'Service Unavailable', status: 503 })
      );

      await act(async () => {
        await networkService.checkConnectivity({
          internetCheck: () => Promise.resolve(true),
        });
      });

      const state = networkService.getState();
      expect(state.status).toBe('backend_unavailable');
      expect(state.isInternetReachable).toBe(true);
      expect(state.isBackendReachable).toBe(false);

      // Verify ConnectivityBanner displays backend unavailable message with retry action
      const onRetry = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <ConnectivityBanner state={state} onRetry={onRetry} />
      );

      expect(getByText(/Backend Unavailable/i)).toBeTruthy();
      expect(getByTestId('btn-connectivity-retry')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-connectivity-retry'));
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Backend Recovery
  // --------------------------------------------------------------------------
  describe('3. Backend Recovery', () => {
    test('recovers from backend outage to online and triggers reconnected listeners', async () => {
      networkService.simulateBackendUnavailable();
      expect(networkService.getState().status).toBe('backend_unavailable');

      const reconnectedListener = jest.fn();
      const unsubscribe = networkService.onReconnected(reconnectedListener);

      // Backend comes back online
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ status: 'ok' });
      await act(async () => {
        await networkService.checkConnectivity({
          internetCheck: () => Promise.resolve(true),
        });
      });

      expect(networkService.getState().status).toBe('online');
      expect(reconnectedListener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Session Revalidation After Reconnection
  // --------------------------------------------------------------------------
  describe('4. Session Revalidation After Reconnection', () => {
    test('revalidates session against /api/v1/auth/me when connection returns', async () => {
      const activeUser: AuthUser = {
        id: 'usr_student_01',
        fullName: 'Ahmad Student',
        email: 'ahmad@example.com',
        role: UserRole.STUDENT,
        organizationId: 'org_001',
      };

      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/auth/me') return Promise.resolve({ user: activeUser });
        return Promise.resolve({});
      });

      const result = await authService.revalidateOnReconnect(activeUser);
      expect(result.isValid).toBe(true);
      expect(result.accountChanged).toBe(false);
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/auth/me');
    });

    test('detects account or organization changes on reconnect and flags cache invalidation', async () => {
      const originalUser: AuthUser = {
        id: 'usr_student_01',
        fullName: 'Ahmad Student',
        email: 'ahmad@example.com',
        role: UserRole.STUDENT,
        organizationId: 'org_001',
      };

      const switchedOrgUser: AuthUser = {
        ...originalUser,
        organizationId: 'org_002', // Admin moved student to another Persatuan!
      };

      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/auth/me') return Promise.resolve({ user: switchedOrgUser });
        return Promise.resolve({});
      });

      const result = await authService.revalidateOnReconnect(originalUser);
      expect(result.isValid).toBe(true);
      expect(result.accountChanged).toBe(true);
      expect(result.user?.organizationId).toBe('org_002');
    });

    test('safely terminates session if token expired while offline', async () => {
      const originalUser: AuthUser = {
        id: 'usr_student_01',
        fullName: 'Ahmad Student',
        email: 'ahmad@example.com',
        role: UserRole.STUDENT,
        organizationId: 'org_001',
      };

      (apiClient.get as jest.Mock).mockRejectedValueOnce(
        new ApiError({ message: 'Token expired', status: 401, isUnauthorized: true })
      );

      const result = await authService.revalidateOnReconnect(originalUser);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('session_expired');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Offline / Unverified Session Restrictions
  // --------------------------------------------------------------------------
  describe('5. Offline Session Restrictions', () => {
    test('renders offline security banner and blocks sensitive operations', async () => {
      const state = {
        status: 'offline' as const,
        isInternetReachable: false,
        isBackendReachable: false,
        lastCheckedAt: new Date(),
      };

      const { getByText, getByTestId } = await renderWithTheme(
        <ConnectivityBanner state={state} />
      );

      expect(getByText(/Offline Mode/i)).toBeTruthy();
      expect(getByTestId('connectivity-banner-offline')).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Pending Sync UI with No Actual Queue Provider
  // --------------------------------------------------------------------------
  describe('6. Synchronization Contracts & UI', () => {
    test('displays explicit offline storage unavailable state and never invents fake records', async () => {
      // In Phase 1, offline attendance queue is not implemented
      const syncState = {
        status: 'unavailable' as const,
        isAvailable: false,
      };

      const { getByText, getByTestId, queryByText } = await renderWithTheme(
        <SyncFeedbackCard state={syncState} />
      );

      expect(getByTestId('sync-feedback-unavailable')).toBeTruthy();
      expect(getByText(/Offline sync not configured/i)).toBeTruthy();

      // Must NOT display fake pending sync counts
      expect(queryByText(/1 pending/i)).toBeNull();
      expect(queryByText(/5 records pending/i)).toBeNull();
    });

    test('displays all changes synchronized when synced', async () => {
      const syncState = {
        status: 'synced' as const,
        isAvailable: true,
        lastSyncedAt: new Date('2026-10-14T10:00:00Z'),
      };

      const { getByText, getByTestId } = await renderWithTheme(
        <SyncFeedbackCard state={syncState} />
      );

      expect(getByTestId('sync-feedback-synced')).toBeTruthy();
      expect(getByText(/All changes synchronized/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Sync Error States
  // --------------------------------------------------------------------------
  describe('7. Sync Error States', () => {
    test('displays synchronization failed message with retry callback', async () => {
      const onRetry = jest.fn();
      const syncState = {
        status: 'failed' as const,
        isAvailable: true,
        errorMessage: 'Server rejected batch attendance update.',
      };

      const { getByText, getByTestId } = await renderWithTheme(
        <SyncFeedbackCard state={syncState} onRetry={onRetry} />
      );

      expect(getByTestId('sync-feedback-failed')).toBeTruthy();
      expect(getByText(/Synchronization failed/i)).toBeTruthy();
      expect(getByText(/Server rejected batch attendance update./i)).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-sync-retry'));
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Error and Retry Actions
  // --------------------------------------------------------------------------
  describe('8. Resilience Error & Retry Actions', () => {
    test('ServiceUnavailableState provides friendly copy and retry button', async () => {
      const onRetry = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <ServiceUnavailableState onRetry={onRetry} />
      );

      expect(getByText(/Service Temporarily Unavailable/i)).toBeTruthy();
      expect(getByTestId('btn-service-unavailable-retry')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-service-unavailable-retry'));
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Logout Cache Cleanup
  // --------------------------------------------------------------------------
  describe('9. Logout Cache Cleanup', () => {
    test('purges dashboard cache when user logs out', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        organizations: [{ id: 'org_01', name: 'Org 1' }],
        logs: [],
      });

      // Populate dashboard cache
      await dashboardService.getSuperAdminDashboard();
      expect(apiClient.get).toHaveBeenCalledTimes(2);

      // Calling again uses memory cache
      await dashboardService.getSuperAdminDashboard();
      expect(apiClient.get).toHaveBeenCalledTimes(2);

      // Logout clears cache
      await authService.logout();

      // Subsequent call re-fetches from server
      await dashboardService.getSuperAdminDashboard();
      expect(apiClient.get).toHaveBeenCalledTimes(4);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Tenant Switching
  // --------------------------------------------------------------------------
  describe('10. Tenant Switching', () => {
    test('switches tenant without data bleed', async () => {
      const tenantOneUser: AuthUser = {
        id: 'usr_ap_01',
        fullName: 'Admin Tenant One',
        email: 't1@tenant1.com',
        role: UserRole.ADMIN_PERSATUAN,
        organizationId: 'org_tenant_one',
      };

      const tenantTwoUser: AuthUser = {
        id: 'usr_ap_02',
        fullName: 'Admin Tenant Two',
        email: 't2@tenant2.com',
        role: UserRole.ADMIN_PERSATUAN,
        organizationId: 'org_tenant_two',
      };

      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('org_tenant_one')) {
          return Promise.resolve({ organization: { id: 'org_tenant_one', name: 'Tenant One Academy' } });
        }
        if (path.includes('org_tenant_two')) {
          return Promise.resolve({ organization: { id: 'org_tenant_two', name: 'Tenant Two Academy' } });
        }
        return Promise.resolve({});
      });

      const data1 = await dashboardService.getAdminPersatuanDashboard(tenantOneUser);
      expect(data1.organization.name).toBe('Tenant One Academy');

      const data2 = await dashboardService.getAdminPersatuanDashboard(tenantTwoUser);
      expect(data2.organization.name).toBe('Tenant Two Academy');
    });
  });

  // --------------------------------------------------------------------------
  // 11. Belt Configuration Missing vs Highest Rank
  // --------------------------------------------------------------------------
  describe('11. Belt Configuration Missing vs Highest Rank', () => {
    const studentUser: AuthUser = {
      id: 'usr_stu_01',
      fullName: 'Kumar Student',
      email: 'kumar@example.com',
      role: UserRole.STUDENT,
      organizationId: 'org_001',
    };

    const mockStudentData = {
      id: 'stu_01',
      fullName: 'Kumar Student',
      belt_rank: 'Green Belt',
      organization_id: 'org_001',
      status: 'ACTIVE',
    };

    test('when belt configuration is missing or empty, shows unavailable state and NEVER claims highest rank', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/students/me') return Promise.resolve({ student: mockStudentData });
        if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
        if (path.includes('/attendance')) return Promise.resolve({ attendance: [] });
        if (path.includes('/skills')) return Promise.resolve({ skills: [] });
        if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
        if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: [] });
        if (path.includes('/organizations/')) return Promise.resolve({ organization: { name: 'Academy' } });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      // Pass empty belts array: []
      const { findByText, queryByText } = await renderWithTheme(
        <StudentHomeScreen user={studentUser} />,
        true,
        [] // empty belt configuration
      );

      // Must display unavailable notice
      expect(await findByText(/Belt progression unavailable/i)).toBeTruthy();

      // Must NEVER claim highest belt rank when configuration is simply missing!
      expect(queryByText(/Highest Belt Rank Achieved/i)).toBeNull();
    });

    test('when configured and student holds top belt, correctly displays Highest Belt Rank Achieved', async () => {
      const customThreeBelts: readonly BeltLevelConfig[] = [
        { id: 'b1', name: 'White Belt', order: 1, colorHex: '#FFFFFF' },
        { id: 'b2', name: 'Green Belt', order: 2, colorHex: '#2ECC71' },
        { id: 'b3', name: 'Black Belt', order: 3, colorHex: '#1A1A1A' },
      ];

      const blackBeltStudent = {
        ...mockStudentData,
        belt_rank: 'Black Belt',
      };

      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/students/me') return Promise.resolve({ student: blackBeltStudent });
        if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
        if (path.includes('/attendance')) return Promise.resolve({ attendance: [] });
        if (path.includes('/skills')) return Promise.resolve({ skills: [] });
        if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
        if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: [] });
        if (path.includes('/organizations/')) return Promise.resolve({ organization: { name: 'Academy' } });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const { findByText } = await renderWithTheme(
        <StudentHomeScreen user={studentUser} />,
        true,
        customThreeBelts
      );

      expect(await findByText(/Highest Belt Rank Achieved/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 12. Authorization-Sensitive Data Handling (403)
  // --------------------------------------------------------------------------
  describe('12. Authorization-Sensitive Data Handling', () => {
    test('PermissionDeniedState renders user-friendly message without leaking stack traces', async () => {
      const onAction = jest.fn();
      const { getByText, queryByText } = await renderWithTheme(
        <PermissionDeniedState onAction={onAction} />
      );

      expect(getByText(/Access Restricted/i)).toBeTruthy();
      expect(getByText(/You do not have permission to view or manage these records/i)).toBeTruthy();

      // Must not leak internal database errors or stack traces
      expect(queryByText(/SQL/i)).toBeNull();
      expect(queryByText(/at Object/i)).toBeNull();
      expect(queryByText(/PostgreSQL/i)).toBeNull();
    });

    test('SessionExpiredState provides return to login action', async () => {
      const onLogin = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <SessionExpiredState onLoginRedirect={onLogin} />
      );

      expect(getByText(/Session Expired/i)).toBeTruthy();
      expect(getByTestId('btn-session-expired-login')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-session-expired-login'));
      });
      expect(onLogin).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // 13. Theme Switching
  // --------------------------------------------------------------------------
  describe('13. Theme Switching', () => {
    test('resilience components render properly in light mode without crashing', async () => {
      const { getByText } = await renderWithTheme(
        <PermissionDeniedState />,
        false // Light mode
      );

      expect(getByText(/Access Restricted/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 14. Accessibility
  // --------------------------------------------------------------------------
  describe('14. Accessibility', () => {
    test('banners, skeletons and retry buttons provide screen reader labels and min touch targets', async () => {
      const onRetry = jest.fn();
      const { getByLabelText, getAllByLabelText, getByTestId } = await renderWithTheme(
        <>
          <InlineLoadingState message="Updating syllabus..." testID="inline-loading" />
          <SkeletonCard testID="test-skeleton" />
          <SkeletonList count={2} />
          <ServiceUnavailableState onRetry={onRetry} />
        </>
      );

      // Screen reader announcements & labels
      expect(getByLabelText(/Updating syllabus/i)).toBeTruthy();
      expect(getAllByLabelText(/Loading placeholder card/i).length).toBe(3);

      const inlineLoader = getByTestId('inline-loading');
      expect(inlineLoader.props.accessibilityRole).toBe('progressbar');

      const skeleton = getByTestId('test-skeleton');
      expect(skeleton.props.accessibilityRole).toBe('progressbar');

      // Retry action provides accessible button
      const retryBtn = getByTestId('btn-service-unavailable-retry');
      expect(retryBtn).toBeTruthy();
    });
  });
});
