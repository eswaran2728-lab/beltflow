import { Platform } from 'react-native';

/**
 * BeltFlow Mobile Environment & API URL Configuration
 *
 * Handles platform-specific development loops:
 * - Android Emulator maps host machine to 10.0.2.2
 * - iOS Simulator maps host machine to localhost
 * - Physical devices: set EXPO_PUBLIC_API_URL or call setApiBaseUrl(customUrl)
 */

// Matches the backend default (server/src/index.ts: PORT || 4000). Port 3000
// only serves static web files, not the API.
const DEFAULT_PORT = 4000;
const ANDROID_EMULATOR_HOST = `http://10.0.2.2:${DEFAULT_PORT}`;
const IOS_SIMULATOR_HOST = `http://localhost:${DEFAULT_PORT}`;

export function resolvePlatformBaseUrl(osPlatform: 'ios' | 'android' | 'web' | 'windows' | 'macos'): string {
  // If explicitly specified in process environment (e.g. EXPO_PUBLIC_API_URL)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  if (osPlatform === 'android') {
    return ANDROID_EMULATOR_HOST;
  }

  return IOS_SIMULATOR_HOST;
}

// Mutable runtime URL override (e.g. for dynamic physical device IP or environment selection)
let currentApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (currentApiBaseUrl) {
    return currentApiBaseUrl;
  }
  return resolvePlatformBaseUrl(Platform.OS as any);
}

export function setApiBaseUrl(url: string): void {
  currentApiBaseUrl = url.replace(/\/+$/, '');
}

export function resetApiBaseUrl(): void {
  currentApiBaseUrl = null;
}

/**
 * Dev builds, and testing builds made with EXPO_PUBLIC_BELTFLOW_TESTING_BUILD=1
 * (the CI testing APK), show the developer panel: server address override and
 * synthetic test accounts. Production builds do not, and ignore a saved override.
 */
export function isTestingBuild(): boolean {
  return (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_BELTFLOW_TESTING_BUILD === '1';
}

export async function initializeApiBaseUrl(): Promise<string> {
  if (!isTestingBuild()) {
    return getApiBaseUrl();
  }
  try {
    // Lazy require (not a top-level import) to avoid a storage <-> env import cycle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStoredApiBaseUrl } = require('../services/storage') as typeof import('../services/storage');
    const stored = await getStoredApiBaseUrl();
    if (stored) {
      setApiBaseUrl(stored);
      return stored;
    }
  } catch {
    // Ignore storage read error during initialization
  }
  return getApiBaseUrl();
}

export const API_TIMEOUT_MS = 15000; // 15 seconds

