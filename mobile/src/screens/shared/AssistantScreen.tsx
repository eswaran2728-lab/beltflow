import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ban, CircleCheck, FileText, Info, RotateCcw, Send, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react-native';
import { StitchAppHeader } from '../../components/stitch';
import { StitchTokens } from '../../theme/tokens';
import { AuthUser } from '../../types/auth';
import { ApiError } from '../../services/apiClient';
import { AssistantAnswer, assistantService } from '../../services/assistantService';
import {
  ASSISTANT_STRINGS, AnswerStatus, AssistantLocale, AssistantStrings, sourceTypeLabel,
} from '../../i18n/assistantStrings';
import { useI18n } from '../../i18n';

/**
 * H26 Role-Aware Grounded AI assistant screen (all five roles).
 *
 * - Read-only. It only sends questions; it has no action buttons.
 * - Conversation history lives in component state for this screen session
 *   only. Nothing is written to storage.
 * - Every answer shows a text status label (not colour alone) and the
 *   sources the server cited. The app never invents answer text: it shows
 *   exactly what the server returned.
 */
export interface AssistantScreenProps {
  user: AuthUser;
  isOffline?: boolean;
  /** Optional narrowing for a Parent with several children. */
  studentId?: string;
}

type ChatEntry =
  | { id: string; kind: 'question'; text: string }
  | { id: string; kind: 'answer'; question: string; answer: AssistantAnswer }
  | { id: string; kind: 'error'; question: string; message: string };

const LOCALES: AssistantLocale[] = ['en', 'ms', 'ta'];
const MAX_QUERY_CHARS = 500;

function errorMessage(err: unknown, t: AssistantStrings): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError || err.isTimeout) return t.errors.network;
    if (err.status === 429) return t.errors.rateLimited;
    if (err.status === 503) return t.errors.unavailable;
    if (err.status === 403) return t.errors.forbidden;
    if (err.status === 404) return t.errors.disabled;
  }
  return t.errors.generic;
}

const STATUS_STYLE: Record<AnswerStatus, { fg: string; bg: string; Icon: typeof Info }> = {
  ANSWERED: { fg: StitchTokens.colors.bfGreenDark, bg: StitchTokens.colors.bfGreenSoft, Icon: CircleCheck },
  INSUFFICIENT_EVIDENCE: { fg: StitchTokens.colors.slateTextMain, bg: StitchTokens.colors.brandNavyTint, Icon: Info },
  ACTION_REFUSED: { fg: StitchTokens.colors.colorAccentHover, bg: StitchTokens.colors.colorAccentSoft, Icon: Ban },
  OUT_OF_SCOPE: { fg: StitchTokens.colors.colorAccentHover, bg: StitchTokens.colors.colorAccentSoft, Icon: Ban },
  BLOCKED: { fg: StitchTokens.colors.bfRedDark, bg: StitchTokens.colors.bfRedSoft, Icon: TriangleAlert },
};

export const AssistantScreen: React.FC<AssistantScreenProps> = ({ user, isOffline = false, studentId }) => {
  // H28: start in the app language; changing it here changes the whole app.
  const app = useI18n();
  const [locale, setLocalLocale] = useState<AssistantLocale>(app.locale);
  const [seenLocale, setSeenLocale] = useState(app.locale);
  if (seenLocale !== app.locale) {
    setSeenLocale(app.locale);
    setLocalLocale(app.locale);
  }
  const setLocale = (next: AssistantLocale) => {
    setLocalLocale(next);
    app.setLocale(next);
  };
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const counter = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const t = ASSISTANT_STRINGS[locale];
  const role = user.role;

  const nextId = () => {
    counter.current += 1;
    return `entry-${counter.current}`;
  };

  const ask = useCallback(async (question: string) => {
    const text = question.trim();
    if (!text || loading || isOffline) return;
    setEntries(prev => [...prev, { id: nextId(), kind: 'question', text }]);
    setDraft('');
    setLoading(true);
    try {
      const answer = await assistantService.ask(text, { locale, ...(studentId ? { studentId } : {}) });
      setEntries(prev => [...prev, { id: nextId(), kind: 'answer', question: text, answer }]);
    } catch (err) {
      setEntries(prev => [...prev, { id: nextId(), kind: 'error', question: text, message: errorMessage(err, t) }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50);
    }
  }, [loading, isOffline, locale, studentId, t]);

  const canSend = draft.trim().length > 0 && !loading && !isOffline;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="assistant-screen"
    >
      <StitchAppHeader dojangName={t.title.toUpperCase()} roleBadgeText={role.replace('_', ' ')} hasUnreadNotifications={false} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="assistant-conversation"
      >
        <View style={styles.languageRow} accessibilityRole="radiogroup" accessibilityLabel={app.t('language.title')}>
          {LOCALES.map(code => {
            const selected = code === locale;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => setLocale(code)}
                style={[styles.languageChip, selected && styles.languageChipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={ASSISTANT_STRINGS[code].languageName}
                testID={`assistant-lang-${code}`}
              >
                <Text style={[styles.languageText, selected && styles.languageTextSelected]}>{ASSISTANT_STRINGS[code].languageName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.notice} testID="assistant-readonly-notice" accessibilityRole="text">
          <ShieldCheck size={16} color={StitchTokens.colors.brandNavy} />
          <Text style={styles.noticeText}>{t.readOnlyNotice}</Text>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle} accessibilityRole="header">{t.title}</Text>
          <Text style={styles.welcomeText} testID="assistant-welcome">{t.welcome[role]}</Text>
          <Text style={styles.privacyText}>{t.privacyNotice}</Text>
        </View>

        {entries.length === 0 && (
          <View testID="assistant-suggestions">
            <Text style={styles.sectionLabel} accessibilityRole="header">{t.suggestedHeading}</Text>
            {t.suggestions[role].map((s, i) => (
              <TouchableOpacity
                key={s.query}
                style={[styles.suggestion, (loading || isOffline) && styles.disabled]}
                onPress={() => ask(s.query)}
                disabled={loading || isOffline}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                testID={`assistant-suggestion-${i}`}
              >
                <Text style={styles.suggestionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {entries.map(entry => {
          if (entry.kind === 'question') {
            return (
              <View key={entry.id} style={styles.questionBubble} accessibilityLabel={`${t.you}: ${entry.text}`}>
                <Text style={styles.questionText}>{entry.text}</Text>
              </View>
            );
          }
          if (entry.kind === 'error') {
            return (
              <View key={entry.id} style={styles.errorCard} testID="assistant-error" accessibilityLiveRegion="polite">
                <View style={styles.statusRow}>
                  <TriangleAlert size={16} color={StitchTokens.colors.bfRedDark} />
                  <Text style={styles.errorText}>{entry.message}</Text>
                </View>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => ask(entry.question)}
                  disabled={loading || isOffline}
                  accessibilityRole="button"
                  accessibilityLabel={t.retry}
                  testID="assistant-retry"
                >
                  <RotateCcw size={14} color={StitchTokens.colors.brandNavy} />
                  <Text style={styles.retryText}>{t.retry}</Text>
                </TouchableOpacity>
              </View>
            );
          }
          const { answer } = entry;
          const style = STATUS_STYLE[answer.status] || STATUS_STYLE.INSUFFICIENT_EVIDENCE;
          const StatusIcon = style.Icon;
          return (
            <View key={entry.id} style={styles.answerCard} testID="assistant-answer" accessibilityLiveRegion="polite">
              <View style={[styles.statusBadge, { backgroundColor: style.bg }]} testID={`assistant-status-${answer.status}`}>
                <StatusIcon size={14} color={style.fg} />
                <Text style={[styles.statusText, { color: style.fg }]}>{t.status[answer.status] || answer.status}</Text>
              </View>
              <Text style={styles.answerText}>{answer.answer}</Text>
              {answer.sources.length > 0 && (
                <View testID="assistant-sources">
                  <Text style={styles.sectionLabel}>{t.sourcesHeading}</Text>
                  {answer.sources.map(source => (
                    <View
                      key={source.id}
                      style={styles.sourceCard}
                      testID="assistant-source-card"
                      accessibilityLabel={`${sourceTypeLabel(t, source.type)}: ${source.title}`}
                    >
                      <View style={styles.statusRow}>
                        <FileText size={14} color={StitchTokens.colors.brandNavy} />
                        <Text style={styles.sourceType}>{sourceTypeLabel(t, source.type)}</Text>
                      </View>
                      <Text style={styles.sourceTitle}>{source.title}</Text>
                      <Text style={styles.sourceExcerpt} numberOfLines={4}>{source.excerpt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {loading && (
          <View style={styles.loadingRow} testID="assistant-loading" accessibilityLiveRegion="polite">
            <ActivityIndicator color={StitchTokens.colors.colorAccent} />
            <Text style={styles.loadingText}>{t.thinking}</Text>
          </View>
        )}

        {entries.length > 0 && !loading && (
          <TouchableOpacity onPress={() => setEntries([])} accessibilityRole="button" testID="assistant-clear" style={styles.clearButton}>
            <Text style={styles.clearText}>{t.clear}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {isOffline && (
        <View style={styles.offlineBar} testID="assistant-offline" accessibilityLiveRegion="polite">
          <WifiOff size={14} color={StitchTokens.colors.white} />
          <Text style={styles.offlineText}>{t.offline}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t.inputPlaceholder}
          placeholderTextColor={StitchTokens.colors.slateTextMuted}
          accessibilityLabel={t.inputLabel}
          maxLength={MAX_QUERY_CHARS}
          multiline
          editable={!isOffline}
          returnKeyType="send"
          onSubmitEditing={() => ask(draft)}
          testID="assistant-input"
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.disabled]}
          onPress={() => ask(draft)}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t.send}
          accessibilityState={{ disabled: !canSend }}
          testID="assistant-send"
        >
          <Send size={18} color={StitchTokens.colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const c = StitchTokens.colors;
const s = StitchTokens.spacing;
const r = StitchTokens.radii;
const f = StitchTokens.typography.sizes;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.slateBackground },
  scroll: { flex: 1 },
  scrollContent: { padding: s.lg, paddingBottom: s.xxl },
  languageRow: { flexDirection: 'row', gap: s.md, marginBottom: s.md },
  languageChip: {
    minHeight: 44, minWidth: 56, paddingHorizontal: s.lg, borderRadius: r.pill, borderWidth: 1,
    borderColor: c.slateBorder, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center',
  },
  languageChipSelected: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
  languageText: { fontSize: f.body, fontWeight: '700', color: c.slateTextMain },
  languageTextSelected: { color: c.white },
  notice: {
    flexDirection: 'row', gap: s.md, alignItems: 'flex-start', padding: s.cardPad, borderRadius: r.cardMini,
    backgroundColor: c.brandNavyTint, marginBottom: s.md,
  },
  noticeText: { flex: 1, fontSize: f.bodySm, color: c.slateTextMain, lineHeight: 18 },
  welcomeCard: {
    padding: s.cardPad, borderRadius: r.cardLarge, backgroundColor: c.white, borderWidth: 1, borderColor: c.slateBorder,
    borderLeftWidth: 4, borderLeftColor: c.colorAccent, marginBottom: s.lg, ...StitchTokens.shadows.card,
  },
  welcomeTitle: { fontSize: f.heading, fontWeight: '800', color: c.brandNavy, marginBottom: s.sm },
  welcomeText: { fontSize: f.body, color: c.slateTextMain, lineHeight: 20 },
  privacyText: { fontSize: f.caption, color: c.slateTextMuted, marginTop: s.md, lineHeight: 16 },
  sectionLabel: { fontSize: f.caption, fontWeight: '700', color: c.slateTextMuted, textTransform: 'uppercase', marginVertical: s.md },
  suggestion: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: s.lg, paddingVertical: s.md, borderRadius: r.btn,
    borderWidth: 1, borderColor: c.colorAccentBorder, backgroundColor: c.colorAccentSoft, marginBottom: s.md,
  },
  suggestionText: { fontSize: f.body, color: c.slateTextMain, fontWeight: '600' },
  questionBubble: {
    alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.brandNavy, borderRadius: r.cardMini,
    paddingHorizontal: s.lg, paddingVertical: s.md, marginBottom: s.md,
  },
  questionText: { color: c.white, fontSize: f.body, lineHeight: 20 },
  answerCard: {
    backgroundColor: c.white, borderRadius: r.cardLarge, borderWidth: 1, borderColor: c.slateBorder, padding: s.cardPad,
    marginBottom: s.md, ...StitchTokens.shadows.card,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: s.xs, alignSelf: 'flex-start', borderRadius: r.pill,
    paddingHorizontal: s.md, paddingVertical: s.xs, marginBottom: s.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
  statusText: { fontSize: f.caption, fontWeight: '700' },
  answerText: { fontSize: f.body, color: c.slateTextMain, lineHeight: 20 },
  sourceCard: {
    borderWidth: 1, borderColor: c.slateBorder, borderRadius: r.cardMini, padding: s.md, marginBottom: s.sm,
    backgroundColor: c.slateBackground,
  },
  sourceType: { fontSize: f.tag, fontWeight: '700', color: c.brandNavy, textTransform: 'uppercase' },
  sourceTitle: { fontSize: f.bodySm, fontWeight: '700', color: c.slateTextMain, marginTop: s.xs },
  sourceExcerpt: { fontSize: f.bodySm, color: c.slateTextMuted, marginTop: s.xxs, lineHeight: 17 },
  errorCard: {
    borderWidth: 1, borderColor: c.bfRedBorder, backgroundColor: c.bfRedSoft, borderRadius: r.cardMini, padding: s.cardPad,
    marginBottom: s.md,
  },
  errorText: { flex: 1, fontSize: f.body, color: c.bfRedDark },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', gap: s.sm, alignSelf: 'flex-start', minHeight: 44, marginTop: s.md,
    paddingHorizontal: s.lg, borderRadius: r.btn, borderWidth: 1, borderColor: c.brandNavy, backgroundColor: c.white,
  },
  retryText: { fontSize: f.body, fontWeight: '700', color: c.brandNavy },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: s.md, paddingVertical: s.md },
  loadingText: { fontSize: f.body, color: c.slateTextMuted },
  clearButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: s.lg },
  clearText: { fontSize: f.bodySm, color: c.slateTextMuted, textDecorationLine: 'underline' },
  offlineBar: {
    flexDirection: 'row', alignItems: 'center', gap: s.md, backgroundColor: c.brandNavySurface, paddingHorizontal: s.lg, paddingVertical: s.md,
  },
  offlineText: { flex: 1, color: c.white, fontSize: f.bodySm },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: s.md, padding: s.md, backgroundColor: c.white,
    borderTopWidth: 1, borderTopColor: c.slateBorder,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: c.slateBorder, borderRadius: r.btn,
    paddingHorizontal: s.lg, paddingVertical: s.md, fontSize: f.bodyLg, color: c.slateTextMain, backgroundColor: c.slateBackground,
  },
  sendButton: {
    width: 48, height: 48, borderRadius: r.btn, backgroundColor: c.colorAccent, alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});

export default AssistantScreen;
