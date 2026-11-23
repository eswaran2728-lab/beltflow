/**
 * Server gaps found while finishing the mobile screens, 2026-11-22.
 *
 *  A. A parent can list the link requests they sent themselves (every state),
 *     and never another parent's.
 *  B. A parent's or student's notice feed says which notices they have
 *     already acknowledged, and for which of their own children.
 *  C. Academy reports honour the chosen period for totals that happen over
 *     time (money collected), and keep "today" figures unchanged.
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
import { periodStart } from '../routes/analytics.routes';

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
      res.on('end', () => { let data: any = raw; try { data = JSON.parse(raw); } catch { /* text */ } resolve({ status: res.statusCode || 0, data }); });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧩 Starting app completion gap tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-gaps-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const q = (sql: string, p: any[] = []) => dbClient.query(sql, p);

  try {
    await q(`INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
             VALUES ('org_gp', 'Test Org', 'Selangor', 'Silat', 'Test', '0100000000', 'org_gp@example.test', 'ACTIVE')`);
    const hash = hashPasswordServer('Test-Password-0001');
    for (const [id, role] of [['gp_adm', 'ADMIN_PERSATUAN'], ['gp_mst', 'MASTER'], ['gp_par', 'PARENT'], ['gp_par2', 'PARENT']] as Array<[string, string]>) {
      await q(`INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, $3, $4, $5, 'org_gp', 'ACTIVE')`,
        [id, `${id}@example.test`, hash, `Test ${id}`, role]);
    }
    await q(`INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
             VALUES ('cls_gp', 'org_gp', 'gp_mst', 'Test Class', 'Sat', 'Hall', 80, 'ACTIVE')`);
    for (const id of ['stu_gp_1', 'stu_gp_2', 'stu_gp_3']) {
      await q(`INSERT INTO students (id, organization_id, class_id, full_name, ic_number) VALUES ($1, 'org_gp', 'cls_gp', $2, $3)`,
        [id, `Test ${id}`, `000000-00-${id.slice(-1)}000`]);
    }
    // gp_par: one approved child and one pending request; gp_par2: one pending request.
    await q(`INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
             VALUES ('psl_1', 'gp_par', 'stu_gp_1', 'ACTIVE', TRUE, TRUE, TRUE),
                    ('psl_2', 'gp_par', 'stu_gp_2', 'PENDING_MASTER', TRUE, FALSE, FALSE),
                    ('psl_3', 'gp_par2', 'stu_gp_3', 'PENDING_STUDENT', FALSE, FALSE, FALSE)`);

    const tok = (id: string, role: UserRole) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: 'org_gp' } as any);
    const tPar = tok('gp_par', UserRole.PARENT);
    const tAdm = tok('gp_adm', UserRole.ADMIN_PERSATUAN);

    // ------------------------------------------------------------------ A
    const mine = await request(server, 'GET', '/auth/parent-link-requests', tPar);
    assert.equal(mine.status, 200, JSON.stringify(mine.data));
    const ids = mine.data.linkRequests.map((r: any) => r.id).sort();
    assert.deepEqual(ids, ['psl_1', 'psl_2'], 'a parent sees only their own requests, in every state');
    assert.ok(mine.data.linkRequests.every((r: any) => r.student_name && r.ic_number === undefined), 'only the child name is added, never the IC number');
    console.log('✅ A: a parent can list their own link requests, and only theirs.');

    // ------------------------------------------------------------------ B
    await q(`INSERT INTO notices (id, organization_id, class_id, type, message, sender_id, sender_name)
             VALUES ('ntc_1', 'org_gp', 'cls_gp', 'GENERAL', 'Test notice one', 'gp_mst', 'Test Master'),
                    ('ntc_2', 'org_gp', 'cls_gp', 'CANCELLED', 'Test notice two', 'gp_mst', 'Test Master')`);
    const ack = await request(server, 'POST', '/notices/ntc_1/acknowledge', tPar, { studentId: 'stu_gp_1' });
    assert.ok([200, 201].includes(ack.status), JSON.stringify(ack.data));
    const feed = await request(server, 'GET', '/notices/mine', tPar);
    assert.equal(feed.status, 200, JSON.stringify(feed.data));
    const byId = Object.fromEntries(feed.data.notices.map((n: any) => [n.id, n]));
    assert.equal(byId.ntc_1.acknowledged_by_me, true);
    assert.deepEqual(byId.ntc_1.acknowledged_student_ids, ['stu_gp_1']);
    assert.equal(byId.ntc_2.acknowledged_by_me, false);
    assert.deepEqual(byId.ntc_2.acknowledged_student_ids, []);
    assert.equal(byId.ntc_1.sender_name, 'Test gp_mst', 'the sender is shown by name');
    // A notice stored with the Master's e-mail (older behaviour) still shows the name.
    await q(`INSERT INTO notices (id, organization_id, class_id, type, message, sender_id, sender_name)
             VALUES ('ntc_3', 'org_gp', 'cls_gp', 'GENERAL', 'Test notice three', 'gp_mst', 'gp_mst@example.test')`);
    const feed2 = await request(server, 'GET', '/notices/mine', tPar);
    const n3 = feed2.data.notices.find((n: any) => n.id === 'ntc_3');
    assert.equal(n3.sender_name, 'Test gp_mst', 'an e-mail is never shown as the sender');
    const tMst = tok('gp_mst', UserRole.MASTER);
    await q(`INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master) VALUES ('gp_mst', 'cls_gp', TRUE) ON CONFLICT DO NOTHING`);
    const sent = await request(server, 'POST', '/notices', tMst, { classId: 'cls_gp', type: 'GENERAL', message: 'Test notice four' });
    assert.equal(sent.status, 201, JSON.stringify(sent.data));
    assert.equal(sent.data.notice.sender_name, 'Test gp_mst', 'new notices store the name, not the e-mail');
    console.log('✅ B: the notice feed says what has already been acknowledged, and who sent it by name.');

    // ------------------------------------------------------------------ C
    const now = new Date('2026-11-22T03:00:00.000Z'); // 11:00 in Malaysia
    assert.equal(periodStart('current_month', now)!.toISOString(), '2026-10-31T16:00:00.000Z', 'the month starts at midnight Malaysia time');
    assert.equal(periodStart('year_to_date', now)!.toISOString(), '2025-12-31T16:00:00.000Z');
    assert.equal(periodStart('all_time', now), null);
    assert.equal(periodStart('last_30_days', now)!.getTime(), now.getTime() - 30 * 86400_000);

    await q(`INSERT INTO payments (id, organization_id, student_id, amount, submitted_by, status, approved_at, created_at)
             VALUES ('pay_new', 'org_gp', 'stu_gp_1', 100, 'gp_par', 'Approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                    ('pay_old', 'org_gp', 'stu_gp_1', 50, 'gp_par', 'Approved', CURRENT_TIMESTAMP - INTERVAL '200 days', CURRENT_TIMESTAMP - INTERVAL '200 days')`);
    const metrics = async (period: string) => {
      const r = await request(server, 'GET', `/analytics/metrics?period=${period}`, tAdm);
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data.metrics || r.data;
    };
    const all = await metrics('all_time');
    const recent = await metrics('last_30_days');
    assert.equal(all.ledgerTotals.totalCollected, 150, 'all time counts every approved payment');
    assert.equal(recent.ledgerTotals.totalCollected, 100, 'the last 30 days leave out an older payment');
    assert.equal(recent.metadata.period, 'last_30_days');
    assert.ok(recent.metadata.periodStart, 'the response says where the period starts');
    assert.equal(recent.enrollment.activeEnrolledStudents, all.enrollment.activeEnrolledStudents, '"today" figures do not change with the period');
    const odd = await metrics('not_a_period');
    assert.equal(odd.metadata.period, 'current_month', 'an unknown period falls back to the current month');
    console.log('✅ C: reports honour the chosen period.');

    // ------------------------------------------------------------------ D
    await q(`INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status) VALUES ('ce_gp_1', 'stu_gp_1', 'cls_gp', 'org_gp', 'ACTIVE'), ('ce_gp_2', 'stu_gp_2', 'cls_gp', 'org_gp', 'ACTIVE')`);
    await q(`UPDATE students SET status = 'INACTIVE' WHERE id = 'stu_gp_2'`);
    const classes = await request(server, 'GET', '/classes/organization/org_gp', tAdm);
    assert.equal(classes.status, 200, JSON.stringify(classes.data));
    assert.equal(classes.data.classes[0].active_student_count, 1, 'each class says how many active students it has');
    console.log('✅ D: the class list counts active students.');

    console.log('🎉 App completion gap tests PASSED.');
  } finally {
    server.close();
    await dbClient.close?.();
  }
}

runTests().catch(err => {
  console.error('❌ App completion gap tests FAILED:', err);
  process.exit(1);
});
