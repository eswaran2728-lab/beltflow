/**
 * Security hardening (2026-11-15): where the app sends its sign-in token.
 *
 *  - The token only goes to the configured BeltFlow server, never to another
 *    host, even if a full URL is passed to the client.
 *  - A production build refuses a plain http:// server (dev and testing
 *    builds may use one for a local server).
 */
import { apiClient } from '../services/apiClient';
import { setApiBaseUrl, resetApiBaseUrl } from '../config/env';

jest.mock('../services/storage', () => ({
  getAuthToken: jest.fn().mockResolvedValue('test-session-token'),
  getStoredApiBaseUrl: jest.fn().mockResolvedValue(null),
}));

const g = global as any;
const originalDev = g.__DEV__;
const originalFlag = process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
const originalFetch = g.fetch;

function mockFetch() {
  const fn = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ ok: true }),
    text: async () => '{"ok":true}',
  });
  g.fetch = fn;
  return fn;
}
const sentAuth = (fn: jest.Mock) => (fn.mock.calls[0][1].headers as Record<string, string>).Authorization;

describe('API client transport security', () => {
  afterEach(() => {
    g.__DEV__ = originalDev;
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
    else process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD = originalFlag;
    g.fetch = originalFetch;
    resetApiBaseUrl();
  });

  test('the token is sent to the BeltFlow server', async () => {
    setApiBaseUrl('https://api.example.test');
    const fetchMock = mockFetch();
    await apiClient.get('/students/me');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/api/v1/students/me');
    expect(sentAuth(fetchMock)).toBe('Bearer test-session-token');
  });

  test('the token is not sent to another host', async () => {
    setApiBaseUrl('https://api.example.test');
    const fetchMock = mockFetch();
    await apiClient.get('https://files.example.org/video.mp4');
    expect(sentAuth(fetchMock)).toBeUndefined();
    // A look-alike host is still another host.
    const fetchMock2 = mockFetch();
    await apiClient.get('https://api.example.test.evil.example/x');
    expect(sentAuth(fetchMock2)).toBeUndefined();
  });

  test('a production build refuses a plain http server', async () => {
    g.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
    setApiBaseUrl('http://192.0.2.10:4000');
    const fetchMock = mockFetch();
    await expect(apiClient.get('/students/me')).rejects.toThrow(/secure/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a testing build may use a local http server', async () => {
    g.__DEV__ = false;
    process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD = '1';
    setApiBaseUrl('http://192.0.2.10:4000');
    const fetchMock = mockFetch();
    await apiClient.get('/students/me');
    expect(fetchMock).toHaveBeenCalled();
  });
});
