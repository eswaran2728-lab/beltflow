import type { ThemeColors } from '../theme/colors';

/**
 * One tab bar look for every role: white bar, soft top shadow, navy active
 * item, labels small enough that six tabs fit without being cut off.
 */
export function tabBarScreenOptions(colors: ThemeColors) {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.buttonPrimaryBg,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarAllowFontScaling: false,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.borderLight,
      borderTopWidth: 1,
      shadowColor: '#0D2B47',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 12,
    },
    tabBarItemStyle: {
      paddingHorizontal: 0,
    },
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '700' as const,
      letterSpacing: -0.1,
    },
  };
}
