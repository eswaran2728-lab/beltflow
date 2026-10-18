import React, { useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import {
  Calendar,
  Users,
  Award,
  Clock,
  ArrowRight,
  User,
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
import { dashboardService, MasterDashboardData } from '../../../services/dashboardService';

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const MasterHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const fetcher = useCallback(() => {
    return dashboardService.getMasterDashboard(user);
  }, [user]);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<MasterDashboardData>({
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
          status={UserRole.MASTER}
          label="MASTER"
          variant="info"
          testID="badge-role-master"
        />
      </View>
    </Card>
  );

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="master-home-screen">
        <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Master Home" rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message="Loading instructor dashboard..." />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="master-home-screen">
        <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Master Home" rightAction={headerRightAction} />
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
      testID="master-home-screen"
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
        title={`Welcome, ${user.fullName}`}
        subtitle="Master Home"
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

      {/* Master Coaching Stat Metrics */}
      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title="My Classes"
          value={data?.assignedClassesCount ?? 0}
          icon={<Calendar size={iconSize.md} color={colors.buttonPrimaryBg} />}
          testID="stat-master-classes"
        />
        <StatCard
          title="Students"
          value={data?.assignedStudentsCount ?? 0}
          icon={<Users size={iconSize.md} color={colors.badgeInfoText} />}
          testID="stat-master-students"
        />
        <StatCard
          title="Today's Sessions"
          value={data?.todaySessionsCount ?? 0}
          icon={<Clock size={iconSize.md} color={colors.badgeWarningText} />}
          testID="stat-master-sessions"
        />
      </View>

      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title="Pending Gradings"
          value={data?.pendingGradingCount ?? 0}
          icon={<Award size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-master-gradings"
        />
      </View>

      {/* Today's Training Sessions */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {"Today's Mat Sessions"}
          </Text>
          <Clock size={20} color={colors.buttonPrimaryBg} />
        </View>

        {data?.todaySessions && data.todaySessions.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.todaySessions.map(sess => (
              <View
                key={sess.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {sess.startTime} - {sess.endTime}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {sess.location}
                  </Text>
                </View>
                <StatusBadge
                  status={sess.status}
                  label={sess.status}
                  variant={sess.status === 'SCHEDULED' ? 'info' : 'success'}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No training sessions scheduled for today.
          </Text>
        )}
      </Card>

      {/* Authorized Assigned Classes */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Assigned Classes
          </Text>
          <StatusBadge status="ASSIGNED" label={`${data?.assignedClassesCount ?? 0} Active`} variant="info" />
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
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No classes assigned to your master account.
          </Text>
        )}
      </Card>

      {/* Pending Grading Events */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Grading Examinations
          </Text>
          <Award size={20} color={colors.badgeWarningText} />
        </View>

        {data?.recentGradingEvents && data.recentGradingEvents.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.recentGradingEvents.map(grd => (
              <View
                key={grd.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {grd.title}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {grd.location} • {new Date(grd.gradingDate).toLocaleDateString()}
                  </Text>
                  {grd.candidateCount ? (
                    <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 1 }]}>
                      {grd.candidateCount} Candidates Registered
                    </Text>
                  ) : null}
                </View>
                <StatusBadge
                  status={grd.status}
                  label={grd.status}
                  variant={grd.status === 'SCHEDULED' ? 'warning' : 'info'}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No pending grading events scheduled.
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Master Navigation
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Class Schedules & Rosters"
            onPress={() => navigation?.navigate('Classes')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-classes"
          />
          <Button
            label="Mat Session Attendance"
            onPress={() => navigation?.navigate('Attendance')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-attendance"
          />
          <Button
            label="Grading Evaluations"
            onPress={() => navigation?.navigate('Grading')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-grading"
          />
          <Button
            label="Master Profile"
            onPress={() => navigation?.navigate('Profile')}
            variant="outline"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
            testID="shortcut-master-profile"
          />
        </View>
      </Card>
    </ScreenContainer>
  );
};

export { ClassesScreen } from './ClassesScreen';
export { CreateClassScreen } from './CreateClassScreen';
export { ClassProposalStatusScreen } from './ClassProposalStatusScreen';
export { ClassEnrollmentInboxScreen } from './ClassEnrollmentInboxScreen';

export const StudentsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Class Students"
      subtitle="Enrolled Silambam Students"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-students-screen"
      icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Student Scope: Student belt progression history, contact emergency numbers, and individual grading eligibility."
    />
  );
};

export { AttendanceScreen } from './AttendanceScreen';
export { MasterApplicationStatusScreen } from './MasterApplicationStatusScreen';

export const GradingScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Grading"
      subtitle="Belt Promotion & Form Evaluations"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-grading-screen"
      icon={<Award size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Grading Authority: Conduct belt examinations according to the active Persatuan's configurable belt progression."
    />
  );
};

export const MasterProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Master Instructor Profile"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Coach Identity: Master qualifications, Dan rank certifications, affiliated dojos, and session sign out."
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
