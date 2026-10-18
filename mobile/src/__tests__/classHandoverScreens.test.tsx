import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import {
  ClassHandoverScreen,
  IncomingHandoversScreen,
} from '../screens/roles/master';
import { HandoverApprovalsScreen } from '../screens/roles/adminPersatuan';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
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

describe('H07: Class Leadership Handover & Delegation Screens', () => {
  const masterUser: AuthUser = {
    id: 'usr_master_out',
    fullName: 'Master Outgoing Kumar',
    email: 'outgoing@silambam.my',
    role: UserRole.MASTER,
    organizationId: 'org_selangor',
    assignedClassIds: ['cls_squad_1'],
    affiliationStatus: 'ACTIVE',
  };

  const incomingMasterUser: AuthUser = {
    id: 'usr_master_in',
    fullName: 'Master Incoming Tan',
    email: 'incoming@silambam.my',
    role: UserRole.MASTER,
    organizationId: 'org_selangor',
    assignedClassIds: [],
    affiliationStatus: 'ACTIVE',
  };

  const adminUser: AuthUser = {
    id: 'usr_admin_1',
    fullName: 'Admin Selangor',
    email: 'admin@selangor.my',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_selangor',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. ClassHandoverScreen
  // --------------------------------------------------------------------------
  describe('ClassHandoverScreen', () => {
    const mockLeaderships = [
      {
        id: 'lead_primary_1',
        class_id: 'cls_squad_1',
        master_id: 'usr_master_out',
        master_name: 'Master Outgoing Kumar',
        leadership_type: 'PRIMARY',
        is_active: true,
      },
      {
        id: 'lead_sub_1',
        class_id: 'cls_squad_1',
        master_id: 'usr_master_sub',
        master_name: 'Master Substitute Raj',
        leadership_type: 'SUBSTITUTE',
        is_active: true,
        capabilities: 'ATTENDANCE_ONLY',
        effective_to: new Date(Date.now() + 86400000).toISOString(),
      },
    ];

    it('renders current primary leader and active substitute with expiry', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/classes/cls_squad_1/leaderships') {
          return Promise.resolve({ leaderships: mockLeaderships });
        }
        if (path === '/classes/cls_squad_1/handover') {
          return Promise.resolve({ history: [], activeHandover: null });
        }
        return Promise.resolve({});
      });

      const { getByText } = await renderWithTheme(
        <ClassHandoverScreen
          user={masterUser}
          route={{ params: { classId: 'cls_squad_1', className: 'Silambam Advanced Squad' } }}
        />
      );

      await waitFor(() => {
        expect(getByText('Master Outgoing Kumar')).toBeTruthy();
        expect(getByText('Master Substitute Raj')).toBeTruthy();
        expect(getByText('Capabilities: ATTENDANCE_ONLY')).toBeTruthy();
      });
    });

    it('submits handover request successfully with incoming Master ID and reason', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/classes/cls_squad_1/leaderships') {
          return Promise.resolve({ leaderships: mockLeaderships });
        }
        if (path === '/classes/cls_squad_1/handover') {
          return Promise.resolve({ history: [], activeHandover: null });
        }
        return Promise.resolve({});
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        message: 'Handover initiated',
        handover: { id: 'hand_1', status: 'REQUESTED' },
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassHandoverScreen
          user={masterUser}
          route={{ params: { classId: 'cls_squad_1', className: 'Silambam Advanced Squad' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('input-incoming-master')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.changeText(getByTestId('input-incoming-master'), 'usr_master_in');
        fireEvent.changeText(getByTestId('input-handover-reason'), 'Relocating to Shah Alam branch');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-submit-handover'));
      });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/classes/cls_squad_1/handover', {
          incomingMasterId: 'usr_master_in',
          reason: 'Relocating to Shah Alam branch',
          effectiveDate: undefined,
        });
        expect(getByText(/Handover request submitted successfully/i)).toBeTruthy();
      });
    });

    it('assigns temporary substitute on the substitute tab', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/classes/cls_squad_1/leaderships') {
          return Promise.resolve({ leaderships: mockLeaderships });
        }
        if (path === '/classes/cls_squad_1/handover') {
          return Promise.resolve({ history: [], activeHandover: null });
        }
        return Promise.resolve({});
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        delegationId: 'lead_sub_2',
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ClassHandoverScreen
          user={masterUser}
          route={{ params: { classId: 'cls_squad_1', className: 'Silambam Advanced Squad' } }}
        />
      );

      await waitFor(() => {
        expect(getByTestId('tab-substitute')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('tab-substitute'));
      });

      await waitFor(() => {
        expect(getByTestId('input-substitute-master')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.changeText(getByTestId('input-substitute-master'), 'usr_sub_raj');
        fireEvent.changeText(getByTestId('input-substitute-hours'), '48');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-assign-substitute'));
      });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/classes/cls_squad_1/delegation',
          expect.objectContaining({
            substituteMasterId: 'usr_sub_raj',
            capabilities: 'ATTENDANCE_ONLY',
          })
        );
        expect(getByText(/Temporary substitute delegated successfully/i)).toBeTruthy();
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. IncomingHandoversScreen
  // --------------------------------------------------------------------------
  describe('IncomingHandoversScreen', () => {
    const mockIncoming = [
      {
        id: 'hand_inc_1',
        class_id: 'cls_squad_1',
        class_name: 'Silambam Advanced Squad',
        outgoing_master_id: 'usr_master_out',
        outgoing_master_name: 'Master Outgoing Kumar',
        reason: 'Relocation to Shah Alam',
        effective_date: new Date().toISOString(),
        status: 'REQUESTED',
      },
    ];

    it('renders incoming handover requests and accepts responsibility', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/handovers/incoming') {
          return Promise.resolve({ incomingHandovers: mockIncoming });
        }
        return Promise.resolve({});
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        message: 'Accepted',
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <IncomingHandoversScreen user={incomingMasterUser} />
      );

      await waitFor(() => {
        expect(getByText('Silambam Advanced Squad')).toBeTruthy();
        expect(getByText(/Master Outgoing Kumar/i)).toBeTruthy();
        expect(getByTestId('btn-accept-handover-hand_inc_1')).toBeTruthy();
      });
    });

    it('shows empty state when no incoming handovers are pending', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/handovers/incoming') {
          return Promise.resolve({ incomingHandovers: [] });
        }
        return Promise.resolve({});
      });

      const { getByText } = await renderWithTheme(
        <IncomingHandoversScreen user={incomingMasterUser} />
      );

      await waitFor(() => {
        expect(getByText('No Pending Handovers')).toBeTruthy();
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. HandoverApprovalsScreen
  // --------------------------------------------------------------------------
  describe('HandoverApprovalsScreen', () => {
    const mockPendingHandovers = [
      {
        id: 'hand_adm_1',
        class_id: 'cls_squad_1',
        class_name: 'Silambam Advanced Squad',
        outgoing_master_id: 'usr_master_out',
        outgoing_master_name: 'Master Outgoing Kumar',
        incoming_master_id: 'usr_master_in',
        incoming_master_name: 'Master Incoming Tan',
        reason: 'Permanent transfer',
        status: 'INCOMING_ACCEPTED',
        incoming_accepted_at: new Date().toISOString(),
      },
    ];

    it('renders pending handovers in Persatuan Admin inbox and approves', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/handovers/admin') {
          return Promise.resolve({ pendingHandovers: mockPendingHandovers });
        }
        return Promise.resolve({});
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        message: 'Handover approved',
        newPrimaryMasterId: 'usr_master_in',
      });

      const { getByText, getByTestId } = await renderWithTheme(
        <HandoverApprovalsScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByText('Silambam Advanced Squad')).toBeTruthy();
        expect(getByText('Master Outgoing Kumar')).toBeTruthy();
        expect(getByText('Master Incoming Tan')).toBeTruthy();
        expect(getByTestId('btn-admin-approve-hand_adm_1')).toBeTruthy();
      });
    });

    it('shows empty state when all handovers have been reviewed', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/handovers/admin') {
          return Promise.resolve({ pendingHandovers: [] });
        }
        return Promise.resolve({});
      });

      const { getByText } = await renderWithTheme(
        <HandoverApprovalsScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByText('All Handovers Reviewed')).toBeTruthy();
      });
    });
  });
});
