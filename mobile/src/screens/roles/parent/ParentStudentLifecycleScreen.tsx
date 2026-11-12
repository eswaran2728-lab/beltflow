import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  Switch,
} from 'react-native';
import {
  Users,
  Clock,
  ArrowRightLeft,
  PauseCircle,
  ShieldCheck,
  Award,
  DollarSign,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import {
  membershipService,
  MembershipPause,
  StudentHistoryRecord,
} from '../../../services/membershipService';
import { useI18n } from '../../../i18n';

export interface ParentStudentLifecycleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
  route?: {
    params?: {
      studentId?: string;
      studentName?: string;
      targetClassId?: string;
    };
  };
}

type ScreenView = 'OVERVIEW' | 'REQUEST_PAUSE' | 'REQUEST_TRANSFER' | 'HISTORY';

export const ParentStudentLifecycleScreen: React.FC<ParentStudentLifecycleScreenProps> = ({
  user,
  isOffline,
  route,
}) => {
  useTheme();
  const { t } = useI18n();
  const initialStudentId = route?.params?.studentId || '';
  const initialTargetClassId = route?.params?.targetClassId || '';
  const [studentId, setStudentId] = useState<string>(initialStudentId);
  const [currentView, setCurrentView] = useState<ScreenView>('OVERVIEW');

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Lifecycle History Data
  const [historyData, setHistoryData] = useState<StudentHistoryRecord | null>(null);

  // Form states - Pause
  const [pauseStartDate, setPauseStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pauseEndDate, setPauseEndDate] = useState<string>('');
  const [pauseReason, setPauseReason] = useState<string>('School examination period');

  // Form states - Transfer
  const [targetClassId, setTargetClassId] = useState<string>(initialTargetClassId);
  const [transferEffectiveDate, setTransferEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transferReason, setTransferReason] = useState<string>('Family relocation / training schedule adjustment');
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadStudentHistory = useCallback(async () => {
    if (!studentId.trim()) return;
    try {
      if (isMountedRef.current) {
        setError(null);
        setLoading(true);
      }
      const data = await membershipService.getStudentHistory(studentId.trim());
      if (isMountedRef.current) {
        setHistoryData(data);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Failed to load student lifecycle history:', err);
        setError(err?.message || t('parentLifecycle.error.loadHistory'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [studentId, t]);

  useEffect(() => {
    let isMounted = true;
    if (studentId.trim()) {
      (async () => {
        await Promise.resolve();
        if (isMounted) {
          await loadStudentHistory();
        }
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [studentId, loadStudentHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentHistory();
  };

  const handlePauseSubmit = async () => {
    if (!studentId.trim()) {
      Alert.alert(t('parentLifecycle.alert.requiredTitle'), t('parentLifecycle.alert.requiredStudentId'));
      return;
    }
    if (!pauseStartDate.trim()) {
      Alert.alert(t('parentLifecycle.alert.requiredTitle'), t('parentLifecycle.alert.requiredStartDate'));
      return;
    }
    if (!pauseReason.trim()) {
      Alert.alert(t('parentLifecycle.alert.requiredTitle'), t('parentLifecycle.alert.requiredPauseReason'));
      return;
    }
    if (isOffline) {
      Alert.alert(t('parentLifecycle.alert.offlineTitle'), t('parentLifecycle.alert.offlinePause'));
      return;
    }

    try {
      setSubmitting(true);
      await membershipService.requestPause({
        studentId: studentId.trim(),
        startDate: pauseStartDate.trim(),
        expectedEndDate: pauseEndDate.trim() || undefined,
        reason: pauseReason.trim(),
      });
      await loadStudentHistory();
      setCurrentView('OVERVIEW');
      Alert.alert(t('parentLifecycle.alert.successTitle'), t('parentLifecycle.alert.pauseSuccess'));
    } catch (err: any) {
      Alert.alert(t('parentLifecycle.alert.requestFailedTitle'), err?.message || t('parentLifecycle.alert.pauseFailed'));
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleTransferSubmit = async () => {
    if (!studentId.trim()) {
      Alert.alert(t('parentLifecycle.alert.requiredTitle'), t('parentLifecycle.alert.requiredStudentId'));
      return;
    }
    if (!targetClassId.trim()) {
      Alert.alert(t('parentLifecycle.alert.requiredTitle'), t('parentLifecycle.alert.requiredTargetClass'));
      return;
    }
    if (isOffline) {
      Alert.alert(t('parentLifecycle.alert.offlineTitle'), t('parentLifecycle.alert.offlineTransfer'));
      return;
    }

    try {
      setSubmitting(true);
      await membershipService.requestTransfer({
        studentId: studentId.trim(),
        targetClassId: targetClassId.trim(),
        reason: transferReason.trim(),
        effectiveDate: transferEffectiveDate.trim() || undefined,
        consentAccepted,
      });
      await loadStudentHistory();
      setCurrentView('OVERVIEW');
      Alert.alert(t('parentLifecycle.alert.successTitle'), t('parentLifecycle.alert.transferSuccess'));
    } catch (err: any) {
      Alert.alert(t('parentLifecycle.alert.requestFailedTitle'), err?.message || t('parentLifecycle.alert.transferFailed'));
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleResumeMembership = (pause: MembershipPause) => {
    if (isOffline) {
      Alert.alert(t('parentLifecycle.alert.offlineTitle'), t('parentLifecycle.alert.offlineResume'));
      return;
    }

    Alert.alert(
      t('parentLifecycle.alert.returnTitle'),
      t('parentLifecycle.alert.returnMessage'),
      [
        { text: t('parentLifecycle.alert.cancel'), style: 'cancel' },
        {
          text: t('parentLifecycle.alert.confirmReturn'),
          style: 'default',
          onPress: async () => {
            try {
              setSubmitting(true);
              await membershipService.resumeMembership(pause.id);
              Alert.alert(t('parentLifecycle.alert.welcomeBackTitle'), t('parentLifecycle.alert.restored'));
              await loadStudentHistory();
            } catch (err: any) {
              Alert.alert(t('parentLifecycle.alert.resumeFailedTitle'), err?.message || t('parentLifecycle.alert.resumeFailed'));
            } finally {
              if (isMountedRef.current) {
                setSubmitting(false);
              }
            }
          },
        },
      ]
    );
  };

  // Find active pause if any
  const activePause = historyData?.pauses.find((p) => p.status === 'APPROVED');
  const pendingPause = historyData?.pauses.find((p) => p.status === 'REQUESTED');
  const pendingTransfer = historyData?.transfers.find(
    (tr) => tr.status === 'PENDING_RECEIVING' || tr.status === 'REQUESTED'
  );
  const primaryEnrollment = historyData?.enrollments.find((e) => e.is_primary && e.status === 'ACTIVE');

  return (
    <ScreenContainer scrollable={false}>
      <ScreenHeader
        title={t('parentLifecycle.title')}
        subtitle={t('parentLifecycle.subtitle')}
      />

      {/* Student Selector Card */}
      <Card style={styles.selectorCard}>
        <Text style={styles.inputLabel}>{t('parentLifecycle.studentIdLabel')}</Text>
        <View style={styles.selectorRow}>
          <TextInput
            style={styles.textInput}
            value={studentId}
            onChangeText={setStudentId}
            placeholder={t('parentLifecycle.studentIdPlaceholder')}
            placeholderTextColor="#64748B"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.loadButton}
            onPress={loadStudentHistory}
            accessibilityRole="button"
            accessibilityLabel={t('parentLifecycle.loadHistoryA11y')}
          >
            <Text style={styles.loadButtonText}>{t('parentLifecycle.load')}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Nav Tabs */}
      <View style={styles.navRow}>
        <TouchableOpacity
          testID="tab-overview"
          style={[styles.navTab, currentView === 'OVERVIEW' && styles.activeNavTab]}
          onPress={() => setCurrentView('OVERVIEW')}
        >
          <Text style={[styles.navTabText, currentView === 'OVERVIEW' && styles.activeNavTabText]}>{t('parentLifecycle.tab.overview')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-request-pause"
          style={[styles.navTab, currentView === 'REQUEST_PAUSE' && styles.activeNavTab]}
          onPress={() => setCurrentView('REQUEST_PAUSE')}
        >
          <Text style={[styles.navTabText, currentView === 'REQUEST_PAUSE' && styles.activeNavTabText]}>{t('parentLifecycle.tab.requestPause')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-request-transfer"
          style={[styles.navTab, currentView === 'REQUEST_TRANSFER' && styles.activeNavTab]}
          onPress={() => setCurrentView('REQUEST_TRANSFER')}
        >
          <Text style={[styles.navTabText, currentView === 'REQUEST_TRANSFER' && styles.activeNavTabText]}>{t('parentLifecycle.tab.requestTransfer')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-history"
          style={[styles.navTab, currentView === 'HISTORY' && styles.activeNavTab]}
          onPress={() => setCurrentView('HISTORY')}
        >
          <Text style={[styles.navTabText, currentView === 'HISTORY' && styles.activeNavTabText]}>{t('parentLifecycle.tab.history')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.amber} />}
      >
        {loading ? (
          <LoadingState message={t('parentLifecycle.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadStudentHistory} />
        ) : !studentId.trim() ? (
          <EmptyState
            title={t('parentLifecycle.emptyTitle')}
            description={t('parentLifecycle.emptyDescription')}
            icon={<Users size={32} color="#64748B" />}
          />
        ) : currentView === 'OVERVIEW' ? (
          <View style={styles.contentSection}>
            {/* Active Status Card */}
            <Card style={styles.statusCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{t('parentLifecycle.currentMembership')}</Text>
                  <Text style={styles.cardSubtitle}>
                    {primaryEnrollment ? primaryEnrollment.class_name : t('parentLifecycle.noActiveClass')}
                  </Text>
                </View>
                <StatusBadge status={activePause ? 'PAUSED' : primaryEnrollment ? 'ACTIVE' : 'INACTIVE'} />
              </View>

              {/* Invariant Highlights */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Award size={18} color={BrandColors.amber} />
                  <Text style={styles.statValue}>{historyData?.attendanceCount || 0}</Text>
                  <Text style={styles.statLabel}>{t('parentLifecycle.stat.attended')}</Text>
                </View>
                <View style={styles.statBox}>
                  <DollarSign size={18} color={BrandColors.success} />
                  <Text style={styles.statValue}>{historyData?.paymentsCount || 0}</Text>
                  <Text style={styles.statLabel}>{t('parentLifecycle.stat.receipts')}</Text>
                </View>
                <View style={styles.statBox}>
                  <ArrowRightLeft size={18} color="#38BDF8" />
                  <Text style={styles.statValue}>{historyData?.transfers.length || 0}</Text>
                  <Text style={styles.statLabel}>{t('parentLifecycle.stat.transfers')}</Text>
                </View>
              </View>

              {/* Active or Pending Pause Banner */}
              {activePause ? (
                <View style={styles.alertBanner}>
                  <PauseCircle size={18} color={BrandColors.amber} />
                  <View style={styles.alertTextGroup}>
                    <Text style={styles.alertTitle}>{t('parentLifecycle.pausedTitle')}</Text>
                    <Text style={styles.alertBody}>
                      {t('parentLifecycle.pausedFrom', { date: activePause.start_date })}
                      {activePause.expected_end_date
                        ? t('parentLifecycle.expectedReturnSuffix', { date: activePause.expected_end_date })
                        : ''}
                    </Text>
                  </View>
                  <Button
                    label={t('parentLifecycle.returnNow')}
                    variant="primary"
                    onPress={() => handleResumeMembership(activePause)}
                    disabled={submitting}
                    testID="btn-return-now"
                  />
                </View>
              ) : pendingPause ? (
                <View style={styles.noticeBanner}>
                  <Clock size={16} color="#38BDF8" />
                  <Text style={styles.noticeText}>
                    {t('parentLifecycle.pausePending', { date: pendingPause.start_date })}
                  </Text>
                </View>
              ) : null}

              {/* Pending Transfer Banner */}
              {pendingTransfer ? (
                <View style={styles.noticeBanner}>
                  <ArrowRightLeft size={16} color={BrandColors.amber} />
                  <Text style={styles.noticeText}>
                    {t('parentLifecycle.transferPending', { date: pendingTransfer.effective_date })}
                  </Text>
                </View>
              ) : null}
            </Card>

            {/* Invariant Safety Guarantees Card */}
            <Card style={styles.guaranteeCard}>
              <View style={styles.guaranteeRow}>
                <ShieldCheck size={20} color={BrandColors.success} />
                <View style={styles.guaranteeTextGroup}>
                  <Text style={styles.guaranteeTitle}>{t('parentLifecycle.protectedTitle')}</Text>
                  <Text style={styles.guaranteeBody}>
                    {t('parentLifecycle.protectedBody')}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        ) : currentView === 'REQUEST_PAUSE' ? (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>{t('parentLifecycle.pauseForm.title')}</Text>
            <Text style={styles.formSubtitle}>
              {t('parentLifecycle.pauseForm.subtitle')}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('parentLifecycle.pauseForm.startDate')}</Text>
              <TextInput
                style={styles.formInput}
                value={pauseStartDate}
                onChangeText={setPauseStartDate}
                placeholder="2026-11-01"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('parentLifecycle.pauseForm.expectedReturn')}</Text>
              <TextInput
                style={styles.formInput}
                value={pauseEndDate}
                onChangeText={setPauseEndDate}
                placeholder="2026-11-30"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('parentLifecycle.pauseForm.reason')}</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={pauseReason}
                onChangeText={setPauseReason}
                placeholder={t('parentLifecycle.pauseForm.reasonPlaceholder')}
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={3}
              />
            </View>

            <Button
              label={submitting ? t('parentLifecycle.submitting') : t('parentLifecycle.pauseForm.submit')}
              variant="primary"
              onPress={handlePauseSubmit}
              disabled={submitting}
              loading={submitting}
              testID="btn-submit-pause"
            />
          </Card>
        ) : currentView === 'REQUEST_TRANSFER' ? (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>{t('parentLifecycle.transferForm.title')}</Text>
            <Text style={styles.formSubtitle}>
              {t('parentLifecycle.transferForm.subtitle')}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('parentLifecycle.transferForm.targetClass')}</Text>
              <TextInput
                style={styles.formInput}
                value={targetClassId}
                onChangeText={setTargetClassId}
                placeholder={t('parentLifecycle.transferForm.targetClassPlaceholder')}
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                testID="input-target-class"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('parentLifecycle.transferForm.effectiveDate')}</Text>
              <TextInput
                style={styles.formInput}
                value={transferEffectiveDate}
                onChangeText={setTransferEffectiveDate}
                placeholder="2026-12-01"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('parentLifecycle.transferForm.reason')}</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={transferReason}
                onChangeText={setTransferReason}
                placeholder={t('parentLifecycle.transferForm.reasonPlaceholder')}
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.switchRow}>
              <Switch
                value={consentAccepted}
                onValueChange={setConsentAccepted}
                trackColor={{ false: '#334155', true: BrandColors.amber }}
              />
              <Text style={styles.switchLabel}>
                {t('parentLifecycle.transferForm.consent')}
              </Text>
            </View>

            <Button
              label={submitting ? t('parentLifecycle.submitting') : t('parentLifecycle.transferForm.submit')}
              variant="primary"
              onPress={handleTransferSubmit}
              disabled={submitting}
              loading={submitting}
              testID="btn-submit-transfer"
            />
          </Card>
        ) : (
          <View style={styles.contentSection}>
            <Card style={styles.historyCard}>
              <Text style={styles.historySectionTitle}>{t('parentLifecycle.history.enrollmentTimeline')}</Text>
              {historyData?.enrollments.map((enr) => (
                <View key={enr.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemTitle}>{enr.class_name}</Text>
                    <StatusBadge status={enr.status} />
                  </View>
                  <Text style={styles.historyItemDetail}>
                    {t('parentLifecycle.history.enrollmentDetail', {
                      provenance: enr.provenance,
                      date: enr.effective_from?.slice(0, 10) ?? '',
                    })}
                    {enr.effective_to
                      ? t('parentLifecycle.history.enrollmentTo', { date: enr.effective_to.slice(0, 10) })
                      : t('parentLifecycle.history.enrollmentCurrent')}
                  </Text>
                </View>
              ))}

              <Text style={[styles.historySectionTitle, { marginTop: 16 }]}>{t('parentLifecycle.history.transferHistory')}</Text>
              {historyData?.transfers.length === 0 ? (
                <Text style={styles.emptyHistoryText}>{t('parentLifecycle.history.noTransfers')}</Text>
              ) : (
                historyData?.transfers.map((tr) => (
                  <View key={tr.id} style={styles.historyItem}>
                    <View style={styles.historyItemHeader}>
                      <Text style={styles.historyItemTitle}>
                        {tr.old_class_name} → {tr.new_class_name}
                      </Text>
                      <StatusBadge status={tr.status} />
                    </View>
                    <Text style={styles.historyItemDetail}>
                      {t('parentLifecycle.history.transferDetail', { date: tr.effective_date, reason: tr.reason ?? '' })}
                    </Text>
                  </View>
                ))
              )}

              <Text style={[styles.historySectionTitle, { marginTop: 16 }]}>{t('parentLifecycle.history.pauseHistory')}</Text>
              {historyData?.pauses.length === 0 ? (
                <Text style={styles.emptyHistoryText}>{t('parentLifecycle.history.noPauses')}</Text>
              ) : (
                historyData?.pauses.map((p) => (
                  <View key={p.id} style={styles.historyItem}>
                    <View style={styles.historyItemHeader}>
                      <Text style={styles.historyItemTitle}>{t('parentLifecycle.history.pauseItem', { date: p.start_date })}</Text>
                      <StatusBadge status={p.status} />
                    </View>
                    <Text style={styles.historyItemDetail}>
                      {p.expected_end_date ? t('parentLifecycle.history.pauseExpected', { date: p.expected_end_date }) : ''}
                      {t('parentLifecycle.history.pauseActualReturn', {
                        date: p.actual_return_date || t('parentLifecycle.history.notAvailable'),
                        reason: p.reason,
                      })}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  selectorCard: {
    padding: 12,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadButton: {
    backgroundColor: BrandColors.amber,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  navRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeNavTab: {
    backgroundColor: '#0F172A',
  },
  navTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeNavTabText: {
    color: BrandColors.amber,
  },
  scrollArea: {
    flex: 1,
  },
  contentSection: {
    gap: 12,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451A03',
    borderColor: '#B45309',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  alertTextGroup: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FDE68A',
  },
  alertBody: {
    fontSize: 11,
    color: '#FCD34D',
    marginTop: 1,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
  },
  guaranteeCard: {
    padding: 14,
    borderRadius: 12,
  },
  guaranteeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  guaranteeTextGroup: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  guaranteeBody: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  formSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  switchLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 16,
  },
  historyCard: {
    padding: 16,
    borderRadius: 12,
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BrandColors.amber,
    marginBottom: 8,
  },
  historyItem: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  historyItemDetail: {
    fontSize: 11,
    color: '#94A3B8',
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 8,
  },
});
