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
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  ShieldAlert,
  Search,
  Filter,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { apiClient } from '../../../services/apiClient';
import {
  gradingService,
  GradingEvent,
} from '../../../services/gradingService';

export interface AdminGradingScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const AdminGradingScreen: React.FC<AdminGradingScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius, belts } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<GradingEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEventDetails, setSelectedEventDetails] = useState<any | null>(null);

  // New Event Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('2026-06-15');
  const [newLocation, setNewLocation] = useState('Academy Grand Dojo');
  const [newFee, setNewFee] = useState('60');
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Finalization State
  const [finalizing, setFinalizing] = useState(false);
  const [candidateResults, setCandidateResults] = useState<Record<string, { result: 'Passed' | 'Failed' | 'Double Promotion'; score: number }>>({});

  // Revocation State
  const [revokingCertId, setRevokingCertId] = useState<string | null>(null);
  const [revocationReason, setRevocationReason] = useState('');

  const loadEvents = useCallback(async () => {
    try {
      const orgId = user.organizationId;
      if (!orgId) return;

      const evList = await gradingService.getGradingEvents(orgId);
      setEvents(evList);

      if (evList.length > 0 && !selectedEventId) {
        setSelectedEventId(evList[0].id);
      }
    } catch (err: any) {
      console.error('[AdminGrading load error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.organizationId, selectedEventId]);

  const loadEventDetails = useCallback(async (eventId: string) => {
    if (!eventId) return;
    try {
      const details = await gradingService.getGradingEvent(eventId);
      setSelectedEventDetails(details);

      // Initialize candidate scores
      const initialMap: Record<string, any> = {};
      (details.candidates || []).forEach((c: any) => {
        initialMap[c.student_id] = {
          result: c.result === 'Passed' || c.result === 'Double Promotion' ? c.result : 'Passed',
          score: c.examiner_score || 85,
        };
      });
      setCandidateResults(initialMap);
    } catch (err: any) {
      console.error('[Event details error]', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await loadEvents();
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [loadEvents]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted && selectedEventId) {
        await loadEventDetails(selectedEventId);
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [selectedEventId, loadEventDetails]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    if (selectedEventId) {
      await loadEventDetails(selectedEventId);
    }
  };

  const handleCreateEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a title for the grading event.');
      return;
    }
    setCreatingEvent(true);
    try {
      const created = await gradingService.createGradingEvent({
        organizationId: user.organizationId!,
        title: newTitle.trim(),
        eventDate: newDate,
        location: newLocation,
        fee: parseFloat(newFee) || 0,
        status: 'REGISTRATION_OPEN',
      });
      Alert.alert('Success', 'Grading event created successfully.');
      setShowCreateModal(false);
      setNewTitle('');
      await loadEvents();
      setSelectedEventId(created.event.id);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create grading event.');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleFinalizeGrading = async () => {
    if (!selectedEventDetails?.event) return;
    const candidates = selectedEventDetails.candidates || [];
    if (candidates.length === 0) {
      Alert.alert('No Candidates', 'Cannot finalize an event without registered candidates.');
      return;
    }

    setFinalizing(true);
    try {
      const resultsPayload = candidates.map((cand: any) => {
        const entry = candidateResults[cand.student_id] || { result: 'Passed', score: 85 };
        return {
          studentId: cand.student_id,
          result: entry.result,
          targetBelt: cand.target_belt || 'Yellow Belt',
          examinerScore: entry.score,
          criteriaScores: { technique: entry.score, accuracy: entry.score },
          notes: `Official promotion examination results confirmed by Admin.`,
        };
      });

      const res = await gradingService.finalizeGrading(
        selectedEventDetails.event.id,
        selectedEventDetails.event.version || 1,
        resultsPayload
      );

      Alert.alert(
        'Grading Finalized',
        `Atomic transaction completed. ${res.issuedCertificates?.length || 0} certificates issued.`
      );
      await loadEvents();
      await loadEventDetails(selectedEventDetails.event.id);
    } catch (err: any) {
      Alert.alert('Finalization Error', err?.message || 'Failed to finalize grading results.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleRevokeCertificate = async (certId: string) => {
    if (!revocationReason.trim()) {
      Alert.alert('Reason Required', 'Please provide an official audit reason for revocation.');
      return;
    }
    try {
      await gradingService.revokeCertificate(certId, revocationReason.trim());
      Alert.alert('Revoked', 'Certificate revoked and audit log generated.');
      setRevokingCertId(null);
      setRevocationReason('');
      if (selectedEventId) {
        await loadEventDetails(selectedEventId);
      }
    } catch (err: any) {
      Alert.alert('Revocation Error', err?.message || 'Failed to revoke certificate.');
    }
  };

  if (loading && !refreshing) {
    return (
      <ScreenContainer scrollable testID="admin-grading-screen">
        <ScreenHeader title="Belt Grading Management" subtitle="Academy examination administration" />
        <LoadingState message="Loading examination records..." />
      </ScreenContainer>
    );
  }

  const activeEvent: GradingEvent | undefined =
    selectedEventDetails?.event || events.find((e) => e.id === selectedEventId);
  const candidates: any[] = selectedEventDetails?.candidates || [];
  const isFinalized = activeEvent?.status === 'FINALIZED';

  return (
    <ScreenContainer
      scrollable
      testID="admin-grading-screen"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ScreenHeader
        title="Grading Administration"
        subtitle="Manage official examinations, approvals & certificates"
        testID="admin-grading-header"
      />

      {/* Events Selector & Create Action */}
      <Card variant="standard" style={[styles.selectorCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <View style={styles.rowBetween}>
          <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
            GRADING EXAMINATION EVENTS
          </Text>
          <Button
            label="New Event"
            onPress={() => setShowCreateModal(!showCreateModal)}
            variant="outline"
            size="sm"
            leftIcon={<Plus size={16} color={colors.buttonPrimaryBg} />}
            testID="btn-open-create-event"
          />
        </View>

        {showCreateModal ? (
          <View style={[styles.createModal, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: 8, fontWeight: '700' }]}>
              Schedule New Examination
            </Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Summer 2026 Belt Examination"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, marginBottom: 8 }]}
              testID="input-event-title"
            />
            <TextInput
              value={newLocation}
              onChangeText={setNewLocation}
              placeholder="Dojo Location"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, marginBottom: 8 }]}
              testID="input-event-location"
            />
            <TextInput
              value={newFee}
              onChangeText={setNewFee}
              placeholder="Fee in RM (e.g. 60)"
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, marginBottom: 12 }]}
              testID="input-event-fee"
            />
            <Button
              label="Publish Examination"
              onPress={handleCreateEvent}
              loading={creatingEvent}
              variant="primary"
              size="md"
              testID="btn-submit-create-event"
            />
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, marginTop: 8 }}>
          {events.map((ev) => {
            const isSel = selectedEventId === ev.id;
            return (
              <TouchableOpacity
                key={ev.id}
                onPress={() => setSelectedEventId(ev.id)}
                style={[
                  styles.eventPill,
                  {
                    backgroundColor: isSel ? colors.buttonPrimaryBg : colors.surfaceElevated,
                    borderColor: isSel ? colors.buttonPrimaryBg : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                testID={`event-pill-${ev.id}`}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: isSel ? colors.buttonPrimaryText : colors.textPrimary, fontWeight: '700' },
                  ]}
                >
                  {ev.title} ({ev.status})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Card>

      {/* Selected Event Details Card */}
      {activeEvent ? (
        <View style={{ gap: spacing.md }}>
          <Card variant="elevated" style={[styles.eventDetailCard, { borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>OFFICIAL EXAMINATION</Text>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 2 }]}>
                  {activeEvent.title}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  Date: {activeEvent.event_date} • {activeEvent.location || 'Dojo'} • Fee: RM {activeEvent.fee || 0}
                </Text>
              </View>
              <StatusBadge status={activeEvent.status} label={activeEvent.status} variant={isFinalized ? 'success' : 'warning'} />
            </View>

            {isFinalized ? (
              <View style={[styles.finalizedNotice, { backgroundColor: colors.badgeSuccessBg, marginTop: spacing.md }]}>
                <CheckCircle2 size={18} color={colors.badgeSuccessText} style={{ marginRight: 8 }} />
                <Text style={[typography.caption, { color: colors.badgeSuccessText, fontWeight: '700' }]}>
                  Results finalized and signed in PostgreSQL ledger.
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Candidates & Scoring Table */}
          <Card variant="standard" style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                Registered Candidates ({candidates.length})
              </Text>
              <Award size={20} color={colors.buttonPrimaryBg} />
            </View>

            {candidates.length === 0 ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                No candidates nominated for this examination yet.
              </Text>
            ) : (
              <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                {candidates.map((cand) => {
                  const entry = candidateResults[cand.student_id] || { result: 'Passed', score: 85 };
                  return (
                    <View
                      key={cand.id}
                      style={[
                        styles.candidateRow,
                        { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                      ]}
                      testID={`candidate-row-${cand.student_id}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                          {cand.student_name}
                        </Text>
                        <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2 }]}>
                          Current: {cand.current_belt || 'White'} → Target: {cand.target_belt}
                        </Text>
                        {cand.certificate_id ? (
                          <Text style={[typography.caption, { color: colors.badgeSuccessText, marginTop: 2 }]}>
                            Cert ID: {cand.certificate_id}
                          </Text>
                        ) : null}
                      </View>

                      {/* Result toggles for unfinalized event */}
                      {!isFinalized ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {(['Passed', 'Failed', 'Double Promotion'] as const).map((r) => {
                            const isChosen = entry.result === r;
                            return (
                              <TouchableOpacity
                                key={r}
                                onPress={() =>
                                  setCandidateResults((prev) => ({
                                    ...prev,
                                    [cand.student_id]: { ...entry, result: r },
                                  }))
                                }
                                style={[
                                  styles.resultToggle,
                                  {
                                    backgroundColor: isChosen ? (r === 'Passed' || r === 'Double Promotion' ? colors.buttonPrimaryBg : colors.badgeDangerText) : colors.surface,
                                    borderColor: colors.border,
                                  },
                                ]}
                                testID={`toggle-${cand.student_id}-${r.toLowerCase()}`}
                              >
                                <Text
                                  style={[
                                    typography.caption,
                                    { color: isChosen ? colors.buttonPrimaryText : colors.textPrimary, fontWeight: '700' },
                                  ]}
                                >
                                  {r === 'Double Promotion' ? '2x' : r}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <StatusBadge
                          status={cand.result || 'Passed'}
                          label={cand.result || 'Passed'}
                          variant={cand.result === 'Failed' ? 'danger' : 'success'}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Atomic Finalization Button */}
            {!isFinalized && candidates.length > 0 ? (
              <View style={{ marginTop: spacing.lg }}>
                <Button
                  label="Finalize Official Grading Results"
                  onPress={handleFinalizeGrading}
                  loading={finalizing}
                  variant="primary"
                  size="md"
                  fullWidth
                  testID="btn-finalize-grading"
                />
              </View>
            ) : null}
          </Card>
        </View>
      ) : (
        <EmptyState
          title="No Event Selected"
          description="Create or select a grading examination above."
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  selectorCard: {
    padding: 14,
  },
  createModal: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 10,
  },
  eventPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  card: {
    padding: 18,
  },
  eventDetailCard: {
    padding: 18,
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  candidateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultToggle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  finalizedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
});
