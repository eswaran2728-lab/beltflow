import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Calendar,
  Clock,
  ArrowRightLeft,
  PauseCircle,
  ShieldCheck,
  CheckCircle2,
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
import {
  membershipService,
  MembershipPause,
  ClassTransferRequest,
} from '../../../services/membershipService';
import { useI18n } from '../../../i18n';

export interface MasterTransferManagementScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
  route?: {
    params?: {
      classId?: string;
    };
  };
}

type ManagementTab = 'PAUSES' | 'TRANSFERS';

export const MasterTransferManagementScreen: React.FC<MasterTransferManagementScreenProps> = ({
  user,
  isOffline,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ManagementTab>('PAUSES');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingPauses, setPendingPauses] = useState<MembershipPause[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<ClassTransferRequest[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setError(null);
      }
      const [pauses, transfers] = await Promise.all([
        membershipService.getPendingPauses(),
        membershipService.getPendingTransfers(),
      ]);
      if (isMountedRef.current) {
        setPendingPauses(pauses);
        setPendingTransfers(transfers);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Failed to load pending pauses/transfers:', err);
        setError(err?.message || t('masterHandover.tr.loadError'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t]);

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

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleApprovePause = (pause: MembershipPause) => {
    if (isOffline) {
      Alert.alert(t('masterHandover.common.offlineTitle'), t('masterHandover.tr.offlinePause'));
      return;
    }

    Alert.alert(
      t('masterHandover.tr.approvePauseTitle'),
      pause.expected_end_date
        ? t('masterHandover.tr.approvePauseMessageWithEnd', {
            name: pause.student_name || t('masterHandover.tr.studentFallbackLower'),
            start: pause.start_date,
            end: pause.expected_end_date,
          })
        : t('masterHandover.tr.approvePauseMessage', {
            name: pause.student_name || t('masterHandover.tr.studentFallbackLower'),
            start: pause.start_date,
          }),
      [
        { text: t('masterHandover.common.cancel'), style: 'cancel' },
        {
          text: t('masterHandover.tr.approvePause'),
          style: 'default',
          onPress: async () => {
            try {
              setActionInProgress(pause.id);
              await membershipService.approvePause(pause.id, pause.version);
              Alert.alert(t('masterHandover.common.success'), t('masterHandover.tr.pauseApproved'));
              loadData();
            } catch (err: any) {
              Alert.alert(t('masterHandover.tr.approvalFailedTitle'), err?.message || t('masterHandover.tr.pauseApproveFailed'));
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleApproveTransfer = (transfer: ClassTransferRequest) => {
    if (isOffline) {
      Alert.alert(t('masterHandover.common.offlineTitle'), t('masterHandover.tr.offlineTransfer'));
      return;
    }

    Alert.alert(
      t('masterHandover.tr.approveTransferTitle'),
      t('masterHandover.tr.approveTransferMessage', {
        name: transfer.student_name || t('masterHandover.tr.studentFallbackLower'),
        className: transfer.new_class_name || t('masterHandover.tr.newClassFallback'),
        date: transfer.effective_date,
      }),
      [
        { text: t('masterHandover.common.cancel'), style: 'cancel' },
        {
          text: t('masterHandover.tr.confirmTransfer'),
          style: 'default',
          onPress: async () => {
            try {
              setActionInProgress(transfer.id);
              await membershipService.approveTransfer(transfer.id, transfer.version);
              Alert.alert(t('masterHandover.common.success'), t('masterHandover.tr.transferApproved'));
              loadData();
            } catch (err: any) {
              Alert.alert(t('masterHandover.tr.transferFailedTitle'), err?.message || t('masterHandover.tr.transferApproveFailed'));
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable={false}>
      <ScreenHeader
        title={t('masterHandover.tr.title')}
        subtitle={t('masterHandover.tr.subtitle', { name: user.fullName })}
      />

      {/* KPI Summary Cards */}
      <View style={styles.statsRow}>
        <StatCard
          title={t('masterHandover.tr.pendingPauses')}
          value={pendingPauses.length.toString()}
          icon={<PauseCircle size={18} color={BrandColors.amber} />}
        />
        <StatCard
          title={t('masterHandover.tr.pendingTransfers')}
          value={pendingTransfers.length.toString()}
          icon={<ArrowRightLeft size={18} color={BrandColors.amber} />}
        />
      </View>

      {/* Segmented Tab Selector */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'PAUSES' && styles.activeTabButton]}
          onPress={() => setActiveTab('PAUSES')}
          accessibilityRole="button"
          accessibilityLabel={t('masterHandover.tr.pendingPausesTab')}
        >
          <PauseCircle size={16} color={activeTab === 'PAUSES' ? BrandColors.amber : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'PAUSES' && styles.activeTabText]}>
            {t('masterHandover.tr.pendingPausesCount', { count: pendingPauses.length })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'TRANSFERS' && styles.activeTabButton]}
          onPress={() => setActiveTab('TRANSFERS')}
          accessibilityRole="button"
          accessibilityLabel={t('masterHandover.tr.pendingTransfersTab')}
        >
          <ArrowRightLeft size={16} color={activeTab === 'TRANSFERS' ? BrandColors.amber : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'TRANSFERS' && styles.activeTabText]}>
            {t('masterHandover.tr.pendingTransfersCount', { count: pendingTransfers.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.amber} />}
      >
        {loading ? (
          <LoadingState message={t('masterHandover.tr.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : activeTab === 'PAUSES' ? (
          pendingPauses.length === 0 ? (
            <EmptyState
              title={t('masterHandover.tr.noPauses')}
              description={t('masterHandover.tr.noPausesDesc')}
              icon={<CheckCircle2 size={32} color={BrandColors.success} />}
            />
          ) : (
            pendingPauses.map((pause) => {
              const isWorking = actionInProgress === pause.id;
              return (
                <Card key={pause.id} style={styles.itemCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{pause.student_name || t('masterHandover.tr.studentFallback')}</Text>
                      <Text style={styles.studentClass}>{pause.class_name || t('masterHandover.tr.classFallback')} • {pause.belt_rank || t('masterHandover.tr.beltFallback')}</Text>
                    </View>
                    <StatusBadge status={pause.status} />
                  </View>

                  <View style={styles.detailsBlock}>
                    <View style={styles.detailRow}>
                      <Calendar size={14} color={BrandColors.amber} />
                      <Text style={styles.detailText}>
                        {t('masterHandover.tr.start')} <Text style={styles.detailHighlight}>{pause.start_date}</Text>
                        {pause.expected_end_date ? ` ${t('masterHandover.tr.expectedReturn', { date: pause.expected_end_date })}` : ''}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock size={14} color={colors.textMuted} />
                      <Text style={styles.detailText}>{t('masterHandover.common.reasonValue', { reason: pause.reason })}</Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <Button
                      label={isWorking ? t('masterHandover.tr.approving') : t('masterHandover.tr.approvePause')}
                      variant="primary"
                      onPress={() => handleApprovePause(pause)}
                      disabled={isWorking}
                      loading={isWorking}
                    />
                  </View>
                </Card>
              );
            })
          )
        ) : (
          pendingTransfers.length === 0 ? (
            <EmptyState
              title={t('masterHandover.tr.noTransfers')}
              description={t('masterHandover.tr.noTransfersDesc')}
              icon={<CheckCircle2 size={32} color={BrandColors.success} />}
            />
          ) : (
            pendingTransfers.map((transfer) => {
              const isWorking = actionInProgress === transfer.id;
              return (
                <Card key={transfer.id} style={styles.itemCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{transfer.student_name || t('masterHandover.tr.studentFallback')}</Text>
                      <Text style={styles.studentClass}>
                        {transfer.old_class_name || t('masterHandover.tr.sourceClass')} →{' '}
                        <Text style={styles.targetClassText}>{transfer.new_class_name || t('masterHandover.tr.targetClass')}</Text>
                      </Text>
                    </View>
                    <StatusBadge status={transfer.status} />
                  </View>

                  <View style={styles.detailsBlock}>
                    <View style={styles.detailRow}>
                      <Calendar size={14} color={BrandColors.amber} />
                      <Text style={styles.detailText}>
                        {t('masterHandover.tr.effectiveDate')} <Text style={styles.detailHighlight}>{transfer.effective_date}</Text>
                      </Text>
                    </View>
                    {transfer.reason ? (
                      <View style={styles.detailRow}>
                        <Clock size={14} color={colors.textMuted} />
                        <Text style={styles.detailText}>{t('masterHandover.common.reasonValue', { reason: transfer.reason })}</Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <ShieldCheck size={14} color={BrandColors.success} />
                      <Text style={styles.detailText}>
                        {t('masterHandover.tr.capacityGuard')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <Button
                      label={isWorking ? t('masterHandover.tr.confirming') : t('masterHandover.tr.approveTransfer')}
                      variant="primary"
                      onPress={() => handleApproveTransfer(transfer)}
                      disabled={isWorking}
                      loading={isWorking}
                    />
                  </View>
                </Card>
              );
            })
          )
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#0F172A',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: BrandColors.amber,
  },
  scrollArea: {
    flex: 1,
  },
  itemCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  studentClass: {
    fontSize: 13,
    color: '#94A3B8',
  },
  targetClassText: {
    color: BrandColors.amber,
    fontWeight: '600',
  },
  detailsBlock: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
  },
  detailHighlight: {
    color: BrandColors.amber,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
