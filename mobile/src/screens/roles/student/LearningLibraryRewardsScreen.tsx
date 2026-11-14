import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  BookOpen,
  Award,
  TrendingUp,
  HelpCircle,
  X,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge, BeltBadge } from '../../../components/Badges';
import {
  learningService,
  LearningLesson,
  StudentAchievement,
  StudentPerformanceSummary,
} from '../../../services/learningService';
import { useI18n } from '../../../i18n';

export interface LearningLibraryRewardsScreenProps {
  studentId: string;
  studentName?: string;
  currentBeltRank?: string;
  isOffline?: boolean;
}

type TabType = 'LESSONS' | 'PERFORMANCE' | 'ACHIEVEMENTS';

export const LearningLibraryRewardsScreen: React.FC<LearningLibraryRewardsScreenProps> = ({
  studentId,
  studentName: studentNameProp,
  currentBeltRank = 'Putih',
  isOffline = false,
}) => {
  const { t } = useI18n();
  const studentName = studentNameProp ?? t('studentFlows.learning.studentFallback');
  const { colors, typography, spacing, iconSize, borderRadius, belts } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('LESSONS');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Lessons Data
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState<boolean>(true);
  const [selectedLesson, setSelectedLesson] = useState<LearningLesson | null>(null);

  // Quiz State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [submittingProgress, setSubmittingProgress] = useState<boolean>(false);

  // Performance Data
  const [performance, setPerformance] = useState<StudentPerformanceSummary | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState<boolean>(false);

  // Achievements Data
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Lessons
  // 1. Fetch Lessons on filter change
  useEffect(() => {
    let isMounted = true;
    const filter = categoryFilter !== 'ALL' ? { category: categoryFilter } : undefined;
    learningService
      .getLessons(filter)
      .then((data) => {
        if (isMounted) {
          setLessons(data);
          setErrorMsg(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setErrorMsg(err.message || t('studentFlows.learning.loadFailed'));
        }
      })
      .finally(() => {
        if (isMounted) setLoadingLessons(false);
      });

    return () => {
      isMounted = false;
    };
  }, [categoryFilter, t]);

  // 2. Fetch Performance & Achievements on tab change
  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'PERFORMANCE') {
      learningService
        .getStudentPerformance(studentId, true)
        .then((data) => {
          if (isMounted) setPerformance(data);
        })
        .catch((err: any) => {
          console.warn('Could not load performance:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingPerformance(false);
        });
    } else if (activeTab === 'ACHIEVEMENTS') {
      learningService
        .getStudentAchievements(studentId)
        .then((data) => {
          if (isMounted) setAchievements(data);
        })
        .catch((err: any) => {
          console.warn('Could not load achievements:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingAchievements(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, studentId]);

  // Handle Quiz Submission & Lesson Completion
  const handleCompleteLesson = async () => {
    if (!selectedLesson) return;

    let score = 100;
    const questions = Array.isArray(selectedLesson.quizQuestions)
      ? selectedLesson.quizQuestions
      : typeof selectedLesson.quiz_questions === 'string'
      ? JSON.parse(selectedLesson.quiz_questions)
      : Array.isArray(selectedLesson.quiz_questions)
      ? selectedLesson.quiz_questions
      : [];

    if (questions.length > 0) {
      let correctCount = 0;
      questions.forEach((q: any, idx: number) => {
        if (selectedAnswers[idx] === q.correctIndex) {
          correctCount++;
        }
      });
      score = Math.round((correctCount / questions.length) * 100);
    }

    try {
      setSubmittingProgress(true);
      const res = await learningService.recordLessonProgress(selectedLesson.id, {
        studentId,
        quizScore: score,
        quizAnswers: selectedAnswers,
        status: 'COMPLETED',
      });

      setQuizSubmitted(true);
      Alert.alert(
        t('studentFlows.learning.lessonCompletedTitle'),
        t('studentFlows.learning.lessonCompletedMessage', { score, message: res.message || t('studentFlows.learning.progressSaved') })
      );
    } catch (err: any) {
      Alert.alert(t('studentFlows.learning.errorTitle'), err.message || t('studentFlows.learning.submitProgressFailed'));
    } finally {
      setSubmittingProgress(false);
    }
  };

  const categories = ['ALL', 'POOMSAE', 'SPARRING', 'SELF_DEFENSE', 'FITNESS', 'THEORY', 'SILAMBAM'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Banner */}
      <View
        style={[
          styles.headerBanner,
          {
            backgroundColor: BrandColors.navy,
            borderColor: BrandColors.navyLight,
            borderBottomWidth: 1,
            padding: spacing.md,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.sectionHeading, { color: '#FFFFFF' }]} testID="learning-hub-title">
              {t('studentFlows.learning.title')}
            </Text>
            <Text style={[typography.caption, { color: BrandColors.amber, marginTop: 2 }]}>
              {t('studentFlows.learning.headerSubtitle', { name: studentName, belt: currentBeltRank })}
            </Text>
          </View>
          <BeltBadge beltName={currentBeltRank} customBelts={belts} size="sm" />
        </View>

        {/* Tab Segment Controls */}
        <View style={[styles.tabBar, { marginTop: spacing.md }]}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'LESSONS' && { backgroundColor: BrandColors.amber },
            ]}
            onPress={() => setActiveTab('LESSONS')}
            testID="tab-learning-lessons"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'LESSONS' }}
          >
            <BookOpen
              size={16}
              color={activeTab === 'LESSONS' ? BrandColors.navyDark : '#FFFFFF'}
            />
            <Text
              style={[
                typography.caption,
                styles.tabText,
                { color: activeTab === 'LESSONS' ? BrandColors.navyDark : '#FFFFFF' },
              ]}
            >
              {t('studentFlows.learning.tabLessons')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'PERFORMANCE' && { backgroundColor: BrandColors.amber },
            ]}
            onPress={() => setActiveTab('PERFORMANCE')}
            testID="tab-learning-performance"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'PERFORMANCE' }}
          >
            <TrendingUp
              size={16}
              color={activeTab === 'PERFORMANCE' ? BrandColors.navyDark : '#FFFFFF'}
            />
            <Text
              style={[
                typography.caption,
                styles.tabText,
                { color: activeTab === 'PERFORMANCE' ? BrandColors.navyDark : '#FFFFFF' },
              ]}
            >
              {t('studentFlows.learning.tabPerformance')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'ACHIEVEMENTS' && { backgroundColor: BrandColors.amber },
            ]}
            onPress={() => setActiveTab('ACHIEVEMENTS')}
            testID="tab-learning-achievements"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'ACHIEVEMENTS' }}
          >
            <Award
              size={16}
              color={activeTab === 'ACHIEVEMENTS' ? BrandColors.navyDark : '#FFFFFF'}
            />
            <Text
              style={[
                typography.caption,
                styles.tabText,
                { color: activeTab === 'ACHIEVEMENTS' ? BrandColors.navyDark : '#FFFFFF' },
              ]}
            >
              {t('studentFlows.learning.tabBadges')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {errorMsg ? (
          <Card variant="standard" style={{ borderColor: BrandColors.danger, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={iconSize.md} color={BrandColors.danger} />
              <Text style={[typography.bodyMedium, { color: BrandColors.danger, flex: 1 }]}>
                {errorMsg}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* 1. LESSONS TAB                                                     */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'LESSONS' && (
          <View>
            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: categoryFilter === cat ? BrandColors.amber : colors.surfaceElevated,
                        borderColor: colors.border,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                    onPress={() => setCategoryFilter(cat)}
                    testID={`filter-cat-${cat.toLowerCase()}`}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: categoryFilter === cat ? BrandColors.navyDark : colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {t(`studentFlows.learning.category.${cat}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {loadingLessons ? (
              <ActivityIndicator size="large" color={BrandColors.amber} style={{ marginVertical: 30 }} />
            ) : lessons.length === 0 ? (
              <Card variant="standard" style={styles.emptyCard}>
                <BookOpen size={40} color={colors.textSecondary} />
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 12 }]}>
                  {t('studentFlows.learning.noLessonsTitle')}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                  {t('studentFlows.learning.noLessonsBody')}
                </Text>
              </Card>
            ) : (
              lessons.map((lesson) => (
                <TouchableOpacity
                  key={lesson.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedLesson(lesson);
                    setSelectedAnswers({});
                    setQuizSubmitted(false);
                  }}
                  testID={`lesson-card-${lesson.id}`}
                >
                  <Card
                    variant="standard"
                    style={[
                      styles.lessonCard,
                      { borderColor: colors.border, marginBottom: spacing.sm },
                    ]}
                  >
                    <View style={styles.lessonHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <StatusBadge
                          status={lesson.category}
                          label={lesson.category}
                          variant="info"
                          testID={`badge-cat-${lesson.id}`}
                        />
                        <Text
                          style={[
                            typography.bodyLarge,
                            { color: colors.textPrimary, fontWeight: '700', marginTop: 6 },
                          ]}
                          testID={`lesson-title-${lesson.id}`}
                        >
                          {lesson.title}
                        </Text>
                        {lesson.description ? (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSecondary, marginTop: 4 },
                            ]}
                            numberOfLines={2}
                          >
                            {lesson.description}
                          </Text>
                        ) : null}
                      </View>
                      <ChevronRight size={20} color={colors.textSecondary} />
                    </View>

                    <View style={[styles.lessonFooterRow, { marginTop: spacing.sm }]}>
                      {lesson.target_rank_name ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>
                            {t('studentFlows.learning.rankLabel')}
                          </Text>
                          <BeltBadge
                            beltName={lesson.target_rank_name}
                            customBelts={belts}
                            size="sm"
                          />
                        </View>
                      ) : null}
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        v{lesson.version}
                      </Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. PERFORMANCE TAB                                                 */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'PERFORMANCE' && (
          <View>
            {/* Child Privacy Guarantee Notice */}
            <Card
              variant="standard"
              style={[
                styles.privacyNoticeCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: BrandColors.navy,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color={BrandColors.amber} />
                <Text style={[typography.caption, { color: colors.textPrimary, flex: 1, fontWeight: '600' }]}>
                  {t('studentFlows.learning.privacyTitle')}
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {t('studentFlows.learning.privacyBody')}
              </Text>
            </Card>

            {loadingPerformance ? (
              <ActivityIndicator size="large" color={BrandColors.amber} style={{ marginVertical: 30 }} />
            ) : performance?.crossRubricIncompatible ? (
              <Card
                variant="standard"
                style={{ borderColor: BrandColors.warning, marginBottom: spacing.md, backgroundColor: '#FFFBEB' }}
                testID="cross-rubric-warning-card"
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={20} color={BrandColors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: '#92400E', fontWeight: '700' }]}>
                      {t('studentFlows.learning.rubricIsolationTitle')}
                    </Text>
                    <Text style={[typography.caption, { color: '#92400E', marginTop: 2 }]}>
                      {performance.comparisonWarning}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {performance && Object.keys(performance.partitionedByRubric).length > 0 ? (
              Object.entries(performance.partitionedByRubric).map(([rubricKey, records]) => (
                <View key={rubricKey} style={{ marginBottom: spacing.md }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 8 }]}>
                    {t('studentFlows.learning.rubricLabel', { rubric: rubricKey })}
                  </Text>
                  {records.map((rec) => {
                    const scoreNum = Number(rec.score);
                    const maxNum = Number(rec.max_score || rec.maxScore || 100);
                    const percent = Math.min(Math.round((scoreNum / maxNum) * 100), 100);

                    return (
                      <Card
                        key={rec.id}
                        variant="standard"
                        style={[
                          styles.assessCard,
                          { borderColor: colors.border, marginBottom: 8 },
                        ]}
                      >
                        <View style={styles.assessHeaderRow}>
                          <View>
                            <Text style={[typography.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>
                              {rec.skill_category || rec.skillCategory}
                            </Text>
                            <Text style={[typography.caption, { color: colors.textSecondary }]}>
                              {t('studentFlows.learning.evaluatedBy', { name: rec.assessor_name || rec.assessorName || t('studentFlows.learning.masterFallback') })}
                            </Text>
                          </View>
                          <Text
                            style={[
                              typography.sectionHeading,
                              { color: BrandColors.amber, fontWeight: '800' },
                            ]}
                          >
                            {scoreNum} / {maxNum}
                          </Text>
                        </View>

                        {/* Progress Bar */}
                        <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${percent}%`, backgroundColor: BrandColors.amber },
                            ]}
                          />
                        </View>

                        {rec.notes ? (
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' }]}>
                            &ldquo;{rec.notes}&rdquo;
                          </Text>
                        ) : null}
                      </Card>
                    );
                  })}
                </View>
              ))
            ) : (
              <Card variant="standard" style={styles.emptyCard}>
                <TrendingUp size={40} color={colors.textSecondary} />
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 12 }]}>
                  {t('studentFlows.learning.noAssessmentsTitle')}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                  {t('studentFlows.learning.noAssessmentsBody')}
                </Text>
              </Card>
            )}
          </View>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 3. ACHIEVEMENTS / BADGES TAB                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'ACHIEVEMENTS' && (
          <View>
            {loadingAchievements ? (
              <ActivityIndicator size="large" color={BrandColors.amber} style={{ marginVertical: 30 }} />
            ) : achievements.length === 0 ? (
              <Card variant="standard" style={styles.emptyCard}>
                <Award size={40} color={colors.textSecondary} />
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 12 }]}>
                  {t('studentFlows.learning.noBadgesTitle')}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                  {t('studentFlows.learning.noBadgesBody')}
                </Text>
              </Card>
            ) : (
              <View style={styles.badgesGrid}>
                {achievements.map((ach) => (
                  <Card
                    key={ach.id}
                    variant="standard"
                    style={[
                      styles.badgeCard,
                      {
                        borderColor: BrandColors.amber,
                        backgroundColor: colors.surfaceElevated,
                        marginBottom: spacing.sm,
                      },
                    ]}
                    testID={`badge-item-${ach.id}`}
                  >
                    <View style={styles.badgeIconWrapper}>
                      <Award size={28} color={BrandColors.amber} />
                    </View>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: colors.textPrimary, fontWeight: '700', textAlign: 'center', marginTop: 8 },
                      ]}
                      testID={`badge-title-${ach.id}`}
                    >
                      {ach.badge_title || ach.badgeTitle}
                    </Text>
                    <StatusBadge
                      status={ach.category}
                      label={ach.category}
                      variant="warning"
                    />
                    {ach.badge_description || ach.badgeDescription ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
                        ]}
                        numberOfLines={3}
                      >
                        {ach.badge_description || ach.badgeDescription}
                      </Text>
                    ) : null}
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* -------------------------------------------------------------------- */}
      {/* Interactive Lesson Reader & Quiz Modal                               */}
      {/* -------------------------------------------------------------------- */}
      <Modal
        visible={Boolean(selectedLesson)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedLesson(null)}
      >
        {selectedLesson ? (
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor: BrandColors.navy,
                  borderColor: BrandColors.navyLight,
                  borderBottomWidth: 1,
                  padding: spacing.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: BrandColors.amber, fontWeight: '700' }]}>
                  {t('studentFlows.learning.lessonCategoryHeading', { category: selectedLesson.category })}
                </Text>
                <Text style={[typography.sectionHeading, { color: '#FFFFFF', marginTop: 2 }]} testID="modal-lesson-title">
                  {selectedLesson.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedLesson(null)}
                style={styles.closeBtn}
                testID="btn-close-lesson-modal"
                accessibilityLabel={t('studentFlows.learning.closeLesson')}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Modal Content Scroll */}
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
              {/* Target Belt Tag */}
              {selectedLesson.target_rank_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('studentFlows.learning.targetBelt')}
                  </Text>
                  <BeltBadge
                    beltName={selectedLesson.target_rank_name}
                    customBelts={belts}
                    size="sm"
                  />
                </View>
              ) : null}

              {/* Lesson Body */}
              <Card variant="standard" style={{ borderColor: colors.border, marginBottom: spacing.md }}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 8 }]}>
                  {t('studentFlows.learning.contentHeading')}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, lineHeight: 22 }]}>
                  {selectedLesson.content_body || selectedLesson.contentBody || t('studentFlows.learning.noContent')}
                </Text>
              </Card>

              {/* Interactive Quiz Section */}
              {(() => {
                const quizList = Array.isArray(selectedLesson.quizQuestions)
                  ? selectedLesson.quizQuestions
                  : typeof selectedLesson.quiz_questions === 'string'
                  ? JSON.parse(selectedLesson.quiz_questions)
                  : Array.isArray(selectedLesson.quiz_questions)
                  ? selectedLesson.quiz_questions
                  : [];

                if (quizList.length === 0) return null;

                return (
                  <View style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
                    <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                      {t('studentFlows.learning.quizHeading')}
                    </Text>

                    {quizList.map((q: any, qIdx: number) => (
                      <Card
                        key={qIdx}
                        variant="standard"
                        style={{ borderColor: colors.border, marginBottom: spacing.sm }}
                      >
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: 8 }]}>
                          {qIdx + 1}. {q.question}
                        </Text>

                        {q.options.map((opt: string, optIdx: number) => {
                          const isSelected = selectedAnswers[qIdx] === optIdx;
                          return (
                            <TouchableOpacity
                              key={optIdx}
                              style={[
                                styles.quizOptionRow,
                                {
                                  borderColor: isSelected ? BrandColors.amber : colors.border,
                                  backgroundColor: isSelected ? colors.surfaceElevated : 'transparent',
                                  borderRadius: borderRadius.sm,
                                },
                              ]}
                              onPress={() => {
                                if (!quizSubmitted) {
                                  setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
                                }
                              }}
                              testID={`quiz-opt-${qIdx}-${optIdx}`}
                            >
                              <View
                                style={[
                                  styles.radioCircle,
                                  { borderColor: isSelected ? BrandColors.amber : colors.textSecondary },
                                ]}
                              >
                                {isSelected ? (
                                  <View style={[styles.radioDot, { backgroundColor: BrandColors.amber }]} />
                                ) : null}
                              </View>
                              <Text
                                style={[
                                  typography.bodyMedium,
                                  { color: isSelected ? BrandColors.amber : colors.textPrimary, flex: 1 },
                                ]}
                              >
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </Card>
                    ))}
                  </View>
                );
              })()}

              {/* Formal Grading Decoupling Notice */}
              <View
                style={[
                  styles.decouplingNotice,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                <HelpCircle size={18} color={BrandColors.amber} />
                <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
                  {t('studentFlows.learning.gradingNotice')}
                </Text>
              </View>

              {/* Submit / Complete Action Button */}
              <Button
                label={submittingProgress ? t('studentFlows.learning.saving') : t('studentFlows.learning.completeLesson')}
                onPress={handleCompleteLesson}
                variant="primary"
                size="lg"
                disabled={submittingProgress || quizSubmitted}
                testID="btn-complete-lesson"
                accessibilityLabel={t('studentFlows.learning.completeLessonA11y')}
              />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBanner: {
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontWeight: '700',
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  lessonCard: {
    padding: 16,
  },
  lessonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lessonFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyNoticeCard: {
    padding: 14,
  },
  assessCard: {
    padding: 16,
  },
  assessHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
  },
  badgeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(242, 148, 28, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 8,
  },
  quizOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  decouplingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
});
