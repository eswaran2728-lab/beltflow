import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface ClassProposalItem {
  id: string;
  name: string;
  organization_id?: string;
  organization_name?: string;
  location?: string;
  venue_details?: string;
  schedule?: string;
  monthly_fee?: string | number;
  capacity?: number;
  status: 'DRAFT' | 'SUBMITTED' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  version: number;
  requested_information?: string;
  rejection_reason?: string;
  submitted_at?: string;
  created_at?: string;
}

export interface ClassProposalStatusScreenProps {
  user: AuthUser;
  navigation?: any;
  isOffline?: boolean;
}

export const ClassProposalStatusScreen: React.FC<ClassProposalStatusScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proposals, setProposals] = useState<ClassProposalItem[]>([]);

  const fetchProposals = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/class-applications/me');
      setProposals(res?.applications || []);
    } catch (err) {
      console.error('[ClassProposalStatusScreen fetch error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const res: any = await apiClient.get('/class-applications/me');
        if (!isCancelled) {
          setProposals(res?.applications || []);
        }
      } catch (err) {
        console.error('[ClassProposalStatusScreen load error]', err);
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
  }, []);

  const handleWithdraw = async (appId: string) => {
    Alert.alert(
      'Withdraw Proposal',
      'Are you sure you want to withdraw this class proposal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post(`/class-applications/${appId}/withdraw`, {});
              Alert.alert('Withdrawn', 'Class proposal has been withdrawn.');
              fetchProposals();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to withdraw proposal.');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <StatusBadge status="PENDING" label="Awaiting Review" variant="warning" testID="badge-status-submitted" />;
      case 'NEEDS_INFORMATION':
        return <StatusBadge status="WARNING" label="Action Required" variant="warning" testID="badge-status-needs-info" />;
      case 'APPROVED':
        return <StatusBadge status="ACTIVE" label="Approved" variant="success" testID="badge-status-approved" />;
      case 'REJECTED':
        return <StatusBadge status="EXPIRED" label="Rejected" variant="danger" testID="badge-status-rejected" />;
      case 'WITHDRAWN':
        return <StatusBadge status="INACTIVE" label="Withdrawn" variant="info" testID="badge-status-withdrawn" />;
      default:
        return <StatusBadge status="PENDING" label="Draft" variant="info" testID="badge-status-draft" />;
    }
  };

  if (loading && proposals.length === 0) {
    return (
      <ScreenContainer scrollable testID="class-proposal-status-screen">
        <ScreenHeader title="Class Proposals" subtitle="Status of proposed training classes" />
        <LoadingState message="Loading your class proposals..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="class-proposal-status-screen">
      <ScreenHeader
        title="Class Proposals"
        subtitle="Status of proposed training classes"
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProposals(); }} />}
      >
        {proposals.length === 0 ? (
          <EmptyState
            title="No Class Proposals"
            description="You have not submitted any class proposals yet."
            actionLabel="Propose New Class"
            onAction={() => navigation?.navigate?.('CreateClass')}
            testID="empty-class-proposals"
          />
        ) : (
          proposals.map((item) => (
            <Card key={item.id} variant="standard" style={[styles.proposalCard, { marginBottom: spacing.md }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {item.name}
                  </Text>
                  {item.schedule ? (
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {item.schedule}
                    </Text>
                  ) : null}
                  {item.location ? (
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 1 }]}>
                      {item.location} {item.venue_details ? `(${item.venue_details})` : ''}
                    </Text>
                  ) : null}
                </View>
                {getStatusBadge(item.status)}
              </View>

              {item.status === 'NEEDS_INFORMATION' && item.requested_information ? (
                <View style={[styles.infoBox, { backgroundColor: colors.badgeWarningBg, borderColor: colors.badgeWarningText }]}>
                  <Text style={[typography.caption, { color: colors.badgeWarningText, fontWeight: '700', marginBottom: 2 }]}>
                    Persatuan Admin Requested Information:
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.badgeWarningText }]}>
                    {item.requested_information}
                  </Text>
                </View>
              ) : null}

              {item.status === 'REJECTED' && item.rejection_reason ? (
                <View style={[styles.infoBox, { backgroundColor: colors.errorBg, borderColor: colors.errorText }]}>
                  <Text style={[typography.caption, { color: colors.errorText, fontWeight: '700', marginBottom: 2 }]}>
                    Rejection Reason:
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.errorText }]}>
                    {item.rejection_reason}
                  </Text>
                </View>
              ) : null}

              {['DRAFT', 'SUBMITTED'].includes(item.status) ? (
                <View style={styles.cardActions}>
                  <Button
                    label="Withdraw"
                    onPress={() => handleWithdraw(item.id)}
                    variant="outline"
                    size="sm"
                    testID={`btn-withdraw-${item.id}`}
                  />
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  proposalCard: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
});
