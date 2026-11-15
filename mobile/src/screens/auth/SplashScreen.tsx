import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { PopIn } from '../../components/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types/auth';
import { useI18n } from '../../i18n';

export interface SplashScreenProps {
  onSessionRestored?: (user: AuthUser) => void;
  onUnauthenticated?: () => void;
  /**
   * When false, the splash only renders visuals; the parent (AppNavigator)
   * performs server-verified session restoration instead. Defaults to true.
   */
  autoRestore?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onSessionRestored,
  onUnauthenticated,
  autoRestore = true,
}) => {
  const { typography, spacing } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    if (!autoRestore) return;
    let isMounted = true;

    async function checkSession() {
      try {
        const session = await authService.getStoredSession();
        if (!isMounted) return;

        if (session && session.user) {
          onSessionRestored?.(session.user);
        } else {
          onUnauthenticated?.();
        }
      } catch {
        if (isMounted) {
          onUnauthenticated?.();
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [autoRestore, onSessionRestored, onUnauthenticated]);

  return (
    <View
      style={[styles.container, { backgroundColor: '#0D2B47' }]}
      testID="splash-screen"
      accessibilityRole="text"
      accessibilityLabel={t('auth.splash.a11y')}
    >
      <View style={styles.brandContainer}>
        <PopIn float style={{ marginBottom: 12 }}>
          <BrandMark size={132} />
        </PopIn>

        <Text style={[typography.display, styles.brandTitle, { color: '#FFFFFF' }]}>
          {t('app.name')}
        </Text>

        <Text style={[typography.bodyMedium, styles.brandSubtitle, { color: '#B8C7D9' }]}>
          {t('auth.common.tagline')}
        </Text>
      </View>

      <View style={[styles.loaderContainer, { marginBottom: spacing.xxl }]}>
        <ActivityIndicator size="large" color="#F2941C" />
        <Text style={[typography.caption, { color: '#B8C7D9', marginTop: 12 }]}>
          {t('auth.splash.loading')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  brandContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  brandSubtitle: {
    textAlign: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
  },
});
