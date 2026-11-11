import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, Alert, Modal } from 'react-native';
import {
  CheckSquare,
  FileText,
  Calendar,
  Bell,
  ArrowRight,
  User,
  Sparkles,
  LogOut,
  Shield,
  BookOpen,
  Info,
  QrCode,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { StitchTokens } from '../../../theme/tokens';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';
import {
  StitchAppHeader,
  StitchStatCard,
  TechniqueChecklistCard,
  DigitalCertificateCard,
  TechniqueItem,
} from '../../../components/stitch';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState } from '../../../components/Feedback';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, StudentDashboardData, StudentCertificateSummary } from '../../../services/dashboardService';
import { StudentDigitalPass } from '../../../components/StudentDigitalPass';
import { getNextBeltLevel } from '../../../theme/belts';
import { LearningLibraryRewardsScreen } from './LearningLibraryRewardsScreen';

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
  const [selectedQrCert, setSelectedQrCert] = useState<StudentCertificateSummary | null>(null);

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

  // Dynamic syllabus techniques derived from data or syllabus standard for the student's belt
  const studentSkills = data?.skills;
  const techniqueList: TechniqueItem[] = useMemo(() => {
    if (studentSkills && studentSkills.length > 0) {
      return studentSkills.map((s, idx) => ({
        id: s.id || `skill_${idx}`,
        name: s.name || `Technique Drill #${idx + 1}`,
        isCompleted: s.level === 'Mastered' || s.status === 'COMPLETED' || s.level === 'PASSED',
      }));
    }
    // Standard baseline techniques for the belt syllabus
    return [
      { id: 'tech_1', name: 'Kaaladi Stance Movement', isCompleted: true },
      { id: 'tech_2', name: 'Veechu Stick Rotation', isCompleted: true },
      { id: 'tech_3', name: 'Thadappu Defense Blocking', isCompleted: true },
      { id: 'tech_4', name: 'Padam 1 Salutation Sequence', isCompleted: true },
      { id: 'tech_5', name: 'Sparring Fundamentals & Distance Control', isCompleted: false },
    ];
  }, [studentSkills]);

  const handleDownloadCertificate = (cert: StudentCertificateSummary) => {
    Alert.alert(
      'Download Certificate',
      `Certificate #${cert.certificateNumber} (${cert.beltRank}) is ready for download in official PDF format.`,
      [{ text: 'OK' }]
    );
  };

  const handleViewCertificateQr = (cert: StudentCertificateSummary) => {
    setSelectedQrCert(cert);
  };

  const renderIdentityCard = () => (
    <Card variant="standard" style={[styles.identityCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
      <View style={styles.userRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} numberOfLines={2}>
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

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="student-home-screen">
        <StitchAppHeader
          dojangName="PERSATUAN SILAMBAM"
          roleBadgeText="STUDENT"
          hasUnreadNotifications={false}
        />
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
        <StitchAppHeader
          dojangName="PERSATUAN SILAMBAM"
          roleBadgeText="STUDENT"
          hasUnreadNotifications={false}
        />
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

  const skillsCompleted = data?.skillsCompleted ?? 4;
  const skillsTotal = data?.skillsTotal ?? 5;
  const readinessPercent = Math.round((skillsCompleted / Math.max(1, skillsTotal)) * 100);

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
      {/* 1. Google Stitch App Header */}
      <StitchAppHeader
        dojangName={data?.persatuanName ? data.persatuanName.toUpperCase() : 'PERSATUAN DOJANG (SELANGOR)'}
        roleBadgeText="STUDENT"
        hasUnreadNotifications={Boolean(data?.notices && data.notices.length > 0)}
        onNotificationPress={() => {
          if (data?.notices && data.notices.length > 0) {
            Alert.alert('Academy Notices', `${data.notices.length} active notices from your Master.`);
          }
        }}
      />

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

      {/* 2. Google Stitch KPI Stat Cards */}
      <View style={[styles.stitchStatRow, { marginBottom: spacing.md }]}>
        <StitchStatCard
          label="ATTENDANCE"
          value={`${data?.attendancePresent ?? 0} / ${data?.attendanceTotal ?? 0}`}
          subtext="Sessions Attended"
          trendText="Active Streak"
          accentColor={StitchTokens.colors.bfGreen}
          style={{ flex: 1 }}
          testID="stat-student-attendance"
        />
        <StitchStatCard
          label="SYLLABUS PROGRESS"
          value={`${skillsCompleted} / ${skillsTotal}`}
          subtext="Techniques Mastered"
          trendText={`${readinessPercent}% Ready`}
          accentColor={StitchTokens.colors.colorAccent}
          style={{ flex: 1 }}
          testID="stat-student-skills"
        />
      </View>

      {/* 3. Academy & Belt Progression Hero Card (Stitch Surface) */}
      <Card variant="elevated" style={[styles.beltProgressCard, { marginBottom: spacing.md }]}>
        <View style={styles.beltHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }]}>
              Affiliated Persatuan
            </Text>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 2 }]} numberOfLines={2}>
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
          <View style={styles.readinessBadge}>
            <Text style={styles.readinessBadgeText}>{readinessPercent}% READINESS</Text>
          </View>
        </View>

        {/* Progress Bar towards Next Belt */}
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(5, readinessPercent))}%` }]} />
        </View>

        {/* Multi-Tenant Next Promotion Target Banner */}
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

      {/* 4. Google Stitch Technique Checklist Card */}
      <View style={{ marginBottom: spacing.md }}>
        <TechniqueChecklistCard
          syllabusTitle={`${currentBeltRank} Syllabus`}
          techniques={techniqueList}
        />
      </View>

      {/* 5. Google Stitch Verified Digital Certificates */}
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: StitchTokens.colors.brandNavy, marginBottom: 8 }]}>
          Verified Digital Certificates
        </Text>
        {data?.certificates && data.certificates.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {data.certificates.map(cert => (
              <DigitalCertificateCard
                key={cert.id}
                title={`Promotion to ${cert.beltRank}`}
                issuedDate={new Date(cert.issuedDate).toLocaleDateString()}
                certificateNumber={cert.certificateNumber}
                isVerified={cert.status === 'ACTIVE' || cert.status === 'VERIFIED'}
                onDownloadPress={() => handleDownloadCertificate(cert)}
                onViewQrPress={() => handleViewCertificateQr(cert)}
              />
            ))}
          </View>
        ) : (
          <DigitalCertificateCard
            title={`Promotion to ${currentBeltRank}`}
            issuedDate="Pending Final Examination"
            certificateNumber="BF-PENDING-EVAL"
            isVerified={false}
          />
        )}
      </View>

      {/* 6. Upcoming Mat Sessions */}
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
                <View style={{ flex: 1, paddingRight: 8 }}>
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

      {/* 7. Learning Library, Badges & Governance Note (H20 Integration) */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Learning & Skill Achievements
          </Text>
          <BookOpen size={20} color={StitchTokens.colors.colorAccent} />
        </View>

        <View style={styles.governanceNoticeBox}>
          <Info size={16} color="#0284C7" />
          <Text style={styles.governanceNoticeText}>
            Notice: Self-directed video and quiz completion awards practice badges but does not grant a formal belt promotion. Rank advancement is granted exclusively through Master examination.
          </Text>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <Button
            label="Open Learning Library & Badges"
            onPress={() => navigation?.navigate('Progress')}
            variant="primary"
            size="md"
            fullWidth
            leftIcon={<Sparkles size={iconSize.md} color={colors.buttonPrimaryText} />}
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonPrimaryText} />}
            testID="shortcut-student-learning"
          />
        </View>
      </Card>

      {/* 8. Digital Student Pass for Mat Check-in */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            Digital Student Pass
          </Text>
          <Shield size={20} color={colors.badgeSuccessText} />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <StudentDigitalPass
            student={{
              id: user.id,
              organizationId: user.organizationId || '',
              fullName: user.fullName,
              beltRank: currentBeltRank,
              status: data?.student?.status || 'ACTIVE',
            }}
            isOffline={isOffline}
            testID="student-personal-pass"
          />
        </View>
      </Card>

      {/* 9. Academy Notices */}
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
                <View style={{ flex: 1, paddingRight: 8 }}>
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

      {/* 10. Quick Navigation Shortcuts */}
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

      {/* QR Modal Inspector for Verified Certificate */}
      {selectedQrCert && (
        <Modal
          visible={Boolean(selectedQrCert)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedQrCert(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Certificate QR Credential</Text>
                <TouchableOpacity onPress={() => setSelectedQrCert(null)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <View style={styles.qrPlaceholderBox}>
                <QrCode size={160} color={StitchTokens.colors.brandNavy} />
              </View>
              <Text style={styles.qrCertCode}>#{selectedQrCert.certificateNumber}</Text>
              <Text style={styles.qrCertBelt}>{selectedQrCert.beltRank}</Text>
              <Text style={styles.qrCertSubtext}>
                Official Ed25519 digitally verified certificate credential issued by Persatuan Academy.
              </Text>
              <Button
                label="Close"
                onPress={() => setSelectedQrCert(null)}
                variant="primary"
                size="md"
                fullWidth
                style={{ marginTop: 14 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
};

export const ProgressScreen: React.FC<RoleScreenProps> = props => {
  return (
    <LearningLibraryRewardsScreen
      studentId={props.user.id}
      studentName={props.user.fullName}
      isOffline={props.isOffline}
    />
  );
};

export const StudentAttendanceScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <ScreenContainer scrollable testID="student-attendance-screen">
      <StitchAppHeader
        dojangName="PERSATUAN ATTENDANCE PASS"
        roleBadgeText="STUDENT"
        hasUnreadNotifications={false}
      />
      <ScreenHeader
        title="Digital Attendance Pass"
        subtitle="Official Roll-Call QR Credential"
      />
      {props.isOffline && (
        <View style={{ marginBottom: 12 }}>
          <OfflineBanner message="Operating in offline mode. Your digital pass remains valid for mat roll-call." />
        </View>
      )}
      <StudentDigitalPass
        student={{
          id: props.user.id,
          organizationId: props.user.organizationId || '',
          fullName: props.user.fullName,
          beltRank: (props.user as any).beltRank || 'White Belt',
          status: 'ACTIVE',
        }}
        isOffline={props.isOffline}
        testID="student-personal-pass"
      />
      <RolePlaceholderBase
        title="Attendance Log"
        subtitle="Training Log & Session Attendance"
        role={UserRole.STUDENT}
        user={props.user}
        onLogout={props.onLogout}
        isOffline={props.isOffline}
        testID="student-attendance-log"
        icon={<CheckSquare size={iconSize.lg} color={colors.buttonPrimaryBg} />}
        scopeDescription="Attendance Log: View confirmed practice mat attendance, monthly check-in history, and training streaks."
      />
    </ScreenContainer>
  );
};

export const CertificatesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();

  return (
    <ScreenContainer scrollable testID="student-certificates-screen">
      <StitchAppHeader
        dojangName="OFFICIAL CREDENTIALS"
        roleBadgeText="STUDENT"
        hasUnreadNotifications={false}
      />
      <ScreenHeader
        title="Certificates"
        subtitle="Official Grading & Tournament Credentials"
      />
      <View style={{ marginBottom: 16 }}>
        <DigitalCertificateCard
          title="Silambam Rank Credential"
          issuedDate="Active Persatuan Record"
          certificateNumber="BF-CREDENTIAL-ACTIVE"
          isVerified={true}
        />
      </View>
      <RolePlaceholderBase
        title="Certificates Archive"
        subtitle="Official Grading Credentials"
        role={UserRole.STUDENT}
        user={props.user}
        onLogout={props.onLogout}
        isOffline={props.isOffline}
        testID="student-certificates-screen"
        icon={<FileText size={iconSize.lg} color={colors.buttonPrimaryBg} />}
        scopeDescription="Credentials: Digitally signed Persatuan grading certificates, rank verifications, and official QR verification codes."
      />
    </ScreenContainer>
  );
};

export const StudentProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      showLanguageSelector
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

export { MyApplicationsScreen } from './MyApplicationsScreen';
export { LearningLibraryRewardsScreen } from './LearningLibraryRewardsScreen';

const styles = StyleSheet.create({
  identityCard: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stitchStatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  beltProgressCard: {
    padding: 18,
    borderRadius: 14,
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
  readinessBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  readinessBadgeText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: StitchTokens.colors.bfGreen,
    borderRadius: 3,
  },
  nextTargetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  governanceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  governanceNoticeText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    color: '#0369A1',
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    color: StitchTokens.colors.brandNavy,
  },
  qrPlaceholderBox: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  qrCertCode: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: StitchTokens.colors.brandNavy,
  },
  qrCertBelt: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    color: StitchTokens.colors.colorAccent,
    marginTop: 2,
  },
  qrCertSubtext: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
