/**
 * Official Task H26 — Role-Aware Grounded AI: mobile assistant tests.
 * The API is mocked; these tests verify the UI contract, not live AI.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, RoleType, UserRole } from '../types/auth';
import { AssistantScreen } from '../screens/shared/AssistantScreen';
import { assistantService, AssistantAnswer } from '../services/assistantService';
import { ApiError } from '../services/apiClient';
import { ASSISTANT_STRINGS } from '../i18n/assistantStrings';
import { SuperAdminNavigator } from '../navigation/roleNavigators/SuperAdminNavigator';
import { AdminPersatuanNavigator } from '../navigation/roleNavigators/AdminPersatuanNavigator';
import { MasterNavigator } from '../navigation/roleNavigators/MasterNavigator';
import { ParentNavigator } from '../navigation/roleNavigators/ParentNavigator';
import { StudentNavigator } from '../navigation/roleNavigators/StudentNavigator';

jest.mock('../services/assistantService', () => ({
  assistantService: { ask: jest.fn() },
}));

jest.mock('../services/authService', () => ({
  authService: {
    login: jest.fn(), getStoredSession: jest.fn(), getProfile: jest.fn(), validateStoredSession: jest.fn(),
    logout: jest.fn(), onSessionEnded: jest.fn(() => () => {}),
  },
}));

jest.mock('../services/certificateService', () => ({
  certificateService: { verifyCertificate: jest.fn() },
}));

jest.setTimeout(30000);

const ask = assistantService.ask as jest.Mock;
const en = ASSISTANT_STRINGS.en;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider defaultMode="light">{ui}</ThemeProvider>
  </SafeAreaProvider>
);

const makeUser = (role: RoleType): AuthUser => ({
  id: `usr_${role.toLowerCase()}`, fullName: `Test ${role}`, email: `${role.toLowerCase()}@beltflow.test`, role,
  organizationId: role === 'SUPER_ADMIN' ? null : 'org_test',
});

const answered: AssistantAnswer = {
  status: 'ANSWERED',
  answer: 'Here is what I found in the BeltFlow records you are allowed to see:\n• Attendance: Arjun Kumaran: Present 8, Absent 1.',
  sources: [
    { id: 'student_attendance:stu_1', type: 'student_attendance', title: 'Attendance: Arjun Kumaran', excerpt: 'Attendance in the last 90 days: Present 8, Absent 1.' },
    { id: 'kb:kb_1', type: 'knowledge_source', title: 'Grading Policy', excerpt: 'Grading is held every March and September.' },
  ],
  readOnly: true, provider: 'extractive', locale: 'en', generatedAt: '2026-11-10T00:00:00.000Z',
};
const gap: AssistantAnswer = { ...answered, status: 'INSUFFICIENT_EVIDENCE', answer: 'I could not find this in the BeltFlow records you are allowed to see.', sources: [] };
const refused: AssistantAnswer = { ...answered, status: 'ACTION_REFUSED', answer: 'I can only read and explain information.', sources: [] };

beforeEach(() => {
  ask.mockReset();
});

describe('H26 AssistantScreen', () => {
  test.each(['SUPER_ADMIN', 'ADMIN_PERSATUAN', 'MASTER', 'PARENT', 'STUDENT'] as RoleType[])(
    '%s sees a role-aware welcome, read-only notice and suggested questions', async role => {
      const { getByTestId, getByText } = await render(wrap(<AssistantScreen user={makeUser(role)} />));
      expect(getByTestId('assistant-welcome').props.children).toBe(en.welcome[role]);
      expect(getByTestId('assistant-readonly-notice')).toBeTruthy();
      en.suggestions[role].forEach(s => expect(getByText(s.label)).toBeTruthy());
    });

  test('Super Admin welcome states that child records are unavailable', async () => {
    const { getByTestId } = await render(wrap(<AssistantScreen user={makeUser('SUPER_ADMIN')} />));
    expect(getByTestId('assistant-welcome').props.children).toMatch(/children's records are not available/);
  });

  test('suggested question sends its query and renders the grounded answer with source cards', async () => {
    ask.mockResolvedValue(answered);
    const { getByTestId, getAllByTestId, getByText } = await render(wrap(<AssistantScreen user={makeUser('PARENT')} />));
    await act(async () => { fireEvent.press(getByTestId('assistant-suggestion-0')); });
    await waitFor(() => expect(getByTestId('assistant-answer')).toBeTruthy());
    expect(ask).toHaveBeenCalledWith(en.suggestions.PARENT[0].query, { locale: 'en' });
    expect(getByTestId('assistant-status-ANSWERED')).toBeTruthy();
    expect(getByText(en.status.ANSWERED)).toBeTruthy();
    expect(getByText(answered.answer)).toBeTruthy();
    const cards = getAllByTestId('assistant-source-card');
    expect(cards).toHaveLength(2);
    expect(getByText('Attendance: Arjun Kumaran')).toBeTruthy();
    expect(getByText(en.sourceType.document)).toBeTruthy();
  });

  test('typed question is trimmed and sent; empty input cannot be sent', async () => {
    ask.mockResolvedValue(gap);
    const { getByTestId, getByText, queryByTestId } = await render(wrap(<AssistantScreen user={makeUser('STUDENT')} />));
    expect(getByTestId('assistant-send').props.accessibilityState).toEqual({ disabled: true });
    await act(async () => { fireEvent.changeText(getByTestId('assistant-input'), '   What is the capital of France?   '); });
    await act(async () => { fireEvent.press(getByTestId('assistant-send')); });
    await waitFor(() => expect(getByTestId('assistant-status-INSUFFICIENT_EVIDENCE')).toBeTruthy());
    expect(ask).toHaveBeenCalledWith('What is the capital of France?', { locale: 'en' });
    expect(getByText(en.status.INSUFFICIENT_EVIDENCE)).toBeTruthy();
    expect(queryByTestId('assistant-sources')).toBeNull();
  });

  test('read-only refusal is labelled with text, not colour alone', async () => {
    ask.mockResolvedValue(refused);
    const { getByTestId, getByText } = await render(wrap(<AssistantScreen user={makeUser('MASTER')} />));
    await act(async () => { fireEvent.changeText(getByTestId('assistant-input'), 'Promote Arjun to black belt'); });
    await act(async () => { fireEvent.press(getByTestId('assistant-send')); });
    await waitFor(() => expect(getByTestId('assistant-status-ACTION_REFUSED')).toBeTruthy());
    expect(getByText(en.status.ACTION_REFUSED)).toBeTruthy();
  });

  test('provider outage shows a safe message and Retry re-asks the same question', async () => {
    ask.mockRejectedValueOnce(new ApiError({ message: 'The assistant is temporarily unavailable.', status: 503 }));
    ask.mockResolvedValueOnce(answered);
    const { getByTestId, getByText } = await render(wrap(<AssistantScreen user={makeUser('PARENT')} />));
    await act(async () => { fireEvent.changeText(getByTestId('assistant-input'), 'How is attendance?'); });
    await act(async () => { fireEvent.press(getByTestId('assistant-send')); });
    await waitFor(() => expect(getByTestId('assistant-error')).toBeTruthy());
    expect(getByText(en.errors.unavailable)).toBeTruthy();
    await act(async () => { fireEvent.press(getByTestId('assistant-retry')); });
    await waitFor(() => expect(getByTestId('assistant-answer')).toBeTruthy());
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][0]).toBe('How is attendance?');
  });

  test.each([
    [new ApiError({ message: 'x', status: 0, isNetworkError: true }), en.errors.network],
    [new ApiError({ message: 'x', status: 429 }), en.errors.rateLimited],
    [new ApiError({ message: 'x', status: 403 }), en.errors.forbidden],
    [new ApiError({ message: 'x', status: 404 }), en.errors.disabled],
    [new Error('boom'), en.errors.generic],
  ])('maps API failures to safe user messages (%#)', async (error, expected) => {
    ask.mockRejectedValue(error);
    const { getByTestId, getByText } = await render(wrap(<AssistantScreen user={makeUser('ADMIN_PERSATUAN')} />));
    await act(async () => { fireEvent.changeText(getByTestId('assistant-input'), 'Show class statistics'); });
    await act(async () => { fireEvent.press(getByTestId('assistant-send')); });
    await waitFor(() => expect(getByText(expected)).toBeTruthy());
  });

  test('switches interface language to Bahasa Melayu and Tamil and sends the locale', async () => {
    ask.mockResolvedValue(gap);
    const { getByTestId, getByText } = await render(wrap(<AssistantScreen user={makeUser('PARENT')} />));
    await act(async () => { fireEvent.press(getByTestId('assistant-lang-ms')); });
    expect(getByTestId('assistant-welcome').props.children).toBe(ASSISTANT_STRINGS.ms.welcome.PARENT);
    expect(getByTestId('assistant-lang-ms').props.accessibilityState).toEqual({ selected: true });
    expect(getByText(ASSISTANT_STRINGS.ms.readOnlyNotice)).toBeTruthy();
    await act(async () => { fireEvent.press(getByTestId('assistant-lang-ta')); });
    expect(getByTestId('assistant-welcome').props.children).toBe(ASSISTANT_STRINGS.ta.welcome.PARENT);
    expect(getByTestId('assistant-input').props.placeholder).toBe(ASSISTANT_STRINGS.ta.inputPlaceholder);
    await act(async () => { fireEvent.press(getByTestId('assistant-suggestion-1')); });
    expect(ask).toHaveBeenCalledWith(ASSISTANT_STRINGS.ta.suggestions.PARENT[1].query, { locale: 'ta' });
  });

  test('every locale defines every string for every role', () => {
    const roles: RoleType[] = ['SUPER_ADMIN', 'ADMIN_PERSATUAN', 'MASTER', 'PARENT', 'STUDENT'];
    for (const locale of ['en', 'ms', 'ta'] as const) {
      const t = ASSISTANT_STRINGS[locale];
      for (const role of roles) {
        expect(t.welcome[role].length).toBeGreaterThan(10);
        expect(t.suggestions[role]).toHaveLength(3);
      }
      for (const v of [...Object.values(t.status), ...Object.values(t.errors), t.readOnlyNotice, t.send, t.retry]) {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(1);
      }
    }
    expect(ASSISTANT_STRINGS.ta.welcome.STUDENT).toMatch(/[஀-௿]/);
  });

  test('offline mode disables sending and never calls the API', async () => {
    const { getByTestId } = await render(wrap(<AssistantScreen user={makeUser('STUDENT')} isOffline />));
    expect(getByTestId('assistant-offline')).toBeTruthy();
    await act(async () => { fireEvent.changeText(getByTestId('assistant-input'), 'When is my next class?'); });
    await act(async () => { fireEvent.press(getByTestId('assistant-send')); });
    await act(async () => { fireEvent.press(getByTestId('assistant-suggestion-0')); });
    expect(ask).not.toHaveBeenCalled();
  });

  test('history is session-only: clearing and remounting start empty', async () => {
    ask.mockResolvedValue(answered);
    const first = await render(wrap(<AssistantScreen user={makeUser('PARENT')} />));
    await act(async () => { fireEvent.press(first.getByTestId('assistant-suggestion-0')); });
    await waitFor(() => expect(first.getByTestId('assistant-answer')).toBeTruthy());
    await act(async () => { fireEvent.press(first.getByTestId('assistant-clear')); });
    expect(first.queryByTestId('assistant-answer')).toBeNull();
    await act(async () => { await first.unmount(); });
    const second = await render(wrap(<AssistantScreen user={makeUser('PARENT')} />));
    expect(second.queryByTestId('assistant-answer')).toBeNull();
    expect(second.getByTestId('assistant-suggestions')).toBeTruthy();
  });

  test('accessible controls: labelled input, send button and 44px+ touch targets', async () => {
    const { getByTestId } = await render(wrap(<AssistantScreen user={makeUser('MASTER')} />));
    expect(getByTestId('assistant-input').props.accessibilityLabel).toBe(en.inputLabel);
    expect(getByTestId('assistant-send').props.accessibilityLabel).toBe(en.send);
    const flatten = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {});
    expect(flatten(getByTestId('assistant-send').props.style).height).toBeGreaterThanOrEqual(44);
    expect(flatten(getByTestId('assistant-lang-ta').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('H26 navigation: assistant tab for all five roles', () => {
  test.each([
    ['SUPER_ADMIN', SuperAdminNavigator, 'tab-sa-assistant'],
    ['ADMIN_PERSATUAN', AdminPersatuanNavigator, 'tab-ap-assistant'],
    ['MASTER', MasterNavigator, 'tab-master-assistant'],
    ['PARENT', ParentNavigator, 'tab-parent-assistant'],
    ['STUDENT', StudentNavigator, 'tab-student-assistant'],
  ] as [RoleType, React.FC<any>, string][])('%s navigator opens the assistant', async (role, Navigator, tabId) => {
    const user = makeUser(role);
    expect(UserRole[role]).toBe(role);
    const { getByTestId, findByTestId } = await render(wrap(<Navigator user={user} onLogout={jest.fn()} />));
    await act(async () => { fireEvent.press(getByTestId(tabId)); });
    const screen = await findByTestId('assistant-screen');
    expect(screen).toBeTruthy();
    expect((await findByTestId('assistant-welcome')).props.children).toBe(en.welcome[role]);
  });
});
