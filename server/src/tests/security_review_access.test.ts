/**
 * Security review 2026-11-14: access to child records and private data.
 *
 *  - Family timeline and transfer history: only the student, an ACTIVE
 *    guardian, the same-Persatuan Admin or the student's Master. Never a
 *    Master of another Persatuan, never Super Admin.
 *  - Family summary lists only children whose link is ACTIVE.
 *  - Enrollment applications by staff stay inside their own Persatuan; a
 *    Master cannot pull another Master's student into their class; the
 *    response does not echo identity numbers.
 *  - Master applications cannot change the role of another Persatuan's user.
 *  - Private parent–Master threads: participants and Admin only; a revoked
 *    guardian loses access.
 *  - Certificates are revoked by staff only.
 *  - The public certificate check's rate limit ignores client X-Forwarded-For.
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

type Res = { status: number; data: any };
function request(server: http.Server, method: string, urlPath: string, token?: string, body?: any, extraHeaders: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close', ...extraHeaders };
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
  console.log('🛡️  Starting access security review tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-sec-access-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  try {
    const q = (sql: string, p: any[] = []) => dbClient.query(sql, p);
    for (const org of ['org_sa_a', 'org_sa_b']) {
      await q(`INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
               VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org, `Test ${org}`, `${org}@example.test`]);
    }
    const users: Array<[string, string, string | null]> = [
      ['sa_super', 'SUPER_ADMIN', null], ['sa_adm_a', 'ADMIN_PERSATUAN', 'org_sa_a'], ['sa_adm_b', 'ADMIN_PERSATUAN', 'org_sa_b'],
      ['sa_m1', 'MASTER', 'org_sa_a'], ['sa_m2', 'MASTER', 'org_sa_a'], ['sa_mb', 'MASTER', 'org_sa_b'],
      ['sa_par', 'PARENT', 'org_sa_a'], ['sa_par_pending', 'PARENT', 'org_sa_a'], ['sa_par_b', 'PARENT', 'org_sa_b'],
      ['sa_stu_user', 'STUDENT', 'org_sa_a'], ['sa_stu_other', 'STUDENT', 'org_sa_a'],
    ];
    for (const [id, role, org] of users) {
      await q(`INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, org]);
    }
    await q(`INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status) VALUES
      ('cls_sa_1', 'org_sa_a', 'sa_m1', 'Test Class One', 'Sat', 'Hall', 80, 'ACTIVE'),
      ('cls_sa_2', 'org_sa_a', 'sa_m2', 'Test Class Two', 'Sun', 'Hall', 80, 'ACTIVE'),
      ('cls_sa_b', 'org_sa_b', 'sa_mb', 'Test Class B', 'Sun', 'Hall', 80, 'ACTIVE') ON CONFLICT (id) DO NOTHING`);
    await q(`INSERT INTO coach_class_assignments (coach_id, class_id) VALUES ('sa_m1', 'cls_sa_1'), ('sa_m2', 'cls_sa_2'), ('sa_mb', 'cls_sa_b') ON CONFLICT DO NOTHING`);
    const students: Array<[string, string, string | null, string | null]> = [
      ['stu_sa_s', 'org_sa_a', 'cls_sa_2', 'sa_stu_user'],   // taught by m2
      ['stu_sa_new', 'org_sa_a', null, null],               // not yet in any class
      ['stu_sa_b', 'org_sa_b', 'cls_sa_b', null],
    ];
    for (const [id, org, cls, uid] of students) {
      await q(`INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, phone, belt_rank, monthly_fee, status)
               VALUES ($1, $2, $3, $4, $5, $6, '0110000000', 'White Belt', 80, $7) ON CONFLICT (id) DO NOTHING`,
        [id, org, cls, uid, `Test Child ${id}`, `000000-00-${id.slice(-4)}`, cls ? 'ACTIVE' : 'PENDING']);
    }
    await q(`INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved) VALUES
      ('psl_sa_1', 'sa_par', 'stu_sa_s', 'ACTIVE', true, true, true),
      ('psl_sa_2', 'sa_par_pending', 'stu_sa_s', 'PENDING_STUDENT', false, false, false) ON CONFLICT (parent_id, student_id) DO NOTHING`);

    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const T = {
      sa: tok('sa_super', UserRole.SUPER_ADMIN), admA: tok('sa_adm_a', UserRole.ADMIN_PERSATUAN, 'org_sa_a'), admB: tok('sa_adm_b', UserRole.ADMIN_PERSATUAN, 'org_sa_b'),
      m1: tok('sa_m1', UserRole.MASTER, 'org_sa_a'), m2: tok('sa_m2', UserRole.MASTER, 'org_sa_a'), mb: tok('sa_mb', UserRole.MASTER, 'org_sa_b'),
      par: tok('sa_par', UserRole.PARENT, 'org_sa_a'), parPending: tok('sa_par_pending', UserRole.PARENT, 'org_sa_a'), parB: tok('sa_par_b', UserRole.PARENT, 'org_sa_b'),
      stu: tok('sa_stu_user', UserRole.STUDENT, 'org_sa_a'), stuOther: tok('sa_stu_other', UserRole.STUDENT, 'org_sa_a'),
    };

    // ------------------------------------------------ child records
    for (const url of ['/family/students/stu_sa_s/timeline', '/transfers/students/stu_sa_s/history']) {
      assert.equal((await request(server, 'GET', url, T.mb)).status, 403, `${url}: Master of another Persatuan`);
      assert.equal((await request(server, 'GET', url, T.sa)).status, 403, `${url}: Super Admin never sees child records`);
      assert.equal((await request(server, 'GET', url, T.m1)).status, 403, `${url}: a Master who does not teach the student`);
      assert.equal((await request(server, 'GET', url, T.m2)).status, 200, `${url}: the student's own Master`);
      assert.equal((await request(server, 'GET', url, T.admA)).status, 200, `${url}: same-Persatuan Admin`);
      assert.equal((await request(server, 'GET', url, T.par)).status, 200, `${url}: active guardian`);
    }
    console.log('✅ Timeline and transfer history: no cross-Persatuan Master, no Super Admin.');

    const pendingSummary = await request(server, 'GET', '/family-summary', T.parPending);
    assert.ok(!JSON.stringify(pendingSummary.data).includes('stu_sa_s'), 'a pending link does not reveal the child');
    assert.ok(!JSON.stringify(pendingSummary.data).includes('000000-00-sa_s'));
    const activeSummary = await request(server, 'GET', '/family-summary', T.par);
    assert.equal(activeSummary.status, 200);
    assert.ok(JSON.stringify(activeSummary.data).includes('stu_sa_s'), 'an active guardian still sees their child');
    console.log('✅ Family summary lists only ACTIVE links.');

    // ------------------------------------------------ enrollment applications
    const pull = await request(server, 'POST', '/enrollment-applications', T.m1, { classId: 'cls_sa_1', studentId: 'stu_sa_s' });
    assert.equal(pull.status, 403, `a Master cannot pull another Master's student: ${JSON.stringify(pull.data)}`);
    const cross = await request(server, 'POST', '/enrollment-applications', T.admB, { classId: 'cls_sa_1', studentId: 'stu_sa_new' });
    assert.equal(cross.status, 403, 'an Admin of another Persatuan cannot file applications here');
    assert.ok(!JSON.stringify(cross.data).includes('000000-00'), 'and learns nothing about the child');
    const walkIn = await request(server, 'POST', '/enrollment-applications', T.m1, { classId: 'cls_sa_1', studentId: 'stu_sa_new' });
    assert.equal(walkIn.status, 201, `a Master can still enrol an unassigned student: ${JSON.stringify(walkIn.data)}`);
    assert.equal(walkIn.data.application.ic_number, undefined, 'identity number not echoed');
    assert.equal(walkIn.data.application.phone, undefined);
    console.log('✅ Enrollment applications stay in-tenant and cannot take another Master\'s student.');

    // ------------------------------------------------ master applications
    const foreign = await request(server, 'POST', '/master-applications', T.parB, { organizationId: 'org_sa_a', qualifications: 'q', experienceSummary: 'e' });
    assert.equal(foreign.status, 403, 'another Persatuan\'s account cannot be turned into a Master here');
    const byAdmin = await request(server, 'POST', '/master-applications', T.admB, { organizationId: 'org_sa_a', qualifications: 'q', experienceSummary: 'e' });
    assert.equal(byAdmin.status, 403);
    console.log('✅ Master applications cannot change another Persatuan\'s user.');

    // ------------------------------------------------ private threads
    await q(`INSERT INTO message_threads (id, organization_id, class_id, student_id, parent_id, assigned_master_id, subject)
             VALUES ('thr_sa_1', 'org_sa_a', 'cls_sa_2', 'stu_sa_s', 'sa_par', 'sa_m2', 'Test')`);
    await q(`INSERT INTO thread_messages (id, thread_id, sender_id, sender_role, content) VALUES ('tm_sa_1', 'thr_sa_1', 'sa_par', 'PARENT', 'Test private note')`);
    assert.equal((await request(server, 'GET', '/messaging/threads/thr_sa_1/messages', T.stuOther)).status, 403, 'a student cannot read a private thread');
    assert.equal((await request(server, 'GET', '/messaging/threads/thr_sa_1/messages', T.par)).status, 200, 'the guardian can');
    await q(`UPDATE parent_student_links SET status = 'REVOKED' WHERE id = 'psl_sa_1'`);
    assert.equal((await request(server, 'GET', '/messaging/threads/thr_sa_1/messages', T.par)).status, 403, 'a revoked guardian cannot read');
    const revokedSend = await request(server, 'POST', '/messaging/threads/thr_sa_1/messages', T.par, { content: 'hi' });
    assert.equal(revokedSend.status, 403, 'or send');
    console.log('✅ Private threads: participants and Admin only; revoked guardians lose access.');

    // ------------------------------------------------ certificates
    await q(`INSERT INTO certificates (id, code, organization_id, organization_name, student_id, student_name, master_name, rank_or_title, issue_date)
             VALUES ('cert_sa_1', 'BF-TE-1234', 'org_sa_a', 'Test', 'stu_sa_s', 'Test Child', 'Test', 'Yellow Belt', '2026-11-01')`);
    assert.equal((await request(server, 'POST', '/certificates/cert_sa_1/revoke', T.stu, { reason: 'x' })).status, 403, 'a student cannot revoke');
    assert.equal((await request(server, 'POST', '/certificates/cert_sa_1/revoke', T.par, { reason: 'x' })).status, 403, 'a parent cannot revoke');
    assert.equal((await q(`SELECT status FROM certificates WHERE id = 'cert_sa_1'`)).rows[0].status, 'ACTIVE');
    assert.equal((await request(server, 'POST', '/certificates/cert_sa_1/revoke', T.admA, { reason: 'Test revocation' })).status, 200, 'the Admin can');
    console.log('✅ Certificates are revoked by staff only.');

    // ------------------------------------------------ rate limit ignores spoofed X-Forwarded-For
    let limited = false;
    for (let i = 0; i < 20 && !limited; i++) {
      const r = await request(server, 'POST', '/certificates/public-verify', undefined, { codeOrToken: `BF-ZZ-${1000 + i}` }, { 'X-Forwarded-For': `203.0.113.${i}` });
      limited = r.status === 429;
    }
    assert.ok(limited, 'changing X-Forwarded-For does not reset the rate limit');
    console.log('✅ Public certificate check rate limit cannot be bypassed with X-Forwarded-For.');

    console.log('\n🎉 Access security review tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Access security review tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runAccessSecurityReviewTests };
