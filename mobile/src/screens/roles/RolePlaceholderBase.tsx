import React, { useState } from 'react';
import { readableId } from '../../utils/displayName';
import { View, Text, StyleSheet } from 'react-native';
import { LanguageSelector } from '../../components/LanguageSelector';
import { LogOut, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/Badges';
import { OfflineBanner } from '../../components/Feedback';
import { Button } from '../../components/Button';
import { AuthUser, RoleType } from '../../types/auth';
import { useI18n } from '../../i18n';
import { PrivacyDataSheet } from '../../components/PrivacyDataSheet';
import { StaffPasswordResetCard } from '../../components/StaffPasswordResetCard';

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
  /** H28: show the app-wide language picker (Profile screens). */
  showLanguageSelector?: boolean;
  /** Show the "Coming soon" card. Off by default: no screen should need it. */
  comingSoon?: boolean;
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
  showLanguageSelector = false,
  comingSoon = false,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const { t } = useI18n();

  return (
    <ScreenContainer scrollable testID={testID}>
      {/* Header with Title and Sign Out Action */}
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        rightAction={
          onLogout ? (
            <Button
              label={t('auth.common.signOut')}
              onPress={onLogout}
              variant="outline"
              size="sm"
              leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
              testID="btn-role-logout"
              accessibilityLabel={t('auth.role.signOutA11y')}
            />
          ) : undefined
        }
      />

      <View style={[styles.content, { paddingVertical: spacing.md }]}>
        {/* Offline Security Banner */}
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('auth.role.offline')}
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
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="middle">
                {user.email}
              </Text>
              {user.organizationId ? (
                <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2, fontWeight: '600' }]}>
                  {t('auth.role.persatuan', { id: readableId(user.organizationId) })}
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

        {showLanguageSelector ? (
          <Card variant="standard" style={{ marginBottom: spacing.md }}>
            <LanguageSelector />
          </Card>
        ) : null}

        {/* Profile screens: privacy rights (download, correct, delete) */}
        {showLanguageSelector ? (
          <Card variant="standard" style={{ marginBottom: spacing.md }} testID="card-privacy-entry">
            <View style={styles.userRow}>
              <ShieldCheck size={iconSize.md} color={colors.buttonPrimaryBg} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{t('privacy.entry.title')}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{t('privacy.entry.body')}</Text>
              </View>
            </View>
            <Button
              label={t('privacy.entry.open')}
              variant="outline"
              size="sm"
              onPress={() => setPrivacyOpen(true)}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              accessibilityLabel={t('privacy.entry.title')}
              testID="btn-open-privacy"
            />
          </Card>
        ) : null}
        {showLanguageSelector ? <StaffPasswordResetCard role={user.role} /> : null}
        <PrivacyDataSheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} role={user.role} />

        {/* Feature Overview Card: only for a feature that is not built yet (none today). */}
        {comingSoon ? (
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
                {t('auth.role.comingSoon')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.role.comingSoonBody')}
              </Text>
            </View>
          </View>

          {actionButtons ? (
            <View style={{ marginTop: spacing.lg }}>{actionButtons}</View>
          ) : null}
        </Card>
        ) : null}

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
