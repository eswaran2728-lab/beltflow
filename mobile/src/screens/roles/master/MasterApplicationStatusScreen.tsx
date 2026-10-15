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
import { BrandColors } from '../../../theme/colors';

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
      setError(err?.message || 'Failed to load application status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onVerified]);

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
          setError(err?.message || 'Failed to load application status.');
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
  }, [onVerified]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplicationData();
  };


  const handleSaveDraft = async () => {
    if (!selectedOrgId) {
      Alert.alert('Required', 'Please select a Persatuan before saving.');
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
      Alert.alert('Saved', 'Application draft saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedOrgId) {
      Alert.alert('Required', 'Please select a Persatuan.');
      return;
    }
    if (!qualifications.trim() || !experienceSummary.trim()) {
      Alert.alert('Incomplete Application', 'Please provide both qualifications and experience summary.');
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
      Alert.alert('Submitted', 'Your verification application has been submitted to the Persatuan for review.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!application) return;
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw your application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await apiClient.post(`/master-applications/${application.id}/withdraw`, {});
              setApplication(res.application);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to withdraw application.');
            }
          },
        },
      ]
    );
  };

  const headerRight = onLogout ? (
    <Button
      label="Sign Out"
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
        <ScreenHeader title="Master Verification" subtitle="BeltFlow Instructor Registration" rightAction={headerRight} />
        <LoadingState message="Checking verification status..." />
      </ScreenContainer>
    );
  }

  const renderStatusBanner = () => {
    if (!application) {
      return (
        <Card variant="standard" style={[styles.statusCard, { borderColor: colors.border }]}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 4 }]}>
            Step 1: Choose Your Persatuan & Apply
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            To operate classes and record attendance, your Master credentials must be verified and approved by an authorized Persatuan.
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
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Version {application.version}</Text>
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              Application in Progress
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              Please complete your instructor qualifications and submit your application for Persatuan verification.
            </Text>
          </Card>
        );

      case 'SUBMITTED':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.warning }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Awaiting Review" variant="warning" testID="badge-app-submitted" />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Submitted {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : ''}
              </Text>
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              Under Persatuan Review
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              Your application has been received by the Persatuan Admin. Class proposal and roster management tools will become active once your credentials are formally approved.
            </Text>
          </Card>
        );

      case 'NEEDS_INFORMATION':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.amber }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Information Required" variant="warning" testID="badge-app-needs-info" />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Action Required</Text>
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              Corrections or Additional Details Requested
            </Text>
            <View style={[styles.noteBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                PERSATUAN ADMIN NOTE:
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                {application.requested_information || application.review_notes || 'Please provide additional instructor documents.'}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
              Please update the fields below and tap &quot;Resubmit Application&quot;.
            </Text>
          </Card>
        );

      case 'APPROVED':
        return (
          <Card variant="standard" style={[styles.statusCard, { borderColor: BrandColors.success }]}>
            <View style={styles.badgeRow}>
              <StatusBadge status="Verified Master" variant="success" testID="badge-app-approved" />
              <CheckCircle size={iconSize.md} color={BrandColors.success} />
            </View>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 8 }]}>
              Credentials Verified & Approved!
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              You hold an ACTIVE verified affiliation with {application.organization_name || 'your Persatuan'}.
            </Text>
            <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 8, fontWeight: '600' }]}>
              Next Step: Class proposal and mat operations will unlock in Task H04.
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
              Application Declined
            </Text>
            <View style={[styles.noteBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                REASON FOR DECISION:
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
                {application.rejection_reason || application.review_notes || 'Credentials do not meet criteria.'}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
              Your account remains intact. Please contact your Persatuan administration for further assistance.
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
              Application Withdrawn
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              This application has been cancelled. You may submit a new application below.
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
          title="Master Verification"
          subtitle={`Account: ${user.fullName} (${user.email})`}
          rightAction={headerRight}
        />

        {error ? (
          <View style={{ marginBottom: spacing.md }}>
            <ErrorState message={error} onRetry={fetchApplicationData} />
          </View>
        ) : null}

        {renderStatusBanner()}

        {application?.status === 'SUBMITTED' ? (
          <Card variant="standard" style={{ marginTop: spacing.md, borderColor: colors.border }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Submitted Details
            </Text>
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Qualifications / Dan Level:</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                {application.qualifications || 'N/A'}
              </Text>
            </View>
            {application.experience_summary ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Experience Summary:</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                  {application.experience_summary}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} testID="btn-withdraw-app">
              <Text style={[typography.caption, { color: BrandColors.danger, textAlign: 'center', fontWeight: '600' }]}>
                Withdraw this application
              </Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {isEditable ? (
          <Card variant="standard" style={{ marginTop: spacing.md, borderColor: colors.border }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              {application?.status === 'NEEDS_INFORMATION' ? 'Update & Resubmit' : 'Application Details'}
            </Text>

            {/* Select Persatuan */}
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
              Target Persatuan / Academy *
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
                          State: {org.state}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Input
                label="Organization ID"
                value={selectedOrgId}
                onChangeText={setSelectedOrgId}
                placeholder="org_..."
                testID="input-org-id"
              />
            )}

            <Input
              label="Instructor Qualifications / Dan Level *"
              value={qualifications}
              onChangeText={setQualifications}
              placeholder="e.g. 4th Dan Black Belt, Registered Master Instructor"
              testID="input-qualifications"
            />

            <Input
              label="Teaching Experience Summary *"
              value={experienceSummary}
              onChangeText={setExperienceSummary}
              placeholder="e.g. 10 years head instructor, national tournament coach"
              multiline
              numberOfLines={3}
              testID="input-experience"
            />

            <Input
              label="Verification License / Certificate Number"
              value={verificationDetails}
              onChangeText={setVerificationDetails}
              placeholder="e.g. National Certification ID or Registry No."
              testID="input-verification"
            />

            <Input
              label="Document Vault URL (Optional)"
              value={documentsUrl}
              onChangeText={setDocumentsUrl}
              placeholder="https://..."
              testID="input-documents-url"
            />

            <View style={styles.actionRow}>
              {application?.status === 'DRAFT' || !application ? (
                <Button
                  label={submitting ? 'Saving...' : 'Save Draft'}
                  variant="outline"
                  onPress={handleSaveDraft}
                  disabled={submitting}
                  style={{ flex: 1, marginRight: spacing.sm }}
                  testID="btn-save-draft"
                />
              ) : null}

              <Button
                label={submitting ? 'Submitting...' : application?.status === 'NEEDS_INFORMATION' ? 'Resubmit Application' : 'Submit for Review'}
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
                  Withdraw this application
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
