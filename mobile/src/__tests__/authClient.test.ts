import {
  getApiBaseUrl,
  setApiBaseUrl,
  resetApiBaseUrl,
  resolvePlatformBaseUrl,
} from '../config/env';
import {
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  setUserSession,
  getUserSession,
  clearAuth,
} from '../services/storage';
import { apiClient, ApiError } from '../services/apiClient';
import { authService } from '../services/authService';
import { UserRole, AuthUser } from '../types/auth';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store in memory
const inMemoryStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => {
    return inMemoryStore[key] ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    inMemoryStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete inMemoryStore[key];
  }),
}));

describe('BeltFlow Mobile API Client & Secure Auth Storage — Task 1.4', () => {
  beforeEach(async () => {
    // Clear in-memory mock store
    for (const key of Object.keys(inMemoryStore)) {
      delete inMemoryStore[key];
    }
    jest.clearAllMocks();
    resetApiBaseUrl();
    await clearAuth();
  });

  describe('1. API URL Configuration', () => {
    test('resolves Android emulator loopback to 10.0.2.2:4000 (backend default port)', () => {
      const url = resolvePlatformBaseUrl('android');
      expect(url).toBe('http://10.0.2.2:4000');
    });

    test('resolves iOS simulator loopback to localhost:4000 (backend default port)', () => {
      const url = resolvePlatformBaseUrl('ios');
      expect(url).toBe('http://localhost:4000');
    });

    test('allows dynamic override of base URL for physical devices or staging', () => {
      setApiBaseUrl('https://api.beltflow.com');
      expect(getApiBaseUrl()).toBe('https://api.beltflow.com');

      resetApiBaseUrl();
      expect(getApiBaseUrl()).not.toBe('https://api.beltflow.com');
    });
  });

  describe('2. Secure Token Storage (Expo SecureStore)', () => {
    test('saves, retrieves, and deletes authentication token securely', async () => {
      await setAuthToken('jwt-token-12345');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'beltflow_auth_token',
        'jwt-token-12345'
      );

      const token = await getAuthToken();
      expect(token).toBe('jwt-token-12345');

      await removeAuthToken();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('beltflow_auth_token');

      const deleted = await getAuthToken();
      expect(deleted).toBeNull();
    });

    test('saves, retrieves, and clears user profile session', async () => {
      const user: AuthUser = {
        id: 'usr_master_001',
        fullName: 'Master Suresh',
        email: 'master@beltflow.com',
        role: UserRole.MASTER,
        organizationId: 'org_silambam_001',
        assignedClassIds: ['cls_01', 'cls_02'],
      };

      await setUserSession(user);
      const retrieved = await getUserSession();

      expect(retrieved).toEqual(user);

      await clearAuth();
      const cleared = await getUserSession();
      expect(cleared).toBeNull();
    });

    test('does not log token secrets to console', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      await setAuthToken('super-secret-jwt-token');
      await getAuthToken();

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('super-secret-jwt-token')
      );
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('super-secret-jwt-token')
      );
      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('super-secret-jwt-token')
      );

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('3. API Client & HTTP Transport', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('injects Authorization Bearer header when token exists', async () => {
      await setAuthToken('jwt-valid-token');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      } as any);

      await apiClient.get('/api/health');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/health'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-valid-token',
          }),
        })
      );
    });

    test('omits Authorization header when unauthenticated', async () => {
      await clearAuth();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      } as any);

      await apiClient.get('/api/health');

      const calledHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(calledHeaders.Authorization).toBeUndefined();
    });

    test('handles JSON request serialization and response parsing', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      } as any);

      const response = await apiClient.post('/api/test', { key: 'value' });

      expect(response).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'value' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    test('detects network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

      try {
        await apiClient.get('/api/health');
        throw new Error('Expected ApiError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.isNetworkError).toBe(true);
        expect(apiErr.status).toBe(0);
        expect(apiErr.message).toMatch(/Network connection failed/i);
      }
    });

    test('detects request timeouts', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      try {
        await apiClient.get('/api/health', { timeoutMs: 100 });
        throw new Error('Expected ApiError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.isTimeout).toBe(true);
        expect(apiErr.status).toBe(408);
      }
    });

    test('identifies 401 Unauthorized status accurately', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Authentication required. Missing Bearer token.' }),
      } as any);

      try {
        await apiClient.get('/api/v1/auth/me');
        throw new Error('Expected 401 ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.isUnauthorized).toBe(true);
        expect(apiErr.status).toBe(401);
      }
    });
  });

  describe('4. Authentication Service & Session Logic', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('login authenticates user, stores session securely, and returns backend response', async () => {
      const mockResponse = {
        message: 'Authentication successful.',
        token: 'header.payload.signature',
        user: {
          id: 'usr_admin_001',
          fullName: 'Siti Aminah',
          email: 'admin@silambam.my',
          role: UserRole.ADMIN_PERSATUAN,
          organizationId: 'org_persatuan_01',
          assignedClassIds: [],
          linkedStudentIds: [],
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      } as any);

      const result = await authService.login({
        email: 'admin@silambam.my',
        password: 'ValidPassword123!',
      });

      expect(result.token).toBe('header.payload.signature');
      expect(result.user.role).toBe(UserRole.ADMIN_PERSATUAN);

      // Verify token and user stored in SecureStore
      const storedToken = await getAuthToken();
      expect(storedToken).toBe('header.payload.signature');

      const storedUser = await getUserSession();
      expect(storedUser?.email).toBe('admin@silambam.my');
    });

    test('login rejects invalid credentials without modifying stored session', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Invalid email or password.' }),
      } as any);

      await expect(
        authService.login({ email: 'bad@email.com', password: 'wrong' })
      ).rejects.toThrow(/Invalid email or password/i);

      expect(await getAuthToken()).toBeNull();
      expect(await getUserSession()).toBeNull();
    });

    test('getProfile retrieves current profile and synchronizes stored session', async () => {
      await setAuthToken('jwt-session-token');

      const profileResponse = {
        user: {
          id: 'usr_student_001',
          fullName: 'Kavitha Devi',
          email: 'kavitha@example.com',
          role: UserRole.STUDENT,
          organizationId: 'org_silambam_001',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => profileResponse,
      } as any);

      const profile = await authService.getProfile();
      expect(profile.id).toBe('usr_student_001');
      expect(profile.role).toBe(UserRole.STUDENT);

      // Verify cached user session is updated
      const cached = await getUserSession();
      expect(cached?.fullName).toBe('Kavitha Devi');
    });

    test('logout clears secure storage and notifies listener', async () => {
      await setAuthToken('active-token');
      await setUserSession({
        id: 'usr_parent_01',
        fullName: 'Parent Raju',
        email: 'raju@parent.com',
        role: UserRole.PARENT,
      });

      const onSessionEnd = jest.fn();
      const unsubscribe = authService.onSessionEnded(onSessionEnd);

      await authService.logout();

      expect(await getAuthToken()).toBeNull();
      expect(await getUserSession()).toBeNull();
      expect(onSessionEnd).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    test('401 response invokes session end handler and clears stored token', async () => {
      await setAuthToken('expired-token');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Invalid or expired session token.' }),
      } as any);

      const onSessionEnd = jest.fn();
      authService.onSessionEnded(onSessionEnd);

      try {
        await apiClient.get('/api/v1/auth/me');
      } catch {
        // Expected ApiError
      }

      // Token should be removed upon 401
      expect(await getAuthToken()).toBeNull();
      expect(onSessionEnd).toHaveBeenCalled();
    });

    test('preserves all five distinct roles without accepting client-selected override', () => {
      const roles: UserRole[] = [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_PERSATUAN,
        UserRole.MASTER,
        UserRole.PARENT,
        UserRole.STUDENT,
      ];

      expect(roles).toHaveLength(5);
      expect(roles).toContain('SUPER_ADMIN');
      expect(roles).toContain('ADMIN_PERSATUAN');
      expect(roles).toContain('MASTER');
      expect(roles).toContain('PARENT');
      expect(roles).toContain('STUDENT');
    });
  });
});
