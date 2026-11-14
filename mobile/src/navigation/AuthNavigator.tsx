import React, { useState, useEffect } from 'react';
import {
  SplashScreen,
  WelcomeScreen,
  LoginScreen,
  ForgotPasswordScreen,
  VerifyCertificateScreen,
  AuthenticatedPlaceholderScreen,
} from '../screens/auth';
import { AuthUser } from '../types/auth';
import { authService } from '../services/authService';

export type AuthScreenState =
  | 'splash'
  | 'welcome'
  | 'login'
  | 'forgot_password'
  | 'verify_certificate'
  | 'authenticated';

export interface AuthNavigatorProps {
  initialScreen?: AuthScreenState;
  onAuthenticationChange?: (user: AuthUser | null) => void;
}

export const AuthNavigator: React.FC<AuthNavigatorProps> = ({
  initialScreen = 'splash',
  onAuthenticationChange,
}) => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreenState>(initialScreen);
  const [previousScreen, setPreviousScreen] = useState<AuthScreenState>('login');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Listen for automatic session invalidation (e.g. 401 unauthenticated response)
    const unsubscribe = authService.onSessionEnded(() => {
      setCurrentUser(null);
      setCurrentScreen('login');
      onAuthenticationChange?.(null);
    });

    return () => {
      unsubscribe();
    };
  }, [onAuthenticationChange]);

  const handleSessionRestored = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentScreen('authenticated');
    onAuthenticationChange?.(user);
  };

  const handleUnauthenticated = () => {
    setCurrentScreen('welcome');
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentScreen('authenticated');
    onAuthenticationChange?.(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('login');
    onAuthenticationChange?.(null);
  };

  const navigateToVerifyCert = () => {
    setPreviousScreen(currentScreen);
    setCurrentScreen('verify_certificate');
  };

  const handleBackFromVerify = () => {
    setCurrentScreen(previousScreen === 'verify_certificate' ? 'login' : previousScreen);
  };

  switch (currentScreen) {
    case 'splash':
      return (
        <SplashScreen
          onSessionRestored={handleSessionRestored}
          onUnauthenticated={handleUnauthenticated}
        />
      );

    case 'welcome':
      return (
        <WelcomeScreen
          onNavigateLogin={() => setCurrentScreen('login')}
          onNavigateVerify={navigateToVerifyCert}
        />
      );

    case 'login':
      return (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateForgotPassword={() => setCurrentScreen('forgot_password')}
          onNavigateVerifyCert={navigateToVerifyCert}
        />
      );

    case 'forgot_password':
      return (
        <ForgotPasswordScreen
          onBack={() => setCurrentScreen('login')}
        />
      );

    case 'verify_certificate':
      return (
        <VerifyCertificateScreen
          onBack={handleBackFromVerify}
        />
      );

    case 'authenticated':
      if (!currentUser) {
        return (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onNavigateForgotPassword={() => setCurrentScreen('forgot_password')}
            onNavigateVerifyCert={navigateToVerifyCert}
          />
        );
      }
      return (
        <AuthenticatedPlaceholderScreen
          user={currentUser}
          onLogout={handleLogout}
        />
      );

    default:
      return (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateForgotPassword={() => setCurrentScreen('forgot_password')}
          onNavigateVerifyCert={navigateToVerifyCert}
        />
      );
  }
};
