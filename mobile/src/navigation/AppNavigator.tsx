import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AuthNavigator, AuthScreenState } from './AuthNavigator';
import {
  SuperAdminNavigator,
  AdminPersatuanNavigator,
  MasterNavigator,
  ParentNavigator,
  StudentNavigator,
} from './roleNavigators';
import { buildNavigationIdentityKey } from './RoleNavigationContainer';
import {
  SessionAuthority,
  SessionAuthorityProvider,
  UNVERIFIED_SESSION_AUTHORITY,
  resolveVerifiedRole,
} from './sessionAuthority';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { UnauthorizedRoleScreen } from '../screens/roles/UnauthorizedRoleScreen';
import { authService, SessionValidationResult } from '../services/authService';
import { AuthUser, UserRole } from '../types/auth';
import { RoleNavigatorProps } from './types';

export interface AppNavigatorProps {
  /**
   * Inject an already-established identity (tests / embedding only).
   * Production omits this and AppNavigator restores + verifies the stored
   * session against GET /api/v1/auth/me.
   */
  initialUser?: AuthUser | null;
  /**
   * Authority for an injected `initialUser`. Fails closed (unverified) by default.
   */
  initialAuthority?: SessionAuthority;
}

type Phase = 'bootstrapping' | 'unauthenticated' | 'authenticated';

const VERIFIED_ONLINE: SessionAuthority = {
  verification: 'verified_online',
  isVerifiedOnline: true,
  isOffline: false,
};

function authorityFromValidation(result: SessionValidationResult): SessionAuthority {
  if (result.isVerifiedOnline) return VERIFIED_ONLINE;
  if (result.isOffline) {
    return { verification: 'cached_offline', isVerifiedOnline: false, isOffline: true };
  }
  return UNVERIFIED_SESSION_AUTHORITY;
}

const ROLE_NAVIGATORS: Record<UserRole, React.ComponentType<RoleNavigatorProps>> = {
  [UserRole.SUPER_ADMIN]: SuperAdminNavigator,
  [UserRole.ADMIN_PERSATUAN]: AdminPersatuanNavigator,
  [UserRole.MASTER]: MasterNavigator,
  [UserRole.PARENT]: ParentNavigator,
  [UserRole.STUDENT]: StudentNavigator,
};

/**
 * Root application navigator.
 *
 * - Unauthenticated: renders the Task 1.5 AuthNavigator (never starting at its
 *   own splash, so every restored session goes through server verification here).
 * - Authenticated: renders exactly ONE role navigator chosen from the backend
 *   role. Other roles' routes are never registered, so they cannot be reached
 *   via deep links or programmatic navigation.
 * - Unknown role: renders UnauthorizedRoleScreen (sign-out only).
 * - Logout / session expiry: the authenticated tree is unmounted, discarding
 *   all navigation history and privileged screen state.
 */
export const AppNavigator: React.FC<AppNavigatorProps> = ({
  initialUser,
  initialAuthority = UNVERIFIED_SESSION_AUTHORITY,
}) => {
  const hasInjectedUser = initialUser !== undefined;

  const [phase, setPhase] = useState<Phase>(() => {
    if (!hasInjectedUser) return 'bootstrapping';
    return initialUser ? 'authenticated' : 'unauthenticated';
  });
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [authority, setAuthority] = useState<SessionAuthority>(
    initialUser ? initialAuthority : UNVERIFIED_SESSION_AUTHORITY
  );
  const [authEntryScreen, setAuthEntryScreen] = useState<AuthScreenState>('welcome');
  // Incremented on every sign-out so AuthNavigator remounts with clean state.
  const [authGeneration, setAuthGeneration] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetToSignedOut = useCallback((entry: AuthScreenState = 'login') => {
    if (!mountedRef.current) return;
    setUser(null);
    setAuthority(UNVERIFIED_SESSION_AUTHORITY);
    setAuthEntryScreen(entry);
    setAuthGeneration(g => g + 1);
    setPhase('unauthenticated');
  }, []);

  const applyValidation = useCallback(
    (result: SessionValidationResult | undefined | null) => {
      if (!mountedRef.current || !result) return;
      if (result.isValid && result.user) {
        setUser(result.user);
        setAuthority(authorityFromValidation(result));
        setPhase('authenticated');
      } else {
        resetToSignedOut(result.reason === 'no_session' ? 'welcome' : 'login');
      }
    },
    [resetToSignedOut]
  );

  // 1. Bootstrap: restore stored session and verify it with the server.
  useEffect(() => {
    if (hasInjectedUser) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await authService.validateStoredSession();
        if (!cancelled) applyValidation(result);
      } catch {
        if (!cancelled) resetToSignedOut('welcome');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasInjectedUser, applyValidation, resetToSignedOut]);

  // 2. Session ended anywhere (401, explicit logout, invalid /me): drop privileged tree.
  useEffect(() => {
    const unsubscribe = authService.onSessionEnded(() => resetToSignedOut('login'));
    return () => {
      unsubscribe?.();
    };
  }, [resetToSignedOut]);

  // 3. Re-verify unverified (offline/cached) sessions when the app returns to foreground.
  useEffect(() => {
    if (phase !== 'authenticated' || authority.isVerifiedOnline) return;
    const handleChange = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      try {
        applyValidation(await authService.validateStoredSession());
      } catch {
        // Keep the current (unverified) state; sensitive operations remain locked.
      }
    };
    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [phase, authority.isVerifiedOnline, applyValidation]);

  const handleAuthenticationChange = useCallback(
    (nextUser: AuthUser | null) => {
      if (!nextUser) {
        resetToSignedOut('login');
        return;
      }
      // AuthNavigator never starts at its splash here, so a non-null user can only
      // come from a fresh /api/v1/auth/login response — server-verified.
      setUser(nextUser);
      setAuthority(VERIFIED_ONLINE);
      setPhase('authenticated');
    },
    [resetToSignedOut]
  );

  const handleLogout = useCallback(async () => {
    // Remove privileged UI first so nothing remains visible if storage cleanup is slow.
    resetToSignedOut('login');
    try {
      await authService.logout();
    } catch {
      // Credentials purge failure must not keep the user signed in visually.
    }
  }, [resetToSignedOut]);

  if (phase === 'bootstrapping') {
    return <SplashScreen autoRestore={false} />;
  }

  if (phase === 'unauthenticated' || !user) {
    return (
      <AuthNavigator
        key={`auth-${authGeneration}`}
        initialScreen={authEntryScreen}
        onAuthenticationChange={handleAuthenticationChange}
      />
    );
  }

  const role = resolveVerifiedRole(user);
  const isOfflineOrUnverified = !authority.isVerifiedOnline;

  if (!role) {
    return <UnauthorizedRoleScreen user={user} onLogout={handleLogout} />;
  }

  const RoleNavigator = ROLE_NAVIGATORS[role as UserRole];

  return (
    <SessionAuthorityProvider value={authority}>
      <RoleNavigator
        key={buildNavigationIdentityKey(user)}
        user={user}
        onLogout={handleLogout}
        isOffline={isOfflineOrUnverified}
      />
    </SessionAuthorityProvider>
  );
};
