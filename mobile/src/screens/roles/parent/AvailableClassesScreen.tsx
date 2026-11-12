import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { MapPin, DollarSign, Clock, Users, CheckSquare, Square } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { Input } from '../../../components/Input';
import { LoadingState, EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';
import { useI18n } from '../../../i18n';

export interface AvailableClassCard {
  id: string;
  organizationId: string;
  persatuanName: string;
  name: string;
  schedule: string;
  location: string;
  venueDetails?: string;
  ageEligibility?: string;
  trainingLevel?: string;
  programType?: string;
  capacity: number;
  enrollmentAvailability: 'OPEN' | 'WAITLIST' | 'CLOSED';
  monthlyFee: number;
  description?: string;
  contactChannel?: string;
}

export interface AvailableClassesScreenProps {
  user: AuthUser;
  navigation?: any;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const AvailableClassesScreen: React.FC<AvailableClassesScreenProps> = ({
  user,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize, borderRadius } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<AvailableClassCard[]>([]);

  // Apply Modal state
  const [selectedClass, setSelectedClass] = useState<AvailableClassCard | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('NEW');
  const [studentName, setStudentName] = useState(user.role === 'STUDENT' ? user.fullName : '');
  const [icNumber, setIcNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender] = useState('OTHER');
  const [emergencyName, setEmergencyName] = useState(user.role === 'PARENT' ? user.fullName : '');
  const [emergencyPhone, setEmergencyPhone] = useState(user.phone || '');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const fetchAvailableClasses = useCallback(async () => {
    try {
      const orgId = user.organizationId;
      if (!orgId) {
        setClasses([]);
        return;
      }
      const res: any = await apiClient.get(`/persatuans/${orgId}/available-classes`);
      setClasses(res?.classes || []);
    } catch (err) {
      console.error('[AvailableClassesScreen fetch error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const orgId = user.organizationId;
        if (!orgId) {
          if (!isCancelled) {
            setClasses([]);
          }
          return;
        }
        const res: any = await apiClient.get(`/persatuans/${orgId}/available-classes`);
        if (!isCancelled) {
          setClasses(res?.classes || []);
        }

        if (user.role === 'PARENT') {
          try {
            const dashRes: any = await apiClient.get('/dashboard/parent');
            if (!isCancelled && dashRes?.children) {
              setLinkedChildren(dashRes.children);
              if (dashRes.children.length > 0) {
                setSelectedChildId(dashRes.children[0].id);
                setStudentName(dashRes.children[0].fullName);
              }
            }
          } catch {
            // Optional dashboard load
          }
        }
      } catch (err) {
        console.error('[AvailableClassesScreen load error]', err);
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
  }, [user]);

  const handleOpenApply = (cls: AvailableClassCard) => {
    setSelectedClass(cls);
    setApplyError(null);
    setApplySuccess(null);
    setConsentAccepted(false);
    if (user.role === 'STUDENT') {
      setStudentName(user.fullName);
    } else if (linkedChildren.length > 0 && selectedChildId !== 'NEW') {
      const child = linkedChildren.find(c => c.id === selectedChildId);
      if (child) setStudentName(child.fullName);
    }
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChildId(childId);
    if (childId === 'NEW') {
      setStudentName('');
    } else {
      const child = linkedChildren.find(c => c.id === childId);
      if (child) {
        setStudentName(child.fullName);
      }
    }
  };

  const handleSubmitApplication = async (isDraft: boolean) => {
    if (!selectedClass) return;

    if (!studentName.trim()) {
      setApplyError(t('parentFlows.classes.errorNameRequired'));
      return;
    }

    if (!isDraft && !consentAccepted) {
      setApplyError(t('parentFlows.classes.errorConsent'));
      return;
    }

    setApplySubmitting(true);
    setApplyError(null);

    try {
      const payload: any = {
        classId: selectedClass.id,
        applicantType: user.role === 'PARENT' ? 'PARENT' : 'STUDENT',
        studentName: studentName.trim(),
        icNumber: icNumber.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        gender: gender || undefined,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        consentAccepted: isDraft ? false : consentAccepted,
        isDraft,
      };

      if (user.role === 'PARENT' && selectedChildId !== 'NEW') {
        payload.studentId = selectedChildId;
      }

      await apiClient.post('/enrollment-applications', payload);

      setApplySuccess(
        isDraft
          ? t('parentFlows.classes.draftSaved')
          : t('parentFlows.classes.submitted')
      );
      setTimeout(() => {
        setSelectedClass(null);
        setApplySuccess(null);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('parentFlows.classes.submitFailed');
      setApplyError(msg);
    } finally {
      setApplySubmitting(false);
    }
  };

  if (loading && classes.length === 0) {
    return (
      <ScreenContainer scrollable testID="available-classes-screen">
        <ScreenHeader
          title={t('parentFlows.classes.title')}
          subtitle={t('parentFlows.classes.subtitle')}
          onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
        />
        <LoadingState message={t('parentFlows.classes.loading')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="available-classes-screen">
      <ScreenHeader
        title={t('parentFlows.classes.title')}
        subtitle={t('parentFlows.classes.subtitle')}
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchAvailableClasses(); }} />}
      >
        {classes.length === 0 ? (
          <EmptyState
            title={t('parentFlows.classes.emptyTitle')}
            description={t('parentFlows.classes.emptyDescription')}
            testID="empty-available-classes"
          />
        ) : (
          classes.map((cls) => (
            <Card key={cls.id} variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {cls.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600', marginTop: 2 }]}>
                    {cls.persatuanName}
                  </Text>
                </View>
                <StatusBadge
                  status={cls.enrollmentAvailability === 'OPEN' ? 'ACTIVE' : cls.enrollmentAvailability === 'WAITLIST' ? 'WARNING' : 'REJECTED'}
                  label={cls.enrollmentAvailability}
                  variant={cls.enrollmentAvailability === 'OPEN' ? 'success' : cls.enrollmentAvailability === 'WAITLIST' ? 'warning' : 'danger'}
                />
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Clock size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    {cls.schedule}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <MapPin size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    {cls.location} {cls.venueDetails ? `— ${cls.venueDetails}` : ''}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <DollarSign size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                    {t('parentFlows.classes.feePerMonth', { amount: cls.monthlyFee.toFixed(2) })}
                  </Text>
                </View>

                {cls.ageEligibility || cls.trainingLevel ? (
                  <View style={styles.detailRow}>
                    <Users size={iconSize.sm} color={colors.textSecondary} />
                    <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      {t('parentFlows.classes.eligibility', {
                        age: cls.ageEligibility || t('parentFlows.classes.allAges'),
                        level: cls.trainingLevel || t('parentFlows.classes.allLevels'),
                      })}
                    </Text>
                  </View>
                ) : null}

                {cls.description ? (
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                    {cls.description}
                  </Text>
                ) : null}

                {/* Apply Button */}
                <View style={{ marginTop: spacing.md, alignItems: 'flex-end' }}>
                  <Button
                    label={
                      cls.enrollmentAvailability === 'CLOSED'
                        ? t('parentFlows.classes.classClosed')
                        : cls.enrollmentAvailability === 'WAITLIST'
                        ? t('parentFlows.classes.joinWaitlist')
                        : t('parentFlows.classes.applyToClass')
                    }
                    onPress={() => handleOpenApply(cls)}
                    variant={cls.enrollmentAvailability === 'CLOSED' ? 'outline' : 'primary'}
                    size="sm"
                    disabled={cls.enrollmentAvailability === 'CLOSED'}
                    testID={`btn-apply-${cls.id}`}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Enrollment Application Modal */}
      <Modal
        visible={Boolean(selectedClass)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedClass(null)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={[styles.modalCard, { backgroundColor: colors.surface }]} testID="modal-apply-class">
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 2 }]}>
                {t('parentFlows.classes.applicationTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600', marginBottom: spacing.md }]}>
                {selectedClass?.name} ({selectedClass?.persatuanName})
              </Text>

              {applySuccess ? (
                <View style={[styles.successBox, { backgroundColor: colors.badgeSuccessBg, borderColor: colors.badgeSuccessText }]}>
                  <Text style={[typography.bodyMedium, { color: colors.badgeSuccessText, fontWeight: '700' }]} testID="apply-success-banner">
                    {applySuccess}
                  </Text>
                </View>
              ) : null}

              {applyError ? (
                <View style={[styles.errorBox, { backgroundColor: colors.badgeDangerBg, borderColor: colors.badgeDangerText, marginBottom: spacing.sm }]}>
                  <Text style={[typography.caption, { color: colors.badgeDangerText, fontWeight: '600' }]} testID="apply-error-text">
                    {applyError}
                  </Text>
                </View>
              ) : null}

              {/* Linked Child Selector for Parents */}
              {user.role === 'PARENT' && linkedChildren.length > 0 ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                    {t('parentFlows.classes.selectChild')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {linkedChildren.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => handleChildSelect(c.id)}
                        style={[
                          styles.childChoiceBtn,
                          {
                            backgroundColor: selectedChildId === c.id ? colors.buttonPrimaryBg : colors.surfaceElevated,
                            borderColor: selectedChildId === c.id ? colors.buttonPrimaryBg : colors.border,
                            borderRadius: borderRadius.sm,
                          },
                        ]}
                        testID={`select-child-${c.id}`}
                      >
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: selectedChildId === c.id ? colors.buttonPrimaryText : colors.textPrimary,
                              fontWeight: selectedChildId === c.id ? '700' : '500',
                            },
                          ]}
                        >
                          {c.fullName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => handleChildSelect('NEW')}
                      style={[
                        styles.childChoiceBtn,
                        {
                          backgroundColor: selectedChildId === 'NEW' ? colors.buttonPrimaryBg : colors.surfaceElevated,
                          borderColor: selectedChildId === 'NEW' ? colors.buttonPrimaryBg : colors.border,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                      testID="select-child-new"
                    >
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: selectedChildId === 'NEW' ? colors.buttonPrimaryText : colors.textPrimary,
                            fontWeight: selectedChildId === 'NEW' ? '700' : '500',
                          },
                        ]}
                      >
                        {t('parentFlows.classes.newChild')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Form Inputs */}
              <Input
                label={t('parentFlows.classes.studentNameLabel')}
                placeholder={t('parentFlows.classes.studentNamePlaceholder')}
                value={studentName}
                onChangeText={setStudentName}
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-student-name"
              />

              <Input
                label={t('parentFlows.classes.icLabel')}
                placeholder={t('parentFlows.classes.icPlaceholder')}
                value={icNumber}
                onChangeText={setIcNumber}
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-ic-number"
              />

              <Input
                label={t('parentFlows.classes.dobLabel')}
                placeholder="YYYY-MM-DD"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-date-of-birth"
              />

              <Input
                label={t('parentFlows.classes.emergencyNameLabel')}
                placeholder={t('parentFlows.classes.emergencyNamePlaceholder')}
                value={emergencyName}
                onChangeText={setEmergencyName}
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-emergency-name"
              />

              <Input
                label={t('parentFlows.classes.emergencyPhoneLabel')}
                placeholder={t('parentFlows.classes.emergencyPhonePlaceholder')}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-emergency-phone"
              />

              <Input
                label={t('parentFlows.classes.medicalLabel')}
                placeholder={t('parentFlows.classes.medicalPlaceholder')}
                value={medicalNotes}
                onChangeText={setMedicalNotes}
                multiline
                numberOfLines={2}
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-medical-notes"
              />

              <Input
                label={t('parentFlows.classes.notesLabel')}
                placeholder={t('parentFlows.classes.notesPlaceholder')}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                containerStyle={{ marginBottom: spacing.sm }}
                testID="input-additional-notes"
              />

              {/* Consent Checkbox */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConsentAccepted(!consentAccepted)}
                style={[styles.consentBox, { borderColor: colors.border, marginBottom: spacing.md }]}
                testID="checkbox-consent"
              >
                {consentAccepted ? (
                  <CheckSquare size={iconSize.md} color={colors.buttonPrimaryBg} />
                ) : (
                  <Square size={iconSize.md} color={colors.textSecondary} />
                )}
                <Text style={[typography.caption, { color: colors.textPrimary, flex: 1, marginLeft: spacing.xs }]}>
                  {t('parentFlows.classes.consent')}
                </Text>
              </TouchableOpacity>

              {/* Modal Actions */}
              <View style={[styles.modalActionsRow, { gap: spacing.xs }]}>
                <Button
                  label={t('parentFlows.common.cancel')}
                  onPress={() => setSelectedClass(null)}
                  variant="outline"
                  size="md"
                  style={{ flex: 1 }}
                  testID="btn-cancel-apply"
                />
                <Button
                  label={t('parentFlows.classes.saveDraft')}
                  onPress={() => void handleSubmitApplication(true)}
                  variant="secondary"
                  size="md"
                  style={{ flex: 1 }}
                  disabled={applySubmitting}
                  testID="btn-save-draft"
                />
                <Button
                  label={applySubmitting ? t('parentFlows.common.submitting') : t('parentFlows.classes.submit')}
                  onPress={() => void handleSubmitApplication(false)}
                  variant="primary"
                  size="md"
                  style={{ flex: 1 }}
                  disabled={applySubmitting}
                  testID="btn-submit-application"
                />
              </View>
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailsGrid: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 18,
    borderRadius: 12,
  },
  childChoiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  consentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  modalActionsRow: {
    flexDirection: 'row',
  },
  successBox: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBox: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
});
