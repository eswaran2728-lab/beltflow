import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Plus, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface ClassesScreenProps {
  user: AuthUser;
  navigation?: any;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const ClassesScreen: React.FC<ClassesScreenProps> = ({
  user,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [approvedClasses, setApprovedClasses] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'APPROVED' | 'PENDING' | 'REJECTED'>('APPROVED');

  const fetchData = useCallback(async () => {
    try {
      const orgId = user.organizationId;
      const [classRes, propRes]: [any, any] = await Promise.all([
        orgId ? apiClient.get(`/classes/organization/${orgId}`) : Promise.resolve({ classes: [] }),
        apiClient.get('/class-applications/me'),
      ]);

      setApprovedClasses(classRes?.classes || []);
      setProposals(propRes?.applications || []);
    } catch (err) {
      console.error('[ClassesScreen fetchData error]', err);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const orgId = user.organizationId;
        const [classRes, propRes]: [any, any] = await Promise.all([
          orgId ? apiClient.get(`/classes/organization/${orgId}`) : Promise.resolve({ classes: [] }),
          apiClient.get('/class-applications/me'),
        ]);

        if (!isCancelled) {
          setApprovedClasses(classRes?.classes || []);
          setProposals(propRes?.applications || []);
        }
      } catch (err) {
        console.error('[ClassesScreen load error]', err);
      } finally {
        if (!isCancelled) {
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  const pendingProposals = proposals.filter((p) => ['DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION'].includes(p.status));
  const rejectedProposals = proposals.filter((p) => p.status === 'REJECTED');

  return (
    <ScreenContainer scrollable testID="master-classes-screen">
      <ScreenHeader
        title="Assigned Classes"
        subtitle="Manage approved classes and track proposals"
        rightAction={
          <Button
            label="New Class"
            onPress={() => navigation?.navigate?.('CreateClass')}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={iconSize.sm} color={colors.buttonPrimaryText} />}
            testID="btn-create-new-class"
          />
        }
      />

      <View style={{ marginBottom: spacing.sm }}>
        <Button
          label="View Class Students"
          onPress={() => navigation?.navigate?.('Students')}
          variant="outline"
          size="sm"
          rightIcon={<ArrowRight size={iconSize.sm} color={colors.buttonSecondaryText} />}
          testID="btn-view-class-students"
          accessibilityLabel="View Class Students via nested stack"
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Button
          label={`Approved (${approvedClasses.length})`}
          onPress={() => setActiveTab('APPROVED')}
          variant={activeTab === 'APPROVED' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginRight: spacing.xs }}
          testID="tab-approved-classes"
        />
        <Button
          label={`Proposals (${pendingProposals.length})`}
          onPress={() => setActiveTab('PENDING')}
          variant={activeTab === 'PENDING' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginHorizontal: spacing.xs }}
          testID="tab-pending-proposals"
        />
        <Button
          label={`Rejected (${rejectedProposals.length})`}
          onPress={() => setActiveTab('REJECTED')}
          variant={activeTab === 'REJECTED' ? 'primary' : 'outline'}
          size="sm"
          style={{ flex: 1, marginLeft: spacing.xs }}
          testID="tab-rejected-proposals"
        />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {activeTab === 'APPROVED' && (
          <View>
            {approvedClasses.length === 0 ? (
              <Card variant="standard" style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  No active approved classes yet.
                </Text>
                <Button
                  label="Propose a New Class"
                  onPress={() => navigation?.navigate?.('CreateClass')}
                  variant="outline"
                  size="sm"
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              approvedClasses.map((cls) => (
                <Card key={cls.id} variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                        {cls.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        {cls.schedule}
                      </Text>
                    </View>
                    <StatusBadge status="ACTIVE" label="Approved" variant="success" />
                  </View>

                  {/* Operational actions: ONLY allowed for approved classes */}
                  <View style={styles.operationalActions}>
                    <Button
                      label="Manage Class"
                      onPress={() => navigation?.navigate?.('Attendance', { classId: cls.id })}
                      variant="secondary"
                      size="sm"
                      rightIcon={<ArrowRight size={iconSize.sm} color={colors.buttonSecondaryText} />}
                      testID={`btn-operate-${cls.id}`}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === 'PENDING' && (
          <View>
            {pendingProposals.length === 0 ? (
              <Card variant="standard" style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  No pending class proposals.
                </Text>
              </Card>
            ) : (
              pendingProposals.map((item) => (
                <Card key={item.id} variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                        {item.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        {item.schedule || 'Schedule pending'}
                      </Text>
                    </View>
                    <StatusBadge
                      status={item.status === 'SUBMITTED' ? 'PENDING' : 'WARNING'}
                      label={item.status === 'SUBMITTED' ? 'Awaiting Review' : 'Needs Info'}
                      variant="warning"
                    />
                  </View>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    Notice: Class operations are unavailable until Persatuan approval is granted.
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === 'REJECTED' && (
          <View>
            {rejectedProposals.length === 0 ? (
              <Card variant="standard" style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  No rejected proposals.
                </Text>
              </Card>
            ) : (
              rejectedProposals.map((item) => (
                <Card key={item.id} variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                        {item.name}
                      </Text>
                      {item.rejection_reason ? (
                        <Text style={[typography.caption, { color: colors.errorText, marginTop: 4 }]}>
                          Reason: {item.rejection_reason}
                        </Text>
                      ) : null}
                    </View>
                    <StatusBadge status="EXPIRED" label="Rejected" variant="danger" />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  card: {
    padding: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  operationalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
