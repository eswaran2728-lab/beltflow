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
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';

export interface IncomingHandoversScreenProps {
  user: AuthUser;
  navigation?: any;
}

export const IncomingHandoversScreen: React.FC<IncomingHandoversScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handovers, setHandovers] = useState<any[]>([]);

  // Action state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadHandovers = async () => {
    try {
      const res: any = await apiClient.get('/handovers/incoming');
      setHandovers(res?.incomingHandovers || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('masterHandover.in.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient.get('/handovers/incoming')
      .then((res: any) => {
        if (isMounted) {
          setHandovers(res?.incomingHandovers || []);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || t('masterHandover.in.loadError'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadHandovers();
  };

  const handleAccept = async (handoverId: string) => {
    Alert.alert(
      t('masterHandover.in.acceptTitle'),
      t('masterHandover.in.acceptMessage'),
      [
        { text: t('masterHandover.common.cancel'), style: 'cancel' },
        {
          text: t('masterHandover.in.accept'),
          style: 'default',
          onPress: async () => {
            setProcessingId(handoverId);
            try {
              await apiClient.post(`/handovers/${handoverId}/accept`, {});
              Alert.alert(t('masterHandover.in.acceptedTitle'), t('masterHandover.in.acceptedMessage'));
              await loadHandovers();
            } catch (err: any) {
              Alert.alert(t('masterHandover.common.error'), err?.message || t('masterHandover.in.acceptFailed'));
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
      Alert.alert(t('masterHandover.common.requiredField'), t('masterHandover.in.enterReason'));
      return;
    }

    setProcessingId(handoverId);
    try {
      await apiClient.post(`/handovers/${handoverId}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setRejectingId(null);
      setRejectionReason('');
      Alert.alert(t('masterHandover.in.declinedTitle'), t('masterHandover.in.declinedMessage'));
      await loadHandovers();
    } catch (err: any) {
      Alert.alert(t('masterHandover.common.error'), err?.message || t('masterHandover.in.declineFailed'));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('masterHandover.in.title')} onBack={() => navigation?.goBack?.()} />
        <LoadingState message={t('masterHandover.in.loading')} />
      </ScreenContainer>
    );
  }

  if (error && !refreshing) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('masterHandover.in.title')} onBack={() => navigation?.goBack?.()} />
        <ErrorState message={error} onRetry={loadHandovers} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        title={t('masterHandover.in.title')}
        subtitle={t('masterHandover.in.subtitle')}
        onBack={() => navigation?.goBack?.()}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.buttonSecondaryBg} />}
      >
        {handovers.length === 0 ? (
          <EmptyState
            title={t('masterHandover.in.emptyTitle')}
            description={t('masterHandover.in.emptyDesc')}
          />
        ) : (
          handovers.map((h) => {
            const isProcessing = processingId === h.id;
            const isRejectingThis = rejectingId === h.id;

            return (
              <Card key={h.id} style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>{h.class_name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {t('masterHandover.in.fromMaster', { name: h.outgoing_master_name || h.outgoing_master_id })}
                    </Text>
                  </View>
                  <StatusBadge status={h.status} label={h.status} />
                </View>

                <View style={styles.detailsBlock}>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                    {t('masterHandover.common.reasonLabel')} <Text style={{ color: colors.textPrimary }}>{h.reason || t('masterHandover.in.noneProvided')}</Text>
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    {t('masterHandover.in.location', { location: h.class_location || t('masterHandover.in.mainDojo') })}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {t('masterHandover.in.proposedEffective', { date: new Date(h.effective_date).toLocaleDateString() })}
                  </Text>
                </View>

                {isRejectingThis ? (
                  <View style={styles.rejectForm}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      {t('masterHandover.in.declineReasonLabel')}
                    </Text>
                    <TextInput
                      testID={`input-reject-reason-${h.id}`}
                      style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                      placeholder={t('masterHandover.in.declinePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        testID={`btn-confirm-reject-${h.id}`}
                        label={t('masterHandover.in.confirmDecline')}
                        variant="danger"
                        onPress={() => handleReject(h.id)}
                        loading={isProcessing}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={t('masterHandover.common.cancel')}
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
                      testID={`btn-accept-handover-${h.id}`}
                      label={t('masterHandover.in.acceptTitle')}
                      onPress={() => handleAccept(h.id)}
                      loading={isProcessing}
                      style={{ flex: 2 }}
                    />
                    <Button
                      testID={`btn-reject-handover-${h.id}`}
                      label={t('masterHandover.common.decline')}
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
  detailsBlock: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectForm: {
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
