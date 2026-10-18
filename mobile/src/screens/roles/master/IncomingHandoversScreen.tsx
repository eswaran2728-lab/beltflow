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

export interface IncomingHandoversScreenProps {
  user: AuthUser;
  navigation?: any;
}

export const IncomingHandoversScreen: React.FC<IncomingHandoversScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing } = useTheme();

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
      setError(err?.message || 'Failed to load incoming handover requests.');
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
          setError(err?.message || 'Failed to load incoming handover requests.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void loadHandovers();
  };

  const handleAccept = async (handoverId: string) => {
    Alert.alert(
      'Accept Responsibility',
      'By accepting, you agree to become the primary Master for this class pending Persatuan Admin final approval.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            setProcessingId(handoverId);
            try {
              await apiClient.post(`/handovers/${handoverId}/accept`, {});
              Alert.alert('Accepted', 'Handover accepted. Persatuan Admin has been notified for final approval.');
              await loadHandovers();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to accept handover.');
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
      Alert.alert('Required Field', 'Please provide a reason for declining this handover.');
      return;
    }

    setProcessingId(handoverId);
    try {
      await apiClient.post(`/handovers/${handoverId}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setRejectingId(null);
      setRejectionReason('');
      Alert.alert('Declined', 'Handover request declined.');
      await loadHandovers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to decline handover.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Incoming Handovers" onBack={() => navigation?.goBack?.()} />
        <LoadingState message="Loading incoming handover requests..." />
      </ScreenContainer>
    );
  }

  if (error && !refreshing) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Incoming Handovers" onBack={() => navigation?.goBack?.()} />
        <ErrorState message={error} onRetry={loadHandovers} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Incoming Handovers"
        subtitle="Review classes offered to you"
        onBack={() => navigation?.goBack?.()}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.buttonSecondaryBg} />}
      >
        {handovers.length === 0 ? (
          <EmptyState
            title="No Pending Handovers"
            description="You do not have any pending class leadership handover requests to review."
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
                      From Master: {h.outgoing_master_name || h.outgoing_master_id}
                    </Text>
                  </View>
                  <StatusBadge status={h.status} label={h.status} />
                </View>

                <View style={styles.detailsBlock}>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                    Reason: <Text style={{ color: colors.textPrimary }}>{h.reason || 'None provided'}</Text>
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    Location: {h.class_location || 'Main Dojo'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Proposed Effective: {new Date(h.effective_date).toLocaleDateString()}
                  </Text>
                </View>

                {isRejectingThis ? (
                  <View style={styles.rejectForm}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      Reason for declining *
                    </Text>
                    <TextInput
                      testID={`input-reject-reason-${h.id}`}
                      style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                      placeholder="e.g. Schedule conflict with existing classes"
                      placeholderTextColor={colors.textMuted}
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        testID={`btn-confirm-reject-${h.id}`}
                        label="Confirm Decline"
                        variant="danger"
                        onPress={() => handleReject(h.id)}
                        loading={isProcessing}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label="Cancel"
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
                      label="Accept Responsibility"
                      onPress={() => handleAccept(h.id)}
                      loading={isProcessing}
                      style={{ flex: 2 }}
                    />
                    <Button
                      testID={`btn-reject-handover-${h.id}`}
                      label="Decline"
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
