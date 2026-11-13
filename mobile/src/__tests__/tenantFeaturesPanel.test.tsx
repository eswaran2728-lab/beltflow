/**
 * Super Admin: features by Persatuan (per-tenant rollout). Lists Persatuans,
 * shows each optional module's setting and whether it is available to that
 * Persatuan, saves ON / OFF / platform default, and explains when the
 * platform itself has a module off. Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { PersatuanManagementScreen } from '../screens/roles/superAdmin';
import { DICTIONARIES } from '../i18n';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  apiPath: (p: string) => p,
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

const en = DICTIONARIES.en as Record<string, string>;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const superAdmin: AuthUser = { id: 'usr_sa_test', fullName: 'Test Super Admin', email: 'sa@example.test', role: UserRole.SUPER_ADMIN };

const modules = (messagingSetting: string) => ({
  organizationId: 'org_test_a',
  modules: [
    { key: 'messaging', title: 'Parent-Master messaging', release: 'R3', platformEnabled: true, setting: messagingSetting, effective: messagingSetting !== 'OFF' },
    { key: 'assistant', title: 'Role-aware AI assistant', release: 'R4', platformEnabled: false, setting: 'INHERIT', effective: false },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/api/v1/organizations') return Promise.resolve({ organizations: [
      { id: 'org_test_a', name: 'Test Persatuan A', state: 'Selangor', status: 'ACTIVE' },
      { id: 'org_test_b', name: 'Test Persatuan B', state: 'Johor', status: 'ACTIVE' },
    ] });
    if (path === '/release/tenants/org_test_a/modules') return Promise.resolve(modules('INHERIT'));
    return Promise.resolve({});
  });
  (apiClient.put as jest.Mock).mockResolvedValue({ organizationId: 'org_test_a', key: 'messaging', setting: 'OFF', effective: false });
});

const renderScreen = () => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider defaultMode="light">
      <PersatuanManagementScreen user={superAdmin} onLogout={jest.fn()} />
    </ThemeProvider>
  </SafeAreaProvider>
);

test('lists Persatuans, shows module settings and saves a change for one Persatuan', async () => {
  const r = await renderScreen();
  expect(await r.findByText('Test Persatuan A')).toBeTruthy();
  expect(r.getByText('Test Persatuan B')).toBeTruthy();

  await act(async () => { fireEvent.press(r.getByTestId('tenant-features-org-org_test_a')); });
  expect(await r.findByText(en['superAdminHome.module.messaging'])).toBeTruthy();
  expect(r.getByTestId('tenant-module-messaging-INHERIT').props.accessibilityState.selected).toBe(true);
  expect(r.getByTestId('tenant-module-messaging-status')).toHaveTextContent(en['superAdminHome.features.effectiveOn']);

  (apiClient.get as jest.Mock).mockImplementation((path: string) =>
    path === '/release/tenants/org_test_a/modules' ? Promise.resolve(modules('OFF')) : Promise.resolve({ organizations: [] }));
  await act(async () => { fireEvent.press(r.getByTestId('tenant-module-messaging-OFF')); });
  expect(apiClient.put).toHaveBeenCalledWith('/release/tenants/org_test_a/modules/messaging', { setting: 'OFF' });
  await waitFor(() => expect(r.getByTestId('tenant-module-messaging-OFF').props.accessibilityState.selected).toBe(true));
  expect(r.getByTestId('tenant-module-messaging-status')).toHaveTextContent(en['superAdminHome.features.effectiveOff']);
  await act(async () => { await r.unmount(); });
});

test('a module the platform has off explains why and cannot be changed', async () => {
  const r = await renderScreen();
  await act(async () => { fireEvent.press(await r.findByTestId('tenant-features-org-org_test_a')); });
  expect(await r.findByText(en['superAdminHome.features.platformOff'])).toBeTruthy();
  expect(r.getByTestId('tenant-module-assistant-ON').props.accessibilityState.disabled).toBe(true);
  await act(async () => { fireEvent.press(r.getByTestId('tenant-module-assistant-ON')); });
  expect(apiClient.put).not.toHaveBeenCalled();
  await act(async () => { await r.unmount(); });
});

test('a failed save keeps the old setting and says so', async () => {
  (apiClient.put as jest.Mock).mockRejectedValue(new Error('offline'));
  const r = await renderScreen();
  await act(async () => { fireEvent.press(await r.findByTestId('tenant-features-org-org_test_a')); });
  await r.findByText(en['superAdminHome.module.messaging']);
  await act(async () => { fireEvent.press(r.getByTestId('tenant-module-messaging-OFF')); });
  expect(await r.findByText(en['superAdminHome.features.saveError'])).toBeTruthy();
  expect(r.getByTestId('tenant-module-messaging-INHERIT').props.accessibilityState.selected).toBe(true);
  await act(async () => { await r.unmount(); });
});
