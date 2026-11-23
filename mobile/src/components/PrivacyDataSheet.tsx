import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Download, ExternalLink } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';
import { getApiBaseUrl } from '../config/env';
import { Button } from './Button';
import { Card } from './Card';
import { StaffPrivacyRequests } from './StaffPrivacyRequests';
import { privacyService, MyData, PrivacyRequest, PrivacyRequestType } from '../services/privacyService';

/**
 * "Privacy and my data" (Malaysia PDPA): share a copy of my data, ask for
 * deletion, correction or withdrawal of consent, and see my requests.
 * Requests are carried out by the academy's administrator on the server.
 */
export interface PrivacyDataSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The signed-in role. Administrators also see the requests they handle. */
  role?: string | null;
}

const TYPES: PrivacyRequestType[] = ['CORRECT', 'DELETE', 'WITHDRAW_CONSENT'];

export const PrivacyDataSheet: React.FC<PrivacyDataSheetProps> = ({ visible, onClose, role }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { t } = useI18n();

  const [myData, setMyData] = useState<MyData | null>(null);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  // True until the first answer arrives; reset when the sheet closes.
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<PrivacyRequestType>('CORRECT');
  const [childId, setChildId] = useState<string>('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  // Load my data and my requests each time the sheet opens. An answer that
  // arrives after the sheet has closed is ignored.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    Promise.all([
      privacyService.getMyData().catch(() => null),
      privacyService.listMyRequests().catch(() => [] as PrivacyRequest[]),
    ]).then(([data, mine]) => {
      if (!active) return;
      setMyData(data);
      setRequests(mine);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  // The form starts fresh next time: reset when the sheet closes.
  const close = () => {
    setType('CORRECT');
    setChildId('');
    setDetails('');
    setLoading(true);
    onClose();
  };

  const children = myData?.children || [];

  const shareMyData = async () => {
    const data = myData || (await privacyService.getMyData().catch(() => null));
    if (!data) {
      Alert.alert(t('privacy.share.title'), t('privacy.share.failed'));
      return;
    }
    await Share.share({ title: 'beltflow-my-data.json', message: JSON.stringify(data, null, 2) }).catch(() => undefined);
  };

  const send = async () => {
    setSending(true);
    try {
      await privacyService.createRequest({ type, details, studentId: childId || undefined });
      setDetails('');
      Alert.alert(t('privacy.request.sentTitle'), t('privacy.request.sent'));
      setRequests(await privacyService.listMyRequests().catch(() => requests));
    } catch (err: any) {
      const code = err?.details?.code;
      Alert.alert(
        t('privacy.request.failedTitle'),
        code === 'REQUEST_ALREADY_OPEN' ? t('privacy.request.alreadyOpen') : t('privacy.request.failed')
      );
    } finally {
      setSending(false);
    }
  };

  const onSend = () => {
    if (type !== 'DELETE') {
      void send();
      return;
    }
    // Deletion cannot be undone once carried out: ask first.
    Alert.alert(t('privacy.confirmDelete.title'), t('privacy.confirmDelete.body'), [
      { text: t('privacy.confirmDelete.cancel'), style: 'cancel' },
      { text: t('privacy.confirmDelete.confirm'), style: 'destructive', onPress: () => void send() },
    ]);
  };

  const option = (selected: boolean, label: string, onPress: () => void, testID: string) => (
    <TouchableOpacity
      key={testID}
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.option,
        {
          borderColor: selected ? colors.buttonPrimaryBg : colors.border,
          backgroundColor: selected ? colors.surfaceHighlight : colors.surface,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <View
        style={[styles.radio, { borderColor: selected ? colors.buttonPrimaryBg : colors.textMuted }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.buttonPrimaryBg }]} /> : null}
      </View>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
    </TouchableOpacity>
  );

  const formatDate = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="privacy-data-sheet">
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, flex: 1 }]} accessibilityRole="header">
            {t('privacy.entry.title')}
          </Text>
          <TouchableOpacity
            onPress={close}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('privacy.sheet.close')}
            testID="btn-privacy-close"
          >
            <X size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>{t('privacy.sheet.intro')}</Text>
          <TouchableOpacity
            onPress={() => {
              Linking.openURL(`${getApiBaseUrl()}/legal/privacy.html`).catch(() => undefined);
            }}
            accessibilityRole="link"
            testID="link-privacy-notice"
            style={styles.linkRow}
          >
            <ExternalLink size={16} color={colors.buttonPrimaryBg} />
            <Text style={[typography.bodyMedium, { color: colors.buttonPrimaryBg, fontWeight: '700', textDecorationLine: 'underline' }]}>
              {t('privacy.notice.link')}
            </Text>
          </TouchableOpacity>

          {/* My data */}
          <Card variant="standard">
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} accessibilityRole="header">
              {t('privacy.share.title')}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginVertical: spacing.sm }]}>
              {t('privacy.share.body')}
            </Text>
            <Button
              label={t('privacy.share.button')}
              variant="outline"
              onPress={() => void shareMyData()}
              leftIcon={<Download size={18} color={colors.textPrimary} />}
              testID="btn-privacy-share-data"
            />
          </Card>

          {/* Make a request */}
          <Card variant="standard">
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} accessibilityRole="header">
              {t('privacy.request.title')}
            </Text>
            <Text style={[typography.caption, styles.label, { color: colors.textSecondary }]}>{t('privacy.request.typeLabel')}</Text>
            <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
              {TYPES.map(k => option(type === k, t(`privacy.request.type.${k}`), () => setType(k), `privacy-type-${k}`))}
            </View>

            {children.length > 0 ? (
              <>
                <Text style={[typography.caption, styles.label, { color: colors.textSecondary }]}>{t('privacy.request.childLabel')}</Text>
                <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
                  {option(childId === '', t('privacy.request.childNone'), () => setChildId(''), 'privacy-child-none')}
                  {children.map(c => option(childId === c.id, c.fullName, () => setChildId(c.id), `privacy-child-${c.id}`))}
                </View>
              </>
            ) : null}

            <Text style={[typography.caption, styles.label, { color: colors.textSecondary }]} nativeID="privacyDetailsLabel">
              {t('privacy.request.detailsLabel')}
            </Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('privacy.request.detailsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              accessibilityLabel={t('privacy.request.detailsLabel')}
              accessibilityLabelledBy="privacyDetailsLabel"
              testID="input-privacy-details"
              style={[
                typography.bodyMedium,
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: borderRadius.md },
              ]}
            />

            {type === 'DELETE' ? (
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>{t('privacy.request.deleteNote')}</Text>
            ) : null}

            <Button
              label={t('privacy.request.send')}
              onPress={onSend}
              loading={sending}
              style={{ marginTop: spacing.md }}
              testID="btn-privacy-send"
            />
          </Card>

          {/* My requests */}
          <Card variant="standard">
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]} accessibilityRole="header">
              {t('privacy.mine.title')}
            </Text>
            {loading && requests.length === 0 ? (
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm }]}>{t('privacy.loading')}</Text>
            ) : requests.length === 0 ? (
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm }]}>{t('privacy.mine.empty')}</Text>
            ) : (
              requests.map(r => (
                <View key={r.id} style={[styles.requestRow, { borderTopColor: colors.borderLight }]}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                    {t(`privacy.request.type.${r.type}`)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textPrimary }]} testID={`privacy-request-status-${r.id}`}>
                    {t(`privacy.status.${r.status}`)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('privacy.mine.dates', { sent: formatDate(r.createdAt), due: formatDate(r.dueAt) })}
                  </Text>
                  {r.details ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{r.details}</Text> : null}
                  {r.resolutionNote ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('privacy.mine.answer', { note: r.resolutionNote })}</Text>
                  ) : null}
                </View>
              ))
            )}
          </Card>
          {visible ? <StaffPrivacyRequests role={role} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  label: {
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  input: {
    borderWidth: 1.5,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  requestRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
    gap: 2,
  },
});
