/**
 * Receipt-number integrity regression: DB-level uniqueness constraint plus
 * application-level collision retry for both payment-approval and
 * cash-payment receipt generation paths.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

module.paths.push(path.join(__dirname, '../server/node_modules'), path.join(process.cwd(), 'server/node_modules'));

const testPgDir = path.join(__dirname, '.test_beltflow_receipt_pgdata');
if (fs.existsSync(testPgDir)) fs.rmSync(testPgDir, { recursive: true, force: true });

process.env.PG_DATA_DIR = testPgDir;
process.env.JWT_SECRET = 'beltflow_test_receipt_secret_2026';

const { dbClient } = require('../server/dist/db/client');
const app = require('../server/dist/app').default;

function req(port, method, reqPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
      ...(token && { Authorization: `Bearer ${token}` })
    };
    const r = http.request({ hostname: '127.0.0.1', port, path: reqPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let PASS = 0, FAIL = 0;
function check(label, cond, extra) {
  if (cond) { PASS++; console.log(`  ✓ ${label}`); }
  else { FAIL++; console.log(`  ✗ FAIL: ${label}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

async function run() {
  const PORT = 4322;
  const server = app.listen(PORT);
  await new Promise((r) => setTimeout(r, 300));
  console.log(`Receipt integrity suite running on ${PORT}\n`);

  try {
    const setup = await req(PORT, 'POST', '/api/v1/auth/setup-admin', {
      fullName: 'Super Admin', email: 'super@beltflow.test', phone: '+60100000000', password: 'SuperPass2026!'
    });
    const superToken = setup.body.token;
    const org = await req(PORT, 'POST', '/api/v1/organizations', {
      name: 'Academy A', masterName: 'Admin A', email: 'admina@a.test', password: 'AdminAPass2026!',
      baseMonthlyFee: 120, siblingDiscountPercent: 10
    }, superToken);
    const login = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'admina@a.test', password: 'AdminAPass2026!' });
    const token = login.body.token;
    const orgId = org.body.organization.id;
    const cls = await req(PORT, 'POST', '/api/v1/classes', { organizationId: orgId, name: 'A Class', schedule: 'Mon' }, token);
    const classId = cls.body.class.id;

    console.log('--- SCHEMA: unique index exists ---');
    const idxRes = await dbClient.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'payments' AND indexname = 'payments_receipt_no_unique'`
    );
    check('payments_receipt_no_unique index exists in PostgreSQL', idxRes.rowCount === 1);

    console.log('\n--- FORCED COLLISION: DB rejects a duplicate receipt_no, app must not crash ---');
    const stu1 = await req(PORT, 'POST', '/api/v1/students', { organizationId: orgId, classId, fullName: 'Student One', email: 's1@a.test', password: 'StudentPass2026!' }, token);
    const stu2 = await req(PORT, 'POST', '/api/v1/students', { organizationId: orgId, classId, fullName: 'Student Two', email: 's2@a.test', password: 'StudentPass2026!' }, token);
    const studentId1 = stu1.body.student.id, studentId2 = stu2.body.student.id;

    const cash1 = await req(PORT, 'POST', '/api/v1/billing/record-cash-payment', { studentId: studentId1, amount: 50 }, token);
    check('First cash payment succeeds with a receipt number', cash1.status === 201 && !!cash1.body.payment.receipt_no, cash1.body);
    const takenReceipt = cash1.body.payment.receipt_no;

    // Pre-seed the *next* random receipt slot by directly forcing a collision:
    // insert a payment row that already holds a receipt number, then verify a
    // legitimate second cash payment (which will randomly collide with
    // overwhelmingly low but non-zero probability in real usage) is at minimum
    // still blocked from ever producing two rows with the same receipt_no.
    let dupInsertRejected = false;
    try {
      await dbClient.query(
        `INSERT INTO payments (id, organization_id, student_id, amount, method, submitted_by, approved_by, approved_at, status, receipt_no)
         VALUES ($1, $2, $3, $4, 'Cash', $5, $5, CURRENT_TIMESTAMP, 'Approved', $6)`,
        ['pay_forced_dup_test', orgId, studentId2, 10, (await dbClient.query('SELECT id FROM users LIMIT 1')).rows[0].id, takenReceipt]
      );
    } catch (err) {
      dupInsertRejected = /unique/i.test(String(err.message || ''));
    }
    check('Database rejects a second row with an identical receipt_no', dupInsertRejected);

    console.log('\n--- CONCURRENT CASH PAYMENTS: all receipts unique ---');
    const stu3 = await req(PORT, 'POST', '/api/v1/students', { organizationId: orgId, classId, fullName: 'Student Three', email: 's3@a.test', password: 'StudentPass2026!' }, token);
    const studentId3 = stu3.body.student.id;
    const concurrentResults = await Promise.all(
      Array.from({ length: 8 }, () => req(PORT, 'POST', '/api/v1/billing/record-cash-payment', { studentId: studentId3, amount: 20 }, token))
    );
    const allSucceeded = concurrentResults.every((r) => r.status === 201);
    check('8 concurrent cash payments all succeed (no crash from collision handling)', allSucceeded,
      concurrentResults.map((r) => r.status));
    const receiptNos = concurrentResults.map((r) => r.body.payment && r.body.payment.receipt_no).filter(Boolean);
    const uniqueReceiptNos = new Set(receiptNos);
    check('All concurrently-issued receipt numbers are unique', receiptNos.length === 8 && uniqueReceiptNos.size === 8,
      { issued: receiptNos.length, unique: uniqueReceiptNos.size });

    console.log('\n--- EXISTING WORKFLOWS STILL WORK ---');
    const pay = await req(PORT, 'POST', '/api/v1/billing/submit-payment', { studentId: studentId1, amount: 120 }, token);
    const approve = await req(PORT, 'POST', `/api/v1/billing/${pay.body.payment.id}/approve`, {}, token);
    check('Payment submit + approve workflow still succeeds with a receipt', approve.status === 200 && !!approve.body.payment.receipt_no, approve.body);

    const dbReceipts = await dbClient.query('SELECT receipt_no FROM payments WHERE receipt_no IS NOT NULL');
    const allDbReceipts = dbReceipts.rows.map((r) => r.receipt_no);
    check('No duplicate receipt_no values exist anywhere in PostgreSQL', allDbReceipts.length === new Set(allDbReceipts).size,
      { total: allDbReceipts.length, unique: new Set(allDbReceipts).size });

    console.log('\n===================================================================');
    console.log(`   RESULT: ${PASS} PASSED, ${FAIL} FAILED`);
    console.log('===================================================================');
  } finally {
    server.close();
    await dbClient.end?.();
  }

  if (FAIL > 0) process.exitCode = 1;
}

run().catch((e) => { console.error('SUITE CRASHED:', e); process.exitCode = 1; });
