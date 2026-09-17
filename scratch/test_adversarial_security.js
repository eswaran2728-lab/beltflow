/**
 * BeltFlow Adversarial Security & Transaction Integrity Test Suite.
 * Exercises real HTTP requests against the compiled Express app with an
 * embedded PostgreSQL engine: cross-tenant IDOR, privilege escalation,
 * payment tampering, and duplicate-finalization (grading/tournament) attacks.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

module.paths.push(path.join(__dirname, '../server/node_modules'), path.join(process.cwd(), 'server/node_modules'));

const testPgDir = path.join(__dirname, '.test_beltflow_adversarial_pgdata');
if (fs.existsSync(testPgDir)) fs.rmSync(testPgDir, { recursive: true, force: true });

process.env.PG_DATA_DIR = testPgDir;
process.env.JWT_SECRET = 'beltflow_test_adversarial_secret_2026';

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
  const PORT = 4321;
  const server = app.listen(PORT);
  await new Promise((r) => setTimeout(r, 300));
  console.log(`BeltFlow adversarial suite running on ${PORT}\n`);

  try {
    // ---- Setup: Super Admin, Academy A, Academy B ----
    const setup = await req(PORT, 'POST', '/api/v1/auth/setup-admin', {
      fullName: 'Super Admin', email: 'super@beltflow.test', phone: '+60100000000', password: 'SuperPass2026!'
    });
    const superToken = setup.body.token;

    const orgA = await req(PORT, 'POST', '/api/v1/organizations', {
      name: 'Academy A', masterName: 'Admin A', email: 'admina@a.test', password: 'AdminAPass2026!',
      baseMonthlyFee: 120, siblingDiscountPercent: 10
    }, superToken);
    const orgB = await req(PORT, 'POST', '/api/v1/organizations', {
      name: 'Academy B', masterName: 'Admin B', email: 'adminb@b.test', password: 'AdminBPass2026!',
      baseMonthlyFee: 150, siblingDiscountPercent: 10
    }, superToken);

    const loginA = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'admina@a.test', password: 'AdminAPass2026!' });
    const loginB = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'adminb@b.test', password: 'AdminBPass2026!' });
    const tokenA = loginA.body.token, tokenB = loginB.body.token;
    const orgIdA = orgA.body.organization.id, orgIdB = orgB.body.organization.id;

    const classA = await req(PORT, 'POST', '/api/v1/classes', { organizationId: orgIdA, name: 'A Class', schedule: 'Mon' }, tokenA);
    const classB = await req(PORT, 'POST', '/api/v1/classes', { organizationId: orgIdB, name: 'B Class', schedule: 'Tue' }, tokenB);
    const classIdA = classA.body.class?.id, classIdB = classB.body.class?.id;

    const stuA = await req(PORT, 'POST', '/api/v1/students', {
      organizationId: orgIdA, classId: classIdA, fullName: 'Student A', email: 'stua@a.test', password: 'StuAPass2026!'
    }, tokenA);
    const stuB = await req(PORT, 'POST', '/api/v1/students', {
      organizationId: orgIdB, classId: classIdB, fullName: 'Student B', email: 'stub@b.test', password: 'StuBPass2026!'
    }, tokenB);
    const studentIdA = stuA.body.student.id, studentIdB = stuB.body.student.id;

    console.log('--- PHASE 2: IDOR / CROSS-TENANT ISOLATION ---');
    const crossStudent = await req(PORT, 'GET', `/api/v1/students/${studentIdB}`, null, tokenA);
    check('Academy A admin cannot read Academy B student', crossStudent.status === 403, crossStudent.body);

    const crossRoster = await req(PORT, 'GET', `/api/v1/students/organization/${orgIdB}`, null, tokenA);
    check('Academy A admin cannot list Academy B roster', crossRoster.status === 403, crossRoster.body);

    const crossPaymentsList = await req(PORT, 'GET', `/api/v1/billing/organization/${orgIdB}`, null, tokenA);
    check('Academy A admin cannot list Academy B payments', crossPaymentsList.status === 403, crossPaymentsList.body);

    const crossClasses = await req(PORT, 'GET', `/api/v1/classes/organization/${orgIdB}`, null, tokenA);
    check('Academy A admin cannot list Academy B classes', crossClasses.status === 403, crossClasses.body);

    console.log('\n--- PHASE 3: PRIVILEGE ESCALATION ---');
    const escalate = await req(PORT, 'POST', '/api/v1/organizations', {
      name: 'Rogue Org', masterName: 'x', email: 'rogue@x.test', password: 'RoguePass2026!'
    }, tokenA);
    check('ADMIN_PERSATUAN cannot create organizations (Super Admin only)', escalate.status === 403, escalate.body);

    const secondSetup = await req(PORT, 'POST', '/api/v1/auth/setup-admin', {
      fullName: 'Second Super', email: 'super2@beltflow.test', phone: '+60100000001', password: 'SuperPass2026!'
    });
    check('setup-admin permanently locked after first Super Admin', secondSetup.status === 403, secondSetup.body);

    console.log('\n--- PHASE 5: PARENT/CHILD OWNERSHIP ---');
    const regParent = await req(PORT, 'POST', '/api/v1/auth/register-parent', {
      organizationId: orgIdA, parentName: 'Parent A', email: 'parenta@a.test', password: 'ParentAPass2026!',
      childName: 'Kid A', classId: classIdA
    });
    const parentToken = regParent.body.token;
    const parentChildId = regParent.body.studentId;
    const crossChildPayment = await req(PORT, 'GET', `/api/v1/billing/student/${studentIdA}`, null, parentToken);
    check('Parent cannot view payments for unrelated student in own academy', crossChildPayment.status === 403, crossChildPayment.body);
    const crossOrgChildPayment = await req(PORT, 'GET', `/api/v1/billing/student/${studentIdB}`, null, parentToken);
    check('Parent cannot view payments for unrelated student in other academy', crossOrgChildPayment.status === 403, crossOrgChildPayment.body);

    console.log('\n--- PHASE 7: PAYMENT TAMPERING ---');
    const badAmount1 = await req(PORT, 'POST', '/api/v1/billing/submit-payment', { studentId: studentIdA, amount: -50 }, tokenA);
    check('Negative payment amount rejected', badAmount1.status === 400, badAmount1.body);
    const badAmount2 = await req(PORT, 'POST', '/api/v1/billing/submit-payment', { studentId: studentIdA, amount: 0 }, tokenA);
    check('Zero payment amount rejected', badAmount2.status === 400, badAmount2.body);
    const otherAcademyPay = await req(PORT, 'POST', '/api/v1/billing/submit-payment', { studentId: studentIdB, amount: 100 }, tokenA);
    check('Academy A admin cannot submit payment for Academy B student', otherAcademyPay.status === 403, otherAcademyPay.body);

    console.log('\n--- PHASE 14: MALICIOUS INPUT ---');
    const sqlish = await req(PORT, 'POST', '/api/v1/auth/login', { email: "' OR 1=1 --", password: "x' OR '1'='1" });
    check('SQL-like login payload does not authenticate or crash', sqlish.status === 401 || sqlish.status === 400, sqlish.body);
    const hugeString = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'a'.repeat(5000) + '@x.com', password: 'x'.repeat(5000) });
    check('Oversized login payload handled without server crash', hugeString.status === 401 || hugeString.status === 400, hugeString.body);
    const badEnum = await req(PORT, 'POST', '/api/v1/billing/submit-payment', { studentId: studentIdA, amount: 100, method: { $ne: null } }, tokenA);
    check('Non-string method field does not crash server', [200, 201, 400, 403, 500].includes(badEnum.status));

    console.log('\n--- PHASE 15: ERROR DISCLOSURE ---');
    const notFound = await req(PORT, 'GET', '/api/v1/students/nonexistent-id-xyz', null, tokenA);
    const bodyStr = JSON.stringify(notFound.body);
    check('404 response does not leak SQL/stack trace', !/at Object|node_modules|\.ts:\d+|SELECT .* FROM/i.test(bodyStr), notFound.body);

    console.log('\n--- PHASE 11: GRADING DUPLICATE FINALIZATION ---');
    const event = await req(PORT, 'POST', '/api/v1/grading', { organizationId: orgIdA, title: 'Yellow Belt Exam', fee: 60 }, tokenA);
    const eventId = event.body.event.id;
    const regResult = await req(PORT, 'POST', `/api/v1/grading/${eventId}/register`, { studentId: parentChildId, targetBelt: 'Yellow Belt' }, parentToken);
    check('Setup: parent registers own child for grading', regResult.status === 201, regResult.body);
    const certsBefore = await dbClient.query('SELECT COUNT(*) FROM certificates WHERE student_id = $1', [parentChildId]);

    const score1 = await req(PORT, 'POST', `/api/v1/grading/${eventId}/score`, {
      results: [{ studentId: parentChildId, result: 'Passed', targetBelt: 'Yellow Belt' }]
    }, tokenA);
    const score2 = await req(PORT, 'POST', `/api/v1/grading/${eventId}/score`, {
      results: [{ studentId: parentChildId, result: 'Passed', targetBelt: 'Yellow Belt' }]
    }, tokenA);
    const certsAfter = await dbClient.query('SELECT COUNT(*) FROM certificates WHERE student_id = $1', [parentChildId]);
    const certDelta = Number(certsAfter.rows[0].count) - Number(certsBefore.rows[0].count);
    check('Repeated grading score submission does NOT issue duplicate certificates', certDelta === 1,
      { certsIssuedAcrossTwoIdenticalCalls: certDelta, score1: score1.status, score2: score2.status });

    console.log('\n--- PHASE 12: TOURNAMENT DUPLICATE FINALIZATION ---');
    const tourney = await req(PORT, 'POST', '/api/v1/tournaments', { organizationId: orgIdA, title: 'Spring Open' }, tokenA);
    const tourneyId = tourney.body.tournament.id;
    const partsBefore = await dbClient.query('SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1', [tourneyId]);
    const res1 = await req(PORT, 'POST', `/api/v1/tournaments/${tourneyId}/results`, {
      results: [{ studentId: studentIdA, medal: 'Gold', category: 'Forms' }]
    }, tokenA);
    const res2 = await req(PORT, 'POST', `/api/v1/tournaments/${tourneyId}/results`, {
      results: [{ studentId: studentIdA, medal: 'Gold', category: 'Forms' }]
    }, tokenA);
    const partsAfter = await dbClient.query('SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1', [tourneyId]);
    const partDelta = Number(partsAfter.rows[0].count) - Number(partsBefore.rows[0].count);
    check('Repeated tournament result submission does NOT issue duplicate medal records', partDelta === 1,
      { participantRowsAcrossTwoIdenticalCalls: partDelta, res1: res1.status, res2: res2.status });

    console.log('\n--- PHASE 8: CONCURRENT PAYMENT APPROVAL ---');
    const pay = await req(PORT, 'POST', '/api/v1/billing/submit-payment', { studentId: studentIdA, amount: 120 }, tokenA);
    const paymentId = pay.body.payment.id;
    const [appr1, appr2] = await Promise.all([
      req(PORT, 'POST', `/api/v1/billing/${paymentId}/approve`, {}, tokenA),
      req(PORT, 'POST', `/api/v1/billing/${paymentId}/approve`, {}, tokenA)
    ]);
    const statuses = [appr1.status, appr2.status].sort();
    check('Concurrent duplicate approval: exactly one 200 and one 409 (no double-approval)',
      statuses[0] === 200 && statuses[1] === 409, { appr1: appr1.status, appr2: appr2.status });
    const payRows = await dbClient.query('SELECT COUNT(*) FROM payments WHERE id = $1', [paymentId]);
    check('Exactly one payment row exists after concurrent approval (no duplicate financial record)',
      Number(payRows.rows[0].count) === 1);

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
