/**
 * In-app notification inbox (server: notification_outbox -> user_notifications).
 * The home bell shows a dot only for real unread notifications, opens the
 * inbox, and marks items read. Text comes from event type + safe params in
 * the app language; unknown events and missing values never show raw keys.
 * Synthetic test data only.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { ParentNavigator } from '../navigation/roleNavigators/ParentNavigator';
import { apiClient } from '../services/apiClient';
import { releaseService } from '../services/releaseService';
import { clearDashboardCache } from '../services/dashboardService';
import { DICTIONARIES, LOCALES, translate } from '../i18n';
import { notificationText } from '../components/NotificationsInbox';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(),
}));
jest.mock('../services/releaseService', () => ({ releaseService: { getReleaseModules: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { onSessionEnded: jest.fn(() => () => undefined) } }));

// Every event type the server writes to notification_outbox (server/src/services/notifications/deliver.ts).
const SERVER_EVENT_TYPES = [
  'WaitlistOfferAvailable', 'ClassSubmitted', 'ClassInformationRequested', 'ClassRejected', 'ClassApproved',
  'BeltPromotionAwarded', 'ClassHandoverRequested', 'ClassHandoverCompleted', 'MasterApproved',
  'MasterInformationRequested', 'MasterRejected', 'ParentMasterMessageReceived', 'PAYMENT_SETTLED',
  'MembershipPauseRequested', 'MembershipPauseApproved', 'MembershipResumed', 'ClassTransferRequested',
  'ClassTransferApproved', 'StudentEnrollmentApproved', 'StudentEnrollmentInformationRequested',
  'StudentEnrollmentRejected', 'StudentEnrollmentWaitlisted',
];

describe('notification text', () => {
  test.each(LOCALES)('every server event type has a title and body (%s)', locale => {
    const dict = DICTIONARIES[locale] as Record<string, string>;
    for (const type of SERVER_EVENT_TYPES) {
      expect(dict[`notifications.${type}.title`]).toBeTruthy();
      expect(dict[`notifications.${type}.body`]).toBeTruthy();
    }
  });

  test.each(LOCALES)('text never shows a raw key or placeholder (%s)', locale => {
    const t = (k: string, p?: Record<string, string | number>) => translate(locale, k, p);
    const known = notificationText(t, { eventType: 'BeltPromotionAwarded', params: { studentName: 'Test Child', newBelt: 'Yellow Belt' } });
    expect(known.body).toContain('Test Child');
    expect(known.body).toContain('Yellow Belt');
    const missing = notificationText(t, { eventType: 'BeltPromotionAwarded', params: {} });
    expect(missing.body).not.toMatch(/\{\w+\}/);
    const unknown = notificationText(t, { eventType: 'SomethingNew', params: {} });
    expect(unknown.title).toBe(translate(locale, 'notifications.generic.title'));
    for (const text of [known.title, known.body, unknown.title, unknown.body]) expect(text).not.toMatch(/^notifications\./);
  });
});

const parentUser: AuthUser = {
  id: 'usr_parent_test', fullName: 'Test Parent', email: 'parent@example.test', role: UserRole.PARENT,
  organizationId: 'org_test', linkedStudentIds: ['stu_test_01'],
};
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const NOTIFICATIONS = [
  { id: 'unt_1', eventType: 'BeltPromotionAwarded', params: { studentName: 'Test Child', newBelt: 'Yellow Belt' }, read: false, createdAt: '2026-11-12T10:00:00Z' },
  { id: 'unt_2', eventType: 'PAYMENT_SETTLED', params: { amountRM: '80.00', receiptNo: 'REC-TEST-1' }, read: false, createdAt: '2026-11-12T09:00:00Z' },
  { id: 'unt_3', eventType: 'StudentEnrollmentApproved', params: { studentName: 'Test Child', className: 'Test Class' }, read: true, createdAt: '2026-11-11T09:00:00Z' },
];

function mockApi(notifications: any) {
  (apiClient.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/notifications') return notifications instanceof Error ? Promise.reject(notifications) : Promise.resolve(notifications);
    if (path === '/api/v1/students/stu_test_01') {
      return Promise.resolve({ student: { id: 'stu_test_01', full_name: 'Test Child', belt_rank: 'Yellow Belt', organization_id: 'org_test', class_id: 'cls_1', monthly_fee: 100, status: 'ACTIVE' } });
    }
    if (path.includes('/monthly-dues/')) return Promise.resolve({ total_pending: 0, months_pending_count: 0, dues: [] });
    if (path.includes('/attendance')) return Promise.resolve({ attendance: [] });
    if (path.includes('/sessions')) return Promise.resolve({ sessions: [] });
    if (path.includes('/certificates')) return Promise.resolve({ certificates: [] });
    if (path.includes('/notices')) return Promise.resolve({ notices: [{ id: 'n1', message: 'Test notice' }] });
    return Promise.resolve({});
  });
  (apiClient.post as jest.Mock).mockResolvedValue({});
}

async function renderParent() {
  const utils = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider defaultMode="light">
        <ParentNavigator user={parentUser} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  await act(async () => { await Promise.resolve(); });
  return utils;
}

const en = DICTIONARIES.en as Record<string, string>;

describe('parent home bell and inbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDashboardCache();
    (releaseService.getReleaseModules as jest.Mock).mockResolvedValue({ release: 'R4', enabledModules: [] });
  });

  test('the dot shows only for real unread notifications; the inbox lists them and marks them read', async () => {
    mockApi({ unreadCount: 2, notifications: NOTIFICATIONS });
    const r = await renderParent();
    await waitFor(() => expect(r.getByTestId('bell-unread-dot')).toBeTruthy());
    expect(r.getByTestId('header-bell-btn').props.accessibilityLabel).toBe('Notifications, 2 unread');

    await act(async () => { fireEvent.press(r.getByTestId('header-bell-btn')); });
    expect(await r.findByTestId('notifications-inbox')).toBeTruthy();
    expect(r.getByText('Test Child was promoted to Yellow Belt.')).toBeTruthy();
    expect(r.getByText('RM 80.00 received. Receipt REC-TEST-1.')).toBeTruthy();
    expect(r.getByTestId('notification-unread-unt_1')).toBeTruthy();
    expect(r.queryByTestId('notification-unread-unt_3')).toBeNull();

    await act(async () => { fireEvent.press(r.getByTestId('notification-unt_1')); });
    expect(apiClient.post).toHaveBeenCalledWith('/notifications/unt_1/read', {});
    expect(r.queryByTestId('notification-unread-unt_1')).toBeNull();

    await act(async () => { fireEvent.press(r.getByTestId('notifications-mark-all')); });
    expect(apiClient.post).toHaveBeenCalledWith('/notifications/read-all', {});
    await act(async () => { fireEvent.press(r.getByTestId('notifications-close')); });
    // Re-fetch after opening returned the same mock; mark-all cleared the count locally.
    mockApi({ unreadCount: 0, notifications: NOTIFICATIONS.map(n => ({ ...n, read: true })) });
    await waitFor(() => expect(r.queryByTestId('bell-unread-dot')).toBeNull());
    await act(async () => { await r.unmount(); });
  });

  test('notices alone no longer light the dot, and an inbox failure is quiet', async () => {
    mockApi(new Error('offline'));
    const r = await renderParent();
    await waitFor(() => expect(r.getByTestId('parent-home-screen')).toBeTruthy());
    await act(async () => { await Promise.resolve(); });
    expect(r.queryByTestId('bell-unread-dot')).toBeNull();
    await act(async () => { fireEvent.press(r.getByTestId('header-bell-btn')); });
    expect(await r.findByText(en['notifications.loadError'])).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });
});
