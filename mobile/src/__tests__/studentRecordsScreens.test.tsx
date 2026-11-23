/**
 * Student Attendance log and Certificates screens, 2026-11-22.
 *
 *  - Both screens look up the signed-in student's own student record
 *    (GET /api/v1/students/me) and use students.id, never the login user id.
 *  - Attendance: GET /api/v1/attendance/student/:studentId/history
 *    ({ attendance: [{ id, status, session_date, start_time, end_time,
 *    location, group_name, ... }] }), newest first, with a summary.
 *  - Certificates: GET /api/v1/certificates/student/:studentId
 *    ({ certificates: [{ id, code, rank_or_title, issue_date, status, ... }] });
 *    a REVOKED certificate is shown as revoked, never as verified.
 *  - The digital pass carries the student record id (sid).
 *  - Loading, empty and error-with-retry states; no made-up data.
 * Synthetic data only.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { I18nProvider, DICTIONARIES, LOCALES } from '../i18n';
import { apiClient } from '../services/apiClient';
import { clearStudentRecordCache } from '../services/studentRecordsService';
import { StudentAttendanceScreen, CertificatesScreen } from '../screens/roles/student/index';
import { studentHomeEn } from '../i18n/locales/modules/studentHome';
import { AuthUser } from '../types/auth';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockQRCode = (props: any) => React.createElement(Text, { testID: 'mock-qrcode-value' }, props.value);
  MockQRCode.displayName = 'MockQRCode';
  return MockQRCode;
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const USER: AuthUser = {
  id: 'usr_test_student',
  email: 'test.student@example.test',
  fullName: 'Test Student',
  role: 'STUDENT',
  organizationId: 'org_test',
};

const STUDENT_ROW = {
  id: 'stu_test_1',
  user_id: 'usr_test_student',
  organization_id: 'org_test',
  full_name: 'Test Student',
  belt_rank: 'Yellow Belt',
  status: 'ACTIVE',
  class_name: 'Test Class',
};

const row = (id: string, status: string, date: string, group: string, start = '18:00') => ({
  id,
  session_id: `ses_${id}`,
  student_id: 'stu_test_1',
  status,
  marked_by: 'usr_test_master',
  marked_at: `${date}T19:00:00.000Z`,
  session_date: date,
  day_of_week: 'Saturday',
  start_time: start,
  end_time: '19:30',
  location: 'Test Hall',
  is_extra: false,
  group_name: group,
});

// Deliberately out of order: the screen must show newest first.
const ATTENDANCE = [
  row('att_1', 'Present', '2026-11-01', 'Junior Group'),
  row('att_2', 'Absent', '2026-11-08', 'Senior Group'),
  row('att_3', 'Late', '2026-10-25', 'Junior Group'),
  row('att_4', 'Excused', '2026-10-18', 'Junior Group'),
];

const CERTIFICATES = [
  {
    id: 'cert_1',
    code: 'BF-TEST-0001',
    organization_id: 'org_test',
    organization_name: 'Test Academy',
    student_id: 'stu_test_1',
    student_name: 'Test Student',
    master_name: 'Test Master',
    rank_or_title: 'Yellow Belt',
    type: 'Promotion Exam',
    issue_date: '2026-06-01',
    status: 'ACTIVE',
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'cert_2',
    code: 'BF-TEST-0002',
    organization_id: 'org_test',
    organization_name: 'Test Academy',
    student_id: 'stu_test_1',
    student_name: 'Test Student',
    master_name: 'Test Master',
    rank_or_title: 'Green Belt',
    type: 'Promotion Exam',
    issue_date: '2026-09-01',
    status: 'REVOKED',
    revoked_at: '2026-10-01T00:00:00.000Z',
    revocation_reason: 'Issued in error',
    created_at: '2026-09-01T00:00:00.000Z',
  },
];

const get = apiClient.get as jest.Mock;

function mockServer(opts: { attendance?: any[]; certificates?: any[]; failAttendanceOnce?: boolean; failCertificatesOnce?: boolean } = {}) {
  let attendanceFailed = false;
  let certificatesFailed = false;
  get.mockImplementation(async (path: string) => {
    if (path === '/api/v1/students/me') return { student: STUDENT_ROW };
    if (path === '/api/v1/students/stu_test_1/digital-pass') {
      // The server signs the pass; the phone shows it exactly as issued.
      const payload = { type: 'BF_PASS', v: 2, oid: 'org_test', sid: 'stu_test_1', iat: 1, exp: 2, nonce: 'n', sig: 'server-signature' };
      return { pass: { payload, qrString: JSON.stringify(payload), issuedAt: '2026-11-22T00:00:00.000Z', expiresAt: '2099-12-22T00:00:00.000Z' } };
    }
    if (path === '/api/v1/attendance/student/stu_test_1/history') {
      if (opts.failAttendanceOnce && !attendanceFailed) {
        attendanceFailed = true;
        throw new Error('Network down');
      }
      return { attendance: opts.attendance ?? [] };
    }
    if (path === '/api/v1/certificates/student/stu_test_1') {
      if (opts.failCertificatesOnce && !certificatesFailed) {
        certificatesFailed = true;
        throw new Error('Network down');
      }
      return { certificates: opts.certificates ?? [] };
    }
    throw new Error('unexpected GET ' + path);
  });
}

const wrap = (node: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider defaultMode="light">
        <I18nProvider>{node}</I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

const requestedPaths = () => get.mock.calls.map(c => c[0] as string);

describe('Student attendance log and certificates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearStudentRecordCache();
  });

  test('new strings exist in all three languages, with Tamil in Tamil script', () => {
    const newKeys = Object.keys(studentHomeEn).filter(
      k => k.startsWith('studentHome.attendance.') || k.startsWith('studentHome.certificates.')
    );
    expect(newKeys.length).toBeGreaterThan(10);
    for (const locale of LOCALES) {
      const dict = DICTIONARIES[locale] as Record<string, string>;
      for (const key of newKeys) {
        expect({ locale, key, ok: typeof dict[key] === 'string' && dict[key].length > 0 }).toEqual({ locale, key, ok: true });
      }
    }
    const ta = DICTIONARIES.ta as Record<string, string>;
    for (const key of newKeys) {
      expect({ key, tamil: /[஀-௿]/.test(ta[key]) }).toEqual({ key, tamil: true });
    }
  });

  test('attendance rows render from the API fields, newest first, with a summary', async () => {
    mockServer({ attendance: ATTENDANCE });
    const screen = await wrap(<StudentAttendanceScreen user={USER} />);

    expect(await screen.findByTestId('attendance-row-att_2')).toBeTruthy();
    const order = screen.getAllByTestId(/^attendance-row-att_/).map(n => n.props.testID);
    expect(order).toEqual(['attendance-row-att_2', 'attendance-row-att_1', 'attendance-row-att_3', 'attendance-row-att_4']);

    expect(screen.getByText('2026-11-08')).toBeTruthy();
    expect(screen.getByText('Senior Group')).toBeTruthy();
    expect(screen.getAllByText('Junior Group').length).toBe(3);
    expect(screen.getByText('Present')).toBeTruthy();
    expect(screen.getByText('Late')).toBeTruthy();
    expect(screen.getByText('Absent')).toBeTruthy();
    expect(screen.getByText('Excused')).toBeTruthy();
    // Present + Late = attended; all four were marked.
    expect(screen.getByText('2 of 4 sessions attended')).toBeTruthy();

    expect(requestedPaths()).toContain('/api/v1/attendance/student/stu_test_1/history');
    expect(requestedPaths().some(p => p.includes('usr_test_student'))).toBe(false);
  });

  test('attendance empty state', async () => {
    mockServer({ attendance: [] });
    const screen = await wrap(<StudentAttendanceScreen user={USER} />);
    expect(await screen.findByText('No attendance recorded yet')).toBeTruthy();
    expect(screen.queryByTestId(/^attendance-row-/)).toBeNull();
  });

  test('attendance error state retries and then shows the rows', async () => {
    mockServer({ attendance: ATTENDANCE, failAttendanceOnce: true });
    const screen = await wrap(<StudentAttendanceScreen user={USER} />);
    const retry = await screen.findByTestId('student-attendance-error-retry');
    await fireEvent.press(retry);
    expect(await screen.findByTestId('attendance-row-att_1')).toBeTruthy();
  });

  test('digital pass carries the student record id, not the user id', async () => {
    mockServer({ attendance: [] });
    const screen = await wrap(<StudentAttendanceScreen user={USER} />);
    const qr = await screen.findByTestId('mock-qrcode-value');
    const payload = JSON.parse(String(qr.props.children));
    expect(payload.sid).toBe('stu_test_1');
    expect(payload.oid).toBe('org_test');
    expect(payload.sig).toBe('server-signature');
    expect(requestedPaths()).toContain('/api/v1/students/stu_test_1/digital-pass');
  });

  test('certificates render from the real field names; revoked shows as revoked; no fake credential', async () => {
    mockServer({ certificates: CERTIFICATES });
    const screen = await wrap(<CertificatesScreen user={USER} />);

    expect(await screen.findByTestId('certificate-cert_1')).toBeTruthy();
    expect(screen.getByText('Yellow Belt')).toBeTruthy();
    expect(screen.getByText('Green Belt')).toBeTruthy();
    expect(screen.getByText(/2026-06-01.*BF-TEST-0001/)).toBeTruthy();
    expect(screen.getByText(/2026-09-01.*BF-TEST-0002/)).toBeTruthy();

    // Only the active certificate is verified.
    expect(screen.getAllByTestId('qr-verified-badge').length).toBe(1);
    expect(screen.getByTestId('certificate-status-cert_1')).toBeTruthy();
    expect(screen.getByText('Valid')).toBeTruthy();
    expect(screen.getByText('Revoked')).toBeTruthy();
    expect(screen.getByTestId('certificate-status-cert_2')).toBeTruthy();

    expect(screen.queryByText(/BF-CREDENTIAL-ACTIVE/)).toBeNull();
    expect(screen.queryByText('Active Persatuan Record')).toBeNull();

    expect(requestedPaths()).toContain('/api/v1/certificates/student/stu_test_1');
    expect(requestedPaths().some(p => p.includes('usr_test_student'))).toBe(false);
  });

  test('certificates empty state, and no fake credential', async () => {
    mockServer({ certificates: [] });
    const screen = await wrap(<CertificatesScreen user={USER} />);
    expect(await screen.findByText('No certificates yet')).toBeTruthy();
    expect(screen.queryByTestId('digital-certificate-card')).toBeNull();
    expect(screen.queryByText(/BF-CREDENTIAL-ACTIVE/)).toBeNull();
  });

  test('certificates error state retries', async () => {
    mockServer({ certificates: CERTIFICATES, failCertificatesOnce: true });
    const screen = await wrap(<CertificatesScreen user={USER} />);
    const retry = await screen.findByTestId('student-certificates-error-retry');
    await fireEvent.press(retry);
    await waitFor(() => expect(screen.getByTestId('certificate-cert_2')).toBeTruthy());
  });
});
