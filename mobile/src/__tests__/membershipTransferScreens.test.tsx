import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import {
  membershipService,
  MembershipPause,
  ClassTransferRequest,
  StudentHistoryRecord,
} from '../services/membershipService';
import { MasterTransferManagementScreen } from '../screens/roles/master/MasterTransferManagementScreen';
import { ParentStudentLifecycleScreen } from '../screens/roles/parent/ParentStudentLifecycleScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/membershipService', () => {
  return {
    membershipService: {
      requestPause: jest.fn(),
      approvePause: jest.fn(),
      resumeMembership: jest.fn(),
      getPendingPauses: jest.fn(),
      requestTransfer: jest.fn(),
      approveTransfer: jest.fn(),
      getPendingTransfers: jest.fn(),
      getStudentHistory: jest.fn(),
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
      <ThemeProvider defaultMode="dark">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('H18: Pauses, Returns and Controlled Transfers Mobile Screen Tests', () => {
  const masterUser: AuthUser = {
    id: 'usr_master_h18',
    fullName: 'Cikgu Faizal (Master)',
    email: 'faizal@gayong.test',
    role: UserRole.MASTER,
    organizationId: 'org_gayong_01',
    assignedClassIds: ['cls_a1_test', 'cls_a2_test'],
  };

  const parentUser: AuthUser = {
    id: 'usr_parent_h18',
    fullName: 'Encik Rosli (Parent)',
    email: 'rosli@test.com',
    role: UserRole.PARENT,
    organizationId: 'org_gayong_01',
  };

  const mockPendingPauses: MembershipPause[] = [
    {
      id: 'pause_101',
      organization_id: 'org_gayong_01',
      student_id: 'stu_danial',
      class_id: 'cls_a1_test',
      requested_by_user_id: 'usr_parent_h18',
      reason: 'School exam preparation',
      start_date: '2026-11-01',
      expected_end_date: '2026-11-30',
      status: 'REQUESTED',
      version: 1,
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
      student_name: 'Danial bin Rosli',
      belt_rank: 'Yellow Belt',
      class_name: 'Kelas Asas Isnin',
    },
  ];

  const mockPendingTransfers: ClassTransferRequest[] = [
    {
      id: 'trans_201',
      student_id: 'stu_danial',
      organization_id: 'org_gayong_01',
      target_organization_id: 'org_gayong_01',
      old_class_id: 'cls_a1_test',
      new_class_id: 'cls_a2_test',
      effective_date: '2026-12-01',
      reason: 'Progressing to intermediate level',
      consent_accepted: true,
      requested_by_user_id: 'usr_parent_h18',
      old_master_approved: false,
      new_master_approved: false,
      status: 'PENDING_RECEIVING',
      version: 1,
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
      student_name: 'Danial bin Rosli',
      belt_rank: 'Yellow Belt',
      old_class_name: 'Kelas Asas Isnin',
      new_class_name: 'Kelas Lanjutan Selasa',
    },
  ];

  const mockStudentHistory: StudentHistoryRecord = {
    enrollments: [
      {
        id: 'enr_001',
        class_id: 'cls_a1_test',
        class_name: 'Kelas Asas Isnin',
        status: 'ACTIVE',
        is_primary: true,
        provenance: 'MASTER_APPROVED',
        effective_from: '2026-01-10',
        created_at: '2026-01-10T00:00:00Z',
      },
    ],
    pauses: [
      {
        id: 'pause_101',
        organization_id: 'org_gayong_01',
        student_id: 'stu_danial',
        class_id: 'cls_a1_test',
        requested_by_user_id: 'usr_parent_h18',
        reason: 'School exam preparation',
        start_date: '2026-11-01',
        expected_end_date: '2026-11-30',
        status: 'APPROVED',
        version: 2,
        created_at: '2026-10-20T10:00:00Z',
        updated_at: '2026-10-20T10:05:00Z',
      },
    ],
    transfers: [
      {
        id: 'trans_201',
        student_id: 'stu_danial',
        organization_id: 'org_gayong_01',
        old_class_id: 'cls_a1_test',
        new_class_id: 'cls_a2_test',
        effective_date: '2026-12-01',
        reason: 'Progressing to intermediate level',
        consent_accepted: true,
        old_master_approved: true,
        new_master_approved: true,
        status: 'APPROVED',
        version: 2,
        created_at: '2026-10-20T10:00:00Z',
        updated_at: '2026-10-20T10:10:00Z',
        old_class_name: 'Kelas Asas Isnin',
        new_class_name: 'Kelas Lanjutan Selasa',
      },
    ],
    attendanceCount: 24,
    paymentsCount: 8,
  };

  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (membershipService.getPendingPauses as jest.Mock).mockResolvedValue(mockPendingPauses);
    (membershipService.getPendingTransfers as jest.Mock).mockResolvedValue(mockPendingTransfers);
    (membershipService.getStudentHistory as jest.Mock).mockResolvedValue(mockStudentHistory);
    (membershipService.approvePause as jest.Mock).mockResolvedValue({ ...mockPendingPauses[0], status: 'APPROVED' });
    (membershipService.approveTransfer as jest.Mock).mockResolvedValue({ ...mockPendingTransfers[0], status: 'APPROVED' });
    (membershipService.requestPause as jest.Mock).mockResolvedValue(mockPendingPauses[0]);
    (membershipService.requestTransfer as jest.Mock).mockResolvedValue(mockPendingTransfers[0]);
    (membershipService.resumeMembership as jest.Mock).mockResolvedValue({ pause: { ...mockPendingPauses[0], status: 'RESUMED' } });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 1. MasterTransferManagementScreen Tests
  // --------------------------------------------------------------------------
  test('MasterTransferManagementScreen renders pending pauses and transfers', async () => {
    const { getByText } = await renderWithTheme(
      <MasterTransferManagementScreen user={masterUser} />
    );

    await waitFor(() => {
      expect(getByText('Pauses & Transfers')).toBeTruthy();
      expect(getByText('Pending Pauses (1)')).toBeTruthy();
      expect(getByText('Danial bin Rosli')).toBeTruthy();
      expect(getByText(/School exam preparation/)).toBeTruthy();
      expect(getByText('Approve Pause')).toBeTruthy();
    });
  });

  test('MasterTransferManagementScreen switches to Transfers tab and shows transfer details', async () => {
    const { getByText } = await renderWithTheme(
      <MasterTransferManagementScreen user={masterUser} />
    );

    await waitFor(() => {
      expect(getByText('Pending Transfers (1)')).toBeTruthy();
    });

    fireEvent.press(getByText('Pending Transfers (1)'));

    await waitFor(() => {
      expect(getByText('Kelas Lanjutan Selasa')).toBeTruthy();
      expect(getByText('Approve Transfer')).toBeTruthy();
      expect(getByText(/Atomic Capacity Guard/)).toBeTruthy();
    });
  });

  test('MasterTransferManagementScreen handles pause approval interaction', async () => {
    const { getByText } = await renderWithTheme(
      <MasterTransferManagementScreen user={masterUser} />
    );

    await waitFor(() => {
      expect(getByText('Approve Pause')).toBeTruthy();
    });

    fireEvent.press(getByText('Approve Pause'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Approve Membership Pause',
      expect.stringContaining('Danial bin Rosli'),
      expect.any(Array)
    );

    // Trigger the confirmation action
    const alertCall = alertSpy.mock.calls[0];
    const approveButton = alertCall[2].find((btn: any) => btn.text === 'Approve Pause');
    await approveButton.onPress();

    expect(membershipService.approvePause).toHaveBeenCalledWith('pause_101', 1);
  });

  test('MasterTransferManagementScreen handles transfer approval interaction', async () => {
    const { getByText } = await renderWithTheme(
      <MasterTransferManagementScreen user={masterUser} />
    );

    await waitFor(() => {
      expect(getByText('Pending Transfers (1)')).toBeTruthy();
    });

    fireEvent.press(getByText('Pending Transfers (1)'));

    await waitFor(() => {
      expect(getByText('Approve Transfer')).toBeTruthy();
    });

    fireEvent.press(getByText('Approve Transfer'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Approve Class Transfer',
      expect.stringContaining('Danial bin Rosli'),
      expect.any(Array)
    );

    // Trigger the confirmation action
    const alertCall = alertSpy.mock.calls[0];
    const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Confirm Transfer');
    await confirmButton.onPress();

    expect(membershipService.approveTransfer).toHaveBeenCalledWith('trans_201', 1);
  });

  // --------------------------------------------------------------------------
  // 2. ParentStudentLifecycleScreen Tests
  // --------------------------------------------------------------------------
  test('ParentStudentLifecycleScreen renders overview, attendance metrics, and guarantees', async () => {
    const { getByText } = await renderWithTheme(
      <ParentStudentLifecycleScreen
        user={parentUser}
        route={{ params: { studentId: 'stu_danial' } }}
      />
    );

    await waitFor(() => {
      expect(getByText('Student Lifecycle')).toBeTruthy();
      expect(getByText('Current Membership')).toBeTruthy();
      expect(getByText('24')).toBeTruthy(); // Attended count
      expect(getByText('8')).toBeTruthy(); // Receipts count
      expect(getByText('Protected Student History')).toBeTruthy();
      expect(getByText('Return Now')).toBeTruthy(); // Student has an active pause in mock
    });
  });

  test('ParentStudentLifecycleScreen switches to Request Pause and submits form', async () => {
    const { getByTestId, getByText, findByText } = await renderWithTheme(
      <ParentStudentLifecycleScreen
        user={parentUser}
        route={{ params: { studentId: 'stu_danial' } }}
      />
    );

    expect(await findByText('Current Membership')).toBeTruthy();

    fireEvent.press(getByTestId('tab-request-pause'));

    await waitFor(() => {
      expect(getByTestId('btn-submit-pause')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('btn-submit-pause'));
    });

    await waitFor(() => {
      expect(membershipService.requestPause).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu_danial',
          reason: expect.any(String),
          startDate: expect.any(String),
        })
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Success',
        expect.stringContaining('pause requested successfully')
      );
      expect(getByText('Current Membership')).toBeTruthy();
    });
  });

  test('ParentStudentLifecycleScreen switches to Request Transfer and submits form', async () => {
    const { getByTestId, getByText, findByText } = await renderWithTheme(
      <ParentStudentLifecycleScreen
        user={parentUser}
        route={{ params: { studentId: 'stu_danial', targetClassId: 'cls_a2_test' } }}
      />
    );

    expect(await findByText('Current Membership')).toBeTruthy();

    fireEvent.press(getByTestId('tab-request-transfer'));

    await waitFor(() => {
      expect(getByTestId('btn-submit-transfer')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('btn-submit-transfer'));
    });

    await waitFor(() => {
      expect(membershipService.requestTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu_danial',
          targetClassId: 'cls_a2_test',
        })
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Success',
        expect.stringContaining('transfer requested successfully')
      );
      expect(getByText('Current Membership')).toBeTruthy();
    });
  });

  test('ParentStudentLifecycleScreen switches to History tab and displays timeline', async () => {
    const { getByTestId, getByText, findByText } = await renderWithTheme(
      <ParentStudentLifecycleScreen
        user={parentUser}
        route={{ params: { studentId: 'stu_danial' } }}
      />
    );

    expect(await findByText('Current Membership')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('tab-history'));
    });

    expect(await findByText('Enrollment Timeline')).toBeTruthy();
    expect(getByText('Kelas Asas Isnin')).toBeTruthy();
    expect(getByText('Transfer History')).toBeTruthy();
    expect(getByText(/Kelas Asas Isnin → Kelas Lanjutan Selasa/)).toBeTruthy();
    expect(getByText('Pause History')).toBeTruthy();
  });

  test('ParentStudentLifecycleScreen confirms return to training for paused student', async () => {
    const { findByTestId, findByText } = await renderWithTheme(
      <ParentStudentLifecycleScreen
        user={parentUser}
        route={{ params: { studentId: 'stu_danial' } }}
      />
    );

    expect(await findByText('Current Membership')).toBeTruthy();

    const returnBtn = await findByTestId('btn-return-now');
    await act(async () => {
      fireEvent.press(returnBtn);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Return to Training',
      expect.stringContaining('Resume active membership'),
      expect.any(Array)
    );

    // Trigger the confirmation action
    const alertCall = alertSpy.mock.calls[0];
    const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Confirm Return');
    await act(async () => {
      await confirmButton.onPress();
    });

    expect(membershipService.resumeMembership).toHaveBeenCalledWith('pause_101');
  });
});
