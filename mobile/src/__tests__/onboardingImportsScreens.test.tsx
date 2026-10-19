import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { onboardingService, AcademyReadinessReport, ImportPreviewResult, FamilySummary } from '../services/onboardingService';
import { paymentGatewayService } from '../services/paymentGatewayService';
import { AdminAcademySetupScreen } from '../screens/roles/adminPersatuan/AdminAcademySetupScreen';
import { ParentFeesPaymentScreen } from '../screens/roles/parent/ParentFeesPaymentScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/onboardingService', () => {
  const actual = jest.requireActual('../services/onboardingService');
  return {
    ...actual,
    onboardingService: {
      getAcademyReadiness: jest.fn(),
      previewImport: jest.fn(),
      commitImport: jest.fn(),
      getFamilySummary: jest.fn(),
    },
  };
});

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

describe('H14: Academy Setup, Legacy Imports & Essential Family View Screen Tests', () => {
  jest.setTimeout(15000);

  const adminUser: AuthUser = {
    id: 'usr_admin_01',
    fullName: 'Persatuan Admin',
    email: 'admin@silatmelayu.my',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_persatuan_01',
    affiliationStatus: 'ACTIVE',
  };

  const parentUser: AuthUser = {
    id: 'usr_parent_01',
    fullName: 'Puan Siti Rahmah',
    email: 'siti@example.com',
    role: UserRole.PARENT,
    organizationId: 'org_persatuan_01',
    affiliationStatus: 'ACTIVE',
  };

  const mockReadiness: AcademyReadinessReport = {
    organizationId: 'org_persatuan_01',
    organizationName: 'Persatuan Silat Gayong Selangor',
    martialArtStyle: 'Silat Gayong',
    state: 'Selangor',
    readinessScorePercent: 67,
    isReadyForOperations: false,
    checklist: [
      { key: 'academyProfile', title: 'Academy Profile & Details', status: 'COMPLETE', description: 'Official details recorded' },
      { key: 'beltCurriculum', title: 'Published Belt Syllabus', status: 'COMPLETE', description: 'Active curriculum published' },
      { key: 'masterCoaches', title: 'Certified Masters Assigned', status: 'COMPLETE', description: '2 certified coaches' },
      { key: 'classesAndDojos', title: 'Active Training Classes', status: 'COMPLETE', description: '3 training classes scheduled' },
      { key: 'merchantGateway', title: 'Direct Merchant Settlement', status: 'PENDING', description: 'FPX/DuitNow not configured' },
      { key: 'studentRoster', title: 'Students & Legacy Data', status: 'PENDING', description: '0 active students registered' },
    ],
    metrics: {
      curriculumReady: true,
      curriculumRanksCount: 6,
      classesReady: true,
      classesCount: 3,
      mastersReady: true,
      mastersCount: 2,
      merchantReady: false,
      merchantMode: 'SANDBOX',
      studentsCount: 0,
      importBatchesCount: 0,
    },
    recentImports: [],
  };

  const mockPreviewResult: ImportPreviewResult = {
    previewId: 'prev_test_12345',
    organizationId: 'org_persatuan_01',
    sourceFilename: 'legacy_roster.csv',
    totalRows: 2,
    validRowsCount: 1,
    duplicateRowsCount: 0,
    malformedRowsCount: 1,
    wrongTenantRowsCount: 0,
    unverifiedParentRowsCount: 0,
    canCommit: true,
    previewRows: [
      {
        rowIndex: 1,
        status: 'VALID',
        data: {
          fullName: 'Ali bin Ahmad',
          icNumber: '081203-10-1234',
          email: 'ali@example.com',
          phone: '+60123456789',
          beltRank: 'Yellow Belt',
          parentName: 'Ahmad Faiz',
          parentEmail: 'ahmad@example.com',
        },
      },
      {
        rowIndex: 2,
        status: 'MALFORMED',
        errorMessage: 'Invalid Malaysian IC/passport number',
        data: {
          fullName: 'Bad Student',
          icNumber: '999999',
          beltRank: 'Dragon Belt',
        },
      },
    ],
    errors: [
      {
        rowIndex: 2,
        status: 'MALFORMED',
        error: 'Invalid Malaysian IC/passport number',
        data: {},
      },
    ],
  };

  const mockFamilySummary: FamilySummary = {
    parent: {
      id: 'usr_parent_01',
      fullName: 'Puan Siti Rahmah',
      email: 'siti@example.com',
    },
    children: [
      {
        id: 'std_child_01',
        fullName: 'Amir bin Kamaruddin',
        icNumber: '110203-10-1234',
        organizationId: 'org_persatuan_01',
        organizationName: 'Persatuan Silat Gayong Selangor',
        martialArtStyle: 'Silat Gayong',
        beltRank: 'Yellow Belt',
        className: 'Silat Gayong Remaja',
        monthlyFee: 80,
        billingStatus: 'Pending',
        status: 'ACTIVE',
      },
      {
        id: 'std_child_02',
        fullName: 'Aina binti Kamaruddin',
        icNumber: '130506-10-5678',
        organizationId: 'org_persatuan_02',
        organizationName: 'Persatuan Silambam Wilayah Persekutuan',
        martialArtStyle: 'Silambam',
        beltRank: 'Green Belt',
        className: 'Silambam Advanced',
        monthlyFee: 90,
        billingStatus: 'Pending',
        status: 'ACTIVE',
      },
    ],
    separatedCheckouts: [],
    checkoutBundles: [
      {
        organizationId: 'org_persatuan_01',
        organizationName: 'Persatuan Silat Gayong Selangor',
        itemCount: 1,
        totalAmountRM: 80,
        items: [
          {
            dueId: 'due_01',
            studentId: 'std_child_01',
            studentName: 'Amir bin Kamaruddin',
            billingMonth: '2026-10',
            feeAmount: 80,
            amountPaid: 0,
            balance: 80,
          },
        ],
      },
      {
        organizationId: 'org_persatuan_02',
        organizationName: 'Persatuan Silambam Wilayah Persekutuan',
        itemCount: 1,
        totalAmountRM: 90,
        items: [
          {
            dueId: 'due_02',
            studentId: 'std_child_02',
            studentName: 'Aina binti Kamaruddin',
            billingMonth: '2026-10',
            feeAmount: 90,
            amountPaid: 0,
            balance: 90,
          },
        ],
      },
    ],
    hasCrossMerchantChildren: true,
    crossMerchantWarning: 'Children belong to different persatuans',
    nextSessions: [],
    notices: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (onboardingService.getAcademyReadiness as jest.Mock).mockResolvedValue(mockReadiness);
    (onboardingService.previewImport as jest.Mock).mockResolvedValue(mockPreviewResult);
    (onboardingService.commitImport as jest.Mock).mockResolvedValue({
      success: true,
      committedCount: 1,
      batchId: 'batch_test_789',
      message: 'Successfully imported 1 students into Persatuan Silat Gayong Selangor.',
    });
    (onboardingService.getFamilySummary as jest.Mock).mockResolvedValue(mockFamilySummary);

    (paymentGatewayService.getMerchantConfig as jest.Mock).mockResolvedValue({
      configured: true,
      merchant: {
        merchantName: 'Persatuan Silat Gayong Selangor',
        settlementBankName: 'Maybank',
        settlementAccountMasked: '****-5678',
      },
    });

    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/dashboard/parent') {
        return Promise.resolve({
          children: [
            { id: 'std_child_01', fullName: 'Amir bin Kamaruddin', monthlyFee: 80, totalPending: 80, monthsPendingCount: 1 },
          ],
        });
      }
      if (path.startsWith('/billing/student/')) {
        return Promise.resolve({
          dues: [
            {
              id: 'due_01',
              student_id: 'std_child_01',
              class_id: 'cls_01',
              billing_month: '2026-10',
              fee_amount: 80,
              amount_paid: 0,
              status: 'Pending',
            },
          ],
        });
      }
      if (path.startsWith('/payments')) {
        return Promise.resolve({ payments: [] });
      }
      return Promise.resolve({});
    });
  });

  describe('1. Academy Setup Readiness Screen', () => {
    it('renders readiness score, checklist items and blocking deficiencies', async () => {
      const { getByTestId } = await renderWithTheme(<AdminAcademySetupScreen user={adminUser} />);

      await waitFor(() => {
        expect(getByTestId('admin-academy-setup-screen')).toBeTruthy();
        expect(getByTestId('readiness-score-value')).toBeTruthy();
        expect(getByTestId('checklist-item-academyProfile')).toBeTruthy();
        expect(getByTestId('checklist-item-beltCurriculum')).toBeTruthy();
        expect(getByTestId('checklist-item-masterCoaches')).toBeTruthy();
        expect(getByTestId('checklist-item-classesAndDojos')).toBeTruthy();
        expect(getByTestId('checklist-item-merchantGateway')).toBeTruthy();
        expect(getByTestId('checklist-item-studentRoster')).toBeTruthy();
      });
    });

    it('displays offline banner and locks dry run when offline', async () => {
      const { getByTestId } = await renderWithTheme(<AdminAcademySetupScreen user={adminUser} isOffline={true} />);

      await waitFor(() => {
        expect(getByTestId('offline-onboarding-banner')).toBeTruthy();
        expect(getByTestId('btn-dry-run-preview')).toBeTruthy();
      });

      const dryRunBtn = getByTestId('btn-dry-run-preview');
      expect(dryRunBtn.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('2. Legacy Student Import Dry Run & Commit', () => {
    it('executes dry-run preview and surfaces error badges for invalid rows', async () => {
      const { getByTestId } = await renderWithTheme(<AdminAcademySetupScreen user={adminUser} />);

      await waitFor(() => {
        expect(getByTestId('btn-dry-run-preview')).toBeTruthy();
      });

      const sampleData = JSON.stringify([
        { fullName: 'Ali bin Ahmad', icNumber: '081203-10-1234' },
        { fullName: 'Bad Student', icNumber: '999999' },
      ]);

      // Populate import input
      fireEvent.changeText(getByTestId('input-import-data'), sampleData);

      await waitFor(() => {
        expect(getByTestId('input-import-data').props.value).toBe(sampleData);
      });

      // Click Preview Validation
      fireEvent.press(getByTestId('btn-dry-run-preview'));

      await waitFor(() => {
        expect(onboardingService.previewImport).toHaveBeenCalled();
        expect(getByTestId('import-preview-card')).toBeTruthy();
        expect(getByTestId('preview-total-rows')).toBeTruthy();
        expect(getByTestId('preview-valid-rows')).toBeTruthy();
        expect(getByTestId('preview-invalid-rows')).toBeTruthy();
        expect(getByTestId('preview-row-1')).toBeTruthy();
        expect(getByTestId('preview-row-2')).toBeTruthy();
      });
    });

    it('opens confirmation modal and executes atomic commit with audit tracking', async () => {
      const { getByTestId } = await renderWithTheme(<AdminAcademySetupScreen user={adminUser} />);

      await waitFor(() => {
        expect(getByTestId('btn-dry-run-preview')).toBeTruthy();
      });

      const commitSample = JSON.stringify([
        { fullName: 'Ali bin Ahmad', icNumber: '081203-10-1234' },
      ]);

      fireEvent.changeText(getByTestId('input-import-data'), commitSample);

      await waitFor(() => {
        expect(getByTestId('input-import-data').props.value).toBe(commitSample);
      });

      fireEvent.press(getByTestId('btn-dry-run-preview'));

      await waitFor(() => {
        expect(getByTestId('btn-open-commit-modal')).toBeTruthy();
      });

      // Open commit confirmation modal
      fireEvent.press(getByTestId('btn-open-commit-modal'));

      await waitFor(() => {
        expect(getByTestId('import-commit-modal')).toBeTruthy();
      });

      // Confirm commit
      fireEvent.press(getByTestId('btn-confirm-commit-import'));

      await waitFor(() => {
        expect(onboardingService.commitImport).toHaveBeenCalled();
      });
    });
  });

  describe('3. Essential Family View & Multi-Persatuan Separated Checkouts', () => {
    it('displays cross-merchant separation warning when family has children in multiple Persatuans', async () => {
      const { getByTestId } = await renderWithTheme(<ParentFeesPaymentScreen user={parentUser} />);

      await waitFor(() => {
        expect(getByTestId('parent-fees-payment-screen')).toBeTruthy();
        expect(getByTestId('cross-merchant-warning-banner')).toBeTruthy();
      }, { timeout: 8000 });
    });

    it('renders separated checkout bundles per Persatuan merchant without co-mingling', async () => {
      const { getByTestId } = await renderWithTheme(<ParentFeesPaymentScreen user={parentUser} />);

      await waitFor(() => {
        expect(getByTestId('parent-fees-payment-screen')).toBeTruthy();
        expect(getByTestId('checkout-bundle-org_persatuan_01')).toBeTruthy();
        expect(getByTestId('checkout-bundle-org_persatuan_02')).toBeTruthy();
      }, { timeout: 8000 });
    });
  });
});
