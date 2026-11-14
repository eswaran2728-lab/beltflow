import * as SecureStore from 'expo-secure-store';
import { AuthUser } from '../types/auth';

/**
 * BeltFlow Mobile Secure Storage Service
 *
 * Utilizes hardware-backed Expo SecureStore (Android Keystore / iOS Keychain).
 * Never uses unencrypted AsyncStorage or raw SQLite for sensitive JWT tokens.
 * Strict zero-log policy for token data.
 */

const STORAGE_KEYS = {
  AUTH_TOKEN: 'beltflow_auth_token',
  USER_SESSION: 'beltflow_user_session',
  CUSTOM_API_URL: 'beltflow_custom_api_url',
  LOCALE: 'beltflow_locale',
} as const;

/** H28: the app language chosen on this device ('en' | 'ms' | 'ta'). Not sensitive. */
export async function getStoredLocale(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.LOCALE);
  } catch {
    return null;
  }
}

export async function setStoredLocale(locale: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.LOCALE, locale);
  } catch {
    // The choice still applies for this session if storage is unavailable.
  }
}

export async function getStoredApiBaseUrl(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.CUSTOM_API_URL);
  } catch {
    return null;
  }
}

export async function setStoredApiBaseUrl(url: string): Promise<void> {
  if (!url || typeof url !== 'string') {
    await clearStoredApiBaseUrl();
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_API_URL, url.trim().replace(/\/+$/, ''));
}

export async function clearStoredApiBaseUrl(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.CUSTOM_API_URL);
  } catch {
    // Ignore deletion errors
  }
}


export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token provided for secure storage.');
  }
  await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function removeAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    // Ignore deletion errors on already purged keys
  }
}

export async function getUserSession(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.USER_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setUserSession(user: AuthUser): Promise<void> {
  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user payload provided for secure session storage.');
  }
  await SecureStore.setItemAsync(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
}

export async function removeUserSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_SESSION);
  } catch {
    // Ignore deletion errors on already purged keys
  }
}

export async function clearAuth(): Promise<void> {
  await Promise.allSettled([
    removeAuthToken(),
    removeUserSession(),
  ]);
}
