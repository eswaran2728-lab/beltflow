import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { PendingNextStep } from '../../../components/PendingNextStep';
import { useI18n } from '../../../i18n';
import { Input } from '../../../components/Input';
import { LoadingState, EmptyState, ErrorState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface MyApplicationItem {
  id: string;
  persatuan_id: string;
  persatuan_name?: string;
  class_id: string;
  class_name?: string;
  student_id: string | null;
  applicant_type: 'STUDENT' | 'PARENT';
  student_name: string;
  ic_number?: string;
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

export interface MyApplicationsScreenProps {
  user: AuthUser;
  navigation?: any;
}

export const MyApplicationsScreen: React.FC<MyApplicationsScreenProps> = ({
  user,
  navigation,
}) => {
  const { t } = useI18n();
  const { colors, typography, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<MyApplicationItem[]>([]);

  // Response to NEEDS_INFORMATION modal
  const [respondingApp, setRespondingApp] = useState<MyApplicationItem | null>(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/enrollment-applications/me');
      setApplications(res?.applications || []);
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load applications.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const res: any = await apiClient.get('/enrollment-applications/me');
        if (!isCancelled) {
          setApplications(res?.applications || []);
          setError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          const msg = err?.response?.data?.error || err?.message || 'Failed to load applications.';
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
  }, []);

  const handleWithdraw = async (appId: string) => {
    try {
      await apiClient.post(`/enrollment-applications/${appId}/withdraw`, {});
      await fetchApplications();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to withdraw application.';
      setError(msg);
    }
  };

  const handleResubmit = async () => {
    if (!respondingApp) return;
    if (!responseNotes.trim()) {
      setResponseError('Please provide the requested information.');
      return;
    }
    setSubmittingResponse(true);
    setResponseError(null);
    try {
      await apiClient.patch(`/enrollment-applications/${respondingApp.id}`, {
        notes: responseNotes.trim(),
        status: 'SUBMITTED',
      });
      setRespondingApp(null);
      setResponseNotes('');
      await fetchApplications();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to resubmit application.';
      setResponseError(msg);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const getStatusBadge = (status: MyApplicationItem['status'], id: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <StatusBadge
            status="PENDING"
            label={t('status.awaitingMaster')}
            variant="warning"
            testID={`badge-status-${id}`}
          />
        );
      case 'NEEDS_INFORMATION':
        return (
          <StatusBadge
            status="WARNING"
            label={t('status.needsInformation')}
            variant="warning"
            testID={`badge-status-${id}`}
          />
        );
      case 'WAITLISTED':
        return (
          <StatusBadge
            status="INFO"
            label={t('status.waitlisted')}
            variant="info"
            testID={`badge-status-${id}`}
          />
        );
      case 'APPROVED':
        return (
          <StatusBadge
            status="ACTIVE"
            label={t('status.approved')}
            variant="success"
            testID={`badge-status-${id}`}
          />
        );
      case 'REJECTED':
        return (
          <StatusBadge
            status="REJECTED"
            label={t('status.rejected')}
            variant="danger"
            testID={`badge-status-${id}`}
          />
        );
      case 'WITHDRAWN':
        return (
          <StatusBadge
            status="NEUTRAL"
            label={t('status.withdrawn')}
            variant="neutral"
            testID={`badge-status-${id}`}
          />
        );
      case 'DRAFT':
      default:
        return (
          <StatusBadge
            status="NEUTRAL"
            label={t('status.draft')}
            variant="neutral"
            testID={`badge-status-${id}`}
          />
        );
    }
  };

  if (loading && applications.length === 0) {
    return (
      <ScreenContainer scrollable testID="my-applications-screen">
        <ScreenHeader
          title="My Applications"
          subtitle="Track class enrollment and Master approval status"
          onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
        />
        <LoadingState message="Loading your applications..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="my-applications-screen">
      <ScreenHeader
        title="My Applications"
        subtitle="Track class enrollment and Master approval status"
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      {error ? (
        <View style={{ marginBottom: spacing.md }}>
          <ErrorState message={error} onRetry={fetchApplications} />
        </View>
      ) : null}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchApplications(); }} />
        }
      >
        {applications.length === 0 ? (
          <EmptyState
            title="No Applications"
            description="You have not submitted any class enrollment applications yet."
            testID="empty-applications-state"
          />
        ) : (
          applications.map((app) => (
            <Card
              key={app.id}
              variant="standard"
              style={[styles.appCard, { marginBottom: spacing.md }]}
              testID={`application-card-${app.id}`}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {app.student_name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600', marginTop: 2 }]}>
                    {app.class_name ? `Class: ${app.class_name}` : `Class ID: ${app.class_id}`}
                  </Text>
                  {app.persatuan_name ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {app.persatuan_name}
                    </Text>
                  ) : null}
                </View>
                {getStatusBadge(app.status, app.id)}
              </View>

              <View style={[styles.detailSection, { marginTop: spacing.sm }]}>
                <PendingNextStep kind="ENROLLMENT_APPLICATION" status={app.status} testID={`pending-next-step-${app.id}`} />

                {app.status === 'SUBMITTED' ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Your application is currently under review by the class Master. You will join the active class roster once approved.
                  </Text>
                ) : null}

                {app.status === 'WAITLISTED' ? (
                  <Text style={[typography.caption, { color: colors.badgeInfoText, fontWeight: '500' }]}>
                    Notice: This class is currently full. Your application has been placed on the waitlist.
                  </Text>
                ) : null}

                {app.status === 'APPROVED' ? (
                  <Text style={[typography.caption, { color: colors.badgeSuccessText, fontWeight: '600' }]}>
                    Congratulations! Your application has been approved by the Master. You are now an active class member.
                  </Text>
                ) : null}

                {app.status === 'REJECTED' ? (
                  <View style={{ marginTop: 2 }}>
                    <Text style={[typography.caption, { color: colors.badgeDangerText, fontWeight: '600' }]}>
                      Application Rejected by Master.
                    </Text>
                    {app.rejection_reason ? (
                      <Text style={[typography.caption, { color: colors.badgeDangerText }]}>
                        Reason: {app.rejection_reason}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {app.status === 'NEEDS_INFORMATION' ? (
                  <View style={[styles.needsInfoBox, { backgroundColor: colors.badgeWarningBg, borderColor: colors.badgeWarningText, marginTop: spacing.xs }]}>
                    <Text style={[typography.caption, { color: colors.badgeWarningText, fontWeight: '700' }]}>
                      Master Requested Additional Information:
                    </Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 2 }]}>
                      {app.requested_information || 'Please clarify your enrollment details.'}
                    </Text>
                    <Button
                      label="Provide Information & Resubmit"
                      onPress={() => {
                        setRespondingApp(app);
                        setResponseNotes('');
                        setResponseError(null);
                      }}
                      variant="primary"
                      size="sm"
                      style={{ marginTop: spacing.sm }}
                      testID={`btn-resubmit-${app.id}`}
                    />
                  </View>
                ) : null}

                {/* Withdraw action */}
                {['SUBMITTED', 'DRAFT', 'NEEDS_INFORMATION', 'WAITLISTED'].includes(app.status) ? (
                  <View style={{ marginTop: spacing.md, alignItems: 'flex-end' }}>
                    <Button
                      label="Withdraw Application"
                      onPress={() => handleWithdraw(app.id)}
                      variant="outline"
                      size="sm"
                      testID={`btn-withdraw-${app.id}`}
                    />
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Resubmit Modal */}
      <Modal
        visible={Boolean(respondingApp)}
        transparent
        animationType="fade"
        onRequestClose={() => setRespondingApp(null)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Respond to Master Request
            </Text>
            <Text style={[typography.caption, { color: colors.badgeWarningText, marginBottom: spacing.sm }]}>
              Requested: {respondingApp?.requested_information}
            </Text>

            <Input
              label="Your Response / Updated Information *"
              placeholder="Provide requested details..."
              value={responseNotes}
              onChangeText={setResponseNotes}
              multiline
              numberOfLines={4}
              containerStyle={{ marginBottom: spacing.md }}
              testID="input-resubmit-notes"
            />

            {responseError ? (
              <Text style={[typography.caption, { color: colors.badgeDangerText, marginBottom: spacing.sm }]}>
                {responseError}
              </Text>
            ) : null}

            <View style={[styles.modalActionsRow, { gap: spacing.sm }]}>
              <Button
                label="Cancel"
                onPress={() => setRespondingApp(null)}
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                testID="btn-cancel-resubmit"
              />
              <Button
                label={submittingResponse ? 'Submitting...' : 'Submit Response'}
                onPress={handleResubmit}
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                disabled={submittingResponse}
                testID="btn-confirm-resubmit"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
  needsInfoBox: {
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
