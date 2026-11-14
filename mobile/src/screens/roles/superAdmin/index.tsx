import React, { useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import {
  Building2,
  ShieldCheck,
  User,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  LogOut,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { StatCard } from '../../../components/StatCard';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState } from '../../../components/Feedback';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, SuperAdminDashboardData } from '../../../services/dashboardService';
import { useI18n } from '../../../i18n';
import { TenantFeaturesPanel } from './TenantFeaturesPanel';

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const SuperAdminHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();

  const fetcher = useCallback(() => {
    return dashboardService.getSuperAdminDashboard();
  }, []);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<SuperAdminDashboardData>({
    fetcher,
    isOffline,
  });

  const headerRightAction = onLogout ? (
    <Button
      label={t('superAdminHome.signOut')}
      onPress={onLogout}
      variant="outline"
      size="sm"
      leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
      testID="btn-role-logout"
      accessibilityLabel={t('superAdminHome.signOutA11y')}
    />
  ) : undefined;

  const renderIdentityCard = () => (
    <Card variant="standard" style={[styles.identityCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
      <View style={styles.userRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {user.fullName}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {user.email}
          </Text>
        </View>
        <StatusBadge
          status={UserRole.SUPER_ADMIN}
          label={t('superAdminHome.roleBadge')}
          variant="info"
          testID="badge-role-super_admin"
        />
      </View>
    </Card>
  );

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="super-admin-home-screen">
        <ScreenHeader title={t('superAdminHome.headerTitle')} subtitle={t('superAdminHome.headerSubtitle')} rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('superAdminHome.offlineBanner')}
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message={t('superAdminHome.loading')} />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="super-admin-home-screen">
        <ScreenHeader title={t('superAdminHome.headerTitle')} subtitle={t('superAdminHome.headerSubtitle')} rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('superAdminHome.offlineBanner')}
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <ErrorState message={error.message} onRetry={reload} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scrollable
      testID="super-admin-home-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.buttonPrimaryBg}
          colors={[colors.buttonPrimaryBg]}
        />
      }
    >
      <ScreenHeader
        title={t('superAdminHome.headerTitle')}
        subtitle={t('superAdminHome.headerSubtitle')}
        rightAction={headerRightAction}
      />

      {isOffline ? (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner
            message={t('superAdminHome.offlineBanner')}
            testID="offline-security-banner"
          />
        </View>
      ) : null}

      {renderIdentityCard()}

      {/* Platform Overview Stat Cards */}
      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title={t('superAdminHome.stat.totalAcademies')}
          value={data?.totalPersatuans ?? 0}
          icon={<Building2 size={iconSize.md} color={colors.buttonPrimaryBg} />}
          testID="stat-sa-total-orgs"
        />
        <StatCard
          title={t('status.active')}
          value={data?.activePersatuans ?? 0}
          icon={<CheckCircle size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-sa-active-orgs"
        />
        <StatCard
          title={t('status.pending')}
          value={data?.pendingPersatuans ?? 0}
          icon={<Clock size={iconSize.md} color={colors.badgeWarningText} />}
          testID="stat-sa-pending-orgs"
        />
      </View>

      {/* Security Scope Banner */}
      <Card variant="standard" style={[styles.scopeCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <View style={styles.scopeHeader}>
          <ShieldAlert size={20} color={colors.badgeInfoText} />
          <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1 }]}>
            {t('superAdminHome.governance.title')}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          {t('superAdminHome.governance.body')}
        </Text>
      </Card>

      {/* Registered Organizations */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('superAdminHome.orgs.title')}
          </Text>
          <StatusBadge status="ACTIVE" label={t('superAdminHome.orgs.totalBadge', { count: data?.totalPersatuans ?? 0 })} variant="info" />
        </View>

        {data?.recentOrganizations && data.recentOrganizations.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.recentOrganizations.map(org => (
              <View
                key={org.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {org.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {t('superAdminHome.orgs.masterLine', { state: org.state, master: org.masterName })}
                  </Text>
                </View>
                <StatusBadge
                  status={org.status}
                  label={org.status}
                  variant={org.status === 'ACTIVE' ? 'success' : 'warning'}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('superAdminHome.orgs.empty')}
          </Text>
        )}
      </Card>

      {/* Platform Audit Summary */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('superAdminHome.audit.title')}
          </Text>
          <ShieldCheck size={20} color={colors.buttonPrimaryBg} />
        </View>

        {data?.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.recentAuditLogs.map(log => (
              <View
                key={log.id}
                style={[
                  styles.auditRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {log.action}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {log.details}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {new Date(log.timestamp).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('superAdminHome.audit.empty')}
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          {t('superAdminHome.nav.title')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('superAdminHome.nav.persatuanManagement')}
            onPress={() => navigation?.navigate('Persatuans')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-sa-persatuans"
          />
          <Button
            label={t('superAdminHome.nav.auditLogs')}
            onPress={() => navigation?.navigate('Audit')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-sa-audit"
          />
          <Button
            label={t('superAdminHome.nav.profile')}
            onPress={() => navigation?.navigate('Profile')}
            variant="outline"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
            testID="shortcut-sa-profile"
          />
        </View>
      </Card>
    </ScreenContainer>
  );
};

export const PersatuanManagementScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      title={t('superAdminHome.persatuanMgmt.title')}
      subtitle={t('superAdminHome.persatuanMgmt.subtitle')}
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="persatuan-management-screen"
      icon={<Building2 size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('superAdminHome.persatuanMgmt.scope')}
    >
      <TenantFeaturesPanel />
    </RolePlaceholderBase>
  );
};

export const PlatformAuditScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      title={t('superAdminHome.platformAudit.title')}
      subtitle={t('superAdminHome.platformAudit.subtitle')}
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="platform-audit-screen"
      icon={<ShieldCheck size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('superAdminHome.platformAudit.scope')}
    />
  );
};

export const SuperAdminProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      showLanguageSelector
      title={t('superAdminHome.profile.title')}
      subtitle={t('superAdminHome.profile.subtitle')}
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="super-admin-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('superAdminHome.profile.scope')}
    />
  );
};

const styles = StyleSheet.create({
  identityCard: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsGrid: {
    flexDirection: 'row',
  },
  scopeCard: {
    padding: 16,
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionCard: {
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
