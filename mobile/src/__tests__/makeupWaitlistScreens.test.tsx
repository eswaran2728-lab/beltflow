import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { bookingsService, MakeUpBooking, SessionBookingsResponse } from '../services/bookingsService';
import { MasterMakeUpManagementScreen } from '../screens/roles/master/MasterMakeUpManagementScreen';
import { ParentMakeUpBookingScreen } from '../screens/roles/parent/ParentMakeUpBookingScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/bookingsService', () => {
  return {
    bookingsService: {
      requestMakeUp: jest.fn(),
      approveMakeUp: jest.fn(),
      cancelMakeUp: jest.fn(),
      promoteWaitlist: jest.fn(),
      getSessionBookings: jest.fn(),
      getStudentMakeUps: jest.fn(),
    },
  };
});

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

describe('H17: Make-Up Classes and Waitlist Mobile Screen Tests', () => {
  const masterUser: AuthUser = {
    id: 'usr_master_h17',
    fullName: 'Cikgu Rahman (Master)',
    email: 'rahman@gayong.test',
    role: UserRole.MASTER,
    organizationId: 'org_gayong_01',
    assignedClassIds: ['cls_a2_test'],
  };

  const parentUser: AuthUser = {
    id: 'usr_parent_h17',
    fullName: 'Puan Siti (Parent)',
    email: 'siti@test.com',
    role: UserRole.PARENT,
    organizationId: 'org_gayong_01',
  };

  const mockSessionData: SessionBookingsResponse = {
    session: {
      id: 'sess_101',
      organization_id: 'org_gayong_01',
      class_id: 'cls_a2_test',
      class_name: 'Kelas Gayong Remaja',
      capacity: 10,
      training_level: 'All Levels',
      session_date: '2026-11-10',
      day_of_week: 'Tuesday',
      start_time: '20:00',
      end_time: '21:30',
      location: 'Gelanggang Utama',
      status: 'Scheduled',
    },
    capacity: {
      maxCapacity: 10,
      confirmedMakeUps: 1,
      availableMakeUpPlaces: 1,
    },
    confirmedCount: 1,
    waitlistCount: 1,
    bookings: [
      {
        id: 'bk_001',
        organization_id: 'org_gayong_01',
        student_id: 'stu_001',
        original_class_id: 'cls_a1',
        target_session_id: 'sess_101',
        target_class_id: 'cls_a2_test',
        status: 'REQUESTED',
        version: 1,
        student_name: 'Aiman Hakim',
        belt_rank: 'White Belt',
        original_class_name: 'Kelas Asas Isnin',
        session_date: '2026-11-10',
        day_of_week: 'Tuesday',
        start_time: '20:00',
        end_time: '21:30',
        location: 'Gelanggang Utama',
        created_at: '2026-10-19T00:00:00Z',
        updated_at: '2026-10-19T00:00:00Z',
      },
      {
        id: 'bk_002',
        organization_id: 'org_gayong_01',
        student_id: 'stu_002',
        original_class_id: 'cls_a1',
        target_session_id: 'sess_101',
        target_class_id: 'cls_a2_test',
        status: 'WAITLISTED',
        waitlist_position: 1,
        version: 1,
        student_name: 'Luqman Hafiz',
        belt_rank: 'Yellow Belt',
        original_class_name: 'Kelas Asas Isnin',
        session_date: '2026-11-10',
        day_of_week: 'Tuesday',
        start_time: '20:00',
        end_time: '21:30',
        location: 'Gelanggang Utama',
        created_at: '2026-10-19T01:00:00Z',
        updated_at: '2026-10-19T01:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('MasterMakeUpManagementScreen renders session info, capacity, and bookings', async () => {
    (bookingsService.getSessionBookings as jest.Mock).mockResolvedValueOnce(mockSessionData);

    const { getByText, getByTestId } = await renderWithTheme(
      <MasterMakeUpManagementScreen
        user={masterUser}
        route={{ params: { sessionId: 'sess_101' } }}
      />
    );

    await waitFor(() => {
      expect(bookingsService.getSessionBookings).toHaveBeenCalledWith('sess_101');
      expect(getByText('Make-Up & Waitlist')).toBeTruthy();
      expect(getByText('Aiman Hakim')).toBeTruthy();
      expect(getByText('Luqman Hafiz')).toBeTruthy();
      expect(getByTestId('promote-waitlist-btn')).toBeTruthy();
    });
  });

  test('MasterMakeUpManagementScreen approves pending make-up request', async () => {
    (bookingsService.getSessionBookings as jest.Mock).mockResolvedValue(mockSessionData);
    (bookingsService.approveMakeUp as jest.Mock).mockResolvedValueOnce({
      ...mockSessionData.bookings[0],
      status: 'CONFIRMED',
      version: 2,
    });

    const { getByTestId } = await renderWithTheme(
      <MasterMakeUpManagementScreen
        user={masterUser}
        route={{ params: { sessionId: 'sess_101' } }}
      />
    );

    await waitFor(() => {
      expect(getByTestId('approve-btn-bk_001')).toBeTruthy();
    });

    fireEvent.press(getByTestId('approve-btn-bk_001'));

    await waitFor(() => {
      expect(bookingsService.approveMakeUp).toHaveBeenCalledWith('bk_001', 1);
    });
  });

  test('MasterMakeUpManagementScreen triggers waitlist promotion', async () => {
    (bookingsService.getSessionBookings as jest.Mock).mockResolvedValue(mockSessionData);
    (bookingsService.promoteWaitlist as jest.Mock).mockResolvedValueOnce({
      message: 'Promoted 1 booking',
      promotedCount: 1,
    });

    const { getByTestId } = await renderWithTheme(
      <MasterMakeUpManagementScreen
        user={masterUser}
        route={{ params: { sessionId: 'sess_101' } }}
      />
    );

    await waitFor(() => {
      expect(getByTestId('promote-waitlist-btn')).toBeTruthy();
    });

    fireEvent.press(getByTestId('promote-waitlist-btn'));

    await waitFor(() => {
      expect(bookingsService.promoteWaitlist).toHaveBeenCalledWith('sess_101');
    });
  });

  test('ParentMakeUpBookingScreen submits make-up request and shows governance banner', async () => {
    const parentBookings: MakeUpBooking[] = [
      {
        id: 'bk_003',
        organization_id: 'org_gayong_01',
        student_id: 'stu_child_01',
        original_class_id: 'cls_home',
        target_session_id: 'sess_101',
        target_class_id: 'cls_a2_test',
        status: 'WAITLISTED',
        waitlist_position: 1,
        version: 1,
        student_name: 'Aiman Hakim',
        target_class_name: 'Kelas Gantian A2',
        session_date: '2026-11-10',
        day_of_week: 'Tuesday',
        start_time: '20:00',
        end_time: '21:30',
        location: 'Gelanggang Utama',
        created_at: '2026-10-19T00:00:00Z',
        updated_at: '2026-10-19T00:00:00Z',
      },
    ];

    (bookingsService.getStudentMakeUps as jest.Mock).mockResolvedValue(parentBookings);
    (bookingsService.requestMakeUp as jest.Mock).mockResolvedValueOnce({
      id: 'bk_004',
      status: 'CONFIRMED',
      version: 1,
    });

    const { getByText, getByTestId } = await renderWithTheme(
      <ParentMakeUpBookingScreen
        user={parentUser}
        route={{
          params: {
            studentId: 'stu_child_01',
            targetSessionId: 'sess_101',
          },
        }}
      />
    );

    await waitFor(() => {
      expect(getByText('Session-Only Entitlement')).toBeTruthy();
      expect(getByText('Kelas Gantian A2')).toBeTruthy();
      expect(getByText('Waitlist #1')).toBeTruthy();
    });

    fireEvent.press(getByTestId('submit-makeup-btn'));

    await waitFor(() => {
      expect(bookingsService.requestMakeUp).toHaveBeenCalledWith({
        studentId: 'stu_child_01',
        targetSessionId: 'sess_101',
        reason: 'Missed regular class due to illness/family event',
      });
    });
  });
});
