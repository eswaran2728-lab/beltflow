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

  const fetcher = useCallback(() => {
    return dashboardService.getSuperAdminDashboard();
  }, []);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<SuperAdminDashboardData>({
    fetcher,
    isOffline,
  });

  const headerRightAction = onLogout ? (
    <Button
      label="Sign Out"
      onPress={onLogout}
      variant="outline"
      size="sm"
      leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
      testID="btn-role-logout"
      accessibilityLabel="Sign Out of BeltFlow"
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
          label="SUPER ADMIN"
          variant="info"
          testID="badge-role-super_admin"
        />
      </View>
    </Card>
  );

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="super-admin-home-screen">
        <ScreenHeader title="BeltFlow Platform" subtitle="Super Admin Home" rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message="Loading platform overview..." />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="super-admin-home-screen">
        <ScreenHeader title="BeltFlow Platform" subtitle="Super Admin Home" rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
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
        title="BeltFlow Platform"
        subtitle="Super Admin Home"
        rightAction={headerRightAction}
      />

      {isOffline ? (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner
            message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
            testID="offline-security-banner"
          />
        </View>
      ) : null}

      {renderIdentityCard()}

      {/* Platform Overview Stat Cards */}
      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title="Total Academies"
          value={data?.totalPersatuans ?? 0}
          icon={<Building2 size={iconSize.md} color={colors.buttonPrimaryBg} />}
          testID="stat-sa-total-orgs"
        />
        <StatCard
          title="Active"
          value={data?.activePersatuans ?? 0}
          icon={<CheckCircle size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-sa-active-orgs"
        />
        <StatCard
          title="Pending"
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
            Platform Governance Boundary
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          Super Admin maintains platform infrastructure and academy tenant provisioning. Access to individual academy operational records (student rosters, attendance logs, tuition fees, and grading evaluations) is strictly prohibited.
        </Text>
      </Card>

      {/* Registered Organizations */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Registered Persatuans
          </Text>
          <StatusBadge status="ACTIVE" label={`${data?.totalPersatuans ?? 0} Total`} variant="info" />
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
                    {org.state} • Master: {org.masterName}
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
            No organizations registered yet.
          </Text>
        )}
      </Card>

      {/* Platform Audit Summary */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Recent Platform Audit
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
            No recent platform audit events.
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Platform Navigation
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Persatuan Management"
            onPress={() => navigation?.navigate('Persatuans')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-sa-persatuans"
          />
          <Button
            label="Platform Audit Logs"
            onPress={() => navigation?.navigate('Audit')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-sa-audit"
          />
          <Button
            label="Super Admin Profile"
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
  return (
    <RolePlaceholderBase
      title="Persatuan Management"
      subtitle="Federation & Organization Registry"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="persatuan-management-screen"
      icon={<Building2 size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Tenant Governance: Review registered Silambam Persatuans, manage active status, and configure multi-tenant dojos."
    />
  );
};

export const PlatformAuditScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Platform Audit"
      subtitle="System Security & Event Logs"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="platform-audit-screen"
      icon={<ShieldCheck size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Audit Scope: Security compliance records, privileged access audits, and tamper-resistant system event logs."
    />
  );
};

export const SuperAdminProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Super Administrator Identity"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="super-admin-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Credential Scope: System administration profile, security settings, and session termination."
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
