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
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { StatusBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

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
      setError(err?.message || 'Failed to load master applications inbox.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
          setError(err?.message || 'Failed to load master applications inbox.');
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
  }, []);

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
      Alert.alert('Reason Required', 'Please provide a clear rejection reason for the applicant.');
      return;
    }

    if (actionType === 'REQUEST_INFO' && !reviewReason.trim()) {
      Alert.alert('Information Details Required', 'Please specify what additional information is required.');
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
        'Review Completed',
        res?.message || 'Application status updated successfully.'
      );
      setDetailModalVisible(false);
      setSelectedApp(null);
      setActionType(null);
      fetchInbox();
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert(
          'Concurrent Update Conflict',
          'This application was updated by another administrator. Reloading latest details.'
        );
        fetchInbox();
        setDetailModalVisible(false);
      } else {
        Alert.alert('Review Failed', err?.message || 'Unable to complete review action.');
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
      <ScreenHeader
        title="Master Verifications"
        subtitle="Review & approve instructor credentials"
      />

      {isOffline ? (
        <View style={{ marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
          <OfflineBanner
            message="Offline Mode: Verification decisions require online connectivity."
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
                {tab === 'SUBMITTED' ? 'Pending' : tab === 'NEEDS_INFORMATION' ? 'Needs Info' : tab} ({count})
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
          <LoadingState message="Loading applications..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchInbox} />
        ) : filteredApplications.length === 0 ? (
          <Card variant="standard" style={[styles.emptyCard, { borderColor: colors.border }]}>
            <Users size={40} color={colors.textSecondary} />
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              No Applications Found
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              There are no master applications matching the &apos;{selectedFilter}&apos; filter.
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
                      {app.applicant_name || 'Prospective Master'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      Applicant ID: {app.user_id}
                    </Text>
                  </View>
                  <StatusBadge
                    status={app.status}
                    label={app.status.replace('_', ' ')}
                    variant={getStatusBadgeVariant(app.status)}
                    testID={`status-badge-${app.id}`}
                  />
                </View>

                {app.qualifications ? (
                  <View style={{ marginTop: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>
                      Qualifications:
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
                      Experience:
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
                    Submitted: {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'N/A'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600' }]}>
                      Review
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
            title="Application Review"
            subtitle={selectedApp?.applicant_name || 'Master Applicant'}
          />

          {selectedApp ? (
            <View style={{ padding: spacing.md }}>
              {/* Status Header Card */}
              <Card variant="standard" style={[styles.modalCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    Status & Version
                  </Text>
                  <StatusBadge
                    status={selectedApp.status}
                    label={selectedApp.status.replace('_', ' ')}
                    variant={getStatusBadgeVariant(selectedApp.status)}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  Application ID: {selectedApp.id}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Document Version: v{selectedApp.version}
                </Text>
                {selectedApp.submitted_at ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Submitted At: {new Date(selectedApp.submitted_at).toLocaleString()}
                  </Text>
                ) : null}
              </Card>

              {/* Applicant Credentials */}
              <Card variant="standard" style={[styles.modalCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  Qualifications & Experience
                </Text>
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    Qualifications & Belts
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                    {selectedApp.qualifications || 'No qualifications specified.'}
                  </Text>
                </View>

                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    Experience Summary
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                    {selectedApp.experience_summary || 'No experience summary specified.'}
                  </Text>
                </View>

                {selectedApp.verification_details ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      Verification Details & Certifications
                    </Text>
                    <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
                      {selectedApp.verification_details}
                    </Text>
                  </View>
                ) : null}

                {selectedApp.documents_url ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      Document URL
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
                    Currently Requested Information:
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                    {selectedApp.requested_information}
                  </Text>
                </Card>
              ) : null}

              {selectedApp.rejection_reason ? (
                <Card variant="standard" style={[styles.modalCard, { borderColor: colors.badgeDangerText, marginBottom: spacing.md }]}>
                  <Text style={[typography.titleMedium, { color: colors.badgeDangerText }]}>
                    Rejection Reason on Record:
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
                    Review Decision
                  </Text>

                  {!actionType ? (
                    <View style={{ gap: spacing.sm }}>
                      <Button
                        label="Approve Master Application"
                        onPress={() => setActionType('APPROVE')}
                        variant="primary"
                        leftIcon={<CheckCircle size={iconSize.sm} color="#ffffff" />}
                        testID="btn-decision-approve"
                      />
                      <Button
                        label="Request Additional Information"
                        onPress={() => setActionType('REQUEST_INFO')}
                        variant="secondary"
                        leftIcon={<HelpCircle size={iconSize.sm} color={colors.buttonSecondaryText} />}
                        testID="btn-decision-request-info"
                      />
                      <Button
                        label="Reject Application"
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
                          ? 'Confirm Approval'
                          : actionType === 'REQUEST_INFO'
                          ? 'Request More Information'
                          : 'Confirm Rejection'}
                      </Text>

                      {actionType === 'APPROVE' ? (
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          Approving this application will immediately activate the Master&apos;s affiliation with your Persatuan. An audit event and notification will be published.
                        </Text>
                      ) : null}

                      {actionType === 'REQUEST_INFO' ? (
                        <Input
                          label="Information Required *"
                          value={reviewReason}
                          onChangeText={setReviewReason}
                          placeholder="e.g. Please provide your Silambam black belt certificate ID..."
                          multiline
                          numberOfLines={3}
                          testID="input-requested-info"
                        />
                      ) : null}

                      {actionType === 'REJECT' ? (
                        <Input
                          label="Reason for Rejection *"
                          value={reviewReason}
                          onChangeText={setReviewReason}
                          placeholder="e.g. Qualifications do not meet state persatuan standards..."
                          multiline
                          numberOfLines={3}
                          testID="input-rejection-reason"
                        />
                      ) : null}

                      <Input
                        label="Internal Review Notes (Optional)"
                        value={reviewNotes}
                        onChangeText={setReviewNotes}
                        placeholder="Internal administrator log notes..."
                        testID="input-review-notes"
                      />

                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            label="Cancel"
                            onPress={() => setActionType(null)}
                            variant="outline"
                            disabled={submittingAction}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            label={
                              actionType === 'APPROVE'
                                ? 'Approve'
                                : actionType === 'REQUEST_INFO'
                                ? 'Send Request'
                                : 'Reject'
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
                label="Close Window"
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
