/**
 * Persatuan admin: Locations and Reports screens (2026-11-22).
 *
 *  - Locations groups the academy's classes by their `location` field
 *    (GET /api/v1/classes/organization/:orgId, real column names), with a
 *    "Location not set" group for classes without one.
 *  - Reports shows GET /api/v1/analytics/metrics for a chosen period, and a
 *    switched-off message when the analytics module answers MODULE_DISABLED.
 *  - Loading, empty and error-with-retry states; no made-up data.
 * Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider, DICTIONARIES } from '../i18n';
import { apiClient, ApiError } from '../services/apiClient';
import { AuthUser, UserRole } from '../types/auth';
import { LocationsScreen, ReportsScreen } from '../screens/roles/adminPersatuan';
import { groupClassesByLocation } from '../services/adminRecordsService';

jest.mock('../services/apiClient', () => {
  const actual = jest.requireActual('../services/apiClient');
  return {
    ...actual,
    apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
    onUnauthorizedResponse: jest.fn(() => () => {}),
  };
});

const get = apiClient.get as jest.Mock;
const en = DICTIONARIES.en as Record<string, string>;

const USER: AuthUser = {
  id: 'usr_test_admin',
  fullName: 'Test Admin',
  email: 'test.admin@example.test',
  role: UserRole.ADMIN_PERSATUAN,
  organizationId: 'org_test_01',
};

const CLASSES_PATH = '/api/v1/classes/organization/org_test_01';

// Rows as GET /classes/organization/:orgId returns them (SELECT c.*, u.full_name AS master_name).
const CLASSES = [
  {
    id: 'cls_test_1', organization_id: 'org_test_01', name: 'Junior Silambam', location: 'Dewan Komuniti Shah Alam',
    venue_details: 'Hall B, level 2', schedule: 'Mon & Wed 5:00 PM', master_name: 'Test Master One',
    status: 'ACTIVE', operational_status: 'ACTIVE', capacity: 25, monthly_fee: '120.00',
  },
  {
    id: 'cls_test_2', organization_id: 'org_test_01', name: 'Adult Silambam', location: 'Dewan Komuniti Shah Alam',
    venue_details: null, schedule: 'Fri 8:00 PM', master_name: 'Test Master Two',
    status: 'ACTIVE', operational_status: 'PAUSED', capacity: 20, monthly_fee: '150.00',
  },
  {
    id: 'cls_test_3', organization_id: 'org_test_01', name: 'Klang Beginners', location: 'Klang Sports Centre',
    venue_details: null, schedule: 'Sat 9:00 AM', master_name: null,
    status: 'ACTIVE', operational_status: 'ACTIVE', capacity: 30, monthly_fee: '100.00',
  },
  {
    id: 'cls_test_4', organization_id: 'org_test_01', name: 'Unplaced Class', location: '',
    venue_details: null, schedule: 'Sun 10:00 AM', master_name: 'Test Master One',
    status: 'ACTIVE', operational_status: 'NOT_STARTED', capacity: 15, monthly_fee: '100.00',
  },
];

const METRICS = {
  metadata: {
    metricVersion: 'v2.0-h23', calculatedAt: '2026-11-22T01:00:00.000Z', scope: 'organization',
    period: 'current_month', organizationId: 'org_test_01', organizationName: 'Test Persatuan',
  },
  enrollment: {
    activeEnrolledStudents: 42, pendingApplicants: 7, totalClassCapacity: 90,
    capacityUtilizationPercent: 46.67, activeClassesCount: 4,
  },
  trialConversion: { totalTrialsBooked: 12, trialsAttended: 9, trialsConverted: 5, conversionRatePercent: 41.67 },
  retention: { activeStudents: 42, pausedMemberships: 3, transfersCount: 2, retentionRatePercent: 93.33 },
  ledgerTotals: { currency: 'MYR', totalCollected: 5040.5, totalOutstanding: 360, siblingDiscountSavings: 80 },
};

const ZERO_METRICS = {
  ...METRICS,
  enrollment: { activeEnrolledStudents: 0, pendingApplicants: 0, totalClassCapacity: 0, capacityUtilizationPercent: 0, activeClassesCount: 0 },
  trialConversion: { totalTrialsBooked: 0, trialsAttended: 0, trialsConverted: 0, conversionRatePercent: 0 },
  retention: { activeStudents: 0, pausedMemberships: 0, transfersCount: 0, retentionRatePercent: 100 },
  ledgerTotals: { currency: 'MYR', totalCollected: 0, totalOutstanding: 0, siblingDiscountSavings: 0 },
};

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider defaultMode="light">
    <I18nProvider initialLocale="en">{ui}</I18nProvider>
  </ThemeProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('groupClassesByLocation', () => {
  test('groups by location, puts classes without a location last', () => {
    const groups = groupClassesByLocation(
      CLASSES.map(c => ({
        id: c.id, name: c.name, location: c.location || null, venueDetails: c.venue_details, schedule: c.schedule,
        masterName: c.master_name, status: c.operational_status, capacity: c.capacity,
      }))
    );
    expect(groups.map(g => g.location)).toEqual(['Dewan Komuniti Shah Alam', 'Klang Sports Centre', null]);
    expect(groups[0].classes.map(c => c.id)).toEqual(['cls_test_2', 'cls_test_1']);
    expect(groups[2].classes.map(c => c.id)).toEqual(['cls_test_4']);
  });
});

describe('Admin Locations screen', () => {
  test('lists venues grouped by location with schedule, Master and status', async () => {
    get.mockResolvedValue({ classes: CLASSES });
    const screen = await render(wrap(<LocationsScreen user={USER} />));

    expect(await screen.findByTestId('venue-group-0')).toBeTruthy();
    expect(get).toHaveBeenCalledWith(CLASSES_PATH);

    expect(screen.getByText('Dewan Komuniti Shah Alam')).toBeTruthy();
    expect(screen.getByText('Klang Sports Centre')).toBeTruthy();
    expect(screen.getByText(en['adminHome.locations.notSet'])).toBeTruthy();
    expect(screen.getByText('Junior Silambam')).toBeTruthy();
    expect(screen.getByText('Unplaced Class')).toBeTruthy();
    expect(screen.getByText('Hall B, level 2')).toBeTruthy();
    expect(screen.getByText('Mon & Wed 5:00 PM')).toBeTruthy();
    expect(screen.getAllByText('Master: Test Master One').length).toBe(2);
    expect(screen.getByText(en['adminHome.locations.noMaster'])).toBeTruthy();
    expect(screen.getByTestId('class-status-cls_test_2')).toBeTruthy();
    expect(screen.getByText(en['adminHome.locations.statusPaused'])).toBeTruthy();
    expect(screen.getAllByText(en['adminHome.locations.statusActive']).length).toBe(2);
    // Two classes at the first venue, counted in the header.
    expect(screen.getByText('2 classes')).toBeTruthy();
    expect(screen.getByText('Capacity: 25 places')).toBeTruthy();
  });

  test('shows the empty state when the academy has no classes', async () => {
    get.mockResolvedValue({ classes: [] });
    const screen = await render(wrap(<LocationsScreen user={USER} />));
    expect(await screen.findByTestId('locations-empty')).toBeTruthy();
    expect(screen.getByText(en['adminHome.locations.emptyTitle'])).toBeTruthy();
  });

  test('shows an error with retry and loads again on retry', async () => {
    get.mockRejectedValueOnce(new Error('network down'));
    get.mockResolvedValueOnce({ classes: CLASSES });
    const screen = await render(wrap(<LocationsScreen user={USER} />));
    expect(await screen.findByTestId('locations-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('locations-error-retry'));
    expect(await screen.findByTestId('venue-group-0')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('Admin Reports screen', () => {
  test('renders the headline numbers from the real metrics fields', async () => {
    get.mockResolvedValue(METRICS);
    const screen = await render(wrap(<ReportsScreen user={USER} />));

    expect(await screen.findByTestId('reports-figures')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/api/v1/analytics/metrics?period=current_month');

    expect(screen.getByTestId('stat-active-students')).toHaveTextContent(/42/);
    expect(screen.getByTestId('stat-pending-applicants')).toHaveTextContent(/7/);
    expect(screen.getByTestId('stat-active-classes')).toHaveTextContent(/4/);
    expect(screen.getByTestId('stat-trials-booked')).toHaveTextContent(/12/);
    expect(screen.getByTestId('stat-collected')).toHaveTextContent(/RM 5,040\.50/);
    expect(screen.getByTestId('stat-outstanding')).toHaveTextContent(/RM 360\.00/);
    expect(screen.getByTestId('bar-capacity')).toHaveTextContent(/46\.67%/);
    expect(screen.getByTestId('bar-conversion')).toHaveTextContent(/41\.67%/);
    expect(screen.getByTestId('bar-retention')).toHaveTextContent(/93\.33%/);
    expect(screen.getByText('Paused memberships: 3')).toBeTruthy();
    expect(screen.getByText('Approved transfers: 2')).toBeTruthy();
  });

  test('changing the period requests that period', async () => {
    get.mockResolvedValue(METRICS);
    const screen = await render(wrap(<ReportsScreen user={USER} />));
    await screen.findByTestId('reports-figures');

    await fireEvent.press(screen.getByTestId('period-last_90_days'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/analytics/metrics?period=last_90_days'));
    expect(screen.getByTestId('period-last_90_days').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );
  });

  test('MODULE_DISABLED shows the switched-off message, not an error', async () => {
    get.mockRejectedValue(
      new ApiError({
        message: 'This feature is not enabled.',
        status: 404,
        details: { error: 'This feature is not enabled.', code: 'MODULE_DISABLED', module: 'analytics' },
      })
    );
    const screen = await render(wrap(<ReportsScreen user={USER} />));
    expect(await screen.findByTestId('reports-disabled')).toBeTruthy();
    expect(screen.getByText(en['adminHome.reports.disabledTitle'])).toBeTruthy();
    expect(screen.queryByTestId('reports-error')).toBeNull();
  });

  test('other failures show an error with retry', async () => {
    get.mockRejectedValueOnce(new ApiError({ message: 'Database error', status: 500 }));
    get.mockResolvedValueOnce(METRICS);
    const screen = await render(wrap(<ReportsScreen user={USER} />));
    expect(await screen.findByTestId('reports-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reports-error-retry'));
    expect(await screen.findByTestId('reports-figures')).toBeTruthy();
  });

  test('shows the empty state when the academy has no figures yet', async () => {
    get.mockResolvedValue(ZERO_METRICS);
    const screen = await render(wrap(<ReportsScreen user={USER} />));
    expect(await screen.findByTestId('reports-empty')).toBeTruthy();
    expect(screen.queryByTestId('reports-figures')).toBeNull();
  });
});
