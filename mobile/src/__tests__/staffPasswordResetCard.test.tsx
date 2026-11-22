/**
 * Staff side of password reset (2026-11-22): an Admin or Super Admin creates a
 * one-time code by the member's e-mail. Refusals reveal nothing; other roles
 * never see the card. Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider } from '../i18n';
import { apiClient, ApiError } from '../services/apiClient';
import { StaffPasswordResetCard } from '../components/StaffPasswordResetCard';

jest.mock('../services/apiClient', () => {
  const actual = jest.requireActual('../services/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() }, onUnauthorizedResponse: jest.fn() };
});
const post = apiClient.post as jest.Mock;
const renderIt = (role: string) =>
  render(<ThemeProvider defaultMode="light"><I18nProvider><StaffPasswordResetCard role={role} /></I18nProvider></ThemeProvider>);

describe('Staff password reset card', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates a code by e-mail and shows it once', async () => {
    post.mockResolvedValue({ code: 'ABCD-EFGH-JKMN', expiresAt: '2026-11-22T10:30:00.000Z' });
    const screen = await renderIt('ADMIN_PERSATUAN');
    await fireEvent.changeText(screen.getByTestId('input-issue-email'), 'test.parent@example.test');
    await fireEvent.press(screen.getByTestId('btn-issue-submit'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/auth/password-reset/issue', { email: 'test.parent@example.test' }));
    expect(await screen.findByText('ABCD-EFGH-JKMN')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('btn-issue-done'));
    expect(screen.queryByText('ABCD-EFGH-JKMN')).toBeNull();
  });

  test('a refusal shows a neutral message', async () => {
    post.mockRejectedValue(new ApiError({ message: 'no', status: 403 }));
    const screen = await renderIt('SUPER_ADMIN');
    await fireEvent.changeText(screen.getByTestId('input-issue-email'), 'nobody@example.test');
    await fireEvent.press(screen.getByTestId('btn-issue-submit'));
    expect(await screen.findByTestId('issue-error')).toBeTruthy();
  });

  test('other roles never see it', async () => {
    for (const role of ['MASTER', 'PARENT', 'STUDENT']) {
      const screen = await renderIt(role);
      expect(screen.queryByTestId('staff-password-reset')).toBeNull();
      screen.unmount();
    }
  });
});
