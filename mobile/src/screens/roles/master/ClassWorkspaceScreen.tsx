import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {
  ClipboardCheck,
  FileText,
  Clock,
  MapPin,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { resolveBeltDisplay } from '../../../theme/belts';
import { LiveSessionCard, StitchStatCard } from '../../../components/stitch';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState } from '../../../components/Feedback';
import { StudentProfileModal } from '../../../components/StudentProfileModal';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';
import { useReleaseModules } from '../../../hooks/useReleaseModules';
import { LessonPlanModal } from './LessonPlanModal';

export interface ClassWorkspaceScreenProps {
  user: AuthUser;
  navigation?: any;
  route?: {
    params?: {
      classId: string;
      className?: string;
    };
  };
  isOffline?: boolean;
}

const ENROLLMENT_LABEL_KEYS: Record<string, string> = {
  OPEN: 'masterClasses.workspace.enrollmentOpen',
  WAITLIST: 'masterClasses.workspace.enrollmentWaitlist',
  CLOSED: 'masterClasses.workspace.enrollmentClosed',
};

type WorkspaceTab = 'OVERVIEW' | 'STUDENTS' | 'ATTENDANCE' | 'APPLICATIONS' | 'SCHEDULE' | 'NOTICES' | 'SETTINGS';

export const ClassWorkspaceScreen: React.FC<ClassWorkspaceScreenProps> = ({
  user,
  navigation,
  route,
  isOffline,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  const classId = route?.params?.classId || '';

  // Lesson plan modal (teaching module): the session whose plan is open.
  const [lessonPlanSession, setLessonPlanSession] = useState<{ id: string; title: string } | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workspace Data
  const [workspaceData, setWorkspaceData] = useState<any>(null);

  // Students Roster
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('');
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<any | null>(null);

  // Notice creation
  const [noticeMessage, setNoticeMessage] = useState('');
  const [postingNotice, setPostingNotice] = useState(false);

  // Settings form
  const [venueDetails, setVenueDetails] = useState('');
  const [contactChannel, setContactChannel] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('ACTIVE');
  const [enrollmentAvailability, setEnrollmentAvailability] = useState('OPEN');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [settingsFeedbackIsError, setSettingsFeedbackIsError] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    if (!classId) {
      setError(t('masterClasses.workspace.errNoClassId'));
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [wsRes, studentsRes]: [any, any] = await Promise.all([
        apiClient.get(`/classes/${classId}/workspace`),
        apiClient.get(`/classes/${classId}/students?limit=100`),
      ]);

      setWorkspaceData(wsRes);
      setStudents(studentsRes?.students || []);

      if (wsRes?.class) {
        setVenueDetails(wsRes.class.venue_details || wsRes.class.location || '');
        setContactChannel(wsRes.class.contact_channel || '');
        setOperationalStatus(wsRes.class.operational_status || 'ACTIVE');
        setEnrollmentAvailability(wsRes.class.enrollment_availability || 'OPEN');
      }
    } catch (err: any) {
      console.error('[ClassWorkspace fetch error]', err);
      setError(err?.message || t('masterClasses.workspace.errLoad'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, t]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await fetchWorkspace();
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [fetchWorkspace]);

  // Declared after the workspace fetch so the class data request goes out first.
  const release = useReleaseModules();

  const handleUpdateStudentGroup = async (studentId: string, newGroupId: string) => {
    try {
      await apiClient.patch(`/students/${studentId}/group`, { groupId: newGroupId });
      // Refresh students
      const studentsRes: any = await apiClient.get(`/classes/${classId}/students?limit=100`);
      setStudents(studentsRes?.students || []);
      if (selectedStudentForProfile && selectedStudentForProfile.id === studentId) {
        setSelectedStudentForProfile((prev: any) => ({ ...prev, group_id: newGroupId }));
      }
    } catch (err: any) {
      throw new Error(err?.message || t('masterClasses.workspace.errAssignGroup'));
    }
  };

  const handlePostNotice = async () => {
    if (!noticeMessage.trim()) return;
    setPostingNotice(true);
    try {
      await apiClient.post('/notices', {
        classId,
        organizationId: user.organizationId,
        type: 'GENERAL',
        message: noticeMessage.trim(),
      });
      setNoticeMessage('');
      void fetchWorkspace();
    } catch (err: any) {
      Alert.alert(t('masterClasses.workspace.noticeErrorTitle'), err?.message || t('masterClasses.workspace.noticeErrorMessage'));
    } finally {
      setPostingNotice(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsFeedback(null);
    setSettingsFeedbackIsError(false);
    try {
      await apiClient.patch(`/classes/${classId}/settings`, {
        venueDetails,
        contactChannel,
        operationalStatus,
        enrollmentAvailability,
        expectedVersion: workspaceData?.class?.version,
      });
      setSettingsFeedback(t('masterClasses.workspace.settingsSaved'));
      void fetchWorkspace();
    } catch (err: any) {
      setSettingsFeedbackIsError(true);
      setSettingsFeedback(t('masterClasses.workspace.settingsError', { message: err?.message || t('masterClasses.workspace.settingsErrorFallback') }));
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && !workspaceData) {
    return (
      <ScreenContainer testID="class-workspace-screen">
        <ScreenHeader
          title={route?.params?.className || t('masterClasses.workspace.title')}
          subtitle={t('masterClasses.workspace.loadingSubtitle')}
          onBack={() => navigation?.goBack?.()}
        />
        <LoadingState message={t('masterClasses.workspace.loadingMessage')} />
      </ScreenContainer>
    );
  }

  if (error && !workspaceData) {
    return (
      <ScreenContainer testID="class-workspace-screen">
        <ScreenHeader
          title={route?.params?.className || t('masterClasses.workspace.title')}
          subtitle={t('masterClasses.workspace.accessError')}
          onBack={() => navigation?.goBack?.()}
        />
        <ErrorState message={error} onRetry={fetchWorkspace} />
      </ScreenContainer>
    );
  }

  const cls = workspaceData?.class || {};
  const activeStudentsCount = workspaceData?.activeStudentsCount ?? 0;
  const availableSpots = workspaceData?.availableSpots ?? 0;
  const capacity = cls.capacity ?? 30;
  const pendingAppsCount = workspaceData?.pendingApplicationsCount ?? 0;
  const waitlistedAppsCount = workspaceData?.waitlistedApplicationsCount ?? 0;
  const trainingGroups = workspaceData?.trainingGroups || [];
  const todaySessions = workspaceData?.todaySessions || [];
  const upcomingSessions = workspaceData?.upcomingSessions || [];
  const recentNotices = workspaceData?.recentNotices || [];

  // Filtered roster
  const filteredStudents = students.filter((s) => {
    const matchesQuery = !searchQuery || s.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = !selectedGroupFilter || s.group_id === selectedGroupFilter;
    return matchesQuery && matchesGroup;
  });

  return (
    <ScreenContainer scrollable testID="class-workspace-screen">
      <ScreenHeader
        title={cls.name || t('masterClasses.workspace.title')}
        subtitle={`${cls.organization_name || t('masterClasses.workspace.defaultOrg')} • ${cls.location || ''}`}
        onBack={() => navigation?.goBack?.()}
        rightAction={
          <StatusBadge
            status={cls.operational_status || 'ACTIVE'}
            label={cls.operational_status || 'ACTIVE'}
            variant={cls.operational_status === 'ACTIVE' ? 'success' : 'warning'}
            testID="badge-workspace-status"
          />
        }
      />

      {/* Workspace Navigation Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          <Button
            label={t('masterClasses.workspace.tabOverview')}
            onPress={() => setActiveTab('OVERVIEW')}
            variant={activeTab === 'OVERVIEW' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-overview"
          />
          <Button
            label={t('masterClasses.workspace.tabStudents', { count: activeStudentsCount })}
            onPress={() => setActiveTab('STUDENTS')}
            variant={activeTab === 'STUDENTS' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-students"
          />
          <Button
            label={t('masterClasses.workspace.tabAttendance', { count: todaySessions.length })}
            onPress={() => setActiveTab('ATTENDANCE')}
            variant={activeTab === 'ATTENDANCE' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-attendance"
          />
          <Button
            label={t('masterClasses.workspace.tabApps', { count: pendingAppsCount })}
            onPress={() => setActiveTab('APPLICATIONS')}
            variant={activeTab === 'APPLICATIONS' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-applications"
          />
          <Button
            label={t('masterClasses.workspace.tabSchedule')}
            onPress={() => setActiveTab('SCHEDULE')}
            variant={activeTab === 'SCHEDULE' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-schedule"
          />
          <Button
            label={t('masterClasses.workspace.tabNotices', { count: recentNotices.length })}
            onPress={() => setActiveTab('NOTICES')}
            variant={activeTab === 'NOTICES' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-notices"
          />
          <Button
            label={t('masterClasses.workspace.tabSettings')}
            onPress={() => setActiveTab('SETTINGS')}
            variant={activeTab === 'SETTINGS' ? 'primary' : 'outline'}
            size="sm"
            testID="tab-workspace-settings"
          />
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchWorkspace();
            }}
          />
        }
      >
        {/* SECTION A: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            {/* Live Session Card for scheduled mat session */}
            {todaySessions.length > 0 ? (
              <LiveSessionCard
                categoryLabel={t('masterClasses.workspace.activeMatSession')}
                className={todaySessions[0].group_name ? t('masterClasses.workspace.groupSession', { group: todaySessions[0].group_name }) : t('masterClasses.workspace.matSession')}
                scheduleTime={`${todaySessions[0].start_time} - ${todaySessions[0].end_time}`}
                enrolledCount={activeStudentsCount}
                capacity={capacity}
                onRosterCheckPress={() => setActiveTab('ATTENDANCE')}
                onManagePress={() => setActiveTab('SCHEDULE')}
              />
            ) : null}

            {/* Stat Cards - Google Stitch Visual Hierarchy */}
            <View style={[styles.statsRow, { gap: spacing.sm }]}>
              <StitchStatCard
                label={t('masterClasses.workspace.statActiveEnrolled')}
                value={`${activeStudentsCount} / ${capacity}`}
                hasAccentBorder={true}
                testID="stat-active-students"
                style={{ flex: 1 }}
              />
              <StitchStatCard
                label={t('masterClasses.workspace.statAvailableSpots')}
                value={availableSpots}
                testID="stat-available-spots"
                style={{ flex: 1 }}
              />
            </View>

            <View style={[styles.statsRow, { gap: spacing.sm }]}>
              <StitchStatCard
                label={t('masterClasses.workspace.statPendingApps')}
                value={pendingAppsCount}
                testID="stat-pending-applications"
                style={{ flex: 1 }}
              />
              <StitchStatCard
                label={t('masterClasses.workspace.statWaitlisted')}
                value={waitlistedAppsCount}
                testID="stat-waitlisted-applications"
                style={{ flex: 1 }}
              />
            </View>

            {/* Quick Actions */}
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.quickLinks')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button
                  label={t('masterClasses.workspace.rollCall')}
                  onPress={() => navigation?.navigate?.('Attendance', { classId })}
                  variant="primary"
                  size="sm"
                  leftIcon={<ClipboardCheck size={iconSize.sm} color={colors.buttonPrimaryText} />}
                  testID="btn-quick-rollcall"
                />
                <Button
                  label={t('masterClasses.workspace.reviewApplications')}
                  onPress={() => navigation?.navigate?.('ClassEnrollmentInbox', { classId, className: cls.name })}
                  variant="outline"
                  size="sm"
                  leftIcon={<FileText size={iconSize.sm} color={colors.textPrimary} />}
                  testID="btn-quick-applications"
                />
                {release.isEnabled('messaging') ? (
                  <Button
                    label={t('masterClasses.workspace.parentMessages')}
                    onPress={() => navigation?.navigate?.('ParentMasterMessaging', { classId })}
                    variant="outline"
                    size="sm"
                    leftIcon={<Send size={iconSize.sm} color={colors.buttonPrimaryBg} />}
                    testID="btn-quick-messages"
                  />
                ) : null}
                {release.isEnabled('trials') ? (
                  <Button
                    label={t('masterClasses.workspace.trialsFollowUp')}
                    onPress={() => navigation?.navigate?.('TrialsFollowUp', { classId })}
                    variant="outline"
                    size="md"
                    testID="btn-quick-trials"
                    accessibilityLabel={t('masterClasses.workspace.trialsFollowUp')}
                  />
                ) : null}
                {release.isEnabled('transfers') ? (
                  <Button
                    label={t('masterClasses.workspace.transfers')}
                    onPress={() => navigation?.navigate?.('TransfersManagement', { classId })}
                    variant="outline"
                    size="md"
                    testID="btn-quick-transfers"
                    accessibilityLabel={t('masterClasses.workspace.transfers')}
                  />
                ) : null}
              </View>
            </Card>

            {/* Today's Mat Sessions */}
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.todaysMatSessions')}
              </Text>
              {todaySessions.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('masterClasses.workspace.noSessionsToday')}
                </Text>
              ) : (
                todaySessions.map((sess: any) => (
                  <View key={sess.id} style={[styles.sessionRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                        {sess.start_time} - {sess.end_time} • {sess.group_name || t('masterClasses.workspace.allGroups')}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {sess.location}
                      </Text>
                    </View>
                    <StatusBadge
                      status={sess.status}
                      label={sess.status}
                      variant={sess.status === 'Cancelled' ? 'danger' : 'success'}
                      testID={`badge-session-${sess.id}`}
                    />
                  </View>
                ))
              )}
            </Card>

            {/* Recent Notices */}
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.recentNotices')}
              </Text>
              {recentNotices.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('masterClasses.workspace.noNoticesForClass')}
                </Text>
              ) : (
                recentNotices.slice(0, 3).map((not: any) => (
                  <View key={not.id} style={[styles.noticeItem, { borderColor: colors.border }]}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{not.message}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {not.sender_name || t('masterClasses.workspace.senderFallback')}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {/* SECTION B: STUDENTS ROSTER */}
        {activeTab === 'STUDENTS' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            {/* Search and Filters */}
            <Card variant="standard" style={styles.card}>
              <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                <Search size={iconSize.sm} color={colors.textSecondary} />
                <TextInput
                  placeholder={t('masterClasses.workspace.searchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[typography.bodyMedium, { flex: 1, color: colors.textPrimary, marginLeft: spacing.xs }]}
                  testID="input-search-roster"
                />
              </View>

              {/* Group filter pills */}
              {trainingGroups.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    onPress={() => setSelectedGroupFilter('')}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: selectedGroupFilter === '' ? colors.buttonPrimaryBg : colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: selectedGroupFilter === '' ? colors.buttonPrimaryText : colors.textPrimary },
                      ]}
                    >
                      {t('masterClasses.workspace.allGroups')}
                    </Text>
                  </TouchableOpacity>
                  {trainingGroups.map((grp: any) => (
                    <TouchableOpacity
                      key={grp.id}
                      onPress={() => setSelectedGroupFilter(grp.id)}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor:
                            selectedGroupFilter === grp.id ? colors.buttonPrimaryBg : colors.surfaceElevated,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: selectedGroupFilter === grp.id ? colors.buttonPrimaryText : colors.textPrimary },
                        ]}
                      >
                        {grp.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </Card>

            {/* Students List */}
            {filteredStudents.length === 0 ? (
              <Card variant="standard" style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  {t('masterClasses.workspace.noStudentsMatch')}
                </Text>
              </Card>
            ) : (
              filteredStudents.map((stu) => (
                <TouchableOpacity
                  key={stu.id}
                  onPress={() => setSelectedStudentForProfile(stu)}
                  testID={`student-row-${stu.id}`}
                >
                  <Card variant="standard" style={styles.card}>
                    <View style={styles.rowBetween}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: '#EAF1F7',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontWeight: '700', fontSize: 13, color: '#0D2B47' }}>
                            {stu.full_name
                              ?.split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase() || 'ST'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                            {stu.full_name}
                          </Text>
                          {(() => {
                            const belt = resolveBeltDisplay(stu.belt_rank);
                            return (
                              <View
                                style={{
                                  alignSelf: 'flex-start',
                                  backgroundColor: belt.colorHex,
                                  borderColor: belt.borderColor || '#CBD5E1',
                                  borderWidth: 1,
                                  borderRadius: 4,
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  marginTop: 3,
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: belt.textColor || '#0F172A' }}>
                                  {stu.belt_rank || t('masterClasses.workspace.beltFallback')}
                                </Text>
                              </View>
                            );
                          })()}
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 3 }]}>
                            {t('masterClasses.workspace.studentMeta', { group: stu.group_name || t('masterClasses.workspace.unassigned'), ic: stu.ic_number })}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <StatusBadge status="ACTIVE" label={t('masterClasses.workspace.enrolled')} variant="success" />
                        <Button
                          label={t('masterClasses.workspace.profile')}
                          onPress={() => setSelectedStudentForProfile(stu)}
                          variant="outline"
                          size="sm"
                          testID={`btn-profile-${stu.id}`}
                        />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* SECTION C: ATTENDANCE */}
        {activeTab === 'ATTENDANCE' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                {t('masterClasses.workspace.attendanceOps')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                {t('masterClasses.workspace.attendanceOpsDesc')}
              </Text>

              {/* SEC-QR-001 Resolved Security Badge */}
              <View
                style={[
                  styles.securityNotice,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <ShieldCheck size={iconSize.sm} color={colors.badgeSuccessText} />
                <Text style={[typography.caption, { color: colors.badgeSuccessText, flex: 1 }]}>
                  {t('masterClasses.workspace.secQrResolved')}
                </Text>
              </View>

              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  label={t('masterClasses.workspace.openRollCall')}
                  onPress={() => navigation?.navigate?.('Attendance', { classId })}
                  variant="primary"
                  size="md"
                  leftIcon={<ClipboardCheck size={iconSize.md} color={colors.buttonPrimaryText} />}
                  testID="btn-open-attendance-screen"
                />
              </View>
            </Card>

            <Card variant="standard" style={styles.card}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.todaysSessionsRoster')}
              </Text>
              {todaySessions.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('masterClasses.workspace.noActiveSession')}
                </Text>
              ) : (
                todaySessions.map((s: any) => (
                  <View key={s.id} style={[styles.sessionRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                        {s.start_time} - {s.end_time}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {s.location} • {s.status}
                      </Text>
                    </View>
                    <Button
                      label={t('masterClasses.workspace.takeRollCall')}
                      onPress={() => navigation?.navigate?.('Attendance', { classId, sessionId: s.id })}
                      variant="outline"
                      size="sm"
                      testID={`btn-rollcall-${s.id}`}
                    />
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {/* SECTION D: APPLICATIONS */}
        {activeTab === 'APPLICATIONS' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                {t('masterClasses.workspace.applicationsTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                {t('masterClasses.workspace.applicationsDesc')}
              </Text>

              <Button
                label={t('masterClasses.workspace.reviewApplicationsPending', { count: pendingAppsCount })}
                onPress={() => navigation?.navigate?.('ClassEnrollmentInbox', { classId, className: cls.name })}
                variant="primary"
                size="md"
                testID="btn-navigate-applications-inbox"
              />
            </Card>
          </View>
        )}

        {/* SECTION E: SCHEDULE */}
        {activeTab === 'SCHEDULE' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.classSchedules')}
              </Text>
              <View style={[styles.scheduleItem, { borderColor: colors.border }]}>
                <Clock size={iconSize.sm} color={colors.buttonPrimaryBg} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{t('masterClasses.workspace.regularSchedule')}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{cls.schedule || t('masterClasses.workspace.standardTime')}</Text>
                </View>
              </View>
              <View style={[styles.scheduleItem, { borderColor: colors.border, marginTop: spacing.xs }]}>
                <MapPin size={iconSize.sm} color={colors.buttonPrimaryBg} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{t('masterClasses.workspace.venueLocation')}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {cls.venue_details || cls.location || t('masterClasses.workspace.venueFallback')}
                  </Text>
                </View>
              </View>
            </Card>

            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.upcomingSessions')}
              </Text>
              {upcomingSessions.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{t('masterClasses.workspace.noUpcomingSessions')}</Text>
              ) : (
                upcomingSessions.map((sess: any) => (
                  <View key={sess.id} style={[styles.sessionRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                        {sess.session_date} • {sess.start_time} - {sess.end_time}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {sess.location} • {sess.group_name || t('masterClasses.workspace.allGroups')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                      <StatusBadge
                        status={sess.status}
                        label={sess.status}
                        variant={sess.status === 'Cancelled' ? 'danger' : 'info'}
                      />
                      {release.isEnabled('teaching') ? (
                        <Button
                          label={t('masterClasses.workspace.lessonPlanBtn')}
                          onPress={() =>
                            setLessonPlanSession({
                              id: sess.id,
                              title: `${sess.session_date} • ${sess.start_time} - ${sess.end_time}`,
                            })
                          }
                          variant="outline"
                          size="md"
                          testID={`btn-lesson-plan-${sess.id}`}
                          accessibilityLabel={t('masterClasses.workspace.lessonPlanA11y', { date: sess.session_date, time: sess.start_time })}
                        />
                      ) : null}
                      {release.isEnabled('bookings') ? (
                        <Button
                          label={t('masterClasses.workspace.makeUpBtn')}
                          onPress={() => navigation?.navigate?.('MakeUpWaitlist', { sessionId: sess.id, classId })}
                          variant="outline"
                          size="md"
                          testID={`btn-makeup-${sess.id}`}
                          accessibilityLabel={t('masterClasses.workspace.makeUpA11y', { date: sess.session_date, time: sess.start_time })}
                        />
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {/* SECTION F: NOTICES */}
        {activeTab === 'NOTICES' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                {t('masterClasses.workspace.postNoticeTitle')}
              </Text>
              <TextInput
                placeholder={t('masterClasses.workspace.noticePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={noticeMessage}
                onChangeText={setNoticeMessage}
                multiline
                numberOfLines={3}
                style={[
                  typography.bodyMedium,
                  styles.textArea,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceElevated },
                ]}
                testID="input-notice-message"
              />
              <Button
                label={postingNotice ? t('masterClasses.workspace.posting') : t('masterClasses.workspace.postClassNotice')}
                onPress={handlePostNotice}
                variant="primary"
                size="sm"
                loading={postingNotice}
                leftIcon={<Send size={iconSize.sm} color={colors.buttonPrimaryText} />}
                style={{ marginTop: spacing.sm }}
                testID="btn-post-notice"
              />
            </Card>

            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.noticeHistory')}
              </Text>
              {recentNotices.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{t('masterClasses.workspace.noNoticesYet')}</Text>
              ) : (
                recentNotices.map((n: any) => (
                  <View key={n.id} style={[styles.noticeItem, { borderColor: colors.border }]}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{n.message}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                      {t('masterClasses.workspace.postedOn', { date: n.created_at ? new Date(n.created_at).toLocaleDateString() : t('masterClasses.workspace.postedRecent') })}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {/* SECTION G: SETTINGS */}
        {activeTab === 'SETTINGS' && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                {t('masterClasses.workspace.settingsTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                {t('masterClasses.workspace.settingsDesc')}
              </Text>

              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: 4, fontWeight: '600' }]}>
                {t('masterClasses.workspace.venueDetails')}
              </Text>
              <TextInput
                value={venueDetails}
                onChangeText={setVenueDetails}
                style={[
                  typography.bodyMedium,
                  styles.input,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceElevated },
                ]}
                placeholder={t('masterClasses.workspace.venuePlaceholder')}
                placeholderTextColor={colors.textMuted}
                testID="input-settings-venue"
              />

              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, marginBottom: 4, fontWeight: '600' }]}>
                {t('masterClasses.workspace.contactChannel')}
              </Text>
              <TextInput
                value={contactChannel}
                onChangeText={setContactChannel}
                style={[
                  typography.bodyMedium,
                  styles.input,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceElevated },
                ]}
                placeholder={t('masterClasses.workspace.contactPlaceholder')}
                placeholderTextColor={colors.textMuted}
                testID="input-settings-contact"
              />

              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, marginBottom: 4, fontWeight: '600' }]}>
                {t('masterClasses.workspace.operationalStatus')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label={t('masterClasses.workspace.statusActive')}
                  onPress={() => setOperationalStatus('ACTIVE')}
                  variant={operationalStatus === 'ACTIVE' ? 'primary' : 'outline'}
                  size="sm"
                  testID="btn-status-active"
                />
                <Button
                  label={t('masterClasses.workspace.statusPaused')}
                  onPress={() => setOperationalStatus('PAUSED')}
                  variant={operationalStatus === 'PAUSED' ? 'primary' : 'outline'}
                  size="sm"
                  testID="btn-status-paused"
                />
              </View>

              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, marginBottom: 4, fontWeight: '600' }]}>
                {t('masterClasses.workspace.enrollmentAvailability')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {['OPEN', 'WAITLIST', 'CLOSED'].map((st) => (
                  <Button
                    key={st}
                    label={t(ENROLLMENT_LABEL_KEYS[st])}
                    onPress={() => setEnrollmentAvailability(st)}
                    variant={enrollmentAvailability === st ? 'primary' : 'outline'}
                    size="sm"
                    testID={`btn-enrollment-${st.toLowerCase()}`}
                  />
                ))}
              </View>

              {settingsFeedback ? (
                <Text
                  style={[
                    typography.caption,
                    {
                      marginTop: spacing.sm,
                      color: settingsFeedbackIsError ? colors.badgeDangerText : colors.badgeSuccessText,
                    },
                  ]}
                >
                  {settingsFeedback}
                </Text>
              ) : null}

              <Button
                label={savingSettings ? t('masterClasses.workspace.saving') : t('masterClasses.workspace.saveSettings')}
                onPress={handleSaveSettings}
                variant="primary"
                size="md"
                loading={savingSettings}
                style={{ marginTop: spacing.md }}
                testID="btn-save-settings"
              />
            </Card>

            <Card style={styles.card}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                {t('masterClasses.workspace.leadershipTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                {t('masterClasses.workspace.leadershipDesc')}
              </Text>
              <Button
                label={t('masterClasses.workspace.manageLeadership')}
                onPress={() => navigation?.navigate?.('ClassHandover', { classId, className: workspaceData?.class?.name })}
                variant="outline"
                size="md"
                testID="btn-manage-leadership"
              />
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Teaching Student Profile Modal */}
      <StudentProfileModal
        visible={Boolean(selectedStudentForProfile)}
        onClose={() => setSelectedStudentForProfile(null)}
        student={selectedStudentForProfile}
        trainingGroups={trainingGroups}
        onUpdateGroup={handleUpdateStudentGroup}
      />

      {/* Lesson plan for one session (teaching module) */}
      {lessonPlanSession && release.isEnabled('teaching') ? (
        <LessonPlanModal
          visible
          onClose={() => setLessonPlanSession(null)}
          sessionId={lessonPlanSession.id}
          sessionTitle={lessonPlanSession.title}
        />
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
  },
  card: {
    padding: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  noticeItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  textArea: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 70,
  },
});
