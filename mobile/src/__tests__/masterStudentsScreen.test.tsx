/**
 * Master > Students: the Master's own classes and their rosters.
 *  - Classes come from /classes/organization/:orgId (the server returns only
 *    the Master's assigned classes).
 *  - The roster comes from /classes/:classId/students with a name search.
 *  - Identity card numbers are never shown on this screen.
 *  - Empty and error states; no made-up data.
 * Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider } from '../i18n';
import { apiClient } from '../services/apiClient';
import { StudentsScreen } from '../screens/roles/master';
import { AuthUser, UserRole } from '../types/auth';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(),
}));

const get = apiClient.get as jest.Mock;
const master: AuthUser = {
  id: 'usr_test_master', email: 'test.master@example.test', fullName: 'Test Master', role: UserRole.MASTER,
  organizationId: 'org_test', assignedClassIds: ['cls_a', 'cls_b'],
} as AuthUser;

const CLASSES = { classes: [
  { id: 'cls_a', name: 'Test Junior Class', schedule: 'Sat 9:00', location: 'Test Hall' },
  { id: 'cls_b', name: 'Test Senior Class', schedule: 'Sun 10:00', location: 'Test Hall' },
] };
const roster = (cls: string) => ({
  students: cls === 'cls_a'
    ? [
        { id: 'stu_1', full_name: 'Test Student One', belt_rank: 'Yellow Belt', group_name: 'Beginners', student_status: 'ACTIVE', enrollment_status: 'ACTIVE', ic_number: '******-**-1234' },
        { id: 'stu_2', full_name: 'Test Student Two', belt_rank: 'White Belt', group_name: null, student_status: 'PAUSED', enrollment_status: 'ACTIVE', ic_number: '******-**-5678' },
      ]
    : [],
  pagination: { total: cls === 'cls_a' ? 2 : 0, limit: 50, offset: 0 },
});

function mockServer() {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/classes/organization/org_test') return CLASSES;
    const m = path.match(/^\/api\/v1\/classes\/(cls_[ab])\/students/);
    if (m) return roster(m[1]);
    throw new Error('unexpected GET ' + path);
  });
}

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider defaultMode="light">
        <I18nProvider>
          <StudentsScreen user={master} />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

describe('Master > Students', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows the first class roster with belts and status, and never the IC number', async () => {
    mockServer();
    const screen = await renderScreen();
    expect(await screen.findByText('Test Student One')).toBeTruthy();
    expect(screen.getByText('Test Student Two')).toBeTruthy();
    expect(screen.getByText('Yellow Belt')).toBeTruthy();
    expect(screen.getByTestId('roster-status-stu_2')).toBeTruthy();
    expect(screen.queryByText(/1234|5678/)).toBeNull();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/v1\/classes\/cls_a\/students\?/));
  });

  test('switching class loads that roster; an empty class shows the empty state', async () => {
    mockServer();
    const screen = await renderScreen();
    await screen.findByText('Test Student One');
    await fireEvent.press(screen.getByTestId('roster-class-cls_b'));
    expect(await screen.findByTestId('roster-empty')).toBeTruthy();
    expect(screen.queryByText('Test Student One')).toBeNull();
  });

  test('search sends the name to the server', async () => {
    mockServer();
    const screen = await renderScreen();
    await screen.findByText('Test Student One');
    await fireEvent.changeText(screen.getByTestId('input-roster-search'), 'One');
    await fireEvent(screen.getByTestId('input-roster-search'), 'submitEditing');
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('search=One')));
  });

  test('a Master with no classes sees an explanation, not an error', async () => {
    get.mockImplementation(async (path: string) => (path.includes('/organization/') ? { classes: [] } : { students: [], pagination: { total: 0 } }));
    const screen = await renderScreen();
    expect(await screen.findByTestId('roster-no-classes')).toBeTruthy();
  });

  test('a failed load offers a retry', async () => {
    get.mockRejectedValue(new Error('offline'));
    const screen = await renderScreen();
    expect(await screen.findByTestId('roster-error')).toBeTruthy();
  });
});
