/**
 * Official Task H28 — Continuous localization and usability.
 * Acceptance tests: Tamil_font_coverage; large_text_no_clipping;
 * focus_order_usable; status_not_color_only; pending_approval_next_step_clear.
 *
 * Jest renders the React tree but does not lay out pixels or run a real
 * screen reader. These tests check the properties that make clipping,
 * missing glyphs and confusing order impossible or unlikely; final proof
 * still needs real Android/iOS devices with large text and TalkBack/VoiceOver.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { StitchTokens } from '../theme/tokens';
import { fontFamilies } from '../theme/typography';
import { AuthUser, RoleType, UserRole } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { getStoredLocale } from '../services/storage';
import { DICTIONARIES, I18nProvider, LOCALES, Locale, useI18n } from '../i18n';
import { ASSISTANT_STRINGS } from '../i18n/assistantStrings';
import { StatusBadge, StatusBadgeVariant } from '../components/Badges';
import { PendingNextStep, PendingKind } from '../components/PendingNextStep';
import { LanguageSelector } from '../components/LanguageSelector';
import { ClassProposalStatusScreen } from '../screens/roles/master/ClassProposalStatusScreen';
import { MasterApplicationStatusScreen } from '../screens/roles/master/MasterApplicationStatusScreen';
import { MyApplicationsScreen } from '../screens/roles/student/MyApplicationsScreen';
import { StudentNavigator } from '../navigation/roleNavigators/StudentNavigator';
import { AssistantScreen } from '../screens/shared/AssistantScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  apiPath: (p: string) => p,
  onUnauthorizedResponse: jest.fn(() => () => {}),
  ApiError: class ApiError extends Error {},
}));

// In-memory secure storage, as in the other suites (the native module is not available in Jest).
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
});

jest.setTimeout(30000);

const SRC = path.join(__dirname, '..');
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement, locale: Locale = 'en') => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider defaultMode="light">
      <I18nProvider initialLocale={locale}>{ui}</I18nProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);
const user = (role: RoleType): AuthUser => ({ id: `u_${role}`, fullName: `User ${role}`, email: `${role}@t.local`, role, organizationId: 'org_1' });

const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {});
type Node = { type: string; props: any; children: (Node | string)[] | null };
function walk(node: Node | Node[] | string | null, visit: (n: Node) => void) {
  if (!node || typeof node === 'string') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  visit(node);
  (node.children || []).forEach(c => walk(c as any, visit));
}
function textOf(node: Node): string {
  return (node.children || []).map(c => (typeof c === 'string' ? c : textOf(c))).join('');
}
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

const KINDS: PendingKind[] = ['MASTER_APPLICATION', 'CLASS_PROPOSAL', 'ENROLLMENT_APPLICATION'];
const PENDING_STATUSES = ['DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'WAITLISTED', 'REJECTED'];
const TAMIL = /[஀-௿]/;
// Tamil block, Latin/ASCII (brand names, numbers), whitespace and common typographic punctuation.
const ALLOWED_IN_TAMIL = /^[஀-௿ -~ –—‘’“”•…\n]*$/;
const BRAND_ONLY = new Set(['app.name']);

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockResolvedValue({});
});

// ------------------------------------------------------------- 1. Tamil font
describe('H28 Tamil_font_coverage', () => {
  const en = DICTIONARIES.en as Record<string, string>;

  test('every English key exists, non-empty, in Bahasa Melayu and Tamil with the same placeholders', () => {
    const params = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const locale of ['ms', 'ta'] as const) {
      const dict = DICTIONARIES[locale] as Record<string, string>;
      for (const key of Object.keys(en)) {
        expect(typeof dict[key]).toBe('string');
        expect(dict[key].trim().length).toBeGreaterThan(0);
        expect(params(dict[key])).toBe(params(en[key]));
      }
    }
  });

  test('Tamil strings are written in Tamil script with no characters outside the covered ranges', () => {
    const ta = DICTIONARIES.ta as Record<string, string>;
    const strings: [string, string][] = [
      ...Object.entries(ta),
      ...Object.values(ASSISTANT_STRINGS.ta.welcome).map(v => ['assistant.welcome', v] as [string, string]),
      ...Object.values(ASSISTANT_STRINGS.ta.status).map(v => ['assistant.status', v] as [string, string]),
    ];
    for (const [key, value] of strings) {
      if (!BRAND_ONLY.has(key)) expect({ key, tamil: TAMIL.test(value) }).toEqual({ key, tamil: true });
      expect({ key, ok: ALLOWED_IN_TAMIL.test(value) }).toEqual({ key, ok: true });
      expect(value).not.toContain('�');
    }
  });

  test('no CSS font stacks or unbundled custom fonts: Tamil falls back to the system font that has Tamil glyphs', () => {
    const system = new Set([undefined, 'System', 'sans-serif', 'monospace']);
    expect(system.has(StitchTokens.typography.fontFamily as any)).toBe(true);
    for (const v of Object.values(fontFamilies)) expect(system.has(v as any)).toBe(true);
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/fontFamily:\s*['"]([^'"]+)['"]/g)) {
        if (m[1].includes(',') || !system.has(m[1])) offenders.push(`${path.relative(SRC, file)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('Tamil next-step text renders with system fonts only', async () => {
    const r = await render(wrap(<PendingNextStep kind="ENROLLMENT_APPLICATION" status="SUBMITTED" testID="ns" />, 'ta'));
    const texts: Node[] = [];
    walk(r.toJSON() as any, n => { if (n.type === 'Text') texts.push(n); });
    expect(texts.length).toBeGreaterThanOrEqual(4);
    for (const t of texts) {
      expect(TAMIL.test(textOf(t))).toBe(true);
      const ff = flatten(t.props.style).fontFamily;
      expect([undefined, 'System', 'sans-serif']).toContain(ff);
    }
  });
});

// ---------------------------------------------------- 2. Large text, clipping
describe('H28 large_text_no_clipping', () => {
  test('the app never disables or caps font scaling below 2x', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      if (/allowFontScaling=\{false\}|allowFontScaling:\s*false/.test(src)) offenders.push(`${path.relative(SRC, file)}: allowFontScaling false`);
      for (const m of src.matchAll(/maxFontSizeMultiplier[=:]\s*\{?\s*([\d.]+)/g)) {
        if (Number(m[1]) < 2) offenders.push(`${path.relative(SRC, file)}: maxFontSizeMultiplier ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test.each(LOCALES)('status, next-step and language text can wrap and grow (%s)', async locale => {
    const variants: StatusBadgeVariant[] = ['success', 'warning', 'danger', 'info', 'neutral'];
    const r = await render(wrap(
      <>
        {variants.map(v => <StatusBadge key={v} status="X" label={DICTIONARIES[locale]['status.awaitingReview']} variant={v} />)}
        {KINDS.map(k => <PendingNextStep key={k} kind={k} status="NEEDS_INFORMATION" />)}
        <LanguageSelector />
      </>, locale));
    walk(r.toJSON() as any, n => {
      const style = flatten(n.props.style);
      if (n.type === 'Text') {
        expect(n.props.numberOfLines).toBeUndefined();
        expect(style.height).toBeUndefined();
      }
      // Containers may set a minimum height (touch targets) but never a fixed height.
      if (n.type === 'View') expect(style.height).toBeUndefined();
    });
  });
});

// -------------------------------------------------------- 3. Focus order
describe('H28 focus_order_usable', () => {
  const classApps = {
    applications: [
      { id: 'capp_sub', name: 'Silambam Traditional', status: 'SUBMITTED', version: 2, schedule: 'Sun 10 AM', location: 'Hall', submitted_at: '2026-10-16T12:00:00Z' },
    ],
  };

  test('pending class proposal reads: title, status, what happens next, then the action', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => Promise.resolve(url === '/class-applications/me' ? classApps : {}));
    const r = await render(wrap(<ClassProposalStatusScreen user={user('MASTER')} />, 'ms'));
    await waitFor(() => expect(r.getByTestId('pending-next-step-capp_sub')).toBeTruthy());
    const order: string[] = [];
    walk(r.toJSON() as any, n => { if (n.props.testID) order.push(n.props.testID); });
    const iBadge = order.indexOf('badge-status-submitted');
    const iNext = order.indexOf('pending-next-step-capp_sub');
    const iAction = order.findIndex(id => /withdraw/i.test(id));
    expect(iBadge).toBeGreaterThanOrEqual(0);
    expect(iNext).toBeGreaterThan(iBadge);
    if (iAction >= 0) expect(iAction).toBeGreaterThan(iNext);
  });

  test('next-step card announces a heading first, then who, next and action in that order', async () => {
    const r = await render(wrap(<PendingNextStep kind="CLASS_PROPOSAL" status="SUBMITTED" testID="ns" />, 'en'));
    const en = DICTIONARIES.en;
    const read: string[] = [];
    walk(r.toJSON() as any, n => { if (n.type === 'Text') read.push(textOf(n)); });
    const pos = (s: string) => read.findIndex(t => t.includes(s));
    expect(r.getByRole('header')).toBeTruthy();
    expect(pos(en['pending.title'])).toBe(0);
    expect(pos(en['pending.whoReviews'])).toBeLessThan(pos(en['pending.whatNext']));
    expect(pos(en['pending.whatNext'])).toBeLessThan(pos(en['pending.whatYouCanDo']));
  });

  test('language options are an ordered, labelled radio group with selection state', async () => {
    const r = await render(wrap(<LanguageSelector />, 'ms'));
    const group = r.getByTestId('language-selector');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(DICTIONARIES.ms['language.title']);
    const radios = ['en', 'ms', 'ta'].map(l => r.getByTestId(`language-option-${l}`));
    radios.forEach(b => {
      expect(b.props.accessibilityRole).toBe('radio');
      expect(typeof b.props.accessibilityLabel).toBe('string');
    });
    expect(radios.map(b => b.props.accessibilityState.selected)).toEqual([false, true, false]);
  });
});

// -------------------------------------------------- 4. Status not colour only
describe('H28 status_not_color_only', () => {
  test('every badge variant shows a text label, a distinct icon and an accessible label', async () => {
    const variants: StatusBadgeVariant[] = ['success', 'warning', 'danger', 'info', 'neutral'];
    const icons = new Set<string>();
    for (const v of variants) {
      const r = await render(wrap(<StatusBadge status="X" label={`Label ${v}`} variant={v} testID={`b-${v}`} />));
      expect(r.getByText(`Label ${v}`)).toBeTruthy();
      // The icon is hidden from screen readers (the text label is announced), so query hidden elements.
      const icon = r.getByTestId(`b-${v}-icon`, { includeHiddenElements: true });
      // A real drawn icon (SVG paths) must sit inside the wrapper, and each meaning must use a different shape.
      const shape: string[] = [];
      const collect = (n: any) => {
        if (!n || typeof n !== 'object') return;
        for (const [k, val] of Object.entries(n.props || {})) {
          if (['d', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points'].includes(k)) shape.push(`${k}=${String(val)}`);
        }
        (n.children || []).forEach(collect);
      };
      (icon.children as any[]).forEach(collect);
      expect(shape.length).toBeGreaterThan(0);
      icons.add(shape.sort().join('|')); // colour-independent signature
      expect(r.getByTestId(`b-${v}`).props.accessibilityLabel).toContain(`Label ${v}`);
      await act(async () => { await r.unmount(); });
    }
    expect(icons.size).toBe(variants.length);
  });

  test('badges without an explicit label still show readable text, localised', async () => {
    const r = await render(wrap(<StatusBadge status="PENDING" testID="b" />, 'ta'));
    expect(r.getByText(DICTIONARIES.ta['status.pending'])).toBeTruthy();
  });
});

// ------------------------------------------ 5. Pending approval next step
describe('H28 pending_approval_next_step_clear', () => {
  test.each(LOCALES)('every pending kind and status explains who, what next and what to do (%s)', async locale => {
    const dict = DICTIONARIES[locale] as Record<string, string>;
    for (const kind of KINDS) {
      for (const status of PENDING_STATUSES) {
        if (status === 'WAITLISTED' && kind !== 'ENROLLMENT_APPLICATION') continue;
        const r = await render(wrap(<PendingNextStep kind={kind} status={status} testID="ns" />, locale));
        const card = r.getByTestId('ns');
        expect(card).toBeTruthy();
        for (const part of ['who', 'next', 'action']) {
          const text = textOf(r.getByTestId(`ns-${part}`) as any);
          expect(text.trim().length).toBeGreaterThan(10);
        }
        expect(r.getByText(dict['pending.title'])).toBeTruthy();
        await act(async () => { await r.unmount(); });
      }
    }
  });

  test('finished states do not show a next-step card', async () => {
    for (const status of ['APPROVED', 'WITHDRAWN', 'ACTIVE']) {
      const r = await render(wrap(<PendingNextStep kind="CLASS_PROPOSAL" status={status} testID="ns" />));
      expect(r.queryByTestId('ns')).toBeNull();
      await act(async () => { await r.unmount(); });
    }
  });

  test('class proposals: submitted and needs-information items show their next step, in the chosen language', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => Promise.resolve(url === '/class-applications/me' ? {
      applications: [
        { id: 'c1', name: 'A', status: 'SUBMITTED', version: 1 },
        { id: 'c2', name: 'B', status: 'NEEDS_INFORMATION', version: 2, requested_information: 'Attach hall letter.' },
        { id: 'c3', name: 'C', status: 'APPROVED', version: 1 },
      ],
    } : {}));
    const r = await render(wrap(<ClassProposalStatusScreen user={user('MASTER')} />, 'ta'));
    await waitFor(() => expect(r.getByTestId('pending-next-step-c1')).toBeTruthy());
    expect(r.getByTestId('pending-next-step-c2')).toBeTruthy();
    expect(r.queryByTestId('pending-next-step-c3')).toBeNull();
    expect(TAMIL.test(textOf(r.getByTestId('pending-next-step-c1-who') as any))).toBe(true);
  });

  test('enrolment applications (student/parent) show the Master as the reviewer and a waitlist explanation', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => Promise.resolve(url === '/enrollment-applications/me' ? {
      applications: [
        { id: 'e1', class_id: 'k1', class_name: 'Juniors', status: 'SUBMITTED', version: 1, submitted_at: '2026-10-01T00:00:00Z' },
        { id: 'e2', class_id: 'k2', class_name: 'Seniors', status: 'WAITLISTED', version: 1, waitlist_position: 2 },
      ],
    } : {}));
    const r = await render(wrap(<MyApplicationsScreen user={user('STUDENT')} />, 'en'));
    await waitFor(() => expect(r.getByTestId('pending-next-step-e1')).toBeTruthy());
    expect(textOf(r.getByTestId('pending-next-step-e1-who') as any)).toBe(DICTIONARIES.en['pending.ENROLLMENT_APPLICATION.who']);
    expect(textOf(r.getByTestId('pending-next-step-e2-next') as any)).toBe(DICTIONARIES.en['pending.ENROLLMENT_APPLICATION.WAITLISTED.next']);
  });

  test('Master application under review shows who reviews it and what the Master can do now', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/master-applications/me')) {
        return Promise.resolve({ applications: [{ id: 'm1', organization_id: 'org_1', status: 'SUBMITTED', version: 1, submitted_at: '2026-10-15T10:00:00Z' }], currentAffiliationStatus: 'PENDING' });
      }
      return Promise.resolve({ organizations: [] });
    });
    const r = await render(wrap(<MasterApplicationStatusScreen user={{ ...user('MASTER'), affiliationStatus: 'PENDING' }} />, 'ms'));
    await waitFor(() => expect(r.getByTestId('pending-next-step-m1')).toBeTruthy());
    expect(textOf(r.getByTestId('pending-next-step-m1-who') as any)).toBe(DICTIONARIES.ms['pending.MASTER_APPLICATION.who']);
  });
});

// ----------------------------------------------- app-wide language plumbing
describe('H28 app-wide language', () => {
  test('choosing a language updates the app and is remembered on the device', async () => {
    function Probe() {
      const { t } = useI18n();
      return <React.Fragment>{t('tabs.home') ? <LanguageSelector /> : null}</React.Fragment>;
    }
    const r = await render(wrap(<Probe />, 'en'));
    await act(async () => { fireEvent.press(r.getByTestId('language-option-ta')); });
    expect(r.getByTestId('language-option-ta').props.accessibilityState.selected).toBe(true);
    expect(await getStoredLocale()).toBe('ta');
    await act(async () => { await r.unmount(); });
    const again = await render(
      <SafeAreaProvider initialMetrics={metrics}><ThemeProvider defaultMode="light"><I18nProvider><LanguageSelector /></I18nProvider></ThemeProvider></SafeAreaProvider>
    );
    await waitFor(() => expect(again.getByTestId('language-option-ta').props.accessibilityState.selected).toBe(true));
  });

  test('tab labels follow the app language', async () => {
    const r = await render(wrap(<StudentNavigator user={user('STUDENT')} onLogout={jest.fn()} />, 'ms'));
    expect(await r.findByText(DICTIONARIES.ms['tabs.progress'])).toBeTruthy();
    expect(r.getByText(DICTIONARIES.ms['tabs.profile'])).toBeTruthy();
  });

  test('the assistant opens in the app language', async () => {
    const r = await render(wrap(<AssistantScreen user={{ ...user('PARENT'), role: UserRole.PARENT }} />, 'ta'));
    expect(r.getByTestId('assistant-welcome').props.children).toBe(ASSISTANT_STRINGS.ta.welcome.PARENT);
  });
});
