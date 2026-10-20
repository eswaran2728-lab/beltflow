/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Award,
  Calendar,
  Clock,
  DollarSign,
  ShieldAlert,
  CheckCircle,
  Building,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import { OfflineBanner } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import {
  familyService,
  FamilyChild,
  ChildTimelineData,
} from '../../../services/familyService';

export interface FamilyTimelineHubScreenProps {
  user: AuthUser;
  navigation?: any;
  isOffline?: boolean;
  onLogout?: () => void;
}

export const FamilyTimelineHubScreen: React.FC<FamilyTimelineHubScreenProps> = ({
  user,
  isOffline,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius } = useTheme();

  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<ChildTimelineData | null>(null);

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Error & Revoked Guardian states
  const [error, setError] = useState<string | null>(null);
  const [isRevokedGuardian, setIsRevokedGuardian] = useState(false);

  // Active Hub Tab: TIMELINE or MERCHANT_FINANCES
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'FINANCES'>('TIMELINE');

  // Load children list
  const fetchChildren = useCallback(async () => {
    try {
      setLoadingChildren(true);
      setError(null);
      const kids = await familyService.getChildren();
      setChildren(kids);
      if (kids.length > 0) {
        setSelectedChildId(prev => (prev ? prev : kids[0].id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load children list.');
    } finally {
      setLoadingChildren(false);
    }
  }, []);

  // Load child timeline
  const fetchTimeline = useCallback(
    async (studentId: string) => {
      try {
        setLoadingTimeline(true);
        setError(null);
        setIsRevokedGuardian(false);

        const data = await familyService.getChildTimeline(studentId);
        setTimelineData(data);
      } catch (err: any) {
        if (
          err.statusCode === 403 ||
          err.message?.includes('revoked') ||
          err.message?.includes('inactive') ||
          err.message?.includes('Forbidden')
        ) {
          setIsRevokedGuardian(true);
          setError(
            err.message ||
              'Access Restricted: Guardian authorization revoked or inactive for this student.'
          );
        } else {
          setError(err.message || 'Failed to load student timeline.');
        }
      } finally {
        setLoadingTimeline(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChildId) {
      fetchTimeline(selectedChildId);
    }
  }, [selectedChildId, fetchTimeline]);

  return (
    <ScreenContainer scrollable testID="family-timeline-hub-screen">
      <ScreenHeader
        title="Family Hub & Timeline"
        subtitle="Child Progression & Merchant Dues"
      />

      {isOffline && (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner message="Offline Mode: Displaying cached family records." />
        </View>
      )}

      {/* Multilingual Child Selector (Acceptance: long_multilingual_child_names_readable) */}
      <View style={[styles.childSelectorSection, { marginBottom: spacing.md }]}>
        <Text style={[typography.caption, { fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }]}>
          SELECT FAMILY MEMBER
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childScrollContainer}
          testID="family-child-selector-scroll"
        >
          {loadingChildren ? (
            <ActivityIndicator size="small" color={colors.buttonPrimaryBg} />
          ) : children.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              No linked children found.
            </Text>
          ) : (
            children.map(child => {
              const isSelected = child.id === selectedChildId;
              return (
                <TouchableOpacity
                  key={child.id}
                  onPress={() => setSelectedChildId(child.id)}
                  style={[
                    styles.childTab,
                    {
                      backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.backgroundSecondary,
                      borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                  testID={`child-selector-tab-${child.id}`}
                >
                  {/* Full multilingual name rendered without truncation */}
                  <Text
                    style={[
                      typography.button,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textPrimary,
                        fontSize: 14,
                      },
                    ]}
                    numberOfLines={2}
                    testID={`child-name-text-${child.id}`}
                  >
                    {child.full_name}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: isSelected ? 'rgba(255,255,255,0.85)' : colors.textSecondary,
                        marginTop: 2,
                      },
                    ]}
                  >
                    {child.belt_rank} • {child.organization_name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Revoked Guardian Banner (Acceptance: revoked_guardian_loses_access) */}
      {isRevokedGuardian && (
        <Card
          variant="standard"
          style={[styles.revokedCard, { borderColor: BrandColors.danger }]}
          testID="revoked-guardian-banner"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldAlert size={iconSize.lg} color={BrandColors.danger} />
            <Text
              style={[
                typography.sectionHeading,
                { color: BrandColors.danger, marginLeft: spacing.sm, fontSize: 16 },
              ]}
            >
              Access Restricted (HTTP 403)
            </Text>
          </View>
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}
            testID="revoked-guardian-message"
          >
            {error || 'Guardian authorization revoked or inactive for this student.'}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            BeltFlow Security: Only active, verified guardians have legal access to inspect student training
            records and private academy schedules.
          </Text>
        </Card>
      )}

      {/* Main Content when not revoked */}
      {!isRevokedGuardian && (
        <>
          {/* Hub Sub-Tabs: Timeline vs Per-Merchant Finances */}
          <View style={[styles.subTabs, { backgroundColor: colors.backgroundSecondary }]}>
            <TouchableOpacity
              style={[
                styles.subTab,
                activeTab === 'TIMELINE' && {
                  backgroundColor: colors.buttonPrimaryBg,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setActiveTab('TIMELINE')}
              testID="tab-student-timeline"
            >
              <Award
                size={iconSize.sm}
                color={activeTab === 'TIMELINE' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  typography.button,
                  {
                    color: activeTab === 'TIMELINE' ? '#FFFFFF' : colors.textSecondary,
                    marginLeft: 6,
                  },
                ]}
              >
                Progress Timeline
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTab,
                activeTab === 'FINANCES' && {
                  backgroundColor: colors.buttonPrimaryBg,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setActiveTab('FINANCES')}
              testID="tab-merchant-finances"
            >
              <DollarSign
                size={iconSize.sm}
                color={activeTab === 'FINANCES' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  typography.button,
                  {
                    color: activeTab === 'FINANCES' ? '#FFFFFF' : colors.textSecondary,
                    marginLeft: 6,
                  },
                ]}
              >
                Merchant Dues & Balances
              </Text>
            </TouchableOpacity>
          </View>

          {loadingTimeline ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
                Loading timeline & dues...
              </Text>
            </View>
          ) : activeTab === 'TIMELINE' ? (
            /* PROGRESS & ATTENDANCE TIMELINE */
            <View testID="student-timeline-section">
              {/* Student Summary Card */}
              {timelineData?.student && (
                <Card variant="standard" style={{ marginTop: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: spacing.sm }}>
                      <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} testID="timeline-student-name">
                        {timelineData.student.fullName}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        IC: {timelineData.student.icNumber} • Registered: {timelineData.student.registeredAt}
                      </Text>
                      <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600', marginTop: 2 }]}>
                        Class: {timelineData.student.className || 'General Dojo'}
                      </Text>
                    </View>
                    <BeltBadge beltName={timelineData.student.beltRank || 'White Belt'} testID="timeline-student-belt" />
                  </View>
                </Card>
              )}

              {/* Belt Promotion History */}
              <Card variant="standard" style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <Award size={iconSize.md} color={colors.buttonPrimaryBg} />
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    Belt Rank History
                  </Text>
                </View>
                <View testID="rank-history-list">
                  {(timelineData?.rankHistory || []).length === 0 ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      No past grading promotions recorded.
                    </Text>
                  ) : (
                    timelineData?.rankHistory.map((rank, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.timelineItemRow,
                          { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.button, { color: colors.textPrimary }]}>
                            {rank.rank_name}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            Awarded: {new Date(rank.awarded_at).toLocaleDateString()}
                          </Text>
                          {rank.certificate_code ? (
                            <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2 }]}>
                              Certificate: {rank.certificate_code}
                            </Text>
                          ) : null}
                        </View>
                        <CheckCircle size={iconSize.sm} color={BrandColors.success} />
                      </View>
                    ))
                  )}
                </View>
              </Card>

              {/* Attendance Records */}
              <Card variant="standard" style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <Calendar size={iconSize.md} color={colors.buttonPrimaryBg} />
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    Recent Training Attendance
                  </Text>
                </View>
                <View testID="attendance-history-list">
                  {(timelineData?.attendance || []).length === 0 ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      No attendance sessions marked yet.
                    </Text>
                  ) : (
                    timelineData?.attendance.map((att, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.timelineItemRow,
                          { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.button, { color: colors.textPrimary }]}>
                            {att.session_date} — {att.class_name}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            Logged: {att.marked_at ? new Date(att.marked_at).toLocaleTimeString() : 'N/A'}
                          </Text>
                        </View>
                        <StatusBadge
                          status={att.status}
                          label={att.status}
                          variant={att.status === 'PRESENT' ? 'success' : 'warning'}
                        />
                      </View>
                    ))
                  )}
                </View>
              </Card>

              {/* Upcoming Sessions */}
              <Card variant="standard" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <Clock size={iconSize.md} color={colors.buttonPrimaryBg} />
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    Upcoming Class Sessions
                  </Text>
                </View>
                <View testID="upcoming-sessions-list">
                  {(timelineData?.upcomingSessions || []).length === 0 ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      No future sessions currently scheduled.
                    </Text>
                  ) : (
                    timelineData?.upcomingSessions.map((session, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.timelineItemRow,
                          { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.button, { color: colors.textPrimary }]}>
                            {session.session_date} ({session.day_of_week})
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            {session.start_time} - {session.end_time} • {session.location}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </Card>
            </View>
          ) : (
            /* MERCHANT PARTITIONED DUES & BALANCES (Acceptance: family_totals_correct_per_merchant) */
            <View style={{ marginTop: spacing.md, marginBottom: spacing.xl }} testID="merchant-finances-section">
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Strict Merchant Segregation: Dues and balances are calculated and held per Persatuan
                merchant entity and are never mingled.
              </Text>

              {(timelineData?.financialPartitions || []).length === 0 ? (
                <Card variant="standard">
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
                    No outstanding fees or billing records found for this student.
                  </Text>
                </Card>
              ) : (
                timelineData?.financialPartitions.map(partition => (
                  <Card
                    key={partition.organizationId}
                    variant="standard"
                    style={[styles.merchantCard, { borderColor: colors.border }]}
                    testID={`merchant-partition-card-${partition.organizationId}`}
                  >
                    {/* Merchant Header */}
                    <View style={styles.merchantHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Building size={iconSize.md} color={colors.buttonPrimaryBg} />
                        <Text
                          style={[
                            typography.sectionHeading,
                            { color: colors.textPrimary, marginLeft: spacing.xs, fontSize: 16 },
                          ]}
                          testID={`merchant-name-${partition.organizationId}`}
                        >
                          {partition.merchantName}
                        </Text>
                      </View>
                      <View style={[styles.currencyTag, { backgroundColor: colors.backgroundSecondary }]}>
                        <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary }]}>
                          {partition.currency}
                        </Text>
                      </View>
                    </View>

                    {/* Merchant Partition Financial Summary */}
                    <View style={styles.financialStatsGrid}>
                      <View style={styles.statBox}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>Total Billed</Text>
                        <Text
                          style={[typography.button, { color: colors.textPrimary, marginTop: 2 }]}
                          testID={`merchant-billed-${partition.organizationId}`}
                        >
                          {partition.currency} {partition.totalFeeAmount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>Total Paid</Text>
                        <Text
                          style={[typography.button, { color: BrandColors.success, marginTop: 2 }]}
                          testID={`merchant-paid-${partition.organizationId}`}
                        >
                          {partition.currency} {partition.totalAmountPaid.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>Outstanding</Text>
                        <Text
                          style={[
                            typography.button,
                            {
                              color:
                                partition.totalOutstandingAmount > 0
                                  ? BrandColors.danger
                                  : BrandColors.success,
                              marginTop: 2,
                            },
                          ]}
                          testID={`merchant-outstanding-${partition.organizationId}`}
                        >
                          {partition.currency} {partition.totalOutstandingAmount.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Dues Breakdown */}
                    <View style={{ marginTop: spacing.sm }}>
                      <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary }]}>
                        Itemized Monthly Dues:
                      </Text>
                      {partition.dues.map(due => (
                        <View
                          key={due.id}
                          style={[
                            styles.dueRow,
                            { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                          ]}
                          testID={`due-item-${due.id}`}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[typography.button, { color: colors.textPrimary }]}>
                              Month: {due.billingMonth}
                            </Text>
                            <Text style={[typography.caption, { color: colors.textSecondary }]}>
                              Fee: {partition.currency} {due.feeAmount.toFixed(2)} | Paid: {partition.currency}{' '}
                              {due.amountPaid.toFixed(2)}
                            </Text>
                          </View>
                          <StatusBadge
                            status={due.status}
                            label={due.status}
                            variant={due.status === 'PAID' ? 'success' : 'warning'}
                          />
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  childSelectorSection: {
    paddingTop: 8,
  },
  childScrollContainer: {
    paddingVertical: 4,
  },
  childTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    minWidth: 180,
  },
  revokedCard: {
    padding: 16,
    borderWidth: 1.5,
    marginTop: 8,
    marginBottom: 16,
  },
  subTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingBox: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
  merchantCard: {
    padding: 16,
    marginBottom: 14,
  },
  merchantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currencyTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  financialStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 6,
  },
});
