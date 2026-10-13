import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/Badges';
import { OfflineBanner } from '../../components/Feedback';
import { Button } from '../../components/Button';
import { AuthUser, RoleType } from '../../types/auth';

export interface RolePlaceholderBaseProps {
  title: string;
  subtitle: string;
  role: RoleType;
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  scopeDescription: string;
  actionButtons?: React.ReactNode;
  children?: React.ReactNode;
}

export const RolePlaceholderBase: React.FC<RolePlaceholderBaseProps> = ({
  title,
  subtitle,
  role,
  user,
  onLogout,
  isOffline = false,
  testID,
  icon,
  scopeDescription,
  actionButtons,
  children,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  return (
    <ScreenContainer scrollable testID={testID}>
      {/* Header with Title and Sign Out Action */}
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        rightAction={
          onLogout ? (
            <Button
              label="Sign Out"
              onPress={onLogout}
              variant="outline"
              size="sm"
              leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
              testID="btn-role-logout"
              accessibilityLabel="Sign Out of BeltFlow"
            />
          ) : undefined
        }
      />

      <View style={[styles.content, { paddingVertical: spacing.md }]}>
        {/* Offline Security Banner */}
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}

        {/* User Identity & Scope Card */}
        <Card variant="standard" style={{ marginBottom: spacing.md }}>
          <View style={styles.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {user.fullName}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {user.email}
              </Text>
              {user.organizationId ? (
                <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2, fontWeight: '600' }]}>
                  Persatuan: {user.organizationId}
                </Text>
              ) : null}
            </View>

            <StatusBadge
              status={role}
              label={role.replace('_', ' ')}
              variant="info"
              testID={`badge-role-${role.toLowerCase()}`}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {scopeDescription}
          </Text>
        </Card>

        {/* Feature Overview Card */}
        <Card variant="elevated" style={styles.featureCard}>
          <View style={styles.featureHeaderRow}>
            {icon ? (
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {icon}
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.titleMedium, { color: colors.textPrimary }]}
                accessibilityRole="header"
              >
                Coming soon
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                This section is being prepared for your account.
              </Text>
            </View>
          </View>

          {actionButtons ? (
            <View style={{ marginTop: spacing.lg }}>{actionButtons}</View>
          ) : null}
        </Card>

        {/* Children content if any */}
        {children ? <View style={{ marginTop: spacing.md }}>{children}</View> : null}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  featureCard: {
    padding: 18,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
