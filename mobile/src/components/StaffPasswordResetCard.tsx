import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { authService } from '../services/authService';

/**
 * Staff create a one-time password reset code for someone they look after.
 * The server decides whose code each role may create (Admin: own Persatuan's
 * Masters, parents and students; Super Admin: Persatuan Admins) and answers a
 * refusal the same way whether the account exists or not.
 */
export const StaffPasswordResetCard: React.FC<{ role?: string | null }> = ({ role }) => {
  const { colors, typography, spacing, iconSize, borderRadius } = useTheme();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (role !== 'ADMIN_PERSATUAN' && role !== 'SUPER_ADMIN') return null;

  const submit = async () => {
    if (!email.trim()) {
      setError(t('auth.issue.missing'));
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await authService.issuePasswordResetCode(email);
      setIssued({ code: res.code, expiresAt: res.expiresAt });
      setEmail('');
    } catch (err: any) {
      const status = Number(err?.status);
      setError(status === 403 || status === 400 ? t('auth.issue.refused') : t('auth.issue.failed'));
    } finally {
      setSending(false);
    }
  };

  const time = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(locale === 'ms' ? 'ms-MY' : locale === 'ta' ? 'ta-MY' : 'en-MY', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <Card style={{ marginTop: spacing.md }} testID="staff-password-reset">
      <View style={styles.headerRow}>
        <KeyRound size={iconSize.md} color={colors.buttonPrimaryBg} />
        <Text style={[typography.titleMedium, { color: colors.textPrimary, flex: 1 }]} accessibilityRole="header">
          {t('auth.issue.title')}
        </Text>
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
        {role === 'SUPER_ADMIN' ? t('auth.issue.introSuper') : t('auth.issue.introAdmin')}
      </Text>
      {issued ? (
        <View style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('auth.issue.codeLabel')}</Text>
          <View style={[styles.codeBox, { borderColor: colors.buttonPrimaryBg, borderRadius: borderRadius.md, backgroundColor: colors.surfaceElevated }]}>
            <Text selectable style={[typography.sectionHeading, styles.code, { color: colors.textPrimary }]} testID="issued-code">
              {issued.code}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            {t('auth.issue.expires', { time: time(issued.expiresAt) })}
          </Text>
          <Button label={t('auth.issue.done')} variant="outline" onPress={() => setIssued(null)} testID="btn-issue-done" />
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm, gap: 10 }}>
          <Input
            label={t('auth.issue.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input-issue-email"
          />
          {error ? (
            <Text style={[typography.caption, { color: colors.badgeDangerText }]} testID="issue-error" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={t('auth.issue.submit')} onPress={submit} loading={sending} disabled={sending} testID="btn-issue-submit" />
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeBox: { borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', marginVertical: 8 },
  code: { letterSpacing: 2 },
});
