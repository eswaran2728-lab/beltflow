import { apiClient, onUnauthorizedResponse } from './apiClient';
import {
  setAuthToken,
  getAuthToken,
  setUserSession,
  getUserSession,
  clearAuth,
} from './storage';
import {
  AuthUser,
  LoginCredentials,
  AuthResponse,
  AuthSession,
  ChangePasswordRequest,
} from '../types/auth';

type SessionEndListener = () => void;
const sessionEndListeners: Set<SessionEndListener> = new Set();

/**
 * Checks if a JWT token is expired by parsing its unencrypted payload
 */
export function isJwtTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode base64url payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;

    // exp is in seconds; Date.now() is in milliseconds
    const expiryMs = payload.exp * 1000;
    return Date.now() >= expiryMs;
  } catch {
    return false;
  }
}

// Global hook: When apiClient encounters a 401, automatically clear credentials & notify listeners
onUnauthorizedResponse(async () => {
  await clearAuth();
  notifySessionEnded();
});

function notifySessionEnded(): void {
  for (const listener of sessionEndListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

export const authService = {
  /**
   * Authenticate user with email and password against /api/v1/auth/login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const response = await apiClient.post<AuthResponse>(
      '/api/v1/auth/login',
      {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      },
      { requiresAuth: false }
    );

    if (response?.token && response?.user) {
      await setAuthToken(response.token);
      await setUserSession(response.user);
    }

    return response;
  },

  /**
   * Fetch latest profile from /api/v1/auth/me using current session token
   */
  async getProfile(): Promise<AuthUser> {
    const response = await apiClient.get<{ user: AuthUser }>('/api/v1/auth/me');
    if (response?.user) {
      await setUserSession(response.user);
      return response.user;
    }
    throw new Error('Profile data was not returned by the server.');
  },

  /**
   * Change current account password
   */
  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/api/v1/auth/change-password', request);
  },

  /**
   * Retrieves active session from secure storage, validating presence
   */
  async getStoredSession(): Promise<AuthSession | null> {
    const [token, user] = await Promise.all([getAuthToken(), getUserSession()]);

    if (!token || !user) {
      return null;
    }

    // Check if token has expired
    if (isJwtTokenExpired(token)) {
      await clearAuth();
      return null;
    }

    return { token, user };
  },

  /**
   * Disposes of authentication session and purges hardware Keystore / Keychain
   */
  async logout(): Promise<void> {
    await clearAuth();
    notifySessionEnded();
  },

  /**
   * Validates active session:
   * - If online, verifies against /api/v1/auth/me, updates stored user, and rejects invalid/inactive sessions
   * - If offline or network error, distinguishes cached identity (isVerifiedOnline: false, isOffline: true)
   */
  async validateStoredSession(options?: { forceOffline?: boolean }): Promise<SessionValidationResult> {
    const session = await this.getStoredSession();
    if (!session) {
      return {
        isValid: false,
        user: null,
        isVerifiedOnline: false,
        isOffline: false,
        reason: 'no_session',
      };
    }

    if (options?.forceOffline) {
      return {
        isValid: true,
        user: session.user,
        isVerifiedOnline: false,
        isOffline: true,
        reason: 'cached_offline',
      };
    }

    try {
      const freshUser = await this.getProfile();
      return {
        isValid: true,
        user: freshUser,
        isVerifiedOnline: true,
        isOffline: false,
        reason: 'verified_online',
      };
    } catch (err: any) {
      if (err?.isUnauthorized || err?.status === 401) {
        await clearAuth();
        notifySessionEnded();
        return {
          isValid: false,
          user: null,
          isVerifiedOnline: false,
          isOffline: false,
          reason: 'invalid_credentials',
          error: err.message,
        };
      }

      if (err?.status === 403) {
        // Account inactive or awaiting approval
        await clearAuth();
        notifySessionEnded();
        return {
          isValid: false,
          user: null,
          isVerifiedOnline: false,
          isOffline: false,
          reason: 'inactive_account',
          error: err.message,
        };
      }

      // Network failure / timeout: preserve the locally cached identity, but it is
      // NOT server-verified. Callers must not authorize sensitive online operations.
      if (err?.isNetworkError || err?.isTimeout || err?.status === 0 || err?.status === 408) {
        return {
          isValid: true,
          user: session.user,
          isVerifiedOnline: false,
          isOffline: true,
          reason: 'cached_offline',
        };
      }

      // Any other server failure (e.g. 5xx, malformed profile): server reachable but
      // identity could not be verified. Keep cached identity, explicitly unverified.
      return {
        isValid: true,
        user: session.user,
        isVerifiedOnline: false,
        isOffline: false,
        reason: 'unverified_server_error',
        error: err?.message,
      };
    }
  },

  /**
   * Register a listener for session termination (e.g. 401 unauthenticated or explicit logout)
   */
  onSessionEnded(listener: SessionEndListener): () => void {
    sessionEndListeners.add(listener);
    return () => {
      sessionEndListeners.delete(listener);
    };
  },

  /**
   * Revalidates the active session against /api/v1/auth/me upon reconnection.
   * Checks for account or organization identity changes to protect against tenant state bleed.
   */
  async revalidateOnReconnect(currentUser?: AuthUser | null): Promise<{
    isValid: boolean;
    user: AuthUser | null;
    accountChanged: boolean;
    reason: string;
    error?: string;
  }> {
    const session = await this.getStoredSession();
    const baselineUser = currentUser || session?.user || null;
    if (!session && !currentUser) {
      return {
        isValid: false,
        user: null,
        accountChanged: false,
        reason: 'no_session',
      };
    }

    try {
      const freshUser = await this.getProfile();
      const accountChanged = Boolean(
        baselineUser &&
          (baselineUser.id !== freshUser.id || baselineUser.organizationId !== freshUser.organizationId)
      );

      return {
        isValid: true,
        user: freshUser,
        accountChanged,
        reason: accountChanged ? 'account_changed' : 'revalidated',
      };
    } catch (err: any) {
      if (err?.isUnauthorized || err?.status === 401 || err?.status === 403) {
        await clearAuth();
        notifySessionEnded();
        return {
          isValid: false,
          user: null,
          accountChanged: true,
          reason: 'session_expired',
          error: err.message,
        };
      }

      // Backend error during revalidation - keep cached session
      return {
        isValid: true,
        user: baselineUser,
        accountChanged: false,
        reason: 'revalidation_failed_cached',
        error: err.message,
      };
    }
  },
};

export interface SessionValidationResult {
  isValid: boolean;
  user: AuthUser | null;
  isVerifiedOnline: boolean;
  isOffline: boolean;
  reason?:
    | 'no_session'
    | 'expired'
    | 'invalid_credentials'
    | 'inactive_account'
    | 'verified_online'
    | 'cached_offline'
    | 'unverified_server_error';
  error?: string;
}

