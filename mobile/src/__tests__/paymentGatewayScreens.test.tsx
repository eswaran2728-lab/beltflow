import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { paymentGatewayService } from '../services/paymentGatewayService';
import { ParentFeesPaymentScreen } from '../screens/roles/parent/ParentFeesPaymentScreen';
import { AdminFinanceScreen } from '../screens/roles/adminPersatuan/AdminFinanceScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/paymentGatewayService', () => {
  const actual = jest.requireActual('../services/paymentGatewayService');
  return {
    ...actual,
    paymentGatewayService: {
      getMerchantConfig: jest.fn(),
      getAdminMerchantConfig: jest.fn(),
      saveAdminMerchantConfig: jest.fn(),
      createPaymentIntent: jest.fn(),
      getPaymentIntent: jest.fn(),
      getReconciliationRecords: jest.fn(),
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

describe('H13: Persatuan Payments, FPX/DuitNow & Financial Integrity Screen Tests', () => {
  jest.setTimeout(15000);

  const parentUser: AuthUser = {
    id: 'usr_parent_01',
    fullName: 'Ahmad Faiz (Parent)',
    email: 'ahmad@example.com',
    role: UserRole.PARENT,
    organizationId: 'org_selangor_gayong',
    affiliationStatus: 'ACTIVE',
  };

  const adminUser: AuthUser = {
    id: 'usr_admin_01',
    fullName: 'Siti Aminah (Persatuan Admin)',
    email: 'admin@gayongselangor.my',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_selangor_gayong',
    affiliationStatus: 'ACTIVE',
  };

  const mockChildren = [
    {
      id: 'student_child_01',
      fullName: 'Aiman bin Ahmad',
      currentBeltRank: 'Yellow Belt',
      organizationId: 'org_selangor_gayong',
    },
  ];

  const mockMerchantConfig = {
    configured: true,
    merchant: {
      id: 'merch_01',
      organizationId: 'org_selangor_gayong',
      organization_id: 'org_selangor_gayong',
      merchant_account_id: 'MERCH_GAYONG_SEL_01',
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      merchant_name: 'Persatuan Silat Gayong Selangor',
      merchantName: 'Persatuan Silat Gayong Selangor',
      provider: 'SANDBOX',
      settlement_bank_name: 'Malayan Banking Berhad (Maybank)',
      settlementBankName: 'Malayan Banking Berhad (Maybank)',
      settlement_account_masked: '****8901',
      settlementAccountMasked: '****8901',
      fpx_enabled: true,
      fpxEnabled: true,
      duitnow_enabled: true,
      duitnowEnabled: true,
      cardEnabled: false,
      status: 'ACTIVE',
    },
  };

  const mockDues = [
    {
      id: 'due_01',
      class_id: 'class_gayong_01',
      student_id: 'student_child_01',
      billing_month: '2026-03',
      fee_amount: 80,
      amount_paid: 0,
      status: 'Pending' as const,
    },
  ];

  const mockPaymentsHistory = [
    {
      id: 'pay_hist_01',
      receipt_no: 'REC-20260215-0042',
      amount: 80,
      method: 'FPX_ONLINE_BANKING',
      status: 'Paid',
      created_at: '2026-02-15T10:30:00.000Z',
      is_online_gateway: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default apiClient responses
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/dashboard/parent') {
        return Promise.resolve({ children: mockChildren });
      }
      if (url.includes('/billing/student/')) {
        return Promise.resolve({ dues: mockDues });
      }
      if (url.includes('/payments')) {
        return Promise.resolve({ payments: mockPaymentsHistory });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    // Default gateway service responses
    (paymentGatewayService.getMerchantConfig as jest.Mock).mockResolvedValue(mockMerchantConfig);
    (paymentGatewayService.getAdminMerchantConfig as jest.Mock).mockResolvedValue(mockMerchantConfig);
    (paymentGatewayService.getReconciliationRecords as jest.Mock).mockResolvedValue({
      reconciliationRecords: [
        {
          id: 'rec_01',
          intent_id: 'intent_123',
          payment_id: 'pay_123',
          persatuan_id: 'org_selangor_gayong',
          student_id: 'student_child_01',
          student_name: 'Aiman bin Ahmad',
          provider: 'SANDBOX',
          provider_tx_id: 'TXN-SB-2026-999',
          expected_amount_cents: 8000,
          settled_amount_cents: 8000,
          currency: 'MYR',
          match_status: 'MATCHED',
          receipt_no: 'REC-20260315-0101',
          notes: 'Settled matching expected amount',
          created_at: '2026-03-15T10:00:00.000Z',
        },
      ],
    });
  });

  describe('Parent Fees Payment Screen (Direct Persatuan Routing)', () => {
    test('1. Renders outstanding dues and displays Persatuan direct merchant routing card', async () => {
      const { getByTestId, getAllByText } = await renderWithTheme(
        <ParentFeesPaymentScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('parent-fees-payment-screen')).toBeTruthy();
        expect(getByTestId('merchant-direct-card')).toBeTruthy();
        expect(getAllByText(/Persatuan Silat Gayong/i).length).toBeGreaterThanOrEqual(1);
        expect(getAllByText(/Funds route directly to Persatuan account/i).length).toBeGreaterThanOrEqual(1);
        expect(getAllByText(/2026-03/i).length).toBeGreaterThanOrEqual(1);
        expect(getByTestId('total-payable-amount')).toBeTruthy();
      });

      expect(paymentGatewayService.getMerchantConfig).toHaveBeenCalledWith('org_selangor_gayong');
    });

    test('2. Allows switching between FPX and DuitNow payment methods', async () => {
      const { getByTestId } = await renderWithTheme(
        <ParentFeesPaymentScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('method-fpx')).toBeTruthy();
        expect(getByTestId('method-duitnow')).toBeTruthy();
      });

      // Switch to DuitNow
      await act(async () => {
        fireEvent.press(getByTestId('method-duitnow'));
      });

      // Verify pay button is present and active
      await waitFor(() => {
        const payBtn = getByTestId('btn-pay-now');
        expect(payBtn).toBeTruthy();
      });
    });

    test('3. Initiates payment intent and displays active pending payment intent card', async () => {
      const mockCreatedIntent = {
        id: 'intent_test_001',
        organizationId: 'org_selangor_gayong',
        studentId: 'student_child_01',
        payerUserId: 'usr_parent_01',
        amountCents: 8000,
        amountRM: '80.00',
        currency: 'MYR',
        paymentMethod: 'FPX',
        status: 'PENDING_PROCESSING' as const,
        providerSessionUrl: 'https://sandbox.beltflow.test/checkout/intent_test_001',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };

      (paymentGatewayService.createPaymentIntent as jest.Mock).mockResolvedValue({
        intent: mockCreatedIntent,
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ParentFeesPaymentScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-pay-now')).toBeTruthy();
      });

      // Click Pay Now
      await act(async () => {
        fireEvent.press(getByTestId('btn-pay-now'));
      });

      expect(paymentGatewayService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student_child_01',
          billingMonthIds: ['due_01'],
          paymentMethod: 'FPX',
          fpxBankCode: 'MBB0227',
        })
      );

      // Verify active intent card appears with pending status and check status button
      await waitFor(() => {
        expect(getByTestId('active-intent-card')).toBeTruthy();
        expect(getByText('Payment Pending Authoritative Confirmation')).toBeTruthy();
        expect(getByTestId('btn-check-payment-status')).toBeTruthy();
      });
    });

    test('4. Displays digital receipt and switches to payment history tab', async () => {
      const mockSettledIntent = {
        id: 'intent_test_002',
        organizationId: 'org_selangor_gayong',
        studentId: 'student_child_01',
        payerUserId: 'usr_parent_01',
        amountCents: 8000,
        amountRM: '80.00',
        currency: 'MYR',
        paymentMethod: 'FPX',
        status: 'SUCCEEDED' as const,
        receiptNo: 'REC-20260315-9988',
        providerSessionUrl: 'https://sandbox.beltflow.test/checkout/intent_test_002',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };

      (paymentGatewayService.createPaymentIntent as jest.Mock).mockResolvedValue({
        intent: mockSettledIntent,
      });

      const { getByTestId, getByText } = await renderWithTheme(
        <ParentFeesPaymentScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-pay-now')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-pay-now'));
      });

      await waitFor(() => {
        expect(getByTestId('active-intent-card')).toBeTruthy();
        expect(getByText('Official Receipt: REC-20260315-9988')).toBeTruthy();
      });

      // Switch to Payment History tab
      await act(async () => {
        fireEvent.press(getByTestId('tab-payment-history'));
      });

      await waitFor(() => {
        expect(getByTestId('history-item-pay_hist_01')).toBeTruthy();
        expect(getByText('REC-20260215-0042')).toBeTruthy();
      });
    });
  });

  describe('Admin Persatuan Finance & Reconciliation Screen', () => {
    test('5. Displays configured merchant details with strict account masking and provider', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <AdminFinanceScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByTestId('admin-finance-screen')).toBeTruthy();
        expect(getByTestId('stat-matched-settlements')).toBeTruthy();
        expect(getByTestId('stat-discrepancies')).toBeTruthy();
        expect(getByTestId('merchant-provider-value')).toBeTruthy();
        expect(getByText('SANDBOX')).toBeTruthy();
        expect(getByTestId('merchant-account-id-value')).toBeTruthy();
        expect(getByText('MERCH_GAYONG_SEL_01')).toBeTruthy();
        expect(getByTestId('merchant-masked-account')).toBeTruthy();
        expect(getByText('****8901')).toBeTruthy();
      });
    });

    test('6. Toggles merchant configuration form and updates credentials', async () => {
      (paymentGatewayService.saveAdminMerchantConfig as jest.Mock).mockResolvedValue({
        message: 'Saved',
        merchant: {
          ...mockMerchantConfig.merchant,
          merchant_name: 'Persatuan Silat Gayong Selangor Updated',
        },
      });

      const { getByTestId } = await renderWithTheme(
        <AdminFinanceScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-toggle-config-form')).toBeTruthy();
      });

      // Toggle form open
      await act(async () => {
        fireEvent.press(getByTestId('btn-toggle-config-form'));
      });

      await waitFor(() => {
        expect(getByTestId('merchant-config-form')).toBeTruthy();
        expect(getByTestId('input-merchant-account-id')).toBeTruthy();
        expect(getByTestId('input-merchant-name')).toBeTruthy();
        expect(getByTestId('btn-save-merchant-config')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-save-merchant-config'));
      });

      await waitFor(() => {
        expect(paymentGatewayService.saveAdminMerchantConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            merchantAccountId: 'MERCH_GAYONG_SEL_01',
            provider: 'SANDBOX',
          })
        );
      });
    });

    test('7. Switches to Reconciliation tab and displays matched ledger entries', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <AdminFinanceScreen user={adminUser} />
      );

      await waitFor(() => {
        expect(getByTestId('stat-matched-settlements')).toBeTruthy();
      });

      // Switch to Reconciliation tab
      await act(async () => {
        fireEvent.press(getByTestId('tab-reconciliation'));
      });

      await waitFor(() => {
        expect(getByTestId('rec-record-rec_01')).toBeTruthy();
        expect(getByText('Aiman bin Ahmad')).toBeTruthy();
        expect(getByText('MATCHED')).toBeTruthy();
        expect(getByText('Digital Receipt: REC-20260315-0101')).toBeTruthy();
      });
    });
  });

  describe('Security and Safety Constraints', () => {
    test('8. Zero sensitive banking credentials: UI does not collect banking PIN or password', async () => {
      const { queryByPlaceholderText, queryByText } = await renderWithTheme(
        <ParentFeesPaymentScreen user={parentUser} />
      );

      await waitFor(() => {
        expect(queryByPlaceholderText(/password/i)).toBeNull();
        expect(queryByPlaceholderText(/pin/i)).toBeNull();
        expect(queryByPlaceholderText(/cvv/i)).toBeNull();
        expect(queryByText(/bank password/i)).toBeNull();
      });
    });
  });
});
