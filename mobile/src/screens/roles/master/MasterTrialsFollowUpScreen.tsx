import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import {
  Users,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { trialsService, FollowUpItem, TrialBooking } from '../../../services/trialsService';
import { useI18n } from '../../../i18n';

export interface MasterTrialsFollowUpScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

type ScreenTab = 'FOLLOW_UPS' | 'TRIALS';

const FOLLOW_UP_OUTCOMES = [
  { key: 'CONTACTED_PHONE', labelKey: 'masterHandover.tf.outcome.CONTACTED_PHONE' },
  { key: 'CONTACTED_MESSAGE', labelKey: 'masterHandover.tf.outcome.CONTACTED_MESSAGE' },
  { key: 'RESOLVED_RETURNING', labelKey: 'masterHandover.tf.outcome.RESOLVED_RETURNING' },
  { key: 'DISMISSED_NOT_INTERESTED', labelKey: 'masterHandover.tf.outcome.DISMISSED_NOT_INTERESTED' },
  { key: 'DROPPED_OUT', labelKey: 'masterHandover.tf.outcome.DROPPED_OUT' },
];

export const MasterTrialsFollowUpScreen: React.FC<MasterTrialsFollowUpScreenProps> = ({
  user,
  isOffline,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ScreenTab>('FOLLOW_UPS');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const assignedClasses = user.assignedClassIds || [];
  const [selectedClassId, setSelectedClassId] = useState<string>(assignedClasses[0] || '');

  // Follow-up Queue State
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  // Follow-up Action Modal
  const [actionModalVisible, setActionModalVisible] = useState<boolean>(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpItem | null>(null);
  const [actionOutcome, setActionOutcome] = useState<string>('CONTACTED_PHONE');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Trials State
  const [trials, setTrials] = useState<TrialBooking[]>([]);
  const [convertingTrial, setConvertingTrial] = useState<TrialBooking | null>(null);
  const [convertBeltRank, setConvertBeltRank] = useState<string>('White Belt');
  const [submittingConvert, setSubmittingConvert] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!selectedClassId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [fupList, trlList] = await Promise.all([
        trialsService.getClassFollowUps(selectedClassId),
        trialsService.getClassTrials(selectedClassId),
      ]);
      setFollowUps(fupList);
      setTrials(trlList);
    } catch (err: any) {
      setError(err?.message || t('masterHandover.tf.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, t]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await Promise.resolve();
      if (isMounted) {
        await loadData();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleEvaluateRules = async () => {
    if (!selectedClassId) return;
    setEvaluating(true);
    try {
      await trialsService.evaluateFollowUpRules(selectedClassId);
      await loadData();
      Alert.alert(t('masterHandover.tf.scanCompleteTitle'), t('masterHandover.tf.scanCompleteMessage'));
    } catch (err: any) {
      Alert.alert(t('masterHandover.tf.evaluationFailedTitle'), err?.message || t('masterHandover.tf.evaluationFailed'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleOpenActionModal = (item: FollowUpItem) => {
    setSelectedFollowUp(item);
    setActionOutcome('CONTACTED_PHONE');
    setActionNotes('');
    setActionModalVisible(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedFollowUp) return;
    setSubmittingAction(true);
    try {
      await trialsService.recordFollowUpAction(selectedFollowUp.id, actionOutcome, actionNotes);
      setActionModalVisible(false);
      setSelectedFollowUp(null);
      await loadData();
      Alert.alert(t('masterHandover.tf.actionRecordedTitle'), t('masterHandover.tf.actionRecordedMessage'));
    } catch (err: any) {
      Alert.alert(t('masterHandover.tf.actionFailedTitle'), err?.message || t('masterHandover.tf.actionFailed'));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConvertTrial = async () => {
    if (!convertingTrial) return;
    setSubmittingConvert(true);
    try {
      const result = await trialsService.convertTrial(convertingTrial.id, convertBeltRank);
      setConvertingTrial(null);
      await loadData();
      Alert.alert(
        t('masterHandover.tf.trialConvertedTitle'),
        t('masterHandover.tf.trialConvertedMessage', { name: result.trial.candidate_name, id: result.student.id })
      );
    } catch (err: any) {
      Alert.alert(t('masterHandover.tf.conversionFailedTitle'), err?.message || t('masterHandover.tf.conversionFailed'));
    } finally {
      setSubmittingConvert(false);
    }
  };

  const handleMarkTrialAttendance = async (trialId: string, status: 'ATTENDED' | 'MISSED') => {
    try {
      await trialsService.markTrialAttendance(trialId, status);
      await loadData();
      Alert.alert(t('masterHandover.tf.updatedTitle'), t('masterHandover.tf.trialMarked', { status }));
    } catch (err: any) {
      Alert.alert(t('masterHandover.tf.updateFailedTitle'), err?.message || t('masterHandover.tf.updateFailed'));
    }
  };

  return (
    <ScreenContainer>
      <ScreenHeader
        title={t('masterHandover.tf.title')}
        subtitle={t('masterHandover.tf.subtitle')}
      />

      {/* Class Selector Bar */}
      {assignedClasses.length > 1 && (
        <View style={styles.classSelectorRow}>
          <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>{t('masterHandover.tf.classLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
            {assignedClasses.map((clsId) => (
              <TouchableOpacity
                key={clsId}
                style={[
                  styles.classChip,
                  selectedClassId === clsId && { backgroundColor: colors.buttonPrimaryBg },
                ]}
                onPress={() => setSelectedClassId(clsId)}
              >
                <Text
                  style={[
                    styles.classChipText,
                    selectedClassId === clsId ? { color: '#FFF' } : { color: colors.textSecondary },
                  ]}
                >
                  {t('masterHandover.tf.classChip', { code: clsId.slice(-4).toUpperCase() })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'FOLLOW_UPS' && [styles.activeTabButton, { borderColor: colors.buttonPrimaryBg }],
          ]}
          onPress={() => setActiveTab('FOLLOW_UPS')}
        >
          <AlertCircle size={18} color={activeTab === 'FOLLOW_UPS' ? colors.buttonPrimaryBg : colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'FOLLOW_UPS' ? colors.buttonPrimaryBg : colors.textSecondary },
            ]}
          >
            {t('masterHandover.tf.followUpTab', { count: followUps.length })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'TRIALS' && [styles.activeTabButton, { borderColor: colors.buttonPrimaryBg }],
          ]}
          onPress={() => setActiveTab('TRIALS')}
        >
          <Users size={18} color={activeTab === 'TRIALS' ? colors.buttonPrimaryBg : colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'TRIALS' ? colors.buttonPrimaryBg : colors.textSecondary },
            ]}
          >
            {t('masterHandover.tf.trialsTab', { count: trials.length })}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading && !refreshing ? (
          <LoadingState message={t('masterHandover.tf.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : activeTab === 'FOLLOW_UPS' ? (
          /* FOLLOW-UP RETENTION QUEUE TAB */
          <View style={styles.tabSection}>
            <View style={styles.actionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('masterHandover.tf.queueTitle')}</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {t('masterHandover.tf.queueSubtitle')}
                </Text>
              </View>
              <Button
                label={evaluating ? t('masterHandover.tf.scanning') : t('masterHandover.tf.scanRisks')}
                onPress={handleEvaluateRules}
                disabled={evaluating || isOffline}
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw size={14} color="#FFF" />}
              />
            </View>

            {/* Quick Metrics */}
            <View style={styles.statsRow}>
              <StatCard
                title={t('masterHandover.tf.pendingRisks')}
                value={followUps.length.toString()}
                subtitle={t('masterHandover.tf.needsContact')}
              />
              <StatCard
                title={t('masterHandover.tf.highSeverity')}
                value={followUps.filter((f) => f.severity === 'HIGH').length.toString()}
                subtitle={t('masterHandover.tf.consecutiveAbsences')}
              />
            </View>

            {followUps.length === 0 ? (
              <EmptyState
                title={t('masterHandover.tf.allClear')}
                description={t('masterHandover.tf.allClearDesc')}
                actionLabel={t('masterHandover.tf.scanRules')}
                onAction={handleEvaluateRules}
              />
            ) : (
              followUps.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.badgeWrapper}>
                      <StatusBadge
                        status={
                          item.severity === 'HIGH'
                            ? 'Error'
                            : item.severity === 'MEDIUM'
                            ? 'Warning'
                            : 'Info'
                        }
                      />
                      <Text style={[styles.itemTypeTag, { color: colors.textSecondary }]}>
                        {item.type.replace('_', ' ')}
                      </Text>
                    </View>
                    <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>

                  <Text style={[styles.candidateName, { color: colors.textPrimary }]}>
                    {item.student_name || item.candidate_name || t('masterHandover.common.studentCandidate')}
                  </Text>

                  {/* Prominent Human-Visible Reason Card (Acceptance Test: reason_visible) */}
                  <View style={[styles.reasonBox, { backgroundColor: '#0D2B47' }]}>
                    <AlertCircle size={16} color="#F2941C" style={styles.reasonIcon} />
                    <Text style={styles.reasonText}>{item.reason}</Text>
                  </View>

                  <View style={styles.contactRow}>
                    <PhoneCall size={14} color={colors.textSecondary} />
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                      {item.student_phone || item.guardian_phone || t('masterHandover.tf.noPhone')}
                    </Text>
                  </View>

                  <View style={styles.cardFooterRow}>
                    <Button
                      label={t('masterHandover.tf.recordAction')}
                      onPress={() => handleOpenActionModal(item)}
                      variant="primary"
                      size="sm"
                      leftIcon={<UserCheck size={14} color="#FFF" />}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : (
          /* TRIAL BOOKINGS & CONVERSION TAB */
          <View style={styles.tabSection}>
            <View style={styles.actionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('masterHandover.tf.trialSessions')}</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {t('masterHandover.tf.trialSessionsSubtitle')}
                </Text>
              </View>
            </View>

            {trials.length === 0 ? (
              <EmptyState
                title={t('masterHandover.tf.noTrials')}
                description={t('masterHandover.tf.noTrialsDesc')}
              />
            ) : (
              trials.map((trl) => (
                <Card key={trl.id} style={styles.itemCard}>
                  <View style={styles.cardHeaderRow}>
                    <StatusBadge
                      status={
                        trl.status === 'CONVERTED'
                          ? 'Active'
                          : trl.status === 'ATTENDED'
                          ? 'Success'
                          : trl.status === 'MISSED'
                          ? 'Error'
                          : 'Pending'
                      }
                    />
                    <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                      {t('masterHandover.tf.trialDate', { date: trl.scheduled_date })}
                    </Text>
                  </View>

                  <Text style={[styles.candidateName, { color: colors.textPrimary }]}>
                    {trl.candidate_name} {trl.candidate_age ? t('masterHandover.tf.age', { age: trl.candidate_age }) : ''}
                  </Text>

                  <Text style={[styles.guardianInfo, { color: colors.textSecondary }]}>
                    {t('masterHandover.tf.guardian', {
                      name: trl.guardian_name || t('masterHandover.common.notApplicable'),
                      phone: trl.guardian_phone,
                    })}
                  </Text>

                  {trl.medical_notes && (
                    <Text style={[styles.medicalText, { color: BrandColors.warning }]}>
                      {t('masterHandover.tf.medical', { notes: trl.medical_notes })}
                    </Text>
                  )}

                  {trl.status === 'BOOKED' && (
                    <View style={styles.trialActionsRow}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => handleMarkTrialAttendance(trl.id, 'ATTENDED')}
                      >
                        <Text style={styles.smallBtnText}>{t('masterHandover.tf.attended')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => handleMarkTrialAttendance(trl.id, 'MISSED')}
                      >
                        <Text style={styles.smallBtnText}>{t('masterHandover.tf.missed')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: colors.buttonPrimaryBg }]}
                        onPress={() => setConvertingTrial(trl)}
                      >
                        <Text style={styles.smallBtnText}>{t('masterHandover.tf.convertToStudent')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {trl.status === 'ATTENDED' && (
                    <View style={styles.trialActionsRow}>
                      <Button
                        label={t('masterHandover.tf.enrollCanonical')}
                        onPress={() => setConvertingTrial(trl)}
                        variant="primary"
                        size="sm"
                        leftIcon={<UserCheck size={14} color="#FFF" />}
                      />
                    </View>
                  )}

                  {trl.status === 'CONVERTED' && (
                    <View style={styles.convertedInfoBox}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <Text style={styles.convertedInfoText}>
                        {t('masterHandover.tf.enrolledId', { id: trl.converted_student_id ?? '' })}
                      </Text>
                    </View>
                  )}
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Recording Modal */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('masterHandover.tf.recordOutcomeTitle')}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {selectedFollowUp?.student_name || selectedFollowUp?.candidate_name}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>{t('masterHandover.tf.actionOutcome')}</Text>
            {FOLLOW_UP_OUTCOMES.map((oc) => (
              <TouchableOpacity
                key={oc.key}
                style={[
                  styles.outcomeOption,
                  actionOutcome === oc.key && { borderColor: colors.buttonPrimaryBg, backgroundColor: '#0D2B47' },
                ]}
                onPress={() => setActionOutcome(oc.key)}
              >
                <Text
                  style={[
                    styles.outcomeText,
                    actionOutcome === oc.key ? { color: '#FFF' } : { color: colors.textSecondary },
                  ]}
                >
                  {t(oc.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>{t('masterHandover.tf.notesLabel')}</Text>
            <TextInput
              style={[styles.notesInput, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('masterHandover.tf.notesPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={actionNotes}
              onChangeText={setActionNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                label={t('masterHandover.common.cancel')}
                onPress={() => setActionModalVisible(false)}
                variant="outline"
                size="sm"
              />
              <Button
                label={submittingAction ? t('masterHandover.common.saving') : t('masterHandover.tf.saveOutcome')}
                onPress={handleSubmitAction}
                variant="primary"
                size="sm"
                disabled={submittingAction}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Convert Trial Modal */}
      <Modal visible={!!convertingTrial} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('masterHandover.tf.convertTitle')}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {t('masterHandover.tf.candidate', { name: convertingTrial?.candidate_name ?? '' })}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>{t('masterHandover.tf.initialBelt')}</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
              value={convertBeltRank}
              onChangeText={setConvertBeltRank}
              placeholder={t('masterHandover.common.whiteBelt')}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                label={t('masterHandover.common.cancel')}
                onPress={() => setConvertingTrial(null)}
                variant="outline"
                size="sm"
              />
              <Button
                label={submittingConvert ? t('masterHandover.tf.converting') : t('masterHandover.tf.confirmEnrollment')}
                onPress={handleConvertTrial}
                variant="primary"
                size="sm"
                disabled={submittingConvert}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  classSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  classChips: {
    gap: 8,
  },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#061828',
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#153C61',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabSection: {
    gap: 12,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  itemCard: {
    marginBottom: 12,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTypeTag: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F2941C',
  },
  reasonIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  reasonText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  contactText: {
    fontSize: 12,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#153C61',
    paddingTop: 10,
  },
  guardianInfo: {
    fontSize: 12,
    marginBottom: 4,
  },
  medicalText: {
    fontSize: 12,
    marginBottom: 8,
  },
  trialActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  convertedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#061828',
    borderRadius: 6,
  },
  convertedInfoText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
  },
  outcomeOption: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#153C61',
    marginBottom: 6,
  },
  outcomeText: {
    fontSize: 13,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
