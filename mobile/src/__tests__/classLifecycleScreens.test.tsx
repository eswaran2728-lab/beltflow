import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { CreateClassScreen } from '../screens/roles/master/CreateClassScreen';
import { ClassProposalStatusScreen } from '../screens/roles/master/ClassProposalStatusScreen';
import { ClassApprovalsScreen } from '../screens/roles/adminPersatuan/ClassApprovalsScreen';
import { ClassesScreen } from '../screens/roles/master/ClassesScreen';
import { AvailableClassesScreen } from '../screens/roles/parent/AvailableClassesScreen';

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

describe('H04: Mobile Class Lifecycle Screens (Tests 28 - 32)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const verifiedMaster: AuthUser = {
    id: 'usr_m_verified',
    fullName: 'Master Anbarasan',
    email: 'anbarasan@silambam.my',
    role: UserRole.MASTER,
    organizationId: 'org_selangor',
  };

  const adminPersatuan: AuthUser = {
    id: 'usr_adm_selangor',
    fullName: 'Admin Aminah',
    email: 'aminah@selangor.my',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_selangor',
  };

  const parentUser: AuthUser = {
    id: 'usr_parent',
    fullName: 'Parent Kumar',
    email: 'kumar@gmail.com',
    role: UserRole.PARENT,
    organizationId: 'org_selangor',
  };

  // =========================================================================
  // TEST 28: Master mobile form validation
  // =========================================================================
  describe('Test 28: Master mobile form validation (CreateClassScreen)', () => {
    test('validates that class name is required', async () => {
      const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };

      const { getByTestId, getByText } = await renderWithTheme(
        <CreateClassScreen user={verifiedMaster} navigation={mockNavigation} />
      );

      await act(async () => {
        fireEvent.press(getByTestId('btn-submit-class-proposal'));
      });

      await waitFor(() => {
        expect(getByText('Class name is required.')).toBeTruthy();
      });
    });

    test('validates that schedule is required when class name is provided', async () => {
      const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };

      const { getByTestId, getByText } = await renderWithTheme(
        <CreateClassScreen user={verifiedMaster} navigation={mockNavigation} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-class-name'), 'Silambam Youth Form');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-submit-class-proposal'));
      });

      await waitFor(() => {
        expect(getByText('Schedule is required.')).toBeTruthy();
      });
    });

    test('allows saving draft and submitting when form is valid', async () => {
      (apiClient.post as jest.Mock).mockImplementation((url: string) => {
        if (url === '/class-applications') {
          return Promise.resolve({
            application: { id: 'capp_123', status: 'DRAFT', version: 1 },
          });
        }
        return Promise.resolve({});
      });

      const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
      const { getByTestId } = await renderWithTheme(
        <CreateClassScreen user={verifiedMaster} navigation={mockNavigation} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-class-name'), 'Silambam Youth Form');
        fireEvent.changeText(getByTestId('input-location'), 'Shah Alam Hall');
        fireEvent.changeText(getByTestId('input-schedule'), 'Saturday 9 AM');
        fireEvent.changeText(getByTestId('input-fee'), '120');
        fireEvent.changeText(getByTestId('input-capacity'), '25');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-save-class-draft'));
      });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/class-applications',
          expect.objectContaining({
            name: 'Silambam Youth Form',
            location: 'Shah Alam Hall',
            schedule: 'Saturday 9 AM',
          })
        );
      });
    });
  });

  // =========================================================================
  // TEST 29: Master application status display
  // =========================================================================
  describe('Test 29: Master application status display (ClassProposalStatusScreen)', () => {
    test('displays SUBMITTED, NEEDS_INFORMATION, and REJECTED states with reasons', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/class-applications/me') {
          return Promise.resolve({
            applications: [
              {
                id: 'capp_sub',
                name: 'Silambam Traditional',
                status: 'SUBMITTED',
                version: 2,
                schedule: 'Sun 10 AM',
                location: 'Community Hall',
                submitted_at: '2026-10-16T12:00:00Z',
              },
              {
                id: 'capp_info',
                name: 'Silambam Advanced Weapons',
                status: 'NEEDS_INFORMATION',
                version: 3,
                schedule: 'Fri 8 PM',
                location: 'Main Dojo',
                requested_information: 'Please attach hall booking confirmation letter.',
              },
              {
                id: 'capp_rej',
                name: 'Park Training',
                status: 'REJECTED',
                version: 2,
                rejection_reason: 'Outdoor park not permitted for sharp weapons practice.',
              },
            ],
          });
        }
        return Promise.reject(new Error(`Unexpected GET: ${url}`));
      });

      const { getByText } = await renderWithTheme(
        <ClassProposalStatusScreen user={verifiedMaster} />
      );

      await waitFor(() => {
        expect(getByText('Silambam Traditional')).toBeTruthy();
        expect(getByText('Awaiting Review')).toBeTruthy();

        expect(getByText('Silambam Advanced Weapons')).toBeTruthy();
        expect(getByText('Please attach hall booking confirmation letter.')).toBeTruthy();

        expect(getByText('Park Training')).toBeTruthy();
        expect(getByText('Outdoor park not permitted for sharp weapons practice.')).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // TEST 30: Admin class review UI
  // =========================================================================
  describe('Test 30: Admin class review UI (ClassApprovalsScreen)', () => {
    test('renders pending proposals and enables Approve, Request Info, and Reject', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/class-applications/inbox') {
          return Promise.resolve({
            applications: [
              {
                id: 'capp_pending_01',
                proposing_master_name: 'Master Anbarasan',
                name: 'Silambam Mat A',
                schedule: 'Tue & Thu 8 PM',
                location: 'Shah Alam Center',
                capacity: 30,
                monthly_fee: '120.00',
                status: 'SUBMITTED',
                version: 2,
                created_at: '2026-10-15T00:00:00Z',
              },
            ],
          });
        }
        return Promise.reject(new Error(`Unexpected GET: ${url}`));
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        message: 'Class proposal approved and class activated.',
        classId: 'cls_canonical_99',
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <ClassApprovalsScreen user={adminPersatuan} />
      );

      await waitFor(() => {
        expect(getByText('Silambam Mat A')).toBeTruthy();
        expect(getByText(/Master Anbarasan/i)).toBeTruthy();
        expect(getByTestId('btn-review-capp_pending_01')).toBeTruthy();
      });

      // Open review modal
      await act(async () => {
        fireEvent.press(getByTestId('btn-review-capp_pending_01'));
      });

      await waitFor(() => {
        expect(getByTestId('btn-decision-approve')).toBeTruthy();
        expect(getByTestId('btn-decision-request-info')).toBeTruthy();
        expect(getByTestId('btn-decision-reject')).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // TEST 31: Access gating for unapproved classes
  // =========================================================================
  describe('Test 31: Access gating for unapproved classes (ClassesScreen)', () => {
    test('does not show operational actions (attendance, grading) for unapproved proposals', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/classes/organization/')) {
          return Promise.resolve({
            classes: [
              {
                id: 'cls_approved_01',
                name: 'Approved Silambam Class',
                schedule: 'Sat 9 AM',
                approval_status: 'APPROVED',
                operational_status: 'ACTIVE',
              },
            ],
          });
        }
        if (url === '/class-applications/me') {
          return Promise.resolve({
            applications: [
              {
                id: 'capp_pending_99',
                name: 'Pending Class Concept',
                status: 'SUBMITTED',
              },
            ],
          });
        }
        return Promise.reject(new Error(`Unexpected GET: ${url}`));
      });

      const { getByText, queryByTestId, getByTestId } = await renderWithTheme(
        <ClassesScreen user={verifiedMaster} />
      );

      await waitFor(() => {
        expect(getByText('Approved Silambam Class')).toBeTruthy();
        // Approved class has operational action
        expect(getByTestId('btn-operate-cls_approved_01')).toBeTruthy();
      });

      // Switch to Proposals tab
      await act(async () => {
        fireEvent.press(getByTestId('tab-pending-proposals'));
      });

      await waitFor(() => {
        expect(getByText('Pending Class Concept')).toBeTruthy();
        // Pending proposal strictly does not have operational action
        expect(queryByTestId('btn-operate-capp_pending_99')).toBeNull();
      });
    });
  });

  // =========================================================================
  // TEST 32: Parent/student class discovery rendering
  // =========================================================================
  describe('Test 32: Parent/student class discovery rendering (AvailableClassesScreen)', () => {
    test('renders approved open classes and redacts private roster and notes', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/persatuans/org_selangor/available-classes') {
          return Promise.resolve({
            classes: [
              {
                id: 'cls_public_01',
                organizationId: 'org_selangor',
                persatuanName: 'Persatuan Silambam Selangor',
                name: 'Silambam Beginners Cohort',
                schedule: 'Saturday 9:00 AM - 10:30 AM',
                location: 'Shah Alam Community Center',
                venueDetails: 'Court 2, 2nd Floor',
                ageEligibility: '7-15 years',
                trainingLevel: 'Beginner',
                capacity: 30,
                enrollmentAvailability: 'OPEN',
                monthlyFee: 120,
                description: 'Youth foundation martial arts class.',
              },
            ],
          });
        }
        return Promise.reject(new Error(`Unexpected GET: ${url}`));
      });

      const { getByText, queryByText } = await renderWithTheme(
        <AvailableClassesScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(getByText('Silambam Beginners Cohort')).toBeTruthy();
        expect(getByText('Persatuan Silambam Selangor')).toBeTruthy();
        expect(getByText(/Saturday 9:00 AM - 10:30 AM/i)).toBeTruthy();
        expect(getByText(/Court 2, 2nd Floor/i)).toBeTruthy();
        expect(getByText(/RM 120/i)).toBeTruthy();
        expect(getByText('OPEN')).toBeTruthy();

        // Redacted fields must NOT appear anywhere
        expect(queryByText(/Roster/i)).toBeNull();
        expect(queryByText(/Student Names/i)).toBeNull();
        expect(queryByText(/Internal Review/i)).toBeNull();
      });
    });
  });
});
