import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { MyApplicationsScreen } from '../screens/roles/student/MyApplicationsScreen';
import { AvailableClassesScreen } from '../screens/roles/parent/AvailableClassesScreen';
import { ClassEnrollmentInboxScreen } from '../screens/roles/master/ClassEnrollmentInboxScreen';

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

describe('H05: Student Class Application, Master Approval & Enrollment Screens (Tests 34 - 37)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const studentUser: AuthUser = {
    id: 'usr_stud_1',
    fullName: 'Kavitha Devi',
    email: 'kavitha@example.com',
    role: UserRole.STUDENT,
    organizationId: 'org_selangor',
  };

  const parentUser: AuthUser = {
    id: 'usr_parent_1',
    fullName: 'Rajesh Subramaniam',
    email: 'rajesh@example.com',
    phone: '+60123456789',
    role: UserRole.PARENT,
    organizationId: 'org_selangor',
  };

  const masterUser: AuthUser = {
    id: 'usr_master_1',
    fullName: 'Master Anbarasan',
    email: 'anbarasan@silambam.my',
    role: UserRole.MASTER,
    organizationId: 'org_selangor',
  };

  // =========================================================================
  // TEST 34: Student application status screen
  // =========================================================================
  describe('Test 34: Student Application Status Screen (MyApplicationsScreen)', () => {
    test('renders application list with Awaiting Master Approval and Needs Information badges', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        applications: [
          {
            id: 'app_1',
            persatuan_id: 'org_selangor',
            persatuan_name: 'Persatuan Silambam Selangor',
            class_id: 'cls_1',
            class_name: 'Silambam Beginners',
            student_id: 'stu_1',
            applicant_type: 'STUDENT',
            student_name: 'Kavitha Devi',
            status: 'SUBMITTED',
            consent_accepted: true,
            version: 1,
            submitted_at: '2026-10-18T00:00:00Z',
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
          {
            id: 'app_2',
            persatuan_id: 'org_selangor',
            class_id: 'cls_2',
            class_name: 'Advanced Staff Forms',
            student_id: 'stu_1',
            applicant_type: 'STUDENT',
            student_name: 'Kavitha Devi',
            status: 'NEEDS_INFORMATION',
            requested_information: 'Please provide emergency contact number and medical clearance.',
            consent_accepted: true,
            version: 2,
            submitted_at: '2026-10-17T00:00:00Z',
            created_at: '2026-10-17T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <MyApplicationsScreen user={studentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('application-card-app_1')).toBeTruthy();
        expect(getByText('Awaiting Master Approval')).toBeTruthy();
        expect(getByTestId('application-card-app_2')).toBeTruthy();
        expect(getByText('Needs Information')).toBeTruthy();
        expect(getByText('Please provide emergency contact number and medical clearance.')).toBeTruthy();
      });
    });

    test('allows applicant to withdraw a submitted application', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        applications: [
          {
            id: 'app_withdraw_1',
            persatuan_id: 'org_selangor',
            class_id: 'cls_1',
            class_name: 'Silambam Beginners',
            student_id: 'stu_1',
            applicant_type: 'STUDENT',
            student_name: 'Kavitha Devi',
            status: 'SUBMITTED',
            consent_accepted: true,
            version: 1,
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        message: 'Application withdrawn successfully.',
      });

      const { getByTestId } = await renderWithTheme(
        <MyApplicationsScreen user={studentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-withdraw-app_withdraw_1')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-withdraw-app_withdraw_1'));
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/enrollment-applications/app_withdraw_1/withdraw',
        {}
      );
    });

    test('allows applicant to respond to NEEDS_INFORMATION and resubmit', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        applications: [
          {
            id: 'app_needs_info',
            persatuan_id: 'org_selangor',
            class_id: 'cls_1',
            student_id: 'stu_1',
            applicant_type: 'STUDENT',
            student_name: 'Kavitha Devi',
            status: 'NEEDS_INFORMATION',
            requested_information: 'Medical clearance required.',
            consent_accepted: true,
            version: 2,
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({
        application: { id: 'app_needs_info', status: 'SUBMITTED' },
      });

      const { getByTestId } = await renderWithTheme(
        <MyApplicationsScreen user={studentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-resubmit-app_needs_info')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-resubmit-app_needs_info'));
      });

      await act(async () => {
        fireEvent.changeText(
          getByTestId('input-resubmit-notes'),
          'Medical clearance certificate attached: Fit for martial arts.'
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-resubmit'));
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/enrollment-applications/app_needs_info',
        {
          notes: 'Medical clearance certificate attached: Fit for martial arts.',
          status: 'SUBMITTED',
        }
      );
    });

    test('displays empty state when user has no applications', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        applications: [],
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <MyApplicationsScreen user={studentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('empty-applications-state')).toBeTruthy();
        expect(getByText('No Applications')).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // TEST 35: Parent child selector and application flow
  // =========================================================================
  describe('Test 35: Parent Child Selector and Application Flow (AvailableClassesScreen)', () => {
    test('opens application modal, selects linked child, requires consent, and submits', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/available-classes')) {
          return Promise.resolve({
            classes: [
              {
                id: 'cls_selangor_101',
                organizationId: 'org_selangor',
                persatuanName: 'Persatuan Silambam Selangor',
                name: 'Silambam Youth Foundation',
                schedule: 'Tue & Thu 6:00 PM',
                location: 'Klang Dojo',
                capacity: 30,
                enrollmentAvailability: 'OPEN',
                monthlyFee: 80,
              },
            ],
          });
        }
        if (url === '/dashboard/parent') {
          return Promise.resolve({
            children: [
              {
                id: 'stu_child_1',
                fullName: 'Aarav Subramaniam',
                beltRank: 'White Belt',
              },
              {
                id: 'stu_child_2',
                fullName: 'Diya Subramaniam',
                beltRank: 'Yellow Belt',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        application: {
          id: 'app_new_1',
          status: 'SUBMITTED',
        },
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <AvailableClassesScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-apply-cls_selangor_101')).toBeTruthy();
      });

      // Press Apply to Class
      await act(async () => {
        fireEvent.press(getByTestId('btn-apply-cls_selangor_101'));
      });

      // Modal should be open
      await waitFor(() => {
        expect(getByTestId('modal-apply-class')).toBeTruthy();
        expect(getByTestId('select-child-stu_child_1')).toBeTruthy();
        expect(getByTestId('select-child-stu_child_2')).toBeTruthy();
      });

      // Select child 2
      await act(async () => {
        fireEvent.press(getByTestId('select-child-stu_child_2'));
      });

      // Fill in emergency contact details
      await act(async () => {
        fireEvent.changeText(getByTestId('input-emergency-name'), 'Rajesh Subramaniam');
        fireEvent.changeText(getByTestId('input-emergency-phone'), '+60123456789');
      });

      // Try submitting without consent
      await act(async () => {
        fireEvent.press(getByTestId('btn-submit-application'));
      });

      await waitFor(() => {
        expect(getByTestId('apply-error-text')).toBeTruthy();
        expect(getByText('You must acknowledge and accept enrollment consent before submitting.')).toBeTruthy();
      });

      // Accept consent
      await act(async () => {
        fireEvent.press(getByTestId('checkbox-consent'));
      });

      // Submit application
      await act(async () => {
        fireEvent.press(getByTestId('btn-submit-application'));
      });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/enrollment-applications',
          expect.objectContaining({
            classId: 'cls_selangor_101',
            studentId: 'stu_child_2',
            applicantType: 'PARENT',
            studentName: 'Diya Subramaniam',
            emergencyContactName: 'Rajesh Subramaniam',
            emergencyContactPhone: '+60123456789',
            consentAccepted: true,
            isDraft: false,
          })
        );
        expect(getByTestId('apply-success-banner')).toBeTruthy();
        expect(getByText('Application submitted! AWAITING MASTER APPROVAL.')).toBeTruthy();
      });
    });

    test('supports saving draft application without mandatory consent', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        classes: [
          {
            id: 'cls_selangor_101',
            organizationId: 'org_selangor',
            persatuanName: 'Persatuan Silambam Selangor',
            name: 'Silambam Youth Foundation',
            schedule: 'Tue & Thu 6:00 PM',
            location: 'Klang Dojo',
            capacity: 30,
            enrollmentAvailability: 'OPEN',
            monthlyFee: 80,
          },
        ],
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        application: {
          id: 'app_draft_1',
          status: 'DRAFT',
        },
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <AvailableClassesScreen user={studentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-apply-cls_selangor_101')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-apply-cls_selangor_101'));
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-save-draft'));
      });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/enrollment-applications',
          expect.objectContaining({
            classId: 'cls_selangor_101',
            applicantType: 'STUDENT',
            isDraft: true,
            consentAccepted: false,
          })
        );
        expect(getByText('Draft application saved successfully!')).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // TEST 36: Master inbox and review UI
  // =========================================================================
  describe('Test 36: Master Inbox and Review UI (ClassEnrollmentInboxScreen)', () => {
    test('renders pending applications and allows Master to approve with confirmation', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        class: {
          id: 'cls_1',
          name: 'Silambam Beginners',
          capacity: 30,
          enrolledCount: 15,
          availableSpots: 15,
          enrollmentAvailability: 'OPEN',
        },
        applications: [
          {
            id: 'app_review_1',
            persatuan_id: 'org_selangor',
            class_id: 'cls_1',
            student_id: 'stu_10',
            applicant_type: 'STUDENT',
            submitted_by_user_id: 'usr_stud_1',
            student_name: 'Kavitha Devi',
            ic_number: '051210-10-1234',
            date_of_birth: '2005-12-10',
            gender: 'FEMALE',
            emergency_contact_name: 'Father Devi',
            emergency_contact_phone: '+60129876543',
            medical_notes: 'None',
            consent_accepted: true,
            status: 'SUBMITTED',
            version: 1,
            submitted_at: '2026-10-18T00:00:00Z',
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        application: { id: 'app_review_1', status: 'APPROVED' },
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassEnrollmentInboxScreen
          user={masterUser}
          route={{ params: { classId: 'cls_1', className: 'Silambam Beginners' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('application-item-app_review_1')).toBeTruthy();
        expect(getByText('Kavitha Devi')).toBeTruthy();
        expect(getByText('15 Spots Open')).toBeTruthy();
        expect(getByTestId('btn-approve-app_review_1')).toBeTruthy();
      });

      // Press Approve
      await act(async () => {
        fireEvent.press(getByTestId('btn-approve-app_review_1'));
      });

      // Confirmation modal
      await waitFor(() => {
        expect(getByText('Confirm Class Enrollment')).toBeTruthy();
        expect(getByTestId('btn-confirm-action')).toBeTruthy();
      });

      // Confirm approve
      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-action'));
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/enrollment-applications/app_review_1/review',
        {
          decision: 'APPROVE',
          expectedVersion: 1,
        }
      );
    });

    test('allows Master to request information with required prompt text', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        class: {
          id: 'cls_1',
          name: 'Silambam Beginners',
          capacity: 30,
          enrolledCount: 15,
          availableSpots: 15,
          enrollmentAvailability: 'OPEN',
        },
        applications: [
          {
            id: 'app_review_req_info',
            persatuan_id: 'org_selangor',
            class_id: 'cls_1',
            student_id: 'stu_10',
            applicant_type: 'STUDENT',
            submitted_by_user_id: 'usr_stud_1',
            student_name: 'Kavitha Devi',
            consent_accepted: true,
            status: 'SUBMITTED',
            version: 1,
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        application: { id: 'app_review_req_info', status: 'NEEDS_INFORMATION' },
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassEnrollmentInboxScreen
          user={masterUser}
          route={{ params: { classId: 'cls_1', className: 'Silambam Beginners' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('btn-request-info-app_review_req_info')).toBeTruthy();
      });

      // Press Request Info
      await act(async () => {
        fireEvent.press(getByTestId('btn-request-info-app_review_req_info'));
      });

      // Modal open
      await waitFor(() => {
        expect(getByText('Request Information')).toBeTruthy();
        expect(getByTestId('input-request-info-text')).toBeTruthy();
      });

      // Type requested info text
      await act(async () => {
        fireEvent.changeText(
          getByTestId('input-request-info-text'),
          'Please provide previous martial arts experience and parent consent.'
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-action'));
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/enrollment-applications/app_review_req_info/review',
        {
          decision: 'REQUEST_INFORMATION',
          expectedVersion: 1,
          requestedInformation: 'Please provide previous martial arts experience and parent consent.',
        }
      );
    });

    test('allows Master to reject application with mandatory rejection reason', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        class: {
          id: 'cls_1',
          name: 'Silambam Beginners',
          capacity: 30,
          enrolledCount: 15,
          availableSpots: 15,
          enrollmentAvailability: 'OPEN',
        },
        applications: [
          {
            id: 'app_review_reject',
            persatuan_id: 'org_selangor',
            class_id: 'cls_1',
            student_id: 'stu_10',
            applicant_type: 'STUDENT',
            submitted_by_user_id: 'usr_stud_1',
            student_name: 'Kavitha Devi',
            consent_accepted: true,
            status: 'SUBMITTED',
            version: 1,
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        application: { id: 'app_review_reject', status: 'REJECTED' },
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassEnrollmentInboxScreen
          user={masterUser}
          route={{ params: { classId: 'cls_1', className: 'Silambam Beginners' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('btn-reject-app_review_reject')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-reject-app_review_reject'));
      });

      // Try submitting without reason
      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-action'));
      });

      await waitFor(() => {
        expect(getByText('Please provide a reason for rejecting this application.')).toBeTruthy();
      });

      // Provide reason and confirm
      await act(async () => {
        fireEvent.changeText(
          getByTestId('input-rejection-reason-text'),
          'Student does not meet minimum age eligibility for this class.'
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-action'));
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/enrollment-applications/app_review_reject/review',
        {
          decision: 'REJECT',
          expectedVersion: 1,
          rejectionReason: 'Student does not meet minimum age eligibility for this class.',
        }
      );
    });
  });

  // =========================================================================
  // TEST 37: Error and capacity states
  // =========================================================================
  describe('Test 37: Error and Capacity States', () => {
    test('displays Class Full and capacity warning banner when available spots is 0', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        class: {
          id: 'cls_full_1',
          name: 'Silambam Elite Squad',
          capacity: 20,
          enrolledCount: 20,
          availableSpots: 0,
          enrollmentAvailability: 'CLOSED',
        },
        applications: [],
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassEnrollmentInboxScreen
          user={masterUser}
          route={{ params: { classId: 'cls_full_1', className: 'Silambam Elite Squad' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('class-capacity-badge')).toBeTruthy();
        expect(getByText('Class Full')).toBeTruthy();
        expect(getByText('Capacity reached. Further approvals will be blocked unless waitlisted.')).toBeTruthy();
      });
    });

    test('displays server capacity conflict error (409) in Master decision modal', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        class: {
          id: 'cls_race_1',
          name: 'Silambam Race Cohort',
          capacity: 20,
          enrolledCount: 19,
          availableSpots: 1,
          enrollmentAvailability: 'OPEN',
        },
        applications: [
          {
            id: 'app_race_1',
            persatuan_id: 'org_selangor',
            class_id: 'cls_race_1',
            student_id: 'stu_race',
            applicant_type: 'STUDENT',
            submitted_by_user_id: 'usr_stud_1',
            student_name: 'Racer Student',
            consent_accepted: true,
            status: 'SUBMITTED',
            version: 1,
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
        ],
      });

      const capacityError: any = new Error('Class capacity reached');
      capacityError.response = {
        status: 409,
        data: {
          error: 'Class capacity of 20 reached. No places available for active enrollment.',
          code: 'CLASS_FULL',
        },
      };
      (apiClient.post as jest.Mock).mockRejectedValueOnce(capacityError);

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassEnrollmentInboxScreen
          user={masterUser}
          route={{ params: { classId: 'cls_race_1', className: 'Silambam Race Cohort' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('btn-approve-app_race_1')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-approve-app_race_1'));
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-confirm-action'));
      });

      await waitFor(() => {
        expect(getByTestId('modal-action-error')).toBeTruthy();
        expect(
          getByText('Class capacity of 20 reached. No places available for active enrollment.')
        ).toBeTruthy();
      });
    });

    test('disables Apply button and shows Class Closed when enrollmentAvailability is CLOSED', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        classes: [
          {
            id: 'cls_closed_1',
            organizationId: 'org_selangor',
            persatuanName: 'Persatuan Silambam Selangor',
            name: 'Silambam Closed Dojo',
            schedule: 'Mon & Wed 7:00 PM',
            location: 'Shah Alam',
            capacity: 25,
            enrollmentAvailability: 'CLOSED',
            monthlyFee: 100,
          },
        ],
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <AvailableClassesScreen user={studentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-apply-cls_closed_1')).toBeTruthy();
        expect(getByText('Class Closed')).toBeTruthy();
      });
    });
  });
});
