/**
 * Privacy compliance (Malaysia PDPA), 2026-11-15.
 *
 *  A. Sign-up needs explicit agreement: the privacy notice and terms for
 *     everyone, a guardian's consent when a child is registered, and an
 *     age-or-guardian confirmation for a student. Each agreement is recorded
 *     with the document version.
 *  B. A person can download the data held about their own account.
 *  C. A person can ask for deletion (or correction / withdrawal of consent).
 *     The request goes to their own Persatuan's Admin (a Persatuan Admin's
 *     own request goes to the Super Admin), with a 21-day due date.
 *  D. Carrying out a deletion removes the personal details and ends access,
 *     but keeps the financial ledger.
 *  E. The legal pages are served.
 * Synthetic data only.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken, hashPasswordServer } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { LEGAL_DOCUMENTS_VERSION } from '../config/legal';

type Res = { status: number; data: any; text: string };
function request(server: http.Server, method: string, urlPath: string, token?: string, body?: any): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const full = urlPath.startsWith('/legal') ? urlPath : `/api/v1${urlPath}`;
    const req = http.request({ host: '127.0.0.1', port: addr.port, path: full, method, headers }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { let data: any = raw; try { data = JSON.parse(raw); } catch { /* text */ } resolve({ status: res.statusCode || 0, data, text: raw }); });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🔏 Starting privacy compliance tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-privacy-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const q = (sql: string, p: any[] = []) => dbClient.query(sql, p);
  const PASSWORD = 'Test-Password-0001';

  try {
    for (const org of ['org_pc_a', 'org_pc_b']) {
      await q(`INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
               VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org, `Test ${org}`, `${org}@example.test`]);
    }
    const hash = hashPasswordServer(PASSWORD);
    for (const [id, role, org] of [['pc_super', 'SUPER_ADMIN', null], ['pc_adm_a', 'ADMIN_PERSATUAN', 'org_pc_a'], ['pc_adm_b', 'ADMIN_PERSATUAN', 'org_pc_b'], ['pc_mst_a', 'MASTER', 'org_pc_a']] as Array<[string, string, string | null]>) {
      await q(`INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')`,
        [id, `${id}@example.test`, hash, `Test ${id}`, role, org]);
    }
    await q(`INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
             VALUES ('cls_pc_a', 'org_pc_a', 'pc_mst_a', 'Test Class', 'Sat', 'Hall', 80, 'ACTIVE')`);
    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const tSuper = tok('pc_super', UserRole.SUPER_ADMIN);
    const tAdmA = tok('pc_adm_a', UserRole.ADMIN_PERSATUAN, 'org_pc_a');
    const tAdmB = tok('pc_adm_b', UserRole.ADMIN_PERSATUAN, 'org_pc_b');

    // ------------------------------------------------------------------ A
    const studentForm = { organizationId: 'org_pc_a', classId: 'cls_pc_a', fullName: 'Test Student One', email: 'pc_student@example.test', phone: '0110000001', password: PASSWORD };
    const noConsent = await request(server, 'POST', '/auth/register-student', undefined, studentForm);
    assert.equal(noConsent.status, 400, JSON.stringify(noConsent.data));
    assert.equal(noConsent.data.code, 'CONSENT_REQUIRED');
    assert.equal((await request(server, 'POST', '/auth/register-student', undefined, { ...studentForm, acceptedPrivacyNotice: true, acceptedTerms: true })).data.code, 'CONSENT_REQUIRED',
      'a student must also confirm they are 18 or have a guardian\'s agreement');
    assert.equal((await request(server, 'POST', '/auth/register-student', undefined, { ...studentForm, acceptedPrivacyNotice: 'yes', acceptedTerms: 1, ageOrGuardianConfirmed: 'true' })).data.code, 'CONSENT_REQUIRED',
      'only a real true counts (no pre-filled or truthy values)');
    assert.equal((await q(`SELECT COUNT(*)::int AS n FROM users WHERE email = 'pc_student@example.test'`)).rows[0].n, 0, 'nothing is stored without consent');
    const student = await request(server, 'POST', '/auth/register-student', undefined, { ...studentForm, acceptedPrivacyNotice: true, acceptedTerms: true, ageOrGuardianConfirmed: true });
    assert.equal(student.status, 201, JSON.stringify(student.data));
    const studentUserId = student.data.user.id as string;
    const studentId = student.data.user.studentId as string;
    const sConsents = await q(`SELECT consent_type, document_version FROM user_consents WHERE user_id = $1 ORDER BY consent_type`, [studentUserId]);
    assert.deepEqual(sConsents.rows.map((r: any) => r.consent_type), ['AGE_OR_GUARDIAN', 'PRIVACY_NOTICE', 'TERMS']);
    assert.ok(sConsents.rows.every((r: any) => r.document_version === LEGAL_DOCUMENTS_VERSION), 'the document version agreed to is recorded');

    const parentForm = { organizationId: 'org_pc_a', parentName: 'Test Parent One', email: 'pc_parent@example.test', phone: '0110000002', password: PASSWORD, childName: 'Test Child One', classId: 'cls_pc_a',
      acceptedPrivacyNotice: true, acceptedTerms: true };
    const noGuardian = await request(server, 'POST', '/auth/register-parent', undefined, parentForm);
    assert.equal(noGuardian.data.code, 'CONSENT_REQUIRED', 'registering a child needs the guardian\'s consent');
    const parent = await request(server, 'POST', '/auth/register-parent', undefined, { ...parentForm, guardianConsent: true });
    assert.equal(parent.status, 201, JSON.stringify(parent.data));
    const parentId = parent.data.parentId as string;
    const childId = parent.data.studentId as string;
    const tParent = parent.data.token as string;
    const pConsents = await q(`SELECT consent_type FROM user_consents WHERE user_id = $1 ORDER BY consent_type`, [parentId]);
    assert.deepEqual(pConsents.rows.map((r: any) => r.consent_type), ['GUARDIAN', 'PRIVACY_NOTICE', 'TERMS']);
    console.log('✅ A: sign-up needs explicit agreement, and each agreement is recorded with its version.');

    // ------------------------------------------------------------------ B
    const mine = await request(server, 'GET', '/privacy/my-data', tParent);
    assert.equal(mine.status, 200, JSON.stringify(mine.data));
    assert.equal(mine.data.account.email, 'pc_parent@example.test');
    assert.equal(mine.data.consents.length, 3);
    assert.ok(mine.data.children.some((c: any) => c.id === childId), 'a guardian\'s export includes their own child');
    assert.ok(!/password|scrypt\$/.test(mine.text), 'no password hash in the export');
    assert.ok(!mine.text.includes('pc_student@example.test') && !mine.text.includes('pc_adm_a'), 'nobody else\'s data is in the export');
    assert.equal((await request(server, 'GET', '/privacy/my-data')).status, 401);
    console.log('✅ B: a person can download their own data, and only their own.');

    // ------------------------------------------------------------------ C
    assert.equal((await request(server, 'POST', '/privacy/requests', tParent, { type: 'EVERYTHING' })).status, 400);
    const otherChild = await request(server, 'POST', '/privacy/requests', tParent, { type: 'DELETE', studentId });
    assert.equal(otherChild.status, 403, 'a guardian cannot ask to delete someone else\'s child');
    const del = await request(server, 'POST', '/privacy/requests', tParent, { type: 'DELETE', studentId: childId, details: 'Please remove our records.' });
    assert.equal(del.status, 201, JSON.stringify(del.data));
    const days = (new Date(del.data.request.dueAt).getTime() - Date.now()) / 86400000;
    assert.ok(days > 20 && days <= 21.01, `due within 21 days (got ${days.toFixed(2)})`);
    assert.equal((await request(server, 'POST', '/privacy/requests', tParent, { type: 'DELETE', studentId: childId })).status, 409, 'one open request of a kind at a time');
    assert.equal((await request(server, 'GET', '/privacy/requests/mine', tParent)).data.requests.length, 1);

    const forAdminA = await request(server, 'GET', '/privacy/requests', tAdmA);
    assert.equal(forAdminA.status, 200);
    assert.equal(forAdminA.data.requests.length, 1);
    assert.equal((await request(server, 'GET', '/privacy/requests', tAdmB)).data.requests.length, 0, 'another Persatuan\'s Admin sees nothing');
    assert.equal((await request(server, 'GET', '/privacy/requests', tSuper)).data.requests.length, 0, 'Super Admin does not see family requests');
    assert.equal((await request(server, 'GET', '/privacy/requests', tParent)).status, 403);
    const requestId = del.data.request.id as string;
    assert.equal((await request(server, 'POST', `/privacy/requests/${requestId}/resolve`, tAdmB, { action: 'COMPLETE' })).status, 404, 'another Persatuan\'s Admin cannot act on it');

    const adminOwn = await request(server, 'POST', '/privacy/requests', tAdmA, { type: 'CORRECT', details: 'Fix my name.' });
    assert.equal(adminOwn.status, 201);
    const forSuper = await request(server, 'GET', '/privacy/requests', tSuper);
    assert.equal(forSuper.data.requests.length, 1, 'a Persatuan Admin\'s own request goes to the Super Admin');
    assert.equal(forSuper.data.requests[0].studentId ?? null, null);
    assert.equal((await request(server, 'GET', '/privacy/requests', tAdmA)).data.requests.length, 1, 'and not to the Admin themselves');
    console.log('✅ C: requests reach the right person, with a 21-day due date.');

    // ------------------------------------------------------------------ D
    // Money already recorded for the child must survive the deletion.
    await q(`INSERT INTO payments (id, organization_id, student_id, amount, method, submitted_by, status) VALUES ('pay_pc_1', 'org_pc_a', $1, 80, 'Cash', $2, 'Approved')`, [childId, parentId]);
    await q(`INSERT INTO device_push_tokens (id, user_id, token, platform) VALUES ('dev_pc_1', $1, 'ExponentPushToken[test-pc]', 'android')`, [parentId]).catch(() => undefined);

    const done = await request(server, 'POST', `/privacy/requests/${requestId}/resolve`, tAdmA, { action: 'COMPLETE', note: 'Removed as requested.' });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    const user = (await q(`SELECT full_name, email, phone, status FROM users WHERE id = $1`, [parentId])).rows[0];
    assert.equal(user.status, 'DELETED');
    assert.ok(!user.full_name.includes('Test Parent') && !user.email.includes('pc_parent') && user.phone === null, 'the account holds no personal details');
    const child = (await q(`SELECT full_name, ic_number, phone, email, status FROM students WHERE id = $1`, [childId])).rows[0];
    assert.ok(!child.full_name.includes('Test Child') && child.phone === null && child.email === null && child.status === 'DELETED', 'the child record holds no personal details');
    assert.equal((await request(server, 'POST', '/auth/login', undefined, { email: 'pc_parent@example.test', password: PASSWORD })).status, 401, 'the account can no longer sign in');
    assert.notEqual((await request(server, 'GET', '/privacy/my-data', tParent)).status, 200, 'its old session no longer works');
    assert.equal((await q(`SELECT COUNT(*)::int AS n FROM parent_student_links WHERE parent_id = $1 AND status = 'ACTIVE'`, [parentId])).rows[0].n, 0);
    assert.equal((await q(`SELECT COUNT(*)::int AS n FROM device_push_tokens WHERE user_id = $1`, [parentId])).rows[0].n, 0);
    const ledger = (await q(`SELECT amount, status FROM payments WHERE id = 'pay_pc_1'`)).rows[0];
    assert.equal(Number(ledger.amount), 80, 'the financial ledger is kept');
    assert.equal((await q(`SELECT status FROM data_requests WHERE id = $1`, [requestId])).rows[0].status, 'COMPLETED');
    assert.equal((await request(server, 'POST', `/privacy/requests/${requestId}/resolve`, tAdmA, { action: 'COMPLETE' })).status, 409, 'a request is resolved once');
    const audit = await q(`SELECT details FROM audit_logs WHERE action = 'Data Request Resolved'`);
    assert.ok(audit.rows.length >= 1 && !JSON.stringify(audit.rows).includes('Test Parent One'), 'the action is audited without the deleted name');
    console.log('✅ D: deletion removes personal details and access, and keeps the ledger.');

    // ------------------------------------------------------------------ E
    for (const page of ['privacy', 'terms', 'cookies', 'refunds']) {
      const r = await request(server, 'GET', `/legal/${page}.html`);
      assert.equal(r.status, 200, `/legal/${page}.html is served`);
      assert.ok(/lang="ms"/.test(r.text), `${page}: a Bahasa Malaysia version is included`);
      assert.ok(r.text.includes(LEGAL_DOCUMENTS_VERSION), `${page}: shows the same version that sign-up records`);
    }
    assert.equal((await request(server, 'GET', '/legal/../server/package.json')).status, 404);
    assert.equal((await request(server, 'GET', '/legal/secret.txt')).status, 404);
    console.log('✅ E: legal pages are served in English and Bahasa Malaysia, with the recorded version.');

    console.log('\n🎉 Privacy compliance tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Privacy compliance tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runPrivacyComplianceTests };
