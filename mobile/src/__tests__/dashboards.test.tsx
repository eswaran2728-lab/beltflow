import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { dashboardService, clearDashboardCache } from '../services/dashboardService';
import { apiClient } from '../services/apiClient';
import { authService } from '../services/authService';
import { SuperAdminHomeScreen } from '../screens/roles/superAdmin';
import { AdminPersatuanHomeScreen } from '../screens/roles/adminPersatuan';
import { MasterHomeScreen } from '../screens/roles/master';
import { ParentHomeScreen } from '../screens/roles/parent';
import { StudentHomeScreen } from '../screens/roles/student';
import { BeltLevelConfig } from '../theme/belts';

// Mock apiClient and authService
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
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

const renderWithTheme = async (ui: React.ReactElement, isDark = true, persatuanBelts?: readonly BeltLevelConfig[]) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode={isDark ? 'dark' : 'light'} persatuanBelts={persatuanBelts}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('BeltFlow Role-Based Mobile Dashboards — Task 1.7 (TDD)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.get as jest.Mock).mockResolvedValue({});
    clearDashboardCache();
  });

  // --------------------------------------------------------------------------
  // 1. SUPER ADMIN DASHBOARD
  // --------------------------------------------------------------------------
  describe('1. Super Admin Dashboard', () => {
    const superAdminUser: AuthUser = {
      id: 'usr_sa_001',
      fullName: 'Super Administrator',
      email: 'admin@beltflow.com',
      role: UserRole.SUPER_ADMIN,
    };

    const mockOrgs = [
      { id: 'org_01', name: 'Persatuan Silambam Selangor', state: 'Selangor', martial_art_style: 'Silambam', master_name: 'Master Nathan', status: 'ACTIVE' },
      { id: 'org_02', name: 'Kuala Lumpur Martial Arts', state: 'Kuala Lumpur', martial_art_style: 'Silambam', master_name: 'Master Suresh', status: 'PENDING' },
    ];

    const mockAudit = [
      { id: 'aud_01', action: 'Organization Onboarded', details: 'Added Selangor dojo', user_role: 'SUPER_ADMIN', user_email: 'admin@beltflow.com', timestamp: '2026-10-13T10:00:00Z' },
    ];

    test('loads platform metrics and displays organizations and audit logs', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/organizations') return Promise.resolve({ organizations: mockOrgs });
        if (path === '/api/v1/audit') return Promise.resolve({ logs: mockAudit });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const navigation = { navigate: jest.fn() };
      const { findByText, getByText, getByTestId } = await renderWithTheme(
        <SuperAdminHomeScreen user={superAdminUser} navigation={navigation} />
      );

      expect(await findByText('BeltFlow Platform')).toBeTruthy();
      expect(await findByText('Persatuan Silambam Selangor')).toBeTruthy();
      expect(await findByText('Kuala Lumpur Martial Arts')).toBeTruthy();
      expect(getByText('Organization Onboarded')).toBeTruthy();

      // Navigation shortcuts
      await act(async () => {
        fireEvent.press(getByTestId('shortcut-sa-persatuans'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Persatuans');

      await act(async () => {
        fireEvent.press(getByTestId('shortcut-sa-audit'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Audit');
    });

    test('Super Admin cannot access individual academy operational records', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/organizations') return Promise.resolve({ organizations: mockOrgs });
        if (path === '/api/v1/audit') return Promise.resolve({ logs: mockAudit });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const { queryByText, findByText } = await renderWithTheme(
        <SuperAdminHomeScreen user={superAdminUser} />
      );

      await findByText('BeltFlow Platform');

      // Must not display academy operational sections
      expect(queryByText('Mat Attendance')).toBeNull();
      expect(queryByText('Belt Grading Evaluation')).toBeNull();
      expect(queryByText('Tuition Fees Collection')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. PERSATUAN ADMIN DASHBOARD
  // --------------------------------------------------------------------------
  describe('2. Persatuan Admin Dashboard', () => {
    const adminUser: AuthUser = {
      id: 'usr_ap_001',
      fullName: 'Admin Aminah',
      email: 'admin@silambam.my',
      role: UserRole.ADMIN_PERSATUAN,
      organizationId: 'org_silambam_01',
    };

    const mockOrg = {
      id: 'org_silambam_01',
      name: 'Persatuan Silambam Malaysia',
      state: 'Selangor',
      martial_art_style: 'Silambam',
      master_name: 'Master Suresh',
      status: 'ACTIVE',
    };

    const mockClasses = [
      { id: 'cls_01', name: 'Weekend Morning Class', location: 'Dojo Shah Alam', monthly_fee: 120.0, master_name: 'Master Nathan' },
      { id: 'cls_02', name: 'Youth Evening Class', location: 'Dojo Klang', monthly_fee: 100.0, master_name: 'Master Nathan' },
    ];

    const mockCoaches = [
      { id: 'cch_01', fullName: 'Master Nathan', email: 'nathan@silambam.my', role: 'MASTER', credentialLevel: '6th Dan' },
    ];

    const mockStudents = [
      { id: 'stu_01', full_name: 'Aryan Suresh', belt_rank: 'Green Belt' },
      { id: 'stu_02', full_name: 'Divya Ramesh', belt_rank: 'Yellow Belt' },
    ];

    const mockPayments = [
      { id: 'pay_01', amount: 120.0, status: 'Approved' },
      { id: 'pay_02', amount: 100.0, status: 'Approved' },
    ];

    test('loads academy profile, locations, masters, students, and financial summary', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/organizations/org_silambam_01') return Promise.resolve({ organization: mockOrg });
        if (path === '/api/v1/classes/organization/org_silambam_01') return Promise.resolve({ classes: mockClasses });
        if (path === '/api/v1/coaches/organization/org_silambam_01') return Promise.resolve({ coaches: mockCoaches });
        if (path === '/api/v1/students/organization/org_silambam_01') return Promise.resolve({ students: mockStudents });
        if (path === '/api/v1/billing/organization/org_silambam_01') return Promise.resolve({ payments: mockPayments });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const navigation = { navigate: jest.fn() };
      const { findByText, getByText, getByTestId } = await renderWithTheme(
        <AdminPersatuanHomeScreen user={adminUser} navigation={navigation} />
      );

      expect(await findByText('Persatuan Silambam Malaysia')).toBeTruthy();
      expect(await findByText('Weekend Morning Class')).toBeTruthy();
      expect(getByText('Master Nathan')).toBeTruthy();
      expect(getByText('RM 220')).toBeTruthy(); // Total revenue

      // Navigation shortcuts
      await act(async () => {
        fireEvent.press(getByTestId('shortcut-ap-locations'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Locations');

      await act(async () => {
        fireEvent.press(getByTestId('shortcut-ap-masters'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Masters');
    });

    test('Persatuan Admin dashboard never exposes fee editing reserved for Masters', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/organizations/org_silambam_01') return Promise.resolve({ organization: mockOrg });
        if (path === '/api/v1/classes/organization/org_silambam_01') return Promise.resolve({ classes: mockClasses });
        if (path === '/api/v1/coaches/organization/org_silambam_01') return Promise.resolve({ coaches: mockCoaches });
        if (path === '/api/v1/students/organization/org_silambam_01') return Promise.resolve({ students: mockStudents });
        if (path === '/api/v1/billing/organization/org_silambam_01') return Promise.resolve({ payments: mockPayments });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const { findByText, queryByText } = await renderWithTheme(
        <AdminPersatuanHomeScreen user={adminUser} />
      );

      await findByText('Persatuan Silambam Malaysia');
      expect(queryByText('Edit Tuition Fee')).toBeNull();
      expect(queryByText('Submit Grading Score')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. MASTER DASHBOARD
  // --------------------------------------------------------------------------
  describe('3. Master Dashboard', () => {
    const masterUser: AuthUser = {
      id: 'usr_master_001',
      fullName: 'Master Suresh',
      email: 'suresh@silambam.my',
      role: UserRole.MASTER,
      organizationId: 'org_silambam_01',
      assignedClassIds: ['cls_01'],
    };

    const mockClasses = [
      { id: 'cls_01', name: 'Master Suresh Assigned Class', location: 'Shah Alam Dojo', monthly_fee: 120.0 },
    ];

    const mockStudents = [
      { id: 'stu_01', full_name: 'Aryan Suresh', belt_rank: 'Green Belt', class_id: 'cls_01' },
    ];

    const mockGrading = [
      { id: 'grd_01', title: 'Q4 Silambam Grading Examination', grading_date: '2026-11-15', location: 'Shah Alam Dojo', status: 'SCHEDULED', candidate_count: 8 },
    ];

    test('loads assigned classes, students, today sessions, and grading events', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/classes/organization/org_silambam_01') return Promise.resolve({ classes: mockClasses });
        if (path === '/api/v1/students/organization/org_silambam_01') return Promise.resolve({ students: mockStudents });
        if (path === '/api/v1/grading/organization/org_silambam_01') return Promise.resolve({ gradingEvents: mockGrading });
        if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const navigation = { navigate: jest.fn() };
      const { findByText, getByText, getByTestId } = await renderWithTheme(
        <MasterHomeScreen user={masterUser} navigation={navigation} />
      );

      expect(await findByText('Welcome, Master Suresh')).toBeTruthy();
      expect(await findByText('Master Suresh Assigned Class')).toBeTruthy();
      expect(getByText('Q4 Silambam Grading Examination')).toBeTruthy();

      // Navigation shortcuts
      await act(async () => {
        fireEvent.press(getByTestId('shortcut-master-classes'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Classes');

      await act(async () => {
        fireEvent.press(getByTestId('shortcut-master-attendance'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Attendance');
    });

    test('displays offline status banner without mutating attendance', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ classes: mockClasses, students: mockStudents, gradingEvents: mockGrading });

      const { findByText, getByTestId } = await renderWithTheme(
        <MasterHomeScreen user={masterUser} isOffline={true} />
      );

      expect(await findByText('Welcome, Master Suresh')).toBeTruthy();
      expect(getByTestId('offline-security-banner')).toBeTruthy();
    });

    test('filters classes strictly to assigned class IDs', async () => {
      const allOrgClasses = [
        { id: 'cls_01', name: 'Authorized Class', location: 'Dojo 1', monthly_fee: 100 },
        { id: 'cls_other', name: 'Unauthorized Other Class', location: 'Dojo 2', monthly_fee: 100 },
      ];

      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('/classes/organization/')) return Promise.resolve({ classes: allOrgClasses });
        if (path.includes('/students/organization/')) return Promise.resolve({ students: [] });
        if (path.includes('/grading/organization/')) return Promise.resolve({ gradingEvents: [] });
        return Promise.resolve({});
      });

      const data = await dashboardService.getMasterDashboard(masterUser);
      expect(data.classes.length).toBe(1);
      expect(data.classes[0].id).toBe('cls_01');
      expect(data.classes.some(c => c.id === 'cls_other')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. PARENT DASHBOARD
  // --------------------------------------------------------------------------
  describe('4. Parent Dashboard', () => {
    const parentUser: AuthUser = {
      id: 'usr_parent_001',
      fullName: 'Dr. Ramesh Kumar',
      email: 'ramesh@example.com',
      role: UserRole.PARENT,
      organizationId: 'org_silambam_01',
      linkedStudentIds: ['stu_child_01', 'stu_child_02'],
    };

    const mockChild1 = {
      id: 'stu_child_01',
      full_name: 'Kavita Ramesh',
      belt_rank: 'Yellow Belt',
      class_id: 'cls_01',
      monthly_fee: 108.0,
    };

    const mockChild2 = {
      id: 'stu_child_02',
      full_name: 'Rohan Ramesh',
      belt_rank: 'White Belt',
      class_id: 'cls_01',
      monthly_fee: 96.0,
    };

    const mockDues1 = {
      currentFee: 108.0,
      monthsPendingCount: 1,
      totalPending: 108.0,
      dues: [],
    };

    const mockDues2 = {
      currentFee: 96.0,
      monthsPendingCount: 0,
      totalPending: 0.0,
      dues: [],
    };

    const mockNotices = [
      { id: 'not_01', title: 'Annual Silambam Camp Notice', content: 'Camp dates announced for December.', created_at: '2026-10-12T10:00:00Z' },
    ];

    test('renders linked children switcher, child belt, attendance, and outstanding fees', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/students/stu_child_01') return Promise.resolve({ student: mockChild1 });
        if (path === '/api/v1/students/stu_child_02') return Promise.resolve({ student: mockChild2 });
        if (path === '/api/v1/billing/monthly-dues/student/stu_child_01') return Promise.resolve(mockDues1);
        if (path === '/api/v1/billing/monthly-dues/student/stu_child_02') return Promise.resolve(mockDues2);
        if (path.includes('/attendance')) return Promise.resolve({ attendance: [{ status: 'Present' }] });
        if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
        if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
        if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: mockNotices });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const navigation = { navigate: jest.fn() };
      const { findByText, getByText, getByTestId, getAllByText } = await renderWithTheme(
        <ParentHomeScreen user={parentUser} navigation={navigation} />
      );

      expect(await findByText('Welcome, Dr. Ramesh Kumar')).toBeTruthy();
      expect(getAllByText('Kavita Ramesh').length).toBeGreaterThanOrEqual(1);
      expect(getByText('RM 108')).toBeTruthy(); // Outstanding fee for Child 1
      expect(getByText('Annual Silambam Camp Notice')).toBeTruthy();

      // Switch to Child 2
      await act(async () => {
        fireEvent.press(getByTestId('child-tab-stu_child_02'));
      });
      expect(getAllByText('Rohan Ramesh').length).toBeGreaterThanOrEqual(1);

      // Navigation shortcut
      await act(async () => {
        fireEvent.press(getByTestId('shortcut-parent-fees'));
      });
      expect(navigation.navigate).toHaveBeenCalledWith('Fees');
    });

    test('displays empty state when parent has no linked children', async () => {
      const parentNoChildren: AuthUser = {
        ...parentUser,
        linkedStudentIds: [],
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ notices: [] });

      const { findByText } = await renderWithTheme(
        <ParentHomeScreen user={parentNoChildren} />
      );

      expect(await findByText('No Linked Children')).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 5. STUDENT DASHBOARD & CUSTOM BELT CONFIGURATION
  // --------------------------------------------------------------------------
  describe('5. Student Dashboard & Custom Belt Configuration', () => {
    const studentUser: AuthUser = {
      id: 'usr_student_001',
      fullName: 'Aryan Suresh',
      email: 'aryan@example.com',
      role: UserRole.STUDENT,
      organizationId: 'org_custom_belts',
    };

    const mockStudent = {
      id: 'stu_aryan_01',
      full_name: 'Aryan Suresh',
      belt_rank: 'Intermediate Green Belt',
      organization_id: 'org_custom_belts',
      class_id: 'cls_01',
      monthly_fee: 120.0,
      status: 'ACTIVE',
    };

    const mockCustomBelts: BeltLevelConfig[] = [
      { id: 'c_white', name: 'Foundation White', order: 1, colorHex: '#FFFFFF' },
      { id: 'c_green', name: 'Intermediate Green Belt', order: 2, colorHex: '#22C55E' },
      { id: 'c_blue', name: 'Advanced Blue Belt', order: 3, colorHex: '#3B82F6' },
    ];

    test('resolves student belts using active organization configuration without hardcoding 8 belts', async () => {
      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/students/me') return Promise.resolve({ student: mockStudent });
        if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
        if (path.includes('/attendance')) return Promise.resolve({ attendance: [{ status: 'Present' }] });
        if (path.includes('/skills')) return Promise.resolve({ skills: [] });
        if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
        if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: [] });
        if (path.includes('/organizations/')) return Promise.resolve({ organization: { name: 'Academy of Silambam Arts' } });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const { findByText, getByText } = await renderWithTheme(
        <StudentHomeScreen user={studentUser} />,
        true,
        mockCustomBelts
      );

      expect(await findByText('Welcome, Aryan Suresh')).toBeTruthy();
      expect(await findByText('Academy of Silambam Arts')).toBeTruthy();
      expect(getByText('Intermediate Green Belt')).toBeTruthy();

      // Next belt promotion is resolved from custom belts:
      expect(getByText(/Next Target: Advanced Blue Belt/i)).toBeTruthy();
    });

    test('if configuration has no next belt, shows current rank without inventing one', async () => {
      const topStudent = {
        ...mockStudent,
        belt_rank: 'Advanced Blue Belt', // Highest in mockCustomBelts
      };

      (apiClient.get as jest.Mock).mockImplementation((path: string) => {
        if (path === '/api/v1/students/me') return Promise.resolve({ student: topStudent });
        if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
        if (path.includes('/attendance')) return Promise.resolve({ attendance: [] });
        if (path.includes('/skills')) return Promise.resolve({ skills: [] });
        if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
        if (path === '/api/v1/notices/mine') return Promise.resolve({ notices: [] });
        if (path.includes('/organizations/')) return Promise.resolve({ organization: { name: 'Academy' } });
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      });

      const { findByText, queryByText } = await renderWithTheme(
        <StudentHomeScreen user={studentUser} />,
        true,
        mockCustomBelts
      );

      expect(await findByText('Advanced Blue Belt')).toBeTruthy();
      // Must not invent an 8-belt rank like Red Belt or Black Belt!
      expect(queryByText(/Next Target: Red Belt/i)).toBeNull();
      expect(queryByText(/Next Target: Black Belt/i)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 6. ERROR HANDLING, RETRY & MANUAL REFRESH
  // --------------------------------------------------------------------------
  describe('6. Error Handling, Retry & Manual Refresh', () => {
    test('renders error state and retries on failure', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network request failed'));

      const superAdminUser: AuthUser = {
        id: 'usr_sa_001',
        fullName: 'Super Administrator',
        email: 'admin@beltflow.com',
        role: UserRole.SUPER_ADMIN,
      };

      const { findByText, getByTestId } = await renderWithTheme(
        <SuperAdminHomeScreen user={superAdminUser} />
      );

      expect(await findByText('Network request failed')).toBeTruthy();

      // Now mock success and press Retry
      (apiClient.get as jest.Mock).mockReset();
      (apiClient.get as jest.Mock).mockResolvedValue({ organizations: [], logs: [] });
      await act(async () => {
        fireEvent.press(getByTestId('btn-error-retry'));
      });

      expect(await findByText('BeltFlow Platform')).toBeTruthy();
    });

    test('cache is purged when session ends', async () => {
      (apiClient.get as jest.Mock).mockReset();
      (apiClient.get as jest.Mock).mockResolvedValue({ organizations: [{ id: 'org_01', name: 'Org 1' }], logs: [] });

      await dashboardService.getSuperAdminDashboard();
      expect(apiClient.get).toHaveBeenCalledTimes(2);

      // Cached call does not hit API again
      await dashboardService.getSuperAdminDashboard();
      expect(apiClient.get).toHaveBeenCalledTimes(2);

      // Trigger session ended
      (authService as any)._triggerSessionEnded();

      // Next call must hit API again because cache was cleared
      await dashboardService.getSuperAdminDashboard();
      expect(apiClient.get).toHaveBeenCalledTimes(4);
    });

    test('renders with light theme tokens without crashing', async () => {
      const studentUser: AuthUser = {
        id: 'usr_stu_light',
        fullName: 'Student Light',
        email: 'light@example.com',
        role: UserRole.STUDENT,
        organizationId: 'org_01',
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        student: { id: 'stu_01', full_name: 'Student Light', belt_rank: 'White Belt', monthly_fee: 100 },
        sessions: [],
        attendance: [],
        skills: [],
        certificates: [],
        notices: [],
        organization: { name: 'Academy Light' },
      });

      const { findByText } = await renderWithTheme(
        <StudentHomeScreen user={studentUser} />,
        false // light theme
      );

      expect(await findByText('Welcome, Student Light')).toBeTruthy();
    });
  });
});
