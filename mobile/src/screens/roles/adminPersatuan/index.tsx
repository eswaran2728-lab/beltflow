import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readableId } from '../../../utils/displayName';
import { useI18n, translate } from '../../../i18n';
import { useNotificationInbox } from '../../../components/NotificationsInbox';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, Pressable } from 'react-native';
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
  BookOpen,
  Globe,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { StitchTokens } from '../../../theme/tokens';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';
import {
  StitchAppHeader,
  StitchStatCard,
} from '../../../components/stitch';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge, StatusBadgeVariant } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, AdminPersatuanDashboardData } from '../../../services/dashboardService';
import {
  adminRecordsService,
  AdminClassRecord,
  groupClassesByLocation,
  isModuleDisabledError,
  metricsAreEmpty,
  formatMoney,
  formatPercent,
  REPORT_PERIODS,
  ReportPeriod,
} from '../../../services/adminRecordsService';
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
  const inbox = useNotificationInbox(Boolean(data));

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
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="middle">
            {user.email}
          </Text>
          {user.organizationId ? (
            <Text style={[typography.caption, { color: StitchTokens.colors.brandNavy, marginTop: 4, fontWeight: '700' }]}>
              {t('adminHome.persatuanId', { id: readableId(user.organizationId) })}
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
        inContainer
          organizationId={user.organizationId}
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
        inContainer
          organizationId={user.organizationId}
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
        inContainer
        organizationId={user.organizationId}
        roleBadgeText="ADMIN PERSATUAN"
        hasUnreadNotifications={inbox.unreadCount > 0}
        onNotificationPress={inbox.openInbox}
        notificationAccessibilityLabel={inbox.bellLabel}
      />
      {inbox.element}

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

// ----------------------------------------------------------------------------
// Locations and Reports (2026-11-22). Read-only, tenant-scoped on the server.
// ----------------------------------------------------------------------------

interface AdminResource<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
  refresh: () => void;
}

/** Loader passed to useAdminResource (call signature avoids a generic after an arrow). */
type AdminFetcher<T> = { (): Promise<T> };

/**
 * Loads `fetcher` and loads again whenever it changes or on retry. Each load
 * has its own token, so a late answer for an old period is ignored.
 */
function useAdminResource<T>(fetcher: AdminFetcher<T>): AdminResource<T> {
  const [reloadCount, setReloadCount] = useState(0);
  const token = useMemo(() => ({ fetcher, reloadCount }), [fetcher, reloadCount]);
  const [result, setResult] = useState<{ token: object | null; data: T | null; error: unknown }>({
    token: null,
    data: null,
    error: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
    let cancelled = false;
    token.fetcher().then(
      data => {
        if (!cancelled) setResult({ token, data, error: null });
      },
      error => {
        if (!cancelled) setResult({ token, data: null, error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const refresh = useCallback(() => {
    const current = tokenRef.current;
    setRefreshing(true);
    current.fetcher().then(
      data => {
        if (tokenRef.current === current) setResult({ token: current, data, error: null });
      },
      error => {
        if (tokenRef.current === current) setResult({ token: current, data: null, error });
      }
    ).finally(() => setRefreshing(false));
  }, []);

  const loading = result.token !== token;
  return {
    data: loading ? null : result.data,
    error: loading ? null : result.error,
    loading,
    refreshing,
    reload: () => setReloadCount(n => n + 1),
    refresh,
  };
}

interface AdminRecordsFrameProps extends RoleScreenProps {
  title: string;
  subtitle: string;
  scope: string;
  testID: string;
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

const AdminRecordsFrame: React.FC<AdminRecordsFrameProps> = ({
  title,
  subtitle,
  scope,
  testID,
  onLogout,
  isOffline,
  refreshing,
  onRefresh,
  children,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <ScreenContainer
      scrollable
      testID={testID}
      style={{ backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        rightAction={
          onLogout ? (
            <Button
              label={t('auth.common.signOut')}
              onPress={onLogout}
              variant="outline"
              size="sm"
              leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
              testID="btn-role-logout"
              accessibilityLabel={t('auth.role.signOutA11y')}
            />
          ) : undefined
        }
      />
      <View style={{ paddingVertical: spacing.md }}>
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner message={t('auth.role.offline')} testID="offline-security-banner" />
          </View>
        ) : null}
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>{scope}</Text>
        {children}
      </View>
    </ScreenContainer>
  );
};

const CLASS_STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  NOT_STARTED: 'info',
  CLOSED: 'neutral',
};

export const LocationsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  const orgId = props.user.organizationId || null;

  const fetcher = useCallback(
    () => (orgId ? adminRecordsService.listAcademyClasses(orgId) : Promise.resolve<AdminClassRecord[]>([])),
    [orgId]
  );
  const { data, error, loading, refreshing, reload, refresh } = useAdminResource(fetcher);
  const groups = useMemo(() => groupClassesByLocation(data ?? []), [data]);

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return t('adminHome.locations.statusActive');
      case 'PAUSED':
        return t('adminHome.locations.statusPaused');
      case 'NOT_STARTED':
        return t('adminHome.locations.statusNotStarted');
      case 'CLOSED':
        return t('adminHome.locations.statusClosed');
      default:
        return t('adminHome.locations.statusOther', { status });
    }
  };
  const countLabel = (count: number) =>
    count === 1 ? t('adminHome.locations.classCountOne') : t('adminHome.locations.classCount', { count });

  let body: React.ReactNode;
  if (!orgId) {
    body = <EmptyState title={t('adminHome.locations.emptyTitle')} description={t('adminHome.locations.noOrg')} testID="locations-empty" />;
  } else if (loading) {
    body = <LoadingState message={t('adminHome.locations.loading')} testID="locations-loading" />;
  } else if (error) {
    body = (
      <ErrorState
        title={t('adminHome.locations.errorTitle')}
        message={t('adminHome.locations.errorBody')}
        onRetry={reload}
        testID="locations-error"
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        title={t('adminHome.locations.emptyTitle')}
        description={t('adminHome.locations.emptyBody')}
        icon={<MapPin size={iconSize.lg} color={colors.textMuted} />}
        testID="locations-empty"
      />
    );
  } else {
    const venues = groups.filter(g => g.location !== null).length;
    body = (
      <View testID="locations-list">
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          {t('adminHome.locations.summary', { venues, classes: data?.length ?? 0 })}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
          {t('adminHome.locations.sourceNote')}
        </Text>
        {groups.map((group, index) => {
          const venueName = group.location ?? t('adminHome.locations.notSet');
          return (
            <Card key={group.location ?? '__unset__'} variant="standard" style={{ marginBottom: spacing.md }} testID={`venue-group-${index}`}>
              <View
                style={styles.venueHeader}
                accessible
                accessibilityRole="header"
                accessibilityLabel={t('adminHome.locations.venueA11y', { venue: venueName, count: group.classes.length })}
              >
                <MapPin size={iconSize.md} color={group.location ? colors.buttonPrimaryBg : colors.textMuted} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typography.sectionHeading, { color: group.location ? colors.textPrimary : colors.textSecondary }]}>
                    {venueName}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{countLabel(group.classes.length)}</Text>
                </View>
              </View>
              {group.classes.map(c => {
                const schedule = c.schedule ?? t('adminHome.locations.noSchedule');
                const master = c.masterName
                  ? t('adminHome.locations.master', { name: c.masterName })
                  : t('adminHome.locations.noMaster');
                const status = statusLabel(c.status);
                return (
                  <View
                    key={c.id}
                    style={[styles.venueClassRow, { borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm }]}
                    testID={`venue-class-${c.id}`}
                    accessible
                    accessibilityLabel={t('adminHome.locations.classA11y', { name: c.name, schedule, master, status })}
                  >
                    <View style={styles.venueClassTitleRow}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1, marginRight: spacing.sm }]}>
                        {c.name}
                      </Text>
                      <StatusBadge
                        status={c.status}
                        label={status}
                        variant={CLASS_STATUS_VARIANT[c.status] ?? 'neutral'}
                        testID={`class-status-${c.id}`}
                      />
                    </View>
                    {c.venueDetails ? (
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{c.venueDetails}</Text>
                    ) : null}
                    <View style={styles.venueMetaRow}>
                      <Calendar size={iconSize.sm} color={colors.textSecondary} />
                      <Text style={[typography.bodyMedium, styles.venueMetaText, { color: colors.textPrimary }]}>{schedule}</Text>
                    </View>
                    <View style={styles.venueMetaRow}>
                      <User size={iconSize.sm} color={colors.textSecondary} />
                      <Text style={[typography.bodyMedium, styles.venueMetaText, { color: c.masterName ? colors.textPrimary : colors.textMuted }]}>
                        {master}
                      </Text>
                    </View>
                    {c.capacity !== null ? (
                      <View style={styles.venueMetaRow}>
                        <Users size={iconSize.sm} color={colors.textSecondary} />
                        <Text style={[typography.bodyMedium, styles.venueMetaText, { color: colors.textPrimary }]}>
                          {t('adminHome.locations.capacity', { count: c.capacity })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <AdminRecordsFrame
      {...props}
      title={t('adminHome.locationsTitle')}
      subtitle={t('adminHome.locationsSubtitle')}
      scope={t('adminHome.locationsScope')}
      testID="admin-persatuan-locations-screen"
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {body}
    </AdminRecordsFrame>
  );
};

export const MastersScreen: React.FC<RoleScreenProps> = props => {
  return <MasterApprovalsScreen {...props} />;
};

export const AcademySetupScreen: React.FC<RoleScreenProps> = props => {
  return <AdminAcademySetupScreen {...props} />;
};

const ReportBar: React.FC<{ label: string; percent: number | null; testID: string }> = ({ label, percent, testID }) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useI18n();
  const shown = percent === null ? t('adminHome.reports.notEnoughData') : formatPercent(percent);
  const width = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <View
      style={{ marginBottom: spacing.md }}
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('adminHome.reports.barA11y', { label, value: shown })}
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: Math.round(width) }}
    >
      <View style={styles.reportBarLabelRow}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>{shown}</Text>
      </View>
      <View style={[styles.reportBarTrack, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <View style={[styles.reportBarFill, { width: `${width}%`, backgroundColor: colors.buttonPrimaryBg }]} />
      </View>
    </View>
  );
};

export const ReportsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  const [period, setPeriod] = useState<ReportPeriod>('current_month');

  const fetcher = useCallback(() => adminRecordsService.getAcademyMetrics(period), [period]);
  const { data, error, loading, refreshing, reload, refresh } = useAdminResource(fetcher);
  const disabled = !loading && isModuleDisabledError(error);

  const periodLabel = (p: string) =>
    (REPORT_PERIODS as readonly string[]).includes(p) ? t(`adminHome.reports.period.${p}`) : p;

  const sectionTitle = (key: string) => (
    <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]} accessibilityRole="header">
      {t(key)}
    </Text>
  );
  const stat = (key: string, value: string | number, testID: string) => (
    <View style={styles.reportStatCol}>
      <StitchStatCard label={t(key)} value={value} testID={testID} />
    </View>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <LoadingState message={t('adminHome.reports.loading')} testID="reports-loading" />;
  } else if (disabled) {
    body = (
      <EmptyState
        title={t('adminHome.reports.disabledTitle')}
        description={t('adminHome.reports.disabledBody')}
        icon={<BarChart3 size={iconSize.lg} color={colors.textMuted} />}
        testID="reports-disabled"
      />
    );
  } else if (error || !data) {
    body = (
      <ErrorState
        title={t('adminHome.reports.errorTitle')}
        message={t('adminHome.reports.errorBody')}
        onRetry={reload}
        testID="reports-error"
      />
    );
  } else if (metricsAreEmpty(data)) {
    body = (
      <EmptyState
        title={t('adminHome.reports.emptyTitle')}
        description={t('adminHome.reports.emptyBody')}
        icon={<BarChart3 size={iconSize.lg} color={colors.textMuted} />}
        testID="reports-empty"
      />
    );
  } else {
    const { enrollment, trialConversion, retention, ledgerTotals, metadata } = data;
    const money = (amount: number) => formatMoney(amount, ledgerTotals.currency);
    const calculated = new Date(metadata.calculatedAt);
    body = (
      <View testID="reports-figures">
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {t('adminHome.reports.periodShown', {
            period: periodLabel(metadata.period),
            time: isNaN(calculated.getTime()) ? metadata.calculatedAt : calculated.toLocaleString(),
          })}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>{t('adminHome.reports.periodNote')}</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }]}>
          {t('adminHome.reports.aggregatesNote')}
        </Text>

        <Card variant="standard" style={{ marginBottom: spacing.md }}>
          {sectionTitle('adminHome.reports.sectionStudents')}
          <View style={styles.reportStatGrid}>
            {stat('adminHome.reports.activeStudents', enrollment.activeEnrolledStudents, 'stat-active-students')}
            {stat('adminHome.reports.pendingApplicants', enrollment.pendingApplicants, 'stat-pending-applicants')}
            {stat('adminHome.reports.activeClasses', enrollment.activeClassesCount, 'stat-active-classes')}
            {stat('adminHome.reports.totalCapacity', enrollment.totalClassCapacity, 'stat-total-capacity')}
          </View>
          <ReportBar
            label={t('adminHome.reports.barCapacity')}
            percent={enrollment.totalClassCapacity > 0 ? enrollment.capacityUtilizationPercent : null}
            testID="bar-capacity"
          />
        </Card>

        <Card variant="standard" style={{ marginBottom: spacing.md }}>
          {sectionTitle('adminHome.reports.sectionTrials')}
          <View style={styles.reportStatGrid}>
            {stat('adminHome.reports.trialsBooked', trialConversion.totalTrialsBooked, 'stat-trials-booked')}
            {stat('adminHome.reports.trialsAttended', trialConversion.trialsAttended, 'stat-trials-attended')}
            {stat('adminHome.reports.trialsConverted', trialConversion.trialsConverted, 'stat-trials-converted')}
          </View>
          <ReportBar
            label={t('adminHome.reports.barConversion')}
            percent={trialConversion.totalTrialsBooked > 0 ? trialConversion.conversionRatePercent : null}
            testID="bar-conversion"
          />
        </Card>

        <Card variant="standard" style={{ marginBottom: spacing.md }}>
          {sectionTitle('adminHome.reports.sectionRetention')}
          <ReportBar
            label={t('adminHome.reports.barRetention')}
            percent={retention.activeStudents + retention.pausedMemberships > 0 ? retention.retentionRatePercent : null}
            testID="bar-retention"
          />
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
            {t('adminHome.reports.pausedMemberships', { count: retention.pausedMemberships })}
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {t('adminHome.reports.transfers', { count: retention.transfersCount })}
          </Text>
        </Card>

        <Card variant="standard" style={{ marginBottom: spacing.md }}>
          {sectionTitle('adminHome.reports.sectionFees')}
          <View style={styles.reportStatGrid}>
            {stat('adminHome.reports.collected', money(ledgerTotals.totalCollected), 'stat-collected')}
            {stat('adminHome.reports.outstanding', money(ledgerTotals.totalOutstanding), 'stat-outstanding')}
            {stat('adminHome.reports.discounts', money(ledgerTotals.siblingDiscountSavings), 'stat-discounts')}
          </View>
        </Card>
      </View>
    );
  }

  return (
    <AdminRecordsFrame
      {...props}
      title={t('adminHome.reportsTitle')}
      subtitle={t('adminHome.reportsSubtitle')}
      scope={t('adminHome.reportsScope')}
      testID="admin-persatuan-reports-screen"
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {disabled ? null : (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            {t('adminHome.reports.periodLabel')}
          </Text>
          <View style={styles.periodRow} accessibilityRole="radiogroup">
            {REPORT_PERIODS.map(p => {
              const selected = p === period;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={t('adminHome.reports.periodA11y', { period: periodLabel(p) })}
                  testID={`period-${p}`}
                  style={[
                    styles.periodChip,
                    {
                      borderColor: selected ? colors.buttonPrimaryBg : colors.border,
                      backgroundColor: selected ? colors.buttonPrimaryBg : colors.surface,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                >
                  {selected ? <Check size={iconSize.sm} color={colors.buttonPrimaryText} /> : null}
                  <Text
                    style={[
                      typography.caption,
                      { color: selected ? colors.buttonPrimaryText : colors.textPrimary, fontWeight: selected ? '700' : '500' },
                    ]}
                  >
                    {periodLabel(p)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {body}
    </AdminRecordsFrame>
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
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  venueClassRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  venueClassTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  venueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  venueMetaText: {
    marginLeft: 6,
    flex: 1,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodChip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reportStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  reportStatCol: {
    width: '50%',
    padding: 4,
  },
  reportBarLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportBarTrack: {
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reportBarFill: {
    height: '100%',
  },
});

export * from './MasterApprovalsScreen';
export * from './ClassApprovalsScreen';
export * from './HandoverApprovalsScreen';
export * from './CurriculumManagementScreen';
export * from './AdminFinanceScreen';
export * from './AdminGradingScreen';
