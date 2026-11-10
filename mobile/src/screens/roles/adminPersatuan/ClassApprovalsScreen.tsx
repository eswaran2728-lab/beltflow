import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
  BookOpen,
  Clock,
  CheckCheck,
  MapPin,
  Calendar,
  Users,
  DollarSign,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { StatusBadge } from '../../../components/Badges';
import { EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { StitchAppHeader, StitchStatCard } from '../../../components/stitch';
import { StitchTokens } from '../../../theme/tokens';

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
  user,
  navigation,
  onLogout,
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
  const approvedCount = applications.filter((a) => a.status === 'APPROVED').length;
  const needsInfoCount = applications.filter((a) => a.status === 'NEEDS_INFORMATION').length;

  return (
    <ScreenContainer scrollable testID="admin-class-approvals-screen" style={{ backgroundColor: colors.background }}>
      {/* Stitch App Header */}
      <StitchAppHeader
        roleBadgeText="ADMIN PERSATUAN"
        dojangName="PERSATUAN DOJANG"
        hasUnreadNotifications={pendingCount > 0}
      />

      {/* Screen Title & Subtitle banner */}
      <View style={[styles.titleBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>Class Proposals</Text>
          <Text style={[styles.screenSubheading, { color: colors.textSecondary }]}>{pendingCount} pending Persatuan review</Text>
        </View>
        <View style={styles.badgeContainer}>
          <StatusBadge
            status={pendingCount > 0 ? 'PENDING' : 'ACTIVE'}
            label={pendingCount > 0 ? `${pendingCount} PENDING` : 'ALL CLEAR'}
            variant={pendingCount > 0 ? 'warning' : 'success'}
          />
        </View>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCol}>
          <StitchStatCard
            label="PENDING"
            value={pendingCount}
            hasAccentBorder
            accentColor={StitchTokens.colors.colorAccent}
          />
        </View>
        <View style={styles.kpiCol}>
          <StitchStatCard
            label="APPROVED"
            value={approvedCount}
            hasAccentBorder
            accentColor={StitchTokens.colors.bfGreen}
          />
        </View>
        <View style={styles.kpiCol}>
          <StitchStatCard
            label="REVISIONS"
            value={needsInfoCount}
            hasAccentBorder
            accentColor={StitchTokens.colors.brandNavy}
          />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInbox(); }} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {applications.length === 0 ? (
          <EmptyState
            title="Inbox Zero"
            description="No class proposals awaiting review for your Persatuan."
            testID="empty-class-inbox"
          />
        ) : (
          applications.map((item) => (
            <Card
              key={item.id}
              variant="elevated"
              style={[
                styles.stitchCard,
                { marginBottom: spacing.md },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={styles.proposalTitle}>
                      {item.name}
                    </Text>
                    <View style={styles.versionPill}>
                      <Text style={styles.versionPillText}>v{item.version}</Text>
                    </View>
                  </View>

                  <Text style={styles.masterAuthor}>
                    Proposed by: {item.proposing_master_name || 'Master'}
                  </Text>

                  {item.schedule ? (
                    <View style={styles.metaRow}>
                      <Calendar size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>Schedule: {item.schedule}</Text>
                    </View>
                  ) : null}

                  {item.location ? (
                    <View style={styles.metaRow}>
                      <MapPin size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        Venue: {item.location} {item.venue_details ? `(${item.venue_details})` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {item.monthly_fee ? (
                    <View style={styles.metaRow}>
                      <DollarSign size={13} color={StitchTokens.colors.colorAccent} />
                      <Text style={[styles.metaText, { color: colors.textPrimary, fontWeight: '700' }]}>
                        Fee: RM {Number(item.monthly_fee).toFixed(2)} / month | Capacity: {item.capacity || 30}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <StatusBadge
                  status={item.status === 'APPROVED' ? 'ACTIVE' : item.status === 'REJECTED' ? 'EXPIRED' : 'PENDING'}
                  label={item.status}
                  variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}
                />
              </View>

              <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
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
                  rightIcon={<ChevronRight size={iconSize.sm} color="#FFFFFF" />}
                  testID={`btn-review-${item.id}`}
                  style={styles.reviewBtn}
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
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Review Class Proposal</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {selectedApp.name} (v{selectedApp.version})
                  </Text>
                </View>
                <StatusBadge
                  status={selectedApp.status === 'APPROVED' ? 'ACTIVE' : selectedApp.status === 'REJECTED' ? 'EXPIRED' : 'PENDING'}
                  label={selectedApp.status}
                  variant={selectedApp.status === 'APPROVED' ? 'success' : selectedApp.status === 'REJECTED' ? 'danger' : 'warning'}
                />
              </View>

              <ScrollView style={{ maxHeight: 300, marginBottom: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Proposing Master</Text>
                <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                  {selectedApp.proposing_master_name} ({selectedApp.proposing_master_email})
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Location & Venue</Text>
                <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                  {selectedApp.location} {selectedApp.venue_details ? `— ${selectedApp.venue_details}` : ''}
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Schedule</Text>
                <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                  {selectedApp.schedule}
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Eligibility & Program</Text>
                <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                  {selectedApp.age_eligibility || 'All ages'} | {selectedApp.training_level || 'All levels'} | {selectedApp.program_type || 'General'}
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Tuition Fee & Capacity</Text>
                <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                  RM {Number(selectedApp.monthly_fee || 120).toFixed(2)} / month | Capacity: {selectedApp.capacity || 30}
                </Text>

                {selectedApp.description ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Description</Text>
                    <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
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
  titleBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  kpiCol: {
    flex: 1,
  },
  stitchCard: {
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  proposalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  versionPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  versionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: StitchTokens.colors.colorAccent,
  },
  masterAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: StitchTokens.colors.colorAccent,
    marginTop: 2,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  metaText: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  reviewBtn: {
    minWidth: 140,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 8,
  },
  fieldValue: {
    fontSize: 14,
    marginTop: 2,
    marginBottom: 4,
  },
  decisionActions: {
    marginTop: 8,
  },
});


