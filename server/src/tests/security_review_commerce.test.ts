/**
 * Security review 2026-11-14: merchandise order payment and order ownership.
 *
 *  - Only the Persatuan's own staff (Admin Persatuan / Master) record that an
 *    order was paid; a buyer cannot mark their own order PAID.
 *  - The client cannot choose the ledger row: a supplied paymentId is ignored,
 *    a new row is always inserted, and existing payments (tuition or other
 *    Persatuans') are never changed.
 *  - The client cannot force the "expired reservation" refund path.
 *  - Only a RESERVED order can be fulfilled, and stock never goes negative.
 *  - An order may only name a student the buyer is allowed to act for.
 *  - Super Admin's order list contains no child names.
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
import { getPaymentGatewayAdapter } from '../services/payment/gatewayRegistry';

type Res = { status: number; data: any };
function request(server: http.Server, method: string, urlPath: string, token?: string, body?: any): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close' };
    if (token) headers.Authorization = `Bearer ${token}`;
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
  console.log('🛡️  Starting commerce security review tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-sec-commerce-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  try {
    for (const org of ['org_sc_a', 'org_sc_b']) {
      await dbClient.query(
        `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
         VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3) ON CONFLICT (id) DO NOTHING`, [org, `Test ${org}`, `${org}@example.test`]);
    }
    const users: Array<[string, string, string | null]> = [
      ['sc_sa', 'SUPER_ADMIN', null], ['sc_adm_a', 'ADMIN_PERSATUAN', 'org_sc_a'], ['sc_mst_a', 'MASTER', 'org_sc_a'],
      ['sc_par_a', 'PARENT', 'org_sc_a'], ['sc_stu_a', 'STUDENT', 'org_sc_a'], ['sc_par_b', 'PARENT', 'org_sc_b'],
    ];
    for (const [id, role, org] of users) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, org]);
    }
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
       VALUES ('cls_sc_a', 'org_sc_a', 'sc_mst_a', 'Test Class A', 'Sat', 'Hall', 80, 'ACTIVE'), ('cls_sc_b', 'org_sc_b', NULL, 'Test Class B', 'Sat', 'Hall', 80, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`);
    for (const [id, org, cls, name] of [['stu_sc_a1', 'org_sc_a', 'cls_sc_a', 'Test Child A1'], ['stu_sc_a2', 'org_sc_a', 'cls_sc_a', 'Test Child A2'], ['stu_sc_b1', 'org_sc_b', 'cls_sc_b', 'Test Child B1']]) {
      await dbClient.query(
        `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
         VALUES ($1, $2, $3, $4, $5, 'White Belt', 80, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [id, org, cls, name, `000000-00-${id.slice(-4)}`]);
    }
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_sc_a', 'sc_par_a', 'stu_sc_a1', 'ACTIVE', true, true, true), ('psl_sc_b', 'sc_par_b', 'stu_sc_b1', 'ACTIVE', true, true, true)
       ON CONFLICT (parent_id, student_id) DO NOTHING`);
    // Tuition payments that must never be touched by a merchandise order.
    await dbClient.query(
      `INSERT INTO payments (id, organization_id, student_id, amount, method, submitted_by, status)
       VALUES ('pay_sc_pending_b', 'org_sc_b', 'stu_sc_b1', 80, 'Bank', 'sc_par_b', 'Pending Review'),
              ('pay_sc_approved_a', 'org_sc_a', 'stu_sc_a1', 80, 'Bank', 'sc_par_a', 'Approved')`);
    await dbClient.query(
      `INSERT INTO products (id, organization_id, name, category, price, stock_quantity, reserved_quantity, is_active)
       VALUES ('prd_sc_a', 'org_sc_a', 'Test Belt', 'UNIFORM', 30, 3, 0, TRUE)`);

    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const tSA = tok('sc_sa', UserRole.SUPER_ADMIN);
    const tAdm = tok('sc_adm_a', UserRole.ADMIN_PERSATUAN, 'org_sc_a');
    const tMst = tok('sc_mst_a', UserRole.MASTER, 'org_sc_a');
    const tPar = tok('sc_par_a', UserRole.PARENT, 'org_sc_a');
    const tStu = tok('sc_stu_a', UserRole.STUDENT, 'org_sc_a');
    const stock = async () => Number((await dbClient.query(`SELECT stock_quantity FROM products WHERE id = 'prd_sc_a'`)).rows[0].stock_quantity);
    const payStatus = async (id: string) => (await dbClient.query('SELECT status, receipt_no FROM payments WHERE id = $1', [id])).rows[0];
    const newOrder = async (t: string, qty: number, extra: object = {}) => {
      const r = await request(server, 'POST', '/commerce/orders', t, { items: [{ productId: 'prd_sc_a', quantity: qty }], ...extra });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      return r.data.order.id as string;
    };

    // ------------------------------------------------ buyers cannot self-confirm
    const o1 = await newOrder(tStu, 1);
    assert.equal((await request(server, 'POST', `/commerce/orders/${o1}/reserve`, tStu, {})).status, 200);
    for (const t of [tStu, tPar, tSA]) {
      const r = await request(server, 'POST', `/commerce/orders/${o1}/confirm-payment`, t, {});
      assert.equal(r.status, 403, `buyer / Super Admin cannot mark an order paid: ${JSON.stringify(r.data)}`);
    }
    assert.equal(await stock(), 3);
    console.log('✅ A buyer (or Super Admin) cannot mark an order PAID.');

    // ------------------------------------------------ unreserved orders cannot be fulfilled
    const o2 = await newOrder(tPar, 5);
    const unreserved = await request(server, 'POST', `/commerce/orders/${o2}/confirm-payment`, tAdm, {});
    assert.equal(unreserved.status, 409, JSON.stringify(unreserved.data));
    assert.equal(unreserved.data.errorCode, 'ORDER_NOT_RESERVED');
    assert.equal(await stock(), 3, 'stock unchanged; never negative');
    console.log('✅ Only a RESERVED order can be fulfilled.');

    // ------------------------------------------------ client cannot choose the ledger row
    const before = await payStatus('pay_sc_pending_b');
    const staffPaid = await request(server, 'POST', `/commerce/orders/${o1}/confirm-payment`, tAdm, { paymentId: 'pay_sc_pending_b' });
    assert.equal(staffPaid.status, 200, JSON.stringify(staffPaid.data));
    assert.deepEqual(await payStatus('pay_sc_pending_b'), before, 'another Persatuan\'s tuition payment is untouched');
    const ledger = await dbClient.query(`SELECT id, organization_id, order_id, status FROM payments WHERE receipt_no = $1`, [staffPaid.data.receiptNo]);
    assert.equal(ledger.rows.length, 1);
    assert.notEqual(ledger.rows[0].id, 'pay_sc_pending_b');
    assert.equal(ledger.rows[0].organization_id, 'org_sc_a');
    assert.equal(ledger.rows[0].order_id, o1);
    assert.equal(await stock(), 2);
    console.log('✅ A supplied paymentId is ignored; a new ledger row is written.');

    // ------------------------------------------------ client cannot force the refund path
    const o3 = await newOrder(tPar, 1);
    assert.equal((await request(server, 'POST', `/commerce/orders/${o3}/reserve`, tPar, {})).status, 200);
    const forced = await request(server, 'POST', `/commerce/orders/${o3}/confirm-payment`, tMst, { paymentId: 'pay_sc_approved_a', forceExpired: true });
    assert.equal(forced.status, 200, `forceExpired is ignored: ${JSON.stringify(forced.data)}`);
    assert.equal((await payStatus('pay_sc_approved_a')).status, 'Approved', 'an approved payment is never rewritten as Refunded');
    console.log('✅ forceExpired from the client is ignored; approved payments stay approved.');

    // ------------------------------------------------ a genuinely expired reservation with no stock
    const o4 = await newOrder(tPar, 1);
    assert.equal((await request(server, 'POST', `/commerce/orders/${o4}/reserve`, tPar, {})).status, 200);
    await dbClient.query(`UPDATE inventory_orders SET reservation_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = $1`, [o4]);
    await dbClient.query(`UPDATE products SET stock_quantity = 0, reserved_quantity = 0 WHERE id = 'prd_sc_a'`);
    const late = await request(server, 'POST', `/commerce/orders/${o4}/confirm-payment`, tAdm, {});
    assert.equal(late.status, 422, JSON.stringify(late.data));
    assert.equal(await stock(), 0);
    const reversal = await dbClient.query(`SELECT status, order_id FROM payments WHERE receipt_no = $1`, [late.data.receiptNo]);
    assert.deepEqual({ ...reversal.rows[0] }, { status: 'Refunded', order_id: o4 });
    console.log('✅ A real late payment still reverses without negative stock.');

    // ------------------------------------------------ order student must be one the buyer acts for
    await dbClient.query(`UPDATE products SET stock_quantity = 10 WHERE id = 'prd_sc_a'`);
    const crossChild = await request(server, 'POST', '/commerce/orders', tPar, { studentId: 'stu_sc_b1', items: [{ productId: 'prd_sc_a', quantity: 1 }] });
    assert.equal(crossChild.status, 403, 'another Persatuan\'s child');
    const notMine = await request(server, 'POST', '/commerce/orders', tPar, { studentId: 'stu_sc_a2', items: [{ productId: 'prd_sc_a', quantity: 1 }] });
    assert.equal(notMine.status, 403, 'a child the parent is not linked to');
    const mine = await newOrder(tPar, 1, { studentId: 'stu_sc_a1' });
    assert.ok(mine);
    console.log('✅ An order can only name a student the buyer may act for.');

    // ------------------------------------------------ Super Admin list has no child data
    const saList = await request(server, 'GET', '/commerce/orders', tSA);
    assert.equal(saList.status, 200);
    assert.ok(saList.data.orders.length >= 1);
    for (const o of saList.data.orders) {
      assert.ok(!o.student_name && !o.student_id, 'Super Admin never sees child names or ids');
    }
    console.log('✅ Super Admin order list contains no child data.');

    // ------------------------------------------------ gateway fails closed in production
    const savedEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      assert.throws(() => getPaymentGatewayAdapter('UNCONFIGURED_LIVE'), /not configured/, 'an unknown provider never falls back to the sandbox in production');
      assert.ok(getPaymentGatewayAdapter('SANDBOX'));
    } finally {
      if (savedEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedEnv;
    }
    assert.ok(getPaymentGatewayAdapter('UNCONFIGURED_LIVE'), 'development keeps the sandbox fallback');
    console.log('✅ Unknown payment providers fail closed in production.');

    console.log('\n🎉 Commerce security review tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Commerce security review tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runCommerceSecurityReviewTests };
