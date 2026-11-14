import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Hand, UserCheck } from 'lucide-react-native';
import { StitchTokens } from '../theme/tokens';
import { useI18n } from '../i18n';

/**
 * H28 pending_approval_next_step_clear: tells the person waiting on an
 * approval who decides, what happens next and what they can do now, in
 * plain language and in the app's language. Renders nothing for finished
 * states (approved, withdrawn, active).
 */
export type PendingKind =
  | 'MASTER_APPLICATION'
  | 'CLASS_PROPOSAL'
  | 'ENROLLMENT_APPLICATION'
  | 'PAYMENT'
  | 'MAKE_UP_BOOKING'
  | 'PAUSE_REQUEST'
  | 'TRANSFER_REQUEST'
  | 'HANDOVER';

// Waiting states only. Who decides and the timings come from the server
// routes (see nextStepCardsH28.test.tsx for the references).
const STATUSES_WITH_NEXT_STEP: Record<PendingKind, string[]> = {
  MASTER_APPLICATION: ['DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'REJECTED'],
  CLASS_PROPOSAL: ['DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'REJECTED'],
  ENROLLMENT_APPLICATION: ['DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'WAITLISTED', 'REJECTED'],
  PAYMENT: ['REQUIRES_PAYMENT_METHOD', 'PENDING_PROCESSING'],
  MAKE_UP_BOOKING: ['REQUESTED', 'WAITLISTED', 'OFFERED'],
  PAUSE_REQUEST: ['REQUESTED'],
  TRANSFER_REQUEST: ['PENDING_RECEIVING', 'REQUESTED', 'PENDING_OLD_MASTER', 'PENDING_NEW_MASTER'],
  HANDOVER: ['REQUESTED', 'INCOMING_ACCEPTED'],
};

export const hasNextStep = (kind: PendingKind, status: string) =>
  STATUSES_WITH_NEXT_STEP[kind].includes(String(status).toUpperCase());

export interface PendingNextStepProps {
  kind: PendingKind;
  status: string;
  testID?: string;
}

export const PendingNextStep: React.FC<PendingNextStepProps> = ({ kind, status, testID }) => {
  const { t } = useI18n();
  const code = String(status).toUpperCase();
  if (!hasNextStep(kind, code)) return null;

  // A status can name a different decision maker than the kind as a whole.
  const statusWhoKey = `pending.${kind}.${code}.who`;
  const statusWho = t(statusWhoKey);
  const whoText = statusWho === statusWhoKey ? t(`pending.${kind}.who`) : statusWho;

  const rows: { part: 'who' | 'next' | 'action'; label: string; text: string; Icon: typeof UserCheck }[] = [
    { part: 'who', label: t('pending.whoReviews'), text: whoText, Icon: UserCheck },
    { part: 'next', label: t('pending.whatNext'), text: t(`pending.${kind}.${code}.next`), Icon: ArrowRight },
    { part: 'action', label: t('pending.whatYouCanDo'), text: t(`pending.${kind}.${code}.action`), Icon: Hand },
  ];

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title} accessibilityRole="header">{t('pending.title')}</Text>
      {rows.map(({ part, label, text, Icon }) => (
        <View key={part} style={styles.row}>
          <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon size={16} color={StitchTokens.colors.brandNavy} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.body} testID={testID ? `${testID}-${part}` : undefined}>{text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const c = StitchTokens.colors;
const styles = StyleSheet.create({
  card: {
    marginTop: StitchTokens.spacing.md,
    padding: StitchTokens.spacing.cardPad,
    borderRadius: StitchTokens.radii.cardMini,
    backgroundColor: c.brandNavyTint,
    borderWidth: 1,
    borderColor: c.slateBorder,
  },
  title: { fontSize: StitchTokens.typography.sizes.bodyLg, fontWeight: '800', color: c.brandNavy, marginBottom: StitchTokens.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: StitchTokens.spacing.sm },
  icon: { width: 22, paddingTop: 2 },
  rowText: { flex: 1, flexShrink: 1 },
  label: { fontSize: StitchTokens.typography.sizes.caption, fontWeight: '700', color: c.slateTextMuted, textTransform: 'uppercase' },
  body: { fontSize: StitchTokens.typography.sizes.body, color: c.slateTextMain, lineHeight: 20, marginTop: 2 },
});

export default PendingNextStep;
