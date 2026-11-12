/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  FileText,
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  X,
  CheckCircle,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { BrandColors } from '../../../theme/colors';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { useI18n } from '../../../i18n';
import {
  teachingService,
  LessonDrill,
  SubstituteBrief,
} from '../../../services/teachingService';

export interface LessonPlanModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle?: string;
  isSubstituteViewInitial?: boolean;
}

export const LessonPlanModal: React.FC<LessonPlanModalProps> = ({
  visible,
  onClose,
  sessionId,
  sessionTitle,
  isSubstituteViewInitial = false,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<boolean>(false);
  const [currentVersionOnServer, setCurrentVersionOnServer] = useState<number | null>(null);

  // Mode: EDIT_PLAN or SUBSTITUTE_BRIEF
  const [mode, setMode] = useState<'EDIT_PLAN' | 'SUBSTITUTE_BRIEF'>(
    isSubstituteViewInitial ? 'SUBSTITUTE_BRIEF' : 'EDIT_PLAN'
  );

  // Lesson Plan Form State
  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState('');
  const [coveredMaterial, setCoveredMaterial] = useState('');
  const [privateMasterNotes, setPrivateMasterNotes] = useState('');
  const [equipmentInput, setEquipmentInput] = useState('');
  const [drills, setDrills] = useState<LessonDrill[]>([]);
  const [planVersion, setPlanVersion] = useState<number>(1);

  // Substitute Brief State
  const [substituteBrief, setSubstituteBrief] = useState<SubstituteBrief | null>(null);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      setVersionConflict(false);

      if (mode === 'SUBSTITUTE_BRIEF') {
        const brief = await teachingService.getSubstituteBrief(sessionId);
        setSubstituteBrief(brief);
      } else {
        const res = await teachingService.getLessonPlan(sessionId);
        if (res && res.lessonPlan) {
          setTitle(res.lessonPlan.title || '');
          setObjectives(res.lessonPlan.objectives || '');
          setCoveredMaterial(res.lessonPlan.coveredMaterial || '');
          setPrivateMasterNotes(res.lessonPlan.privateMasterNotes || '');
          setEquipmentInput((res.lessonPlan.equipment || []).join(', '));
          setDrills(res.lessonPlan.drills || []);
          setPlanVersion(res.lessonPlan.version || 1);
        } else {
          // Initialize new
          setTitle(`Lesson Plan - ${sessionTitle || 'Session'}`);
          setObjectives('');
          setCoveredMaterial('');
          setPrivateMasterNotes('');
          setEquipmentInput('Taegeuk Mats, Kick Targets');
          setDrills([
            { name: 'Warm-up & Joint Mobility', duration_minutes: 10, instructions: 'Standard dynamic warm up' },
            { name: 'Pattern Practice (Poomsae)', duration_minutes: 25, instructions: 'Focus on stances and hip rotation' },
          ]);
          setPlanVersion(1);
        }
      }
    } catch (err: any) {
      setError(err.message || t('masterClasses.lessonPlan.loadError'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, mode, sessionTitle, t]);

  useEffect(() => {
    if (visible && sessionId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sessionId, mode]);

  const handleAddDrill = () => {
    setDrills(prev => [
      ...prev,
      {
        id: `drill-${Date.now()}`,
        name: 'New Drill',
        duration_minutes: 15,
        instructions: '',
        key_focus: '',
      },
    ]);
  };

  const handleUpdateDrill = (index: number, field: keyof LessonDrill, value: any) => {
    setDrills(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveDrill = (index: number) => {
    setDrills(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveLessonPlan = async () => {
    if (!title.trim()) {
      Alert.alert(t('masterClasses.lessonPlan.validationTitle'), t('masterClasses.lessonPlan.titleRequired'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setVersionConflict(false);

      const equipment = equipmentInput
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      const res = await teachingService.saveLessonPlan(sessionId, {
        title,
        objectives,
        coveredMaterial,
        privateMasterNotes,
        equipment,
        drills,
        expectedVersion: planVersion,
      });

      setPlanVersion(res.lessonPlan.version);
      Alert.alert(t('masterClasses.lessonPlan.successTitle'), t('masterClasses.lessonPlan.savedMessage', { version: res.lessonPlan.version }));
    } catch (err: any) {
      if (err.statusCode === 409 || err.message?.includes('conflict') || err.message?.includes('version')) {
        setVersionConflict(true);
        setCurrentVersionOnServer(err.currentVersion || planVersion + 1);
        Alert.alert(
          t('masterClasses.lessonPlan.conflictTitle'),
          t('masterClasses.lessonPlan.conflictMessage')
        );
      } else {
        setError(err.message || t('masterClasses.lessonPlan.saveError'));
        Alert.alert(t('masterClasses.lessonPlan.errorTitle'), err.message || t('masterClasses.lessonPlan.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID="lesson-plan-modal"
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
              {mode === 'SUBSTITUTE_BRIEF' ? t('masterClasses.lessonPlan.substituteBriefingTitle') : t('masterClasses.lessonPlan.editorTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {sessionTitle || t('masterClasses.lessonPlan.sessionFallback', { id: sessionId })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
            accessibilityLabel={t('masterClasses.lessonPlan.closeA11y')}
            testID="btn-close-lesson-modal"
          >
            <X size={iconSize.md} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Mode Switcher Tabs */}
        <View style={[styles.modeTabs, { backgroundColor: colors.backgroundSecondary }]}>
          <TouchableOpacity
            style={[
              styles.modeTab,
              mode === 'EDIT_PLAN' && {
                backgroundColor: colors.buttonPrimaryBg,
                borderRadius: borderRadius.sm,
              },
            ]}
            onPress={() => setMode('EDIT_PLAN')}
            testID="tab-edit-plan"
          >
            <FileText
              size={iconSize.sm}
              color={mode === 'EDIT_PLAN' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                typography.button,
                { color: mode === 'EDIT_PLAN' ? '#FFFFFF' : colors.textSecondary, marginLeft: 6 },
              ]}
            >
              {t('masterClasses.lessonPlan.tabMasterPlan')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTab,
              mode === 'SUBSTITUTE_BRIEF' && {
                backgroundColor: colors.buttonPrimaryBg,
                borderRadius: borderRadius.sm,
              },
            ]}
            onPress={() => setMode('SUBSTITUTE_BRIEF')}
            testID="tab-substitute-brief"
          >
            <Shield
              size={iconSize.sm}
              color={mode === 'SUBSTITUTE_BRIEF' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                typography.button,
                { color: mode === 'SUBSTITUTE_BRIEF' ? '#FFFFFF' : colors.textSecondary, marginLeft: 6 },
              ]}
            >
              {t('masterClasses.lessonPlan.tabSubstituteBrief')}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {t('masterClasses.lessonPlan.loading')}
            </Text>
          </View>
        ) : error ? (
          <View style={[styles.errorContainer, { padding: spacing.lg }]}>
            <AlertTriangle size={iconSize.xl} color={BrandColors.danger} />
            <Text style={[typography.sectionHeading, { color: BrandColors.danger, marginTop: spacing.sm }]}>
              {t('masterClasses.lessonPlan.unableToLoad')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              {error}
            </Text>
            <Button
              label={t('masterClasses.lessonPlan.retry')}
              onPress={loadData}
              variant="outline"
              size="sm"
              style={{ marginTop: spacing.md }}
              leftIcon={<RefreshCw size={iconSize.sm} color={colors.textPrimary} />}
            />
          </View>
        ) : mode === 'SUBSTITUTE_BRIEF' ? (
          /* SUBSTITUTE BRIEF VIEW (Acceptance: substitute_brief_hides_private_messages) */
          <ScrollView contentContainerStyle={{ padding: spacing.md }} testID="substitute-brief-view">
            {substituteBrief?.confidentialityNotice && (
              <Card
                variant="standard"
                style={[styles.confidentialCard, { borderColor: BrandColors.warning }]}
                testID="substitute-confidentiality-notice"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Lock size={iconSize.md} color={BrandColors.warning} />
                  <Text
                    style={[
                      typography.sectionHeading,
                      { color: BrandColors.warning, marginLeft: spacing.sm, fontSize: 14 },
                    ]}
                  >
                    {t('masterClasses.lessonPlan.confidentialHeading')}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  {substituteBrief.confidentialityNotice}
                </Text>
              </Card>
            )}

            {/* Session Info */}
            <Card variant="standard" style={{ marginTop: spacing.md }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {substituteBrief?.session?.className || t('masterClasses.lessonPlan.classSessionFallback')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('masterClasses.lessonPlan.dateLine', {
                  date: substituteBrief?.session?.sessionDate ?? '',
                  day: substituteBrief?.session?.dayOfWeek ?? '',
                  start: substituteBrief?.session?.startTime ?? '',
                  end: substituteBrief?.session?.endTime ?? '',
                })}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {t('masterClasses.lessonPlan.venueLine', { location: substituteBrief?.session?.location ?? '' })}
              </Text>
            </Card>

            {/* Lesson Drills & Objectives */}
            <Card variant="standard" style={{ marginTop: spacing.md }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                {t('masterClasses.lessonPlan.planLine', { title: substituteBrief?.lessonPlan?.title || t('masterClasses.lessonPlan.noPlan') })}
              </Text>
              {substituteBrief?.lessonPlan?.objectives ? (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary }]}>
                    {t('masterClasses.lessonPlan.objectivesLabel')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                    {substituteBrief.lessonPlan.objectives}
                  </Text>
                </View>
              ) : null}

              {substituteBrief?.lessonPlan?.equipment && substituteBrief.lessonPlan.equipment.length > 0 && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary }]}>
                    {t('masterClasses.lessonPlan.requiredEquipment')}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                    {substituteBrief.lessonPlan.equipment.join(', ')}
                  </Text>
                </View>
              )}

              {/* Drills List */}
              <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs }]}>
                {t('masterClasses.lessonPlan.scheduledDrills')}
              </Text>
              <View testID="substitute-drills-list">
                {(substituteBrief?.lessonPlan?.drills || []).map((drill, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.drillRow,
                      { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.button, { color: colors.textPrimary }]}>
                        {t('masterClasses.lessonPlan.drillLine', { index: idx + 1, name: drill.name, minutes: drill.duration_minutes || 10 })}
                      </Text>
                      {drill.instructions ? (
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {drill.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Student Safety Profile Brief */}
            <Card variant="standard" style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Shield size={iconSize.md} color={colors.buttonPrimaryBg} />
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                  {t('masterClasses.lessonPlan.safetyBriefTitle')}
                </Text>
              </View>
              <View testID="safety-brief-list">
                {(substituteBrief?.studentSafetyBrief || []).length === 0 ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('masterClasses.lessonPlan.noFlaggedStudents')}
                  </Text>
                ) : (
                  substituteBrief?.studentSafetyBrief.map((student, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.safetyStudentCard,
                        { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                      ]}
                      testID={`safety-student-${student.student_id}`}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[typography.button, { color: colors.textPrimary }]}>
                          {student.student_name}
                        </Text>
                        <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
                          {student.belt_rank}
                        </Text>
                      </View>
                      {student.allergies ? (
                        <Text style={[typography.caption, { color: BrandColors.danger, marginTop: 2 }]}>
                          {t('masterClasses.lessonPlan.allergies', { value: student.allergies })}
                        </Text>
                      ) : null}
                      {student.medical_conditions ? (
                        <Text style={[typography.caption, { color: BrandColors.warning, marginTop: 2 }]}>
                          {t('masterClasses.lessonPlan.medical', { value: student.medical_conditions })}
                        </Text>
                      ) : null}
                      {student.emergency_contact_phone ? (
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {t('masterClasses.lessonPlan.emergencyContact', { value: student.emergency_contact_phone })}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </Card>
          </ScrollView>
        ) : (
          /* MASTER LESSON PLAN EDIT VIEW (Acceptance: lesson_edit_version_conflict) */
          <ScrollView contentContainerStyle={{ padding: spacing.md }} testID="lesson-plan-edit-view">
            {/* Version Conflict Warning Banner */}
            {versionConflict && (
              <Card
                variant="standard"
                style={[styles.conflictBanner, { borderColor: BrandColors.danger }]}
                testID="version-conflict-banner"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AlertTriangle size={iconSize.md} color={BrandColors.danger} />
                  <Text
                    style={[
                      typography.sectionHeading,
                      { color: BrandColors.danger, marginLeft: spacing.sm, fontSize: 15 },
                    ]}
                  >
                    {t('masterClasses.lessonPlan.conflictBannerTitle')}
                  </Text>
                </View>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
                  {t('masterClasses.lessonPlan.conflictBannerBody', { version: currentVersionOnServer ?? '' })}
                </Text>
                <Button
                  label={t('masterClasses.lessonPlan.reloadLatest')}
                  onPress={loadData}
                  variant="primary"
                  size="sm"
                  style={{ marginTop: spacing.md }}
                  leftIcon={<RefreshCw size={iconSize.sm} color="#FFFFFF" />}
                  testID="btn-reload-conflict"
                />
              </Card>
            )}

            {/* Version Info Header */}
            <View style={styles.versionRow}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {t('masterClasses.lessonPlan.concurrencyControl')}
              </Text>
              <View style={[styles.versionBadge, { backgroundColor: colors.backgroundSecondary }]}>
                <Text
                  style={[typography.caption, { fontWeight: '700', color: colors.textPrimary }]}
                  testID="lesson-plan-version"
                >
                  {t('masterClasses.lessonPlan.version', { version: planVersion })}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Card variant="standard" style={{ marginTop: spacing.sm }}>
              <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary }]}>
                {t('masterClasses.lessonPlan.planTitleLabel')}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.backgroundSecondary },
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder={t('masterClasses.lessonPlan.titlePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                testID="input-lesson-title"
              />

              <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm }]}>
                {t('masterClasses.lessonPlan.coreObjectives')}
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.backgroundSecondary },
                ]}
                value={objectives}
                onChangeText={setObjectives}
                placeholder={t('masterClasses.lessonPlan.objectivesPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                testID="input-lesson-objectives"
              />

              <Text style={[typography.caption, { fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm }]}>
                {t('masterClasses.lessonPlan.equipmentLabel')}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.backgroundSecondary },
                ]}
                value={equipmentInput}
                onChangeText={setEquipmentInput}
                placeholder={t('masterClasses.lessonPlan.equipmentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                testID="input-lesson-equipment"
              />
            </Card>

            {/* Drills Section */}
            <Card variant="standard" style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                  {t('masterClasses.lessonPlan.trainingDrills')}
                </Text>
                <TouchableOpacity
                  onPress={handleAddDrill}
                  style={[styles.addDrillBtn, { backgroundColor: colors.buttonPrimaryBg }]}
                  testID="btn-add-drill"
                >
                  <Plus size={iconSize.sm} color="#FFFFFF" />
                  <Text style={[typography.button, { color: '#FFFFFF', marginLeft: 4, fontSize: 12 }]}>
                    {t('masterClasses.lessonPlan.addDrill')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: spacing.sm }}>
                {drills.map((drill, index) => (
                  <View
                    key={index}
                    style={[
                      styles.drillEditCard,
                      { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={[
                          styles.drillNameInput,
                          { color: colors.textPrimary, borderColor: colors.border },
                        ]}
                        value={drill.name}
                        onChangeText={val => handleUpdateDrill(index, 'name', val)}
                        placeholder={t('masterClasses.lessonPlan.drillNamePlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        testID={`input-drill-name-${index}`}
                      />
                      <TextInput
                        style={[
                          styles.drillDurationInput,
                          { color: colors.textPrimary, borderColor: colors.border },
                        ]}
                        value={String(drill.duration_minutes || '')}
                        onChangeText={val =>
                          handleUpdateDrill(index, 'duration_minutes', parseInt(val, 10) || 0)
                        }
                        placeholder={t('masterClasses.lessonPlan.minsPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        testID={`input-drill-duration-${index}`}
                      />
                      <TouchableOpacity
                        onPress={() => handleRemoveDrill(index)}
                        style={styles.removeDrillBtn}
                        testID={`btn-remove-drill-${index}`}
                      >
                        <Trash2 size={iconSize.sm} color={BrandColors.danger} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[
                        styles.drillInstInput,
                        { color: colors.textPrimary, borderColor: colors.border, marginTop: 6 },
                      ]}
                      value={drill.instructions || ''}
                      onChangeText={val => handleUpdateDrill(index, 'instructions', val)}
                      placeholder={t('masterClasses.lessonPlan.instructionsPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      testID={`input-drill-instructions-${index}`}
                    />
                  </View>
                ))}
              </View>
            </Card>

            {/* Confidential Master Notes (Security & Concurrency Scope) */}
            <Card
              variant="standard"
              style={[styles.privateNotesCard, { borderColor: colors.border, marginTop: spacing.md }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <Lock size={iconSize.sm} color={BrandColors.warning} />
                <Text
                  style={[
                    typography.caption,
                    { fontWeight: '700', color: colors.textPrimary, marginLeft: spacing.xs },
                  ]}
                >
                  {t('masterClasses.lessonPlan.privateNotesLabel')}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textArea,
                  { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.backgroundSecondary },
                ]}
                value={privateMasterNotes}
                onChangeText={setPrivateMasterNotes}
                placeholder={t('masterClasses.lessonPlan.privateNotesPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                testID="input-private-master-notes"
              />
            </Card>

            {/* Save Action */}
            <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
              <Button
                label={saving ? t('masterClasses.lessonPlan.saving') : t('masterClasses.lessonPlan.saveButton', { version: planVersion })}
                onPress={handleSaveLessonPlan}
                variant="primary"
                size="lg"
                disabled={saving || versionConflict}
                leftIcon={saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <CheckCircle size={iconSize.md} color="#FFFFFF" />}
                testID="btn-save-lesson-plan"
              />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  modeTabs: {
    flexDirection: 'row',
    padding: 6,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidentialCard: {
    padding: 12,
    borderWidth: 1,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conflictBanner: {
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    fontSize: 14,
    minHeight: 64,
  },
  addDrillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  drillRow: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
  drillEditCard: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
  drillNameInput: {
    flex: 2,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
  },
  drillDurationInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
    fontSize: 14,
  },
  removeDrillBtn: {
    padding: 6,
    marginLeft: 6,
  },
  drillInstInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  privateNotesCard: {
    padding: 14,
    borderWidth: 1,
  },
  safetyStudentCard: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
});
