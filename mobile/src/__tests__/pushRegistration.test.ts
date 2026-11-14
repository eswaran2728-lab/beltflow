/**
 * Push registration on the phone. The app asks for permission and registers
 * its Expo push token only on a real device, with an EAS project id, after a
 * verified sign-in; logout unregisters it. Any failure is quiet.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '../services/apiClient';
import { registerForPushNotifications, unregisterPushNotifications } from '../services/pushRegistration';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
});

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

const N = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
  jest.clearAllMocks();
  (Device as any).isDevice = true;
  (Constants as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };
  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
  N.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
  N.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-device-1]', type: 'expo' } as any);
  (apiClient.post as jest.Mock).mockResolvedValue({ registered: true });
});

test('registers the device token with the app language', async () => {
  const result = await registerForPushNotifications('ms');
  expect(result).toBe('registered');
  expect(N.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
  expect(apiClient.post).toHaveBeenCalledWith('/notifications/devices', {
    token: 'ExponentPushToken[test-device-1]',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    locale: 'ms',
  });
});

test('asks for permission only when not yet granted, and stops if refused', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as any);
  N.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
  expect(await registerForPushNotifications('en')).toBe('permission-denied');
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('does nothing without an EAS project id or on a simulator', async () => {
  (Constants as any).expoConfig = { extra: {} };
  expect(await registerForPushNotifications('en')).toBe('not-configured');
  (Constants as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };
  (Device as any).isDevice = false;
  expect(await registerForPushNotifications('en')).toBe('unsupported-device');
  expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('a server or token error is quiet', async () => {
  (apiClient.post as jest.Mock).mockRejectedValue(new Error('offline'));
  expect(await registerForPushNotifications('en')).toBe('error');
  N.getExpoPushTokenAsync.mockRejectedValue(new Error('no FCM'));
  expect(await registerForPushNotifications('en')).toBe('error');
});

test('logout unregisters the stored token once', async () => {
  await registerForPushNotifications('ta');
  (apiClient.post as jest.Mock).mockClear();
  await unregisterPushNotifications();
  expect(apiClient.post).toHaveBeenCalledWith('/notifications/devices/unregister', { token: 'ExponentPushToken[test-device-1]' });
  (apiClient.post as jest.Mock).mockClear();
  await unregisterPushNotifications();
  expect(apiClient.post).not.toHaveBeenCalled();
});
