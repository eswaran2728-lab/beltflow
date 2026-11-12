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
import { useI18n } from '../../../i18n';
import { useReleaseModules } from '../../../hooks/useReleaseModules';

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
  const { t } = useI18n();
  const release = useReleaseModules();

  const fetcher = useCallback(() => {
    return dashboardService.getMasterDashboard(user);
  }, [user]);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<MasterDashboardData>({
    fetcher,
    isOffline,
  });

  const headerRightAction = onLogout ? (
    <Button
      label={t('masterHome.signOut')}
      onPress={onLogout}
      variant="outline"
      size="sm"
      leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
      testID="btn-role-logout"
      accessibilityLabel={t('masterHome.signOutA11y')}
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
              {t('masterHome.persatuanLabel', { org: user.organizationId })}
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
          dojangName={user.organizationId ? t('masterHome.headerPersatuan', { org: user.organizationId.toUpperCase() }) : t('masterHome.headerPersatuanFallback')}
          roleBadgeText="MASTER"
          hasUnreadNotifications={false}
        />
        <ScreenContainer scrollable testID="master-home-screen">
          <ScreenHeader title={t('masterHome.welcome', { name: user.fullName })} subtitle={t('masterHome.subtitle')} rightAction={headerRightAction} />
          {isOffline ? (
            <View style={{ marginBottom: spacing.md }}>
              <OfflineBanner
                message={t('masterHome.offlineBanner')}
                testID="offline-security-banner"
              />
            </View>
          ) : null}
          {renderIdentityCard()}
          <LoadingState message={t('masterHome.loading')} />
        </ScreenContainer>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchAppHeader
          dojangName={user.organizationId ? t('masterHome.headerPersatuan', { org: user.organizationId.toUpperCase() }) : t('masterHome.headerPersatuanFallback')}
          roleBadgeText="MASTER"
          hasUnreadNotifications={false}
        />
        <ScreenContainer scrollable testID="master-home-screen">
          <ScreenHeader title={t('masterHome.welcome', { name: user.fullName })} subtitle={t('masterHome.subtitle')} rightAction={headerRightAction} />
          {isOffline ? (
            <View style={{ marginBottom: spacing.md }}>
              <OfflineBanner
                message={t('masterHome.offlineBanner')}
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
        dojangName={user.organizationId ? t('masterHome.headerPersatuan', { org: user.organizationId.toUpperCase() }) : t('masterHome.headerPersatuanFallback')}
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
          title={t('masterHome.welcome', { name: user.fullName })}
          subtitle={t('masterHome.subtitle')}
          rightAction={headerRightAction}
        />

        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('masterHome.offlineBanner')}
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
                    {t('masterHome.pendingSync', { count: data.offlineSyncPendingCount })}
                  </Text>
                ) : null}
                {data.offlineConflictCount ? (
                  <Text style={[typography.caption, { color: colors.badgeWarningText, fontWeight: '700', marginTop: 2 }]} testID="badge-attendance-conflicts">
                    {t('masterHome.syncConflicts', { count: data.offlineConflictCount })}
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
              {t('masterHome.onboardingTitle')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
              {data?.onboarding?.message || t('masterHome.onboardingMessage')}
            </Text>
            <Button
              label={t('masterHome.proposeClass')}
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
              categoryLabel={t('masterHome.activeMatSession')}
              className={(data.todaySessions[0] as any).group_name || data.todaySessions[0].location || t('masterHome.sessionFallback')}
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
            label={t('masterHome.statClasses')}
            value={data?.assignedClassesCount ?? 0}
            hasAccentBorder={true}
            testID="stat-master-classes"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label={t('masterHome.statStudents')}
            value={data?.assignedStudentsCount ?? 0}
            testID="stat-master-students"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label={t('masterHome.statTodaySessions')}
            value={data?.todaySessionsCount ?? 0}
            testID="stat-master-sessions"
            style={{ flex: 1 }}
          />
        </View>

        <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
          <StitchStatCard
            label={t('masterHome.statPendingApps')}
            value={data?.pendingApplicationsCount ?? 0}
            testID="stat-master-applications"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label={t('masterHome.statProposals')}
            value={data?.pendingProposalsCount ?? 0}
            testID="stat-master-proposals"
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label={t('masterHome.statPendingGradings')}
            value={data?.pendingGradingCount ?? 0}
            testID="stat-master-gradings"
            style={{ flex: 1 }}
          />
        </View>

      {/* Today's Training Sessions */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('masterHome.todaySessionsTitle')}
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
            {t('masterHome.noSessionsToday')}
          </Text>
        )}
      </Card>

      {/* Authorized Assigned Classes */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('masterHome.assignedClasses')}
          </Text>
          <StatusBadge status="ASSIGNED" label={t('masterHome.activeCount', { count: data?.assignedClassesCount ?? 0 })} variant="info" />
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
                    {t('masterHome.classFee', { location: cls.location, fee: cls.monthlyFee })}
                  </Text>
                </View>
                <Button
                  label={t('masterHome.workspace')}
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
            {t('masterHome.noClassesAssigned')}
          </Text>
        )}
      </Card>

      {/* Pending Grading Events */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('masterHome.gradingTitle')}
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
                      {t('masterHome.candidatesRegistered', { count: grd.candidateCount })}
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
            {t('masterHome.noGradingEvents')}
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          {t('masterHome.navTitle')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('masterHome.navClasses')}
            onPress={() => navigation?.navigate('Classes')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-classes"
          />
          <Button
            label={t('masterHome.navAttendance')}
            onPress={() => navigation?.navigate('Attendance')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-attendance"
          />
          <Button
            label={t('masterHome.navGrading')}
            onPress={() => navigation?.navigate('Grading')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-grading"
          />
          <Button
            label={t('masterHome.navIncomingHandovers')}
            onPress={() => navigation?.navigate('Classes', { screen: 'IncomingHandovers' })}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-master-incoming-handovers"
            accessibilityLabel={t('masterHome.navIncomingHandoversA11y')}
          />
          {release.isEnabled('messaging') ? (
            <Button
              label={t('masterHome.navMessages')}
              onPress={() => navigation?.navigate('Classes', { screen: 'ParentMasterMessaging' })}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-master-messaging"
            />
          ) : null}
          <Button
            label={t('masterHome.navProfile')}
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
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      title={t('masterHome.studentsTitle')}
      subtitle={t('masterHome.studentsSubtitle')}
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-students-screen"
      icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('masterHome.studentsScope')}
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
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      showLanguageSelector
      title={t('masterHome.profileTitle')}
      subtitle={t('masterHome.profileSubtitle')}
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('masterHome.profileScope')}
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
