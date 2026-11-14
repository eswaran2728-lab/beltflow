import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { trialsService, FollowUpItem, TrialBooking } from '../services/trialsService';
import { MasterTrialsFollowUpScreen } from '../screens/roles/master/MasterTrialsFollowUpScreen';
import { ParentBookTrialScreen } from '../screens/roles/parent/ParentBookTrialScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/trialsService', () => {
  return {
    trialsService: {
      bookTrial: jest.fn(),
      getClassTrials: jest.fn(),
      markTrialAttendance: jest.fn(),
      convertTrial: jest.fn(),
      evaluateFollowUpRules: jest.fn(),
      getClassFollowUps: jest.fn(),
      recordFollowUpAction: jest.fn(),
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

describe('H16: Trials and Actionable Follow-Up Mobile Screen Tests', () => {
  const masterUser: AuthUser = {
    id: 'usr_master_01',
    fullName: 'Cikgu Azman (Master)',
    email: 'azman@gayong.test',
    role: UserRole.MASTER,
    organizationId: 'org_gayong_01',
    assignedClassIds: ['cls_silat_01'],
  };

  const parentUser: AuthUser = {
    id: 'usr_parent_01',
    fullName: 'Puan Halimah (Parent)',
    email: 'halimah@parent.test',
    phone: '0129998888',
    role: UserRole.PARENT,
    organizationId: 'org_gayong_01',
  };

  const mockFollowUps: FollowUpItem[] = [
    {
      id: 'fup_01',
      organization_id: 'org_gayong_01',
      class_id: 'cls_silat_01',
      student_id: 'stu_01',
      student_name: 'Faris bin Kamaruddin',
      student_phone: '0134445555',
      type: 'CONSECUTIVE_ABSENCE',
      reason: '2 CONSECUTIVE ABSENCES: Student missed recent sessions on 2026-10-05 and 2026-10-08.',
      severity: 'HIGH',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockTrials: TrialBooking[] = [
    {
      id: 'trl_01',
      organization_id: 'org_gayong_01',
      class_id: 'cls_silat_01',
      scheduled_date: '2026-10-25',
      candidate_name: 'Amirul bin Razak',
      candidate_age: 12,
      guardian_name: 'Encik Razak',
      guardian_phone: '0123456789',
      consent_accepted: true,
      status: 'BOOKED',
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (trialsService.getClassFollowUps as jest.Mock).mockResolvedValue(mockFollowUps);
    (trialsService.getClassTrials as jest.Mock).mockResolvedValue(mockTrials);
  });

  test('MasterTrialsFollowUpScreen renders follow-up queue with prominent human-visible reason', async () => {
    const { getByText, findByText } = await renderWithTheme(
      <MasterTrialsFollowUpScreen user={masterUser} />
    );

    expect(await findByText('Actionable Follow-Up Queue')).toBeTruthy();
    expect(getByText('Faris bin Kamaruddin')).toBeTruthy();
    expect(getByText('2 CONSECUTIVE ABSENCES: Student missed recent sessions on 2026-10-05 and 2026-10-08.')).toBeTruthy();
    expect(getByText('Record Action & Outcome')).toBeTruthy();
  });

  test('Clicking Scan Risks invokes evaluateFollowUpRules', async () => {
    (trialsService.evaluateFollowUpRules as jest.Mock).mockResolvedValue(undefined);

    const { findByText } = await renderWithTheme(
      <MasterTrialsFollowUpScreen user={masterUser} />
    );

    const scanBtn = await findByText('Scan Risks');
    fireEvent.press(scanBtn);

    await waitFor(() => {
      expect(trialsService.evaluateFollowUpRules).toHaveBeenCalledWith('cls_silat_01');
    });
  });

  test('Recording follow-up outcome opens modal and invokes recordFollowUpAction', async () => {
    (trialsService.recordFollowUpAction as jest.Mock).mockResolvedValue({
      ...mockFollowUps[0],
      status: 'RESOLVED',
      outcome: 'CONTACTED_PHONE',
    });

    const { getByText, findByText } = await renderWithTheme(
      <MasterTrialsFollowUpScreen user={masterUser} />
    );

    const recordActionBtn = await findByText('Record Action & Outcome');
    fireEvent.press(recordActionBtn);

    expect(await findByText('Record Follow-Up Outcome')).toBeTruthy();
    expect(getByText('Contacted via Phone Call')).toBeTruthy();

    const saveBtn = getByText('Save Outcome');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(trialsService.recordFollowUpAction).toHaveBeenCalledWith('fup_01', 'CONTACTED_PHONE', '');
    });
  });

  test('Switching to Trial Bookings tab displays candidates and convert action', async () => {
    const { getByText, findByText } = await renderWithTheme(
      <MasterTrialsFollowUpScreen user={masterUser} />
    );

    const trialsTab = await findByText(/Trial Bookings/i);
    fireEvent.press(trialsTab);

    expect(await findByText('Amirul bin Razak (12 y/o)')).toBeTruthy();
    expect(getByText(/Trial Date: 2026-10-25/)).toBeTruthy();
    expect(getByText('Attended')).toBeTruthy();
    expect(getByText('Missed')).toBeTruthy();
    expect(getByText(/Convert/)).toBeTruthy();
  });

  test('ParentBookTrialScreen validates required legal consent and books trial', async () => {
    (trialsService.bookTrial as jest.Mock).mockResolvedValue(mockTrials[0]);

    const { getByText, getByPlaceholderText } = await renderWithTheme(
      <ParentBookTrialScreen user={parentUser} />
    );

    expect(getByText('Book Martial Arts Trial')).toBeTruthy();

    const nameInput = getByPlaceholderText('e.g. Aiman bin Razak');
    fireEvent.changeText(nameInput, 'Amirul bin Razak');

    const submitBtn = getByText('Confirm Trial Booking');
    fireEvent.press(submitBtn);

    // Should prompt for consent when switch is off
    await waitFor(() => {
      expect(trialsService.bookTrial).not.toHaveBeenCalled();
    });
  });
});
