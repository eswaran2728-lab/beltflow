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

export interface HandoverApprovalsScreenProps {
  user: AuthUser;
  navigation?: any;
}

export const HandoverApprovalsScreen: React.FC<HandoverApprovalsScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

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
      setError(err?.message || 'Failed to load pending handovers.');
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
          setError(err?.message || 'Failed to load pending handovers.');
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void loadHandovers();
  };

  const handleApprove = async (handoverId: string) => {
    Alert.alert(
      'Approve Leadership Handover',
      'This will atomically deactivate the outgoing Master and make the incoming Master the Primary Leader of the class.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Transfer',
          style: 'default',
          onPress: async () => {
            setProcessingId(handoverId);
            try {
              await apiClient.post(`/handovers/${handoverId}/approve`, {});
              Alert.alert('Transfer Complete', 'Class primary leadership has been atomically transferred.');
              await loadHandovers();
            } catch (err: any) {
              Alert.alert('Approval Error', err?.message || 'Failed to approve handover.');
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
      Alert.alert('Required Field', 'Please provide a rejection reason.');
      return;
    }

    setProcessingId(handoverId);
    try {
      await apiClient.post(`/handovers/${handoverId}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setRejectingId(null);
      setRejectionReason('');
      Alert.alert('Rejected', 'Handover proposal rejected.');
      await loadHandovers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reject handover.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Handover Approvals" onBack={() => navigation?.goBack?.()} />
        <LoadingState message="Loading handover approval inbox..." />
      </ScreenContainer>
    );
  }

  if (error && !refreshing) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Handover Approvals" onBack={() => navigation?.goBack?.()} />
        <ErrorState message={error} onRetry={loadHandovers} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Handover Approvals"
        subtitle="Persatuan Governance Review"
        onBack={() => navigation?.goBack?.()}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.buttonSecondaryBg} />}
      >
        {pendingHandovers.length === 0 ? (
          <EmptyState
            title="All Handovers Reviewed"
            description="There are no class leadership handovers awaiting Persatuan approval."
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
                      Location: {h.class_location || 'Main Dojo'}
                    </Text>
                  </View>
                  <StatusBadge status={h.status} label={h.status} />
                </View>

                <View style={styles.transferFlowBox}>
                  <View style={styles.masterItem}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Outgoing Master</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {h.outgoing_master_name || h.outgoing_master_id}
                    </Text>
                  </View>

                  <ArrowRightLeft size={iconSize.sm} color={colors.buttonSecondaryBg} style={{ alignSelf: 'center' }} />

                  <View style={styles.masterItem}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Incoming Master</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {h.incoming_master_name || h.incoming_master_id}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Reason: <Text style={{ color: colors.textPrimary }}>{h.reason || 'None provided'}</Text>
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    Incoming Accepted: {h.incoming_accepted_at ? new Date(h.incoming_accepted_at).toLocaleString() : 'PENDING'}
                  </Text>
                </View>

                {isRejectingThis ? (
                  <View style={styles.rejectBox}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      Rejection Reason *
                    </Text>
                    <TextInput
                      testID={`input-admin-reject-reason-${h.id}`}
                      style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                      placeholder="e.g. Incoming Master not eligible for this academy tier"
                      placeholderTextColor={colors.textMuted}
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        testID={`btn-confirm-admin-reject-${h.id}`}
                        label="Confirm Reject"
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
                      testID={`btn-admin-approve-${h.id}`}
                      label="Approve & Transfer"
                      onPress={() => handleApprove(h.id)}
                      loading={isProcessing}
                      style={{ flex: 2 }}
                    />
                    <Button
                      testID={`btn-admin-reject-${h.id}`}
                      label="Reject"
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
