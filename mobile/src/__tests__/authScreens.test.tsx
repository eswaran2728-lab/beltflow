import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { VerifyCertificateScreen } from '../screens/auth/VerifyCertificateScreen';
import { AuthenticatedPlaceholderScreen } from '../screens/auth/AuthenticatedPlaceholderScreen';
import { authService } from '../services/authService';
import { certificateService } from '../services/certificateService';
import { UserRole, AuthUser } from '../types/auth';
import { ApiError } from '../services/apiClient';

// Mock authService and certificateService
jest.mock('../services/authService', () => ({
  authService: {
    login: jest.fn(),
    getStoredSession: jest.fn(),
    logout: jest.fn(),
    onSessionEnded: jest.fn(() => jest.fn()),
  },
}));

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

describe('BeltFlow Mobile Authentication Screens — Task 1.5 (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. LoginScreen', () => {
    test('renders email and password inputs with sign in button', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <LoginScreen onLoginSuccess={jest.fn()} />
      );

      expect(getByTestId('input-email')).toBeTruthy();
      expect(getByTestId('input-password')).toBeTruthy();
      expect(getByText('Sign In')).toBeTruthy();
    });

    test('validates required fields before submitting', async () => {
      const { getByText } = await renderWithTheme(
        <LoginScreen onLoginSuccess={jest.fn()} />
      );

      fireEvent.press(getByText('Sign In'));

      await waitFor(() => {
        expect(getByText('Please enter your email address')).toBeTruthy();
      });

      expect(authService.login).not.toHaveBeenCalled();
    });

    test('validates email format', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <LoginScreen onLoginSuccess={jest.fn()} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-email'), 'invalid-email-format');
        fireEvent.changeText(getByTestId('input-password'), 'password123');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-login-submit'));
      });

      await waitFor(() => {
        expect(getByText('Please enter a valid email address')).toBeTruthy();
      });

      expect(authService.login).not.toHaveBeenCalled();
    });

    test('submits valid credentials and calls onLoginSuccess with verified role', async () => {
      const mockSuccessUser: AuthUser = {
        id: 'usr_master_001',
        fullName: 'Master Suresh',
        email: 'master@silambam.my',
        role: UserRole.MASTER,
        organizationId: 'org_001',
      };

      (authService.login as jest.Mock).mockResolvedValue({
        message: 'Authentication successful.',
        token: 'valid.mock.token',
        user: mockSuccessUser,
      });

      const onSuccess = jest.fn();
      const { getByTestId } = await renderWithTheme(
        <LoginScreen onLoginSuccess={onSuccess} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-email'), 'master@silambam.my');
        fireEvent.changeText(getByTestId('input-password'), 'SecretPass123!');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-login-submit'));
      });

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email: 'master@silambam.my',
          password: 'SecretPass123!',
        });
        expect(onSuccess).toHaveBeenCalledWith(mockSuccessUser);
      });
    });

    test('displays error message on invalid credentials (401)', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new ApiError({
          message: 'Invalid email or password.',
          status: 401,
          isUnauthorized: true,
        })
      );

      const { getByTestId, getByText } = await renderWithTheme(
        <LoginScreen onLoginSuccess={jest.fn()} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-email'), 'wrong@beltflow.com');
        fireEvent.changeText(getByTestId('input-password'), 'wrongpassword');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-login-submit'));
      });

      await waitFor(() => {
        expect(getByText('Invalid email or password.')).toBeTruthy();
      });
    });

    test('handles inactive or pending account status (403)', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new ApiError({
          message: 'Account is awaiting approval or is inactive.',
          status: 403,
        })
      );

      const { getByTestId, getByText } = await renderWithTheme(
        <LoginScreen onLoginSuccess={jest.fn()} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-email'), 'pending@beltflow.com');
        fireEvent.changeText(getByTestId('input-password'), 'password');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-login-submit'));
      });

      await waitFor(() => {
        expect(getByText('Account is awaiting approval or is inactive.')).toBeTruthy();
      });
    });

    test('handles network failure gracefully', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new ApiError({
          message: 'Network connection failed. Please verify internet access and backend connectivity.',
          status: 0,
          isNetworkError: true,
        })
      );

      const { getByTestId, getByText } = await renderWithTheme(
        <LoginScreen onLoginSuccess={jest.fn()} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-email'), 'student@beltflow.com');
        fireEvent.changeText(getByTestId('input-password'), 'password123');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-login-submit'));
      });

      await waitFor(() => {
        expect(getByText(/Network connection failed/i)).toBeTruthy();
      });
    });
  });

  describe('2. SplashScreen & Session Restoration', () => {
    test('restores existing active session and calls onSessionRestored', async () => {
      const mockSession = {
        token: 'saved.token.jwt',
        user: {
          id: 'usr_admin_01',
          fullName: 'Aminah Admin',
          email: 'admin@silambam.my',
          role: UserRole.ADMIN_PERSATUAN,
        },
      };

      (authService.getStoredSession as jest.Mock).mockResolvedValue(mockSession);

      const onSessionRestored = jest.fn();
      const onUnauthenticated = jest.fn();

      await renderWithTheme(
        <SplashScreen
          onSessionRestored={onSessionRestored}
          onUnauthenticated={onUnauthenticated}
        />
      );

      await waitFor(() => {
        expect(authService.getStoredSession).toHaveBeenCalled();
        expect(onSessionRestored).toHaveBeenCalledWith(mockSession.user);
        expect(onUnauthenticated).not.toHaveBeenCalled();
      });
    });

    test('navigates to unauthenticated state when no session exists', async () => {
      (authService.getStoredSession as jest.Mock).mockResolvedValue(null);

      const onSessionRestored = jest.fn();
      const onUnauthenticated = jest.fn();

      await renderWithTheme(
        <SplashScreen
          onSessionRestored={onSessionRestored}
          onUnauthenticated={onUnauthenticated}
        />
      );

      await waitFor(() => {
        expect(onUnauthenticated).toHaveBeenCalled();
        expect(onSessionRestored).not.toHaveBeenCalled();
      });
    });
  });

  describe('3. WelcomeScreen', () => {
    test('renders BeltFlow introduction and navigation buttons', async () => {
      const onNavigateLogin = jest.fn();
      const onNavigateVerify = jest.fn();

      const { getByText, getByTestId } = await renderWithTheme(
        <WelcomeScreen
          onNavigateLogin={onNavigateLogin}
          onNavigateVerify={onNavigateVerify}
        />
      );

      expect(getByText('BeltFlow')).toBeTruthy();
      expect(getByText('Martial Arts Academy Management')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-welcome-signin'));
      });
      expect(onNavigateLogin).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.press(getByTestId('btn-welcome-verify'));
      });
      expect(onNavigateVerify).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. ForgotPasswordScreen', () => {
    test('explains academy administrative reset procedure without fake success', async () => {
      const onBack = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <ForgotPasswordScreen onBack={onBack} />
      );

      expect(getByText('Password Assistance')).toBeTruthy();
      expect(getByText(/contact your Persatuan Admin or Academy Master/i)).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-forgot-back'));
      });
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('5. VerifyCertificateScreen', () => {
    test('validates certificate code entry', async () => {
      const { getByTestId, getByText } = await renderWithTheme(
        <VerifyCertificateScreen onBack={jest.fn()} />
      );

      await act(async () => {
        fireEvent.press(getByTestId('btn-verify-submit'));
      });

      await waitFor(() => {
        expect(getByText('Please enter a certificate verification code')).toBeTruthy();
      });
      expect(certificateService.verifyCertificate).not.toHaveBeenCalled();
    });

    test('displays verified certificate metadata when valid code found', async () => {
      (certificateService.verifyCertificate as jest.Mock).mockResolvedValue({
        verified: true,
        certificate: {
          code: 'CERT-SILAMBAM-2024-001',
          studentName: 'Aryan Suresh',
          rankOrTitle: 'Green Belt',
          organizationName: 'Persatuan Silambam Malaysia',
          masterName: 'Master Suresh',
          issueDate: '2024-06-15',
          type: 'GRADING',
        },
      });

      const { getByTestId, getByText, getAllByText } = await renderWithTheme(
        <VerifyCertificateScreen onBack={jest.fn()} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-cert-code'), 'CERT-SILAMBAM-2024-001');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-verify-submit'));
      });

      await waitFor(() => {
        expect(getByText('Aryan Suresh')).toBeTruthy();
        expect(getAllByText('Green Belt').length).toBeGreaterThanOrEqual(1);
        expect(getByText('Persatuan Silambam Malaysia')).toBeTruthy();
        expect(getByText('Master Suresh')).toBeTruthy();
      });
    });

    test('displays not found error when certificate is invalid', async () => {
      (certificateService.verifyCertificate as jest.Mock).mockRejectedValue(
        new ApiError({
          message: 'No active official certificate matches the specified code in PostgreSQL.',
          status: 404,
        })
      );

      const { getByTestId, getByText } = await renderWithTheme(
        <VerifyCertificateScreen onBack={jest.fn()} />
      );

      await act(async () => {
        fireEvent.changeText(getByTestId('input-cert-code'), 'FAKE-CODE-999');
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-verify-submit'));
      });

      await waitFor(() => {
        expect(getByText(/No active official certificate matches/i)).toBeTruthy();
      });
    });
  });

  describe('6. AuthenticatedPlaceholderScreen', () => {
    test('displays verified user identity, role badge, and handles logout', async () => {
      const mockUser: AuthUser = {
        id: 'usr_parent_01',
        fullName: 'Dr. Ramesh Kumar',
        email: 'ramesh@example.com',
        role: UserRole.PARENT,
        organizationId: 'org_001',
      };

      const onLogout = jest.fn();
      const { getByText, getByTestId } = await renderWithTheme(
        <AuthenticatedPlaceholderScreen user={mockUser} onLogout={onLogout} />
      );

      expect(getByText('Dr. Ramesh Kumar')).toBeTruthy();
      expect(getByText('ramesh@example.com')).toBeTruthy();
      expect(getByText('PARENT')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-auth-logout'));
      });

      expect(authService.logout).toHaveBeenCalled();
      await waitFor(() => {
        expect(onLogout).toHaveBeenCalled();
      });
    });
  });
});
