/**
 * Super Admin: suspend and reactivate a Persatuan (2026-11-22).
 *
 *  - PUT /organizations/:orgId/status { status, reason } is Super Admin only;
 *    the Persatuan's own Admin and every other role get 403.
 *  - Unknown organization: 404. Any status other than ACTIVE / SUSPENDED, or
 *    suspending without a reason: 400.
 *  - Each change writes an audit entry naming who, which organization and the
 *    new status, with no personal data.
 *  - A suspended Persatuan's users are refused on every request; reactivating
 *    lets them back in. Other Persatuans are not affected.
 *  - The Super Admin listing carries per-Persatuan counts (classes, active
 *    students, Masters) as plain numbers, never names or records.
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
  console.log('🛡️  Starting Super Admin Persatuan status tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-sa-status-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  try {
    const q = (sql: string, p: any[] = []) => dbClient.query(sql, p);
    for (const org of ['org_ps_a', 'org_ps_b']) {
      await q(`INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
               VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org, `Test ${org}`, `${org}@example.test`]);
    }
    const users: Array<[string, string, string | null, string]> = [
      ['ps_super', 'SUPER_ADMIN', null, 'ACTIVE'],
      ['ps_adm_a', 'ADMIN_PERSATUAN', 'org_ps_a', 'ACTIVE'], ['ps_adm_b', 'ADMIN_PERSATUAN', 'org_ps_b', 'ACTIVE'],
      ['ps_m1', 'MASTER', 'org_ps_a', 'ACTIVE'], ['ps_m2', 'MASTER', 'org_ps_a', 'ACTIVE'], ['ps_m_off', 'MASTER', 'org_ps_a', 'INACTIVE'],
      ['ps_par', 'PARENT', 'org_ps_a', 'ACTIVE'], ['ps_stu', 'STUDENT', 'org_ps_a', 'ACTIVE'],
    ];
    for (const [id, role, org, status] of users) {
      await q(`INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, org, status]);
    }
    await q(`INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status) VALUES
      ('cls_ps_1', 'org_ps_a', 'ps_m1', 'Test Class One', 'Sat', 'Hall', 80, 'ACTIVE'),
      ('cls_ps_2', 'org_ps_a', 'ps_m2', 'Test Class Two', 'Sun', 'Hall', 80, 'ACTIVE'),
      ('cls_ps_old', 'org_ps_a', 'ps_m2', 'Test Class Old', 'Sun', 'Hall', 80, 'INACTIVE') ON CONFLICT (id) DO NOTHING`);
    const students: Array<[string, string, string | null, string]> = [
      ['stu_ps_1', 'org_ps_a', 'cls_ps_1', 'ACTIVE'], ['stu_ps_2', 'org_ps_a', 'cls_ps_1', 'ACTIVE'],
      ['stu_ps_3', 'org_ps_a', 'cls_ps_2', 'ACTIVE'], ['stu_ps_pending', 'org_ps_a', null, 'PENDING'],
    ];
    for (const [id, org, cls, status] of students) {
      await q(`INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, belt_rank, monthly_fee, status)
               VALUES ($1, $2, $3, $4, $5, '0110000000', 'White Belt', 80, $6) ON CONFLICT (id) DO NOTHING`,
        [id, org, cls, `Test Child ${id}`, `000000-00-${id.slice(-4)}`, status]);
    }

    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const T = {
      sa: tok('ps_super', UserRole.SUPER_ADMIN),
      admA: tok('ps_adm_a', UserRole.ADMIN_PERSATUAN, 'org_ps_a'), admB: tok('ps_adm_b', UserRole.ADMIN_PERSATUAN, 'org_ps_b'),
      m1: tok('ps_m1', UserRole.MASTER, 'org_ps_a'), par: tok('ps_par', UserRole.PARENT, 'org_ps_a'), stu: tok('ps_stu', UserRole.STUDENT, 'org_ps_a'),
    };

    // ------------------------------------------------ listing carries aggregate counts only
    const list = await request(server, 'GET', '/organizations', T.sa);
    assert.equal(list.status, 200);
    const a = list.data.organizations.find((o: any) => o.id === 'org_ps_a');
    const b = list.data.organizations.find((o: any) => o.id === 'org_ps_b');
    assert.ok(a && b, 'both Persatuans are listed');
    assert.equal(a.classCount, 2, 'active classes are counted');
    assert.equal(a.activeStudentCount, 3, 'only ACTIVE students are counted');
    assert.equal(a.masterCount, 2, 'only ACTIVE Masters are counted');
    assert.deepEqual([b.classCount, b.activeStudentCount, b.masterCount], [0, 0, 0]);
    for (const k of ['classCount', 'activeStudentCount', 'masterCount']) assert.equal(typeof a[k], 'number', `${k} is a number`);
    assert.ok(!JSON.stringify(list.data).includes('Test Child'), 'no child names in the listing');
    assert.equal((await request(server, 'GET', '/organizations', T.admA)).status, 403, 'Persatuan Admin cannot list all Persatuans');
    console.log('✅ Super Admin listing has per-Persatuan counts, numbers only.');

    // ------------------------------------------------ only Super Admin may change status
    for (const t of [T.admA, T.admB, T.m1, T.par, T.stu]) {
      const r = await request(server, 'PUT', '/organizations/org_ps_a/status', t, { status: 'SUSPENDED', reason: 'Test reason' });
      assert.equal(r.status, 403, 'non Super Admin cannot change a Persatuan status');
    }
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', undefined, { status: 'SUSPENDED', reason: 'x' })).status, 401);
    assert.equal((await q(`SELECT status FROM organizations WHERE id = 'org_ps_a'`)).rows[0].status, 'ACTIVE');
    console.log('✅ Only Super Admin can suspend (403 for the Persatuan Admin and every other role).');

    // ------------------------------------------------ validation
    assert.equal((await request(server, 'PUT', '/organizations/org_missing/status', T.sa, { status: 'SUSPENDED', reason: 'Test reason' })).status, 404);
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'DELETED', reason: 'Test reason' })).status, 400);
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'PENDING', reason: 'Test reason' })).status, 400);
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, {})).status, 400);
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'SUSPENDED' })).status, 400, 'reason is required');
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'SUSPENDED', reason: '   ' })).status, 400, 'blank reason is refused');
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'SUSPENDED', reason: 42 })).status, 400);
    assert.equal((await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'SUSPENDED', reason: 'x'.repeat(501) })).status, 400, 'reason length is bounded');
    assert.equal((await q(`SELECT status FROM organizations WHERE id = 'org_ps_a'`)).rows[0].status, 'ACTIVE');
    console.log('✅ 404 for unknown Persatuan; 400 for other statuses and a missing reason.');

    // ------------------------------------------------ suspend
    assert.equal((await request(server, 'GET', '/organizations/org_ps_a', T.admA)).status, 200, 'Admin works before suspension');
    const before = Number((await q(`SELECT COUNT(*)::int AS n FROM audit_logs`)).rows[0].n);
    const sus = await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'SUSPENDED', reason: 'Unpaid platform subscription' });
    assert.equal(sus.status, 200);
    assert.equal(sus.data.organization.id, 'org_ps_a');
    assert.equal(sus.data.organization.status, 'SUSPENDED');
    assert.equal((await q(`SELECT status FROM organizations WHERE id = 'org_ps_a'`)).rows[0].status, 'SUSPENDED');

    const logs = (await q(`SELECT * FROM audit_logs ORDER BY timestamp DESC`)).rows;
    assert.equal(logs.length, before + 1, 'one audit entry');
    const entry = logs.find((l: any) => l.action === 'Organization Status Changed');
    assert.ok(entry, 'audit entry written');
    assert.equal(entry.user_role, 'SUPER_ADMIN');
    assert.equal(entry.user_email, 'ps_super@example.test');
    assert.ok(entry.details.includes('org_ps_a'), 'names the organization');
    assert.ok(entry.details.includes('SUSPENDED'), 'names the new status');
    const platformAudit = await request(server, 'GET', '/audit', T.sa);
    assert.equal(platformAudit.status, 200);
    assert.ok(platformAudit.data.logs.some((l: any) => l.action === 'Organization Status Changed'), 'the change shows on the platform audit list');
    assert.ok(!/Test Child|ps_par|ps_stu|000000-00/.test(entry.details), 'no personal data in the audit entry');
    console.log('✅ Suspension is saved and audited (who, which organization, new status).');

    // ------------------------------------------------ the Persatuan's users are refused
    for (const t of [T.admA, T.m1, T.par, T.stu]) {
      const r = await request(server, 'GET', '/organizations/org_ps_a', t);
      assert.equal(r.status, 403, 'suspended Persatuan users are refused');
    }
    assert.equal((await request(server, 'GET', '/notifications', T.m1)).status, 403, 'refused on every route');
    assert.equal((await request(server, 'GET', '/organizations/org_ps_b', T.admB)).status, 200, 'other Persatuans are not affected');
    assert.equal((await request(server, 'GET', '/organizations', T.sa)).status, 200, 'Super Admin still works');
    const listed = (await request(server, 'GET', '/organizations', T.sa)).data.organizations.find((o: any) => o.id === 'org_ps_a');
    assert.equal(listed.status, 'SUSPENDED');
    console.log('✅ A suspended Persatuan is refused on every request; others carry on.');

    // ------------------------------------------------ reactivate (reason optional)
    const re = await request(server, 'PUT', '/organizations/org_ps_a/status', T.sa, { status: 'ACTIVE' });
    assert.equal(re.status, 200);
    assert.equal(re.data.organization.status, 'ACTIVE');
    assert.equal((await request(server, 'GET', '/organizations/org_ps_a', T.admA)).status, 200, 'Admin is let back in');
    const reEntry = (await q(`SELECT * FROM audit_logs WHERE action = 'Organization Status Changed' ORDER BY timestamp DESC`)).rows;
    assert.equal(reEntry.length, 2);
    assert.ok(reEntry.some((l: any) => l.details.includes('ACTIVE') && l.details.includes('org_ps_a')));
    console.log('✅ Reactivation restores access and is audited.');

    console.log('\n🎉 Super Admin Persatuan status tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Super Admin Persatuan status tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runSuperAdminPersatuanStatusTests };
