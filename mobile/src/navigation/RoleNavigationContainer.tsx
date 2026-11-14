import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  Theme as NavigationTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { AuthUser } from '../types/auth';

export interface RoleNavigationContainerProps {
  user: AuthUser;
  children: React.ReactNode;
}

/**
 * Ref bound to whichever role container is currently mounted. When no
 * authenticated tree is mounted, `isReady()` is false and navigation is a no-op.
 */
export const roleNavigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/**
 * Builds a stable identity key for the navigation tree.
 *
 * When the user, role, or tenant (organization) changes, the key changes and
 * React fully remounts the container. This discards all navigation history and
 * per-screen state, preventing stale data from leaking across accounts/tenants.
 */
export function buildNavigationIdentityKey(user: AuthUser): string {
  return [user.id, String(user.role), user.organizationId ?? 'no-org'].join('::');
}

/**
 * Each role navigator renders inside its own isolated NavigationContainer.
 *
 * SECURITY NOTES
 * - No `linking` config is passed. Inbound deep links therefore cannot be
 *   resolved into arbitrary routes; only routes registered in the *active*
 *   role's navigator exist at all. Routes for other roles are never mounted.
 * - Container state is never persisted (`initialState` is not restored), so a
 *   prior session's privileged navigation history cannot be rehydrated.
 * - Client-side routing is a UX safeguard only. Server authorization remains
 *   the source of truth for every data operation.
 */
export const RoleNavigationContainer: React.FC<RoleNavigationContainerProps> = ({
  user,
  children,
}) => {
  const { isDark, colors } = useTheme();

  const navigationTheme: NavigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.buttonPrimaryBg,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.buttonPrimaryBg,
      },
    };
  }, [isDark, colors]);

  return (
    <NavigationContainer
      key={buildNavigationIdentityKey(user)}
      ref={roleNavigationRef}
      theme={navigationTheme}
    >
      {children}
    </NavigationContainer>
  );
};
