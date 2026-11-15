/**
 * Security review 2026-11-14: the QR scanner's trusted keys.
 *
 * The built-in keys come from development seeds that are public in this
 * repository, and a production server refuses those seeds. So:
 *  - release builds trust no built-in key; they use the keys published by
 *    the server's authenticated /students/qr/verification-keys,
 *  - the fetched keys are cached for offline roll-call,
 *  - malformed keys from the response are ignored.
 */
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../services/apiClient';
import { qrPassService, DEFAULT_PINNED_PUBLIC_KEY } from '../services/qrPassService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const SERVER_KEY = 'ab'.repeat(32);
const g = global as any;

describe('QR trusted keys', () => {
  const originalDev = g.__DEV__;
  afterEach(() => {
    g.__DEV__ = originalDev;
    qrPassService.resetTrustedKeys();
    jest.clearAllMocks();
  });

  test('release builds trust no built-in development key', () => {
    g.__DEV__ = false;
    qrPassService.resetTrustedKeys();
    expect(Object.values(qrPassService.getTrustedKeyRing())).not.toContain(DEFAULT_PINNED_PUBLIC_KEY);
    expect(Object.keys(qrPassService.getTrustedKeyRing())).toHaveLength(0);
  });

  test('keys are loaded from the server, filtered and cached', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      activeKid: 'bf_ed25519_k9',
      publicKeys: { bf_ed25519_k9: SERVER_KEY, bad: 'not-hex', short: 'abcd' },
    });
    const ok = await qrPassService.refreshTrustedKeys();
    expect(ok).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith('/students/qr/verification-keys');
    expect(qrPassService.getTrustedKeyRing()).toEqual({ bf_ed25519_k9: SERVER_KEY });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('beltflow_qr_key_ring', JSON.stringify({ bf_ed25519_k9: SERVER_KEY }));
  });

  test('offline: the cached server keys are used', async () => {
    g.__DEV__ = false;
    qrPassService.resetTrustedKeys();
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify({ bf_ed25519_k9: SERVER_KEY }));
    expect(await qrPassService.refreshTrustedKeys()).toBe(true);
    expect(qrPassService.getTrustedKeyRing()).toEqual({ bf_ed25519_k9: SERVER_KEY });
  });
});
