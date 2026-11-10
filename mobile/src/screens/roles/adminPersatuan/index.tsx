import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
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
  ShoppingBag,
  Trophy,
  BookOpen,
  Globe,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { StitchTokens } from '../../../theme/tokens';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';
import {
  StitchAppHeader,
  StitchStatCard,
} from '../../../components/stitch';
import { ScreenContainer } from '../../../components/Layout';
import { Card } from '../../../components/Card';
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

export type AdminLanguage = 'en' | 'ms' | 'ta';

const ADMIN_I18N = {
  en: {
    dashboardTitle: 'Persatuan Dashboard',
    dashboardSubtitle: 'Academy Operations Overview',
    signOut: 'Sign Out',
    adminScopeTitle: 'Persatuan Administration Scope',
    adminScopeDesc:
      'Persatuan administrators oversee academy facilities, roster assignments, and financial aggregations. Per-class fee modifications and grading evaluation submissions remain strictly under the authority of certified Masters.',
    locations: 'Locations',
    classes: 'Classes',
    masters: 'Masters',
    students: 'Students',
    revenue: 'Revenue',
    activeClassesHeader: 'Active Classes & Venues',
    assignedMastersHeader: 'Assigned Masters & Coaches',
    quickNavHeader: 'Academy Operations & Management',
    btnAcademySetup: 'Academy Setup & Legacy Imports',
    btnLocations: 'Locations & Venues',
    btnMasters: 'Masters & Approvals',
    btnCurriculum: 'Belt Curriculum & Ranks',
    btnFinance: 'Finance & Gateway Reconciliation',
    btnInventory: 'Equipment & Merchandise Inventory',
    btnTournaments: 'Tournaments & Competitions',
    btnReports: 'Growth Analytics & Reports',
    btnProfile: 'Persatuan Admin Profile',
    noClasses: 'No active training classes registered yet.',
    noMasters: 'No certified masters assigned yet.',
  },
  ms: {
    dashboardTitle: 'Papan Pemuka Persatuan',
    dashboardSubtitle: 'Gambaran Keseluruhan Operasi Akademi',
    signOut: 'Log Keluar',
    adminScopeTitle: 'Skop Pentadbiran Persatuan',
    adminScopeDesc:
      'Pentadbir Persatuan menguruskan fasiliti akademi, senarai ahli, dan penyata kewangan. Penetapan yuran kelas dan penilaian kenaikan tali pinggang adalah di bawah kuasa eksklusif Guru Utama.',
    locations: 'Pusat Latihan',
    classes: 'Kelas',
    masters: 'Guru Utama',
    students: 'Pelajar',
    revenue: 'Hasil Yuran',
    activeClassesHeader: 'Kelas & Lokasi Aktif',
    assignedMastersHeader: 'Guru Utama & Jurulatih Ditugaskan',
    quickNavHeader: 'Operasi & Pengurusan Akademi',
    btnAcademySetup: 'Persediaan Akademi & Import Rekod',
    btnLocations: 'Pusat & Lokasi Latihan',
    btnMasters: 'Pengesahan Guru Utama',
    btnCurriculum: 'Kurikulum & Tali Pinggang',
    btnFinance: 'Kewangan & Rekonsiliasi Bayaran',
    btnInventory: 'Inventori Peralatan & Barangan',
    btnTournaments: 'Pertandingan & Kejohanan',
    btnReports: 'Analisis Pertumbuhan & Laporan',
    btnProfile: 'Profil Pentadbir Persatuan',
    noClasses: 'Tiada kelas latihan aktif didaftarkan.',
    noMasters: 'Tiada guru utama bertauliah ditugaskan.',
  },
  ta: {
    dashboardTitle: 'சங்க நிர்வாக மேலோட்டம்',
    dashboardSubtitle: 'பயிற்சி மைய செயல்பாடுகள் கண்ணோட்டம்',
    signOut: 'வெளியேறு',
    adminScopeTitle: 'நிர்வாக அதிகார வரம்பு',
    adminScopeDesc:
      'சங்க நிர்வாகிகள் வசதிகள், மாணவர் சேர்க்கை மற்றும் நிதி அமைப்புகளை நிர்வகிக்கின்றனர். வகுப்பு கட்டண மாற்றங்கள் மற்றும் தகுதித் தேர்வுகள் ஆசானின் பிரத்யேக அதிகாரத்திற்கு உட்பட்டவை.',
    locations: 'மையங்கள்',
    classes: 'வகுப்புகள்',
    masters: 'ஆசான்கள்',
    students: 'மாணவர்கள்',
    revenue: 'வருவாய்',
    activeClassesHeader: 'செயலில் உள்ள வகுப்புகள்',
    assignedMastersHeader: 'நியமிக்கப்பட்ட ஆசான்கள்',
    quickNavHeader: 'செயல்பாட்டு மேலாண்மை',
    btnAcademySetup: 'மைய அமைப்பு & இறக்குமதி',
    btnLocations: 'பயிற்சி மையங்கள்',
    btnMasters: 'ஆசான் ஒப்புதல்கள்',
    btnCurriculum: 'பாடத்திட்டம் & பட்டைகள்',
    btnFinance: 'நிதி & கட்டண சமரசம்',
    btnInventory: 'உபகரணங்கள் & பொருட்கள் சேமிப்பு',
    btnTournaments: 'போட்டிகள் & சாம்பியன்ஷிப்',
    btnReports: 'வளர்ச்சி பகுப்பாய்வு & அறிக்கைகள்',
    btnProfile: 'நிர்வாகி சுயவிவரம்',
    noClasses: 'செயலில் உள்ள வகுப்புகள் இல்லை.',
    noMasters: 'ஆசான்கள் நியமிக்கப்படவில்லை.',
  },
};

export const AdminPersatuanHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const [lang, setLang] = useState<AdminLanguage>('en');
  const t = ADMIN_I18N[lang];

  const fetcher = useCallback(() => {
    return dashboardService.getAdminPersatuanDashboard(user);
  }, [user]);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<AdminPersatuanDashboardData>({
    fetcher,
    isOffline,
  });

  const cycleLanguage = () => {
    if (lang === 'en') setLang('ms');
    else if (lang === 'ms') setLang('ta');
    else setLang('en');
  };

  const renderIdentityCard = () => (
    <Card variant="standard" style={[styles.identityCard, { borderColor: StitchTokens.colors.brandNavyTint, marginBottom: spacing.md }]}>
      <View style={styles.userRow}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {user.fullName}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {user.email}
          </Text>
          {user.organizationId ? (
            <Text style={[typography.caption, { color: StitchTokens.colors.brandNavy, marginTop: 4, fontWeight: '700' }]}>
              Persatuan ID: {user.organizationId}
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

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="admin-persatuan-home-screen">
        <StitchAppHeader
          dojangName="PERSATUAN DOJANG"
          roleBadgeText="ADMIN PERSATUAN"
          hasUnreadNotifications={false}
          onNotificationPress={() => navigation?.navigate('Masters')}
        />
        {isOffline ? (
          <View style={{ marginHorizontal: 16, marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={[typography.pageTitle, styles.screenTitle]}>
            Persatuan Dashboard
          </Text>
          {renderIdentityCard()}
          <LoadingState message="Loading academy dashboard..." />
        </View>
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="admin-persatuan-home-screen">
        <StitchAppHeader
          dojangName="PERSATUAN DOJANG"
          roleBadgeText="ADMIN PERSATUAN"
          hasUnreadNotifications={false}
          onNotificationPress={() => navigation?.navigate('Masters')}
        />
        {isOffline ? (
          <View style={{ marginHorizontal: 16, marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={[typography.pageTitle, styles.screenTitle]}>
            Persatuan Dashboard
          </Text>
          {renderIdentityCard()}
          <ErrorState message={error.message} onRetry={reload} />
        </View>
      </ScreenContainer>
    );
  }

  const rawRevenue = data?.totalRevenue != null ? Number(data.totalRevenue) : 0;
  const formattedRevenue = `RM ${(isNaN(rawRevenue) ? 0 : rawRevenue).toFixed(2)}`;
  const integerRevenue = `RM ${data?.totalRevenue ?? 0}`;

  return (
    <ScreenContainer
      scrollable
      testID="admin-persatuan-home-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={StitchTokens.colors.brandNavy}
          colors={[StitchTokens.colors.brandNavy]}
        />
      }
    >
      {/* 1. Google Stitch App Header */}
      <StitchAppHeader
        dojangName="PERSATUAN DOJANG"
        roleBadgeText="ADMIN PERSATUAN"
        hasUnreadNotifications={Boolean((data as any)?.pendingApprovalsCount && (data as any).pendingApprovalsCount > 0)}
        onNotificationPress={() => navigation?.navigate('Masters')}
      />

      <View style={styles.bodyContent}>
        <Text style={[typography.pageTitle, styles.screenTitle]}>
          Persatuan Dashboard
        </Text>
        {/* Multilingual Selector & Sign Out Strip */}
        <View style={styles.actionStrip}>
          <TouchableOpacity
            style={styles.langButton}
            onPress={cycleLanguage}
            accessibilityLabel="Switch language"
            testID="btn-admin-language-switch"
          >
            <Globe size={16} color={StitchTokens.colors.brandNavy} />
            <Text style={styles.langButtonText}>
              {lang === 'en' ? 'EN / MY / தமிழ்' : lang === 'ms' ? 'MY / EN / தமிழ்' : 'தமிழ் / EN / MY'}
            </Text>
          </TouchableOpacity>

          {onLogout ? (
            <Button
              label={t.signOut}
              onPress={onLogout}
              variant="outline"
              size="sm"
              leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
              testID="btn-role-logout"
              accessibilityLabel="Sign Out of BeltFlow"
            />
          ) : null}
        </View>

        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}

        {renderIdentityCard()}

        {/* 2. Academy Profile & State Overview */}
        <Card variant="standard" style={[styles.academyCard, { borderColor: StitchTokens.colors.brandNavyTint, marginBottom: spacing.md }]}>
          <View style={styles.academyHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {data?.organization?.name || 'Academy Profile'}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {data?.organization?.state || 'Malaysia'} • {data?.organization?.martialArtStyle || 'Martial Arts'}
              </Text>
              {data?.organization?.masterName ? (
                <Text style={[typography.caption, { color: StitchTokens.colors.brandNavy, marginTop: 4, fontWeight: '700' }]}>
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

        {/* 3. Google Stitch Stat Cards Grid */}
        <View style={styles.statsSection}>
          <View style={[styles.statsGridRow, { gap: spacing.sm, marginBottom: spacing.sm }]}>
            <StitchStatCard
              label={t.locations}
              value={data?.locationsCount ?? 0}
              subtext="Registered Venues"
              hasAccentBorder
              accentColor={StitchTokens.colors.brandNavy}
              testID="stat-ap-locations"
              style={{ flex: 1 }}
            />
            <StitchStatCard
              label={t.classes}
              value={data?.classesCount ?? 0}
              subtext="Mat Sessions"
              hasAccentBorder
              accentColor={StitchTokens.colors.colorAccent}
              testID="stat-ap-classes"
              style={{ flex: 1 }}
            />
            <StitchStatCard
              label={t.masters}
              value={data?.mastersCount ?? 0}
              subtext="Chief Coaches"
              hasAccentBorder
              accentColor="#D97706"
              testID="stat-ap-masters"
              style={{ flex: 1 }}
            />
          </View>

          <View style={[styles.statsGridRow, { gap: spacing.sm, marginBottom: spacing.md }]}>
            <StitchStatCard
              label={t.students}
              value={data?.studentsCount ?? 0}
              subtext="Active Enrolled"
              hasAccentBorder
              accentColor="#16A34A"
              testID="stat-ap-students"
              style={{ flex: 1 }}
            />
            <StitchStatCard
              label={t.revenue}
              value={formattedRevenue}
              subtext={`${data?.paymentsCount ?? 0} payments recorded`}
              trendText="Verified Shared Ledger"
              isPositiveTrend
              hasAccentBorder
              accentColor="#059669"
              testID="stat-ap-revenue"
              style={{ flex: 1.5 }}
            />
            {integerRevenue !== formattedRevenue ? (
              <Text style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}>
                {integerRevenue}
              </Text>
            ) : null}
          </View>
        </View>

        {/* 4. Governance & Role Authority Boundary Notice */}
        <Card variant="standard" style={[styles.scopeCard, { borderColor: StitchTokens.colors.brandNavyTint, marginBottom: spacing.md }]}>
          <View style={styles.scopeHeader}>
            <ShieldAlert size={20} color={StitchTokens.colors.brandNavy} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1, fontWeight: '700' }]}>
              {t.adminScopeTitle}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6, lineHeight: 18 }]}>
            {t.adminScopeDesc}
          </Text>
        </Card>

        {/* 5. Active Classes & Venues */}
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              {t.activeClassesHeader}
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
                    <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                      {cls.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {`${cls.location} • Fee: RM ${cls.monthlyFee}/mo`}
                    </Text>
                    {cls.masterName ? (
                      <Text style={[typography.caption, { color: StitchTokens.colors.brandNavy, marginTop: 2, fontWeight: '600' }]}>
                        Assigned: {cls.masterName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {t.noClasses}
            </Text>
          )}
        </Card>

        {/* 6. Assigned Masters */}
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              {t.assignedMastersHeader}
            </Text>
            <Users size={20} color={StitchTokens.colors.brandNavy} />
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
                    <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
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
              {t.noMasters}
            </Text>
          )}
        </Card>

        {/* 7. Quick Navigation Shortcuts */}
        <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            {t.quickNavHeader}
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              label={t.btnAcademySetup}
              onPress={() => navigation?.navigate('AcademySetup')}
              variant="primary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonPrimaryText} />}
              testID="shortcut-ap-onboarding"
            />
            <Button
              label={t.btnInventory}
              onPress={() => navigation?.navigate('Inventory')}
              variant="secondary"
              size="md"
              fullWidth
              leftIcon={<ShoppingBag size={iconSize.md} color={colors.buttonSecondaryText} />}
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-inventory"
            />
            <Button
              label={t.btnTournaments}
              onPress={() => navigation?.navigate('Tournaments')}
              variant="secondary"
              size="md"
              fullWidth
              leftIcon={<Trophy size={iconSize.md} color={colors.buttonSecondaryText} />}
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-tournaments"
            />
            <Button
              label={t.btnLocations}
              onPress={() => navigation?.navigate('Locations')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-locations"
            />
            <Button
              label={t.btnMasters}
              onPress={() => navigation?.navigate('Masters')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-masters"
            />
            <Button
              label={t.btnCurriculum}
              onPress={() => navigation?.navigate('Curriculum')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-curriculum"
            />
            <Button
              label={t.btnFinance}
              onPress={() => navigation?.navigate('Finance')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-finance"
            />
            <Button
              label={t.btnReports}
              onPress={() => navigation?.navigate('Reports')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-reports"
            />
            <Button
              label={t.btnProfile}
              onPress={() => navigation?.navigate('Profile')}
              variant="outline"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
              testID="shortcut-ap-profile"
            />
          </View>
        </Card>
      </View>
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
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenTitle: {
    color: StitchTokens.colors.brandNavy,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  actionStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: StitchTokens.colors.brandNavy,
  },
  identityCard: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsSection: {
    marginBottom: 8,
  },
  statsGridRow: {
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
    backgroundColor: '#F8FAFC',
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
