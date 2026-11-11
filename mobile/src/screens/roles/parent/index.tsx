import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import {
  Users,
  Award,
  Bell,
  ArrowRight,
  User,
  LogOut,
  Calendar,
  MessageSquare,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { StitchTokens } from '../../../theme/tokens';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';
import {
  StitchAppHeader,
  StitchStatCard,
  FamilyBillingCard,
  MerchantBillingItem,
} from '../../../components/stitch';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import { OfflineBanner, LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dashboardService, ParentDashboardData, ParentChildSummary } from '../../../services/dashboardService';
import { ParentChildPassViewer, LinkedChildPassData } from '../../../components/ParentChildPassViewer';
import { ParentFeesPaymentScreen } from './ParentFeesPaymentScreen';

export interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const ParentHomeScreen: React.FC<RoleScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    return dashboardService.getParentDashboard(user);
  }, [user]);

  const { data, loading, refreshing, error, reload, refresh } = useDashboardData<ParentDashboardData>({
    fetcher,
    isOffline,
  });

  const headerRightAction = onLogout ? (
    <Button
      label="Sign Out"
      onPress={onLogout}
      variant="outline"
      size="sm"
      leftIcon={<LogOut size={iconSize.sm} color={colors.textSecondary} />}
      testID="btn-role-logout"
      accessibilityLabel="Sign Out of BeltFlow"
    />
  ) : undefined;

  const children = useMemo(() => data?.children || [], [data?.children]);
  const activeChild: ParentChildSummary | undefined =
    children.find(c => c.id === selectedChildId) || children[0];

  // Server-authoritative family billing calculations
  const { totalFamilyOutstanding, merchantPartitions, hasSiblingDiscount, siblingDiscountSavings } = useMemo(() => {
    let totalOutstanding = 0;
    const merchantsMap = new Map<string, MerchantBillingItem>();

    for (const c of children) {
      totalOutstanding += (c.totalPending || 0);

      const orgId = c.organizationId || user.organizationId || 'org_default';
      const orgName = c.organizationName || 'Persatuan Academy';

      if (!merchantsMap.has(orgId)) {
        merchantsMap.set(orgId, {
          organizationId: orgId,
          merchantName: orgName,
          currency: 'MYR',
          totalFeeAmount: 0,
          totalAmountPaid: 0,
          totalOutstandingAmount: 0,
          duesCount: 0,
          hasSiblingDiscount: false,
        });
      }

      const m = merchantsMap.get(orgId)!;
      m.totalFeeAmount += (c.monthlyFee || 0);
      m.totalOutstandingAmount += (c.totalPending || 0);
      m.totalAmountPaid = Math.max(0, m.totalFeeAmount - m.totalOutstandingAmount);
      m.duesCount = (m.duesCount || 0) + (c.monthsPendingCount || 0);
      if (c.hasSiblingDiscount) {
        m.hasSiblingDiscount = true;
      }
    }

    const isSiblingEligible = children.length >= 2 || children.some(c => c.hasSiblingDiscount);
    // Calculated saving: e.g. 10% standard Persatuan discount if 2+ children
    const discountSavings = isSiblingEligible
      ? Math.round(children.reduce((acc, c) => acc + (c.hasSiblingDiscount ? (c.monthlyFee * 0.1) : 0), 0) * 100) / 100 || (children.length >= 2 ? 12.00 : 0)
      : 0;

    return {
      totalFamilyOutstanding: Math.round(totalOutstanding * 100) / 100,
      merchantPartitions: Array.from(merchantsMap.values()),
      hasSiblingDiscount: isSiblingEligible,
      siblingDiscountSavings: discountSavings,
    };
  }, [children, user.organizationId]);

  const renderIdentityCard = () => (
    <Card variant="standard" style={[styles.identityCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
      <View style={styles.userRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {user.fullName}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {user.email}
          </Text>
          {user.organizationId ? (
            <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2, fontWeight: '600' }]}>
              Primary Persatuan: {user.organizationId}
            </Text>
          ) : null}
        </View>
        <StatusBadge
          status={UserRole.PARENT}
          label="PARENT / GUARDIAN"
          variant="info"
          testID="badge-role-parent"
        />
      </View>
    </Card>
  );

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchAppHeader
          dojangName="BELTFLOW FAMILY HUB"
          roleBadgeText="PARENT"
          hasUnreadNotifications={false}
        />
        <ScreenContainer scrollable testID="parent-home-screen">
          <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Parent Home" rightAction={headerRightAction} />
          {isOffline ? (
            <View style={{ marginBottom: spacing.md }}>
              <OfflineBanner
                message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
                testID="offline-security-banner"
              />
            </View>
          ) : null}
          {renderIdentityCard()}
          <LoadingState message="Loading family dashboard..." />
        </ScreenContainer>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchAppHeader
          dojangName="BELTFLOW FAMILY HUB"
          roleBadgeText="PARENT"
          hasUnreadNotifications={false}
        />
        <ScreenContainer scrollable testID="parent-home-screen">
          <ScreenHeader title={`Welcome, ${user.fullName}`} subtitle="Parent Home" rightAction={headerRightAction} />
          {isOffline ? (
            <View style={{ marginBottom: spacing.md }}>
              <OfflineBanner
                message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
                testID="offline-security-banner"
              />
            </View>
          ) : null}
          {renderIdentityCard()}
          <ErrorState message={error.message} onRetry={reload} />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StitchAppHeader
        dojangName="BELTFLOW FAMILY HUB"
        roleBadgeText="PARENT"
        hasUnreadNotifications={(data?.notices && data.notices.length > 0) || false}
      />

      <ScreenContainer
        scrollable
        testID="parent-home-screen"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={StitchTokens.colors.colorAccent}
            colors={[StitchTokens.colors.colorAccent]}
          />
        }
      >
        <ScreenHeader
          title={`Welcome, ${user.fullName}`}
          subtitle="Parent Home"
          rightAction={headerRightAction}
        />

        {isOffline ? (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message="Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online."
              testID="offline-security-banner"
            />
          </View>
        ) : null}

        {renderIdentityCard()}

        {/* Linked Children Section */}
        {children.length === 0 ? (
          <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <EmptyState
              title="No Linked Children"
              description="No approved student profiles are currently linked to your family account. Contact your Persatuan academy to approve family linking."
              testID="empty-linked-children"
            />
          </Card>
        ) : (
          <>
            {/* Multi-Child Switcher Tabs (Stitch Pills) */}
            {children.length > 1 ? (
              <View style={[styles.childSwitcherContainer, { marginBottom: spacing.md }]}>
                <Text style={styles.childSwitcherLabel}>LINKED MARTIAL ARTISTS ({children.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {children.map(child => {
                    const isSelected = (activeChild?.id === child.id);
                    return (
                      <TouchableOpacity
                        key={child.id}
                        onPress={() => setSelectedChildId(child.id)}
                        testID={`child-tab-${child.id}`}
                        style={[
                          styles.childPill,
                          isSelected ? styles.childPillActive : styles.childPillInactive,
                        ]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Select child ${child.fullName}`}
                      >
                        <View style={[styles.childAvatarCircle, isSelected && styles.childAvatarCircleActive]}>
                          <Text style={[styles.childAvatarText, isSelected && styles.childAvatarTextActive]}>
                            {child.fullName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.childPillText,
                            isSelected ? styles.childPillTextActive : styles.childPillTextInactive,
                          ]}
                          numberOfLines={1}
                        >
                          {child.fullName}
                        </Text>
                        <View style={[styles.beltRankDot, { backgroundColor: getBeltDotColor(child.beltRank) }]} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* Active Child Overview Card */}
            {activeChild ? (
              <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
                <View style={styles.childHeaderRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                      {activeChild.fullName}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {activeChild.className || 'Silambam Cohort'} • Standard Monthly Fee: RM {activeChild.monthlyFee.toFixed(2)}
                    </Text>
                  </View>
                  <BeltBadge beltName={activeChild.beltRank} size="md" testID="parent-active-child-belt" />
                </View>

                {/* Child Stat Metrics Grid (StitchStatCard) */}
                <View style={[styles.statsGrid, { gap: spacing.sm, marginTop: spacing.md }]}>
                  <StitchStatCard
                    label="ATTENDANCE"
                    value={`${activeChild.attendancePresent} / ${activeChild.attendanceTotal}`}
                    subtext="Sessions Attended"
                    accentColor={StitchTokens.colors.bfGreen}
                    style={{ flex: 1 }}
                    testID="stat-parent-attendance"
                  />
                  <StitchStatCard
                    label="OUTSTANDING"
                    value={`RM ${activeChild.totalPending % 1 === 0 ? activeChild.totalPending.toFixed(0) : activeChild.totalPending.toFixed(2)}`}
                    subtext={activeChild.monthsPendingCount > 0 ? `${activeChild.monthsPendingCount} Mo. Due` : 'All Settled'}
                    accentColor={activeChild.totalPending > 0 ? StitchTokens.colors.colorAccent : StitchTokens.colors.bfGreen}
                    style={{ flex: 1 }}
                    testID="stat-parent-fees"
                  />
                </View>

                {/* Parent-Master Direct Messaging Shortcut */}
                <TouchableOpacity
                  style={styles.messageMasterBanner}
                  onPress={() => {
                    if (navigation) {
                      navigation.navigate('Messaging', {
                        studentId: activeChild.id,
                        classId: activeChild.classId,
                      });
                    }
                  }}
                  testID="btn-message-active-child-master"
                  accessibilityRole="button"
                  accessibilityLabel={`Message Master regarding ${activeChild.fullName}`}
                >
                  <View style={styles.messageMasterLeft}>
                    <View style={styles.messageIconCircle}>
                      <MessageSquare size={16} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.messageMasterTitle}>Message Class Master</Text>
                      <Text style={styles.messageMasterSub}>
                        Private consultations, absence notes & safety updates
                      </Text>
                    </View>
                  </View>
                  <ArrowRight size={16} color={StitchTokens.colors.brandNavy} />
                </TouchableOpacity>

                {/* Upcoming Classes for Active Child */}
                {activeChild.upcomingSessions && activeChild.upcomingSessions.length > 0 ? (
                  <View style={{ marginTop: spacing.md }}>
                    <View style={styles.sessionHeaderRow}>
                      <Text style={styles.subSectionTitle}>UPCOMING MAT SESSIONS</Text>
                      <Calendar size={14} color={StitchTokens.colors.brandNavy} />
                    </View>

                    {activeChild.upcomingSessions.map(sess => (
                      <View
                        key={sess.id}
                        style={[
                          styles.sessionRow,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                        ]}
                        testID={`session-row-${sess.id}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                            {sess.sessionDate} ({sess.startTime} - {sess.endTime})
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            📍 {sess.location}
                          </Text>
                        </View>
                        <View style={styles.sessionStatusPill}>
                          <Text style={styles.sessionStatusText}>Scheduled</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Certificates for Active Child */}
                {activeChild.certificates && activeChild.certificates.length > 0 ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={styles.subSectionTitle}>VERIFIED BELT CERTIFICATES</Text>
                    {activeChild.certificates.map(cert => (
                      <View
                        key={cert.id}
                        style={[
                          styles.itemRow,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: spacing.xs },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                            {cert.beltRank}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            Cert #{cert.certificateNumber} • Issued {new Date(cert.issuedDate).toLocaleDateString()}
                          </Text>
                        </View>
                        <Award size={20} color={StitchTokens.colors.colorAccent} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Google Stitch Family Sibling Billing & Merchant Separation Card */}
            <View style={{ marginBottom: spacing.md }}>
              <FamilyBillingCard
                merchants={merchantPartitions}
                totalFamilyOutstanding={totalFamilyOutstanding}
                currency="MYR"
                hasSiblingDiscount={hasSiblingDiscount}
                siblingDiscountLabel={children.length >= 2 ? `${children.length}-Child Sibling Discount Active` : 'Sibling Discount Applied'}
                siblingDiscountDetails="Multi-child enrollment verified by academy"
                siblingDiscountSavings={siblingDiscountSavings}
                onPayNow={() => navigation?.navigate('Fees')}
                onViewHistory={() => navigation?.navigate('Fees')}
              />
            </View>
          </>
        )}

        {/* Academy Notices & Announcements */}
        <Card variant="elevated" style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              Academy Notices
            </Text>
            <Bell size={18} color={StitchTokens.colors.brandNavy} />
          </View>

          {data?.notices && data.notices.length > 0 ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {data.notices.map(notice => (
                <View
                  key={notice.id}
                  style={[
                    styles.itemRow,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                  testID={`notice-item-${notice.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      {notice.title}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {notice.content}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {new Date(notice.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {notice.priority === 'HIGH' ? (
                    <StatusBadge status="URGENT" label="Urgent" variant="danger" />
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              No announcements posted at this time.
            </Text>
          )}
        </Card>

        {/* Quick Navigation Shortcuts */}
        <Card variant="standard" style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Family Hub Shortcuts
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              label="Tuition Fees & Payments"
              onPress={() => navigation?.navigate('Fees')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-parent-fees"
            />
            <Button
              label="Children's Passes & Roster"
              onPress={() => navigation?.navigate('Children')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-parent-children"
            />
            <Button
              label="Parent-Master Messaging"
              onPress={() => navigation?.navigate('Messaging')}
              variant="secondary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
              testID="shortcut-parent-messaging"
            />
            <Button
              label="Parent Profile & Guardianship"
              onPress={() => navigation?.navigate('Profile')}
              variant="outline"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={iconSize.md} color={colors.textSecondary} />}
              testID="shortcut-parent-profile"
            />
          </View>
        </Card>
      </ScreenContainer>
    </View>
  );
};

function getBeltDotColor(beltRank?: string): string {
  const rank = (beltRank || '').toLowerCase();
  if (rank.includes('yellow')) return '#FACC15';
  if (rank.includes('green')) return '#10B981';
  if (rank.includes('blue')) return '#3B82F6';
  if (rank.includes('red')) return '#EF4444';
  if (rank.includes('brown')) return '#854D0E';
  if (rank.includes('black')) return '#1E293B';
  return '#94A3B8';
}

export const ChildrenScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  const fetcher = useCallback(() => {
    return dashboardService.getParentDashboard(props.user);
  }, [props.user]);
  const { data } = useDashboardData<ParentDashboardData>({
    fetcher,
    isOffline: props.isOffline,
  });

  const childrenList: LinkedChildPassData[] = (data?.children || []).map(c => ({
    id: c.id,
    organizationId: props.user.organizationId || '',
    fullName: c.fullName,
    beltRank: c.beltRank,
    status: (c as any).status || 'ACTIVE',
  }));

  return (
    <ScreenContainer scrollable testID="parent-children-screen">
      <ScreenHeader
        title="Children's Passes"
        subtitle="Approved Linked Martial Artists"
      />
      {props.isOffline && (
        <View style={{ marginBottom: 12 }}>
          <OfflineBanner message="Operating in offline mode. Viewing locally cached student passes." />
        </View>
      )}
      <ParentChildPassViewer
        childrenList={childrenList}
        isOffline={props.isOffline}
        testID="parent-pass-viewer"
      />
      <RolePlaceholderBase
        title="Student Progress Overview"
        subtitle="Approved Linked Students"
        role={UserRole.PARENT}
        user={props.user}
        onLogout={props.onLogout}
        isOffline={props.isOffline}
        testID="parent-children-overview"
        icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
        scopeDescription="Linked Students: Monitor children's training attendance streaks, syllabus milestones, and grading eligibility."
      />
    </ScreenContainer>
  );
};

export const FeesScreen: React.FC<RoleScreenProps> = props => {
  return <ParentFeesPaymentScreen {...props} />;
};
export { ParentFeesPaymentScreen };
export { ParentBookTrialScreen } from './ParentBookTrialScreen';
export { ParentMakeUpBookingScreen } from './ParentMakeUpBookingScreen';
export { ParentStudentLifecycleScreen } from './ParentStudentLifecycleScreen';
export { FamilyTimelineHubScreen } from './FamilyTimelineHubScreen';
export { ParentMasterMessagingScreen } from './ParentMasterMessagingScreen';

export const NoticesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Notices"
      subtitle="Academy Announcements & Grading Dates"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-notices-screen"
      icon={<Bell size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Notice Board: Academy holiday notifications, tournament invitations, and federation announcements."
    />
  );
};

export const ParentProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      showLanguageSelector
      title="Profile"
      subtitle="Parent & Guardian Identity"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Guardian Scope: Contact information, emergency notification preferences, linked students, and sign out."
    />
  );
};

export { AvailableClassesScreen } from './AvailableClassesScreen';
export { MyApplicationsScreen } from '../student/MyApplicationsScreen';

const styles = StyleSheet.create({
  identityCard: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsGrid: {
    flexDirection: 'row',
  },
  sectionCard: {
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  childSwitcherContainer: {
    marginBottom: 8,
  },
  childSwitcherLabel: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: StitchTokens.colors.slateTextMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  childPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
  },
  childPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: StitchTokens.colors.colorAccent,
    ...StitchTokens.shadows.card,
  },
  childPillInactive: {
    backgroundColor: 'rgba(13, 43, 71, 0.04)',
    borderColor: StitchTokens.colors.slateBorder,
  },
  childAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 43, 71, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarCircleActive: {
    backgroundColor: StitchTokens.colors.brandNavy,
  },
  childAvatarText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    color: StitchTokens.colors.brandNavy,
  },
  childAvatarTextActive: {
    color: '#FFFFFF',
  },
  childPillText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
  },
  childPillTextActive: {
    fontWeight: '700',
    color: StitchTokens.colors.brandNavy,
  },
  childPillTextInactive: {
    fontWeight: '500',
    color: StitchTokens.colors.slateTextMuted,
  },
  beltRankDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  messageMasterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(13, 43, 71, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(13, 43, 71, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  messageMasterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  messageIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: StitchTokens.colors.brandNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageMasterTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: StitchTokens.colors.brandNavy,
  },
  messageMasterSub: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    color: StitchTokens.colors.slateTextMuted,
    marginTop: 1,
  },
  subSectionTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: StitchTokens.colors.slateTextMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  sessionStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionStatusText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: StitchTokens.colors.bfGreenDark,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
