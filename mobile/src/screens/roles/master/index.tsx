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
import {
  StitchAppHeader,
  LiveSessionCard,
  StitchStatCard,
} from '../../../components/stitch';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchAppHeader
          dojangName={user.organizationId ? `PERSATUAN: ${user.organizationId.toUpperCase()}` : 'PERSATUAN DOJANG'}
          roleBadgeText="MASTER"
          hasUnreadNotifications={false}
        />
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
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchAppHeader
          dojangName={user.organizationId ? `PERSATUAN: ${user.organizationId.toUpperCase()}` : 'PERSATUAN DOJANG'}
          roleBadgeText="MASTER"
          hasUnreadNotifications={false}
        />
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StitchAppHeader
        dojangName={user.organizationId ? `PERSATUAN: ${user.organizationId.toUpperCase()}` : 'PERSATUAN DOJANG'}
        roleBadgeText="MASTER"
        hasUnreadNotifications={Boolean(data?.recentNotices?.length || data?.pendingApplicationsCount)}
        onNotificationPress={() => navigation?.navigate?.('Classes')}
      />

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

        {/* Offline Pending Sync and Conflict Alerts */}
        {(data?.offlineSyncPendingCount && data.offlineSyncPendingCount > 0) || (data?.offlineConflictCount && data.offlineConflictCount > 0) ? (
          <Card variant="standard" style={{ padding: 12, marginBottom: spacing.md, backgroundColor: colors.surfaceElevated, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                {data.offlineSyncPendingCount ? (
                  <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700' }]} testID="badge-offline-pending-sync">
                    Pending Sync: {data.offlineSyncPendingCount} attendance mutation(s) queued
                  </Text>
                ) : null}
                {data.offlineConflictCount ? (
                  <Text style={[typography.caption, { color: colors.badgeWarningText, fontWeight: '700', marginTop: 2 }]} testID="badge-attendance-conflicts">
                    Sync Conflicts: {data.offlineConflictCount} conflict(s) require review
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        ) : null}

        {/* Onboarding State: For Master with no approved classes */}
        {data?.hasApprovedClasses === false ? (
          <Card variant="standard" style={{ padding: 20, alignItems: 'center', marginBottom: spacing.md }} testID="master-onboarding-card">
            <Calendar size={iconSize.lg} color={colors.buttonPrimaryBg} />
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              Welcome to BeltFlow Class Management
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
              {data?.onboarding?.message || 'You currently have no active approved classes. Propose a new class to your Persatuan to start enrolling students.'}
            </Text>
            <Button
              label="Propose a New Class"
              onPress={() => navigation?.navigate?.('Classes', { screen: 'CreateClass' })}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.md }}
              testID="btn-onboarding-propose-class"
            />
          </Card>
        ) : null}

        {/* Live Active Mat Session - Google Stitch Card */}
        {data?.todaySessions && data.todaySessions.length > 0 ? (
          <View style={{ marginBottom: spacing.md }}>
            <LiveSessionCard
              categoryLabel="ACTIVE MAT SESSION"
              className={(data.todaySessions[0] as any).group_name || data.todaySessions[0].location || 'Silambam Session'}
              scheduleTime={`${data.todaySessions[0].startTime} - ${data.todaySessions[0].endTime}`}
              enrolledCount={data.assignedStudentsCount ?? 0}
              onRosterCheckPress={() => navigation?.navigate?.('Attendance', { classId: data.todaySessions[0].classId || data.classes?.[0]?.id })}
              onManagePress={() => navigation?.navigate?.('Classes', { screen: 'ClassWorkspace', params: { classId: data.todaySessions[0].classId || data.classes?.[0]?.id } })}
            />
          </View>
        ) : null}

        {/* Master Coaching Stat Metrics - Google Stitch Hierarchy */}
        <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
          <StitchStatCard
            label="My Classes"
            value={data?.assignedClassesCount ?? 0}
            hasAccentBorder={true}
            testID="stat-master-classes"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label="Students"
            value={data?.assignedStudentsCount ?? 0}
            testID="stat-master-students"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label="Today's Sessions"
            value={data?.todaySessionsCount ?? 0}
            testID="stat-master-sessions"
            style={{ flex: 1 }}
          />
        </View>

        <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
          <StitchStatCard
            label="Pending Apps"
            value={data?.pendingApplicationsCount ?? 0}
            testID="stat-master-applications"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label="Class Proposals"
            value={data?.pendingProposalsCount ?? 0}
            testID="stat-master-proposals"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label="Pending Gradings"
            value={data?.pendingGradingCount ?? 0}
            testID="stat-master-gradings"
            style={{ flex: 1 }}
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
                <Button
                  label="Workspace"
                  onPress={() => navigation?.navigate?.('Classes', { screen: 'ClassWorkspace', params: { classId: cls.id, className: cls.name } })}
                  variant="primary"
                  size="sm"
                  testID={`btn-home-workspace-${cls.id}`}
                />
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
            label="Parent-Master Messages"
            onPress={() => navigation?.navigate('Classes', { screen: 'ParentMasterMessaging' })}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-messaging"
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
    </View>
  );
};

export { ClassesScreen } from './ClassesScreen';
export { CreateClassScreen } from './CreateClassScreen';
export { ClassProposalStatusScreen } from './ClassProposalStatusScreen';
export { ClassEnrollmentInboxScreen } from './ClassEnrollmentInboxScreen';
export { ClassWorkspaceScreen } from './ClassWorkspaceScreen';

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
export { ClassHandoverScreen } from './ClassHandoverScreen';
export { IncomingHandoversScreen } from './IncomingHandoversScreen';
export { MasterTrialsFollowUpScreen } from './MasterTrialsFollowUpScreen';
export { MasterMakeUpManagementScreen } from './MasterMakeUpManagementScreen';
export { MasterTransferManagementScreen } from './MasterTransferManagementScreen';
export { LessonPlanModal } from './LessonPlanModal';
export { ParentMasterMessagingScreen } from '../parent/ParentMasterMessagingScreen';

export { MasterGradingScreen as GradingScreen } from './MasterGradingScreen';

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
