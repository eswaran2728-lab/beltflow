import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import {
  Building2,
  ShieldCheck,
  User,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  LogOut,
  Ban,
  RotateCcw,
  Activity,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { StatCard } from '../../../components/StatCard';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState, EmptyState, ConfirmationDialog } from '../../../components/Feedback';
import { Input, SearchInput } from '../../../components/Input';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, SuperAdminDashboardData } from '../../../services/dashboardService';
import { useI18n } from '../../../i18n';
import {
  superAdminRecordsService,
  PersatuanSummary,
  PlatformAuditEntry,
  SecurityOverview,
} from '../../../services/superAdminRecordsService';
import { TenantFeaturesPanel } from './TenantFeaturesPanel';
import { StitchAppHeader } from '../../../components/stitch/StitchAppHeader';

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const SuperAdminHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();

  const fetcher = useCallback(() => {
    return dashboardService.getSuperAdminDashboard();
  }, []);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<SuperAdminDashboardData>({
    fetcher,
    isOffline,
  });

  const headerRightAction = onLogout ? (
    <Button
      label={t('superAdminHome.signOut')}
      onPress={onLogout}
      variant="outline"
      size="sm"
      leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
      testID="btn-role-logout"
      accessibilityLabel={t('superAdminHome.signOutA11y')}
    />
  ) : undefined;

  const renderIdentityCard = () => (
    <Card variant="standard" style={[styles.identityCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
      <View style={styles.userRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {user.fullName}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="middle">
            {user.email}
          </Text>
        </View>
        <StatusBadge
          status={UserRole.SUPER_ADMIN}
          label={t('superAdminHome.roleBadge')}
          variant="info"
          testID="badge-role-super_admin"
        />
      </View>
    </Card>
  );

  if (loading && !data) {
    return (
      <ScreenContainer scrollable testID="super-admin-home-screen">
<StitchAppHeader
          inContainer
          showBell={false}
          hasUnreadNotifications={false}
          dojangName={t('superAdminHome.headerTitle').toUpperCase()}
          roleBadgeText="SUPER ADMIN"
        />
        <ScreenHeader title={t('superAdminHome.headerTitle')} subtitle={t('superAdminHome.headerSubtitle')} rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('superAdminHome.offlineBanner')}
              testID="offline-security-banner"
            />
          </View>
        ) : null}
        {renderIdentityCard()}
        <LoadingState message={t('superAdminHome.loading')} />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer scrollable testID="super-admin-home-screen">
<StitchAppHeader
          inContainer
          showBell={false}
          hasUnreadNotifications={false}
          dojangName={t('superAdminHome.headerTitle').toUpperCase()}
          roleBadgeText="SUPER ADMIN"
        />
        <ScreenHeader title={t('superAdminHome.headerTitle')} subtitle={t('superAdminHome.headerSubtitle')} rightAction={headerRightAction} />
        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('superAdminHome.offlineBanner')}
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
      testID="super-admin-home-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.buttonPrimaryBg}
          colors={[colors.buttonPrimaryBg]}
        />
      }
    >
      <StitchAppHeader
        inContainer
        showBell={false}
        hasUnreadNotifications={false}
        dojangName={t('superAdminHome.headerTitle').toUpperCase()}
        roleBadgeText="SUPER ADMIN"
      />
      <ScreenHeader
        title={t('superAdminHome.headerTitle')}
        subtitle={t('superAdminHome.headerSubtitle')}
        rightAction={headerRightAction}
      />

      {isOffline ? (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner
            message={t('superAdminHome.offlineBanner')}
            testID="offline-security-banner"
          />
        </View>
      ) : null}

      {renderIdentityCard()}

      {/* Platform Overview Stat Cards */}
      <View style={[styles.statsGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <StatCard
          title={t('superAdminHome.stat.totalAcademies')}
          value={data?.totalPersatuans ?? 0}
          icon={<Building2 size={iconSize.md} color={colors.buttonPrimaryBg} />}
          testID="stat-sa-total-orgs"
        />
        <StatCard
          title={t('status.active')}
          value={data?.activePersatuans ?? 0}
          icon={<CheckCircle size={iconSize.md} color={colors.badgeSuccessText} />}
          testID="stat-sa-active-orgs"
        />
        <StatCard
          title={t('status.pending')}
          value={data?.pendingPersatuans ?? 0}
          icon={<Clock size={iconSize.md} color={colors.badgeWarningText} />}
          testID="stat-sa-pending-orgs"
        />
      </View>

      {/* Security Scope Banner */}
      <Card variant="standard" style={[styles.scopeCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <View style={styles.scopeHeader}>
          <ShieldAlert size={20} color={colors.badgeInfoText} />
          <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1 }]}>
            {t('superAdminHome.governance.title')}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          {t('superAdminHome.governance.body')}
        </Text>
      </Card>

      {/* Registered Organizations */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('superAdminHome.orgs.title')}
          </Text>
          <StatusBadge status="ACTIVE" label={t('superAdminHome.orgs.totalBadge', { count: data?.totalPersatuans ?? 0 })} variant="info" />
        </View>

        {data?.recentOrganizations && data.recentOrganizations.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.recentOrganizations.map(org => (
              <View
                key={org.id}
                style={[
                  styles.itemRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {org.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {t('superAdminHome.orgs.masterLine', { state: org.state, master: org.masterName })}
                  </Text>
                </View>
                <StatusBadge
                  status={org.status}
                  label={org.status}
                  variant={org.status === 'ACTIVE' ? 'success' : 'warning'}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('superAdminHome.orgs.empty')}
          </Text>
        )}
      </Card>

      {/* Platform Audit Summary */}
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {t('superAdminHome.audit.title')}
          </Text>
          <ShieldCheck size={20} color={colors.buttonPrimaryBg} />
        </View>

        {data?.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {data.recentAuditLogs.map(log => (
              <View
                key={log.id}
                style={[
                  styles.auditRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {log.action}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    {log.details}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {new Date(log.timestamp).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('superAdminHome.audit.empty')}
          </Text>
        )}
      </Card>

      {/* Quick Navigation Shortcuts */}
      <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          {t('superAdminHome.nav.title')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('superAdminHome.nav.persatuanManagement')}
            onPress={() => navigation?.navigate('Persatuans')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-sa-persatuans"
          />
          <Button
            label={t('superAdminHome.nav.auditLogs')}
            onPress={() => navigation?.navigate('Audit')}
            variant="secondary"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
            testID="shortcut-sa-audit"
          />
          <Button
            label={t('superAdminHome.nav.profile')}
            onPress={() => navigation?.navigate('Profile')}
            variant="outline"
            size="md"
            fullWidth
            rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
            testID="shortcut-sa-profile"
          />
        </View>
      </Card>
    </ScreenContainer>
  );
};

/**
 * Shared frame for the Super Admin records screens: header, offline banner,
 * identity and scope card, pull to refresh. (RolePlaceholderBase has no
 * refresh control, so these two screens use their own frame.)
 */
const SuperAdminRecordsFrame: React.FC<RoleScreenProps & {
  title: string;
  subtitle: string;
  scope: string;
  testID: string;
  refreshing: boolean;
  onRefresh: () => void;
  children?: React.ReactNode;
}> = ({ user, onLogout, isOffline, title, subtitle, scope, testID, refreshing, onRefresh, children }) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <ScreenContainer
      scrollable
      testID={testID}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.buttonPrimaryBg} colors={[colors.buttonPrimaryBg]} />
      }
    >
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        rightAction={onLogout ? (
          <Button
            label={t('superAdminHome.signOut')}
            onPress={onLogout}
            variant="outline"
            size="sm"
            leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
            testID="btn-role-logout"
            accessibilityLabel={t('superAdminHome.signOutA11y')}
          />
        ) : undefined}
      />
      {isOffline ? (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner message={t('superAdminHome.offlineBanner')} testID="offline-security-banner" />
        </View>
      ) : null}
      <Card variant="standard" style={[styles.identityCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <View style={styles.userRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>{user.fullName}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="middle">
              {user.email}
            </Text>
          </View>
          <StatusBadge status={UserRole.SUPER_ADMIN} label={t('superAdminHome.roleBadge')} variant="info" testID="badge-role-super_admin" />
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{scope}</Text>
      </Card>
      {children}
    </ScreenContainer>
  );
};

type PendingStatusChange = { org: PersatuanSummary; status: 'ACTIVE' | 'SUSPENDED'; reason: string };

const statusVariant = (status: string) => (status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'danger' : 'neutral');

export const PersatuanManagementScreen: React.FC<RoleScreenProps> = props => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  const [section, setSection] = useState<'list' | 'features'>('list');
  const [query, setQuery] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [pending, setPending] = useState<PendingStatusChange | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const fetcher = useCallback(() => superAdminRecordsService.listPersatuans(), []);
  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<PersatuanSummary[]>({ fetcher, isOffline: props.isOffline });

  const onRefresh = useCallback(async () => {
    setOverrides({});
    await refresh();
  }, [refresh]);

  const orgs = useMemo(
    () => (data || []).map(o => (overrides[o.id] ? { ...o, status: overrides[o.id] } : o)),
    [data, overrides]
  );
  const needle = query.trim().toLowerCase();
  const shown = needle ? orgs.filter(o => o.name.toLowerCase().includes(needle)) : orgs;

  const statusLabel = (status: string) => {
    const key = `superAdminHome.pm.status.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  const startSuspend = (org: PersatuanSummary) => {
    setReasonFor(org.id);
    setReason('');
    setReasonError(false);
    setMessage(null);
  };

  const continueSuspend = (org: PersatuanSummary) => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    setPending({ org, status: 'SUSPENDED', reason: trimmed });
  };

  const confirmChange = async () => {
    if (!pending || saving) return;
    const change = pending;
    setPending(null);
    setSaving(true);
    setMessage(null);
    try {
      const result = await superAdminRecordsService.setPersatuanStatus(change.org.id, change.status, change.reason);
      setOverrides(prev => ({ ...prev, [change.org.id]: result.status || change.status }));
      setReasonFor(null);
      setReason('');
      setMessage({ kind: 'ok', text: t(`superAdminHome.pm.saved.${change.status}`, { name: change.org.name }) });
    } catch {
      setMessage({ kind: 'error', text: t('superAdminHome.pm.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const sectionTab = (key: 'list' | 'features', label: string) => {
    const selected = section === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setSection(key)}
        style={[
          styles.sectionTab,
          { borderColor: colors.border, backgroundColor: selected ? colors.buttonPrimaryBg : colors.surface },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        testID={`persatuan-section-${key}`}
      >
        <Text style={[typography.titleMedium, { color: selected ? colors.buttonPrimaryText : colors.textPrimary }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const countBox = (testID: string, value: number, label: string) => (
    <View style={[styles.countBox, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
      <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} testID={testID}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );

  const renderRow = (org: PersatuanSummary) => {
    const isActive = org.status === 'ACTIVE';
    const askingReason = reasonFor === org.id;
    return (
      <Card key={org.id} variant="standard" style={[styles.orgCard, { borderColor: colors.border }]} testID={`persatuan-row-${org.id}`}>
        <View style={styles.userRow}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} accessibilityRole="header">{org.name}</Text>
            {org.state ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{org.state}</Text> : null}
          </View>
          <StatusBadge status={org.status} label={statusLabel(org.status)} variant={statusVariant(org.status)} testID={`persatuan-status-${org.id}`} />
        </View>
        <View
          style={[styles.countsRow, { gap: spacing.sm, marginTop: spacing.sm }]}
          accessible
          accessibilityLabel={t('superAdminHome.pm.countsA11y', { classes: org.classCount, students: org.activeStudentCount, masters: org.masterCount })}
        >
          {countBox(`persatuan-classes-${org.id}`, org.classCount, t('superAdminHome.pm.classes'))}
          {countBox(`persatuan-students-${org.id}`, org.activeStudentCount, t('superAdminHome.pm.activeStudents'))}
          {countBox(`persatuan-masters-${org.id}`, org.masterCount, t('superAdminHome.pm.masters'))}
        </View>

        {askingReason ? (
          <View style={{ marginTop: spacing.md }}>
            <Input
              label={t('superAdminHome.pm.reasonLabel')}
              placeholder={t('superAdminHome.pm.reasonPlaceholder')}
              value={reason}
              onChangeText={text => { setReason(text); if (reasonError && text.trim()) setReasonError(false); }}
              errorText={reasonError ? t('superAdminHome.pm.reasonRequired') : undefined}
              helperText={t('superAdminHome.pm.reasonHint')}
              maxLength={500}
              multiline
              accessibilityLabel={t('superAdminHome.pm.reasonLabel')}
              testID={`input-suspend-reason-${org.id}`}
            />
            <View style={[styles.actionsRow, { gap: spacing.sm }]}>
              <Button
                label={t('superAdminHome.pm.cancel')}
                variant="outline"
                size="md"
                onPress={() => { setReasonFor(null); setReason(''); setReasonError(false); }}
                testID={`btn-suspend-cancel-${org.id}`}
              />
              <Button
                label={t('superAdminHome.pm.continue')}
                variant="danger"
                size="md"
                onPress={() => continueSuspend(org)}
                disabled={saving}
                testID={`btn-suspend-continue-${org.id}`}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.actionsRow, { marginTop: spacing.md }]}>
            {isActive ? (
              <Button
                label={t('superAdminHome.pm.suspend')}
                variant="danger"
                size="md"
                onPress={() => startSuspend(org)}
                disabled={saving || props.isOffline}
                leftIcon={<Ban size={iconSize.sm} color={colors.buttonDangerText} />}
                accessibilityLabel={t('superAdminHome.pm.suspendA11y', { name: org.name })}
                testID={`btn-suspend-${org.id}`}
              />
            ) : (
              <Button
                label={t('superAdminHome.pm.reactivate')}
                variant="secondary"
                size="md"
                onPress={() => { setMessage(null); setPending({ org, status: 'ACTIVE', reason: '' }); }}
                disabled={saving || props.isOffline}
                leftIcon={<RotateCcw size={iconSize.sm} color={colors.buttonSecondaryText} />}
                accessibilityLabel={t('superAdminHome.pm.reactivateA11y', { name: org.name })}
                testID={`btn-reactivate-${org.id}`}
              />
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderList = () => {
    if (loading && !data) return <LoadingState message={t('superAdminHome.pm.loading')} testID="persatuan-list-loading" />;
    if (error && !data) return <ErrorState message={t('superAdminHome.pm.loadError')} onRetry={reload} testID="persatuan-list-error" />;
    if (orgs.length === 0) {
      return (
        <EmptyState
          title={t('superAdminHome.pm.empty')}
          description={t('superAdminHome.pm.emptyBody')}
          icon={<Building2 size={iconSize.xl} color={colors.textMuted} />}
          testID="persatuan-list-empty"
        />
      );
    }
    return (
      <View>
        <SearchInput
          label={t('superAdminHome.pm.searchLabel')}
          placeholder={t('superAdminHome.pm.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          accessibilityLabel={t('superAdminHome.pm.searchLabel')}
          autoCorrect={false}
          testID="persatuan-search"
        />
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          {t('superAdminHome.pm.count', { count: shown.length, total: orgs.length })}
        </Text>
        {shown.length === 0 ? (
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]} testID="persatuan-no-match">
            {t('superAdminHome.pm.noMatch', { query: query.trim() })}
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>{shown.map(renderRow)}</View>
        )}
      </View>
    );
  };

  return (
    <SuperAdminRecordsFrame
      {...props}
      title={t('superAdminHome.persatuanMgmt.title')}
      subtitle={t('superAdminHome.persatuanMgmt.subtitle')}
      scope={t('superAdminHome.persatuanMgmt.scope')}
      testID="persatuan-management-screen"
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={[styles.sectionTabs, { gap: spacing.sm, marginBottom: spacing.md }]} accessibilityRole="tablist" accessibilityLabel={t('superAdminHome.pm.sectionsA11y')}>
        {sectionTab('list', t('superAdminHome.pm.tabList'))}
        {sectionTab('features', t('superAdminHome.pm.tabFeatures'))}
      </View>

      {section === 'features' ? (
        <TenantFeaturesPanel />
      ) : (
        <View style={{ marginBottom: spacing.xl }}>
          <View style={[styles.noteRow, { marginBottom: spacing.md }]}>
            <ShieldAlert size={iconSize.sm} color={colors.badgeInfoText} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.xs }]}>
              {t('superAdminHome.pm.privacyNote')}
            </Text>
          </View>
          {message ? (
            <Text
              style={[typography.bodyMedium, { color: message.kind === 'ok' ? colors.badgeSuccessText : colors.badgeDangerText, fontWeight: '600', marginBottom: spacing.sm }]}
              accessibilityRole={message.kind === 'error' ? 'alert' : 'text'}
              accessibilityLiveRegion="polite"
              testID="persatuan-status-message"
            >
              {message.text}
            </Text>
          ) : null}
          {renderList()}
        </View>
      )}

      <ConfirmationDialog
        visible={pending !== null}
        title={pending
          ? t(pending.status === 'SUSPENDED' ? 'superAdminHome.pm.confirmSuspendTitle' : 'superAdminHome.pm.confirmReactivateTitle', { name: pending.org.name })
          : ''}
        message={pending
          ? (pending.status === 'SUSPENDED'
            ? t('superAdminHome.pm.confirmSuspendBody', { reason: pending.reason })
            : t('superAdminHome.pm.confirmReactivateBody'))
          : ''}
        confirmLabel={t(pending?.status === 'ACTIVE' ? 'superAdminHome.pm.confirmReactivate' : 'superAdminHome.pm.confirmSuspend')}
        cancelLabel={t(pending?.status === 'ACTIVE' ? 'superAdminHome.pm.keepSuspended' : 'superAdminHome.pm.keepActive')}
        isDestructive={pending?.status === 'SUSPENDED'}
        onConfirm={confirmChange}
        onCancel={() => setPending(null)}
        testID="persatuan-status-dialog"
      />
    </SuperAdminRecordsFrame>
  );
};

interface PlatformAuditData {
  security: SecurityOverview | null;
  audit: PlatformAuditEntry[] | null;
}

const formatTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

export const PlatformAuditScreen: React.FC<RoleScreenProps> = props => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();

  const fetcher = useCallback(async (): Promise<PlatformAuditData> => {
    const [security, audit] = await Promise.allSettled([
      superAdminRecordsService.getSecurityOverview(),
      superAdminRecordsService.listPlatformAudit(),
    ]);
    if (security.status === 'rejected' && audit.status === 'rejected') throw security.reason;
    return {
      security: security.status === 'fulfilled' ? security.value : null,
      audit: audit.status === 'fulfilled' ? audit.value : null,
    };
  }, []);
  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<PlatformAuditData>({ fetcher, isOffline: props.isOffline });

  const typeLabel = (type: string) => {
    const key = `superAdminHome.pa.type.${type}`;
    const label = t(key);
    return label === key ? type : label;
  };
  const severityLabel = (severity: string) => {
    const key = `superAdminHome.pa.severity.${severity}`;
    const label = t(key);
    return label === key ? severity : label;
  };

  const renderSummary = (security: SecurityOverview) => {
    const rows = Object.entries(security.last24h).sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((sum, [, n]) => sum + n, 0);
    return (
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]} testID="security-summary">
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} accessibilityRole="header">
            {t('superAdminHome.pa.summaryTitle')}
          </Text>
          <Activity size={iconSize.md} color={colors.buttonPrimaryBg} />
        </View>
        {rows.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('superAdminHome.pa.summaryEmpty')}</Text>
        ) : (
          <>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              {t('superAdminHome.pa.summaryTotal', { count: total })}
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {rows.map(([type, count]) => (
                <View key={type} style={[styles.summaryRow, { borderColor: colors.border }]} testID={`security-summary-${type}`}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{typeLabel(type)}</Text>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]} testID={`security-summary-count-${type}`}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
    );
  };

  const renderEvents = (security: SecurityOverview) => {
    const alerts = security.events.filter(e => e.severity === 'ALERT').length;
    return (
      <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]} testID="security-events">
        <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} accessibilityRole="header">
          {t('superAdminHome.pa.eventsTitle')}
        </Text>
        {alerts > 0 ? (
          <View style={[styles.alertBanner, { borderColor: colors.badgeDangerText, backgroundColor: colors.badgeDangerBg, marginTop: spacing.sm }]} accessibilityRole="alert">
            <AlertTriangle size={iconSize.sm} color={colors.badgeDangerText} />
            <Text style={[typography.bodyMedium, { color: colors.badgeDangerText, fontWeight: '700', flex: 1, marginLeft: spacing.xs }]}>
              {t('superAdminHome.pa.alertCount', { count: alerts })}
            </Text>
          </View>
        ) : null}
        {security.events.length === 0 ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('superAdminHome.pa.eventsEmpty')}</Text>
        ) : (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {security.events.map(e => {
              const isAlert = e.severity === 'ALERT';
              const where = e.path ? `${e.method ? `${e.method} ` : ''}${e.path}` : t('superAdminHome.pa.noPath');
              const time = formatTime(e.at);
              return (
                <View
                  key={e.id}
                  style={[
                    styles.eventRow,
                    { backgroundColor: colors.surfaceElevated, borderColor: isAlert ? colors.badgeDangerText : colors.border, borderWidth: isAlert ? 2 : 1 },
                  ]}
                  accessible
                  accessibilityLabel={t('superAdminHome.pa.eventA11y', { severity: severityLabel(e.severity), type: typeLabel(e.type), time, path: where })}
                  testID={`security-event-${e.id}`}
                >
                  {isAlert ? (
                    <View style={[styles.alertMarker, { backgroundColor: colors.badgeDangerText }]} testID={`security-event-alert-${e.id}`}>
                      <AlertTriangle size={iconSize.sm} color={colors.surface} />
                      <Text style={[typography.caption, { color: colors.surface, fontWeight: '800', marginLeft: 4 }]}>
                        {t('superAdminHome.pa.alertMarker')}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.userRow}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1, marginRight: spacing.sm }]}>{typeLabel(e.type)}</Text>
                    <StatusBadge
                      status={e.severity}
                      label={severityLabel(e.severity)}
                      variant={isAlert ? 'danger' : e.severity === 'WARN' ? 'warning' : 'info'}
                    />
                  </View>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{where}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{time}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    );
  };

  const renderAudit = (audit: PlatformAuditEntry[]) => (
    <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.xl }]} testID="platform-audit-entries">
      <View style={styles.sectionHeaderRow}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} accessibilityRole="header">
          {t('superAdminHome.pa.auditTitle')}
        </Text>
        <ShieldCheck size={iconSize.md} color={colors.buttonPrimaryBg} />
      </View>
      {audit.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('superAdminHome.pa.auditEmpty')}</Text>
      ) : (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {audit.map(log => (
            <View key={log.id} style={[styles.auditRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} testID={`platform-audit-${log.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{log.action}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{log.details}</Text>
                {log.userEmail || log.userRole ? (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {t('superAdminHome.pa.by', { who: log.userEmail || log.userRole })}
                  </Text>
                ) : null}
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{formatTime(log.timestamp)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const sectionError = (text: string, testID: string) => (
    <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.md }]} testID={testID}>
      <Text style={[typography.bodyMedium, { color: colors.badgeDangerText, fontWeight: '600' }]} accessibilityRole="alert">{text}</Text>
      <Button label={t('components.common.tryAgain')} variant="secondary" size="md" onPress={reload} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} testID={`${testID}-retry`} />
    </Card>
  );

  let body: React.ReactNode;
  if (loading && !data) {
    body = <LoadingState message={t('superAdminHome.pa.loading')} testID="platform-audit-loading" />;
  } else if (error && !data) {
    body = <ErrorState message={t('superAdminHome.pa.loadError')} onRetry={reload} testID="platform-audit-error" />;
  } else if (data) {
    body = (
      <>
        <View style={[styles.noteRow, { marginBottom: spacing.md }]}>
          <ShieldAlert size={iconSize.sm} color={colors.badgeInfoText} />
          <Text style={[typography.caption, { color: colors.textSecondary, flex: 1, marginLeft: spacing.xs }]}>
            {t('superAdminHome.pa.privacyNote')}
          </Text>
        </View>
        {data.security ? (
          <>
            {renderSummary(data.security)}
            {renderEvents(data.security)}
          </>
        ) : sectionError(t('superAdminHome.pa.securityError'), 'security-events-error')}
        {data.audit ? renderAudit(data.audit) : sectionError(t('superAdminHome.pa.auditError'), 'platform-audit-entries-error')}
      </>
    );
  }

  return (
    <SuperAdminRecordsFrame
      {...props}
      title={t('superAdminHome.platformAudit.title')}
      subtitle={t('superAdminHome.platformAudit.subtitle')}
      scope={t('superAdminHome.platformAudit.scope')}
      testID="platform-audit-screen"
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {body}
    </SuperAdminRecordsFrame>
  );
};

export const SuperAdminProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();
  return (
    <RolePlaceholderBase
      showLanguageSelector
      title={t('superAdminHome.profile.title')}
      subtitle={t('superAdminHome.profile.subtitle')}
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="super-admin-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription={t('superAdminHome.profile.scope')}
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
  scopeCard: {
    padding: 16,
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
  orgCard: {
    padding: 14,
  },
  countsRow: {
    flexDirection: 'row',
  },
  countBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  sectionTabs: {
    flexDirection: 'row',
  },
  sectionTab: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderBottomWidth: 1,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  eventRow: {
    padding: 12,
    borderRadius: 8,
  },
  alertMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
