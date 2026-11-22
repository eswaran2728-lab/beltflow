/**
 * Staff side of data requests (Malaysia PDPA), 2026-11-22.
 *  - An Admin or Super Admin sees the requests the server says they handle,
 *    oldest due first, with overdue ones marked.
 *  - "Mark as done" sends COMPLETE; a deletion asks for confirmation first.
 *  - "Refuse" needs a reason before anything is sent.
 *  - Parents, Masters and Students never see this section.
 * Synthetic data only.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider } from '../i18n';
import { apiClient } from '../services/apiClient';
import { StaffPrivacyRequests } from '../components/StaffPrivacyRequests';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(),
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const REQUESTS = { requests: [
  { id: 'dr_del', type: 'DELETE', status: 'OPEN', details: null, createdAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-10-22T00:00:00.000Z',
    overdue: true, requester: { name: 'Test Parent', email: 'test.parent@example.test', role: 'PARENT' } },
  { id: 'dr_fix', type: 'CORRECT', status: 'OPEN', details: 'Spelling of my name', createdAt: '2026-11-20T00:00:00.000Z', dueAt: '2026-12-11T00:00:00.000Z',
    overdue: false, requester: { name: 'Test Student', email: 'test.student@example.test', role: 'STUDENT' } },
  { id: 'dr_old', type: 'WITHDRAW_CONSENT', status: 'COMPLETED', details: null, createdAt: '2026-09-01T00:00:00.000Z', dueAt: '2026-09-22T00:00:00.000Z',
    resolvedAt: '2026-09-05T00:00:00.000Z', resolutionNote: 'Done', overdue: false, requester: { name: 'Test Master', email: 'test.master@example.test', role: 'MASTER' } },
] };

const renderIt = (role: string) =>
  render(
    <ThemeProvider defaultMode="light">
      <I18nProvider>
        <StaffPrivacyRequests role={role} />
      </I18nProvider>
    </ThemeProvider>
  );

describe('Staff privacy requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockImplementation(async (path: string) => {
      if (path === '/privacy/requests') return REQUESTS;
      throw new Error('unexpected GET ' + path);
    });
    post.mockResolvedValue({ message: 'ok' });
  });

  test('lists the requests with requester, type and an overdue mark', async () => {
    const screen = await renderIt('ADMIN_PERSATUAN');
    expect(await screen.findByText('Test Parent')).toBeTruthy();
    expect(screen.getByText('Test Student')).toBeTruthy();
    expect(screen.getByTestId('staff-privacy-overdue-dr_del')).toBeTruthy();
    expect(screen.queryByTestId('staff-privacy-overdue-dr_fix')).toBeNull();
    // A finished request has no action buttons.
    expect(screen.queryByTestId('btn-staff-privacy-complete-dr_old')).toBeNull();
  });

  test('completing a correction sends COMPLETE with the note', async () => {
    const screen = await renderIt('ADMIN_PERSATUAN');
    await screen.findByText('Test Student');
    await fireEvent.changeText(screen.getByTestId('input-staff-privacy-note-dr_fix'), 'Name corrected');
    await fireEvent.press(screen.getByTestId('btn-staff-privacy-complete-dr_fix'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/privacy/requests/dr_fix/resolve', { action: 'COMPLETE', note: 'Name corrected' }));
  });

  test('completing a deletion asks for confirmation first', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = await renderIt('SUPER_ADMIN');
    await screen.findByText('Test Parent');
    await fireEvent.press(screen.getByTestId('btn-staff-privacy-complete-dr_del'));
    expect(post).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as { onPress?: () => void }[];
    await buttons[1].onPress?.();
    await waitFor(() => expect(post).toHaveBeenCalledWith('/privacy/requests/dr_del/resolve', { action: 'COMPLETE' }));
    alert.mockRestore();
  });

  test('refusing without a reason sends nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = await renderIt('ADMIN_PERSATUAN');
    await screen.findByText('Test Student');
    await fireEvent.press(screen.getByTestId('btn-staff-privacy-refuse-dr_fix'));
    expect(post).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('input-staff-privacy-note-dr_fix'), 'We need proof of the spelling');
    await fireEvent.press(screen.getByTestId('btn-staff-privacy-refuse-dr_fix'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/privacy/requests/dr_fix/resolve', { action: 'REJECT', note: 'We need proof of the spelling' }));
    alert.mockRestore();
  });

  test('other roles see nothing and make no request', async () => {
    for (const role of ['PARENT', 'MASTER', 'STUDENT']) {
      const screen = await renderIt(role);
      expect(screen.queryByTestId('staff-privacy-requests')).toBeNull();
      screen.unmount();
    }
    expect(get).not.toHaveBeenCalled();
  });
});
