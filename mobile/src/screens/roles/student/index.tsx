import React, { useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import {
  Award,
  CheckSquare,
  FileText,
  Calendar,
  Bell,
  ArrowRight,
  User,
  Sparkles,
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
import { OfflineBanner, LoadingState, ErrorState } from '../../../components/Feedback';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, StudentDashboardData } from '../../../services/dashboardService';
import { getNextBeltLevel } from '../../../theme/belts';

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const StudentHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize, belts, borderRadius } = useTheme();

  const fetcher = useCallback(() => {
    return dashboardService.getStudentDashboard();
  }, []);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<StudentDashboardData>({
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
          status={UserRole.STUDENT}
          label="STUDENT"
          variant="info"
          testID="badge-role-student"
        />
      </View>
    </Card>
  );

  const currentBeltRank = data?.student?.beltRank || 'Unassigned';
  const hasConfiguredBelts = Boolean(belts && belts.length > 0);
  const nextTargetBelt = hasConfiguredBelts ? getNextBeltLevel(currentBeltRank, belts) : null;
  const sortedBelts = hasConfiguredBelts ? [...belts].sort((a, b) => a.order - b.order) : [];
  const highestBelt = sortedBelts.length > 0 ? sortedBelts[sortedBelts.length - 1] : null;
  const isHighestRank = Boolean(
    hasConfiguredBelts &&
    highestBelt &&
    (highestBelt.name.toLowerCase() === currentBeltRank.toLowerCase() ||
     highestBelt.id.toLowerCase() === currentBeltRank.toLowerCase())
  );

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="student-home-screen">
        <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Student Home" rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message="Loading training journey..." />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="student-home-screen">
        <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Student Home" rightAction={headerRightAction} />
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
      testID="student-home-screen"
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
        subtitle="Student Home"
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

      {/* Academy & Belt Progression Hero Card */}
      <Card variant="elevated" style={[styles.beltProgressCard, { marginBottom: spacing.md }]}>
        <View style={styles.beltHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
              Affiliated Persatuan
            </Text>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 2 }]}>
              {data?.persatuanName || 'Persatuan Silambam'}
            </Text>
          </View>
          <StatusBadge
            status={data?.student?.status || 'ACTIVE'}
            label={data?.student?.status || 'ACTIVE'}
            variant="success"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Current Belt & Next Target Progression */}
        <View style={styles.rankDetailsRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Current Rank
            </Text>
            <View style={{ marginTop: 6 }}>
              <BeltBadge beltName={currentBeltRank} customBelts={belts} size="md" testID="student-current-belt-badge" />
            </View>
          </View>
        </View>

        {/* Multi-Tenant Next Promotion Target */}
        <View
          style={[
            styles.nextTargetBanner,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Sparkles size={18} color={colors.buttonPrimaryBg} />
          {nextTargetBelt ? (
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, fontWeight: '600' }]}>
              Next Target: {nextTargetBelt.name}
            </Text>
          ) : !hasConfiguredBelts ? (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, flex: 1 }]} testID="belt-progression-unavailable">
              Belt progression unavailable — Organization curriculum not configured
            </Text>
          ) : isHighestRank ? (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, flex: 1 }]} testID="belt-highest-rank-text">
              Highest Belt Rank Achieved
            </Text>
          ) : (
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, flex: 1 }]} testID="belt-progression-unavailable">
              Belt progression unavailable for current rank: {currentBeltRank}
            </Text>
          )}
        </View>
      </Card>

      {/* Training Stats Grid */}
      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title="Attendance"
          value={`${data?.attendancePresent ?? 0} / ${data?.attendanceTotal ?? 0}`}
          subtitle="Classes Attended"
          icon={<CheckSquare size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-student-attendance"
        />
        <StatCard
          title="Syllabus"
          value={`${data?.skillsCompleted ?? 0} / ${data?.skillsTotal ?? 0}`}
          subtitle="Forms Mastered"
          icon={<Award size={iconSize.md} color={colors.badgeInfoText} />}
          testID="stat-student-skills"
        />
      </View>

      {/* Upcoming Training Sessions */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Upcoming Classes
          </Text>
          <Calendar size={20} color={colors.buttonPrimaryBg} />
        </View>

        {data?.upcomingSessions && data.upcomingSessions.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.upcomingSessions.map(sess => (
              <View
                key={sess.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {sess.sessionDate} ({sess.startTime} - {sess.endTime})
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {sess.location} {sess.groupName ? `• ${sess.groupName}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No upcoming sessions scheduled.
          </Text>
        )}
      </Card>

      {/* Official Belt Certificates */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Verified Certificates
          </Text>
          <FileText size={20} color={colors.badgeSuccessText} />
        </View>

        {data?.certificates && data.certificates.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.certificates.map(cert => (
              <View
                key={cert.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {cert.beltRank}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    Certificate #{cert.certificateNumber} • Issued {new Date(cert.issuedDate).toLocaleDateString()}
                  </Text>
                </View>
                <Award size={20} color={colors.buttonPrimaryBg} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            No certificates recorded yet.
          </Text>
        )}
      </Card>

      {/* Academy Notices */}
      {data?.notices && data.notices.length > 0 ? (
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              Academy Notices
            </Text>
            <Bell size={20} color={colors.buttonPrimaryBg} />
          </View>
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
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Student Shortcuts
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Syllabus Progress & Drills"
            onPress={() => navigation?.navigate('Progress')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-student-progress"
          />
          <Button
            label="My Attendance Log"
            onPress={() => navigation?.navigate('Attendance')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-student-attendance"
          />
          <Button
            label="Official Certificates"
            onPress={() => navigation?.navigate('Certificates')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-student-certs"
          />
          <Button
            label="Student Profile"
            onPress={() => navigation?.navigate('Profile')}
            variant="outline"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
            testID="shortcut-student-profile"
          />
        </View>
      </Card>
    </ScreenContainer>
  );
};

export const ProgressScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Progress"
      subtitle="Silambam Syllabus & Belt Requirements"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-progress-screen"
      icon={<Award size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Syllabus Scope: Martial arts lesson progress, footwork drills, staff strikes, and grading exam readiness."
    />
  );
};

export const StudentAttendanceScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Attendance"
      subtitle="Training Log & Session Attendance"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-attendance-screen"
      icon={<CheckSquare size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Attendance Log: View confirmed practice mat attendance, monthly check-in history, and training streaks."
    />
  );
};

export const CertificatesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Certificates"
      subtitle="Official Grading Credentials"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-certificates-screen"
      icon={<FileText size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Credentials: Digitally signed Persatuan grading certificates, rank verifications, and official QR verification codes."
    />
  );
};

export const StudentProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Student Martial Artist Profile"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Personal Identity: Student identification number, affiliated Persatuan academy, dojo location, and sign out."
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
  beltProgressCard: {
    padding: 18,
  },
  beltHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  rankDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextTargetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
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
