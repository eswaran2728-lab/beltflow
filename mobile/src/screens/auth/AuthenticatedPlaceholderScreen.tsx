import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserCheck, LogOut, Building, Shield } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/Badges';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types/auth';

export interface AuthenticatedPlaceholderScreenProps {
  user: AuthUser;
  onLogout: () => void;
}

export const AuthenticatedPlaceholderScreen: React.FC<AuthenticatedPlaceholderScreenProps> = ({
  user,
  onLogout,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      setIsLoggingOut(false);
      onLogout();
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'danger';
      case 'ADMIN_PERSATUAN':
        return 'warning';
      case 'MASTER':
        return 'info';
      case 'PARENT':
      case 'STUDENT':
      default:
        return 'success';
    }
  };

  return (
    <ScreenContainer scrollable testID="auth-placeholder-screen">
      <ScreenHeader
        title="BeltFlow Portal"
        subtitle="Active verified session"
        testID="auth-placeholder-header"
      />

      <View style={[styles.content, { paddingVertical: spacing.lg }]}>
        {/* User Identity Card */}
        <Card variant="elevated" style={styles.userCard}>
          <View style={styles.userHeader}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <UserCheck size={32} color={colors.buttonPrimaryBg} />
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {user.fullName}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {user.email}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Role & Tenant Details */}
          <View style={styles.detailRow}>
            <View style={styles.labelCol}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                VERIFIED ROLE
              </Text>
              <View style={{ marginTop: 4 }}>
                <StatusBadge
                  status={user.role}
                  label={user.role}
                  variant={getRoleVariant(user.role)}
                />
              </View>
            </View>

            <View style={styles.labelCol}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                TENANT ID
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                {user.organizationId || 'System Global'}
              </Text>
            </View>
          </View>

          {/* Academy Affiliation */}
          {user.organizationId ? (
            <View style={[styles.tenantNotice, { backgroundColor: colors.surfaceElevated }]}>
              <Building size={iconSize.sm} color={colors.buttonPrimaryBg} style={{ marginRight: 8 }} />
              <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
                Tenant isolation enforced: All student, mat, and grading operations bound to your Persatuan.
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Phase Notice Card */}
        <Card variant="standard" style={[styles.noticeCard, { marginTop: spacing.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Shield size={iconSize.md} color={colors.buttonPrimaryBg} style={{ marginRight: 8 }} />
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              Phase 1 Task 1.5 Milestone
            </Text>
          </View>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, lineHeight: 20 }]}>
            Authentication and secure storage are fully active. Complete role-based operational
            portals for Super Admin, Persatuan Admin, Masters, Parents, and Students will be
            orchestrated in Task 1.6.
          </Text>
        </Card>

        {/* Logout CTA */}
        <View style={{ marginTop: spacing.xxl }}>
          <Button
            label="Sign Out"
            onPress={handleLogout}
            loading={isLoggingOut}
            disabled={isLoggingOut}
            variant="outline"
            size="lg"
            fullWidth
            leftIcon={<LogOut size={iconSize.md} color={colors.badgeDangerText} />}
            testID="btn-auth-logout"
            accessibilityLabel="Sign Out Button"
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 4,
  },
  userCard: {
    padding: 20,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelCol: {
    flex: 1,
  },
  tenantNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noticeCard: {
    padding: 16,
  },
});
