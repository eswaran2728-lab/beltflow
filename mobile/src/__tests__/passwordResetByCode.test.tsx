/**
 * Password reset with a code from the academy (2026-11-22).
 *  - The administrator gives the person a one-time code; the person enters
 *    e-mail, code and a new password on the phone.
 *  - The app checks length (12+) and that both passwords match before sending.
 *  - A wrong or expired code shows one message that reveals nothing about
 *    whether the account exists.
 * Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider } from '../i18n';
import { apiClient, ApiError } from '../services/apiClient';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

jest.mock('../services/apiClient', () => {
  const actual = jest.requireActual('../services/apiClient');
  return {
    ...actual,
    apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
    onUnauthorizedResponse: jest.fn(),
  };
});

const post = apiClient.post as jest.Mock;

const renderIt = () =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider defaultMode="light">
        <I18nProvider>
          <ForgotPasswordScreen onBack={jest.fn()} />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

async function fill(screen: any, values: { email?: string; code?: string; pw?: string; confirm?: string }) {
  if (values.email !== undefined) await fireEvent.changeText(screen.getByTestId('input-reset-email'), values.email);
  if (values.code !== undefined) await fireEvent.changeText(screen.getByTestId('input-reset-code'), values.code);
  if (values.pw !== undefined) await fireEvent.changeText(screen.getByTestId('input-reset-password'), values.pw);
  if (values.confirm !== undefined) await fireEvent.changeText(screen.getByTestId('input-reset-confirm'), values.confirm);
}

describe('Password reset by code', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends e-mail, code and new password, then shows success', async () => {
    post.mockResolvedValue({ message: 'ok' });
    const screen = await renderIt();
    await fill(screen, { email: ' test.parent@example.test ', code: 'abcd-efgh-jkmn', pw: 'a-long-test-password', confirm: 'a-long-test-password' });
    await fireEvent.press(screen.getByTestId('btn-reset-submit'));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/v1/auth/password-reset/complete', {
        email: 'test.parent@example.test', code: 'ABCD-EFGH-JKMN', newPassword: 'a-long-test-password',
      })
    );
    expect(await screen.findByTestId('reset-success')).toBeTruthy();
  });

  test('a short password or a mismatch is caught before sending', async () => {
    const screen = await renderIt();
    await fill(screen, { email: 'test.parent@example.test', code: 'ABCD-EFGH-JKMN', pw: 'short', confirm: 'short' });
    await fireEvent.press(screen.getByTestId('btn-reset-submit'));
    expect(screen.getByTestId('reset-error')).toBeTruthy();
    await fill(screen, { pw: 'a-long-test-password', confirm: 'a-different-password' });
    await fireEvent.press(screen.getByTestId('btn-reset-submit'));
    expect(screen.getByTestId('reset-error')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  test('a wrong code shows one neutral message', async () => {
    post.mockRejectedValue(new ApiError({ message: 'The reset code is wrong or has expired.', status: 400 }));
    const screen = await renderIt();
    await fill(screen, { email: 'nobody@example.test', code: 'ABCD-EFGH-JKMN', pw: 'a-long-test-password', confirm: 'a-long-test-password' });
    await fireEvent.press(screen.getByTestId('btn-reset-submit'));
    expect(await screen.findByTestId('reset-error')).toBeTruthy();
    expect(screen.queryByTestId('reset-success')).toBeNull();
  });
});
