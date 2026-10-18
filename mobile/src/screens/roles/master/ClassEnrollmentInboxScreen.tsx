import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { Input } from '../../../components/Input';
import { LoadingState, EmptyState, ErrorState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface EnrollmentApplicationItem {
  id: string;
  persatuan_id: string;
  class_id: string;
  student_id: string | null;
  applicant_type: 'STUDENT' | 'PARENT';
  submitted_by_user_id: string;
  student_name: string;
  ic_number?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_notes?: string;
  notes?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_INFORMATION' | 'WAITLISTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  requested_information?: string;
  rejection_reason?: string;
  consent_accepted: boolean;
  version: number;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ClassEnrollmentInboxScreenProps {
  user: AuthUser;
  route?: {
    params?: {
      classId: string;
      className?: string;
    };
  };
  navigation?: any;
}

export const ClassEnrollmentInboxScreen: React.FC<ClassEnrollmentInboxScreenProps> = ({
  user,
  route,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const classId = route?.params?.classId || '';
  const className = route?.params?.className || 'Class';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [classInfo, setClassInfo] = useState<{
    id: string;
    name: string;
    capacity: number;
    enrolledCount: number;
    availableSpots: number;
    enrollmentAvailability: string;
  } | null>(null);

  const [applications, setApplications] = useState<EnrollmentApplicationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'WAITLISTED' | 'NEEDS_INFO' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  // Modal Action States
  const [selectedApp, setSelectedApp] = useState<EnrollmentApplicationItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REQUEST_INFO' | 'REJECT' | 'WAITLIST' | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchInboxData = useCallback(async () => {
    if (!classId) {
      setLoading(false);
      setError('No class selected for enrollment inbox.');
      return;
    }
    try {
      const res: any = await apiClient.get(`/classes/${classId}/enrollment-applications`);
      setClassInfo(res?.class || null);
      setApplications(res?.applications || []);
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load enrollment applications.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!classId) {
        if (!isCancelled) {
          setLoading(false);
          setError('No class selected for enrollment inbox.');
        }
        return;
      }
      try {
        const res: any = await apiClient.get(`/classes/${classId}/enrollment-applications`);
        if (!isCancelled) {
          setClassInfo(res?.class || null);
          setApplications(res?.applications || []);
          setError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          const msg = err?.response?.data?.error || err?.message || 'Failed to load enrollment applications.';
          setError(msg);
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
  }, [classId]);

  const handleOpenAction = (app: EnrollmentApplicationItem, type: 'APPROVE' | 'REQUEST_INFO' | 'REJECT' | 'WAITLIST') => {
    setSelectedApp(app);
    setActionType(type);
    setActionText('');
    setActionError(null);
  };

  const handleCloseModal = () => {
    setSelectedApp(null);
    setActionType(null);
    setActionText('');
    setActionError(null);
    setActionSubmitting(false);
  };

  const handleConfirmDecision = async () => {
    if (!selectedApp || !actionType) return;

    if (actionType === 'REJECT' && !actionText.trim()) {
      setActionError('Please provide a reason for rejecting this application.');
      return;
    }
    if (actionType === 'REQUEST_INFO' && !actionText.trim()) {
      setActionError('Please specify the information requested from the applicant.');
      return;
    }

    setActionSubmitting(true);
    setActionError(null);

    try {
      const payload: any = {
        decision: actionType === 'REQUEST_INFO' ? 'REQUEST_INFORMATION' : actionType,
        expectedVersion: selectedApp.version,
      };

      if (actionType === 'REJECT') {
        payload.rejectionReason = actionText.trim();
      } else if (actionType === 'REQUEST_INFO') {
        payload.requestedInformation = actionText.trim();
      }

      await apiClient.post(`/enrollment-applications/${selectedApp.id}/review`, payload);

      setActionSuccess(`Application successfully updated.`);
      handleCloseModal();
      await fetchInboxData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to process application.';
      setActionError(errMsg);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Filtered lists
  const pendingApps = applications.filter(a => a.status === 'SUBMITTED');
  const waitlistedApps = applications.filter(a => a.status === 'WAITLISTED');
  const needsInfoApps = applications.filter(a => a.status === 'NEEDS_INFORMATION');
  const approvedApps = applications.filter(a => a.status === 'APPROVED');
  const rejectedApps = applications.filter(a => a.status === 'REJECTED');

  const currentList =
    activeTab === 'PENDING'
      ? pendingApps
      : activeTab === 'WAITLISTED'
      ? waitlistedApps
      : activeTab === 'NEEDS_INFO'
      ? needsInfoApps
      : activeTab === 'APPROVED'
      ? approvedApps
      : rejectedApps;

  if (loading && applications.length === 0) {
    return (
      <ScreenContainer scrollable testID="master-enrollment-inbox">
        <ScreenHeader
          title="Class Applications"
          subtitle={`Review enrollment applications for ${className}`}
          onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
        />
        <LoadingState message="Loading applications..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="master-enrollment-inbox">
      <ScreenHeader
        title="Class Applications"
        subtitle={`Review enrollment applications for ${className}`}
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      {error ? (
        <View style={{ marginBottom: spacing.md }}>
          <ErrorState message={error} onRetry={fetchInboxData} />
        </View>
      ) : null}

      {actionSuccess ? (
        <Card variant="standard" style={[styles.successBanner, { borderColor: colors.badgeSuccessText, marginBottom: spacing.sm }]}>
          <Text style={[typography.bodyMedium, { color: colors.badgeSuccessText, fontWeight: '600' }]}>
            {actionSuccess}
          </Text>
        </Card>
      ) : null}

      {/* Class Capacity Card */}
      {classInfo ? (
        <Card variant="elevated" style={[styles.capacityCard, { marginBottom: spacing.md }]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {classInfo.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Enrolled: {classInfo.enrolledCount} / {classInfo.capacity} students
              </Text>
            </View>
            <StatusBadge
              status={classInfo.availableSpots > 0 ? 'ACTIVE' : 'WARNING'}
              label={classInfo.availableSpots > 0 ? `${classInfo.availableSpots} Spots Open` : 'Class Full'}
              variant={classInfo.availableSpots > 0 ? 'success' : 'danger'}
              testID="class-capacity-badge"
            />
          </View>
          {classInfo.availableSpots === 0 ? (
            <View style={[styles.fullWarningRow, { marginTop: spacing.xs }]}>
              <AlertTriangle size={iconSize.sm} color={colors.badgeDangerText} />
              <Text style={[typography.caption, { color: colors.badgeDangerText, marginLeft: spacing.xs, fontWeight: '600' }]}>
                Capacity reached. Further approvals will be blocked unless waitlisted.
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Filter Tabs */}
      <View style={[styles.tabBar, { marginBottom: spacing.md }]}>
        <Button
          label={`Pending (${pendingApps.length})`}
          onPress={() => setActiveTab('PENDING')}
          variant={activeTab === 'PENDING' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginRight: 4 }}
          testID="tab-inbox-pending"
        />
        <Button
          label={`Waitlist (${waitlistedApps.length})`}
          onPress={() => setActiveTab('WAITLISTED')}
          variant={activeTab === 'WAITLISTED' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginHorizontal: 2 }}
          testID="tab-inbox-waitlist"
        />
        <Button
          label={`Needs Info (${needsInfoApps.length})`}
          onPress={() => setActiveTab('NEEDS_INFO')}
          variant={activeTab === 'NEEDS_INFO' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginHorizontal: 2 }}
          testID="tab-inbox-needs-info"
        />
        <Button
          label={`Approved (${approvedApps.length})`}
          onPress={() => setActiveTab('APPROVED')}
          variant={activeTab === 'APPROVED' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginLeft: 4 }}
          testID="tab-inbox-approved"
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchInboxData(); }} />
        }
      >
        {currentList.length === 0 ? (
          <EmptyState
            title="No Applications Found"
            description={`No applications in ${activeTab.toLowerCase().replace('_', ' ')} state.`}
            testID="empty-inbox-state"
          />
        ) : (
          currentList.map((app) => {
            const isExpanded = expandedAppId === app.id;
            return (
              <Card
                key={app.id}
                variant="standard"
                style={[styles.appCard, { marginBottom: spacing.md }]}
                testID={`application-item-${app.id}`}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setExpandedAppId(isExpanded ? null : app.id)}
                  style={styles.cardHeader}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                      {app.student_name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      Applicant: {app.applicant_type} • Submitted: {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'Draft'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <StatusBadge
                      status={app.status === 'APPROVED' ? 'ACTIVE' : app.status === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                      label={app.status.replace('_', ' ')}
                      variant={
                        app.status === 'APPROVED'
                          ? 'success'
                          : app.status === 'REJECTED'
                          ? 'danger'
                          : app.status === 'NEEDS_INFORMATION'
                          ? 'warning'
                          : 'info'
                      }
                      testID={`status-badge-${app.id}`}
                    />
                    {isExpanded ? (
                      <ChevronUp size={iconSize.sm} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={iconSize.sm} color={colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Details view */}
                <View style={[styles.detailSection, { marginTop: spacing.sm }]}>
                  <View style={styles.detailGrid}>
                    {app.ic_number ? (
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>IC / MyKid: </Text>{app.ic_number}
                      </Text>
                    ) : null}
                    {app.date_of_birth ? (
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>DOB: </Text>{app.date_of_birth} ({app.gender || 'N/A'})
                      </Text>
                    ) : null}
                    {app.emergency_contact_name ? (
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                        <Text style={{ fontWeight: '700' }}>Emergency Contact: </Text>{app.emergency_contact_name} ({app.emergency_contact_phone || 'N/A'})
                      </Text>
                    ) : null}
                    {app.medical_notes ? (
                      <Text style={[typography.caption, { color: colors.badgeDangerText, marginTop: 2 }]}>
                        <Text style={{ fontWeight: '700' }}>Medical: </Text>{app.medical_notes}
                      </Text>
                    ) : null}
                    {app.notes ? (
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        <Text style={{ fontWeight: '700' }}>Notes: </Text>{app.notes}
                      </Text>
                    ) : null}
                    {app.requested_information ? (
                      <Text style={[typography.caption, { color: colors.badgeWarningText, marginTop: 2 }]}>
                        <Text style={{ fontWeight: '700' }}>Requested Info: </Text>{app.requested_information}
                      </Text>
                    ) : null}
                    {app.rejection_reason ? (
                      <Text style={[typography.caption, { color: colors.badgeDangerText, marginTop: 2 }]}>
                        <Text style={{ fontWeight: '700' }}>Rejection Reason: </Text>{app.rejection_reason}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.consentRow, { marginTop: spacing.xs }]}>
                    <CheckCircle size={iconSize.xs} color={app.consent_accepted ? colors.badgeSuccessText : colors.badgeDangerText} />
                    <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
                      {app.consent_accepted ? 'Parent/Student Consent Verified' : 'Consent Pending'}
                    </Text>
                  </View>

                  {/* Actions (Available for non-terminal statuses) */}
                  {['SUBMITTED', 'WAITLISTED', 'NEEDS_INFORMATION'].includes(app.status) ? (
                    <View style={[styles.actionButtonsRow, { marginTop: spacing.md, gap: spacing.xs }]}>
                      <Button
                        label="Approve"
                        onPress={() => handleOpenAction(app, 'APPROVE')}
                        variant="primary"
                        size="sm"
                        style={{ flex: 1 }}
                        testID={`btn-approve-${app.id}`}
                      />
                      <Button
                        label="Request Info"
                        onPress={() => handleOpenAction(app, 'REQUEST_INFO')}
                        variant="outline"
                        size="sm"
                        style={{ flex: 1 }}
                        testID={`btn-request-info-${app.id}`}
                      />
                      {app.status !== 'WAITLISTED' ? (
                        <Button
                          label="Waitlist"
                          onPress={() => handleOpenAction(app, 'WAITLIST')}
                          variant="secondary"
                          size="sm"
                          style={{ flex: 1 }}
                          testID={`btn-waitlist-${app.id}`}
                        />
                      ) : null}
                      <Button
                        label="Reject"
                        onPress={() => handleOpenAction(app, 'REJECT')}
                        variant="danger"
                        size="sm"
                        style={{ flex: 1 }}
                        testID={`btn-reject-${app.id}`}
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Decision Modal */}
      <Modal
        visible={Boolean(actionType && selectedApp)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              {actionType === 'APPROVE'
                ? 'Confirm Class Enrollment'
                : actionType === 'REQUEST_INFO'
                ? 'Request Information'
                : actionType === 'WAITLIST'
                ? 'Place on Waitlist'
                : 'Reject Application'}
            </Text>

            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Student: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{selectedApp?.student_name}</Text>
            </Text>

            {actionType === 'APPROVE' && (
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Are you sure you want to approve this enrollment? The student will immediately join the authorized active class roster.
              </Text>
            )}

            {actionType === 'WAITLIST' && (
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                Move this applicant to the waitlist? They will not be counted as an active class attendee.
              </Text>
            )}

            {actionType === 'REQUEST_INFO' && (
              <Input
                label="Information Required *"
                placeholder="Specify what details or medical info are needed..."
                value={actionText}
                onChangeText={setActionText}
                multiline
                numberOfLines={3}
                containerStyle={{ marginBottom: spacing.md }}
                testID="input-request-info-text"
              />
            )}

            {actionType === 'REJECT' && (
              <Input
                label="Rejection Reason *"
                placeholder="Reason for declining this enrollment..."
                value={actionText}
                onChangeText={setActionText}
                multiline
                numberOfLines={3}
                containerStyle={{ marginBottom: spacing.md }}
                testID="input-rejection-reason-text"
              />
            )}

            {actionError ? (
              <Text style={[typography.caption, { color: colors.badgeDangerText, marginBottom: spacing.sm }]} testID="modal-action-error">
                {actionError}
              </Text>
            ) : null}

            <View style={[styles.modalActionsRow, { gap: spacing.sm }]}>
              <Button
                label="Cancel"
                onPress={handleCloseModal}
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                testID="btn-cancel-modal"
              />
              <Button
                label={
                  actionSubmitting
                    ? 'Processing...'
                    : actionType === 'APPROVE'
                    ? 'Confirm Approve'
                    : actionType === 'REQUEST_INFO'
                    ? 'Send Request'
                    : actionType === 'WAITLIST'
                    ? 'Confirm Waitlist'
                    : 'Confirm Reject'
                }
                onPress={handleConfirmDecision}
                variant={actionType === 'REJECT' ? 'danger' : 'primary'}
                size="md"
                style={{ flex: 1 }}
                disabled={actionSubmitting}
                testID="btn-confirm-action"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  capacityCard: {
    padding: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
  },
  appCard: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
  },
  detailGrid: {
    gap: 4,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
  },
  successBanner: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    padding: 20,
    borderRadius: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
  },
});
