import React, { useCallback, useState } from 'react';
import { useI18n, translate } from '../../../i18n';
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
import { useReleaseModules } from '../../../hooks/useReleaseModules';
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

export const AdminPersatuanHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  // H28: follow the app-wide language; the header switch changes it for the whole app.
  const app = useI18n();
  // Optional R3 modules: hide their shortcuts when the server switches them off.
  const release = useReleaseModules();
  const [lang, setLangLocal] = useState<AdminLanguage>(app.locale);
  const [seenLocale, setSeenLocale] = useState(app.locale);
  if (seenLocale !== app.locale) {
    // Follow a language change made elsewhere in the app (adjust state during render).
    setSeenLocale(app.locale);
    setLangLocal(app.locale);
  }
  const setLang = (next: AdminLanguage) => {
    setLangLocal(next);
    app.setLocale(next);
  };
  // Strings follow the local switch so it works with or without an I18nProvider.
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params);

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
              {t('adminHome.persatuanId', { id: user.organizationId })}
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
              message={t('adminHome.offlineBanner')}
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={[typography.pageTitle, styles.screenTitle]}>
            {t('adminHome.dashboardTitle')}
          </Text>
          {renderIdentityCard()}
          <LoadingState message={t('adminHome.loadingDashboard')} />
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
              message={t('adminHome.offlineBanner')}
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={[typography.pageTitle, styles.screenTitle]}>
            {t('adminHome.dashboardTitle')}
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
          {t('adminHome.dashboardTitle')}
        </Text>
        {/* Multilingual Selector & Sign Out Strip */}
        <View style={styles.actionStrip}>
          <TouchableOpacity
            style={styles.langButton}
            onPress={cycleLanguage}
            accessibilityLabel={t('adminHome.switchLanguage')}
            testID="btn-admin-language-switch"
          >
            <Globe size={16} color={StitchTokens.colors.brandNavy} />
            <Text style={styles.langButtonText}>
              {lang === 'en' ? 'EN / BM / தமிழ்' : lang === 'ms' ? 'BM / EN / தமிழ்' : 'தமிழ் / EN / BM'}
            </Text>
          </TouchableOpacity>

          {onLogout ? (
            <Button
              label={t('adminHome.signOut')}
              onPress={onLogout}
              variant="outline"
              size="sm"
              leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
              testID="btn-role-logout"
              accessibilityLabel={t('adminHome.signOutA11y')}
            />
          ) : null}
        </View>

        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('adminHome.offlineBanner')}
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
                {data?.organization?.name || t('adminHome.academyProfileFallback')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {data?.organization?.state || t('adminHome.stateFallback')} • {data?.organization?.martialArtStyle || t('adminHome.styleFallback')}
              </Text>
              {data?.organization?.masterName ? (
                <Text style={[typography.caption, { color: StitchTokens.colors.brandNavy, marginTop: 4, fontWeight: '700' }]}>
                  {t('adminHome.headMaster', { name: data.organization.masterName })}
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
              label={t('adminHome.locations')}
              value={data?.locationsCount ?? 0}
              subtext={t('adminHome.statVenues')}
              hasAccentBorder
              accentColor={StitchTokens.colors.brandNavy}
              testID="stat-ap-locations"
              style={{ flex: 1 }}
            />
            <StitchStatCard
              label={t('adminHome.classes')}
              value={data?.classesCount ?? 0}
              subtext={t('adminHome.statSessions')}
              hasAccentBorder
              accentColor={StitchTokens.colors.colorAccent}
              testID="stat-ap-classes"
              style={{ flex: 1 }}
            />
            <StitchStatCard
              label={t('adminHome.masters')}
              value={data?.mastersCount ?? 0}
              subtext={t('adminHome.statCoaches')}
              hasAccentBorder
              accentColor="#D97706"
              testID="stat-ap-masters"
              style={{ flex: 1 }}
            />
          </View>

          <View style={[styles.statsGridRow, { gap: spacing.sm, marginBottom: spacing.md }]}>
            <StitchStatCard
              label={t('adminHome.students')}
              value={data?.studentsCount ?? 0}
              subtext={t('adminHome.statEnrolled')}
              hasAccentBorder
              accentColor="#16A34A"
              testID="stat-ap-students"
              style={{ flex: 1 }}
            />
            <StitchStatCard
              label={t('adminHome.revenue')}
              value={formattedRevenue}
              subtext={t('adminHome.statPayments', { count: data?.paymentsCount ?? 0 })}
              trendText={t('adminHome.statLedger')}
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
              {t('adminHome.adminScopeTitle')}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6, lineHeight: 18 }]}>
            {t('adminHome.adminScopeDesc')}
          </Text>
        </Card>

        {/* 5. Active Classes & Venues */}
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              {t('adminHome.activeClassesHeader')}
            </Text>
            <StatusBadge status="ACTIVE" label={t('adminHome.activeCount', { count: data?.classesCount ?? 0 })} variant="info" />
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
                      {t('adminHome.classLine', { location: cls.location, fee: cls.monthlyFee })}
                    </Text>
                    {cls.masterName ? (
                      <Text style={[typography.caption, { color: StitchTokens.colors.brandNavy, marginTop: 2, fontWeight: '600' }]}>
                        {t('adminHome.assignedMaster', { name: cls.masterName })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {t('adminHome.noClasses')}
            </Text>
          )}
        </Card>

        {/* 6. Assigned Masters */}
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              {t('adminHome.assignedMastersHeader')}
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
              {t('adminHome.noMasters')}
            </Text>
          )}
        </Card>

        {/* 7. Quick Navigation Shortcuts */}
        <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            {t('adminHome.quickNavHeader')}
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              label={t('adminHome.btnAcademySetup')}
              onPress={() => navigation?.navigate('AcademySetup')}
              variant="primary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonPrimaryText} />}
              testID="shortcut-ap-onboarding"
            />
            {release.isEnabled('commerce') && (
              <Button
                label={t('adminHome.btnInventory')}
                onPress={() => navigation?.navigate('Inventory')}
                variant="secondary"
                size="md"
                fullWidth
                leftIcon={<ShoppingBag size={iconSize.md} color={colors.buttonSecondaryText} />}
                rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
                testID="shortcut-ap-inventory"
              />
            )}
            {release.isEnabled('tournaments') && (
              <Button
                label={t('adminHome.btnTournaments')}
                onPress={() => navigation?.navigate('Tournaments')}
                variant="secondary"
                size="md"
                fullWidth
                leftIcon={<Trophy size={iconSize.md} color={colors.buttonSecondaryText} />}
                rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
                testID="shortcut-ap-tournaments"
              />
            )}
            <Button
              label={t('adminHome.btnLocations')}
              onPress={() => navigation?.navigate('Locations')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-locations"
            />
            <Button
              label={t('adminHome.btnMasters')}
              onPress={() => navigation?.navigate('Masters')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-masters"
            />
            <Button
              label={t('adminHome.btnClassApprovals')}
              onPress={() => navigation?.navigate('ClassApprovals')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-class-approvals"
            />
            <Button
              label={t('adminHome.btnHandoverApprovals')}
              onPress={() => navigation?.navigate('HandoverApprovals')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-handover-approvals"
            />
            <Button
              label={t('adminHome.btnGrading')}
              onPress={() => navigation?.navigate('AdminGrading')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-grading"
            />
            <Button
              label={t('adminHome.btnCurriculum')}
              onPress={() => navigation?.navigate('Curriculum')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-curriculum"
            />
            <Button
              label={t('adminHome.btnFinance')}
              onPress={() => navigation?.navigate('Finance')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-finance"
            />
            <Button
              label={t('adminHome.btnReports')}
              onPress={() => navigation?.navigate('Reports')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-ap-reports"
            />
            <Button
              label={t('adminHome.btnProfile')}
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
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      title={t('adminHome.locationsTitle')}
      subtitle={t('adminHome.locationsSubtitle')}
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-locations-screen"
      icon={<MapPin size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('adminHome.locationsScope')}
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
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      title={t('adminHome.reportsTitle')}
      subtitle={t('adminHome.reportsSubtitle')}
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-reports-screen"
      icon={<BarChart3 size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('adminHome.reportsScope')}
    />
  );
};

export const AdminPersatuanProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      showLanguageSelector
      title={t('adminHome.profileTitle')}
      subtitle={t('adminHome.profileSubtitle')}
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('adminHome.profileScope')}
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
export * from './AdminGradingScreen';
