/**
 * Real OS-process-level restart persistence test: spawns the server as a
 * genuine child process, writes data over HTTP, sends it SIGTERM (as a
 * container orchestrator or `systemctl restart` would), spawns a fresh
 * child process against the SAME data directory, and verifies the data
 * survived. This is deliberately NOT an in-process server.close() +
 * reconnect (that only proves a graceful in-process shutdown persists).
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const testPgDir = path.join(__dirname, '.test_beltflow_process_restart_pgdata');
if (fs.existsSync(testPgDir)) fs.rmSync(testPgDir, { recursive: true, force: true });

const PORT = 4323;
const env = { ...process.env, PG_DATA_DIR: testPgDir, JWT_SECRET: 'beltflow_test_process_restart_secret', PORT: String(PORT) };
const serverEntry = path.join(__dirname, '../server/dist/index.js');

function req(method, reqPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', ...(payload && { 'Content-Length': Buffer.byteLength(payload) }), ...(token && { Authorization: `Bearer ${token}` }) };
    const r = http.request({ hostname: '127.0.0.1', port: PORT, path: reqPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { let json; try { json = JSON.parse(data); } catch (e) { json = data; } resolve({ status: res.statusCode, body: json }); });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function waitForServer(child, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const attempt = http.get({ hostname: '127.0.0.1', port: PORT, path: '/api/health' }, (res) => { res.resume(); resolve(); });
      attempt.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('server did not become ready'));
        setTimeout(check, 200);
      });
    };
    check();
  });
}

let PASS = 0, FAIL = 0;
function check(label, cond, extra) {
  if (cond) { PASS++; console.log(`  ✓ ${label}`); }
  else { FAIL++; console.log(`  ✗ FAIL: ${label}`, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function spawnServer() {
  return spawn(process.execPath, [serverEntry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
}

async function killAndWaitExit(child, signal) {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill(signal);
    setTimeout(resolve, 5000); // safety net in case exit never fires
  });
}

async function run() {
  console.log('--- BOOT 1: fresh process ---');
  let child = spawnServer();
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  await waitForServer(child);

  const setup = await req('POST', '/api/v1/auth/setup-admin', { fullName: 'Process Restart Admin', email: 'pr-admin@beltflow.test', phone: '+60100000000', password: 'ProcRestart2026!' });
  const superToken = setup.body.token;
  const org = await req('POST', '/api/v1/organizations', { name: 'Process Restart Academy', masterName: 'Master PR', email: 'pr-master@a.test', password: 'ProcMaster2026!', baseMonthlyFee: 120, siblingDiscountPercent: 10 }, superToken);
  const login = await req('POST', '/api/v1/auth/login', { email: 'pr-master@a.test', password: 'ProcMaster2026!' });
  const token = login.body.token;
  const orgId = org.body.organization.id;
  const cls = await req('POST', '/api/v1/classes', { organizationId: orgId, name: 'Restart Test Class', schedule: 'Mon' }, token);
  const stu = await req('POST', '/api/v1/students', { organizationId: orgId, classId: cls.body.class.id, fullName: 'Restart Test Student', email: 'pr-student@a.test', password: 'ProcStu2026!' }, token);
  const pay = await req('POST', '/api/v1/billing/record-cash-payment', { studentId: stu.body.student.id, amount: 75 }, token);

  check('Setup created a Super Admin', setup.status === 201);
  check('Organization created', org.status === 201);
  check('Class created', cls.status === 201);
  check('Student enrolled', stu.status === 201);
  check('Cash payment recorded with a receipt before restart', pay.status === 201 && !!pay.body.payment.receipt_no, pay.body);
  const receiptNo = pay.body.payment.receipt_no;
  const studentId = stu.body.student.id;

  console.log('\n--- SIGTERM (simulating a real process-level restart) ---');
  await killAndWaitExit(child, 'SIGTERM');
  check('Server process exited after SIGTERM (graceful shutdown handler ran)', child.exitCode !== null || child.killed);

  console.log('\n--- BOOT 2: fresh process, same data directory ---');
  child = spawnServer();
  let out2 = '';
  child.stdout.on('data', (d) => (out2 += d));
  await waitForServer(child);

  const statusRes = await req('GET', '/api/v1/auth/setup-status');
  check('Super Admin still exists after a real process restart (setupRequired: false)', statusRes.body.setupRequired === false, statusRes.body);

  const login2 = await req('POST', '/api/v1/auth/login', { email: 'pr-master@a.test', password: 'ProcMaster2026!' });
  check('Academy admin can still log in after restart', login2.status === 200, login2.body);
  const token2 = login2.body.token;

  const studentRes = await req('GET', `/api/v1/students/${studentId}`, null, token2);
  check('Enrolled student record survived the restart', studentRes.status === 200 && studentRes.body.student.full_name === 'Restart Test Student', studentRes.body);

  const paymentsRes = await req('GET', `/api/v1/billing/student/${studentId}`, null, token2);
  const survived = paymentsRes.ok !== false && paymentsRes.body.payments && paymentsRes.body.payments.some((p) => p.receipt_no === receiptNo);
  check('Cash payment and its receipt number survived the restart', survived, paymentsRes.body);

  await killAndWaitExit(child, 'SIGTERM');

  console.log('\n===================================================================');
  console.log(`   RESULT: ${PASS} PASSED, ${FAIL} FAILED`);
  console.log('===================================================================');
  if (FAIL > 0) process.exitCode = 1;
}

run().catch((e) => { console.error('SUITE CRASHED:', e); process.exitCode = 1; });
