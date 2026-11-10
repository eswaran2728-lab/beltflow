import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { authService } from '../services/authService';
import { UserRole, AuthUser } from '../types/auth';
import { AppNavigator } from '../navigation/AppNavigator';
import { SuperAdminNavigator } from '../navigation/roleNavigators/SuperAdminNavigator';
import { AdminPersatuanNavigator } from '../navigation/roleNavigators/AdminPersatuanNavigator';
import { MasterNavigator } from '../navigation/roleNavigators/MasterNavigator';
import { ParentNavigator } from '../navigation/roleNavigators/ParentNavigator';
import { StudentNavigator } from '../navigation/roleNavigators/StudentNavigator';
import { roleNavigationRef } from '../navigation/RoleNavigationContainer';
import {
  canPerformSensitiveOnlineOperation,
  resolveVerifiedRole,
} from '../navigation/sessionAuthority';

// Mock authService
jest.mock('../services/authService', () => {
  let sessionEndedCallback: (() => void) | null = null;
  return {
    authService: {
      login: jest.fn(),
      getStoredSession: jest.fn(),
      getProfile: jest.fn(),
      validateStoredSession: jest.fn(),
      logout: jest.fn(),
      onSessionEnded: jest.fn((cb: () => void) => {
        sessionEndedCallback = cb;
        return () => {
          sessionEndedCallback = null;
        };
      }),
      _triggerSessionEnded: () => {
        if (sessionEndedCallback) sessionEndedCallback();
      },
    },
  };
});

jest.mock('../services/certificateService', () => ({
  certificateService: {
    verifyCertificate: jest.fn(),
  },
}));

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement, isDark = true) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode={isDark ? 'dark' : 'light'}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('BeltFlow Role-Based Navigation Architecture — Task 1.6 (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Role-to-Navigator Matching', () => {
    test('SUPER_ADMIN receives SuperAdminNavigator with exact destinations and no operational records', async () => {
      const superAdminUser: AuthUser = {
        id: 'usr_sa_001',
        fullName: 'Super Administrator',
        email: 'superadmin@beltflow.com',
        role: UserRole.SUPER_ADMIN,
      };

      const onLogout = jest.fn();
      const { getByText, getByLabelText, queryByText } = await renderWithTheme(
        <SuperAdminNavigator user={superAdminUser} onLogout={onLogout} />
      );

      // Verify Super Admin tab titles / headers
      expect(getByText('Super Admin Home')).toBeTruthy();
      // Short visible tab labels avoid truncation; full names exposed to screen readers.
      expect(getByText('Persatuans')).toBeTruthy();
      expect(getByText('Audit')).toBeTruthy();
      expect(getByLabelText('Persatuan Management Tab')).toBeTruthy();
      expect(getByLabelText('Platform Audit Tab')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();

      // Super Admin must NOT have academy operational destinations
      expect(queryByText('Mat Attendance')).toBeNull();
      expect(queryByText('Belt Grading')).toBeNull();
      expect(queryByText('Linked Children')).toBeNull();
    });

    test('ADMIN_PERSATUAN receives AdminPersatuanNavigator with 5 destinations and no master fee controls', async () => {
      const adminPersatuanUser: AuthUser = {
        id: 'usr_ap_001',
        fullName: 'Persatuan Admin Aminah',
        email: 'admin@silambam.my',
        role: UserRole.ADMIN_PERSATUAN,
        organizationId: 'org_silambam_01',
      };

      const onLogout = jest.fn();
      const { getByText, queryByText } = await renderWithTheme(
        <AdminPersatuanNavigator user={adminPersatuanUser} onLogout={onLogout} />
      );

      // Verify Admin Persatuan destinations
      expect(getByText('Persatuan Dashboard')).toBeTruthy();
      expect(getByText('Locations')).toBeTruthy();
      expect(getByText('Masters')).toBeTruthy();
      expect(getByText('Reports')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();

      // Persatuan Admin must NOT have Super Admin audit or Master grading control
      expect(queryByText('Platform Audit')).toBeNull();
      expect(queryByText('Belt Grading')).toBeNull();
    });

    test('MASTER receives MasterNavigator with bottom tabs and nested Students stack', async () => {
      const masterUser: AuthUser = {
        id: 'usr_master_001',
        fullName: 'Master Suresh',
        email: 'master@silambam.my',
        role: UserRole.MASTER,
        organizationId: 'org_silambam_01',
        assignedClassIds: ['cls_01', 'cls_02'],
      };

      const onLogout = jest.fn();
      const { getByText, getByTestId, queryByText } = await renderWithTheme(
        <MasterNavigator user={masterUser} onLogout={onLogout} />
      );

      // Verify Master bottom tab destinations
      expect(getByText('Master Home')).toBeTruthy();
      expect(getByText('Classes')).toBeTruthy();
      expect(getByText('Attendance')).toBeTruthy();
      expect(getByText('Grading')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();

      // Master must NOT have Super Admin or Parent destinations
      expect(queryByText('Platform Audit')).toBeNull();
      expect(queryByText('Linked Children')).toBeNull();

      // Navigate to Classes tab to verify Students screen access via nested stack
      await act(async () => {
        fireEvent.press(getByTestId('tab-master-classes'));
      });

      expect(getByText('Assigned Classes')).toBeTruthy();
      expect(getByTestId('btn-view-class-students')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-view-class-students'));
      });

      expect(getByText('Class Students')).toBeTruthy();
    });

    test('PARENT receives ParentNavigator with Children, Fees, Notices, Profile', async () => {
      const parentUser: AuthUser = {
        id: 'usr_parent_001',
        fullName: 'Dr. Ramesh Kumar',
        email: 'ramesh@example.com',
        role: UserRole.PARENT,
        organizationId: 'org_silambam_01',
        linkedStudentIds: ['stu_001'],
      };

      const onLogout = jest.fn();
      const { getByText, queryByText } = await renderWithTheme(
        <ParentNavigator user={parentUser} onLogout={onLogout} />
      );

      expect(getByText('Parent Home')).toBeTruthy();
      expect(getByText('Children')).toBeTruthy();
      expect(getByText('Fees')).toBeTruthy();
      expect(getByText('Notices')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();

      // Parents must NOT have coach or admin controls
      expect(queryByText('Belt Grading')).toBeNull();
      expect(queryByText('Platform Audit')).toBeNull();
    });

    test('STUDENT receives StudentNavigator with Progress, Attendance, Certificates, Profile', async () => {
      const studentUser: AuthUser = {
        id: 'usr_student_001',
        fullName: 'Aryan Suresh',
        email: 'aryan@example.com',
        role: UserRole.STUDENT,
        organizationId: 'org_silambam_01',
      };

      const onLogout = jest.fn();
      const { getByText, queryByText } = await renderWithTheme(
        <StudentNavigator user={studentUser} onLogout={onLogout} />
      );

      expect(getByText('Student Home')).toBeTruthy();
      expect(getByText('Progress')).toBeTruthy();
      expect(getByText('Attendance')).toBeTruthy();
      expect(getByText('Certificates')).toBeTruthy();
      expect(getByText('Profile')).toBeTruthy();

      // Students must NOT have parent fee or admin audit destinations
      expect(queryByText('Fee Payments')).toBeNull();
      expect(queryByText('Platform Audit')).toBeNull();
    });
  });

  describe('2. Unauthorized & Unknown Role Protection', () => {
    test('blocks unknown or invalid role strings from privileged navigation', async () => {
      const invalidUser: any = {
        id: 'usr_hacker_001',
        fullName: 'Malicious Entity',
        email: 'attacker@evil.com',
        role: 'SUPER_USER_HACK',
      };

      const { getByText, queryByText } = await renderWithTheme(
        <AppNavigator initialUser={invalidUser} />
      );

      expect(getByText('Unauthorized Role')).toBeTruthy();
      expect(getByText(/Your account role is not recognized/i)).toBeTruthy();

      // No privileged navigators mounted
      expect(queryByText('Super Admin Home')).toBeNull();
      expect(queryByText('Master Home')).toBeNull();
      expect(queryByText('Persatuan Dashboard')).toBeNull();
    });

    test('unauthorized screen cannot navigate to privileged screens', async () => {
      const invalidUser: any = {
        id: 'usr_unknown',
        fullName: 'Unknown User',
        email: 'unknown@example.com',
        role: 'GUEST',
      };

      const { getByTestId, queryByText } = await renderWithTheme(
        <AppNavigator initialUser={invalidUser} />
      );

      expect(queryByText('Super Admin Home')).toBeNull();
      expect(getByTestId('btn-unauthorized-logout')).toBeTruthy();
    });
  });

  describe('3. Session Validation & Offline Handling', () => {
    test('bootstrap: server-verified session mounts the role from the /auth/me response', async () => {
      const freshUser: AuthUser = {
        id: 'usr_001',
        fullName: 'Updated Name From Server',
        email: 'user@beltflow.com',
        role: UserRole.STUDENT,
        organizationId: 'org_001',
      };

      (authService.validateStoredSession as jest.Mock).mockResolvedValue({
        isValid: true,
        user: freshUser,
        isVerifiedOnline: true,
        isOffline: false,
        reason: 'verified_online',
      });

      const { findByText, queryByTestId } = await renderWithTheme(<AppNavigator />);

      expect(await findByText('Student Home')).toBeTruthy();
      expect(await findByText('Updated Name From Server')).toBeTruthy();
      expect(queryByTestId('offline-security-banner')).toBeNull();
      expect(authService.validateStoredSession).toHaveBeenCalledTimes(1);
    });

    test('bootstrap: offline cached session mounts navigator but flags unverified identity', async () => {
      const cachedUser: AuthUser = {
        id: 'usr_master_offline',
        fullName: 'Master Offline',
        email: 'master@silambam.my',
        role: UserRole.MASTER,
      };

      (authService.validateStoredSession as jest.Mock).mockResolvedValue({
        isValid: true,
        user: cachedUser,
        isVerifiedOnline: false,
        isOffline: true,
        reason: 'cached_offline',
      });

      const { findByText, findByTestId } = await renderWithTheme(<AppNavigator />);

      expect(await findByText('Master Home')).toBeTruthy();
      expect(await findByTestId('offline-security-banner')).toBeTruthy();
    });

    test('bootstrap: invalid/expired session never mounts a role navigator', async () => {
      (authService.validateStoredSession as jest.Mock).mockResolvedValue({
        isValid: false,
        user: null,
        isVerifiedOnline: false,
        isOffline: false,
        reason: 'invalid_credentials',
      });

      const { findByTestId, queryByText } = await renderWithTheme(<AppNavigator />);

      expect(await findByTestId('login-screen')).toBeTruthy();
      expect(queryByText('Student Home')).toBeNull();
      expect(queryByText('Master Home')).toBeNull();
    });

    test('bootstrap: inactive account is rejected', async () => {
      (authService.validateStoredSession as jest.Mock).mockResolvedValue({
        isValid: false,
        user: null,
        isVerifiedOnline: false,
        isOffline: false,
        reason: 'inactive_account',
      });

      const { findByTestId, queryByText } = await renderWithTheme(<AppNavigator />);
      expect(await findByTestId('login-screen')).toBeTruthy();
      expect(queryByText('Parent Home')).toBeNull();
    });

    test('offline/cached authority can never authorize sensitive online operations', () => {
      expect(
        canPerformSensitiveOnlineOperation({
          verification: 'cached_offline',
          isVerifiedOnline: false,
          isOffline: true,
        })
      ).toBe(false);
      expect(
        canPerformSensitiveOnlineOperation({
          verification: 'unverified',
          isVerifiedOnline: false,
          isOffline: false,
        })
      ).toBe(false);
      expect(canPerformSensitiveOnlineOperation(undefined)).toBe(false);
      expect(
        canPerformSensitiveOnlineOperation({
          verification: 'verified_online',
          isVerifiedOnline: true,
          isOffline: false,
        })
      ).toBe(true);
    });

    test('injected identity fails closed (unverified) unless authority is explicitly provided', async () => {
      const studentUser: AuthUser = {
        id: 'usr_stu_inj',
        fullName: 'Injected Student',
        email: 'inj@example.com',
        role: UserRole.STUDENT,
      };
      const { getByTestId } = await renderWithTheme(<AppNavigator initialUser={studentUser} />);
      expect(getByTestId('offline-security-banner')).toBeTruthy();
    });

    test('displays offline banner and restricts sensitive actions when offline', async () => {
      const masterUser: AuthUser = {
        id: 'usr_m_offline',
        fullName: 'Master Offline',
        email: 'master@silambam.my',
        role: UserRole.MASTER,
      };

      const { getByText, getByTestId } = await renderWithTheme(
        <MasterNavigator user={masterUser} onLogout={jest.fn()} isOffline={true} />
      );

      expect(getByText(/Offline Mode: Locally Cached Identity/i)).toBeTruthy();
      expect(getByTestId('offline-security-banner')).toBeTruthy();
    });
  });

  describe('4. Navigation State & Lifecycle Security', () => {
    test('logging out clears authenticated navigator and returns to login', async () => {
      const studentUser: AuthUser = {
        id: 'usr_stu_001',
        fullName: 'Aryan Suresh',
        email: 'aryan@example.com',
        role: UserRole.STUDENT,
      };

      const { getByTestId, queryByText } = await renderWithTheme(
        <AppNavigator initialUser={studentUser} />
      );

      expect(getByTestId('tab-student-profile')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('tab-student-profile'));
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-role-logout'));
      });

      expect(authService.logout).toHaveBeenCalled();

      await waitFor(() => {
        expect(queryByText('Student Home')).toBeNull();
      });
    });

    test('session expiration notification resets navigation to login', async () => {
      const parentUser: AuthUser = {
        id: 'usr_parent_002',
        fullName: 'Parent Kumar',
        email: 'parent@example.com',
        role: UserRole.PARENT,
      };

      const { getByText, queryByText } = await renderWithTheme(
        <AppNavigator initialUser={parentUser} />
      );

      expect(getByText('Parent Home')).toBeTruthy();

      // Trigger automatic session expiration
      await act(async () => {
        (authService as any)._triggerSessionEnded();
      });

      await waitFor(() => {
        expect(queryByText('Parent Home')).toBeNull();
      });
    });

    test('tenant switching updates organization identity without state bleed', async () => {
      const initialUser: AuthUser = {
        id: 'usr_ap_01',
        fullName: 'Admin Org 1',
        email: 'admin@org1.com',
        role: UserRole.ADMIN_PERSATUAN,
        organizationId: 'org_001',
      };

      const { getByText, rerender } = await renderWithTheme(
        <AdminPersatuanNavigator user={initialUser} onLogout={jest.fn()} />
      );

      expect(getByText(/org_001/i)).toBeTruthy();

      const switchedUser: AuthUser = {
        ...initialUser,
        organizationId: 'org_002',
      };

      await rerender(
        <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
          <ThemeProvider defaultMode="dark">
            <AdminPersatuanNavigator user={switchedUser} onLogout={jest.fn()} />
          </ThemeProvider>
        </SafeAreaProvider>
      );

      expect(getByText(/org_002/i)).toBeTruthy();
    });
  });

  describe('5. Accessibility and Theme Adaptability', () => {
    test('renders accessible tab bar items and labels', async () => {
      const studentUser: AuthUser = {
        id: 'usr_stu_001',
        fullName: 'Aryan Suresh',
        email: 'aryan@example.com',
        role: UserRole.STUDENT,
      };

      const { getByLabelText } = await renderWithTheme(
        <StudentNavigator user={studentUser} onLogout={jest.fn()} />
      );

      expect(getByLabelText('Home Tab')).toBeTruthy();
      expect(getByLabelText('Progress Tab')).toBeTruthy();
      expect(getByLabelText('Attendance Tab')).toBeTruthy();
      expect(getByLabelText('Certificates Tab')).toBeTruthy();
      expect(getByLabelText('Profile Tab')).toBeTruthy();
    });

    test('renders with light theme tokens without crashing', async () => {
      const superAdminUser: AuthUser = {
        id: 'usr_sa_light',
        fullName: 'Super Admin Light',
        email: 'sa@beltflow.com',
        role: UserRole.SUPER_ADMIN,
      };

      const { getByText } = await renderWithTheme(
        <SuperAdminNavigator user={superAdminUser} onLogout={jest.fn()} />,
        false // light theme
      );

      expect(getByText('Super Admin Home')).toBeTruthy();
    });
  });

  describe('6. Deep Links, Route Registration & Tenant Isolation', () => {
    const getRouteNames = () => roleNavigationRef.getRootState()?.routeNames ?? [];

    test('only the active role routes are registered (Student tree has no admin/master routes)', async () => {
      const studentUser: AuthUser = {
        id: 'usr_stu_dl',
        fullName: 'Deep Link Student',
        email: 'dl@example.com',
        role: UserRole.STUDENT,
      };
      await renderWithTheme(<AppNavigator initialUser={studentUser} />);

      expect(roleNavigationRef.isReady()).toBe(true);
      // H26 adds the shared read-only Assistant tab for every role.
      expect(getRouteNames()).toEqual(['Home', 'Progress', 'Attendance', 'Certificates', 'Assistant', 'Profile']);
      for (const forbidden of ['Persatuans', 'Audit', 'Locations', 'Masters', 'Grading', 'Children', 'Fees']) {
        expect(getRouteNames()).not.toContain(forbidden);
      }
    });

    test('programmatic/deep-link navigation to another role route cannot render it', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const parentUser: AuthUser = {
        id: 'usr_par_dl',
        fullName: 'Deep Link Parent',
        email: 'pdl@example.com',
        role: UserRole.PARENT,
        linkedStudentIds: ['stu_1'],
      };
      const { queryByText, getByText } = await renderWithTheme(
        <AppNavigator initialUser={parentUser} />
      );

      await act(async () => {
        // Simulates a crafted deep link resolving to privileged routes.
        roleNavigationRef.navigate('PlatformAudit' as never);
        roleNavigationRef.navigate('Grading' as never);
        roleNavigationRef.navigate('Masters' as never);
      });

      expect(getByText('Parent Home')).toBeTruthy();
      expect(queryByText('Platform Audit')).toBeNull();
      expect(queryByText('Belt Grading')).toBeNull();
      expect(roleNavigationRef.getCurrentRoute()?.name).toBe('Home');
      errorSpy.mockRestore();
    });

    test('after logout no role navigation container remains mounted', async () => {
      const masterUser: AuthUser = {
        id: 'usr_m_lo',
        fullName: 'Master Logout',
        email: 'mlo@example.com',
        role: UserRole.MASTER,
      };
      const { getByTestId, findByTestId } = await renderWithTheme(
        <AppNavigator initialUser={masterUser} />
      );
      expect(roleNavigationRef.isReady()).toBe(true);

      await act(async () => {
        fireEvent.press(getByTestId('btn-role-logout'));
      });

      expect(await findByTestId('login-screen')).toBeTruthy();
      expect(roleNavigationRef.isReady()).toBe(false);
    });

    test('re-login as a different tenant starts on Home with no stale history', async () => {
      const orgOneAdmin: AuthUser = {
        id: 'usr_ap_t1',
        fullName: 'Admin Tenant One',
        email: 't1@org1.com',
        role: UserRole.ADMIN_PERSATUAN,
        organizationId: 'org_tenant_one',
      };
      const { getByTestId, queryByText, findByText } = await renderWithTheme(
        <AppNavigator initialUser={orgOneAdmin} />
      );

      await act(async () => {
        fireEvent.press(getByTestId('tab-ap-reports'));
      });
      expect(roleNavigationRef.getCurrentRoute()?.name).toBe('Reports');

      // Server reports session ended (e.g. account/tenant changed elsewhere).
      await act(async () => {
        (authService as any)._triggerSessionEnded();
      });
      await waitFor(() => expect(queryByText(/org_tenant_one/)).toBeNull());

      // A new verified sign-in for another tenant.
      const orgTwoAdmin: AuthUser = { ...orgOneAdmin, id: 'usr_ap_t2', organizationId: 'org_tenant_two' };
      (authService.login as jest.Mock).mockResolvedValue({ message: 'ok', token: 't', user: orgTwoAdmin });

      await act(async () => {
        fireEvent.changeText(getByTestId('input-email'), 't2@org2.com');
        fireEvent.changeText(getByTestId('input-password'), 'Password123!');
      });
      await act(async () => {
        fireEvent.press(getByTestId('btn-login-submit'));
      });

      expect(await findByText(/org_tenant_two/)).toBeTruthy();
      expect(queryByText(/org_tenant_one/)).toBeNull();
      expect(roleNavigationRef.getCurrentRoute()?.name).toBe('Home');
    });

    test('role resolution rejects unknown, mis-cased and missing roles', () => {
      expect(resolveVerifiedRole({ role: UserRole.MASTER })).toBe('MASTER');
      expect(resolveVerifiedRole({ role: 'master' as any })).toBeNull();
      expect(resolveVerifiedRole({ role: 'ROOT' as any })).toBeNull();
      expect(resolveVerifiedRole({ role: undefined as any })).toBeNull();
      expect(resolveVerifiedRole(null)).toBeNull();
    });
  });
});
