import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import {
  Users,
  DollarSign,
  CheckSquare,
  Award,
  Bell,
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
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, ParentDashboardData, ParentChildSummary } from '../../../services/dashboardService';
import { ParentChildPassViewer, LinkedChildPassData } from '../../../components/ParentChildPassViewer';
import { ParentFeesPaymentScreen } from './ParentFeesPaymentScreen';

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const ParentHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius } = useTheme();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    return dashboardService.getParentDashboard(user);
  }, [user]);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<ParentDashboardData>({
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
          status={UserRole.PARENT}
          label="PARENT"
          variant="info"
          testID="badge-role-parent"
        />
      </View>
    </Card>
  );

  const children = data?.children || [];
  const activeChild: ParentChildSummary | undefined =
    children.find(c => c.id === selectedChildId) || children[0];

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="parent-home-screen">
        <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Parent Home" rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message="Loading family dashboard..." />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="parent-home-screen">
        <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Parent Home" rightAction={headerRightAction} />
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
      testID="parent-home-screen"
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
        subtitle="Parent Home"
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

      {/* Linked Children Section */}
      {children.length === 0 ? (
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <EmptyState
            title="No Linked Children"
            description="No approved student profiles are currently linked to your family account. Contact your Persatuan academy to approve family linking."
            testID="empty-linked-children"
          />
        </Card>
      ) : (
        <>
          {/* Linked Children Tab Switcher (if more than 1 child) */}
          {children.length > 1 ? (
            <View style={[styles.childSwitcherContainer, { marginBottom: spacing.md }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                {children.map(child => {
                  const isSelected = (activeChild?.id === child.id);
                  return (
                    <TouchableOpacity
                      key={child.id}
                      onPress={() => setSelectedChildId(child.id)}
                      testID={`child-tab-${child.id}`}
                      style={[
                        styles.childTab,
                        {
                          backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.surfaceElevated,
                          borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                          borderRadius: borderRadius.full,
                        },
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Select child ${child.fullName}`}
                    >
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: isSelected ? colors.buttonPrimaryText : colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {child.fullName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Active Child Overview Card */}
          {activeChild ? (
            <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
              <View style={styles.childHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {activeChild.fullName}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {activeChild.className || 'Silambam Cohort'} • Fee: RM {activeChild.monthlyFee}/mo
                  </Text>
                </View>
                <BeltBadge beltName={activeChild.beltRank} size="md" testID="parent-active-child-belt" />
              </View>

              {/* Child Stat Metrics Grid */}
              <View style={[styles.statsGrid, { gap: spacing.sm, marginTop: spacing.md }]}>
                <StatCard
                  title="Outstanding Dues"
                  value={`RM ${activeChild.totalPending}`}
                  subtitle={activeChild.monthsPendingCount > 0 ? `${activeChild.monthsPendingCount} Mo. Overdue` : 'Up to date'}
                  icon={<DollarSign size={iconSize.md} color={activeChild.totalPending > 0 ? colors.badgeDangerText : colors.badgeSuccessText} />}
                  testID="stat-parent-fees"
                />
                <StatCard
                  title="Attendance"
                  value={`${activeChild.attendancePresent} / ${activeChild.attendanceTotal}`}
                  subtitle="Sessions Attended"
                  icon={<CheckSquare size={iconSize.md} color={colors.badgeSuccessText} />}
                  testID="stat-parent-attendance"
                />
              </View>

              {/* Upcoming Classes for Active Child */}
              {activeChild.upcomingSessions && activeChild.upcomingSessions.length > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                    Upcoming Sessions
                  </Text>
                  {activeChild.upcomingSessions.map(sess => (
                    <View
                      key={sess.id}
                      style={[
                        styles.itemRow,
                        { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: spacing.xs },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                          {sess.sessionDate} ({sess.startTime} - {sess.endTime})
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {sess.location}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Certificates for Active Child */}
              {activeChild.certificates && activeChild.certificates.length > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                    Official Certificates
                  </Text>
                  {activeChild.certificates.map(cert => (
                    <View
                      key={cert.id}
                      style={[
                        styles.itemRow,
                        { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: spacing.xs },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                          {cert.beltRank}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          Cert #{cert.certificateNumber} • {new Date(cert.issuedDate).toLocaleDateString()}
                        </Text>
                      </View>
                      <Award size={20} color={colors.buttonPrimaryBg} />
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}
        </>
      )}

      {/* Academy Notices & Announcements */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Academy Notices
          </Text>
          <Bell size={20} color={colors.buttonPrimaryBg} />
        </View>

        {data?.notices && data.notices.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.notices.map(notice => (
              <View
                key={notice.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {notice.title}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {notice.content}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {new Date(notice.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {notice.priority === 'HIGH' ? (
                  <StatusBadge status="URGENT" label="Urgent" variant="danger" />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No announcements posted at this time.
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Parent Shortcuts
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Tuition Fees & Payments"
            onPress={() => navigation?.navigate('Fees')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-parent-fees"
          />
          <Button
            label="Linked Children Roster"
            onPress={() => navigation?.navigate('Children')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-parent-children"
          />
          <Button
            label="Academy Notice Board"
            onPress={() => navigation?.navigate('Notices')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-parent-notices"
          />
          <Button
            label="Parent Profile"
            onPress={() => navigation?.navigate('Profile')}
            variant="outline"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
            testID="shortcut-parent-profile"
          />
        </View>
      </Card>
    </ScreenContainer>
  );
};

export const ChildrenScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const fetcher = useCallback(() => {
    return dashboardService.getParentDashboard(props.user);
  }, [props.user]);
  const { data } = useDashboardData<ParentDashboardData>({
    fetcher,
    isOffline: props.isOffline,
  });

  const childrenList: LinkedChildPassData[] = (data?.children || []).map(c => ({
    id: c.id,
    organizationId: props.user.organizationId || '',
    fullName: c.fullName,
    beltRank: c.beltRank,
    status: (c as any).status || 'ACTIVE',
  }));

  return (
    <ScreenContainer scrollable testID="parent-children-screen">
      <ScreenHeader
        title="Children's Passes"
        subtitle="Approved Linked Martial Artists"
      />
      {props.isOffline && (
        <View style={{ marginBottom: 12 }}>
          <OfflineBanner message="Operating in offline mode. Viewing locally cached student passes." />
        </View>
      )}
      <ParentChildPassViewer
        childrenList={childrenList}
        isOffline={props.isOffline}
        testID="parent-pass-viewer"
      />
      <RolePlaceholderBase
        title="Student Progress Overview"
        subtitle="Approved Linked Students"
        role={UserRole.PARENT}
        user={props.user}
        onLogout={props.onLogout}
        isOffline={props.isOffline}
        testID="parent-children-overview"
        icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
        scopeDescription="Linked Students: Monitor children's training attendance streaks, syllabus milestones, and grading eligibility."
      />
    </ScreenContainer>
  );
};

export const FeesScreen: React.FC<RoleScreenProps> = props => {
  return <ParentFeesPaymentScreen {...props} />;
};
export { ParentFeesPaymentScreen };
export { ParentBookTrialScreen } from './ParentBookTrialScreen';
export { ParentMakeUpBookingScreen } from './ParentMakeUpBookingScreen';
export { ParentStudentLifecycleScreen } from './ParentStudentLifecycleScreen';

export const NoticesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Notices"
      subtitle="Academy Announcements & Grading Dates"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-notices-screen"
      icon={<Bell size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Notice Board: Academy holiday notifications, tournament invitations, and federation announcements."
    />
  );
};

export const ParentProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Parent & Guardian Identity"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Guardian Scope: Contact information, emergency notification preferences, linked students, and sign out."
    />
  );
};

export { AvailableClassesScreen } from './AvailableClassesScreen';
export { MyApplicationsScreen } from '../student/MyApplicationsScreen';

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
  childHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  childSwitcherContainer: {
    flexDirection: 'row',
  },
  childTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
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
