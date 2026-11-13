import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from './apiClient';

/**
 * Phone push notifications. The server sends only neutral text ("You have a
 * new update in BeltFlow"); details stay in the signed-in in-app inbox.
 *
 * Needs, outside this code: an EAS project id in app config
 * (expo.extra.eas.projectId, created by `eas init`), FCM credentials for
 * Android in that EAS project, and PUSH_PROVIDER=expo on the server.
 */
const TOKEN_KEY = 'beltflow_push_token';

export type PushRegistrationResult = 'registered' | 'not-configured' | 'unsupported-device' | 'permission-denied' | 'error';

let presentationConfigured = false;
function configurePresentation() {
  if (presentationConfigured) return;
  presentationConfigured = true;
  // Show the banner when a push arrives while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const anyConstants = Constants as any;
  return anyConstants?.expoConfig?.extra?.eas?.projectId ?? anyConstants?.easConfig?.projectId ?? undefined;
}

/** Call after a server-verified sign-in, and again when the app language changes. */
export async function registerForPushNotifications(locale: string): Promise<PushRegistrationResult> {
  const id = projectId();
  if (!id) return 'not-configured';
  if (!Device.isDevice) return 'unsupported-device';
  try {
    configurePresentation();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'BeltFlow',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return 'permission-denied';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await apiClient.post('/notifications/devices', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      locale: ['en', 'ms', 'ta'].includes(locale) ? locale : 'en',
    });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return 'registered';
  } catch {
    // Push is optional: the in-app inbox still works.
    return 'error';
  }
}

/** Call on logout, before the sign-in token is cleared. Never throws. */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await apiClient.post('/notifications/devices/unregister', { token });
  } catch {
    // The server also disables tokens the push service reports as gone.
  }
}
