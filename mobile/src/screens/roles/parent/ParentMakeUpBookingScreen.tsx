import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import {
  Clock,
  XCircle,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandColors } from '../../../theme/colors';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, EmptyState } from '../../../components/Feedback';
import {
  bookingsService,
  MakeUpBooking,
  MakeUpRequestInput,
} from '../../../services/bookingsService';

export interface ParentMakeUpBookingScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
  route?: {
    params?: {
      studentId?: string;
      studentName?: string;
      targetSessionId?: string;
      targetClassName?: string;
    };
  };
}

export const ParentMakeUpBookingScreen: React.FC<ParentMakeUpBookingScreenProps> = ({
  user,
  isOffline,
  route,
}) => {
  const initialStudentId = route?.params?.studentId || '';
  const initialSessionId = route?.params?.targetSessionId || '';

  const [studentId, setStudentId] = useState<string>(initialStudentId);
  const [targetSessionId, setTargetSessionId] = useState<string>(initialSessionId);
  const [reason, setReason] = useState<string>('Missed regular class due to illness/family event');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [myBookings, setMyBookings] = useState<MakeUpBooking[]>([]);

  const loadStudentBookings = useCallback(async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const bookings = await bookingsService.getStudentMakeUps(studentId);
      setMyBookings(bookings);
    } catch (err: any) {
      console.warn('Failed to load student make-up bookings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;
    bookingsService.getStudentMakeUps(studentId)
      .then((bookings) => {
        if (!isMounted) return;
        setMyBookings(bookings);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.warn('Failed to load student make-up bookings:', err);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentBookings();
  };

  const handleRequestBooking = async () => {
    if (!studentId.trim()) {
      Alert.alert('Required Field', 'Please provide or select a student ID.');
      return;
    }
    if (!targetSessionId.trim()) {
      Alert.alert('Required Field', 'Please provide the Target Session ID.');
      return;
    }

    try {
      setSubmitting(true);
      const input: MakeUpRequestInput = {
        studentId: studentId.trim(),
        targetSessionId: targetSessionId.trim(),
        reason: reason.trim(),
      };

      const booking = await bookingsService.requestMakeUp(input);

      if (booking.status === 'CONFIRMED') {
        Alert.alert(
          'Make-Up Confirmed!',
          'Your place has been confirmed for this session. Primary class enrollment remains unchanged.'
        );
      } else if (booking.status === 'WAITLISTED') {
        Alert.alert(
          'Placed on Waitlist',
          `This session is currently at capacity. Your child is at Waitlist position #${booking.waitlist_position}. You will be auto-promoted when a place is released.`
        );
      } else {
        Alert.alert(
          'Request Submitted',
          `Your make-up request is now ${booking.status}. The Master will review capacity.`
        );
      }

      loadStudentBookings();
    } catch (err: any) {
      Alert.alert('Booking Error', err?.message || 'Failed to submit make-up booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (booking: MakeUpBooking) => {
    Alert.alert(
      'Cancel Make-Up',
      'Are you sure you want to cancel this make-up booking? If you hold a place, it will be immediately released to the next family on the waitlist.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingsService.cancelMakeUp(booking.id, 'Cancelled by Parent/Family');
              Alert.alert('Cancelled', 'Make-up place has been released.');
              loadStudentBookings();
            } catch (err: any) {
              Alert.alert('Cancellation Error', err?.message || 'Could not cancel booking.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer testID="parent-makeup-booking-screen">
      <ScreenHeader
        title="Make-Up Classes"
        subtitle="Request alternate training sessions for missed classes"
      />

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.navy]} />
        }
      >
        {/* Governance Notice Banner */}
        <Card style={styles.governanceBanner}>
          <ShieldCheck size={20} color={BrandColors.navy} />
          <View style={styles.governanceTextContainer}>
            <Text style={styles.governanceTitle}>Session-Only Entitlement</Text>
            <Text style={styles.governanceBody}>
              Make-up bookings apply solely to the specific date/session. Your child&apos;s official class,
              assigned Master, and primary enrollment remain completely unchanged.
            </Text>
          </View>
        </Card>

        {/* Booking Form Card */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Request a Make-Up Place</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Student ID</Text>
            <TextInput
              style={styles.input}
              value={studentId}
              onChangeText={setStudentId}
              placeholder="e.g. stu_12345"
              autoCapitalize="none"
              testID="student-id-input"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Target Session ID</Text>
            <TextInput
              style={styles.input}
              value={targetSessionId}
              onChangeText={setTargetSessionId}
              placeholder="e.g. sess_67890"
              autoCapitalize="none"
              testID="session-id-input"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reason / Absence Note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for make-up class..."
              multiline
              numberOfLines={3}
              testID="reason-input"
            />
          </View>

          <Button
            label={submitting ? 'Submitting...' : 'Submit Make-Up Request'}
            onPress={handleRequestBooking}
            disabled={isOffline || submitting}
            testID="submit-makeup-btn"
            variant="primary"
            style={styles.submitBtn}
          />
        </Card>

        {/* Active Bookings Section */}
        <View style={styles.historySection} testID="active-bookings-list">
          <Text style={styles.historySectionTitle}>Current Make-Up Bookings</Text>

          {loading ? (
            <LoadingState message="Fetching active bookings..." />
          ) : myBookings.length === 0 ? (
            <EmptyState
              title="No Active Make-Ups"
              description="No make-up bookings found for this student. Use the form above to request a place."
            />
          ) : (
            myBookings.map((b) => {
              const isConfirmed = b.status === 'CONFIRMED' || b.status === 'ATTENDED';
              const isWaitlisted = b.status === 'WAITLISTED';

              return (
                <Card key={b.id} style={styles.bookingItemCard} testID={`booking-card-${b.id}`}>
                  <View style={styles.cardHeader}>
                    <View style={styles.bookingClassInfo}>
                      <Text style={styles.className}>
                        {b.target_class_name || 'Make-Up Session'}
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {b.session_date} ({b.day_of_week || 'Scheduled'}) • {b.start_time} - {b.end_time}
                      </Text>
                      <Text style={styles.locationText}>{b.location || 'Gelanggang'}</Text>
                    </View>
                    <StatusBadge
                      status={
                        isConfirmed
                          ? 'ACTIVE'
                          : isWaitlisted
                          ? 'PENDING'
                          : 'INACTIVE'
                      }
                      label={
                        isWaitlisted
                          ? `Waitlist #${b.waitlist_position}`
                          : b.status
                      }
                    />
                  </View>

                  {isWaitlisted && (
                    <View style={styles.waitlistCardNotice}>
                      <Clock size={14} color={BrandColors.amber} />
                      <Text style={styles.waitlistNoticeText}>
                        You are position #{b.waitlist_position}. The system will automatically offer you a place if a seat becomes available.
                      </Text>
                    </View>
                  )}

                  {b.status !== 'CANCELLED' && b.status !== 'ATTENDED' && (
                    <TouchableOpacity
                      style={styles.cancelLink}
                      onPress={() => handleCancelBooking(b)}
                      testID={`cancel-booking-btn-${b.id}`}
                    >
                      <XCircle size={14} color={BrandColors.danger} />
                      <Text style={[styles.cancelLinkText, { color: BrandColors.danger }]}>
                        Cancel / Release Place
                      </Text>
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  governanceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F1F8',
    borderColor: BrandColors.navy,
    borderWidth: 1,
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    gap: 12,
  },
  governanceTextContainer: {
    flex: 1,
  },
  governanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BrandColors.navy,
    marginBottom: 4,
  },
  governanceBody: {
    fontSize: 12,
    color: BrandColors.navyDark,
    lineHeight: 18,
  },
  formCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.navyDark,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
    color: '#111111',
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 8,
  },
  historySection: {
    marginBottom: 32,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.navyDark,
    marginBottom: 12,
  },
  bookingItemCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingClassInfo: {
    flex: 1,
    marginRight: 8,
  },
  className: {
    fontSize: 15,
    fontWeight: '700',
    color: BrandColors.navyDark,
  },
  sessionMeta: {
    fontSize: 13,
    color: '#555555',
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  waitlistCardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF9E6',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  waitlistNoticeText: {
    fontSize: 12,
    color: '#8A5800',
    flex: 1,
  },
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
