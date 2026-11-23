/**
 * Parent: link another child, my link requests, and my notices.
 *
 *  - A link request is only sent once the guardian box is ticked; the body is
 *    exactly what server/src/routes/auth.routes.ts reads ({ icNumber }).
 *  - Link request statuses (PENDING_STUDENT / PENDING_MASTER / PENDING_ADMIN /
 *    ACTIVE / REJECTED) are shown in plain words.
 *  - Notices use the server's field names (server/src/routes/notices.routes.ts):
 *    type, message, sender_name, created_at, requires_acknowledgement.
 *  - Acknowledge posts to /notices/:id/acknowledge with the child's studentId.
 *  - Empty and error states; every new string in English, BM and Tamil.
 * Synthetic data only.
 */
import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider, DICTIONARIES, LOCALES } from '../i18n';
import { apiClient } from '../services/apiClient';
import { clearDashboardCache } from '../services/dashboardService';
import { releaseService } from '../services/releaseService';
import { AuthUser, UserRole } from '../types/auth';
import { ChildrenScreen, NoticesScreen } from '../screens/roles/parent';
import { parentHomeEn } from '../i18n/locales/modules/parentHome';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(),
}));

jest.mock('../services/releaseService', () => ({
  releaseService: { getReleaseModules: jest.fn() },
}));

jest.mock('../services/authService', () => ({
  authService: { onSessionEnded: jest.fn(() => () => undefined) },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const parent: AuthUser = {
  id: 'usr_test_parent',
  fullName: 'Test Parent',
  email: 'test.parent@example.test',
  role: UserRole.PARENT,
  organizationId: 'org_test',
  linkedStudentIds: ['stu_test_child'],
};

const STUDENT = {
  id: 'stu_test_child',
  full_name: 'Test Child',
  belt_rank: 'Yellow Belt',
  organization_id: 'org_test',
  class_id: 'cls_test',
  monthly_fee: 100,
  status: 'ACTIVE',
};

// Rows as parent_student_links returns them (GET joins student_name).
const LINKS = [
  { id: 'plink_1', parent_id: 'usr_test_parent', student_id: 'stu_a', status: 'PENDING_STUDENT', student_approved: false, master_approved: false, admin_approved: false, created_at: '2026-11-01T00:00:00.000Z', student_name: 'Child A' },
  { id: 'plink_2', parent_id: 'usr_test_parent', student_id: 'stu_b', status: 'PENDING_MASTER', student_approved: true, master_approved: false, admin_approved: false, created_at: '2026-11-02T00:00:00.000Z', student_name: 'Child B' },
  { id: 'plink_3', parent_id: 'usr_test_parent', student_id: 'stu_c', status: 'PENDING_ADMIN', student_approved: true, master_approved: true, admin_approved: false, created_at: '2026-11-03T00:00:00.000Z', student_name: 'Child C' },
  { id: 'plink_4', parent_id: 'usr_test_parent', student_id: 'stu_d', status: 'ACTIVE', student_approved: true, master_approved: true, admin_approved: true, created_at: '2026-11-04T00:00:00.000Z', student_name: 'Child D' },
  { id: 'plink_5', parent_id: 'usr_test_parent', student_id: 'stu_e', status: 'REJECTED', student_approved: false, master_approved: false, admin_approved: false, created_at: '2026-11-05T00:00:00.000Z', student_name: 'Child E' },
];

// Rows as the notices table returns them.
const NOTICES = [
  { id: 'notice_old', organization_id: 'org_test', class_id: 'cls_test', group_id: null, session_id: null, type: 'GENERAL', message: 'Older general message', sender_id: 'usr_m', sender_name: 'master@example.test', created_at: '2026-11-01T08:00:00.000Z', requires_acknowledgement: false, acknowledgement_deadline: null },
  { id: 'notice_new', organization_id: 'org_test', class_id: 'cls_test', group_id: null, session_id: null, type: 'CANCELLED', message: 'Saturday class is cancelled', sender_id: 'usr_m', sender_name: 'master@example.test', created_at: '2026-11-20T08:00:00.000Z', requires_acknowledgement: true, acknowledgement_deadline: '2026-11-25T00:00:00.000Z' },
];

function mockServer(opts: { links?: any; notices?: any } = {}) {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/students/stu_test_child') return { student: STUDENT };
    if (path.includes('/monthly-dues/')) return { currentFee: 100, monthsPendingCount: 0, totalPending: 0 };
    if (path.includes('/attendance/')) return { attendance: [] };
    if (path.includes('/sessions')) return { sessions: [] };
    if (path.includes('/certificates/')) return { certificates: [] };
    if (path === '/api/v1/notices/mine') return { notices: [] };
    if (path === '/notices/mine') {
      if (opts.notices instanceof Error) throw opts.notices;
      return { notices: opts.notices ?? [] };
    }
    if (path === '/auth/parent-link-requests') {
      if (opts.links instanceof Error) throw opts.links;
      return { linkRequests: opts.links ?? [] };
    }
    return {};
  });
}

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const renderScreen = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider defaultMode="light">
        <I18nProvider>{ui}</I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  clearDashboardCache();
  (releaseService.getReleaseModules as jest.Mock).mockResolvedValue({ release: 'R4', enabledModules: [] });
});

describe('Parent link another child', () => {
  test('the request is not sent until the guardian box is ticked; body matches the server', async () => {
    mockServer();
    post.mockResolvedValue({
      linkRequest: { id: 'plink_new', parent_id: 'usr_test_parent', student_id: 'stu_x', status: 'PENDING_STUDENT', student_approved: false, master_approved: false, admin_approved: false, created_at: '2026-11-22T00:00:00.000Z' },
    });
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    await utils.findByTestId('link-requests-empty');

    const box = utils.getByTestId('checkbox-link-guardian');
    expect(box.props.accessibilityRole).toBe('checkbox');
    expect(box.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));

    await fireEvent.changeText(utils.getByTestId('input-link-child-ic'), '  120101-14-5678  ');
    await fireEvent.press(utils.getByTestId('btn-send-link-request'));
    expect(post).not.toHaveBeenCalled();
    expect(utils.getByText(parentHomeEn['parentHome.link.guardianRequired'])).toBeTruthy();

    await fireEvent.press(box);
    expect(utils.getByTestId('checkbox-link-guardian').props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    await fireEvent.press(utils.getByTestId('btn-send-link-request'));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/auth/parent-link-requests', { icNumber: '120101-14-5678' });
    expect(await utils.findByTestId('link-request-plink_new')).toBeTruthy();
    expect(utils.getByTestId('link-request-status-plink_new')).toHaveTextContent(parentHomeEn['parentHome.link.status.PENDING_STUDENT']);
  });

  test('an empty IC number is not sent', async () => {
    mockServer();
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    await utils.findByTestId('link-requests-empty');
    await fireEvent.press(utils.getByTestId('checkbox-link-guardian'));
    await fireEvent.press(utils.getByTestId('btn-send-link-request'));
    expect(post).not.toHaveBeenCalled();
    expect(utils.getByText(parentHomeEn['parentHome.link.icRequired'])).toBeTruthy();
  });

  test('a server refusal is shown, not hidden', async () => {
    mockServer();
    post.mockRejectedValue(Object.assign(new Error('A link or request already exists for this child.'), { status: 409 }));
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    await utils.findByTestId('link-requests-empty');
    await fireEvent.changeText(utils.getByTestId('input-link-child-ic'), 'S-001');
    await fireEvent.press(utils.getByTestId('checkbox-link-guardian'));
    await fireEvent.press(utils.getByTestId('btn-send-link-request'));
    expect(await utils.findByTestId('link-request-error')).toHaveTextContent(/already exists/);
  });

  test('the privacy notice link opens the server legal page', async () => {
    mockServer();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    await fireEvent.press(utils.getByTestId('link-link-privacy'));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/legal\/privacy\.html$/));
    open.mockRestore();
  });

  test('my link requests show each status in plain words', async () => {
    mockServer({ links: LINKS });
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    await utils.findByTestId('link-request-plink_1');
    expect(utils.getByText('Child A', { exact: false })).toBeTruthy();
    expect(utils.getByTestId('link-request-status-plink_1')).toHaveTextContent(parentHomeEn['parentHome.link.status.PENDING_STUDENT']);
    expect(utils.getByTestId('link-request-status-plink_2')).toHaveTextContent(parentHomeEn['parentHome.link.status.PENDING_MASTER']);
    expect(utils.getByTestId('link-request-status-plink_3')).toHaveTextContent(parentHomeEn['parentHome.link.status.PENDING_ADMIN']);
    expect(utils.getByTestId('link-request-status-plink_4')).toHaveTextContent(parentHomeEn['parentHome.link.status.ACTIVE']);
    expect(utils.getByTestId('link-request-status-plink_5')).toHaveTextContent(parentHomeEn['parentHome.link.status.REJECTED']);
  });

  test('a server that does not list requests for parents (403) is explained, not shown as made-up rows', async () => {
    mockServer({ links: Object.assign(new Error('Access denied.'), { status: 403 }) });
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    expect(await utils.findByTestId('link-requests-unavailable')).toBeTruthy();
    expect(utils.queryByTestId('link-requests-error')).toBeNull();
  });

  test('a failed list shows an error with retry', async () => {
    mockServer({ links: new Error('Network request failed') });
    const utils = await renderScreen(<ChildrenScreen user={parent} />);
    await utils.findByTestId('link-requests-error');
    mockServer({ links: LINKS });
    await fireEvent.press(utils.getByTestId('link-requests-error-retry'));
    expect(await utils.findByTestId('link-request-plink_1')).toBeTruthy();
  });
});

describe('Parent notices', () => {
  test('notices render with the server fields, newest first, with an important marker in text', async () => {
    mockServer({ notices: NOTICES });
    const utils = await renderScreen(<NoticesScreen user={parent} />);
    await utils.findByTestId('notice-notice_new');
    expect(utils.getByText('Saturday class is cancelled')).toBeTruthy();
    expect(utils.getByText('Older general message')).toBeTruthy();
    expect(utils.getAllByText(/master@example\.test/).length).toBe(2);
    expect(utils.getByTestId('notice-title-notice_new')).toHaveTextContent(parentHomeEn['parentHome.notices.type.CANCELLED']);
    expect(utils.getByTestId('notice-important-notice_new')).toHaveTextContent(parentHomeEn['parentHome.notices.important']);
    expect(utils.queryByTestId('notice-important-notice_old')).toBeNull();

    const ids = utils.getAllByTestId(/^notice-notice_/).map(n => n.props.testID);
    expect(ids).toEqual(['notice-notice_new', 'notice-notice_old']);

    // Only a notice that needs acknowledgement offers the button.
    expect(utils.queryByTestId('btn-ack-notice_old')).toBeNull();
    expect(utils.getByTestId('btn-ack-notice_new')).toBeTruthy();
  });

  test('acknowledge calls the right path with the child id and marks the row', async () => {
    mockServer({ notices: NOTICES });
    post.mockResolvedValue({ acknowledged: true, acknowledgement: { id: 'ack_1' } });
    const utils = await renderScreen(<NoticesScreen user={parent} />);
    await utils.findByTestId('btn-ack-notice_new');
    // The child roster (for the studentId) must be loaded before acknowledging.
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/students/stu_test_child'));
    await fireEvent.press(utils.getByTestId('btn-ack-notice_new'));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/notices/notice_new/acknowledge', { studentId: 'stu_test_child' })
    );
    expect(await utils.findByTestId('notice-acked-notice_new')).toHaveTextContent(parentHomeEn['parentHome.notices.acknowledged']);
    expect(utils.queryByTestId('btn-ack-notice_new')).toBeNull();
  });

  test('empty notices', async () => {
    mockServer({ notices: [] });
    const utils = await renderScreen(<NoticesScreen user={parent} />);
    expect(await utils.findByTestId('notices-empty')).toHaveTextContent(parentHomeEn['parentHome.notices.empty'], { exact: false });
  });

  test('a failed notices load shows an error with retry', async () => {
    mockServer({ notices: new Error('Network request failed') });
    const utils = await renderScreen(<NoticesScreen user={parent} />);
    await utils.findByTestId('notices-error');
    mockServer({ notices: NOTICES });
    await fireEvent.press(utils.getByTestId('notices-error-retry'));
    expect(await utils.findByTestId('notice-notice_new')).toBeTruthy();
  });
});

describe('Translations', () => {
  const NEW_PREFIXES = ['parentHome.link.', 'parentHome.notices.'];
  const keys = Object.keys(parentHomeEn).filter(k => NEW_PREFIXES.some(p => k.startsWith(p)));

  test('every new string exists in all three languages; Tamil is in Tamil script with allowed punctuation only', () => {
    expect(keys.length).toBeGreaterThan(20);
    for (const locale of LOCALES) {
      const dict = DICTIONARIES[locale] as Record<string, string>;
      for (const key of keys) {
        expect({ locale, key, ok: typeof dict[key] === 'string' && dict[key].length > 0 }).toEqual({ locale, key, ok: true });
      }
    }
    const ta = DICTIONARIES.ta as Record<string, string>;
    for (const key of keys) {
      const value = ta[key];
      expect({ key, tamil: /[஀-௿]/.test(value) }).toEqual({ key, tamil: true });
      expect({ key, allowed: /^[஀-௿\x20-\x7E–—‘’“”•…]*$/.test(value) }).toEqual({ key, allowed: true });
    }
  });
});
