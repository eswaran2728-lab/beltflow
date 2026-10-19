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
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  BookOpen,
  Calendar,
  AlertTriangle,
  UserCheck,
  PlusCircle,
  TrendingUp,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../../components/Feedback';
import { apiClient } from '../../../services/apiClient';
import {
  gradingService,
  ReadinessPassport,
  GradingEvent,
} from '../../../services/gradingService';

export interface MasterGradingScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

type GradingTab = 'READINESS' | 'ASSESS' | 'EVENTS';

const ASSESSMENT_CRITERIA_KEYS = [
  { key: 'technique', label: 'Technique' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'power', label: 'Power' },
  { key: 'speed', label: 'Speed' },
  { key: 'balance', label: 'Balance' },
  { key: 'discipline', label: 'Discipline' },
];

export const MasterGradingScreen: React.FC<MasterGradingScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius, belts } = useTheme();

  const [activeTab, setActiveTab] = useState<GradingTab>('READINESS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Master's active students and events
  const [students, setStudents] = useState<any[]>([]);
  const [events, setEvents] = useState<GradingEvent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [readiness, setReadiness] = useState<ReadinessPassport | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // Skill Assessment State
  const [skillName, setSkillName] = useState('Silambam Form 1 (Alangaram)');
  const [skillCategory, setSkillCategory] = useState('Technique');
  const [skillLevel, setSkillLevel] = useState<'Proficient' | 'Mastered' | 'Developing' | 'Needs Work'>('Proficient');
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({
    technique: 5,
    accuracy: 4,
    power: 4,
    speed: 4,
    balance: 5,
    discipline: 5,
  });
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [assessing, setAssessing] = useState(false);
  const [assessmentSuccess, setAssessmentSuccess] = useState<string | null>(null);

  // Nomination State
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [nominating, setNominating] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      setError(null);
      const orgId = user.organizationId;
      if (!orgId) {
        setError('No organization affiliated with Master account.');
        setLoading(false);
        return;
      }

      // Fetch master's students and organization grading events
      const [stuRes, eventsList] = await Promise.all([
        apiClient.get<{ students: any[] }>(`/api/v1/students/organization/${orgId}`).catch(() => ({ students: [] })),
        gradingService.getGradingEvents(orgId).catch(() => []),
      ]);

      const activeStudents = (stuRes.students || []).filter((s: any) => s.status === 'ACTIVE');
      setStudents(activeStudents);
      setEvents(eventsList);

      if (activeStudents.length > 0 && !selectedStudentId) {
        setSelectedStudentId(activeStudents[0].id);
      }
      if (eventsList.length > 0 && !selectedEventId) {
        setSelectedEventId(eventsList[0].id);
      }
    } catch (err: any) {
      console.error('[MasterGrading load error]', err);
      setError(err?.message || 'Failed to load grading records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.organizationId]);

  const loadStudentReadiness = useCallback(async (stuId: string) => {
    if (!stuId) return;
    setReadinessLoading(true);
    try {
      const passport = await gradingService.getReadinessPassport(stuId);
      setReadiness(passport);
    } catch (err: any) {
      console.error('[Readiness passport error]', err);
      setReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await loadInitialData();
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [loadInitialData]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted && selectedStudentId) {
        await loadStudentReadiness(selectedStudentId);
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [selectedStudentId, loadStudentReadiness]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    if (selectedStudentId) {
      await loadStudentReadiness(selectedStudentId);
    }
  };

  const handleRecordAssessment = async () => {
    if (!selectedStudentId) {
      Alert.alert('Selection Required', 'Please select a student to assess.');
      return;
    }
    setAssessing(true);
    setAssessmentSuccess(null);
    try {
      const skillId = `skl_${skillName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      await gradingService.recordSkillAssessment({
        studentId: selectedStudentId,
        skillId,
        skillName,
        category: skillCategory,
        level: skillLevel,
        criteria: criteriaScores,
        notes: assessmentNotes,
      });

      setAssessmentSuccess(`Skill "${skillName}" assessed as ${skillLevel} for student.`);
      setAssessmentNotes('');
      await loadStudentReadiness(selectedStudentId);
    } catch (err: any) {
      Alert.alert('Assessment Error', err?.message || 'Failed to record skill assessment.');
    } finally {
      setAssessing(false);
    }
  };

  const handleNominate = async () => {
    if (!selectedEventId) {
      Alert.alert('Event Required', 'Please select a grading examination event.');
      return;
    }
    if (!selectedStudentId || !readiness?.nextEligibleBelt) {
      Alert.alert('Student Ineligible', 'Student does not have a valid next belt target.');
      return;
    }

    setNominating(true);
    try {
      await gradingService.nominateCandidate(
        selectedEventId,
        selectedStudentId,
        readiness.nextEligibleBelt.name,
        'Master formal nomination based on readiness evaluation.'
      );
      Alert.alert('Success', `Student nominated for ${readiness.nextEligibleBelt.name}.`);
      await loadStudentReadiness(selectedStudentId);
      await loadInitialData();
    } catch (err: any) {
      Alert.alert('Nomination Error', err?.message || 'Could not nominate student.');
    } finally {
      setNominating(false);
    }
  };

  const getEligibilityVariant = (status?: string) => {
    switch (status) {
      case 'APPROVED FOR GRADING':
      case 'COMPLETED':
        return 'success';
      case 'READY FOR REVIEW':
        return 'info';
      case 'IN PROGRESS':
        return 'warning';
      default:
        return 'danger';
    }
  };

  if (loading && !refreshing) {
    return (
      <ScreenContainer scrollable testID="master-grading-screen">
        <ScreenHeader title="Belt Grading & Readiness" subtitle="Student progression and assessments" />
        <LoadingState message="Loading grading dashboard..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scrollable
      testID="master-grading-screen"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ScreenHeader
        title="Belt Grading & Readiness"
        subtitle="Auditable progression & candidate assessments"
        testID="master-grading-header"
      />

      {/* Navigation Tab Bar */}
      <View style={[styles.tabBar, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('READINESS')}
          style={[styles.tabItem, activeTab === 'READINESS' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 3 }]}
          testID="tab-btn-readiness"
        >
          <Text style={[typography.caption, { color: activeTab === 'READINESS' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' }]}>
            READINESS PASSPORT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('ASSESS')}
          style={[styles.tabItem, activeTab === 'ASSESS' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 3 }]}
          testID="tab-btn-assess"
        >
          <Text style={[typography.caption, { color: activeTab === 'ASSESS' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' }]}>
            SKILL ASSESSMENT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('EVENTS')}
          style={[styles.tabItem, activeTab === 'EVENTS' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 3 }]}
          testID="tab-btn-events"
        >
          <Text style={[typography.caption, { color: activeTab === 'EVENTS' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' }]}>
            GRADING EVENTS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Student Selector Card */}
      <Card variant="standard" style={[styles.selectorCard, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 6, fontWeight: '700' }]}>
          SELECT STUDENT
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {students.map((stu) => {
            const isSelected = selectedStudentId === stu.id;
            return (
              <TouchableOpacity
                key={stu.id}
                onPress={() => setSelectedStudentId(stu.id)}
                style={[
                  styles.studentPill,
                  {
                    backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.surfaceElevated,
                    borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                testID={`student-pill-${stu.id}`}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: isSelected ? colors.buttonPrimaryText : colors.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {stu.full_name} ({stu.belt_rank || 'White'})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Card>

      {/* TAB 1: READINESS PASSPORT */}
      {activeTab === 'READINESS' && (
        <View style={{ gap: spacing.md }}>
          {readinessLoading ? (
            <LoadingState message="Calculating readiness passport..." />
          ) : readiness ? (
            <>
              {/* Status Banner */}
              <Card variant="elevated" style={[styles.readinessHeroCard, { borderColor: colors.border }]}>
                <View style={styles.heroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'uppercase' }]}>
                      Progression Passport
                    </Text>
                    <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 2 }]}>
                      {readiness.fullName}
                    </Text>
                  </View>
                  <StatusBadge
                    status={readiness.eligibilityStatus}
                    label={readiness.eligibilityStatus}
                    variant={getEligibilityVariant(readiness.eligibilityStatus)}
                    testID="badge-eligibility-status"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Belt Progression Ranks */}
                <View style={styles.rankProgressionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>CURRENT RANK</Text>
                    <View style={{ marginTop: 6 }}>
                      <BeltBadge beltName={readiness.currentBelt} customBelts={belts} size="md" />
                    </View>
                  </View>

                  <ChevronRight size={24} color={colors.textSecondary} style={{ alignSelf: 'center', marginHorizontal: 8 }} />

                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>NEXT TARGET RANK</Text>
                    <View style={{ marginTop: 6 }}>
                      {readiness.nextEligibleBelt ? (
                        <BeltBadge beltName={readiness.nextEligibleBelt.name} customBelts={belts} size="md" />
                      ) : (
                        <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Master/Final Rank</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Advisory Recommendation */}
                <View style={[styles.recommendationBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Sparkles size={18} color={colors.buttonPrimaryBg} style={{ marginRight: 8 }} />
                  <Text style={[typography.caption, { color: colors.textPrimary, flex: 1 }]}>
                    {readiness.readinessRecommendation}
                  </Text>
                </View>

                {/* Quick Nomination Button if Ready */}
                {readiness.nextEligibleBelt && readiness.eligibilityStatus !== 'APPROVED FOR GRADING' ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Button
                      label={`Nominate for ${readiness.nextEligibleBelt.name}`}
                      onPress={handleNominate}
                      loading={nominating}
                      disabled={nominating || events.length === 0}
                      variant="primary"
                      size="md"
                      fullWidth
                      testID="btn-nominate-candidate"
                    />
                  </View>
                ) : readiness.eligibilityStatus === 'APPROVED FOR GRADING' ? (
                  <View style={[styles.nominatedNotice, { backgroundColor: colors.badgeSuccessBg }]}>
                    <CheckCircle2 size={18} color={colors.badgeSuccessText} style={{ marginRight: 8 }} />
                    <Text style={[typography.caption, { color: colors.badgeSuccessText, fontWeight: '700' }]}>
                      Candidate Nominated for Examination
                    </Text>
                  </View>
                ) : null}
              </Card>

              {/* Requirement Metrics Grid */}
              <View style={[styles.statsGrid, { gap: spacing.sm }]}>
                <StatCard
                  title="Attendance"
                  value={`${readiness.attendance.totalSessions} / ${readiness.attendance.minSessionsRequired}`}
                  subtitle={readiness.attendance.totalSessions >= readiness.attendance.minSessionsRequired ? 'Requirement Met' : 'Sessions Needed'}
                  icon={<CheckCircle2 size={iconSize.md} color={readiness.attendance.totalSessions >= readiness.attendance.minSessionsRequired ? colors.badgeSuccessText : colors.badgeWarningText} />}
                  testID="stat-readiness-attendance"
                />
                <StatCard
                  title="Duration"
                  value={`${readiness.trainingDuration.months} / ${readiness.trainingDuration.minMonthsRequired} Mo`}
                  subtitle={readiness.trainingDuration.months >= readiness.trainingDuration.minMonthsRequired ? 'Time Served' : 'More Practice'}
                  icon={<Clock size={iconSize.md} color={readiness.trainingDuration.months >= readiness.trainingDuration.minMonthsRequired ? colors.badgeSuccessText : colors.badgeWarningText} />}
                  testID="stat-readiness-duration"
                />
              </View>

              {/* Skills Mastered vs Needing Work */}
              <Card variant="standard" style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    Curriculum Skills ({readiness.skills.achievedCount} Achieved)
                  </Text>
                  <BookOpen size={20} color={colors.buttonPrimaryBg} />
                </View>

                {readiness.skills.allSkills.length === 0 ? (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                    No structured skill evaluations recorded yet. Use the Skill Assessment tab.
                  </Text>
                ) : (
                  <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                    {readiness.skills.allSkills.map((sk: any) => (
                      <View key={sk.skill_id} style={[styles.skillItem, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                            {sk.skill_name || sk.skill_id}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>
                            {sk.notes || 'Master observation logged'}
                          </Text>
                        </View>
                        <StatusBadge
                          status={sk.level}
                          label={sk.level}
                          variant={['Proficient', 'Mastered'].includes(sk.level) ? 'success' : 'warning'}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </Card>

              {/* Historical Belt Progression */}
              {readiness.rankHistory.length > 0 ? (
                <Card variant="standard" style={styles.card}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                    Historical Progression History
                  </Text>
                  {readiness.rankHistory.map((h: any) => (
                    <View key={h.id} style={[styles.historyItem, { borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                          {h.rank_name}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {h.notes || 'Promotion exam passed'} • Cert: {h.certificate_number || 'N/A'}
                        </Text>
                      </View>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {new Date(h.awarded_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No Student Selected"
              description="Please choose an active student above to inspect their readiness passport."
            />
          )}
        </View>
      )}

      {/* TAB 2: SKILL ASSESSMENT */}
      {activeTab === 'ASSESS' && (
        <View style={{ gap: spacing.md }}>
          <Card variant="elevated" style={styles.card}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 4 }]}>
              Master Skill Evaluation
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Record structured Silambam technique ratings and observations for {readiness?.fullName || 'student'}.
            </Text>

            {assessmentSuccess ? (
              <View style={[styles.successBanner, { backgroundColor: colors.badgeSuccessBg }]}>
                <CheckCircle2 size={18} color={colors.badgeSuccessText} style={{ marginRight: 6 }} />
                <Text style={[typography.caption, { color: colors.badgeSuccessText, fontWeight: '700' }]}>
                  {assessmentSuccess}
                </Text>
              </View>
            ) : null}

            {/* Form Inputs */}
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '700' }]}>
              SKILL / FORM NAME
            </Text>
            <TextInput
              value={skillName}
              onChangeText={setSkillName}
              placeholder="e.g. Basic Footwork, Porpadai, Kaaladi"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              testID="input-skill-name"
            />

            {/* Level Selector */}
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: 6, fontWeight: '700' }]}>
              PROFICIENCY LEVEL
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {(['Needs Work', 'Developing', 'Proficient', 'Mastered'] as const).map((lvl) => {
                const isSel = skillLevel === lvl;
                return (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => setSkillLevel(lvl)}
                    style={[
                      styles.levelPill,
                      {
                        backgroundColor: isSel ? colors.buttonPrimaryBg : colors.surfaceElevated,
                        borderColor: isSel ? colors.buttonPrimaryBg : colors.border,
                      },
                    ]}
                    testID={`pill-level-${lvl.toLowerCase().replace(' ', '-')}`}
                  >
                    <Text style={[typography.caption, { color: isSel ? colors.buttonPrimaryText : colors.textPrimary, fontWeight: '700' }]}>
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Structured Criteria Matrix (Ratings 1-5) */}
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: 8, fontWeight: '700' }]}>
              STRUCTURED CRITERIA (1 - 5 STARS)
            </Text>
            <View style={{ gap: spacing.xs }}>
              {ASSESSMENT_CRITERIA_KEYS.map((crit) => {
                const score = criteriaScores[crit.key] || 3;
                return (
                  <View key={crit.key} style={[styles.critRow, { borderColor: colors.border }]}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
                      {crit.label}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <TouchableOpacity
                          key={val}
                          onPress={() =>
                            setCriteriaScores((prev) => ({ ...prev, [crit.key]: val }))
                          }
                          style={[
                            styles.scoreBtn,
                            {
                              backgroundColor: score >= val ? colors.buttonPrimaryBg : colors.surfaceElevated,
                              borderColor: colors.border,
                            },
                          ]}
                          testID={`score-${crit.key}-${val}`}
                        >
                          <Text style={[typography.caption, { color: score >= val ? colors.buttonPrimaryText : colors.textSecondary }]}>
                            {val}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: 4, fontWeight: '700' }]}>
              MASTER OBSERVATIONS & DRILL GUIDANCE
            </Text>
            <TextInput
              value={assessmentNotes}
              onChangeText={setAssessmentNotes}
              placeholder="Detailed feedback for student and linked parents..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[styles.textArea, { borderColor: colors.border, color: colors.textPrimary }]}
              testID="input-assessment-notes"
            />

            <View style={{ marginTop: spacing.md }}>
              <Button
                label="Record Skill Assessment"
                onPress={handleRecordAssessment}
                loading={assessing}
                disabled={assessing || !skillName.trim()}
                variant="primary"
                size="md"
                fullWidth
                testID="btn-record-assessment"
              />
            </View>
          </Card>
        </View>
      )}

      {/* TAB 3: GRADING EVENTS */}
      {activeTab === 'EVENTS' && (
        <View style={{ gap: spacing.md }}>
          <Card variant="standard" style={styles.card}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Scheduled Grading Examinations
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Persatuan promotion events open for candidate nominations and evaluations.
            </Text>

            {events.length === 0 ? (
              <EmptyState
                title="No Grading Events"
                description="No grading events scheduled by Persatuan Administration."
              />
            ) : (
              events.map((ev) => (
                <View key={ev.id} style={[styles.eventCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                        {ev.title}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        Date: {ev.event_date} • {ev.location || 'Dojo'} • Fee: RM {ev.fee || 0}
                      </Text>
                      {ev.chief_examiner_name ? (
                        <Text style={[typography.caption, { color: colors.buttonPrimaryBg, marginTop: 2 }]}>
                          Chief Examiner: {ev.chief_examiner_name}
                        </Text>
                      ) : null}
                    </View>
                    <StatusBadge status={ev.status} label={ev.status} variant="info" />
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorCard: {
    padding: 12,
  },
  studentPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  card: {
    padding: 18,
  },
  readinessHeroCard: {
    padding: 20,
    borderWidth: 1,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
  rankProgressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  nominatedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  critRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  eventCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
});
