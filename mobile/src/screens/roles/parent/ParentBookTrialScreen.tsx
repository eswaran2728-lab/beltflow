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

  const orgId = route?.params?.targetOrganizationId || user.organizationId || '';
  const classId = route?.params?.targetClassId || 'cls_default';
  const className = route?.params?.targetClassName || 'Trial Session';

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
      Alert.alert('Required Field', 'Please enter the candidate student name.');
      return;
    }
    if (!guardianPhone.trim()) {
      Alert.alert('Required Field', 'Please provide a guardian contact phone number.');
      return;
    }
    if (!consentAccepted) {
      Alert.alert('Consent Required', 'You must accept the legal and martial arts safety consent.');
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
      Alert.alert('Trial Booked!', `Your trial session has been reserved for ${scheduledDate}.`);
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.message || 'Could not complete trial booking.');
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
        title="Book Martial Arts Trial"
        subtitle="Reserve a zero-obligation introductory trial session"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {bookedTrial ? (
          <Card style={styles.successCard}>
            <View style={styles.successIconWrapper}>
              <CheckCircle2 size={48} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Trial Confirmed!</Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              Booking Ref: {bookedTrial.id}
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>Candidate: </Text>
                {bookedTrial.candidate_name}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>Class: </Text>
                {className}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>Scheduled Date: </Text>
                {bookedTrial.scheduled_date}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryBold}>Contact: </Text>
                {bookedTrial.guardian_phone}
              </Text>
            </View>

            <View style={styles.instructionsBox}>
              <Info size={16} color="#F2941C" />
              <Text style={styles.instructionsText}>
                Please arrive 15 minutes before session time in comfortable sportswear. The assigned Master will introduce basic stances and assess readiness.
              </Text>
            </View>

            <Button label="Book Another Trial" onPress={handleReset} variant="outline" />
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Candidate Information</Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Candidate Full Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="e.g. Aiman bin Razak"
              placeholderTextColor={colors.textMuted}
              value={candidateName}
              onChangeText={setCandidateName}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Age</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="e.g. 10"
              placeholderTextColor={colors.textMuted}
              value={candidateAge}
              onChangeText={setCandidateAge}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Trial Session Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              value={scheduledDate}
              onChangeText={setScheduledDate}
              placeholder="2026-10-25"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.formTitle, { color: colors.textPrimary, marginTop: 16 }]}>
              Guardian & Emergency Contact
            </Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Guardian Name</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="e.g. Puan Siti"
              placeholderTextColor={colors.textMuted}
              value={guardianName}
              onChangeText={setGuardianName}
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Primary Phone Number *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="e.g. 0123456789"
              placeholderTextColor={colors.textMuted}
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Emergency Contact Phone</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="e.g. 0198765432"
              placeholderTextColor={colors.textMuted}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Medical Disclosures / Injuries / Notes</Text>
            <TextInput
              style={[styles.inputMulti, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Disclose any asthma, past joint injuries, or allergies..."
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
                I confirm I am the legal parent/guardian. I authorize the candidate to participate in this introductory martial arts trial class under the supervision of academy certified instructors.
              </Text>
            </View>

            <Button
              label={submitting ? 'Reserving...' : 'Confirm Trial Booking'}
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
