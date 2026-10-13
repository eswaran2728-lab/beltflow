/**
 * Task 1.6 — Session validation against the REAL authService implementation.
 * Only the network transport (apiClient) and secure storage are faked.
 */
import { authService } from '../services/authService';
import { apiClient, ApiError } from '../services/apiClient';
import { setAuthToken, setUserSession, getAuthToken, getUserSession, clearAuth } from '../services/storage';
import { AuthUser, UserRole } from '../types/auth';

const inMemoryStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => inMemoryStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    inMemoryStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete inMemoryStore[key];
  }),
}));

/** Unsigned JWT-shaped token with a future expiry (signature irrelevant client-side). */
function makeToken(expOffsetSeconds: number): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })}.sig`;
}

const cachedUser: AuthUser = {
  id: 'usr_001',
  fullName: 'Cached Name',
  email: 'user@beltflow.com',
  role: UserRole.MASTER,
  organizationId: 'org_old',
};

async function seedSession(token = makeToken(3600), user: AuthUser = cachedUser) {
  await setAuthToken(token);
  await setUserSession(user);
}

describe('authService.validateStoredSession — Task 1.6', () => {
  let getSpy: jest.SpyInstance;

  beforeEach(async () => {
    for (const k of Object.keys(inMemoryStore)) delete inMemoryStore[k];
    await clearAuth();
    getSpy = jest.spyOn(apiClient, 'get');
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  test('no stored session → invalid, never calls the server', async () => {
    const result = await authService.validateStoredSession();
    expect(result).toMatchObject({ isValid: false, user: null, reason: 'no_session' });
    expect(getSpy).not.toHaveBeenCalled();
  });

  test('expired token → rejected and purged without calling the server', async () => {
    await seedSession(makeToken(-60));
    const result = await authService.validateStoredSession();
    expect(result.isValid).toBe(false);
    expect(getSpy).not.toHaveBeenCalled();
    expect(await getAuthToken()).toBeNull();
  });

  test('online: calls /api/v1/auth/me and replaces identity with the verified response', async () => {
    await seedSession();
    const serverUser: AuthUser = { ...cachedUser, fullName: 'Server Name', organizationId: 'org_new' };
    getSpy.mockResolvedValue({ user: serverUser });

    const result = await authService.validateStoredSession();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(result).toMatchObject({ isValid: true, isVerifiedOnline: true, isOffline: false, reason: 'verified_online' });
    expect(result.user?.organizationId).toBe('org_new');
    expect((await getUserSession())?.fullName).toBe('Server Name');
  });

  test('online: server-reported role change wins over cached role', async () => {
    await seedSession();
    getSpy.mockResolvedValue({ user: { ...cachedUser, role: UserRole.PARENT } });
    const result = await authService.validateStoredSession();
    expect(result.user?.role).toBe(UserRole.PARENT);
  });

  test('401 → invalid, credentials purged, session-ended listeners notified', async () => {
    await seedSession();
    const ended = jest.fn();
    const unsubscribe = authService.onSessionEnded(ended);
    getSpy.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthorized', isUnauthorized: true }));

    const result = await authService.validateStoredSession();

    expect(result).toMatchObject({ isValid: false, user: null, reason: 'invalid_credentials' });
    expect(await getAuthToken()).toBeNull();
    expect(await getUserSession()).toBeNull();
    expect(ended).toHaveBeenCalled();
    unsubscribe();
  });

  test('403 (inactive / unapproved account) → invalid and purged', async () => {
    await seedSession();
    getSpy.mockRejectedValue(new ApiError({ status: 403, message: 'Account inactive' }));

    const result = await authService.validateStoredSession();

    expect(result).toMatchObject({ isValid: false, reason: 'inactive_account' });
    expect(await getAuthToken()).toBeNull();
  });

  test('network failure → cached identity retained but explicitly NOT server-verified', async () => {
    await seedSession();
    getSpy.mockRejectedValue(new ApiError({ status: 0, message: 'Network request failed', isNetworkError: true }));

    const result = await authService.validateStoredSession();

    expect(result).toMatchObject({
      isValid: true,
      isVerifiedOnline: false,
      isOffline: true,
      reason: 'cached_offline',
    });
    expect(result.user?.fullName).toBe('Cached Name');
    // Token kept so the session can be re-verified when connectivity returns.
    expect(await getAuthToken()).not.toBeNull();
  });

  test('server 5xx → not treated as offline and not verified', async () => {
    await seedSession();
    getSpy.mockRejectedValue(new ApiError({ status: 503, message: 'Service Unavailable' }));

    const result = await authService.validateStoredSession();

    expect(result).toMatchObject({
      isValid: true,
      isVerifiedOnline: false,
      isOffline: false,
      reason: 'unverified_server_error',
    });
  });

  test('forceOffline → never reported as verified', async () => {
    await seedSession();
    const result = await authService.validateStoredSession({ forceOffline: true });
    expect(result.isVerifiedOnline).toBe(false);
    expect(getSpy).not.toHaveBeenCalled();
  });
});
