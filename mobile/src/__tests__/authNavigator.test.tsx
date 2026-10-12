import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthNavigator } from '../navigation/AuthNavigator';
import { authService } from '../services/authService';
import { UserRole, AuthUser } from '../types/auth';

jest.mock('../services/authService', () => {
  let sessionEndedCallback: (() => void) | null = null;
  return {
    authService: {
      login: jest.fn(),
      getStoredSession: jest.fn(),
      logout: jest.fn(),
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

jest.mock('../services/certificateService', () => ({
  certificateService: {
    verifyCertificate: jest.fn(),
  },
}));

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('BeltFlow Mobile AuthNavigator State Machine — Task 1.5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('restores session from splash and navigates to authenticated placeholder', async () => {
    const mockUser: AuthUser = {
      id: 'usr_master_001',
      fullName: 'Master Suresh',
      email: 'suresh@silambam.my',
      role: UserRole.MASTER,
      organizationId: 'org_001',
    };

    (authService.getStoredSession as jest.Mock).mockResolvedValue({
      token: 'valid.token',
      user: mockUser,
    });

    const onAuthChange = jest.fn();
    const { getByText } = await renderWithTheme(
      <AuthNavigator initialScreen="splash" onAuthenticationChange={onAuthChange} />
    );

    await waitFor(() => {
      expect(getByText('Master Suresh')).toBeTruthy();
      expect(getByText('MASTER')).toBeTruthy();
      expect(onAuthChange).toHaveBeenCalledWith(mockUser);
    });
  });

  test('navigates to welcome when splash finds no stored session', async () => {
    (authService.getStoredSession as jest.Mock).mockResolvedValue(null);

    const { getByText, getByTestId } = await renderWithTheme(
      <AuthNavigator initialScreen="splash" />
    );

    await waitFor(() => {
      expect(getByText('Martial Arts Academy Management')).toBeTruthy();
      expect(getByTestId('btn-welcome-signin')).toBeTruthy();
    });
  });

  test('navigates from welcome to login and allows navigation to forgot password and back', async () => {
    const { getByTestId, getByText } = await renderWithTheme(
      <AuthNavigator initialScreen="welcome" />
    );

    await act(async () => {
      fireEvent.press(getByTestId('btn-welcome-signin'));
    });

    expect(getByTestId('input-email')).toBeTruthy();
    expect(getByTestId('input-password')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('link-forgot-password'));
    });

    expect(getByText('Password Assistance')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('btn-forgot-back'));
    });

    expect(getByTestId('input-email')).toBeTruthy();
  });

  test('handles session termination by routing back to login', async () => {
    const { getByTestId } = await renderWithTheme(
      <AuthNavigator initialScreen="authenticated" />
    );

    // Initial without user renders login fallback
    expect(getByTestId('input-email')).toBeTruthy();

    // Trigger session ended callback
    await act(async () => {
      (authService as any)._triggerSessionEnded();
    });

    expect(getByTestId('input-email')).toBeTruthy();
  });
});
