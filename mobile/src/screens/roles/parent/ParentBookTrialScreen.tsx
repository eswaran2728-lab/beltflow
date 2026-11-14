import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { CheckCircle2, ShieldCheck, Info } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { trialsService, TrialBooking } from '../../../services/trialsService';
import { useI18n } from '../../../i18n';

export interface ParentBookTrialScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
  route?: {
    params?: {
      targetClassId?: string;
      targetClassName?: string;
      targetOrganizationId?: string;
    };
  };
}

export const ParentBookTrialScreen: React.FC<ParentBookTrialScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
  route,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();

  const orgId = route?.params?.targetOrganizationId || user.organizationId || '';
  const classId = route?.params?.targetClassId || 'cls_default';
  const className = route?.params?.targetClassName || t('parentFlows.trial.defaultClassName');

  const [candidateName, setCandidateName] = useState<string>('');
  const [candidateAge, setCandidateAge] = useState<string>('');
  const [guardianName, setGuardianName] = useState<string>(user.fullName || '');
  const [guardianPhone, setGuardianPhone] = useState<string>(user.phone || '');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(
    () => new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [medicalNotes, setMedicalNotes] = useState<string>('');
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [bookedTrial, setBookedTrial] = useState<TrialBooking | null>(null);

  const handleBook = async () => {
    if (!candidateName.trim()) {
      Alert.alert(t('parentFlows.common.requiredField'), t('parentFlows.trial.nameRequired'));
      return;
    }
    if (!guardianPhone.trim()) {
      Alert.alert(t('parentFlows.common.requiredField'), t('parentFlows.trial.phoneRequired'));
      return;
    }
    if (!consentAccepted) {
      Alert.alert(t('parentFlows.trial.consentRequiredTitle'), t('parentFlows.trial.consentRequiredMessage'));
      return;
    }

    setSubmitting(true);
    try {
      const trial = await trialsService.bookTrial({
        organizationId: orgId,
        classId,
        scheduledDate,
        candidateName: candidateName.trim(),
        candidateAge: candidateAge ? parseInt(candidateAge, 10) : undefined,
        guardianName: guardianName.trim(),
        guardianEmail: user.email,
        guardianPhone: guardianPhone.trim(),
        emergencyPhone: emergencyPhone.trim() || undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        consentAccepted: true,
      });

      setBookedTrial(trial);
      Alert.alert(t('parentFlows.trial.bookedTitle'), t('parentFlows.trial.bookedMessage', { date: scheduledDate }));
    } catch (err: any) {
      Alert.alert(t('parentFlows.trial.bookingFailedTitle'), err?.message || t('parentFlows.trial.bookingFailedMessage'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setBookedTrial(null);
    setCandidateName('');
    setCandidateAge('');
    setMedicalNotes('');
    setConsentAccepted(false);
  };

  return (
    <ScreenContainer>
      <ScreenHeader
        title={t('parentFlows.trial.title')}
        subtitle={t('parentFlows.trial.subtitle')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {bookedTrial ? (
          <Card style={styles.successCard}>
            <View style={styles.successIconWrapper}>
              <CheckCircle2 size={48} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>{t('parentFlows.trial.confirmedTitle')}</Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              {t('parentFlows.trial.bookingRef', { id: bookedTrial.id })}
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>{t('parentFlows.trial.summaryCandidate')}</Text>
                {bookedTrial.candidate_name}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>{t('parentFlows.trial.summaryClass')}</Text>
                {className}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>{t('parentFlows.trial.summaryDate')}</Text>
                {bookedTrial.scheduled_date}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>{t('parentFlows.trial.summaryContact')}</Text>
                {bookedTrial.guardian_phone}
              </Text>
            </View>

            <View style={styles.instructionsBox}>
              <Info size={16} color="#F2941C" />
              <Text style={styles.instructionsText}>
                {t('parentFlows.trial.instructions')}
              </Text>
            </View>

            <Button label={t('parentFlows.trial.bookAnother')} onPress={handleReset} variant="outline" />
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>{t('parentFlows.trial.candidateInfo')}</Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.candidateNameLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('parentFlows.trial.candidateNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={candidateName}
              onChangeText={setCandidateName}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.ageLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('parentFlows.trial.agePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={candidateAge}
              onChangeText={setCandidateAge}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.dateLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              value={scheduledDate}
              onChangeText={setScheduledDate}
              placeholder="2026-10-25"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.formTitle, { color: colors.textPrimary, marginTop: 16 }]}>
              {t('parentFlows.trial.guardianSection')}
            </Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.guardianNameLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('parentFlows.trial.guardianNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={guardianName}
              onChangeText={setGuardianName}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.primaryPhoneLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('parentFlows.trial.primaryPhonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.emergencyPhoneLabel')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('parentFlows.trial.emergencyPhonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('parentFlows.trial.medicalLabel')}</Text>
            <TextInput
              style={[styles.inputMulti, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('parentFlows.trial.medicalPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={medicalNotes}
              onChangeText={setMedicalNotes}
              multiline
              numberOfLines={3}
            />

            {/* Legal Consent Checkbox */}
            <View style={styles.consentRow}>
              <Switch
                value={consentAccepted}
                onValueChange={setConsentAccepted}
                trackColor={{ false: '#153C61', true: '#F2941C' }}
                thumbColor={consentAccepted ? '#FFF' : '#A0AEC0'}
              />
              <Text style={[styles.consentText, { color: colors.textPrimary }]}>
                {t('parentFlows.trial.consent')}
              </Text>
            </View>

            <Button
              label={submitting ? t('parentFlows.trial.reserving') : t('parentFlows.trial.confirmBooking')}
              onPress={handleBook}
              disabled={submitting || isOffline}
              variant="primary"
              leftIcon={<ShieldCheck size={18} color="#FFF" />}
            />
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    padding: 18,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMulti: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#061828',
    borderRadius: 8,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  successCard: {
    padding: 24,
    alignItems: 'center',
  },
  successIconWrapper: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  summaryBox: {
    width: '100%',
    padding: 14,
    backgroundColor: '#061828',
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  summaryLine: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  summaryBold: {
    fontWeight: '700',
    color: '#FFF',
  },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#0D2B47',
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionsText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
});
