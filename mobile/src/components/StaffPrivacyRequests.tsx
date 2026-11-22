import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';
import { Card } from './Card';
import { Button } from './Button';
import { privacyService, StaffPrivacyRequest } from '../services/privacyService';

/**
 * Data requests an administrator must answer (Malaysia PDPA).
 * Shown only to a Persatuan Admin or Super Admin; the server decides which
 * requests each one handles and checks every answer again.
 */
const STAFF_ROLES = ['ADMIN_PERSATUAN', 'SUPER_ADMIN'];

export const StaffPrivacyRequests: React.FC<{ role?: string | null }> = ({ role }) => {
  const isStaff = Boolean(role && STAFF_ROLES.includes(role));
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { t, locale } = useI18n();
  const [requests, setRequests] = useState<StaffPrivacyRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isStaff) return;
    let active = true;
    privacyService.listRequestsToHandle().then(
      list => {
        if (!active) return;
        setRequests(list);
        setFailed(false);
      },
      () => {
        if (active) setFailed(true);
      }
    );
    return () => {
      active = false;
    };
  }, [isStaff, attempt]);

  if (!isStaff) return null;

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(locale === 'ms' ? 'ms-MY' : locale === 'ta' ? 'ta-MY' : 'en-MY');
    } catch {
      return iso.slice(0, 10);
    }
  };

  const resolve = async (r: StaffPrivacyRequest, action: 'COMPLETE' | 'REJECT') => {
    setBusy(r.id);
    try {
      await privacyService.resolveRequest(r.id, action, notes[r.id]);
      Alert.alert(t('privacy.staff.doneTitle'), action === 'COMPLETE' ? t('privacy.status.COMPLETED') : t('privacy.status.REJECTED'));
      setNotes(n => ({ ...n, [r.id]: '' }));
      setAttempt(a => a + 1);
    } catch (err: any) {
      const code = err?.details?.code;
      Alert.alert(t('privacy.staff.failedTitle'), code === 'REQUEST_ALREADY_RESOLVED' ? t('privacy.staff.alreadyResolved') : t('privacy.staff.resolveFailed'));
      if (code === 'REQUEST_ALREADY_RESOLVED') setAttempt(a => a + 1);
    } finally {
      setBusy(null);
    }
  };

  const onComplete = (r: StaffPrivacyRequest) => {
    if (r.type !== 'DELETE') {
      void resolve(r, 'COMPLETE');
      return;
    }
    // Deletion cannot be undone: ask first.
    Alert.alert(t('privacy.staff.deleteTitle'), t('privacy.staff.deleteBody'), [
      { text: t('privacy.staff.cancel'), style: 'cancel' },
      { text: t('privacy.staff.deleteConfirm'), style: 'destructive', onPress: () => resolve(r, 'COMPLETE') },
    ]);
  };

  const onRefuse = (r: StaffPrivacyRequest) => {
    if (!(notes[r.id] || '').trim()) {
      Alert.alert(t('privacy.staff.failedTitle'), t('privacy.staff.reasonNeeded'));
      return;
    }
    void resolve(r, 'REJECT');
  };

  const roleLabel = (code: string) => {
    const key = `privacy.staff.role.${code}`;
    const label = t(key);
    return label === key ? code : label;
  };

  return (
    <Card style={{ marginTop: spacing.md }} testID="staff-privacy-requests">
      <Text style={[typography.titleMedium, { color: colors.textPrimary }]} accessibilityRole="header">
        {t('privacy.staff.title')}
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>{t('privacy.staff.intro')}</Text>

      {failed ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>{t('privacy.staff.failed')}</Text>
          <Button label={t('privacy.staff.retry')} variant="outline" onPress={() => setAttempt(a => a + 1)} testID="btn-staff-privacy-retry" />
        </View>
      ) : requests === null ? (
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm }]}>{t('privacy.staff.loading')}</Text>
      ) : requests.length === 0 ? (
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm }]} testID="staff-privacy-empty">
          {t('privacy.staff.empty')}
        </Text>
      ) : (
        requests.map(r => (
          <View key={r.id} style={[styles.row, { borderTopColor: colors.border }]} testID={`staff-privacy-${r.id}`}>
            <Text style={[typography.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{r.requester?.name}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {t('privacy.staff.from', { role: roleLabel(r.requester?.role) })}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4 }]}>
              {t(`privacy.request.type.${r.type}`)}
              {'  '}
              {t(`privacy.status.${r.status}`)}
            </Text>
            <Text style={[typography.caption, { color: r.overdue ? colors.badgeDangerText : colors.textSecondary }]}>
              {t('privacy.staff.due', { date: formatDate(r.dueAt) })}
            </Text>
            {r.overdue ? (
              <Text style={[typography.caption, { color: colors.badgeDangerText, fontWeight: '700' }]} testID={`staff-privacy-overdue-${r.id}`}>
                {t('privacy.staff.overdue')}
              </Text>
            ) : null}
            {r.details ? (
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{t('privacy.staff.details', { details: r.details })}</Text>
            ) : null}
            {r.status !== 'OPEN' && r.resolutionNote ? (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('privacy.mine.answer', { note: r.resolutionNote })}</Text>
            ) : null}

            {r.status === 'OPEN' ? (
              <View style={{ marginTop: spacing.sm }}>
                {r.type === 'CORRECT' ? (
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}>{t('privacy.staff.correctHint')}</Text>
                ) : null}
                <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700', marginBottom: 6 }]}>
                  {t('privacy.staff.noteLabel')}
                </Text>
                <TextInput
                  value={notes[r.id] || ''}
                  onChangeText={v => setNotes(n => ({ ...n, [r.id]: v }))}
                  placeholder={t('privacy.staff.notePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  maxLength={1000}
                  multiline
                  accessibilityLabel={t('privacy.staff.noteLabel')}
                  testID={`input-staff-privacy-note-${r.id}`}
                  style={[styles.input, { borderColor: colors.border, borderRadius: borderRadius.md, color: colors.textPrimary, backgroundColor: colors.surface }]}
                />
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('privacy.staff.complete')}
                      onPress={() => onComplete(r)}
                      disabled={busy === r.id}
                      testID={`btn-staff-privacy-complete-${r.id}`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('privacy.staff.refuse')}
                      variant="outline"
                      onPress={() => onRefuse(r)}
                      disabled={busy === r.id}
                      testID={`btn-staff-privacy-refuse-${r.id}`}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 2 },
  input: { borderWidth: 1.5, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
