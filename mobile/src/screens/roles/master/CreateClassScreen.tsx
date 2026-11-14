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
import { useI18n } from '../../../i18n';

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
  const { t } = useI18n();
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
      setValidationError(t('masterLifecycle.createClass.errorNameRequired'));
      return false;
    }
    if (!schedule.trim()) {
      setValidationError(t('masterLifecycle.createClass.errorScheduleRequired'));
      return false;
    }
    if (!location.trim()) {
      setValidationError(t('masterLifecycle.createClass.errorLocationRequired'));
      return false;
    }
    const feeNum = parseFloat(monthlyFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      setValidationError(t('masterLifecycle.createClass.errorFeePositive'));
      return false;
    }
    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum <= 0) {
      setValidationError(t('masterLifecycle.createClass.errorCapacityPositive'));
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSaveDraft = async () => {
    if (isOffline) {
      Alert.alert(t('masterLifecycle.createClass.offlineTitle'), t('masterLifecycle.createClass.offlineDraft'));
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

      Alert.alert(t('masterLifecycle.createClass.draftSavedTitle'), t('masterLifecycle.createClass.draftSavedBody'), [
        { text: t('masterLifecycle.common.ok'), onPress: () => navigation?.goBack?.() },
      ]);
    } catch (err: any) {
      Alert.alert(t('masterLifecycle.common.error'), err?.message || t('masterLifecycle.createClass.draftSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (isOffline) {
      Alert.alert(t('masterLifecycle.createClass.offlineTitle'), t('masterLifecycle.createClass.offlineSubmit'));
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
      if (!appId) throw new Error(t('masterLifecycle.createClass.createFailed'));

      // 2. Submit for Persatuan review
      await apiClient.post(`/class-applications/${appId}/submit`, {});

      Alert.alert(
        t('masterLifecycle.createClass.submittedTitle'),
        t('masterLifecycle.createClass.submittedBody'),
        [{ text: t('masterLifecycle.common.ok'), onPress: () => navigation?.goBack?.() }]
      );
    } catch (err: any) {
      Alert.alert(t('masterLifecycle.createClass.submitErrorTitle'), err?.message || t('masterLifecycle.createClass.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer scrollable testID="create-class-screen">
      <ScreenHeader
        title={t('masterLifecycle.common.proposeNewClass')}
        subtitle={t('masterLifecycle.createClass.subtitle')}
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
          {t('masterLifecycle.createClass.sectionTitle')}
        </Text>

        <Input
          label={t('masterLifecycle.createClass.nameLabel')}
          placeholder={t('masterLifecycle.createClass.namePlaceholder')}
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (validationError) setValidationError(null);
          }}
          testID="input-class-name"
        />

        <Input
          label={t('masterLifecycle.createClass.locationLabel')}
          placeholder={t('masterLifecycle.createClass.locationPlaceholder')}
          value={location}
          onChangeText={setLocation}
          testID="input-location"
        />

        <Input
          label={t('masterLifecycle.createClass.venueLabel')}
          placeholder={t('masterLifecycle.createClass.venuePlaceholder')}
          value={venueDetails}
          onChangeText={setVenueDetails}
          testID="input-venue-details"
        />

        <Input
          label={t('masterLifecycle.createClass.scheduleLabel')}
          placeholder={t('masterLifecycle.createClass.schedulePlaceholder')}
          value={schedule}
          onChangeText={(val) => {
            setSchedule(val);
            if (validationError) setValidationError(null);
          }}
          testID="input-schedule"
        />

        <Input
          label={t('masterLifecycle.createClass.ageLabel')}
          placeholder={t('masterLifecycle.createClass.agePlaceholder')}
          value={ageEligibility}
          onChangeText={setAgeEligibility}
          testID="input-age-eligibility"
        />

        <Input
          label={t('masterLifecycle.createClass.levelLabel')}
          placeholder={t('masterLifecycle.createClass.levelPlaceholder')}
          value={trainingLevel}
          onChangeText={setTrainingLevel}
          testID="input-training-level"
        />

        <Input
          label={t('masterLifecycle.createClass.programLabel')}
          placeholder={t('masterLifecycle.createClass.programPlaceholder')}
          value={programType}
          onChangeText={setProgramType}
          testID="input-program-type"
        />

        <Input
          label={t('masterLifecycle.createClass.capacityLabel')}
          placeholder={t('masterLifecycle.createClass.capacityPlaceholder')}
          value={capacity}
          keyboardType="numeric"
          onChangeText={setCapacity}
          testID="input-capacity"
        />

        <Input
          label={t('masterLifecycle.createClass.feeLabel')}
          placeholder={t('masterLifecycle.createClass.feePlaceholder')}
          value={monthlyFee}
          keyboardType="numeric"
          onChangeText={setMonthlyFee}
          testID="input-fee"
        />

        <Input
          label={t('masterLifecycle.createClass.descriptionLabel')}
          placeholder={t('masterLifecycle.createClass.descriptionPlaceholder')}
          value={description}
          multiline
          numberOfLines={3}
          onChangeText={setDescription}
          testID="input-description"
        />

        <Input
          label={t('masterLifecycle.createClass.contactLabel')}
          placeholder={t('masterLifecycle.createClass.contactPlaceholder')}
          value={contactChannel}
          onChangeText={setContactChannel}
          testID="input-contact"
        />
      </Card>

      <View style={styles.buttonRow}>
        <Button
          label={t('masterLifecycle.common.saveDraft')}
          onPress={handleSaveDraft}
          variant="outline"
          size="lg"
          loading={saving}
          leftIcon={<Save size={iconSize.md} color={colors.textPrimary} />}
          testID="btn-save-class-draft"
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Button
          label={t('masterLifecycle.createClass.submit')}
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
