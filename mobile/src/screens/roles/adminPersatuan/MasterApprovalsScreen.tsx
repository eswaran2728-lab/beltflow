import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import {
  Users,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { StitchAppHeader, StitchStatCard } from '../../../components/stitch';
import { StitchTokens } from '../../../theme/tokens';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { StatusBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';

export interface MasterApprovalsScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
}

export interface MasterApplicationItem {
  id: string;
  user_id: string;
  applicant_name?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  version: number;
  qualifications?: string;
  experience_summary?: string;
  verification_details?: string;
  documents_url?: string;
  rejection_reason?: string;
  requested_information?: string;
  submitted_at?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

type FilterTab = 'ALL' | 'SUBMITTED' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED';

export const MasterApprovalsScreen: React.FC<MasterApprovalsScreenProps> = ({
  user: _user,
  onLogout: _onLogout,
  isOffline,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();

  const statusLabel = (status: string) => {
    const key = `adminApprovals.masterStatus.${status}`;
    const label = t(key);
    return label === key ? status.replace('_', ' ') : label;
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<MasterApplicationItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('SUBMITTED');

  // Detail Modal & Action states
  const [selectedApp, setSelectedApp] = useState<MasterApplicationItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'APPROVE' | 'REQUEST_INFO' | 'REJECT' | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/master-applications/inbox');
      setApplications(res?.applications || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('adminApprovals.master.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const res: any = await apiClient.get('/master-applications/inbox');
        if (!isCancelled) {
          setApplications(res?.applications || []);
          setError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || t('adminApprovals.master.loadFailed'));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [t]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInbox();
  };


  const handleOpenDetail = async (item: MasterApplicationItem) => {
    // Fetch full application detail (including verification details)
    try {
      const res: any = await apiClient.get(`/master-applications/${item.id}`);
      if (res?.application) {
        setSelectedApp(res.application);
      } else {
        setSelectedApp(item);
      }
    } catch {
      setSelectedApp(item);
    }
    setActionType(null);
    setReviewReason('');
    setReviewNotes('');
    setDetailModalVisible(true);
  };

  const handleExecuteReview = async () => {
    if (!selectedApp) return;

    if (actionType === 'REJECT' && !reviewReason.trim()) {
      Alert.alert(t('adminApprovals.master.reasonRequiredTitle'), t('adminApprovals.master.reasonRequiredMessage'));
      return;
    }

    if (actionType === 'REQUEST_INFO' && !reviewReason.trim()) {
      Alert.alert(t('adminApprovals.master.infoRequiredTitle'), t('adminApprovals.master.infoRequiredMessage'));
      return;
    }

    setSubmittingAction(true);
    try {
      let body: any = {
        expectedVersion: selectedApp.version,
      };

      if (actionType === 'APPROVE') {
        body.action = 'APPROVE';
        body.notes = reviewNotes.trim() || undefined;
      } else if (actionType === 'REQUEST_INFO') {
        body.action = 'REQUEST_INFORMATION';
        body.requestedInformation = reviewReason.trim();
        body.notes = reviewNotes.trim() || undefined;
      } else if (actionType === 'REJECT') {
        body.action = 'REJECT';
        body.rejectionReason = reviewReason.trim();
        body.notes = reviewNotes.trim() || undefined;
      }

      const res: any = await apiClient.post(`/master-applications/${selectedApp.id}/review`, body);
      Alert.alert(
        t('adminApprovals.master.completedTitle'),
        res?.message || t('adminApprovals.master.completedFallback')
      );
      setDetailModalVisible(false);
      setSelectedApp(null);
      setActionType(null);
      fetchInbox();
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert(
          t('adminApprovals.master.conflictTitle'),
          t('adminApprovals.master.conflictMessage')
        );
        fetchInbox();
        setDetailModalVisible(false);
      } else {
        Alert.alert(t('adminApprovals.master.failedTitle'), err?.message || t('adminApprovals.master.failedFallback'));
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredApplications = applications.filter(app => {
    if (selectedFilter === 'ALL') return true;
    return app.status === selectedFilter;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'danger';
      case 'NEEDS_INFORMATION':
        return 'warning';
      case 'SUBMITTED':
      default:
        return 'info';
    }
  };

  return (
    <ScreenContainer scrollable={false} testID="admin-persatuan-master-approvals-screen">
      <StitchAppHeader
        dojangName="PERSATUAN DOJANG"
        roleBadgeText="ADMIN PERSATUAN"
        hasUnreadNotifications={applications.some(a => a.status === 'SUBMITTED')}
      />

      <View style={styles.headerSection}>
        <Text style={[typography.pageTitle, styles.screenTitle]}>
          {t('adminApprovals.master.title')}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          {t('adminApprovals.master.subtitle')}
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm }}>
          <StitchStatCard
            label={t('adminApprovals.master.kpiPending')}
            value={applications.filter(a => a.status === 'SUBMITTED').length}
            subtext={t('adminApprovals.master.kpiPendingSub')}
            hasAccentBorder
            accentColor={StitchTokens.colors.colorAccent}
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label={t('adminApprovals.master.kpiActive')}
            value={applications.filter(a => a.status === 'APPROVED').length}
            subtext={t('adminApprovals.master.kpiActiveSub')}
            hasAccentBorder
            accentColor={StitchTokens.colors.bfGreen}
            style={{ flex: 1 }}
          />
          <StitchStatCard
            label={t('adminApprovals.master.kpiNeedsInfo')}
            value={applications.filter(a => a.status === 'NEEDS_INFORMATION').length}
            subtext={t('adminApprovals.master.kpiNeedsInfoSub')}
            hasAccentBorder
            accentColor={StitchTokens.colors.brandNavy}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {isOffline ? (
        <View style={{ marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
          <OfflineBanner
            message={t('adminApprovals.master.offline')}
            testID="approvals-offline-banner"
          />
        </View>
      ) : null}

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border, paddingHorizontal: spacing.md }]}>
        {(['SUBMITTED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'ALL'] as FilterTab[]).map(tab => {
          const isActive = selectedFilter === tab;
          const count = tab === 'ALL'
            ? applications.length
            : applications.filter(a => a.status === tab).length;

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setSelectedFilter(tab)}
              style={[
                styles.filterTab,
                isActive && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 2 },
              ]}
              testID={`filter-tab-${tab.toLowerCase()}`}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color: isActive ? colors.buttonPrimaryBg : colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {t(`adminApprovals.master.tab.${tab}`)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <LoadingState message={t('adminApprovals.master.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchInbox} />
        ) : filteredApplications.length === 0 ? (
          <Card variant="standard" style={[styles.emptyCard, { borderColor: colors.border }]}>
            <Users size={40} color={colors.textSecondary} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              {t('adminApprovals.master.emptyTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              {t('adminApprovals.master.emptyDescription', { filter: selectedFilter })}
            </Text>
          </Card>
        ) : (
          filteredApplications.map(app => (
            <TouchableOpacity
              key={app.id}
              activeOpacity={0.8}
              onPress={() => handleOpenDetail(app)}
              testID={`application-card-${app.id}`}
            >
              <Card
                variant="elevated"
                style={[styles.appCard, { borderColor: colors.border, marginBottom: spacing.sm }]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      {app.applicant_name || t('adminApprovals.master.prospectiveMaster')}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {t('adminApprovals.master.applicantId', { id: app.user_id })}
                    </Text>
                  </View>
                  <StatusBadge
                    status={app.status}
                    label={statusLabel(app.status)}
                    variant={getStatusBadgeVariant(app.status)}
                    testID={`status-badge-${app.id}`}
                  />
                </View>

                {app.qualifications ? (
                  <View style={{ marginTop: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {t('adminApprovals.master.qualificationsLabel')}
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.textSecondary, marginTop: 1 }]}
                      numberOfLines={2}
                    >
                      {app.qualifications}
                    </Text>
                  </View>
                ) : null}

                {app.experience_summary ? (
                  <View style={{ marginTop: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {t('adminApprovals.master.experienceLabel')}
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.textSecondary, marginTop: 1 }]}
                      numberOfLines={2}
                    >
                      {app.experience_summary}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('adminApprovals.master.submitted', { date: app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : t('adminApprovals.master.notAvailable') })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600' }]}>
                      {t('adminApprovals.master.review')}
                    </Text>
                    <ChevronRight size={16} color={colors.buttonPrimaryBg} />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Application Detail & Review Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <ScreenContainer scrollable testID="master-approval-detail-modal">
          <ScreenHeader
            title={t('adminApprovals.master.modalTitle')}
            subtitle={selectedApp?.applicant_name || t('adminApprovals.master.applicantFallback')}
          />

          {selectedApp ? (
            <View style={{ padding: spacing.md }}>
              {/* Status Header Card */}
              <Card variant="standard" style={[styles.modalCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {t('adminApprovals.master.statusVersion')}
                  </Text>
                  <StatusBadge
                    status={selectedApp.status}
                    label={statusLabel(selectedApp.status)}
                    variant={getStatusBadgeVariant(selectedApp.status)}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  {t('adminApprovals.master.applicationId', { id: selectedApp.id })}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {t('adminApprovals.master.documentVersion', { version: selectedApp.version })}
                </Text>
                {selectedApp.submitted_at ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('adminApprovals.master.submittedAt', { date: new Date(selectedApp.submitted_at).toLocaleString() })}
                  </Text>
                ) : null}
              </Card>

              {/* Applicant Credentials */}
              <Card variant="standard" style={[styles.modalCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  {t('adminApprovals.master.qualificationsExperience')}
                </Text>
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {t('adminApprovals.master.qualificationsBelts')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                    {selectedApp.qualifications || t('adminApprovals.master.noQualifications')}
                  </Text>
                </View>

                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {t('adminApprovals.master.experienceSummary')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                    {selectedApp.experience_summary || t('adminApprovals.master.noExperience')}
                  </Text>
                </View>

                {selectedApp.verification_details ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      {t('adminApprovals.master.verificationDetails')}
                    </Text>
                    <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                      {selectedApp.verification_details}
                    </Text>
                  </View>
                ) : null}

                {selectedApp.documents_url ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      {t('adminApprovals.master.documentUrl')}
                    </Text>
                    <Text style={[typography.bodyMedium, { color: colors.buttonPrimaryBg, marginTop: 2 }]}>
                      {selectedApp.documents_url}
                    </Text>
                  </View>
                ) : null}
              </Card>

              {/* Outstanding feedback if any */}
              {selectedApp.requested_information ? (
                <Card variant="standard" style={[styles.modalCard, { borderColor: colors.badgeWarningText, marginBottom: spacing.md }]}>
                  <Text style={[typography.titleMedium, { color: colors.badgeWarningText }]}>
                    {t('adminApprovals.master.currentlyRequested')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                    {selectedApp.requested_information}
                  </Text>
                </Card>
              ) : null}

              {selectedApp.rejection_reason ? (
                <Card variant="standard" style={[styles.modalCard, { borderColor: colors.badgeDangerText, marginBottom: spacing.md }]}>
                  <Text style={[typography.titleMedium, { color: colors.badgeDangerText }]}>
                    {t('adminApprovals.master.rejectionOnRecord')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                    {selectedApp.rejection_reason}
                  </Text>
                </Card>
              ) : null}

              {/* Action Form / Decision Area */}
              {(selectedApp.status === 'SUBMITTED' || selectedApp.status === 'NEEDS_INFORMATION') ? (
                <Card variant="elevated" style={[styles.modalCard, { borderColor: colors.border, marginBottom: spacing.lg }]}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                    {t('adminApprovals.master.reviewDecision')}
                  </Text>

                  {!actionType ? (
                    <View style={{ gap: spacing.sm }}>
                      <Button
                        label={t('adminApprovals.master.approveApplication')}
                        onPress={() => setActionType('APPROVE')}
                        variant="primary"
                        leftIcon={<CheckCircle size={iconSize.sm} color="#ffffff" />}
                        testID="btn-decision-approve"
                      />
                      <Button
                        label={t('adminApprovals.master.requestAdditional')}
                        onPress={() => setActionType('REQUEST_INFO')}
                        variant="secondary"
                        leftIcon={<HelpCircle size={iconSize.sm} color={colors.buttonSecondaryText} />}
                        testID="btn-decision-request-info"
                      />
                      <Button
                        label={t('adminApprovals.master.rejectApplication')}
                        onPress={() => setActionType('REJECT')}
                        variant="outline"
                        leftIcon={<XCircle size={iconSize.sm} color={colors.badgeDangerText} />}
                        testID="btn-decision-reject"
                      />
                    </View>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                        {actionType === 'APPROVE'
                          ? t('adminApprovals.master.confirmApproval')
                          : actionType === 'REQUEST_INFO'
                          ? t('adminApprovals.master.requestMore')
                          : t('adminApprovals.confirmRejection')}
                      </Text>

                      {actionType === 'APPROVE' ? (
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {t('adminApprovals.master.approveNotice')}
                        </Text>
                      ) : null}

                      {actionType === 'REQUEST_INFO' ? (
                        <Input
                          label={t('adminApprovals.informationRequired')}
                          value={reviewReason}
                          onChangeText={setReviewReason}
                          placeholder={t('adminApprovals.master.infoPlaceholder')}
                          multiline
                          numberOfLines={3}
                          testID="input-requested-info"
                        />
                      ) : null}

                      {actionType === 'REJECT' ? (
                        <Input
                          label={t('adminApprovals.master.rejectReasonLabel')}
                          value={reviewReason}
                          onChangeText={setReviewReason}
                          placeholder={t('adminApprovals.master.rejectPlaceholder')}
                          multiline
                          numberOfLines={3}
                          testID="input-rejection-reason"
                        />
                      ) : null}

                      <Input
                        label={t('adminApprovals.master.notesLabel')}
                        value={reviewNotes}
                        onChangeText={setReviewNotes}
                        placeholder={t('adminApprovals.master.notesPlaceholder')}
                        testID="input-review-notes"
                      />

                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            label={t('adminApprovals.cancel')}
                            onPress={() => setActionType(null)}
                            variant="outline"
                            disabled={submittingAction}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            label={
                              actionType === 'APPROVE'
                                ? t('adminApprovals.approve')
                                : actionType === 'REQUEST_INFO'
                                ? t('adminApprovals.sendRequest')
                                : t('adminApprovals.reject')
                            }
                            onPress={handleExecuteReview}
                            variant={actionType === 'REJECT' ? 'danger' : 'primary'}
                            loading={submittingAction}
                            testID="btn-confirm-review-action"
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </Card>
              ) : null}

              <Button
                label={t('adminApprovals.master.closeWindow')}
                onPress={() => setDetailModalVisible(false)}
                variant="outline"
                testID="btn-close-detail-modal"
              />
            </View>
          ) : null}
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenTitle: {
    color: StitchTokens.colors.brandNavy,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  filterBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingTop: 8,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  appCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  modalCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
});
