import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Shield } from 'lucide-react-native';
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
  const { colors, typography, spacing } = useTheme();
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
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="splash-screen"
      accessibilityRole="text"
      accessibilityLabel={t('auth.splash.a11y')}
    >
      <View style={styles.brandContainer}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Shield size={56} color={colors.buttonPrimaryBg} />
        </View>

        <Text style={[typography.display, styles.brandTitle, { color: colors.textPrimary }]}>
          {t('app.name')}
        </Text>

        <Text style={[typography.bodyMedium, styles.brandSubtitle, { color: colors.textSecondary }]}>
          {t('auth.common.tagline')}
        </Text>
      </View>

      <View style={[styles.loaderContainer, { marginBottom: spacing.xxl }]}>
        <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 12 }]}>
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
