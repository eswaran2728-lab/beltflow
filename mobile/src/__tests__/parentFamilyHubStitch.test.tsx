import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { ParentHomeScreen } from '../screens/roles/parent';
import { FamilyBillingCard, MerchantBillingItem } from '../components/stitch/FamilyBillingCard';
import { apiClient } from '../services/apiClient';
import { clearDashboardCache } from '../services/dashboardService';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(),
}));

jest.mock('../services/authService', () => {
  let sessionEndedCallback: (() => void) | null = null;
  return {
    authService: {
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

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="light">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('Parent Family Hub & Sibling Billing — Google Stitch UI/UX Integration', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    clearDashboardCache();
  });

  // --------------------------------------------------------------------------
  // 1. FamilyBillingCard Component Unit Tests
  // --------------------------------------------------------------------------
  describe('FamilyBillingCard Component', () => {
    const mockMerchants: MerchantBillingItem[] = [
      {
        organizationId: 'org_selangor',
        merchantName: 'Persatuan Silambam Selangor',
        currency: 'MYR',
        totalFeeAmount: 120.0,
        totalAmountPaid: 60.0,
        totalOutstandingAmount: 60.0,
        duesCount: 1,
        hasSiblingDiscount: true,
      },
      {
        organizationId: 'org_kl',
        merchantName: 'Persatuan Silambam Kuala Lumpur',
        currency: 'MYR',
        totalFeeAmount: 100.0,
        totalAmountPaid: 0.0,
        totalOutstandingAmount: 100.0,
        duesCount: 2,
        hasSiblingDiscount: false,
      },
    ];

    it('renders total family outstanding amount and merchant breakdowns', async () => {
      const handlePay = jest.fn();
      const handleHistory = jest.fn();

      const { getByTestId, getByText } = await renderWithTheme(
        <FamilyBillingCard
          merchants={mockMerchants}
          totalFamilyOutstanding={160.0}
          currency="MYR"
          hasSiblingDiscount={true}
          siblingDiscountLabel="2-Child Sibling Discount Active"
          siblingDiscountDetails="Multi-child enrollment verified by Persatuan"
          siblingDiscountSavings={12.0}
          onPayNow={handlePay}
          onViewHistory={handleHistory}
        />
      );

      expect(getByTestId('family-billing-card')).toBeTruthy();
      expect(getByText('MYR 160.00')).toBeTruthy();
      expect(getByText('Total Outstanding')).toBeTruthy();

      // Sibling discount banner
      expect(getByTestId('family-sibling-discount-banner')).toBeTruthy();
      expect(getByText('2-Child Sibling Discount Active')).toBeTruthy();
      expect(getByText('-RM 12.00')).toBeTruthy();

      // Persatuan merchant separation
      expect(getByTestId('merchant-billing-org_selangor')).toBeTruthy();
      expect(getByText('Persatuan Silambam Selangor')).toBeTruthy();
      expect(getByTestId('merchant-billing-org_kl')).toBeTruthy();
      expect(getByText('Persatuan Silambam Kuala Lumpur')).toBeTruthy();

      // Interactivity
      await act(async () => {
        fireEvent.press(getByTestId('btn-family-pay-now'));
      });
      expect(handlePay).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.press(getByTestId('btn-family-view-history'));
      });
      expect(handleHistory).toHaveBeenCalledTimes(1);
    });

    it('renders zero outstanding settled state correctly', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <FamilyBillingCard
          merchants={[]}
          totalFamilyOutstanding={0.0}
          currency="MYR"
          hasSiblingDiscount={false}
        />
      );

      expect(getByTestId('family-billing-card')).toBeTruthy();
      expect(getByText('MYR 0.00')).toBeTruthy();
      expect(getByText('ALL SETTLED')).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 2. ParentHomeScreen Stitch UX Integration Tests
  // --------------------------------------------------------------------------
  describe('ParentHomeScreen Stitch UX', () => {
    const parentUser: AuthUser = {
      id: 'usr_parent_murali',
      fullName: 'Murali Krishnan',
      email: 'murali.parent@example.com',
      role: UserRole.PARENT,
      organizationId: 'org_selangor',
      linkedStudentIds: ['stu_ch_01', 'stu_ch_02'],
    };

    const mockChild1 = {
      id: 'stu_ch_01',
      full_name: 'Dharshini Murali',
      belt_rank: 'Green Belt',
      organization_id: 'org_selangor',
      class_id: 'cls_adv_01',
      monthly_fee: 120.0,
      status: 'ACTIVE',
    };

    const mockChild2 = {
      id: 'stu_ch_02',
      full_name: 'Harish Murali',
      belt_rank: 'Yellow Belt',
      organization_id: 'org_selangor',
      class_id: 'cls_beg_01',
      monthly_fee: 100.0,
      status: 'ACTIVE',
    };

    const mockDuesChild1 = {
      total_pending: 120.0,
      months_pending_count: 1,
      dues: [
        { id: 'due_01', month_year: '2026-10', amount: 120.0, amount_paid: 0, status: 'Pending' },
      ],
    };

    const mockDuesChild2 = {
      total_pending: 0.0,
      months_pending_count: 0,
      dues: [],
    };

    const mockNotices = [
      {
        id: 'not_01',
        title: 'National Silambam Championship 2026',
        content: 'Registration is now open for all junior categories.',
        priority: 'HIGH',
        created_at: '2026-10-15T09:00:00Z',
      },
    ];

    it('renders StitchAppHeader, multi-child tabs, active child metrics and direct messaging', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/students/stu_ch_01') return Promise.resolve({ student: mockChild1 });
        if (path === '/api/v1/students/stu_ch_02') return Promise.resolve({ student: mockChild2 });
        if (path === '/api/v1/billing/monthly-dues/student/stu_ch_01') return Promise.resolve(mockDuesChild1);
        if (path === '/api/v1/billing/monthly-dues/student/stu_ch_02') return Promise.resolve(mockDuesChild2);
        if (path.includes('/attendance')) return Promise.resolve({ attendance: [{ status: 'Present' }, { status: 'Present' }] });
        if (path.includes('/sessions')) return Promise.resolve({
          sessions: [
            {
              id: 'sess_01',
              session_date: '2026-10-25',
              start_time: '09:00',
              end_time: '11:00',
              location: 'Selangor Martial Arts Arena',
            },
          ],
        });
        if (path.includes('/certificates')) return Promise.resolve({
          certificates: [
            {
              id: 'cert_01',
              belt_rank: 'Yellow Belt',
              certificate_number: 'CERT-2026-0042',
              issued_date: '2026-06-15',
            },
          ],
        });
        if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: mockNotices });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const mockNavigation = { navigate: jest.fn() };
      const { findByText, getByTestId, getAllByText } = await renderWithTheme(
        <ParentHomeScreen user={parentUser} navigation={mockNavigation} />
      );

      // 1. StitchAppHeader
      expect(await findByText('BELTFLOW FAMILY HUB')).toBeTruthy();
      expect(getByTestId('stitch-app-header')).toBeTruthy();

      // 2. Multi-child selector tabs
      expect(getByTestId('child-tab-stu_ch_01')).toBeTruthy();
      expect(getByTestId('child-tab-stu_ch_02')).toBeTruthy();
      expect(getAllByText('Dharshini Murali').length).toBeGreaterThanOrEqual(1);

      // 3. Active child belt and metrics
      expect(getByTestId('parent-active-child-belt')).toBeTruthy();
      expect(getAllByText('ATTENDANCE').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('OUTSTANDING').length).toBeGreaterThanOrEqual(1);

      // 4. Direct Parent-Master messaging shortcut
      expect(getByTestId('btn-message-active-child-master')).toBeTruthy();
      await act(async () => {
        fireEvent.press(getByTestId('btn-message-active-child-master'));
      });
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Messaging', {
        studentId: 'stu_ch_01',
        classId: 'cls_adv_01',
      });

      // 5. Switch to Child 2
      await act(async () => {
        fireEvent.press(getByTestId('child-tab-stu_ch_02'));
      });
      expect(getAllByText('Harish Murali').length).toBeGreaterThanOrEqual(1);

      // 6. Family Billing Card with Sibling Discount
      expect(getByTestId('family-billing-card')).toBeTruthy();
      expect(getByTestId('family-sibling-discount-banner')).toBeTruthy();
      expect(getAllByText('2-Child Sibling Discount Active').length).toBeGreaterThanOrEqual(1);

      // 7. Verified Certificate
      expect(getAllByText(/Cert #CERT-2026-0042/).length).toBeGreaterThanOrEqual(1);

      // 8. Notices
      expect(getAllByText('National Silambam Championship 2026').length).toBeGreaterThanOrEqual(1);
    });

    it('renders empty state when parent has zero linked children', async () => {
      const parentNoKids: AuthUser = {
        ...parentUser,
        linkedStudentIds: [],
      };
      (apiClient.get as jest.Mock).mockResolvedValue({ notices: [] });

      const { findByText, getByTestId } = await renderWithTheme(
        <ParentHomeScreen user={parentNoKids} />
      );

      expect(await findByText('No Linked Children')).toBeTruthy();
      expect(getByTestId('empty-linked-children')).toBeTruthy();
    });
  });
});
