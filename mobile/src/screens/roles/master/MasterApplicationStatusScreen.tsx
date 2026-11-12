import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  XCircle,
  LogOut,
  Send,
  Building,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { PendingNextStep } from '../../../components/PendingNextStep';
import { BrandColors } from '../../../theme/colors';
import { useI18n } from '../../../i18n';

export interface MasterApplicationStatusScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  onVerified?: () => void;
}

export interface MasterApplication {
  id: string;
  user_id: string;
  organization_id: string;
  organization_name?: string;
  applicant_name?: string;
  qualifications?: string;
  experience_summary?: string;
  verification_details?: string;
  documents_url?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  version: number;
  reviewer_id?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  requested_information?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export const MasterApplicationStatusScreen: React.FC<MasterApplicationStatusScreenProps> = ({
  user,
  onLogout,
  isOffline,
  onVerified,
}) => {
  const { t } = useI18n();
  const { colors, typography, spacing, iconSize } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<MasterApplication | null>(null);

  // Form state
  const [organizations, setOrganizations] = useState<{ id: string; name: string; state: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(user.organizationId || '');
  const [qualifications, setQualifications] = useState('');
  const [experienceSummary, setExperienceSummary] = useState('');
  const [verificationDetails, setVerificationDetails] = useState('');
  const [documentsUrl, setDocumentsUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApplicationData = useCallback(async () => {
    try {
      try {
        const orgRes: any = await apiClient.get('/auth/registration-organizations', { requiresAuth: false });
        if (orgRes?.organizations) {
          setOrganizations(orgRes.organizations);
        }
      } catch {
        // Non-blocking if offline
      }

      const res: any = await apiClient.get('/master-applications/me');
      if (res?.applications && res.applications.length > 0) {
        const latest = res.applications[0];
        setApplication(latest);
        setSelectedOrgId(latest.organization_id);
        setQualifications(latest.qualifications || '');
        setExperienceSummary(latest.experience_summary || '');
        setVerificationDetails(latest.verification_details || '');
        setDocumentsUrl(latest.documents_url || '');
      } else {
        setApplication(null);
      }
      setError(null);

      if (res?.currentAffiliationStatus === 'ACTIVE' && onVerified) {
        onVerified();
      }
    } catch (err: any) {
      setError(err?.message || t('masterLifecycle.masterApp.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onVerified, t]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        let orgs: { id: string; name: string; state: string }[] = [];
        try {
          const orgRes: any = await apiClient.get('/auth/registration-organizations', { requiresAuth: false });
          if (orgRes?.organizations) {
            orgs = orgRes.organizations;
          }
        } catch {
          // Non-blocking if offline
        }

        const res: any = await apiClient.get('/master-applications/me');
        if (!isCancelled) {
          if (orgs.length > 0) {
            setOrganizations(orgs);
          }
          if (res?.applications && res.applications.length > 0) {
            const latest = res.applications[0];
            setApplication(latest);
            setSelectedOrgId(latest.organization_id);
            setQualifications(latest.qualifications || '');
            setExperienceSummary(latest.experience_summary || '');
            setVerificationDetails(latest.verification_details || '');
            setDocumentsUrl(latest.documents_url || '');
          } else {
            setApplication(null);
          }
          setError(null);

          if (res?.currentAffiliationStatus === 'ACTIVE' && onVerified) {
            onVerified();
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || t('masterLifecycle.masterApp.loadFailed'));
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
  }, [onVerified, t]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplicationData();
  };


  const handleSaveDraft = async () => {
    if (!selectedOrgId) {
      Alert.alert(t('masterLifecycle.masterApp.requiredTitle'), t('masterLifecycle.masterApp.selectPersatuanBeforeSave'));
      return;
    }
    setSubmitting(true);
    try {
      if (!application) {
        const res: any = await apiClient.post('/master-applications', {
          organizationId: selectedOrgId,
          qualifications,
          experienceSummary,
          verificationDetails,
          documentsUrl,
        });
        setApplication(res.application);
      } else {
        const res: any = await apiClient.patch(`/master-applications/${application.id}`, {
          qualifications,
          experienceSummary,
          verificationDetails,
          documentsUrl,
        });
        setApplication(res.application);
      }
      Alert.alert(t('masterLifecycle.masterApp.savedTitle'), t('masterLifecycle.masterApp.draftSaved'));
    } catch (err: any) {
      Alert.alert(t('masterLifecycle.common.error'), err?.message || t('masterLifecycle.masterApp.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedOrgId) {
      Alert.alert(t('masterLifecycle.masterApp.requiredTitle'), t('masterLifecycle.masterApp.selectPersatuan'));
      return;
    }
    if (!qualifications.trim() || !experienceSummary.trim()) {
      Alert.alert(t('masterLifecycle.masterApp.incompleteTitle'), t('masterLifecycle.masterApp.incompleteBody'));
      return;
    }
    setSubmitting(true);
    try {
      let appId = application?.id;
      if (!appId) {
        const res: any = await apiClient.post('/master-applications', {
          organizationId: selectedOrgId,
          qualifications,
          experienceSummary,
          verificationDetails,
          documentsUrl,
        });
        appId = res.application.id;
      } else {
        await apiClient.patch(`/master-applications/${appId}`, {
          qualifications,
          experienceSummary,
          verificationDetails,
          documentsUrl,
        });
      }

      const submitRes: any = await apiClient.post(`/master-applications/${appId}/submit`, {});
      setApplication(submitRes.application);
      Alert.alert(t('masterLifecycle.masterApp.submittedTitle'), t('masterLifecycle.masterApp.submittedBody'));
    } catch (err: any) {
      Alert.alert(t('masterLifecycle.common.error'), err?.message || t('masterLifecycle.masterApp.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!application) return;
    Alert.alert(
      t('masterLifecycle.masterApp.withdrawTitle'),
      t('masterLifecycle.masterApp.withdrawConfirm'),
      [
        { text: t('masterLifecycle.common.cancel'), style: 'cancel' },
        {
          text: t('masterLifecycle.common.withdraw'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await apiClient.post(`/master-applications/${application.id}/withdraw`, {});
              setApplication(res.application);
            } catch (err: any) {
              Alert.alert(t('masterLifecycle.common.error'), err?.message || t('masterLifecycle.masterApp.withdrawFailed'));
            }
          },
        },
      ]
    );
  };

  const headerRight = onLogout ? (
    <Button
      label={t('masterLifecycle.masterApp.signOut')}
      onPress={onLogout}
      variant="outline"
      size="sm"
      leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
      testID="btn-app-logout"
    />
  ) : undefined;

  if (loading && !refreshing) {
    return (
      <ScreenContainer testID="master-app-status-screen">
        <ScreenHeader title={t('masterLifecycle.masterApp.title')} subtitle={t('masterLifecycle.masterApp.loadingSubtitle')} rightAction={headerRight} />
        <LoadingState message={t('masterLifecycle.masterApp.loading')} />
      </ScreenContainer>
    );
  }

  const renderStatusBanner = () => {
    if (!application) {
      return (
        <Card variant="standard" style={[styles.statusCard, { borderColor: colors.border }]}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 4 }]}>
            {t('masterLifecycle.masterApp.noApp.title')}
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            {t('masterLifecycle.masterApp.noApp.body')}
          </Text>
        </Card>
      );
    }

    switch (application.status) {
      case 'DRAFT':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Draft" variant="neutral" testID="badge-app-draft" />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('masterLifecycle.masterApp.version', { version: application.version })}</Text>
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.draft.title')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              {t('masterLifecycle.masterApp.draft.body')}
            </Text>
          </Card>
        );

      case 'SUBMITTED':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.warning }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Awaiting Review" label={t('status.awaitingReview')} variant="warning" testID="badge-app-submitted" />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {t('masterLifecycle.masterApp.submitted.on', { date: application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : '' })}
              </Text>
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.submitted.title')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              {t('masterLifecycle.masterApp.submitted.body')}
            </Text>
          </Card>
        );

      case 'NEEDS_INFORMATION':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.amber }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Information Required" label={t('masterLifecycle.masterApp.needsInfo.badge')} variant="warning" testID="badge-app-needs-info" />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('status.actionRequired')}</Text>
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.needsInfo.title')}
            </Text>
            <View style={[styles.noteBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                {t('masterLifecycle.masterApp.needsInfo.adminNote')}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                {application.requested_information || application.review_notes || t('masterLifecycle.masterApp.needsInfo.defaultNote')}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.needsInfo.hint')}
            </Text>
          </Card>
        );

      case 'APPROVED':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.success }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Verified Master" label={t('masterLifecycle.masterApp.approved.badge')} variant="success" testID="badge-app-approved" />
              <CheckCircle size={iconSize.md} color={BrandColors.success} />
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.approved.title')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              {t('masterLifecycle.masterApp.approved.body', { organization: application.organization_name || t('masterLifecycle.masterApp.approved.defaultOrg') })}
            </Text>
            <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 8, fontWeight: '600' }]}>
              {t('masterLifecycle.masterApp.approved.nextStep')}
            </Text>
          </Card>
        );

      case 'REJECTED':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.danger }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Rejected" variant="danger" testID="badge-app-rejected" />
              <XCircle size={iconSize.md} color={BrandColors.danger} />
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.rejected.title')}
            </Text>
            <View style={[styles.noteBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                {t('masterLifecycle.masterApp.rejected.reasonHeading')}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                {application.rejection_reason || application.review_notes || t('masterLifecycle.masterApp.rejected.defaultReason')}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.rejected.body')}
            </Text>
          </Card>
        );

      case 'WITHDRAWN':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Withdrawn" variant="neutral" testID="badge-app-withdrawn" />
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              {t('masterLifecycle.masterApp.withdrawn.title')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              {t('masterLifecycle.masterApp.withdrawn.body')}
            </Text>
          </Card>
        );
    }
  };


  const isEditable = !application || application.status === 'DRAFT' || application.status === 'NEEDS_INFORMATION';

  return (
    <ScreenContainer scrollable testID="master-app-status-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHeader
          title={t('masterLifecycle.masterApp.title')}
          subtitle={t('masterLifecycle.masterApp.accountSubtitle', { name: user.fullName, email: user.email })}
          rightAction={headerRight}
        />

        {error ? (
          <View style={{ marginBottom: spacing.md }}>
            <ErrorState message={error} onRetry={fetchApplicationData} />
          </View>
        ) : null}

        {renderStatusBanner()}
        {application ? (
          <PendingNextStep kind="MASTER_APPLICATION" status={application.status} testID={`pending-next-step-${application.id}`} />
        ) : null}

        {application?.status === 'SUBMITTED' ? (
          <Card variant="standard" style={{ marginTop: spacing.md, borderColor: colors.border }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              {t('masterLifecycle.masterApp.submittedDetails')}
            </Text>
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('masterLifecycle.masterApp.qualificationsHeading')}</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                {application.qualifications || t('masterLifecycle.common.notAvailable')}
              </Text>
            </View>
            {application.experience_summary ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('masterLifecycle.masterApp.experienceHeading')}</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                  {application.experience_summary}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} testID="btn-withdraw-app">
              <Text style={[typography.caption, { color: BrandColors.danger, textAlign: 'center', fontWeight: '600' }]}>
                {t('masterLifecycle.masterApp.withdrawLink')}
              </Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {isEditable ? (
          <Card variant="standard" style={{ marginTop: spacing.md, borderColor: colors.border }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              {application?.status === 'NEEDS_INFORMATION' ? t('masterLifecycle.masterApp.updateResubmit') : t('masterLifecycle.masterApp.applicationDetails')}
            </Text>

            {/* Select Persatuan */}
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
              {t('masterLifecycle.masterApp.targetPersatuan')}
            </Text>
            {organizations.length > 0 ? (
              <View style={styles.orgList}>
                {organizations.map((org) => {
                  const isSelected = selectedOrgId === org.id;
                  return (
                    <TouchableOpacity
                      key={org.id}
                      style={[
                        styles.orgOption,
                        {
                          backgroundColor: isSelected ? colors.surfaceHighlight : colors.surface,
                          borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedOrgId(org.id)}
                      testID={`org-opt-${org.id}`}
                    >
                      <Building size={iconSize.sm} color={isSelected ? colors.buttonPrimaryBg : colors.textSecondary} />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: isSelected ? '700' : '400' }]}>
                          {org.name}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {t('masterLifecycle.masterApp.stateLabel', { state: org.state })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Input
                label={t('masterLifecycle.masterApp.orgIdLabel')}
                value={selectedOrgId}
                onChangeText={setSelectedOrgId}
                placeholder={t('masterLifecycle.masterApp.orgIdPlaceholder')}
                testID="input-org-id"
              />
            )}

            <Input
              label={t('masterLifecycle.masterApp.qualificationsLabel')}
              value={qualifications}
              onChangeText={setQualifications}
              placeholder={t('masterLifecycle.masterApp.qualificationsPlaceholder')}
              testID="input-qualifications"
            />

            <Input
              label={t('masterLifecycle.masterApp.experienceLabel')}
              value={experienceSummary}
              onChangeText={setExperienceSummary}
              placeholder={t('masterLifecycle.masterApp.experiencePlaceholder')}
              multiline
              numberOfLines={3}
              testID="input-experience"
            />

            <Input
              label={t('masterLifecycle.masterApp.verificationLabel')}
              value={verificationDetails}
              onChangeText={setVerificationDetails}
              placeholder={t('masterLifecycle.masterApp.verificationPlaceholder')}
              testID="input-verification"
            />

            <Input
              label={t('masterLifecycle.masterApp.documentsLabel')}
              value={documentsUrl}
              onChangeText={setDocumentsUrl}
              placeholder={t('masterLifecycle.masterApp.documentsPlaceholder')}
              testID="input-documents-url"
            />

            <View style={styles.actionRow}>
              {application?.status === 'DRAFT' || !application ? (
                <Button
                  label={submitting ? t('masterLifecycle.masterApp.saving') : t('masterLifecycle.common.saveDraft')}
                  variant="outline"
                  onPress={handleSaveDraft}
                  disabled={submitting}
                  style={{ flex: 1, marginRight: spacing.sm }}
                  testID="btn-save-draft"
                />
              ) : null}

              <Button
                label={submitting ? t('masterLifecycle.masterApp.submitting') : application?.status === 'NEEDS_INFORMATION' ? t('masterLifecycle.masterApp.resubmit') : t('masterLifecycle.masterApp.submitForReview')}
                variant="primary"
                onPress={handleSubmitApplication}
                disabled={submitting}
                rightIcon={<Send size={iconSize.sm} color={colors.surface} />}
                style={{ flex: 1 }}
                testID="btn-submit-application"
              />
            </View>

            {application?.status === 'SUBMITTED' || application?.status === 'NEEDS_INFORMATION' ? (
              <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} testID="btn-withdraw-app">
                <Text style={[typography.caption, { color: BrandColors.danger, textAlign: 'center' }]}>
                  {t('masterLifecycle.masterApp.withdrawLink')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Card>

        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  statusCard: {
    padding: 16,
    borderWidth: 1.5,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteBox: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  orgList: {
    marginBottom: 12,
  },
  orgOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  withdrawBtn: {
    marginTop: 16,
    padding: 8,
  },
});
