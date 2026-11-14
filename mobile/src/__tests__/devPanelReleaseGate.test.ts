/**
 * Security review 2026-11-14: the developer panel (server address override and
 * synthetic test accounts) is only for dev and testing builds. A production
 * build ignores a saved server-address override.
 */
import { isTestingBuild, initializeApiBaseUrl, resetApiBaseUrl } from '../config/env';

jest.mock('../services/storage', () => ({
  getStoredApiBaseUrl: jest.fn().mockResolvedValue('http://203.0.113.5:4000'),
}));

const g = global as any;

describe('developer panel release gate', () => {
  const originalDev = g.__DEV__;
  const originalFlag = process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
  afterEach(() => {
    g.__DEV__ = originalDev;
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
    else process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD = originalFlag;
    resetApiBaseUrl();
  });

  test('dev and testing builds show it; production builds do not', () => {
    g.__DEV__ = true;
    expect(isTestingBuild()).toBe(true);
    g.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
    expect(isTestingBuild()).toBe(false);
    process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD = '1';
    expect(isTestingBuild()).toBe(true);
  });

  test('a production build ignores a saved server address', async () => {
    g.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD;
    expect(await initializeApiBaseUrl()).not.toBe('http://203.0.113.5:4000');
  });

  test('a testing build still honours it', async () => {
    g.__DEV__ = false;
    process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD = '1';
    expect(await initializeApiBaseUrl()).toBe('http://203.0.113.5:4000');
  });
});
