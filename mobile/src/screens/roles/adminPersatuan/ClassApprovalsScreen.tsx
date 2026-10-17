import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import {
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
import { EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface ClassApprovalsScreenProps {
  user: AuthUser;
  navigation?: any;
  onLogout?: () => void;
  isOffline?: boolean;
}

export interface ClassProposalItem {
  id: string;
  name: string;
  organization_id?: string;
  proposing_master_name?: string;
  proposing_master_email?: string;
  location?: string;
  venue_details?: string;
  schedule?: string;
  age_eligibility?: string;
  training_level?: string;
  program_type?: string;
  capacity?: number;
  monthly_fee?: string | number;
  description?: string;
  contact_channel?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  version: number;
  requested_information?: string;
  rejection_reason?: string;
  submitted_at?: string;
  created_at?: string;
}

export const ClassApprovalsScreen: React.FC<ClassApprovalsScreenProps> = ({
  navigation,
  isOffline,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [applications, setApplications] = useState<ClassProposalItem[]>([]);

  // Modal review state
  const [selectedApp, setSelectedApp] = useState<ClassProposalItem | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [decisionMode, setDecisionMode] = useState<'IDLE' | 'REQUEST_INFO' | 'REJECT'>('IDLE');
  const [reviewText, setReviewText] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/class-applications/inbox');
      setApplications(res?.applications || []);
    } catch (err) {
      console.error('[ClassApprovalsScreen fetch error]', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const res: any = await apiClient.get('/class-applications/inbox');
        if (!isCancelled) {
          setApplications(res?.applications || []);
        }
      } catch (err) {
        console.error('[ClassApprovalsScreen load error]', err);
      } finally {
        if (!isCancelled) {
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleApprove = async () => {
    if (!selectedApp) return;

    Alert.alert(
      'Confirm Class Approval',
      `Are you sure you want to approve "${selectedApp.name}"? This will create an active operational class and establish primary Master leadership.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Activate',
          style: 'default',
          onPress: async () => {
            setSubmittingDecision(true);
            try {
              const res: any = await apiClient.post(`/class-applications/${selectedApp.id}/review`, {
                decision: 'APPROVE',
                expectedVersion: selectedApp.version,
              });

              Alert.alert('Approved', res?.message || 'Class approved and activated.');
              setReviewModalVisible(false);
              setSelectedApp(null);
              fetchInbox();
            } catch (err: any) {
              if (err?.code === 'STALE_VERSION' || err?.status === 409) {
                Alert.alert(
                  'Conflict: Stale Proposal Version',
                  'This proposal was modified since you opened it. Please refresh and review the updated version.'
                );
              } else {
                Alert.alert('Approval Error', err?.message || 'Failed to approve proposal.');
              }
            } finally {
              setSubmittingDecision(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestInfo = async () => {
    if (!selectedApp) return;
    if (!reviewText.trim()) {
      Alert.alert('Required', 'Please enter the specific information requested from the Master.');
      return;
    }

    setSubmittingDecision(true);
    try {
      await apiClient.post(`/class-applications/${selectedApp.id}/review`, {
        decision: 'REQUEST_INFORMATION',
        expectedVersion: selectedApp.version,
        requestedInformation: reviewText.trim(),
      });

      Alert.alert('Information Requested', 'The Master has been notified to provide additional information.');
      setReviewModalVisible(false);
      setSelectedApp(null);
      setDecisionMode('IDLE');
      setReviewText('');
      fetchInbox();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to request information.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    if (!reviewText.trim()) {
      Alert.alert('Required', 'Please enter the reason for rejecting this class proposal.');
      return;
    }

    setSubmittingDecision(true);
    try {
      await apiClient.post(`/class-applications/${selectedApp.id}/review`, {
        decision: 'REJECT',
        expectedVersion: selectedApp.version,
        reason: reviewText.trim(),
      });

      Alert.alert('Proposal Rejected', 'The class proposal has been marked as rejected.');
      setReviewModalVisible(false);
      setSelectedApp(null);
      setDecisionMode('IDLE');
      setReviewText('');
      fetchInbox();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reject proposal.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const pendingCount = applications.filter((a) => a.status === 'SUBMITTED').length;

  return (
    <ScreenContainer scrollable testID="admin-class-approvals-screen">
      <ScreenHeader
        title="Class Proposals"
        subtitle={`${pendingCount} pending Persatuan review`}
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInbox(); }} />}
      >
        {applications.length === 0 ? (
          <EmptyState
            title="Inbox Zero"
            description="No class proposals awaiting review for your Persatuan."
            testID="empty-class-inbox"
          />
        ) : (
          applications.map((item) => (
            <Card key={item.id} variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.buttonPrimaryBg, fontWeight: '600', marginTop: 2 }]}>
                    Proposed by: {item.proposing_master_name || 'Master'}
                  </Text>
                  {item.schedule ? (
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      Schedule: {item.schedule}
                    </Text>
                  ) : null}
                  {item.location ? (
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 1 }]}>
                      Venue: {item.location} {item.venue_details ? `(${item.venue_details})` : ''}
                    </Text>
                  ) : null}
                  {item.monthly_fee ? (
                    <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                      Fee: RM {Number(item.monthly_fee).toFixed(2)} / month | Capacity: {item.capacity || 30}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge
                  status={item.status === 'APPROVED' ? 'ACTIVE' : item.status === 'REJECTED' ? 'EXPIRED' : 'PENDING'}
                  label={item.status}
                  variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}
                />
              </View>

              <View style={styles.cardActions}>
                <Button
                  label="Review Proposal"
                  onPress={() => {
                    setSelectedApp(item);
                    setDecisionMode('IDLE');
                    setReviewText('');
                    setReviewModalVisible(true);
                  }}
                  variant="primary"
                  size="sm"
                  rightIcon={<ChevronRight size={iconSize.sm} color={colors.buttonPrimaryText} />}
                  testID={`btn-review-${item.id}`}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      {selectedApp ? (
        <Modal
          visible={reviewModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[typography.pageTitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                Review Class Proposal
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                {selectedApp.name} (v{selectedApp.version})
              </Text>

              <ScrollView style={{ maxHeight: 300, marginBottom: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Proposing Master</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  {selectedApp.proposing_master_name} ({selectedApp.proposing_master_email})
                </Text>

                <Text style={[typography.caption, { color: colors.textMuted }]}>Location & Venue</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  {selectedApp.location} {selectedApp.venue_details ? `— ${selectedApp.venue_details}` : ''}
                </Text>

                <Text style={[typography.caption, { color: colors.textMuted }]}>Schedule</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  {selectedApp.schedule}
                </Text>

                <Text style={[typography.caption, { color: colors.textMuted }]}>Eligibility & Program</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  {selectedApp.age_eligibility || 'All ages'} | {selectedApp.training_level || 'All levels'} | {selectedApp.program_type || 'General'}
                </Text>

                <Text style={[typography.caption, { color: colors.textMuted }]}>Tuition Fee & Capacity</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                  RM {Number(selectedApp.monthly_fee || 120).toFixed(2)} / month | Capacity: {selectedApp.capacity || 30}
                </Text>

                {selectedApp.description ? (
                  <>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Description</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                      {selectedApp.description}
                    </Text>
                  </>
                ) : null}
              </ScrollView>

              {decisionMode === 'REQUEST_INFO' && (
                <View style={{ marginBottom: spacing.md }}>
                  <Input
                    label="Information Required *"
                    placeholder="Describe what documentation or clarification is needed..."
                    value={reviewText}
                    multiline
                    numberOfLines={3}
                    onChangeText={setReviewText}
                    testID="input-requested-info"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Button
                      label="Cancel"
                      onPress={() => setDecisionMode('IDLE')}
                      variant="outline"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Send Request"
                      onPress={handleRequestInfo}
                      variant="primary"
                      size="sm"
                      loading={submittingDecision}
                      style={{ flex: 1 }}
                      testID="btn-confirm-request-info"
                    />
                  </View>
                </View>
              )}

              {decisionMode === 'REJECT' && (
                <View style={{ marginBottom: spacing.md }}>
                  <Input
                    label="Rejection Reason *"
                    placeholder="State reason for rejecting proposal..."
                    value={reviewText}
                    multiline
                    numberOfLines={3}
                    onChangeText={setReviewText}
                    testID="input-rejection-reason"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Button
                      label="Cancel"
                      onPress={() => setDecisionMode('IDLE')}
                      variant="outline"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Confirm Rejection"
                      onPress={handleReject}
                      variant="primary"
                      size="sm"
                      loading={submittingDecision}
                      style={{ flex: 1 }}
                      testID="btn-confirm-reject"
                    />
                  </View>
                </View>
              )}

              {decisionMode === 'IDLE' && (
                <View style={styles.decisionActions}>
                  <Button
                    label="Approve"
                    onPress={handleApprove}
                    variant="primary"
                    size="md"
                    loading={submittingDecision}
                    leftIcon={<CheckCircle size={iconSize.sm} color={colors.buttonPrimaryText} />}
                    testID="btn-decision-approve"
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Button
                    label="Request Information"
                    onPress={() => setDecisionMode('REQUEST_INFO')}
                    variant="outline"
                    size="md"
                    leftIcon={<HelpCircle size={iconSize.sm} color={colors.textPrimary} />}
                    testID="btn-decision-request-info"
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Button
                    label="Reject Proposal"
                    onPress={() => setDecisionMode('REJECT')}
                    variant="outline"
                    size="md"
                    leftIcon={<XCircle size={iconSize.sm} color={colors.buttonDangerBg} />}
                    testID="btn-decision-reject"
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Button
                    label="Close"
                    onPress={() => setReviewModalVisible(false)}
                    variant="outline"
                    size="sm"
                  />
                </View>
              )}
            </View>
          </View>
        </Modal>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    maxHeight: '90%',
  },
  decisionActions: {
    marginTop: 8,
  },
});
