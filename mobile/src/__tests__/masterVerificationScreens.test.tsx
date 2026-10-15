import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { MasterApplicationStatusScreen } from '../screens/roles/master/MasterApplicationStatusScreen';
import { MasterApprovalsScreen } from '../screens/roles/adminPersatuan/MasterApprovalsScreen';
import { MasterNavigator } from '../navigation/roleNavigators/MasterNavigator';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
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

describe('H03 — Master Verification & Persatuan Approval Screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. MasterApplicationStatusScreen', () => {
    const unverifiedMaster: AuthUser = {
      id: 'usr_m_test',
      fullName: 'Master Aspirant',
      email: 'aspirant@silambam.my',
      role: UserRole.MASTER,
      affiliationStatus: 'PENDING',
    };

    test('renders draft submission form when applicant has no existing application', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/auth/registration-organizations')) {
          return Promise.resolve({
            organizations: [
              { id: 'org_01', name: 'Persatuan Silambam Selangor', state: 'Selangor' },
            ],
          });
        }
        if (url.includes('/master-applications/me')) {
          return Promise.resolve({
            applications: [],
            currentAffiliationStatus: 'PENDING',
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <MasterApplicationStatusScreen user={unverifiedMaster} />
      );

      await waitFor(() => {
        expect(getByText('Master Verification')).toBeTruthy();
        expect(getByText('Persatuan Silambam Selangor')).toBeTruthy();
        expect(getByTestId('input-qualifications')).toBeTruthy();
        expect(getByTestId('btn-submit-application')).toBeTruthy();
      });
    });

    test('renders submitted application status and allows withdrawal', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/master-applications/me')) {
          return Promise.resolve({
            applications: [
              {
                id: 'app_sub_01',
                user_id: 'usr_m_test',
                organization_id: 'org_01',
                organization_name: 'Persatuan Silambam Selangor',
                qualifications: '5th Dan Black Belt',
                experience_summary: '15 years instruction experience',
                status: 'SUBMITTED',
                version: 1,
                submitted_at: '2026-10-15T10:00:00Z',
              },
            ],
            currentAffiliationStatus: 'PENDING',
          });
        }
        return Promise.resolve({ organizations: [] });
      });

      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title: any, _msg: any, buttons: any) => {
          if (buttons && buttons[1] && buttons[1].onPress) {
            buttons[1].onPress();
          }
        }
      );

      (apiClient.post as jest.Mock).mockResolvedValue({
        message: 'Application withdrawn successfully.',
        application: { id: 'app_sub_01', status: 'WITHDRAWN' },
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <MasterApplicationStatusScreen user={unverifiedMaster} />
      );

      await waitFor(() => {
        expect(getByText('Under Persatuan Review')).toBeTruthy();
        expect(getByText('5th Dan Black Belt')).toBeTruthy();
        expect(getByTestId('btn-withdraw-app')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-withdraw-app'));
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/master-applications/app_sub_01/withdraw',
        expect.anything()
      );
      alertSpy.mockRestore();
    });


    test('displays requested information when status is NEEDS_INFORMATION', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/master-applications/me')) {
          return Promise.resolve({
            applications: [
              {
                id: 'app_info_01',
                user_id: 'usr_m_test',
                organization_id: 'org_01',
                organization_name: 'Persatuan Silambam Selangor',
                qualifications: '4th Dan',
                experience_summary: '10 years',
                status: 'NEEDS_INFORMATION',
                version: 2,
                requested_information: 'Please attach national instructor certificate registration code.',
              },
            ],
            currentAffiliationStatus: 'PENDING',
          });
        }
        return Promise.resolve({ organizations: [] });
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <MasterApplicationStatusScreen user={unverifiedMaster} />
      );

      await waitFor(() => {
        expect(getByText('Corrections or Additional Details Requested')).toBeTruthy();
        expect(getByText('Please attach national instructor certificate registration code.')).toBeTruthy();
        expect(getByTestId('btn-submit-application')).toBeTruthy();
      });
    });

  });

  describe('2. MasterApprovalsScreen (Admin Persatuan Inbox)', () => {
    const adminUser: AuthUser = {
      id: 'usr_admin_selangor',
      fullName: 'Admin Selangor',
      email: 'admin@selangor.my',
      role: UserRole.ADMIN_PERSATUAN,
      organizationId: 'org_01',
    };

    const mockApplications = [
      {
        id: 'app_inbox_01',
        user_id: 'usr_m_01',
        applicant_name: 'Master Suresh',
        qualifications: '6th Dan Instructor',
        experience_summary: '20 years national coach',
        verification_details: 'Cert #SIL-MY-2026-99',
        status: 'SUBMITTED',
        version: 1,
        submitted_at: '2026-10-15T09:00:00Z',
      },
    ];

    test('renders inbox list with filter tabs and shows application card', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/master-applications/inbox') {
          return Promise.resolve({ applications: mockApplications });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <MasterApprovalsScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByText('Master Verifications')).toBeTruthy();
        expect(getByText('Master Suresh')).toBeTruthy();
        expect(getByTestId('status-badge-app_inbox_01')).toBeTruthy();
      });
    });

    test('allows viewing application detail and approving applicant', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/master-applications/inbox') {
          return Promise.resolve({ applications: mockApplications });
        }
        if (url === '/master-applications/app_inbox_01') {
          return Promise.resolve({ application: mockApplications[0] });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        message: 'Master application approved and affiliation activated successfully.',
        application: { ...mockApplications[0], status: 'APPROVED', version: 2 },
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <MasterApprovalsScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByTestId('application-card-app_inbox_01')).toBeTruthy();
      });

      // Press application to open detail modal
      await act(async () => {
        fireEvent.press(getByTestId('application-card-app_inbox_01'));
      });

      await waitFor(() => {
        expect(getByText('Application Review')).toBeTruthy();
        expect(getByTestId('btn-decision-approve')).toBeTruthy();
      });

      // Choose approve
      await act(async () => {
        fireEvent.press(getByTestId('btn-decision-approve'));
      });

      await waitFor(() => {
        expect(getByTestId('btn-confirm-review-action')).toBeTruthy();
      });

      // Confirm approval
      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-review-action'));
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/master-applications/app_inbox_01/review',
        expect.objectContaining({
          action: 'APPROVE',
          expectedVersion: 1,
        })
      );
    });
  });

  describe('3. MasterNavigator Gating for Unverified Masters', () => {
    test('renders MasterApplicationStatusScreen when master affiliation is PENDING', async () => {
      const pendingMaster: AuthUser = {
        id: 'usr_pending_01',
        fullName: 'Prospective Master Siva',
        email: 'siva@example.com',
        role: UserRole.MASTER,
        affiliationStatus: 'PENDING',
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        applications: [],
        currentAffiliationStatus: 'PENDING',
      });

      const { getByText, queryByText } = await renderWithTheme(
        <MasterNavigator user={pendingMaster} onLogout={jest.fn()} />
      );

      await waitFor(() => {
        expect(getByText('Master Verification')).toBeTruthy();
      });

      // Operational tabs should NOT be accessible
      expect(queryByText('Assigned Classes')).toBeNull();
      expect(queryByText('Mat Attendance')).toBeNull();
    });
  });
});
