/**
 * Follow-ups to H27 known gaps and H13 payment safety (2026-11-12).
 *
 *  A. Worker trigger routes (waitlist sweep, scheduled transfers) process every
 *     Persatuan, so only Super Admin or the internal worker key may call them.
 *  B. runWorkerCycle() runs the idempotent jobs and skips disabled modules.
 *  C. Payment intents past expires_at become EXPIRED, but a genuine bank
 *     success webhook still settles them (money already moved).
 *  D. A failure webhook can never overwrite a SUCCEEDED intent.
 *  H. Only one live payment per billing month (409 PAYMENT_IN_PROGRESS).
 *  G. An Admin Persatuan may only read payment intents of their own Persatuan.
 *  F. A second settlement for dues that are already paid is not silently
 *     absorbed: it is recorded as DISCREPANCY_AMOUNT for the admin to refund
 *     or credit, and dues are never over-applied.
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
import { runWorkerCycle, expireStalePaymentIntents } from '../workers/scheduler';
import { registerGatewayAdapter } from '../services/payment/gatewayRegistry';

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
  console.log('🛠️  Starting ops & payment safety follow-up tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-ops-safety-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const savedWorkerToken = process.env.BELTFLOW_WORKER_TOKEN;
  const savedDisabled = process.env.BELTFLOW_DISABLED_MODULES;

  try {
    const org = 'org_ops_safety';
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Test Persatuan Ops', 'Selangor', 'Silat', 'Test Master', '0100000000', 'ops@example.test') ON CONFLICT (id) DO NOTHING`, [org]);
    const users: Array<[string, UserRole, string | undefined]> = [
      ['ops_sa', UserRole.SUPER_ADMIN, undefined], ['ops_adm', UserRole.ADMIN_PERSATUAN, org],
      ['ops_mst', UserRole.MASTER, org], ['ops_par', UserRole.PARENT, org], ['ops_stu', UserRole.STUDENT, org],
    ];
    for (const [id, role, o] of users) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, o || null]);
    }
    const studentId = 'stu_ops_1';
    await dbClient.query(
      `INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, status, billing_status)
       VALUES ($1, $2, 'Test Student Ops', '000000-00-0000', 'White Belt', 'Active', 'Unpaid') ON CONFLICT (id) DO NOTHING`, [studentId, org]);
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_ops_1', 'ops_par', $1, 'ACTIVE', true, true, true) ON CONFLICT (parent_id, student_id) DO NOTHING`, [studentId]);
    const tok = (id: string, role: UserRole, o?: string, extra: Record<string, unknown> = {}) =>
      generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: o, ...extra } as any);
    const tSA = tok('ops_sa', UserRole.SUPER_ADMIN);
    const tAdm = tok('ops_adm', UserRole.ADMIN_PERSATUAN, org);
    const tMst = tok('ops_mst', UserRole.MASTER, org);
    const tPar = tok('ops_par', UserRole.PARENT, org, { linkedStudentIds: [studentId] });
    const tStu = tok('ops_stu', UserRole.STUDENT, org);

    // ------------------------------------------------------------------ A
    process.env.BELTFLOW_WORKER_TOKEN = 'test-worker-key-0123456789abcdef';
    const workerRoutes = ['/bookings/waitlist/sweep-expired', '/transfers/activate-scheduled'];
    for (const route of workerRoutes) {
      for (const [label, t] of [['Admin Persatuan', tAdm], ['Master', tMst], ['Parent', tPar], ['Student', tStu]] as const) {
        const r = await request(server, 'POST', route, { token: t, body: {} });
        assert.equal(r.status, 403, `${label} must not trigger ${route} (got ${r.status})`);
      }
      const anon = await request(server, 'POST', route, { body: {} });
      assert.ok(anon.status === 401 || anon.status === 403, `anonymous must not trigger ${route} (got ${anon.status})`);
      const wrongKey = await request(server, 'POST', route, { body: {}, headers: { 'x-beltflow-worker-token': 'wrong-key' } });
      assert.ok(wrongKey.status === 401 || wrongKey.status === 403, `wrong worker key must be refused on ${route} (got ${wrongKey.status})`);
      const sa = await request(server, 'POST', route, { token: tSA, body: {} });
      assert.equal(sa.status, 200, `Super Admin may trigger ${route} (got ${sa.status} ${JSON.stringify(sa.data)})`);
      const key = await request(server, 'POST', route, { body: {}, headers: { 'x-beltflow-worker-token': process.env.BELTFLOW_WORKER_TOKEN } });
      assert.equal(key.status, 200, `the worker key may trigger ${route} (got ${key.status})`);
    }
    delete process.env.BELTFLOW_WORKER_TOKEN;
    const noKeyConfigured = await request(server, 'POST', workerRoutes[0], { body: {}, headers: { 'x-beltflow-worker-token': '' } });
    assert.ok(noKeyConfigured.status === 401 || noKeyConfigured.status === 403, 'an empty key never matches when no key is configured');
    console.log('✅ A: worker routes refuse every role except Super Admin and the worker key.');

    // ------------------------------------------------------------------ B
    const cycle = await runWorkerCycle(process.env);
    assert.equal(typeof cycle.transfersActivated, 'number');
    assert.equal(typeof cycle.waitlistOffersExpired, 'number');
    assert.equal(typeof cycle.paymentIntentsExpired, 'number');
    assert.deepEqual(cycle.errors, []);
    const skipped = await runWorkerCycle({ ...process.env, BELTFLOW_DISABLED_MODULES: 'bookings,transfers' });
    assert.equal(skipped.waitlistOffersExpired, null, 'bookings job skipped when module disabled');
    assert.equal(skipped.transfersActivated, null, 'transfers job skipped when module disabled');
    assert.equal(typeof skipped.paymentIntentsExpired, 'number', 'payment expiry is core and always runs');
    console.log('✅ B: worker cycle runs each job and skips disabled modules.');

    // ---------------------------------------------------- payment set-up
    const secret = 'test_webhook_secret_ops_0001';
    const merchant = await request(server, 'PUT', '/payments/merchant/my-config', {
      token: tAdm,
      body: { merchantAccountId: 'MERCH_TEST_OPS', merchantName: 'Test Persatuan Ops', provider: 'SANDBOX', settlementBankName: 'Test Bank',
        settlementAccountNumber: '000011112222', fpxEnabled: true, duitnowEnabled: true, cardEnabled: false, webhookSecret: secret },
    });
    assert.equal(merchant.status, 200, `merchant setup ${JSON.stringify(merchant.data)}`);
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
       VALUES ('cls_ops_1', $1, 'ops_mst', 'Test Class Ops', 'Sat 10am', 'Test Hall', 80.00, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org]);
    const due = async (id: string, month: string) => dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, 'cls_ops_1', $3, $4, 80.00, 0.00, 'Pending') ON CONFLICT (id) DO NOTHING`, [id, org, studentId, month]);
    const newIntent = async (dueIds: string[]) => {
      const r = await request(server, 'POST', '/payments/intents', { token: tPar, body: { studentId, billingMonthIds: dueIds, paymentMethod: 'FPX', fpxBankCode: 'TEST0001' } });
      assert.equal(r.status, 201, `intent created ${JSON.stringify(r.data)}`);
      return r.data.intent;
    };
    let evt = 0;
    const webhook = async (intent: any, eventType: 'payment.succeeded' | 'payment.failed') => {
      const payload = { eventId: `evt_ops_${++evt}`, eventType, intentId: intent.id, providerTxId: intent.providerTxId,
        merchantAccountId: 'MERCH_TEST_OPS', amountCents: intent.amountCents, currency: 'MYR' };
      const sig = SandboxGatewayAdapter.generateTestWebhook(payload, secret).signature;
      return request(server, 'POST', '/payments/webhooks/SANDBOX', { body: payload, headers: { 'x-beltflow-signature': sig } });
    };
    const intentStatus = async (id: string) => (await dbClient.query('SELECT status FROM payment_intents WHERE id = $1', [id])).rows[0].status;

    // ------------------------------------------------------------------ C
    await due('due_ops_c', '2026-01');
    const stale = await newIntent(['due_ops_c']);
    // Only one live intent per month: the stale link must be past its window first.
    await dbClient.query(`UPDATE payment_intents SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, [stale.id]);
    const fresh = await newIntent(['due_ops_c']);
    const expiredCount = await expireStalePaymentIntents();
    assert.ok(expiredCount >= 1, 'at least the stale intent expired');
    assert.equal(await intentStatus(stale.id), 'EXPIRED');
    assert.equal(await intentStatus(fresh.id), 'PENDING_PROCESSING', 'an intent inside its window is untouched');
    assert.equal(await expireStalePaymentIntents(), 0, 'expiry is idempotent');
    const viewed = await request(server, 'GET', `/payments/intents/${stale.id}`, { token: tPar });
    assert.equal(viewed.status, 200);
    assert.equal(viewed.data.intent?.status ?? viewed.data.status, 'EXPIRED', 'parent sees EXPIRED');
    // Lazy expiry: viewing an overdue intent expires it even if no worker ran.
    await dbClient.query(`UPDATE payment_intents SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, [fresh.id]);
    const lazy = await request(server, 'GET', `/payments/intents/${fresh.id}`, { token: tPar });
    assert.equal(lazy.data.intent?.status ?? lazy.data.status, 'EXPIRED', 'viewing an overdue intent shows EXPIRED');
    // The bank still confirms a payment the parent completed before the link expired.
    const late = await webhook(stale, 'payment.succeeded');
    assert.equal(late.status, 200, `late success settles ${JSON.stringify(late.data)}`);
    assert.equal(await intentStatus(stale.id), 'SUCCEEDED', 'a genuine success settles an EXPIRED intent');
    const dueC = (await dbClient.query('SELECT status, amount_paid FROM monthly_dues WHERE id = $1', ['due_ops_c'])).rows[0];
    assert.equal(dueC.status, 'Paid');
    console.log('✅ C: overdue intents expire (worker and on view); a genuine late success still settles.');

    // ------------------------------------------------------------------ D
    await due('due_ops_d', '2026-02');
    const d = await newIntent(['due_ops_d']);
    assert.equal((await webhook(d, 'payment.succeeded')).status, 200);
    const lateFail = await webhook(d, 'payment.failed');
    assert.equal(lateFail.status, 200, 'late failure is acknowledged so the provider stops retrying');
    assert.equal(await intentStatus(d.id), 'SUCCEEDED', 'a failure after success must not overwrite SUCCEEDED');
    const dueD = (await dbClient.query('SELECT status FROM monthly_dues WHERE id = $1', ['due_ops_d'])).rows[0];
    assert.equal(dueD.status, 'Paid');
    console.log('✅ D: a late failure webhook cannot undo a settled payment.');

    // ------------------------------------------------------------------ F
    await due('due_ops_f', '2026-03');
    const f1 = await newIntent(['due_ops_f']);
    // A second payment is only possible once the first link expired (the bank can still confirm both).
    await dbClient.query(`UPDATE payment_intents SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, [f1.id]);
    const f2 = await newIntent(['due_ops_f']);
    assert.equal((await webhook(f1, 'payment.succeeded')).status, 200);
    assert.equal((await webhook(f2, 'payment.succeeded')).status, 200);
    const dueF = (await dbClient.query('SELECT amount_paid, fee_amount, status FROM monthly_dues WHERE id = $1', ['due_ops_f'])).rows[0];
    assert.equal(Number(dueF.amount_paid), Number(dueF.fee_amount), 'dues are never over-applied');
    const recs = await dbClient.query(
      `SELECT payment_intent_id, match_status, notes FROM payment_reconciliation_records WHERE payment_intent_id = ANY($1::text[])`, [[f1.id, f2.id]]);
    const byIntent = Object.fromEntries(recs.rows.map((r: any) => [r.payment_intent_id, r]));
    assert.equal(byIntent[f1.id]?.match_status, 'MATCHED');
    assert.equal(byIntent[f2.id]?.match_status, 'DISCREPANCY_AMOUNT', 'the duplicate payment is flagged for refund or credit');
    assert.match(byIntent[f2.id]?.notes || '', /refund|credit/i);
    const admView = await request(server, 'GET', '/payments/reconciliation', { token: tAdm });
    assert.equal(admView.status, 200);
    assert.ok(JSON.stringify(admView.data).includes('DISCREPANCY_AMOUNT'), 'the admin reconciliation view shows the flag');
    console.log('✅ F: a duplicate payment is flagged DISCREPANCY_AMOUNT and dues are not over-applied.');

    // ------------------------------------------------------------------ H
    const post = (body: object) => request(server, 'POST', '/payments/intents', { token: tPar, body: { studentId, paymentMethod: 'FPX', fpxBankCode: 'TEST0001', ...body } });
    // H1: an exact idempotent retry still returns the same intent.
    await due('due_ops_h1', '2026-05');
    const h1 = await post({ billingMonthIds: ['due_ops_h1'], idempotencyKey: 'idem_ops_h1' });
    assert.equal(h1.status, 201);
    const h1again = await post({ billingMonthIds: ['due_ops_h1'], idempotencyKey: 'idem_ops_h1' });
    assert.equal(h1again.status, 200, 'idempotent retry is not refused');
    assert.equal(h1again.data.intent.id, h1.data.intent.id);
    assert.notEqual(h1again.data.code, 'PAYMENT_IN_PROGRESS');
    // H2: a month already in a live payment is refused, even mixed with a new month.
    await due('due_ops_h2a', '2026-06');
    await due('due_ops_h2b', '2026-07');
    const h2 = await newIntent(['due_ops_h2a']);
    const h2dup = await post({ billingMonthIds: ['due_ops_h2a', 'due_ops_h2b'] });
    assert.equal(h2dup.status, 409, `second payment refused (${JSON.stringify(h2dup.data)})`);
    assert.equal(h2dup.data.code, 'PAYMENT_IN_PROGRESS');
    assert.equal(h2dup.data.intent.id, h2.id, 'the payment in progress is returned');
    assert.ok(h2dup.data.intent.providerSessionUrl, 'so the app can reopen the bank page');
    const h2bIntents = await dbClient.query(`SELECT id FROM payment_intents WHERE student_id = $1 AND 'due_ops_h2b' = ANY(billing_month_ids)`, [studentId]);
    assert.equal(h2bIntents.rows.length, 0, 'no new intent was created');
    // H3: an intent past its window but not yet swept does not block.
    await due('due_ops_h3', '2026-08');
    const h3 = await newIntent(['due_ops_h3']);
    await dbClient.query(`UPDATE payment_intents SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, [h3.id]);
    assert.equal(await intentStatus(h3.id), 'PENDING_PROCESSING');
    assert.equal((await post({ billingMonthIds: ['due_ops_h3'] })).status, 201, 'an overdue link frees the month');
    // H4: a failed attempt does not block a retry; another child is not blocked.
    await due('due_ops_h4', '2026-09');
    const h4 = await newIntent(['due_ops_h4']);
    assert.equal((await webhook(h4, 'payment.failed')).status, 200);
    assert.equal((await post({ billingMonthIds: ['due_ops_h4'] })).status, 201, 'retry after a failure is allowed');
    await dbClient.query(
      `INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, status, billing_status)
       VALUES ('stu_ops_2', $1, 'Test Student Ops Two', '000000-00-0002', 'White Belt', 'Active', 'Unpaid') ON CONFLICT (id) DO NOTHING`, [org]);
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_ops_2', 'ops_par', 'stu_ops_2', 'ACTIVE', true, true, true) ON CONFLICT (parent_id, student_id) DO NOTHING`);
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ('due_ops_h4s', $1, 'cls_ops_1', 'stu_ops_2', '2026-09', 80.00, 0.00, 'Pending') ON CONFLICT (id) DO NOTHING`, [org]);
    const tPar2 = tok('ops_par', UserRole.PARENT, org, { linkedStudentIds: [studentId, 'stu_ops_2'] });
    const other = await request(server, 'POST', '/payments/intents', { token: tPar2, body: { studentId: 'stu_ops_2', billingMonthIds: ['due_ops_h4s'], paymentMethod: 'FPX', fpxBankCode: 'TEST0001' } });
    assert.equal(other.status, 201, `another child's payment is not blocked (${JSON.stringify(other.data)})`);
    console.log('✅ H: one live payment per month; idempotent retries, overdue links, failed attempts and other children are not blocked.');

    // ------------------------------------------------------------------ I (final-review fixes)
    // I1: if the bank session cannot be created, the half-made intent must not lock the month.
    registerGatewayAdapter('BROKENTEST', { createPaymentSession: async () => { throw new Error('provider down'); } } as any);
    await dbClient.query(`UPDATE persatuan_merchants SET provider = 'BROKENTEST' WHERE organization_id = $1`, [org]);
    await due('due_ops_i1', '2026-10');
    const broken = await post({ billingMonthIds: ['due_ops_i1'] });
    assert.ok(broken.status >= 500, `provider failure surfaces as an error (got ${broken.status})`);
    const leftover = await dbClient.query(`SELECT status FROM payment_intents WHERE 'due_ops_i1' = ANY(billing_month_ids)`);
    assert.ok(leftover.rows.every((r: any) => r.status === 'FAILED'), `a failed session setup is marked FAILED (${JSON.stringify(leftover.rows)})`);
    await dbClient.query(`UPDATE persatuan_merchants SET provider = 'SANDBOX' WHERE organization_id = $1`, [org]);
    assert.equal((await post({ billingMonthIds: ['due_ops_i1'] })).status, 201, 'the parent can try again straight away');

    // I2: concurrent requests for the same month create exactly one intent.
    await due('due_ops_i2', '2026-11');
    const burst = await Promise.all(Array.from({ length: 30 }, () => post({ billingMonthIds: ['due_ops_i2'] })));
    const codes = burst.map(r => r.status).sort();
    assert.equal(codes.filter(c => c === 201).length, 1, `exactly one payment created (${codes.join(',')})`);
    assert.equal(codes.filter(c => c === 409).length, 29, `the rest are told one is in progress (${codes.join(',')})`);
    const i2Rows = await dbClient.query(`SELECT id FROM payment_intents WHERE 'due_ops_i2' = ANY(billing_month_ids)`);
    assert.equal(i2Rows.rows.length, 1, 'one intent row for the month');

    // I3: only the person who started the payment gets its bank session link back.
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ('ops_par_co', 'ops_par_co@example.test', 'h', 'Test Co-Parent', 'PARENT', $1, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org]);
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_ops_co', 'ops_par_co', $1, 'ACTIVE', true, true, true) ON CONFLICT (parent_id, student_id) DO NOTHING`, [studentId]);
    const tCo = tok('ops_par_co', UserRole.PARENT, org, { linkedStudentIds: [studentId] });
    const coTry = await request(server, 'POST', '/payments/intents', { token: tCo, body: { studentId, billingMonthIds: ['due_ops_i2'], paymentMethod: 'FPX', fpxBankCode: 'TEST0001' } });
    assert.equal(coTry.status, 409);
    assert.ok(coTry.data.intent?.id, 'the co-parent still learns a payment is in progress');
    assert.equal(coTry.data.intent.providerSessionUrl ?? null, null, "another person never gets the payer's bank link");
    const payerTry = await post({ billingMonthIds: ['due_ops_i2'] });
    assert.ok(payerTry.data.intent.providerSessionUrl, 'the payer gets their own bank link to reopen');
    // I4: a retry key belongs to the payer who used it; another user sending the same key learns nothing.
    await dbClient.query(`UPDATE payment_intents SET idempotency_key = 'idem_ops_i4' WHERE id = $1`, [payerTry.data.intent.id]);
    const coKey = await request(server, 'POST', '/payments/intents', { token: tCo, body: { studentId, billingMonthIds: ['due_ops_i2'], paymentMethod: 'FPX', fpxBankCode: 'TEST0001', idempotencyKey: 'idem_ops_i4' } });
    assert.equal(coKey.status, 409, `another user's retry key is refused: ${JSON.stringify(coKey.data)}`);
    assert.equal(coKey.data.code, 'IDEMPOTENCY_KEY_CONFLICT');
    assert.ok(!JSON.stringify(coKey.data).includes('http'), 'no bank link or intent details');
    const ownKey = await post({ billingMonthIds: ['due_ops_i2'], idempotencyKey: 'idem_ops_i4' });
    assert.equal(ownKey.data.intent?.id, payerTry.data.intent.id, 'the payer still gets their own intent back');
    console.log('✅ I: failed session setup does not lock the month; concurrent requests create one payment; bank link only for the payer.');

    // ------------------------------------------------------------------ G
    const otherOrg = 'org_ops_other';
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Test Persatuan Other', 'Johor', 'Silat', 'Test Master B', '0100000001', 'other@example.test') ON CONFLICT (id) DO NOTHING`, [otherOrg]);
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ('ops_adm_b', 'ops_adm_b@example.test', 'h', 'Test Admin B', 'ADMIN_PERSATUAN', $1, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [otherOrg]);
    const tAdmB = tok('ops_adm_b', UserRole.ADMIN_PERSATUAN, otherOrg);
    const crossView = await request(server, 'GET', `/payments/intents/${d.id}`, { token: tAdmB });
    assert.equal(crossView.status, 403, `another Persatuan's admin must not read this intent (got ${crossView.status})`);
    const ownView = await request(server, 'GET', `/payments/intents/${d.id}`, { token: tAdm });
    assert.equal(ownView.status, 200, 'the owning Persatuan admin can read it');
    console.log("✅ G: an Admin Persatuan cannot read another Persatuan's payment intent.");

    console.log('\n🎉 Ops & payment safety follow-up tests PASSED.');
  } finally {
    if (savedWorkerToken === undefined) delete process.env.BELTFLOW_WORKER_TOKEN; else process.env.BELTFLOW_WORKER_TOKEN = savedWorkerToken;
    if (savedDisabled === undefined) delete process.env.BELTFLOW_DISABLED_MODULES; else process.env.BELTFLOW_DISABLED_MODULES = savedDisabled;
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Ops & payment safety follow-up tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runOpsPaymentSafetyTests };
