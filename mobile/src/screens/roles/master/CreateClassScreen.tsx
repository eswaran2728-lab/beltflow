import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Save, Send } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface CreateClassScreenProps {
  user: AuthUser;
  navigation?: any;
  isOffline?: boolean;
}

export const CreateClassScreen: React.FC<CreateClassScreenProps> = ({
  user,
  navigation,
  isOffline,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [venueDetails, setVenueDetails] = useState('');
  const [schedule, setSchedule] = useState('');
  const [ageEligibility, setAgeEligibility] = useState('7-18 years');
  const [trainingLevel, setTrainingLevel] = useState('Beginner to Intermediate');
  const [programType, setProgramType] = useState('Traditional Silambam');
  const [capacity, setCapacity] = useState('30');
  const [monthlyFee, setMonthlyFee] = useState('120.00');
  const [description, setDescription] = useState('');
  const [contactChannel, setContactChannel] = useState('');
  const enrollmentAvailability = 'OPEN' as const;

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    if (!name.trim()) {
      setValidationError('Class name is required.');
      return false;
    }
    if (!schedule.trim()) {
      setValidationError('Schedule is required.');
      return false;
    }
    if (!location.trim()) {
      setValidationError('Location is required.');
      return false;
    }
    const feeNum = parseFloat(monthlyFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      setValidationError('Monthly fee must be greater than zero.');
      return false;
    }
    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum <= 0) {
      setValidationError('Capacity must be a positive integer.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSaveDraft = async () => {
    if (isOffline) {
      Alert.alert('Offline Mode', 'Creating class proposals requires an active internet connection.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/class-applications', {
        organizationId: user.organizationId,
        name: name.trim(),
        location: location.trim(),
        venueDetails: venueDetails.trim(),
        schedule: schedule.trim(),
        ageEligibility: ageEligibility.trim(),
        trainingLevel: trainingLevel.trim(),
        programType: programType.trim(),
        capacity: parseInt(capacity, 10) || 30,
        monthlyFee: parseFloat(monthlyFee) || 120.0,
        description: description.trim(),
        contactChannel: contactChannel.trim(),
        enrollmentAvailability,
      });

      Alert.alert('Draft Saved', 'Class proposal draft saved successfully.', [
        { text: 'OK', onPress: () => navigation?.goBack?.() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save class proposal draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (isOffline) {
      Alert.alert('Offline Mode', 'Submitting class proposals requires an active internet connection.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create proposal
      const createRes: any = await apiClient.post('/class-applications', {
        organizationId: user.organizationId,
        name: name.trim(),
        location: location.trim(),
        venueDetails: venueDetails.trim(),
        schedule: schedule.trim(),
        ageEligibility: ageEligibility.trim(),
        trainingLevel: trainingLevel.trim(),
        programType: programType.trim(),
        capacity: parseInt(capacity, 10) || 30,
        monthlyFee: parseFloat(monthlyFee) || 120.0,
        description: description.trim(),
        contactChannel: contactChannel.trim(),
        enrollmentAvailability,
      });

      const appId = createRes?.application?.id;
      if (!appId) throw new Error('Failed to create proposal.');

      // 2. Submit for Persatuan review
      await apiClient.post(`/class-applications/${appId}/submit`, {});

      Alert.alert(
        'Proposal Submitted',
        'Your class proposal has been submitted for Persatuan Admin approval.',
        [{ text: 'OK', onPress: () => navigation?.goBack?.() }]
      );
    } catch (err: any) {
      Alert.alert('Submission Error', err?.message || 'Failed to submit proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer scrollable testID="create-class-screen">
      <ScreenHeader
        title="Propose New Class"
        subtitle="Submit a training class for Persatuan approval"
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      {validationError ? (
        <Card variant="standard" style={[styles.errorCard, { backgroundColor: colors.errorBg, marginBottom: spacing.md }]}>
          <Text style={[typography.bodyMedium, { color: colors.errorText }]}>
            {validationError}
          </Text>
        </Card>
      ) : null}

      <Card variant="standard" style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
          Class Information
        </Text>

        <Input
          label="Class Name *"
          placeholder="e.g. Silambam Traditional Weapons"
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (validationError) setValidationError(null);
          }}
          testID="input-class-name"
        />

        <Input
          label="Training Location / Facility *"
          placeholder="e.g. Shah Alam Sports Complex"
          value={location}
          onChangeText={setLocation}
          testID="input-location"
        />

        <Input
          label="Specific Venue / Room Details"
          placeholder="e.g. Court 2, 2nd Floor"
          value={venueDetails}
          onChangeText={setVenueDetails}
          testID="input-venue-details"
        />

        <Input
          label="Training Schedule *"
          placeholder="e.g. Saturday & Sunday 9:00 AM - 10:30 AM"
          value={schedule}
          onChangeText={(val) => {
            setSchedule(val);
            if (validationError) setValidationError(null);
          }}
          testID="input-schedule"
        />

        <Input
          label="Age Eligibility"
          placeholder="e.g. 7-18 years"
          value={ageEligibility}
          onChangeText={setAgeEligibility}
          testID="input-age-eligibility"
        />

        <Input
          label="Training Level Eligibility"
          placeholder="e.g. Beginner, Intermediate, Advanced"
          value={trainingLevel}
          onChangeText={setTrainingLevel}
          testID="input-training-level"
        />

        <Input
          label="Program / Syllabus Type"
          placeholder="e.g. Traditional Forms, Weapons, Sparring"
          value={programType}
          onChangeText={setProgramType}
          testID="input-program-type"
        />

        <Input
          label="Maximum Capacity *"
          placeholder="e.g. 30"
          value={capacity}
          keyboardType="numeric"
          onChangeText={setCapacity}
          testID="input-capacity"
        />

        <Input
          label="Monthly Tuition Fee (RM) *"
          placeholder="e.g. 120.00"
          value={monthlyFee}
          keyboardType="numeric"
          onChangeText={setMonthlyFee}
          testID="input-fee"
        />

        <Input
          label="Class Description"
          placeholder="Provide an overview of training aims and techniques covered..."
          value={description}
          multiline
          numberOfLines={3}
          onChangeText={setDescription}
          testID="input-description"
        />

        <Input
          label="Approved Contact Channel"
          placeholder="e.g. WhatsApp / Phone (+6012...)"
          value={contactChannel}
          onChangeText={setContactChannel}
          testID="input-contact"
        />
      </Card>

      <View style={styles.buttonRow}>
        <Button
          label="Save Draft"
          onPress={handleSaveDraft}
          variant="outline"
          size="lg"
          loading={saving}
          leftIcon={<Save size={iconSize.md} color={colors.textPrimary} />}
          testID="btn-save-class-draft"
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Button
          label="Submit Proposal"
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          loading={submitting}
          leftIcon={<Send size={iconSize.md} color={colors.buttonPrimaryText} />}
          testID="btn-submit-class-proposal"
          style={{ flex: 1, marginLeft: spacing.sm }}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  errorCard: {
    padding: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 40,
  },
});
