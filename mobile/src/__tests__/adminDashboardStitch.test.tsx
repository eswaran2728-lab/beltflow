import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminPersatuanHomeScreen } from '../screens/roles/adminPersatuan';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { clearDashboardCache } from '../services/dashboardService';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Google Stitch Admin Persatuan UI/UX Workstream Tests (Task H25)', () => {
  const adminUser: AuthUser = {
    id: 'usr_adm_001',
    fullName: 'Master Pandian Chettiar',
    email: 'admin@silambam-selangor.org',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_selangor_silambam',
  };

  const mockOrg = {
    id: 'org_selangor_silambam',
    name: 'Persatuan Silambam Negeri Selangor',
    state: 'Selangor',
    martial_art_style: 'Silambam',
    master_name: 'Master Pandian',
    status: 'ACTIVE',
  };

  const mockClasses = [
    {
      id: 'cls_01',
      name: 'Shah Alam Senior Combat',
      location: 'Shah Alam Sports Complex',
      monthly_fee: 120,
      master_name: 'Master Kumar',
    },
    {
      id: 'cls_02',
      name: 'Klang Traditional Forms',
      location: 'Klang Community Hall',
      monthly_fee: 110,
      master_name: 'Master Muthu',
    },
    {
      id: 'cls_03',
      name: 'Subang Mat Session A',
      location: 'Subang Jaya Centre',
      monthly_fee: 120,
      master_name: 'Master Kumar',
    },
    {
      id: 'cls_04',
      name: 'Petaling Jaya Youth',
      location: 'PJ Civic Hall',
      monthly_fee: 120,
      master_name: 'Master Nathan',
    },
    {
      id: 'cls_05',
      name: 'Rawang Evening Dojo',
      location: 'Rawang Sports Hall',
      monthly_fee: 100,
      master_name: 'Master Nathan',
    },
    {
      id: 'cls_06',
      name: 'Banting Weekend Forms',
      location: 'Banting Community Centre',
      monthly_fee: 90,
      master_name: 'Master Muthu',
    },
  ];

  const mockCoaches = [
    { id: 'usr_m1', fullName: 'Master Kumar V.', email: 'kumar@silambam.org', role: 'MASTER', credential_level: '5th Dan Senior Master' },
    { id: 'usr_m2', fullName: 'Master Muthu S.', email: 'muthu@silambam.org', role: 'MASTER', credential_level: '3rd Dan Instructor' },
    { id: 'usr_m3', fullName: 'Master Nathan K.', email: 'nathan@silambam.org', role: 'MASTER', credential_level: '4th Dan Master' },
    { id: 'usr_m4', fullName: 'Coach Sarah T.', email: 'sarah@silambam.org', role: 'MASTER', credential_level: '2nd Dan Coach' },
    { id: 'usr_m5', fullName: 'Coach Lee W.', email: 'lee@silambam.org', role: 'MASTER', credential_level: '1st Dan Assistant' },
  ];

  const mockStudents = Array.from({ length: 142 }, (_, i) => ({
    id: `stu_${i + 1}`,
    full_name: `Student ${i + 1}`,
    belt_rank: 'Green Belt',
  }));

  const mockPayments = Array.from({ length: 142 }, (_, i) => ({
    id: `pay_${i + 1}`,
    amount: 120.0,
    status: 'Approved',
  }));

  const setupAdminMocks = () => {
    clearDashboardCache();
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/api/v1/organizations/org_selangor_silambam') {
        return Promise.resolve({ organization: mockOrg });
      }
      if (path === '/api/v1/classes/organization/org_selangor_silambam') {
        return Promise.resolve({ classes: mockClasses });
      }
      if (path === '/api/v1/coaches/organization/org_selangor_silambam') {
        return Promise.resolve({ coaches: mockCoaches });
      }
      if (path === '/api/v1/students/organization/org_selangor_silambam') {
        return Promise.resolve({ students: mockStudents });
      }
      if (path === '/api/v1/billing/organization/org_selangor_silambam') {
        return Promise.resolve({ payments: mockPayments });
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupAdminMocks();
  });

  const renderScreen = async (customUser: AuthUser = adminUser, nav: any = { navigate: jest.fn() }) => {
    return await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <AdminPersatuanHomeScreen
            user={customUser}
            navigation={nav}
            onLogout={jest.fn()}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  };

  // =========================================================================
  // Requirement 1: Google Stitch App Header & Identity
  // =========================================================================
  test('renders StitchAppHeader with Dojang brand title, organization name, and role chip', async () => {
    const { getByTestId, findByText, findAllByText } = await renderScreen();

    // Verify Stitch App Header
    expect(getByTestId('stitch-app-header')).toBeTruthy();
    expect(await findByText('BELTFLOW')).toBeTruthy();
    expect((await findAllByText('ADMIN PERSATUAN')).length).toBeGreaterThanOrEqual(1);
    expect((await findAllByText('Persatuan Silambam Negeri Selangor')).length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Requirement 2: StitchStatCards with Real Non-Mock Metrics
  // =========================================================================
  test('renders 5 StitchStatCards displaying server-authoritative operational metrics', async () => {
    const { findByTestId, findByText, findAllByText } = await renderScreen();

    // Verify all 5 Stat Cards exist
    expect(await findByTestId('stat-ap-locations')).toBeTruthy();
    expect(await findByTestId('stat-ap-classes')).toBeTruthy();
    expect(await findByTestId('stat-ap-masters')).toBeTruthy();
    expect(await findByTestId('stat-ap-students')).toBeTruthy();
    expect(await findByTestId('stat-ap-revenue')).toBeTruthy();

    // Verify exact server-authoritative numbers
    expect((await findAllByText('6')).length).toBeGreaterThanOrEqual(1); // Unique locations / classes
    expect((await findAllByText('5')).length).toBeGreaterThanOrEqual(1); // Masters count
    expect(await findByText('142')).toBeTruthy(); // Students count
    expect(await findByText('RM 17040.00')).toBeTruthy(); // Total revenue (142 * 120 = 17040)
  });

  // =========================================================================
  // Requirement 3: Governance & Role Authority Boundary Notice
  // =========================================================================
  test('displays Persatuan administrative boundary notice preserving Master fee & grading authority', async () => {
    const { findByText } = await renderScreen();

    expect(await findByText('Persatuan Administration Scope')).toBeTruthy();
    expect(
      await findByText(
        /Per-class fee modifications and grading evaluation submissions remain strictly under the authority of certified Masters/i
      )
    ).toBeTruthy();
  });

  // =========================================================================
  // Requirement 4: Active Classes and Assigned Masters
  // =========================================================================
  test('renders active classes with monthly fees and assigned masters with credential levels', async () => {
    const { findByText, findAllByText } = await renderScreen();

    // Active classes
    expect(await findByText('Shah Alam Senior Combat')).toBeTruthy();
    expect(await findByText('Shah Alam Sports Complex • Fee: RM 120/mo')).toBeTruthy();
    expect((await findAllByText('Assigned: Master Kumar')).length).toBeGreaterThanOrEqual(1);

    expect(await findByText('Klang Traditional Forms')).toBeTruthy();
    expect(await findByText('Klang Community Hall • Fee: RM 110/mo')).toBeTruthy();

    // Assigned Masters
    expect(await findByText('Master Kumar V.')).toBeTruthy();
    expect(await findByText('5th Dan Senior Master')).toBeTruthy();
    expect(await findByText('Master Muthu S.')).toBeTruthy();
    expect(await findByText('3rd Dan Instructor')).toBeTruthy();
  });

  // =========================================================================
  // Requirement 5: Quick Navigation Shortcuts including H25 Commerce
  // =========================================================================
  test('renders quick navigation shortcuts including H25 inventory and routes correctly', async () => {
    const mockNav = { navigate: jest.fn() };
    const { findByTestId, findByText } = await renderScreen(adminUser, mockNav);

    // Verify H25 Commerce shortcut
    const inventoryBtn = await findByTestId('shortcut-ap-inventory');
    expect(inventoryBtn).toBeTruthy();
    expect(await findByText('Equipment & Merchandise Inventory')).toBeTruthy();

    // Verify Tournaments shortcut
    const tournBtn = await findByTestId('shortcut-ap-tournaments');
    expect(tournBtn).toBeTruthy();

    // Verify Onboarding shortcut
    const onboardingBtn = await findByTestId('shortcut-ap-onboarding');
    expect(onboardingBtn).toBeTruthy();

    // Fire press event and assert navigation
    fireEvent.press(inventoryBtn);
    expect(mockNav.navigate).toHaveBeenCalledWith('Inventory');
  });

  // =========================================================================
  // Requirement 6: Multilingual Switcher (English, Malay, Tamil)
  // =========================================================================
  test('allows seamless language cycling between English, Bahasa Melayu, and Tamil without truncation', async () => {
    const { findByTestId, findByText } = await renderScreen();

    const langBtn = await findByTestId('btn-admin-language-switch');
    expect(langBtn).toBeTruthy();

    // Initial English check
    expect(await findByText('Persatuan Administration Scope')).toBeTruthy();

    // 1st cycle: Switch to Bahasa Melayu
    fireEvent.press(langBtn);
    expect(await findByText('Skop Pentadbiran Persatuan')).toBeTruthy();
    expect(await findByText('Inventori Peralatan & Barangan')).toBeTruthy();

    // 2nd cycle: Switch to Tamil
    fireEvent.press(langBtn);
    expect(await findByText('நிர்வாக அதிகார வரம்பு')).toBeTruthy();
    expect(await findByText('உபகரணங்கள் & பொருட்கள் சேமிப்பு')).toBeTruthy();

    // 3rd cycle: Return to English
    fireEvent.press(langBtn);
    expect(await findByText('Persatuan Administration Scope')).toBeTruthy();
  });

  // =========================================================================
  // Requirement 7: Offline State Handling
  // =========================================================================
  test('displays offline security banner when device is in offline mode', async () => {
    const { findByTestId } = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <AdminPersatuanHomeScreen
            user={adminUser}
            isOffline={true}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    const banner = await findByTestId('offline-security-banner');
    expect(banner).toBeTruthy();
  });
});
