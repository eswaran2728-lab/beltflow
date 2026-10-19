import React, { useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import {
  MapPin,
  Users,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  User,
  GraduationCap,
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
import { dashboardService, AdminPersatuanDashboardData } from '../../../services/dashboardService';
import { MasterApprovalsScreen } from './MasterApprovalsScreen';
import { AdminAcademySetupScreen } from './AdminAcademySetupScreen';

export { AdminAcademySetupScreen };

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const AdminPersatuanHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const fetcher = useCallback(() => {
    return dashboardService.getAdminPersatuanDashboard(user);
  }, [user]);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<AdminPersatuanDashboardData>({
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
          {user.organizationId ? (
            <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2, fontWeight: '600' }]}>
              Persatuan: {user.organizationId}
            </Text>
          ) : null}
        </View>
        <StatusBadge
          status={UserRole.ADMIN_PERSATUAN}
          label="ADMIN PERSATUAN"
          variant="info"
          testID="badge-role-admin_persatuan"
        />
      </View>
    </Card>
  );

  const screenSubtitle = 'Academy Operations Overview';

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="admin-persatuan-home-screen">
        <ScreenHeader title="Persatuan Dashboard" subtitle={screenSubtitle} rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message="Loading academy dashboard..." />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="admin-persatuan-home-screen">
        <ScreenHeader title="Persatuan Dashboard" subtitle={screenSubtitle} rightAction={headerRightAction} />
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
      testID="admin-persatuan-home-screen"
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
        title="Persatuan Dashboard"
        subtitle={screenSubtitle}
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

      {/* Academy Profile & State Overview */}
      <Card variant="standard" style={[styles.academyCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <View style={styles.academyHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              {data?.organization?.name || 'Academy Profile'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {data?.organization?.state || 'Malaysia'} • {data?.organization?.martialArtStyle || 'Martial Arts'}
            </Text>
            {data?.organization?.masterName ? (
              <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2, fontWeight: '600' }]}>
                Head Master: {data.organization.masterName}
              </Text>
            ) : null}
          </View>
          <StatusBadge
            status={data?.organization?.status || 'ACTIVE'}
            label={data?.organization?.status || 'ACTIVE'}
            variant={data?.organization?.status === 'ACTIVE' ? 'success' : 'info'}
          />
        </View>
      </Card>

      {/* Key Academy Metrics Grid */}
      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title="Locations"
          value={data?.locationsCount ?? 0}
          icon={<MapPin size={iconSize.md} color={colors.buttonPrimaryBg} />}
          testID="stat-ap-locations"
        />
        <StatCard
          title="Classes"
          value={data?.classesCount ?? 0}
          icon={<Calendar size={iconSize.md} color={colors.badgeInfoText} />}
          testID="stat-ap-classes"
        />
        <StatCard
          title="Masters"
          value={data?.mastersCount ?? 0}
          icon={<Users size={iconSize.md} color={colors.badgeWarningText} />}
          testID="stat-ap-masters"
        />
      </View>

      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title="Students"
          value={data?.studentsCount ?? 0}
          icon={<GraduationCap size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-ap-students"
        />
        <StatCard
          title="Revenue"
          value={`RM ${data?.totalRevenue ?? 0}`}
          subtitle={`${data?.paymentsCount ?? 0} payments recorded`}
          icon={<DollarSign size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-ap-revenue"
        />
      </View>

      {/* Governance & Role Authority Notice */}
      <Card variant="standard" style={[styles.scopeCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <View style={styles.scopeHeader}>
          <ShieldAlert size={20} color={colors.badgeInfoText} />
          <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1 }]}>
            Persatuan Administration Scope
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          Persatuan administrators oversee academy facilities, roster assignments, and financial aggregations. Per-class fee modifications and grading evaluation submissions remain strictly under the authority of certified Masters.
        </Text>
      </Card>

      {/* Training Classes & Locations */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Active Classes & Venues
          </Text>
          <StatusBadge status="ACTIVE" label={`${data?.classesCount ?? 0} Active`} variant="info" />
        </View>

        {data?.classes && data.classes.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.classes.map(cls => (
              <View
                key={cls.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {cls.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {cls.location} • Fee: RM {cls.monthlyFee}/mo
                  </Text>
                  {cls.masterName ? (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
                      Assigned: {cls.masterName}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No active training classes registered yet.
          </Text>
        )}
      </Card>

      {/* Assigned Masters */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Assigned Masters & Coaches
          </Text>
          <Users size={20} color={colors.buttonPrimaryBg} />
        </View>

        {data?.masters && data.masters.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.masters.map(m => (
              <View
                key={m.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {m.fullName}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {m.email}
                  </Text>
                </View>
                {m.credentialLevel ? (
                  <StatusBadge status={m.credentialLevel} label={m.credentialLevel} variant="info" />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No certified masters assigned yet.
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Persatuan Navigation
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Academy Setup & Legacy Imports"
            onPress={() => navigation?.navigate('AcademySetup')}
            variant="primary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonPrimaryText} />}
            testID="shortcut-ap-onboarding"
          />
          <Button
            label="Locations & Venues"
            onPress={() => navigation?.navigate('Locations')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-ap-locations"
          />
          <Button
            label="Masters & Coaches"
            onPress={() => navigation?.navigate('Masters')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-ap-masters"
          />
          <Button
            label="Belt Curriculum & Ranks"
            onPress={() => navigation?.navigate('Curriculum')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-ap-curriculum"
          />
          <Button
            label="Finance & Gateway Reconciliation"
            onPress={() => navigation?.navigate('Finance')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-ap-finance"
          />
          <Button
            label="Academy Reports"
            onPress={() => navigation?.navigate('Reports')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-ap-reports"
          />
          <Button
            label="Persatuan Admin Profile"
            onPress={() => navigation?.navigate('Profile')}
            variant="outline"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
            testID="shortcut-ap-profile"
          />
        </View>
      </Card>
    </ScreenContainer>
  );
};

export const LocationsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Locations"
      subtitle="Dojos & Training Centres"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-locations-screen"
      icon={<MapPin size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Facility Scope: Active training dojos, venue schedules, and regional branch coordination."
    />
  );
};

export const MastersScreen: React.FC<RoleScreenProps> = props => {
  return <MasterApprovalsScreen {...props} />;
};

export const AcademySetupScreen: React.FC<RoleScreenProps> = props => {
  return <AdminAcademySetupScreen {...props} />;
};



export const ReportsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Reports"
      subtitle="Academy Metrics & Attendance Analytics"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-reports-screen"
      icon={<BarChart3 size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Reporting Scope: Aggregate academy attendance, belt progression rate, and student retention analytics."
    />
  );
};

export const AdminPersatuanProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Persatuan Administrator Profile"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Identity Scope: Persatuan organization administrator account settings, session details, and logout."
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
  academyCard: {
    padding: 16,
  },
  academyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
});

export * from './MasterApprovalsScreen';
export * from './ClassApprovalsScreen';
export * from './HandoverApprovalsScreen';
export * from './CurriculumManagementScreen';
export * from './AdminFinanceScreen';
