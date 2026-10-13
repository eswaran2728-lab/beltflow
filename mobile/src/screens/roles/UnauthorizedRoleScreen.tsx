import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert, LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { AuthUser } from '../../types/auth';

export interface UnauthorizedRoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
}

export const UnauthorizedRoleScreen: React.FC<UnauthorizedRoleScreenProps> = ({
  user,
  onLogout,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  return (
    <ScreenContainer scrollable testID="unauthorized-role-screen">
      <ScreenHeader
        title="Access Restricted"
        subtitle="Role Authorization"
      />

      <View style={[styles.content, { paddingVertical: spacing.xl }]}>
        <Card variant="elevated" style={styles.card}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: colors.badgeDangerBg, borderColor: colors.badgeDangerText },
            ]}
          >
            <ShieldAlert size={44} color={colors.badgeDangerText} />
          </View>

          <Text style={[typography.pageTitle, styles.title, { color: colors.textPrimary }]}>
            Unauthorized Role
          </Text>

          <Text style={[typography.bodyMedium, styles.message, { color: colors.textSecondary }]}>
            Your account role is not recognized or has not been authorized for any mobile portal.
          </Text>

          <View style={[styles.detailsBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Account: {user.email}
            </Text>
            <Text style={[typography.caption, { color: colors.badgeDangerText, marginTop: 4, fontWeight: '700' }]}>
              Detected Role: {String(user.role)}
            </Text>
          </View>

          <Text style={[typography.caption, styles.disclaimer, { color: colors.textMuted }]}>
            Please contact your organization administrator or academy master to verify permissions.
          </Text>

          {onLogout ? (
            <View style={{ marginTop: spacing.xl }}>
              <Button
                label="Sign Out"
                onPress={onLogout}
                variant="danger"
                size="md"
                fullWidth
                leftIcon={<LogOut size={iconSize.md} color={colors.buttonDangerText} />}
                testID="btn-unauthorized-logout"
                accessibilityLabel="Sign Out of unauthorized session"
              />
            </View>
          ) : null}
        </Card>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  detailsBox: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  disclaimer: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
