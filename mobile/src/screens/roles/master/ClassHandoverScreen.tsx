import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {
  Shield,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';

export interface ClassHandoverScreenProps {
  user: AuthUser;
  navigation?: any;
  route?: {
    params?: {
      classId: string;
      className?: string;
    };
  };
}

function isLeadershipExpired(effectiveTo?: string | null): boolean {
  if (!effectiveTo) return false;
  return new Date(effectiveTo).getTime() < Date.now();
}

export const ClassHandoverScreen: React.FC<ClassHandoverScreenProps> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  const classId = route?.params?.classId || '';
  const className = route?.params?.className || t('masterHandover.ch.defaultClassName');

  const [activeTab, setActiveTab] = useState<'HANDOVER' | 'SUBSTITUTE'>('HANDOVER');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [leaderships, setLeaderships] = useState<any[]>([]);
  const [handoverHistory, setHandoverHistory] = useState<any[]>([]);
  const [activeHandover, setActiveHandover] = useState<any | null>(null);

  // Handover form state
  const [incomingMasterId, setIncomingMasterId] = useState('');
  const [handoverReason, setHandoverReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [handoverFeedback, setHandoverFeedback] = useState<string | null>(null);
  const [handoverFeedbackOk, setHandoverFeedbackOk] = useState(false);

  // Substitute form state
  const [substituteMasterId, setSubstituteMasterId] = useState('');
  const [substituteHours, setSubstituteHours] = useState('24');
  const [substituteNotes, setSubstituteNotes] = useState('');
  const [assigningSubstitute, setAssigningSubstitute] = useState(false);
  const [substituteFeedback, setSubstituteFeedback] = useState<string | null>(null);
  const [substituteFeedbackOk, setSubstituteFeedbackOk] = useState(false);

  const loadData = async () => {
    if (!classId) return;
    try {
      const [leadsRes, handoversRes]: [any, any] = await Promise.all([
        apiClient.get(`/classes/${classId}/leaderships`),
        apiClient.get(`/classes/${classId}/handover`),
      ]);

      const mappedLeads = (leadsRes?.leaderships || []).map((lead: any) => ({
        ...lead,
        isExpired: isLeadershipExpired(lead.effective_to),
      }));

      setLeaderships(mappedLeads);
      setHandoverHistory(handoversRes?.history || []);
      setActiveHandover(handoversRes?.activeHandover || null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('masterHandover.ch.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!classId) return;
    let isMounted = true;
    Promise.all([
      apiClient.get(`/classes/${classId}/leaderships`),
      apiClient.get(`/classes/${classId}/handover`),
    ])
      .then(([leadsRes, handoversRes]: [any, any]) => {
        if (isMounted) {
          const mappedLeads = (leadsRes?.leaderships || []).map((lead: any) => ({
            ...lead,
            isExpired: isLeadershipExpired(lead.effective_to),
          }));

          setLeaderships(mappedLeads);
          setHandoverHistory(handoversRes?.history || []);
          setActiveHandover(handoversRes?.activeHandover || null);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || t('masterHandover.ch.loadError'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [classId, t]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleInitiateHandover = async () => {
    if (!incomingMasterId.trim()) {
      Alert.alert(t('masterHandover.common.requiredField'), t('masterHandover.ch.enterIncomingId'));
      return;
    }
    if (!handoverReason.trim()) {
      Alert.alert(t('masterHandover.common.requiredField'), t('masterHandover.ch.enterReason'));
      return;
    }

    setSubmittingHandover(true);
    setHandoverFeedback(null);
    try {
      await apiClient.post(`/classes/${classId}/handover`, {
        incomingMasterId: incomingMasterId.trim(),
        reason: handoverReason.trim(),
        effectiveDate: effectiveDate.trim() || undefined,
      });

      setIncomingMasterId('');
      setHandoverReason('');
      setEffectiveDate('');
      setHandoverFeedbackOk(true);
      setHandoverFeedback(t('masterHandover.ch.handoverSubmitted'));
      await loadData();
    } catch (err: any) {
      setHandoverFeedbackOk(false);
      setHandoverFeedback(err?.message || t('masterHandover.ch.handoverFailed'));
    } finally {
      setSubmittingHandover(false);
    }
  };

  const handleAssignSubstitute = async () => {
    if (!substituteMasterId.trim()) {
      Alert.alert(t('masterHandover.common.requiredField'), t('masterHandover.ch.enterSubstituteId'));
      return;
    }

    const hours = parseInt(substituteHours, 10) || 24;
    const now = new Date();
    const validUntil = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    setAssigningSubstitute(true);
    setSubstituteFeedback(null);
    try {
      await apiClient.post(`/classes/${classId}/delegation`, {
        substituteMasterId: substituteMasterId.trim(),
        validFrom: now.toISOString(),
        validUntil,
        capabilities: 'ATTENDANCE_ONLY',
        notes: substituteNotes.trim() || undefined,
      });

      setSubstituteMasterId('');
      setSubstituteNotes('');
      setSubstituteFeedbackOk(true);
      setSubstituteFeedback(t('masterHandover.ch.substituteAssigned'));
      await loadData();
    } catch (err: any) {
      setSubstituteFeedbackOk(false);
      setSubstituteFeedback(err?.message || t('masterHandover.ch.substituteFailed'));
    } finally {
      setAssigningSubstitute(false);
    }
  };

  const handleRevokeSubstitute = async (leadershipId: string) => {
    Alert.alert(
      t('masterHandover.ch.revokeTitle'),
      t('masterHandover.ch.revokeConfirm'),
      [
        { text: t('masterHandover.common.cancel'), style: 'cancel' },
        {
          text: t('masterHandover.ch.revoke'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/classes/${classId}/delegation/${leadershipId}`);
              await loadData();
            } catch (err: any) {
              Alert.alert(t('masterHandover.ch.revokeErrorTitle'), err?.message || t('masterHandover.ch.revokeFailed'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('masterHandover.ch.title')} onBack={() => navigation?.goBack?.()} />
        <LoadingState message={t('masterHandover.ch.loading')} />
      </ScreenContainer>
    );
  }

  if (error && !refreshing) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('masterHandover.ch.title')} onBack={() => navigation?.goBack?.()} />
        <ErrorState message={error} onRetry={loadData} />
      </ScreenContainer>
    );
  }

  const primaryLeader = leaderships.find((l) => l.leadership_type === 'PRIMARY' && l.is_active);
  const activeSubstitutes = leaderships.filter((l) => l.leadership_type === 'SUBSTITUTE' && l.is_active);

  return (
    <ScreenContainer>
      <ScreenHeader
        title={t('masterHandover.ch.title')}
        subtitle={className}
        onBack={() => navigation?.goBack?.()}
      />

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          testID="tab-handover"
          style={[styles.tabButton, activeTab === 'HANDOVER' && { borderBottomColor: colors.buttonSecondaryBg }]}
          onPress={() => setActiveTab('HANDOVER')}
        >
          <ArrowRightLeft size={iconSize.sm} color={activeTab === 'HANDOVER' ? colors.buttonSecondaryBg : colors.textMuted} />
          <Text
            style={[
              typography.caption,
              styles.tabText,
              { color: activeTab === 'HANDOVER' ? colors.buttonSecondaryBg : colors.textMuted },
            ]}
          >
            {t('masterHandover.ch.tabHandover')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="tab-substitute"
          style={[styles.tabButton, activeTab === 'SUBSTITUTE' && { borderBottomColor: colors.buttonSecondaryBg }]}
          onPress={() => setActiveTab('SUBSTITUTE')}
        >
          <Clock size={iconSize.sm} color={activeTab === 'SUBSTITUTE' ? colors.buttonSecondaryBg : colors.textMuted} />
          <Text
            style={[
              typography.caption,
              styles.tabText,
              { color: activeTab === 'SUBSTITUTE' ? colors.buttonSecondaryBg : colors.textMuted },
            ]}
          >
            {t('masterHandover.ch.tabSubstitute')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.buttonSecondaryBg} />}
      >
        {/* CURRENT LEADERSHIP STATUS */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Shield size={iconSize.md} color={colors.buttonSecondaryBg} />
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
              {t('masterHandover.ch.currentLeadership')}
            </Text>
          </View>

          <View style={styles.leaderInfoRow}>
            <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>{t('masterHandover.ch.primaryLeader')}</Text>
            <View style={styles.leaderValue}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                {primaryLeader?.master_name || primaryLeader?.master_id || t('masterHandover.ch.noneAssigned')}
              </Text>
              <StatusBadge status="ACTIVE" label={t('masterHandover.ch.primaryBadge')} />
            </View>
          </View>

          {activeSubstitutes.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                {t('masterHandover.ch.activeSubstitutes', { count: activeSubstitutes.length })}
              </Text>
              {activeSubstitutes.map((sub) => {
                const isExpired = Boolean(sub.isExpired);
                return (
                  <View key={sub.id} style={[styles.substituteRow, { backgroundColor: colors.backgroundSecondary }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                        {sub.master_name || sub.master_id}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {t('masterHandover.ch.capabilities', { value: sub.capabilities || 'ATTENDANCE_ONLY' })}
                      </Text>
                      <Text style={[typography.caption, { color: isExpired ? colors.badgeDangerText : colors.badgeWarningText }]}>
                        {isExpired ? t('masterHandover.ch.expired') : t('masterHandover.ch.validUntil', { date: new Date(sub.effective_to).toLocaleString() })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      testID={`revoke-substitute-${sub.id}`}
                      style={styles.revokeButton}
                      onPress={() => handleRevokeSubstitute(sub.id)}
                    >
                      <Trash2 size={iconSize.sm} color={colors.badgeDangerText} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* TAB 1: PERMANENT HANDOVER */}
        {activeTab === 'HANDOVER' && (
          <>
            {/* Active Handover Banner */}
            {activeHandover && (
              <Card style={[styles.sectionCard, { borderColor: colors.buttonSecondaryBg, borderWidth: 1 }]}>
                <View style={styles.cardHeaderRow}>
                  <AlertTriangle size={iconSize.md} color={colors.buttonSecondaryBg} />
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                    {t('masterHandover.ch.activeHandover')}
                  </Text>
                </View>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  {t('masterHandover.ch.statusLabel')} <Text style={{ fontWeight: '700', color: colors.buttonSecondaryBg }}>{activeHandover.status}</Text>
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  {t('masterHandover.ch.incomingMaster', { name: activeHandover.incoming_master_name || activeHandover.incoming_master_id })}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('masterHandover.common.reasonValue', { reason: activeHandover.reason || t('masterHandover.ch.noneSpecified') })}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('masterHandover.ch.initiated', { date: new Date(activeHandover.created_at).toLocaleDateString() })}
                </Text>
              </Card>
            )}

            {/* Initiate Form */}
            {!activeHandover && (
              <Card style={styles.sectionCard}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                  {t('masterHandover.ch.initiateTitle')}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                  {t('masterHandover.ch.initiateDesc')}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                    {t('masterHandover.ch.incomingIdLabel')}
                  </Text>
                  <TextInput
                    testID="input-incoming-master"
                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder={t('masterHandover.ch.incomingIdPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={incomingMasterId}
                    onChangeText={setIncomingMasterId}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                    {t('masterHandover.ch.reasonLabel')}
                  </Text>
                  <TextInput
                    testID="input-handover-reason"
                    style={[styles.input, styles.multilineInput, { borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder={t('masterHandover.ch.reasonPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={handoverReason}
                    onChangeText={setHandoverReason}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {handoverFeedback && (
                  <Text
                    testID="handover-feedback"
                    style={[
                      typography.caption,
                      {
                        color: handoverFeedbackOk ? colors.badgeSuccessText : colors.badgeDangerText,
                        marginBottom: spacing.md,
                      },
                    ]}
                  >
                    {handoverFeedback}
                  </Text>
                )}

                <Button
                  testID="btn-submit-handover"
                  label={t('masterHandover.ch.submitHandover')}
                  onPress={handleInitiateHandover}
                  loading={submittingHandover}
                />
              </Card>
            )}

            {/* Handover History */}
            {handoverHistory.length > 0 && (
              <Card style={styles.sectionCard}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                  {t('masterHandover.ch.history')}
                </Text>
                {handoverHistory.map((h) => (
                  <View key={h.id} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.historyRow}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                        {h.incoming_master_name || h.incoming_master_id}
                      </Text>
                      <StatusBadge status={h.status} label={h.status} />
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {t('masterHandover.common.reasonValue', { reason: h.reason || t('masterHandover.common.notApplicable') })}
                    </Text>
                    {h.rejection_reason && (
                      <Text style={[typography.caption, { color: colors.badgeDangerText, marginTop: 2 }]}>
                        {t('masterHandover.ch.rejected', { reason: h.rejection_reason })}
                      </Text>
                    )}
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {t('masterHandover.ch.date', { date: new Date(h.created_at).toLocaleDateString() })}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* TAB 2: TEMPORARY SUBSTITUTE */}
        {activeTab === 'SUBSTITUTE' && (
          <Card style={styles.sectionCard}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              {t('masterHandover.ch.assignTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
              {t('masterHandover.ch.assignDesc')}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                {t('masterHandover.ch.substituteIdLabel')}
              </Text>
              <TextInput
                testID="input-substitute-master"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder={t('masterHandover.ch.substituteIdPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={substituteMasterId}
                onChangeText={setSubstituteMasterId}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                {t('masterHandover.ch.durationLabel')}
              </Text>
              <TextInput
                testID="input-substitute-hours"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="24"
                placeholderTextColor={colors.textMuted}
                value={substituteHours}
                onChangeText={setSubstituteHours}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                {t('masterHandover.ch.notesLabel')}
              </Text>
              <TextInput
                testID="input-substitute-notes"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder={t('masterHandover.ch.notesPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={substituteNotes}
                onChangeText={setSubstituteNotes}
              />
            </View>

            {substituteFeedback && (
              <Text
                testID="substitute-feedback"
                style={[
                  typography.caption,
                  {
                    color: substituteFeedbackOk ? colors.badgeSuccessText : colors.badgeDangerText,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                {substituteFeedback}
              </Text>
            )}

            <Button
              testID="btn-assign-substitute"
              label={t('masterHandover.ch.assignTitle')}
              onPress={handleAssignSubstitute}
              loading={assigningSubstitute}
            />
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabText: {
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  sectionCard: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  leaderValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  substituteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  revokeButton: {
    padding: 8,
  },
  inputGroup: {
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
