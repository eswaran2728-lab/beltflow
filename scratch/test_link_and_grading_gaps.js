/**
 * Regression coverage for D13 (parent link-by-IC lookup) and D14 (grading
 * candidate self/parent registration): duplicate requests, cross-tenant
 * lookup safety, and duplicate candidate registration.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');

module.paths.push(path.join(__dirname, '../server/node_modules'), path.join(process.cwd(), 'server/node_modules'));

const testPgDir = path.join(__dirname, '.test_beltflow_link_grading_pgdata');
if (fs.existsSync(testPgDir)) fs.rmSync(testPgDir, { recursive: true, force: true });

process.env.PG_DATA_DIR = testPgDir;
process.env.JWT_SECRET = 'beltflow_test_link_grading_secret_2026';

const { dbClient } = require('../server/dist/db/client');
const app = require('../server/dist/app').default;

function req(port, method, reqPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', ...(payload && { 'Content-Length': Buffer.byteLength(payload) }), ...(token && { Authorization: `Bearer ${token}` }) };
    const r = http.request({ hostname: '127.0.0.1', port, path: reqPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { let json; try { json = JSON.parse(data); } catch (e) { json = data; } resolve({ status: res.statusCode, body: json }); });
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
  const PORT = 4324;
  const server = app.listen(PORT);
  await new Promise((r) => setTimeout(r, 300));
  console.log(`Link/grading gap regression suite running on ${PORT}\n`);

  try {
    const setup = await req(PORT, 'POST', '/api/v1/auth/setup-admin', { fullName: 'Super Admin', email: 'super@beltflow.test', phone: '+60100000000', password: 'SuperPass2026!' });
    const superToken = setup.body.token;

    const orgA = await req(PORT, 'POST', '/api/v1/organizations', { name: 'Academy A', masterName: 'Admin A', email: 'admina@a.test', password: 'AdminAPass2026!', baseMonthlyFee: 120, siblingDiscountPercent: 10 }, superToken);
    const orgB = await req(PORT, 'POST', '/api/v1/organizations', { name: 'Academy B', masterName: 'Admin B', email: 'adminb@b.test', password: 'AdminBPass2026!', baseMonthlyFee: 120, siblingDiscountPercent: 10 }, superToken);
    const loginA = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'admina@a.test', password: 'AdminAPass2026!' });
    const loginB = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'adminb@b.test', password: 'AdminBPass2026!' });
    const tokenA = loginA.body.token, tokenB = loginB.body.token;
    const orgIdA = orgA.body.organization.id, orgIdB = orgB.body.organization.id;

    const clsA = await req(PORT, 'POST', '/api/v1/classes', { organizationId: orgIdA, name: 'A Class', schedule: 'Mon' }, tokenA);
    const clsB = await req(PORT, 'POST', '/api/v1/classes', { organizationId: orgIdB, name: 'B Class', schedule: 'Tue' }, tokenB);

    const stuA = await req(PORT, 'POST', '/api/v1/students', { organizationId: orgIdA, classId: clsA.body.class.id, fullName: 'Student A', icNumber: 'IC-SAME-0001', email: 'stua@a.test', password: 'StuAPass2026!' }, tokenA);
    const stuB = await req(PORT, 'POST', '/api/v1/students', { organizationId: orgIdB, classId: clsB.body.class.id, fullName: 'Student B', icNumber: 'IC-SAME-0001', email: 'stub@b.test', password: 'StuBPass2026!' }, tokenB);
    const studentIdA = stuA.body.student.id;

    // Parent registered under Academy A only
    const regParentA = await req(PORT, 'POST', '/api/v1/auth/register-parent', { organizationId: orgIdA, parentName: 'Parent A', email: 'parenta@a.test', password: 'ParentAPass2026!', childName: 'Kid A', classId: clsA.body.class.id });
    const parentTokenA = regParentA.body.token;

    console.log('--- D13: PARENT LINK BY IC NUMBER ---');
    const linkByIc = await req(PORT, 'POST', '/api/v1/auth/parent-link-requests', { icNumber: 'IC-SAME-0001' }, parentTokenA);
    check('Parent link-by-IC resolves to the SAME-TENANT student (Academy A), not the identically-numbered Academy B student', linkByIc.status === 201 && linkByIc.body.linkRequest.student_id === studentIdA, linkByIc.body);

    const dupLink = await req(PORT, 'POST', '/api/v1/auth/parent-link-requests', { icNumber: 'IC-SAME-0001' }, parentTokenA);
    check('Duplicate parent link-by-IC request is rejected (409)', dupLink.status === 409, dupLink.body);

    const regParentB = await req(PORT, 'POST', '/api/v1/auth/register-parent', { organizationId: orgIdB, parentName: 'Parent B', email: 'parentb@b.test', password: 'ParentBPass2026!', childName: 'Kid B', classId: clsB.body.class.id });
    const parentTokenB = regParentB.body.token;
    const crossTenantLink = await req(PORT, 'POST', '/api/v1/auth/parent-link-requests', { studentId: studentIdA }, parentTokenB);
    check('Cross-tenant parent link attempt (explicit studentId from another org) is rejected (403)', crossTenantLink.status === 403, crossTenantLink.body);

    const notFoundIc = await req(PORT, 'POST', '/api/v1/auth/parent-link-requests', { icNumber: 'NO-SUCH-IC-9999' }, parentTokenB);
    check('Parent link-by-IC with no match in own academy returns 404 (no cross-tenant leak)', notFoundIc.status === 404, notFoundIc.body);

    console.log('\n--- D14: GRADING CANDIDATE REGISTRATION ---');
    const event = await req(PORT, 'POST', '/api/v1/grading', { organizationId: orgIdA, title: 'Gap Test Exam', fee: 60 }, tokenA);
    const eventId = event.body.event.id;

    const studentLoginA = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'stua@a.test', password: 'StuAPass2026!' });
    const studentTokenA = studentLoginA.body.token;

    const register1 = await req(PORT, 'POST', `/api/v1/grading/${eventId}/register`, { studentId: studentIdA, targetBelt: 'Yellow Belt' }, studentTokenA);
    check('Student can self-register as a grading candidate', register1.status === 201, register1.body);

    const register2 = await req(PORT, 'POST', `/api/v1/grading/${eventId}/register`, { studentId: studentIdA, targetBelt: 'Yellow Belt' }, studentTokenA);
    check('Duplicate candidate registration for the same event is rejected (409)', register2.status === 409, register2.body);

    const stuBLoginForCrossTenant = await req(PORT, 'POST', '/api/v1/auth/login', { email: 'stub@b.test', password: 'StuBPass2026!' });
    const crossTenantRegister = await req(PORT, 'POST', `/api/v1/grading/${eventId}/register`, { studentId: stuB.body.student.id, targetBelt: 'Yellow Belt' }, stuBLoginForCrossTenant.body.token);
    check('Cross-tenant candidate registration (Academy B student into Academy A event) is rejected (403)', crossTenantRegister.status === 403, crossTenantRegister.body);

    const listRes = await req(PORT, 'GET', `/api/v1/grading/organization/${orgIdA}`, null, tokenA);
    const listedEvent = listRes.body.gradingEvents.find((g) => g.id === eventId);
    check('Grading list endpoint reports the registered candidate student ID', listedEvent && (listedEvent.candidate_student_ids || []).includes(studentIdA), listedEvent);

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
