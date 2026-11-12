import React, { useState, useEffect, useCallback } from 'react';
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
  Users,
  Calendar,
  Clock,
  AlertCircle,
  XCircle,
  UserCheck,
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
  bookingsService,
  MakeUpBooking,
  SessionBookingsResponse,
} from '../../../services/bookingsService';
import { useI18n } from '../../../i18n';

export interface MasterMakeUpManagementScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
  route?: {
    params?: {
      sessionId?: string;
      classId?: string;
    };
  };
}

type FilterTab = 'ALL' | 'REQUESTED' | 'WAITLISTED' | 'CONFIRMED';

export const MasterMakeUpManagementScreen: React.FC<MasterMakeUpManagementScreenProps> = ({
  user,
  isOffline,
  route,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = route?.params?.sessionId || 'sess_default';

  const [sessionData, setSessionData] = useState<SessionBookingsResponse | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadSessionBookings = useCallback(async () => {
    try {
      setError(null);
      const data = await bookingsService.getSessionBookings(sessionId);
      setSessionData(data);
    } catch (err: any) {
      console.warn('Failed to load session make-up bookings:', err);
      setError(err?.message || t('masterHandover.mu.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    let isMounted = true;
    bookingsService.getSessionBookings(sessionId)
      .then((data) => {
        if (!isMounted) return;
        setSessionData(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.warn('Failed to load session make-up bookings:', err);
        setError(err?.message || t('masterHandover.mu.loadError'));
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [sessionId, t]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSessionBookings();
  };

  const handleApprove = async (booking: MakeUpBooking) => {
    try {
      setActionInProgress(booking.id);
      await bookingsService.approveMakeUp(booking.id, booking.version);
      Alert.alert(t('masterHandover.mu.approvedTitle'), t('masterHandover.mu.approvedMessage', { name: booking.student_name || t('masterHandover.mu.candidateFallback') }));
      loadSessionBookings();
    } catch (err: any) {
      Alert.alert(t('masterHandover.mu.approvalErrorTitle'), err?.message || t('masterHandover.mu.approveFailed'));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancel = async (booking: MakeUpBooking) => {
    Alert.alert(
      t('masterHandover.mu.cancelTitle'),
      t('masterHandover.mu.cancelMessage', { name: booking.student_name || t('masterHandover.mu.studentFallback') }),
      [
        { text: t('masterHandover.mu.back'), style: 'cancel' },
        {
          text: t('masterHandover.mu.cancelBooking'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionInProgress(booking.id);
              await bookingsService.cancelMakeUp(booking.id, 'Declined by Master');
              Alert.alert(t('masterHandover.mu.cancelledTitle'), t('masterHandover.mu.cancelledMessage'));
              loadSessionBookings();
            } catch (err: any) {
              Alert.alert(t('masterHandover.mu.cancelErrorTitle'), err?.message || t('masterHandover.mu.cancelFailed'));
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handlePromoteWaitlist = async () => {
    try {
      setActionInProgress('PROMOTE_ALL');
      const res = await bookingsService.promoteWaitlist(sessionId);
      if (res.promotedCount > 0) {
        Alert.alert(t('masterHandover.mu.promotedTitle'), t('masterHandover.mu.promotedMessage', { count: res.promotedCount }));
      } else {
        Alert.alert(t('masterHandover.mu.noPromotionTitle'), res.message || t('masterHandover.mu.noPromotionMessage'));
      }
      loadSessionBookings();
    } catch (err: any) {
      Alert.alert(t('masterHandover.mu.promotionErrorTitle'), err?.message || t('masterHandover.mu.promoteFailed'));
    } finally {
      setActionInProgress(null);
    }
  };

  const allBookings = sessionData?.bookings || [];
  const filteredBookings = allBookings.filter((b) => {
    if (activeTab === 'ALL') return true;
    return b.status === activeTab;
  });

  const confirmedCount = sessionData?.confirmedCount ?? 0;
  const waitlistCount = sessionData?.waitlistCount ?? 0;
  const remainingPlaces = sessionData?.capacity?.availableMakeUpPlaces ?? 0;
  const maxCapacity = sessionData?.capacity?.maxCapacity ?? 0;

  return (
    <ScreenContainer testID="master-makeup-screen">
      <ScreenHeader
        title={t('masterHandover.mu.title')}
        subtitle={
          sessionData?.session
            ? `${sessionData.session.class_name} • ${sessionData.session.session_date} (${sessionData.session.start_time})`
            : t('masterHandover.mu.defaultSubtitle')
        }
      />

      {isOffline && (
        <Card style={[styles.offlineBanner, { backgroundColor: BrandColors.amber + '20', borderColor: BrandColors.amber }]}>
          <AlertCircle size={18} color={BrandColors.amber} />
          <Text style={[styles.offlineText, { color: BrandColors.amber }]}>
            {t('masterHandover.mu.offline')}
          </Text>
        </Card>
      )}

      {loading ? (
        <LoadingState message={t('masterHandover.mu.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSessionBookings} />
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.navy]} />
          }
        >
          {/* Capacity Stats */}
          <View style={styles.statsRow}>
            <StatCard
              title={t('masterHandover.mu.capacity')}
              value={`${confirmedCount}/${maxCapacity}`}
              subtitle={t('masterHandover.mu.placesLeft', { count: remainingPlaces })}
              icon={<Users size={20} color={BrandColors.navy} />}
              style={styles.statBox}
            />
            <StatCard
              title={t('masterHandover.mu.waitlist')}
              value={waitlistCount}
              subtitle={t('masterHandover.mu.fifoQueue')}
              icon={<Clock size={20} color={BrandColors.amber} />}
              style={styles.statBox}
            />
          </View>

          {/* Waitlist Promotion Banner if seats exist */}
          {remainingPlaces > 0 && waitlistCount > 0 && (
            <Card style={styles.promoteBanner} testID="waitlist-promote-banner">
              <View style={styles.promoteBannerHeader}>
                <AlertCircle size={20} color={BrandColors.amber} />
                <Text style={styles.promoteBannerTitle}>{t('masterHandover.mu.availablePlaces', { count: remainingPlaces })}</Text>
              </View>
              <Text style={styles.promoteBannerText}>
                {t('masterHandover.mu.openPlaces', { count: waitlistCount })}
              </Text>
              <Button
                label={actionInProgress === 'PROMOTE_ALL' ? t('masterHandover.mu.promoting') : t('masterHandover.mu.promoteNext')}
                onPress={handlePromoteWaitlist}
                disabled={isOffline || !!actionInProgress}
                testID="promote-waitlist-btn"
                variant="primary"
                style={styles.promoteBtn}
              />
            </Card>
          )}

          {/* Filter Tabs */}
          <View style={styles.tabsContainer}>
            {(['ALL', 'REQUESTED', 'WAITLISTED', 'CONFIRMED'] as FilterTab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabButton,
                    isActive && { backgroundColor: BrandColors.navy, borderColor: BrandColors.navy },
                  ]}
                  testID={`filter-tab-${tab}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab === 'ALL'
                      ? t('masterHandover.mu.tabAll', { count: allBookings.length })
                      : tab === 'REQUESTED'
                      ? t('masterHandover.mu.tabRequested')
                      : tab === 'WAITLISTED'
                      ? t('masterHandover.mu.tabWaitlist', { count: waitlistCount })
                      : t('masterHandover.mu.tabConfirmed', { count: confirmedCount })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* List of Bookings */}
          {filteredBookings.length === 0 ? (
            <EmptyState
              title={t('masterHandover.mu.noBookings')}
              description={t('masterHandover.mu.noBookingsDesc', { tab: t(`masterHandover.mu.filter.${activeTab}`) })}
            />
          ) : (
            filteredBookings.map((booking) => {
              const isConfirmed = booking.status === 'CONFIRMED' || booking.status === 'ATTENDED';
              const isWaitlisted = booking.status === 'WAITLISTED';
              const isRequested = booking.status === 'REQUESTED';
              const isOffered = booking.status === 'OFFERED';
              const isBusy = actionInProgress === booking.id;

              return (
                <Card
                  key={booking.id}
                  style={styles.bookingCard}
                  testID={`booking-item-${booking.id}`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>
                        {booking.student_name || t('masterHandover.common.studentCandidate')}
                      </Text>
                      <Text style={styles.studentRank}>
                        {t('masterHandover.mu.fromClass', {
                          belt: booking.belt_rank || t('masterHandover.common.whiteBelt'),
                          className: booking.original_class_name || t('masterHandover.mu.homeClass'),
                        })}
                      </Text>
                    </View>
                    <StatusBadge
                      status={
                        isConfirmed
                          ? 'ACTIVE'
                          : isWaitlisted
                          ? 'PENDING'
                          : isOffered
                          ? 'UPCOMING'
                          : 'INACTIVE'
                      }
                      label={
                        isWaitlisted
                          ? t('masterHandover.mu.waitlistPosition', { position: booking.waitlist_position || 1 })
                          : booking.status
                      }
                    />
                  </View>

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <Calendar size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {t('masterHandover.mu.session', { date: booking.session_date ?? '', day: booking.day_of_week || t('masterHandover.mu.dayFallback') })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {t('masterHandover.mu.time', {
                          start: booking.start_time ?? '',
                          end: booking.end_time ?? '',
                          location: booking.location || t('masterHandover.mu.locationFallback'),
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Actions Bar */}
                  <View style={styles.actionsRow}>
                    {(isRequested || isOffered) && (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.approveBtn,
                          (isOffline || isBusy) && styles.disabledBtn,
                        ]}
                        onPress={() => handleApprove(booking)}
                        disabled={isOffline || isBusy}
                        testID={`approve-btn-${booking.id}`}
                      >
                        <UserCheck size={16} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>
                          {isBusy ? t('masterHandover.common.saving') : t('masterHandover.mu.approveSeat')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {isWaitlisted && (
                      <View style={styles.waitlistInfoBox}>
                        <Clock size={14} color={BrandColors.amber} />
                        <Text style={styles.waitlistInfoText}>
                          {t('masterHandover.mu.positionInfo', { position: booking.waitlist_position ?? '' })}
                        </Text>
                      </View>
                    )}

                    {!booking.cancelled_at && booking.status !== 'CANCELLED' && booking.status !== 'ATTENDED' && (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.cancelBtn,
                          (isOffline || isBusy) && styles.disabledBtn,
                        ]}
                        onPress={() => handleCancel(booking)}
                        disabled={isOffline || isBusy}
                        testID={`cancel-btn-${booking.id}`}
                      >
                        <XCircle size={16} color={BrandColors.danger} />
                        <Text style={[styles.actionBtnText, { color: BrandColors.danger }]}>
                          {t('masterHandover.common.decline')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
  },
  promoteBanner: {
    backgroundColor: '#FFF8E1',
    borderColor: BrandColors.amber,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  promoteBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  promoteBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7B4E00',
  },
  promoteBannerText: {
    fontSize: 13,
    color: '#7B4E00',
    marginBottom: 12,
    lineHeight: 18,
  },
  promoteBtn: {
    alignSelf: 'flex-start',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  bookingCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.navyDark,
  },
  studentRank: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 10,
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: BrandColors.navy,
  },
  cancelBtn: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  waitlistInfoBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF9E6',
    padding: 8,
    borderRadius: 6,
  },
  waitlistInfoText: {
    fontSize: 12,
    color: '#8A5800',
    fontWeight: '500',
  },
});
