/**
 * students.billing_status must reflect the monthly-dues ledger:
 * 'Paid' only when no generated month is still owed, otherwise 'Unpaid'.
 *
 * Before: any successful payment set 'Paid' even with other months unpaid,
 * and generating a new month never set it back, so after one payment a
 * student stayed 'Paid' forever and dropped off the Master's overdue list
 * (trials.routes.ts "OVERDUE_TUITION") and the parent's family hub.
 * Students with no dues ledger are left as they are.
 * Synthetic data only.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { SandboxGatewayAdapter } from '../services/payment/sandboxAdapter';

type Res = { status: number; data: any };
function request(server: http.Server, method: string, urlPath: string, opts: { token?: string; body?: any; headers?: Record<string, string> } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = opts.body === undefined ? '' : JSON.stringify(opts.body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close', ...(opts.headers || {}) };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const req = http.request({ host: '127.0.0.1', port: addr.port, path: `/api/v1${urlPath}`, method, headers }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode || 0, data: raw }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧾 Starting billing status sync tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-billing-status-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  try {
    const org = 'org_bs';
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Test Persatuan Billing', 'Selangor', 'Silat', 'Test', '0100000000', 'bs@example.test') ON CONFLICT (id) DO NOTHING`, [org]);
    for (const [id, role] of [['bs_adm', 'ADMIN_PERSATUAN'], ['bs_mst', 'MASTER'], ['bs_par', 'PARENT']]) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, org]);
    }
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
       VALUES ('cls_bs', $1, 'bs_mst', 'Test Class Billing', 'Sat 10am', 'Test Hall', 80, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org]);
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id) VALUES ('bs_mst', 'cls_bs') ON CONFLICT DO NOTHING`).catch(() => undefined);
    for (const [id, name] of [['stu_bs_1', 'Test Child One'], ['stu_bs_2', 'Test Child Two'], ['stu_bs_legacy', 'Test Child Legacy']]) {
      await dbClient.query(
        `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status, billing_status)
         VALUES ($1, $2, 'cls_bs', $3, $4, 'White Belt', 80, 'ACTIVE', 'Unpaid') ON CONFLICT (id) DO NOTHING`, [id, org, name, `000000-00-${id.slice(-4)}`]);
    }
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_bs_1', 'bs_par', 'stu_bs_1', 'ACTIVE', true, true, true) ON CONFLICT (parent_id, student_id) DO NOTHING`);
    const tok = (id: string, role: UserRole, extra: object = {}) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org, ...extra } as any);
    const tAdm = tok('bs_adm', UserRole.ADMIN_PERSATUAN);
    const tMst = tok('bs_mst', UserRole.MASTER, { assignedClassIds: ['cls_bs'] });
    const tPar = tok('bs_par', UserRole.PARENT, { linkedStudentIds: ['stu_bs_1'] });
    const statusOf = async (id: string) => (await dbClient.query('SELECT billing_status FROM students WHERE id = $1', [id])).rows[0].billing_status;
    const dueId = async (studentId: string, month: string) =>
      (await dbClient.query('SELECT id FROM monthly_dues WHERE student_id = $1 AND billing_month = $2', [studentId, month])).rows[0].id;

    // Master bills two months for the class.
    for (const month of ['2026-09', '2026-10']) {
      const gen = await request(server, 'POST', '/billing/monthly-dues/generate', { token: tMst, body: { classId: 'cls_bs', billingMonth: month } });
      assert.equal(gen.status, 201, `generate ${month}: ${JSON.stringify(gen.data)}`);
    }

    // ---------------------------------------------- online payment (H13 gateway)
    const secret = 'test_webhook_secret_bs_0001';
    const m = await request(server, 'PUT', '/payments/merchant/my-config', {
      token: tAdm,
      body: { merchantAccountId: 'MERCH_TEST_BS', merchantName: 'Test Persatuan Billing', provider: 'SANDBOX', settlementBankName: 'Test Bank',
        settlementAccountNumber: '000011113333', fpxEnabled: true, duitnowEnabled: true, cardEnabled: false, webhookSecret: secret },
    });
    assert.equal(m.status, 200, JSON.stringify(m.data));
    let evt = 0;
    const payOnline = async (dueIds: string[]) => {
      const intent = await request(server, 'POST', '/payments/intents', { token: tPar, body: { studentId: 'stu_bs_1', billingMonthIds: dueIds, paymentMethod: 'FPX', fpxBankCode: 'TEST0001' } });
      assert.equal(intent.status, 201, JSON.stringify(intent.data));
      const i = intent.data.intent;
      const payload = { eventId: `evt_bs_${++evt}`, eventType: 'payment.succeeded', intentId: i.id, providerTxId: i.providerTxId, merchantAccountId: 'MERCH_TEST_BS', amountCents: i.amountCents, currency: 'MYR' };
      const sig = SandboxGatewayAdapter.generateTestWebhook(payload as any, secret).signature;
      const wh = await request(server, 'POST', '/payments/webhooks/SANDBOX', { body: payload, headers: { 'x-beltflow-signature': sig } });
      assert.equal(wh.status, 200, JSON.stringify(wh.data));
    };
    await payOnline([await dueId('stu_bs_1', '2026-09')]);
    assert.equal(await statusOf('stu_bs_1'), 'Unpaid', 'one month still owed after paying the other');
    await payOnline([await dueId('stu_bs_1', '2026-10')]);
    assert.equal(await statusOf('stu_bs_1'), 'Paid', 'all months paid');
    console.log('✅ Online payments: Paid only when no month is still owed.');

    // ---------------------------------------------- new month reopens
    const gen3 = await request(server, 'POST', '/billing/monthly-dues/generate', { token: tMst, body: { classId: 'cls_bs', billingMonth: '2026-11' } });
    assert.equal(gen3.status, 201);
    assert.equal(await statusOf('stu_bs_1'), 'Unpaid', 'a newly billed month makes a paid-up student Unpaid again');
    console.log('✅ Billing a new month sets Unpaid.');

    // ---------------------------------------------- cash payment by Master
    const d2 = [await dueId('stu_bs_2', '2026-09'), await dueId('stu_bs_2', '2026-10'), await dueId('stu_bs_2', '2026-11')];
    const partial = await request(server, 'POST', '/billing/record-cash-payment', { token: tMst, body: { studentId: 'stu_bs_2', amount: 80, billingMonthIds: [d2[0]] } });
    assert.equal(partial.status, 201, JSON.stringify(partial.data));
    assert.equal(await statusOf('stu_bs_2'), 'Unpaid', 'cash for one of three months leaves Unpaid');
    const rest = await request(server, 'POST', '/billing/record-cash-payment', { token: tMst, body: { studentId: 'stu_bs_2', amount: 160, billingMonthIds: [d2[1], d2[2]] } });
    assert.equal(rest.status, 201, JSON.stringify(rest.data));
    assert.equal(await statusOf('stu_bs_2'), 'Paid', 'cash covering every month gives Paid');
    console.log('✅ Cash payments: same rule.');

    // ---------------------------------------------- overdue follow-up sees it
    assert.equal(await statusOf('stu_bs_1'), 'Unpaid');
    const overdue = await dbClient.query(
      `SELECT id FROM students WHERE class_id = 'cls_bs' AND status = 'ACTIVE' AND billing_status = 'Unpaid' ORDER BY id`);
    assert.ok(overdue.rows.some((r: any) => r.id === 'stu_bs_1'), 'a student with an unpaid month is visible to the overdue rule');
    assert.ok(!overdue.rows.some((r: any) => r.id === 'stu_bs_2'), 'a fully paid student is not');

    // ---------------------------------------------- no ledger: old behaviour kept
    await dbClient.query(`DELETE FROM monthly_dues WHERE student_id = 'stu_bs_legacy'`);
    await dbClient.query(`UPDATE students SET billing_status = 'Unpaid' WHERE id = 'stu_bs_legacy'`);
    const legacyCash = await request(server, 'POST', '/billing/record-cash-payment', { token: tMst, body: { studentId: 'stu_bs_legacy', amount: 80 } });
    assert.equal(legacyCash.status, 201, JSON.stringify(legacyCash.data));
    assert.equal(await statusOf('stu_bs_legacy'), 'Paid', 'with no dues ledger a payment still marks Paid, as before');
    console.log('✅ Students without a dues ledger keep the old behaviour.');

    console.log('\n🎉 Billing status sync tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Billing status sync tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runBillingStatusSyncTests };
