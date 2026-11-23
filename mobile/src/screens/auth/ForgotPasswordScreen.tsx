import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info, ShieldAlert, PhoneCall, KeyRound, CircleCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input, PasswordInput } from '../../components/Input';
import { authService } from '../../services/authService';
import { useI18n } from '../../i18n';

const MIN_PASSWORD = 12;

export interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBack }) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!email.trim() || !code.trim() || !password) {
      setError(t('auth.reset.missing'));
      return;
    }
    if (password.trim().length < MIN_PASSWORD) {
      setError(t('auth.reset.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    setError(null);
    setSending(true);
    try {
      await authService.completePasswordReset(email, code, password);
      setPassword('');
      setConfirm('');
      setCode('');
      setDone(true);
    } catch (err: any) {
      const status = Number(err?.status);
      setError(status === 429 ? t('auth.reset.tooMany') : status === 400 ? t('auth.reset.wrongCode') : t('auth.reset.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer scrollable testID="forgot-password-screen">
      <ScreenHeader
        title={t('auth.forgot.title')}
        subtitle={t('auth.forgot.subtitle')}
        onBack={onBack}
        testID="forgot-password-header"
      />

      <View style={[styles.content, { paddingVertical: spacing.lg }]}>
        {/* Notice Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: colors.badgeWarningBg, borderColor: colors.badgeWarningText },
              ]}
            >
              <ShieldAlert size={iconSize.md} color={colors.badgeWarningText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {t('auth.forgot.cardTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.forgot.cardSubtitle')}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[typography.bodyMedium, { color: colors.textPrimary, lineHeight: 22 }]}>
            {t('auth.forgot.policy')}
          </Text>

          <View style={{ height: 16 }} />

          <View style={[styles.bulletRow, { backgroundColor: colors.surfaceElevated }]}>
            <Info size={iconSize.sm} color={colors.buttonPrimaryBg} style={styles.bulletIcon} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {t('auth.forgot.contact')}
            </Text>
          </View>

          <View style={{ height: 12 }} />

          <View style={[styles.bulletRow, { backgroundColor: colors.surfaceElevated }]}>
            <PhoneCall size={iconSize.sm} color={colors.buttonPrimaryBg} style={styles.bulletIcon} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {t('auth.forgot.privacy')}
            </Text>
          </View>
        </Card>


        {/* Reset with a one-time code from the academy administrator */}
        <Card variant="elevated" style={[styles.card, { marginTop: spacing.lg }]} testID="reset-code-card">
          <View style={styles.headerRow}>
            <View style={[styles.iconBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.buttonPrimaryBg }]}>
              {done ? <CircleCheck size={iconSize.md} color={colors.buttonPrimaryBg} /> : <KeyRound size={iconSize.md} color={colors.buttonPrimaryBg} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} accessibilityRole="header">
                {t('auth.reset.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{t('auth.reset.intro')}</Text>
            </View>
          </View>
          {done ? (
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} testID="reset-success" accessibilityLiveRegion="polite">
              {t('auth.reset.success')}
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              <Input
                label={t('auth.reset.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                testID="input-reset-email"
              />
              <Input
                label={t('auth.reset.code')}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t('auth.reset.codePlaceholder')}
                maxLength={20}
                testID="input-reset-code"
              />
              <PasswordInput
                label={t('auth.reset.password')}
                value={password}
                onChangeText={setPassword}
                helperText={t('auth.reset.hint')}
                autoComplete="new-password"
                textContentType="newPassword"
                testID="input-reset-password"
              />
              <PasswordInput
                label={t('auth.reset.confirm')}
                value={confirm}
                onChangeText={setConfirm}
                autoComplete="new-password"
                textContentType="newPassword"
                testID="input-reset-confirm"
              />
              {error ? (
                <Text style={[typography.caption, { color: colors.badgeDangerText }]} testID="reset-error" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <Button
                label={t('auth.reset.submit')}
                onPress={submit}
                loading={sending}
                disabled={sending}
                variant="primary"
                fullWidth
                testID="btn-reset-submit"
              />
            </View>
          )}
        </Card>

        {/* Action Button */}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={t('auth.forgot.back')}
            onPress={onBack}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-forgot-back"
            accessibilityLabel={t('auth.forgot.back')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 4,
  },
  card: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
  },
  bulletIcon: {
    marginRight: 10,
    marginTop: 2,
  },
});
