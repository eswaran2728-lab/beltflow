/**
 * Super Admin: Persatuan management and platform audit screens (2026-11-22).
 *
 *  - Persatuan list from the real server fields (name, state, status and the
 *    aggregate counts classCount / activeStudentCount / masterCount).
 *  - Search by name; empty and no-match states; error with retry.
 *  - Suspend needs a reason and a confirmation, then sends
 *    PUT /api/v1/organizations/:id/status { status: 'SUSPENDED', reason }.
 *  - Reactivate asks for confirmation and sends status ACTIVE.
 *  - The feature switches (TenantFeaturesPanel) stay reachable.
 *  - Platform audit: 24-hour summary by event type, recent events with ALERT
 *    marked in text, and the platform audit entries; empty states.
 *  - Every new string exists in English, Bahasa Melayu and Tamil.
 * Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { PersatuanManagementScreen, PlatformAuditScreen } from '../screens/roles/superAdmin';
import { DICTIONARIES, LOCALES } from '../i18n';
import { superAdminHomeEn } from '../i18n/locales/modules/superAdminHome';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  apiPath: (p: string) => p,
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

const en = DICTIONARIES.en as Record<string, string>;
const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const superAdmin: AuthUser = { id: 'usr_sa_test', fullName: 'Test Super Admin', email: 'sa@example.test', role: UserRole.SUPER_ADMIN };

const ORGS = [
  { id: 'org_t_a', name: 'Test Persatuan Alpha', state: 'Selangor', status: 'ACTIVE', classCount: 4, activeStudentCount: 37, masterCount: 3, email: 'a@example.test' },
  { id: 'org_t_b', name: 'Test Persatuan Beta', state: 'Johor', status: 'SUSPENDED', classCount: 1, activeStudentCount: 9, masterCount: 1, email: 'b@example.test' },
];

const SECURITY = {
  events: [
    { id: 'sev_1', type: 'ACCOUNT_LOCKED', severity: 'ALERT', client: 'hash_should_not_show', userId: 'usr_x', method: 'POST', path: '/api/v1/auth/login', status: null, detail: 'detail_should_not_show', at: '2026-11-22T08:00:00.000Z' },
    { id: 'sev_2', type: 'LOGIN_FAILED', severity: 'WARN', client: 'hash_should_not_show', userId: null, method: 'POST', path: '/api/v1/auth/login', status: 401, detail: 'unknown account', at: '2026-11-22T07:00:00.000Z' },
  ],
  summary: { last24h: { LOGIN_FAILED: 5, ACCOUNT_LOCKED: 1 }, noisiestClients: [{ client: 'hash_should_not_show', events: 6 }] },
};
const AUDIT = {
  logs: [
    { id: 'audit_1', action: 'Organization Onboarded', details: 'Super Admin created academy: Test Persatuan Alpha', user_role: 'SUPER_ADMIN', user_email: 'sa@example.test', timestamp: '2026-11-20T10:00:00.000Z' },
  ],
};

function mockServer(opts: { orgs?: any[]; security?: any; audit?: any; failOrgs?: boolean } = {}) {
  get.mockImplementation(async (p: string) => {
    if (p === '/api/v1/organizations') {
      if (opts.failOrgs) throw new Error('offline');
      return { organizations: opts.orgs ?? ORGS };
    }
    if (p.startsWith('/api/v1/security/events')) return opts.security ?? SECURITY;
    if (p === '/api/v1/audit') return opts.audit ?? AUDIT;
    if (p.startsWith('/release/tenants/')) return { modules: [] };
    throw new Error('unexpected GET ' + p);
  });
}

const wrap = (node: React.ReactElement) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider defaultMode="light">{node}</ThemeProvider>
  </SafeAreaProvider>
);
const renderManagement = () => wrap(<PersatuanManagementScreen user={superAdmin} onLogout={jest.fn()} />);
const renderAudit = () => wrap(<PlatformAuditScreen user={superAdmin} onLogout={jest.fn()} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockServer();
});

describe('Persatuan management', () => {
  test('lists Persatuans with state, status and aggregate counts from the server fields', async () => {
    const r = await renderManagement();
    expect(await r.findByText('Test Persatuan Alpha')).toBeTruthy();
    expect(r.getByText('Test Persatuan Beta')).toBeTruthy();
    expect(r.getByText('Selangor')).toBeTruthy();
    expect(r.getByTestId('persatuan-classes-org_t_a')).toHaveTextContent('4');
    expect(r.getByTestId('persatuan-students-org_t_a')).toHaveTextContent('37');
    expect(r.getByTestId('persatuan-masters-org_t_a')).toHaveTextContent('3');
    expect(r.getByTestId('persatuan-status-org_t_a')).toHaveTextContent(en['superAdminHome.pm.status.ACTIVE']);
    expect(r.getByTestId('persatuan-status-org_t_b')).toHaveTextContent(en['superAdminHome.pm.status.SUSPENDED']);
    // Active -> Suspend action; suspended -> Reactivate action.
    expect(r.getByTestId('btn-suspend-org_t_a')).toBeTruthy();
    expect(r.queryByTestId('btn-reactivate-org_t_a')).toBeNull();
    expect(r.getByTestId('btn-reactivate-org_t_b')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/api/v1/organizations');
    await act(async () => { await r.unmount(); });
  });

  test('search filters by name and says when nothing matches', async () => {
    const r = await renderManagement();
    await r.findByText('Test Persatuan Alpha');
    await act(async () => { fireEvent.changeText(r.getByTestId('persatuan-search'), 'beta'); });
    expect(r.queryByText('Test Persatuan Alpha')).toBeNull();
    expect(r.getByText('Test Persatuan Beta')).toBeTruthy();
    await act(async () => { fireEvent.changeText(r.getByTestId('persatuan-search'), 'zzz'); });
    expect(r.getByText(en['superAdminHome.pm.noMatch'].replace('{query}', 'zzz'))).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });

  test('suspend requires a reason and a confirmation, then sends the right request', async () => {
    put.mockResolvedValue({ organization: { id: 'org_t_a', name: 'Test Persatuan Alpha', state: 'Selangor', status: 'SUSPENDED' } });
    const r = await renderManagement();
    await r.findByText('Test Persatuan Alpha');

    await act(async () => { fireEvent.press(r.getByTestId('btn-suspend-org_t_a')); });
    // No reason: refused on the phone, no dialog, no request.
    await act(async () => { fireEvent.press(r.getByTestId('btn-suspend-continue-org_t_a')); });
    expect(r.getByText(en['superAdminHome.pm.reasonRequired'])).toBeTruthy();
    expect(r.queryByText(en['superAdminHome.pm.confirmSuspend'])).toBeNull();
    expect(put).not.toHaveBeenCalled();

    await act(async () => { fireEvent.changeText(r.getByTestId('input-suspend-reason-org_t_a'), '  Platform subscription unpaid  '); });
    await act(async () => { fireEvent.press(r.getByTestId('btn-suspend-continue-org_t_a')); });
    // Confirmation dialog: cancelling sends nothing.
    expect(r.getByText(en['superAdminHome.pm.confirmSuspendTitle'].replace('{name}', 'Test Persatuan Alpha'))).toBeTruthy();
    await act(async () => { fireEvent.press(r.getByText(en['superAdminHome.pm.keepActive'])); });
    expect(put).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(r.getByTestId('btn-suspend-continue-org_t_a')); });
    await act(async () => { fireEvent.press(r.getByText(en['superAdminHome.pm.confirmSuspend'])); });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/api/v1/organizations/org_t_a/status', { status: 'SUSPENDED', reason: 'Platform subscription unpaid' });
    await waitFor(() => expect(r.getByTestId('persatuan-status-org_t_a')).toHaveTextContent(en['superAdminHome.pm.status.SUSPENDED']));
    expect(r.getByText(en['superAdminHome.pm.saved.SUSPENDED'].replace('{name}', 'Test Persatuan Alpha'))).toBeTruthy();
    expect(r.getByTestId('btn-reactivate-org_t_a')).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });

  test('reactivate asks for confirmation and sends status ACTIVE', async () => {
    put.mockResolvedValue({ organization: { id: 'org_t_b', status: 'ACTIVE' } });
    const r = await renderManagement();
    await r.findByText('Test Persatuan Beta');
    await act(async () => { fireEvent.press(r.getByTestId('btn-reactivate-org_t_b')); });
    expect(put).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(r.getByText(en['superAdminHome.pm.confirmReactivate'])); });
    expect(put).toHaveBeenCalledWith('/api/v1/organizations/org_t_b/status', { status: 'ACTIVE', reason: '' });
    await waitFor(() => expect(r.getByTestId('persatuan-status-org_t_b')).toHaveTextContent(en['superAdminHome.pm.status.ACTIVE']));
    await act(async () => { await r.unmount(); });
  });

  test('a failed status change keeps the old status and says so', async () => {
    put.mockRejectedValue(new Error('offline'));
    const r = await renderManagement();
    await r.findByText('Test Persatuan Beta');
    await act(async () => { fireEvent.press(r.getByTestId('btn-reactivate-org_t_b')); });
    await act(async () => { fireEvent.press(r.getByText(en['superAdminHome.pm.confirmReactivate'])); });
    expect(await r.findByText(en['superAdminHome.pm.saveError'])).toBeTruthy();
    expect(r.getByTestId('persatuan-status-org_t_b')).toHaveTextContent(en['superAdminHome.pm.status.SUSPENDED']);
    await act(async () => { await r.unmount(); });
  });

  test('empty list shows the empty state, never made-up Persatuans', async () => {
    mockServer({ orgs: [] });
    const r = await renderManagement();
    expect(await r.findByText(en['superAdminHome.pm.empty'])).toBeTruthy();
    expect(r.queryByTestId(/^persatuan-row-/)).toBeNull();
    await act(async () => { await r.unmount(); });
  });

  test('load error offers retry', async () => {
    mockServer({ failOrgs: true });
    const r = await renderManagement();
    expect(await r.findByText(en['superAdminHome.pm.loadError'])).toBeTruthy();
    mockServer();
    await act(async () => { fireEvent.press(r.getByTestId('persatuan-list-error-retry')); });
    expect(await r.findByText('Test Persatuan Alpha')).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });

  test('feature switches stay reachable', async () => {
    const r = await renderManagement();
    await r.findByText('Test Persatuan Alpha');
    await act(async () => { fireEvent.press(r.getByTestId('persatuan-section-features')); });
    expect(await r.findByTestId('tenant-features-panel')).toBeTruthy();
    expect(await r.findByTestId('tenant-features-org-org_t_a')).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });
});

describe('Platform audit', () => {
  test('shows the 24-hour summary, recent events with ALERT marked in text, and audit entries', async () => {
    const r = await renderAudit();
    expect(await r.findByTestId('security-summary-count-LOGIN_FAILED')).toHaveTextContent('5');
    expect(r.getByTestId('security-summary-count-ACCOUNT_LOCKED')).toHaveTextContent('1');
    expect(r.getByTestId('security-summary-LOGIN_FAILED')).toHaveTextContent(en['superAdminHome.pa.type.LOGIN_FAILED'], { exact: false });
    expect(r.getByText(en['superAdminHome.pa.summaryTotal'].replace('{count}', '6'))).toBeTruthy();

    // ALERT: text marker, not colour alone.
    expect(r.getByTestId('security-event-alert-sev_1')).toHaveTextContent(en['superAdminHome.pa.alertMarker']);
    expect(r.queryByTestId('security-event-alert-sev_2')).toBeNull();
    expect(r.getByTestId('security-event-sev_2')).toHaveTextContent(en['superAdminHome.pa.severity.WARN'], { exact: false });
    expect(r.getAllByText('POST /api/v1/auth/login').length).toBe(2);
    expect(r.getByText(en['superAdminHome.pa.alertCount'].replace('{count}', '1'))).toBeTruthy();

    // Never client hashes, user ids or event detail text.
    expect(r.queryByText(/hash_should_not_show/)).toBeNull();
    expect(r.queryByText(/detail_should_not_show/)).toBeNull();

    expect(r.getByText('Organization Onboarded')).toBeTruthy();
    expect(r.getByText('Super Admin created academy: Test Persatuan Alpha')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/api/v1/audit');
    expect(get.mock.calls.some(([p]) => String(p).startsWith('/api/v1/security/events'))).toBe(true);
    await act(async () => { await r.unmount(); });
  });

  test('empty states for summary, events and audit entries', async () => {
    mockServer({ security: { events: [], summary: { last24h: {}, noisiestClients: [] } }, audit: { logs: [] } });
    const r = await renderAudit();
    expect(await r.findByText(en['superAdminHome.pa.summaryEmpty'])).toBeTruthy();
    expect(r.getByText(en['superAdminHome.pa.eventsEmpty'])).toBeTruthy();
    expect(r.getByText(en['superAdminHome.pa.auditEmpty'])).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });

  test('a failed load shows an error with retry', async () => {
    get.mockRejectedValue(new Error('offline'));
    const r = await renderAudit();
    expect(await r.findByText(en['superAdminHome.pa.loadError'])).toBeTruthy();
    mockServer();
    await act(async () => { fireEvent.press(r.getByTestId('platform-audit-error-retry')); });
    expect(await r.findByText('Organization Onboarded')).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });
});

test('every new Super Admin string exists in all three languages, with Tamil in Tamil script', () => {
  const keys = Object.keys(superAdminHomeEn).filter(k => /^superAdminHome\.(pm|pa)\./.test(k));
  expect(keys.length).toBeGreaterThan(40);
  for (const locale of LOCALES) {
    const dict = DICTIONARIES[locale] as Record<string, string>;
    for (const key of keys) expect({ locale, key, ok: typeof dict[key] === 'string' && dict[key].length > 0 }).toEqual({ locale, key, ok: true });
  }
  const ta = DICTIONARIES.ta as Record<string, string>;
  for (const key of keys) {
    expect({ key, tamil: /[஀-௿]/.test(ta[key]) }).toEqual({ key, tamil: true });
    expect({ key, clean: /^[஀-௿\x20-\x7E–—‘’“”•…]*$/.test(ta[key]) }).toEqual({ key, clean: true });
  }
});
