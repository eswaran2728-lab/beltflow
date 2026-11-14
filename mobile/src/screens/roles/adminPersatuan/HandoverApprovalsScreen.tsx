import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import {
  ArrowRightLeft,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';

export interface HandoverApprovalsScreenProps {
  user: AuthUser;
  navigation?: any;
}

export const HandoverApprovalsScreen: React.FC<HandoverApprovalsScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();

  const statusLabel = (status: string) => {
    const key = `adminApprovals.handoverStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadHandovers = async () => {
    try {
      const res: any = await apiClient.get('/handovers/admin');
      setPendingHandovers(res?.pendingHandovers || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('adminApprovals.handover.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    apiClient.get('/handovers/admin')
      .then((res: any) => {
        if (isSubscribed) {
          setPendingHandovers(res?.pendingHandovers || []);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isSubscribed) {
          setError(err?.message || t('adminApprovals.handover.loadFailed'));
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [t]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadHandovers();
  };

  const handleApprove = async (handoverId: string) => {
    Alert.alert(
      t('adminApprovals.handover.approveTitle'),
      t('adminApprovals.handover.approveMessage'),
      [
        { text: t('adminApprovals.cancel'), style: 'cancel' },
        {
          text: t('adminApprovals.handover.approveTransfer'),
          style: 'default',
          onPress: async () => {
            setProcessingId(handoverId);
            try {
              await apiClient.post(`/handovers/${handoverId}/approve`, {});
              Alert.alert(t('adminApprovals.handover.completeTitle'), t('adminApprovals.handover.completeMessage'));
              await loadHandovers();
            } catch (err: any) {
              Alert.alert(t('adminApprovals.approvalError'), err?.message || t('adminApprovals.handover.approveFailed'));
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (handoverId: string) => {
    if (!rejectionReason.trim()) {
      Alert.alert(t('adminApprovals.handover.requiredTitle'), t('adminApprovals.handover.reasonMissing'));
      return;
    }

    setProcessingId(handoverId);
    try {
      await apiClient.post(`/handovers/${handoverId}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setRejectingId(null);
      setRejectionReason('');
      Alert.alert(t('adminApprovals.handover.rejectedTitle'), t('adminApprovals.handover.rejectedMessage'));
      await loadHandovers();
    } catch (err: any) {
      Alert.alert(t('adminApprovals.error'), err?.message || t('adminApprovals.handover.rejectFailed'));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('adminApprovals.handover.title')} onBack={() => navigation?.goBack?.()} />
        <LoadingState message={t('adminApprovals.handover.loading')} />
      </ScreenContainer>
    );
  }

  if (error && !refreshing) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('adminApprovals.handover.title')} onBack={() => navigation?.goBack?.()} />
        <ErrorState message={error} onRetry={loadHandovers} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        title={t('adminApprovals.handover.title')}
        subtitle={t('adminApprovals.handover.subtitle')}
        onBack={() => navigation?.goBack?.()}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.buttonSecondaryBg} />}
      >
        {pendingHandovers.length === 0 ? (
          <EmptyState
            title={t('adminApprovals.handover.emptyTitle')}
            description={t('adminApprovals.handover.emptyDescription')}
          />
        ) : (
          pendingHandovers.map((h) => {
            const isProcessing = processingId === h.id;
            const isRejectingThis = rejectingId === h.id;

            return (
              <Card key={h.id} style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>{h.class_name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {t('adminApprovals.handover.location', { location: h.class_location || t('adminApprovals.handover.mainDojo') })}
                    </Text>
                  </View>
                  <StatusBadge status={h.status} label={statusLabel(h.status)} />
                </View>

                <View style={styles.transferFlowBox}>
                  <View style={styles.masterItem}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{t('adminApprovals.handover.outgoingMaster')}</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {h.outgoing_master_name || h.outgoing_master_id}
                    </Text>
                  </View>

                  <ArrowRightLeft size={iconSize.sm} color={colors.buttonSecondaryBg} style={{ alignSelf: 'center' }} />

                  <View style={styles.masterItem}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{t('adminApprovals.handover.incomingMaster')}</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {h.incoming_master_name || h.incoming_master_id}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('adminApprovals.handover.reasonLabel')} <Text style={{ color: colors.textPrimary }}>{h.reason || t('adminApprovals.handover.noneProvided')}</Text>
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    {t('adminApprovals.handover.incomingAccepted', { value: h.incoming_accepted_at ? new Date(h.incoming_accepted_at).toLocaleString() : t('adminApprovals.pendingUpper') })}
                  </Text>
                </View>

                {isRejectingThis ? (
                  <View style={styles.rejectBox}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      {t('adminApprovals.rejectionReasonRequired')}
                    </Text>
                    <TextInput
                      testID={`input-admin-reject-reason-${h.id}`}
                      style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                      placeholder={t('adminApprovals.handover.rejectPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        testID={`btn-confirm-admin-reject-${h.id}`}
                        label={t('adminApprovals.handover.confirmReject')}
                        variant="danger"
                        onPress={() => handleReject(h.id)}
                        loading={isProcessing}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={t('adminApprovals.cancel')}
                        variant="secondary"
                        onPress={() => {
                          setRejectingId(null);
                          setRejectionReason('');
                        }}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Button
                      testID={`btn-admin-approve-${h.id}`}
                      label={t('adminApprovals.handover.approveTransfer')}
                      onPress={() => handleApprove(h.id)}
                      loading={isProcessing}
                      style={{ flex: 2 }}
                    />
                    <Button
                      testID={`btn-admin-reject-${h.id}`}
                      label={t('adminApprovals.reject')}
                      variant="danger"
                      onPress={() => setRejectingId(h.id)}
                      disabled={isProcessing}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transferFlowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1A202C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  masterItem: {
    flex: 1,
  },
  infoRow: {
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBox: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
