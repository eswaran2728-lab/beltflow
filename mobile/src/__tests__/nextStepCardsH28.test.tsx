/**
 * H28 backlog item 7: "what happens next" cards for more waiting states.
 *
 * Each card must say who decides (or that no person decides), what happens
 * next and what the person can do now, in EN/BM/Tamil, using the decision
 * makers and timings the server actually enforces:
 *  - payment intents: confirmed by the bank/provider webhook, not a person
 *    (paymentGateway.routes.ts);
 *  - make-up bookings: Master of the target class; waitlist offers held 24 h
 *    (bookings.routes.ts);
 *  - pause requests: Master of the class or Persatuan admin; transfers: the
 *    receiving Master (legacy flow: current Master first) (transfers.routes.ts,
 *    students.routes.ts);
 *  - Master handover: incoming Master, then Persatuan admin (handover.routes.ts).
 * All data here is synthetic.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { paymentGatewayService } from '../services/paymentGatewayService';
import { bookingsService, MakeUpBooking } from '../services/bookingsService';
import { membershipService } from '../services/membershipService';
import { DICTIONARIES, I18nProvider, LOCALES, Locale } from '../i18n';
import { PendingNextStep, PendingKind, hasNextStep } from '../components/PendingNextStep';
import { ParentFeesPaymentScreen } from '../screens/roles/parent/ParentFeesPaymentScreen';
import { ParentMakeUpBookingScreen } from '../screens/roles/parent/ParentMakeUpBookingScreen';
import { ParentStudentLifecycleScreen } from '../screens/roles/parent/ParentStudentLifecycleScreen';
import { ClassHandoverScreen } from '../screens/roles/master/ClassHandoverScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  apiPath: (p: string) => p,
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/paymentGatewayService', () => {
  const actual = jest.requireActual('../services/paymentGatewayService');
  return {
    ...actual,
    paymentGatewayService: {
      getMerchantConfig: jest.fn(),
      getAdminMerchantConfig: jest.fn(),
      saveAdminMerchantConfig: jest.fn(),
      createPaymentIntent: jest.fn(),
      getPaymentIntent: jest.fn(),
      getReconciliationRecords: jest.fn(),
    },
  };
});

jest.mock('../services/bookingsService', () => ({
  bookingsService: {
    requestMakeUp: jest.fn(),
    approveMakeUp: jest.fn(),
    cancelMakeUp: jest.fn(),
    promoteWaitlist: jest.fn(),
    acceptOffer: jest.fn(),
    getSessionBookings: jest.fn(),
    getStudentMakeUps: jest.fn(),
  },
}));

jest.mock('../services/membershipService', () => ({
  membershipService: {
    requestPause: jest.fn(),
    approvePause: jest.fn(),
    resumeMembership: jest.fn(),
    getPendingPauses: jest.fn(),
    requestTransfer: jest.fn(),
    approveTransfer: jest.fn(),
    getPendingTransfers: jest.fn(),
    getStudentHistory: jest.fn(),
  },
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement, locale: Locale = 'en') => (
  <SafeAreaProvider initialMetrics={metrics}>
    <I18nProvider initialLocale={locale}>
      <ThemeProvider defaultMode="dark">{ui}</ThemeProvider>
    </I18nProvider>
  </SafeAreaProvider>
);
const textOf = (node: any): string =>
  typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : node?.props?.children !== undefined ? textOf(node.props.children) : '';

const en = DICTIONARIES.en as Record<string, string>;

const NEW_WAITING_STATES: [PendingKind, string[]][] = [
  ['PAYMENT', ['REQUIRES_PAYMENT_METHOD', 'PENDING_PROCESSING']],
  ['MAKE_UP_BOOKING', ['REQUESTED', 'WAITLISTED', 'OFFERED']],
  ['PAUSE_REQUEST', ['REQUESTED']],
  ['TRANSFER_REQUEST', ['PENDING_RECEIVING', 'REQUESTED', 'PENDING_OLD_MASTER', 'PENDING_NEW_MASTER']],
  ['HANDOVER', ['REQUESTED', 'INCOMING_ACCEPTED']],
];
const FINISHED_STATES: [PendingKind, string[]][] = [
  ['PAYMENT', ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']],
  ['MAKE_UP_BOOKING', ['CONFIRMED', 'ATTENDED', 'CANCELLED', 'EXPIRED']],
  ['PAUSE_REQUEST', ['APPROVED', 'RESUMED']],
  ['TRANSFER_REQUEST', ['APPROVED', 'REJECTED']],
  ['HANDOVER', ['COMPLETED', 'REJECTED']],
];

describe('H28 next-step cards for more waiting states', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  test.each(LOCALES)('every new waiting state explains who decides, what next and what to do (%s)', async locale => {
    for (const [kind, statuses] of NEW_WAITING_STATES) {
      for (const status of statuses) {
        expect(hasNextStep(kind, status)).toBe(true);
        const r = await render(wrap(<PendingNextStep kind={kind} status={status} testID="ns" />, locale));
        for (const part of ['who', 'next', 'action']) {
          const text = textOf(r.getByTestId(`ns-${part}`) as any);
          expect(text.length).toBeGreaterThan(10);
          expect(text).not.toMatch(/^pending\./); // never a raw key
        }
        await act(async () => { await r.unmount(); });
      }
    }
  });

  test('finished states show no card', async () => {
    for (const [kind, statuses] of FINISHED_STATES) {
      for (const status of statuses) {
        expect(hasNextStep(kind, status)).toBe(false);
        const r = await render(wrap(<PendingNextStep kind={kind} status={status} testID="ns" />));
        expect(r.queryByTestId('ns')).toBeNull();
        await act(async () => { await r.unmount(); });
      }
    }
  });

  test('cards name the decision maker the server enforces', () => {
    // Payments are confirmed by the bank, not by academy staff.
    expect(en['pending.PAYMENT.who']).toMatch(/bank/i);
    expect(en['pending.PAYMENT.who']).toMatch(/no one at the academy/i);
    // Payment text never implies the fee is paid before confirmation.
    expect(en['pending.PAYMENT.PENDING_PROCESSING.next']).toMatch(/not marked as paid/i);
    // Waitlist offers are held for 24 hours (bookings.routes.ts offer_expires_at).
    expect(en['pending.MAKE_UP_BOOKING.OFFERED.next']).toMatch(/24 hours/);
    // Legacy transfer flow: current Master first.
    expect(en['pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.who']).toMatch(/current Master/);
    // Handover: Persatuan admin gives final approval.
    expect(en['pending.HANDOVER.INCOMING_ACCEPTED.who']).toMatch(/Persatuan admin/);
  });

  test('a status-specific "who" overrides the general one', async () => {
    const r = await render(wrap(<PendingNextStep kind="TRANSFER_REQUEST" status="PENDING_OLD_MASTER" testID="ns" />));
    expect(textOf(r.getByTestId('ns-who') as any)).toBe(en['pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.who']);
    await act(async () => { await r.unmount(); });
    const r2 = await render(wrap(<PendingNextStep kind="TRANSFER_REQUEST" status="PENDING_RECEIVING" testID="ns" />));
    expect(textOf(r2.getByTestId('ns-who') as any)).toBe(en['pending.TRANSFER_REQUEST.who']);
    await act(async () => { await r2.unmount(); });
  });

  test('payment screen shows the card while the bank is confirming', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/dashboard/parent') return Promise.resolve({ children: [{ id: 'stu_x', fullName: 'Test Child', currentBeltRank: 'White', organizationId: 'org_x' }] });
      if (url.includes('/billing/student/')) return Promise.resolve({ dues: [{ id: 'due_x', class_id: 'cls_x', student_id: 'stu_x', billing_month: '2026-03', fee_amount: 80, amount_paid: 0, status: 'Pending' }] });
      if (url.includes('/payments')) return Promise.resolve({ payments: [] });
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    (paymentGatewayService.getMerchantConfig as jest.Mock).mockResolvedValue({
      configured: true,
      merchant: { id: 'm', merchantName: 'Test Persatuan', provider: 'SANDBOX', settlementBankName: 'Test Bank', settlementAccountMasked: '****0000', fpxEnabled: true, duitnowEnabled: true, status: 'ACTIVE' },
    });
    (paymentGatewayService.createPaymentIntent as jest.Mock).mockResolvedValue({
      intent: { id: 'intent_x', amountCents: 8000, amountRM: '80.00', currency: 'MYR', paymentMethod: 'FPX', status: 'PENDING_PROCESSING', createdAt: new Date().toISOString() },
    });
    const parent: AuthUser = { id: 'usr_p', fullName: 'Test Parent', email: 'p@example.test', role: UserRole.PARENT, organizationId: 'org_x' };

    const r = await render(wrap(<ParentFeesPaymentScreen user={parent} />));
    await waitFor(() => expect(r.getByTestId('btn-pay-now')).toBeTruthy());
    await act(async () => { fireEvent.press(r.getByTestId('btn-pay-now')); });
    await waitFor(() => expect(r.getByTestId('payment-next-step')).toBeTruthy());
    expect(textOf(r.getByTestId('payment-next-step-who') as any)).toBe(en['pending.PAYMENT.who']);
    expect(r.getByTestId('btn-check-payment-status')).toBeTruthy();
    await act(async () => { await r.unmount(); });
  });

  const booking = (over: Partial<MakeUpBooking>): MakeUpBooking => ({
    id: 'bk_x', organization_id: 'org_x', student_id: 'stu_x', original_class_id: 'cls_a', target_session_id: 'sess_x',
    target_class_id: 'cls_b', status: 'REQUESTED', version: 1, target_class_name: 'Test Make-Up Class',
    session_date: '2026-12-01', day_of_week: 'Tuesday', start_time: '20:00', end_time: '21:00', location: 'Test Hall',
    created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', ...over,
  } as MakeUpBooking);

  test('make-up screen: an offered seat shows the card and can be accepted', async () => {
    (bookingsService.getStudentMakeUps as jest.Mock).mockResolvedValue([
      booking({ id: 'bk_offer', status: 'OFFERED', offer_expires_at: '2026-12-01T10:00:00Z' } as any),
      booking({ id: 'bk_done', status: 'CONFIRMED' }),
    ]);
    (bookingsService.acceptOffer as jest.Mock).mockResolvedValue(booking({ id: 'bk_offer', status: 'CONFIRMED' }));
    const parent: AuthUser = { id: 'usr_p', fullName: 'Test Parent', email: 'p@example.test', role: UserRole.PARENT, organizationId: 'org_x' };

    const r = await render(wrap(<ParentMakeUpBookingScreen user={parent} route={{ params: { studentId: 'stu_x' } }} />));
    await waitFor(() => expect(r.getByTestId('booking-next-step-bk_offer')).toBeTruthy());
    expect(r.queryByTestId('booking-next-step-bk_done')).toBeNull();
    expect(r.queryByTestId('accept-offer-btn-bk_done')).toBeNull();

    await act(async () => { fireEvent.press(r.getByTestId('accept-offer-btn-bk_offer')); });
    await waitFor(() => expect(bookingsService.acceptOffer).toHaveBeenCalledWith('bk_offer'));
    await waitFor(() => expect(bookingsService.getStudentMakeUps).toHaveBeenCalledTimes(2));
    await act(async () => { await r.unmount(); });
  });

  test('lifecycle screen: a legacy two-step transfer counts as pending and shows the card', async () => {
    (membershipService.getStudentHistory as jest.Mock).mockResolvedValue({
      enrollments: [{ id: 'enr', class_id: 'cls_a', class_name: 'Test Class', status: 'ACTIVE', is_primary: true, provenance: 'MASTER_APPROVED', effective_from: '2026-01-01', created_at: '2026-01-01T00:00:00Z' }],
      pauses: [{ id: 'p1', organization_id: 'org_x', student_id: 'stu_x', class_id: 'cls_a', requested_by_user_id: 'usr_p', reason: 'Exams', start_date: '2026-12-01', status: 'REQUESTED', version: 1, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }],
      transfers: [{ id: 't1', student_id: 'stu_x', organization_id: 'org_x', old_class_id: 'cls_a', new_class_id: 'cls_b', effective_date: '2026-12-15', reason: 'Schedule', consent_accepted: true, old_master_approved: false, new_master_approved: false, status: 'PENDING_OLD_MASTER', version: 1, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }],
      attendanceCount: 3,
      paymentsCount: 1,
    });
    const parent: AuthUser = { id: 'usr_p', fullName: 'Test Parent', email: 'p@example.test', role: UserRole.PARENT, organizationId: 'org_x' };

    const r = await render(wrap(<ParentStudentLifecycleScreen user={parent} route={{ params: { studentId: 'stu_x' } }} />));
    await waitFor(() => expect(r.getByTestId('pause-next-step')).toBeTruthy());
    expect(r.getByTestId('transfer-next-step')).toBeTruthy();
    expect(textOf(r.getByTestId('transfer-next-step-who') as any)).toBe(en['pending.TRANSFER_REQUEST.PENDING_OLD_MASTER.who']);
    await act(async () => { await r.unmount(); });
  });

  test('handover screen: the sending Master sees who decides next', async () => {
    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/classes/cls_x/leaderships') return Promise.resolve({ leaderships: [] });
      if (path === '/classes/cls_x/handover') {
        return Promise.resolve({
          history: [],
          activeHandover: { id: 'h1', status: 'INCOMING_ACCEPTED', incoming_master_id: 'usr_in', incoming_master_name: 'Test Incoming', reason: 'Relocation', created_at: '2026-11-01T00:00:00Z' },
        });
      }
      return Promise.resolve({});
    });
    const master: AuthUser = { id: 'usr_out', fullName: 'Test Master', email: 'm@example.test', role: UserRole.MASTER, organizationId: 'org_x', assignedClassIds: ['cls_x'] };

    const r = await render(wrap(<ClassHandoverScreen user={master} route={{ params: { classId: 'cls_x', className: 'Test Class' } }} />));
    await waitFor(() => expect(r.getByTestId('handover-next-step')).toBeTruthy());
    expect(textOf(r.getByTestId('handover-next-step-who') as any)).toBe(en['pending.HANDOVER.INCOMING_ACCEPTED.who']);
    await act(async () => { await r.unmount(); });
  });
});
