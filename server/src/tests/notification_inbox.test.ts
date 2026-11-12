/**
 * In-app notification inbox (H27 known gap #1: outbox never delivered).
 *
 * deliverNotificationOutbox() turns notification_outbox rows into per-user
 * user_notifications rows:
 *  - recipients come from the business action (applicant, linked parents,
 *    class leader, Persatuan admins of the same org, payer, ...);
 *  - Super Admin never receives an event, and users of another Persatuan
 *    never receive one (tenant isolation, child privacy);
 *  - only whitelisted, display-safe params are copied: never free-text
 *    reasons, certificate verification tokens or message text;
 *  - delivery is idempotent and marks the outbox row PROCESSED.
 * The API returns only the caller's own notifications.
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
import { deliverNotificationOutbox } from '../services/notifications/deliver';

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
  console.log('🔔 Starting in-app notification inbox tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-inbox-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  try {
    const A = 'org_ntf_a';
    const B = 'org_ntf_b';
    for (const [org, name] of [[A, 'Test Persatuan A'], [B, 'Test Persatuan B']]) {
      await dbClient.query(
        `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
         VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3) ON CONFLICT (id) DO NOTHING`, [org, name, `${org}@example.test`]);
    }
    const users: Array<[string, string, string | null]> = [
      ['ntf_sa', 'SUPER_ADMIN', null],
      ['ntf_adm_a', 'ADMIN_PERSATUAN', A], ['ntf_adm_a2', 'ADMIN_PERSATUAN', A], ['ntf_adm_b', 'ADMIN_PERSATUAN', B],
      ['ntf_mst_a', 'MASTER', A], ['ntf_mst_in', 'MASTER', A], ['ntf_mst_b', 'MASTER', B],
      ['ntf_par_a', 'PARENT', A], ['ntf_par_other', 'PARENT', A], ['ntf_stu_a', 'STUDENT', A],
    ];
    for (const [id, role, org] of users) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [id, `${id}@example.test`, `Test ${id}`, role, org]);
    }
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
       VALUES ('cls_ntf_a', $1, 'ntf_mst_a', 'Test Class A', 'Sat 10am', 'Test Hall', 80, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [A]);
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active)
       VALUES ('cl_ntf_a', 'cls_ntf_a', 'ntf_mst_a', $1, 'PRIMARY', true) ON CONFLICT (id) DO NOTHING`, [A]);
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ('stu_ntf_a', $1, 'ntf_stu_a', 'cls_ntf_a', 'Test Child A', '000000-00-0001', 'White Belt', 'Active') ON CONFLICT (id) DO NOTHING`, [A]);
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_ntf_a', 'ntf_par_a', 'stu_ntf_a', 'ACTIVE', true, true, true) ON CONFLICT (parent_id, student_id) DO NOTHING`);

    // Rows the resolver looks up.
    await dbClient.query(
      `INSERT INTO class_applications (id, organization_id, proposing_master_id, name, schedule, location, monthly_fee, status)
       VALUES ('capp_ntf', $1, 'ntf_mst_a', 'Test Proposed Class', 'Sun 9am', 'Test Hall', 70, 'REJECTED') ON CONFLICT (id) DO NOTHING`, [A]);
    await dbClient.query(
      `INSERT INTO membership_pauses (id, organization_id, student_id, class_id, requested_by_user_id, reason, start_date, status)
       VALUES ('pause_ntf', $1, 'stu_ntf_a', 'cls_ntf_a', 'ntf_par_a', 'private health reason', '2026-12-01', 'REQUESTED') ON CONFLICT (id) DO NOTHING`, [A]);
    await dbClient.query(
      `INSERT INTO class_transfer_requests (id, student_id, organization_id, old_class_id, new_class_id, status, requested_by_user_id, effective_date)
       VALUES ('ctr_ntf', 'stu_ntf_a', $1, 'cls_ntf_a', 'cls_ntf_a', 'APPROVED', 'ntf_par_a', '2026-12-15') ON CONFLICT (id) DO NOTHING`, [A]);
    await dbClient.query(
      `INSERT INTO enrollment_applications (id, student_id, class_id, organization_id, guardian_id, status, applicant_type, submitted_by_user_id)
       VALUES ('eapp_ntf', 'stu_ntf_a', 'cls_ntf_a', $1, 'ntf_par_a', 'REJECTED', 'PARENT', 'ntf_par_a') ON CONFLICT (id) DO NOTHING`, [A]);

    await dbClient.query(
      `INSERT INTO message_threads (id, organization_id, class_id, student_id, parent_id, assigned_master_id)
       VALUES ('thr_ntf', $1, 'cls_ntf_a', 'stu_ntf_a', 'ntf_par_a', 'ntf_mst_a') ON CONFLICT (id) DO NOTHING`, [A]);

    const outbox = async (id: string, org: string, eventType: string, aggregateType: string, aggregateId: string, payload: object) =>
      dbClient.query(
        `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') ON CONFLICT (id) DO NOTHING`, [id, org, eventType, aggregateType, aggregateId, JSON.stringify(payload)]);

    await outbox('ob_class_submitted', A, 'ClassSubmitted', 'class_application', 'capp_ntf', { applicationId: 'capp_ntf', masterId: 'ntf_mst_a', className: 'Test Proposed Class' });
    await outbox('ob_class_rejected', A, 'ClassRejected', 'class_application', 'capp_ntf', { applicationId: 'capp_ntf', reason: 'SECRET-REVIEW-TEXT' });
    await outbox('ob_belt', A, 'BeltPromotionAwarded', 'student', 'stu_ntf_a', { type: 'BELT_PROMOTION', studentName: 'Test Child A', newBelt: 'Yellow Belt', certificateCode: 'CERT-NTF-1', verificationToken: 'SECRET-TOKEN-123' });
    await outbox('ob_msg', A, 'ParentMasterMessageReceived', 'message_thread', 'thr_ntf', { recipientId: 'ntf_par_a', threadId: 'thr_ntf', messageId: 'msg_ntf', senderRole: 'MASTER', title: 'New Message', body: 'New message from Master', lockScreenSafe: true });
    await outbox('ob_pause_req', A, 'MembershipPauseRequested', 'membership_pause', 'pause_ntf', { pauseId: 'pause_ntf', studentId: 'stu_ntf_a', studentName: 'Test Child A', startDate: '2026-12-01', reason: 'private health reason' });
    await outbox('ob_transfer_ok', A, 'ClassTransferApproved', 'class_transfer_request', 'ctr_ntf', { transferId: 'ctr_ntf', studentId: 'stu_ntf_a', effectiveDate: '2026-12-15', approvedBy: 'ntf_mst_a' });
    await outbox('ob_enrol_rej', A, 'StudentEnrollmentRejected', 'enrollment_application', 'eapp_ntf', { applicationId: 'eapp_ntf', studentId: 'stu_ntf_a', classId: 'cls_ntf_a', rejectionReason: 'SECRET-REJECTION-TEXT' });
    await dbClient.query(
      `INSERT INTO class_handover_requests (id, class_id, organization_id, outgoing_master_id, incoming_master_id, initiated_by)
       VALUES ('hnd_ntf', 'cls_ntf_a', $1, 'ntf_mst_a', 'ntf_mst_in', 'ntf_mst_a') ON CONFLICT (id) DO NOTHING`, [A]);
    await outbox('ob_handover', A, 'ClassHandoverRequested', 'class_handover', 'hnd_ntf', { classId: 'cls_ntf_a', className: 'Test Class A', outgoingMasterId: 'ntf_mst_a', incomingMasterId: 'ntf_mst_in', initiatedBy: 'ntf_mst_a' });
    await outbox('ob_unknown', A, 'SomethingNew', 'thing', 'x1', { foo: 'bar' });
    // A recipient id in the payload is only trusted if the DB confirms it:
    // someone outside the thread (here a Master of another Persatuan) is dropped.
    await outbox('ob_msg_cross', A, 'ParentMasterMessageReceived', 'message_thread', 'thr_ntf', { recipientId: 'ntf_mst_b', threadId: 'thr_ntf', title: 'New Message' });
    // Super Admin is never a recipient, even if named.
    await outbox('ob_msg_sa', A, 'ParentMasterMessageReceived', 'message_thread', 'thr_ntf', { recipientId: 'ntf_sa', threadId: 'thr_ntf', title: 'New Message' });

    const first = await deliverNotificationOutbox();
    assert.ok(first.processed >= 11, `processed outbox rows (${JSON.stringify(first)})`);
    const again = await deliverNotificationOutbox();
    assert.equal(again.processed, 0, 'nothing left to process on a second run');

    const recipientsOf = async (outboxId: string) =>
      (await dbClient.query(`SELECT user_id FROM user_notifications WHERE outbox_id = $1 ORDER BY user_id`, [outboxId])).rows.map((r: any) => r.user_id);
    const paramsOf = async (outboxId: string) =>
      (await dbClient.query(`SELECT params FROM user_notifications WHERE outbox_id = $1 LIMIT 1`, [outboxId])).rows[0]?.params;

    assert.deepEqual(await recipientsOf('ob_class_submitted'), ['ntf_adm_a', 'ntf_adm_a2'], 'class proposal goes to that Persatuan\'s admins only');
    assert.deepEqual(await recipientsOf('ob_class_rejected'), ['ntf_mst_a'], 'rejection goes to the proposing Master');
    assert.deepEqual(await recipientsOf('ob_belt'), ['ntf_par_a', 'ntf_stu_a'], 'belt promotion goes to the student and linked parents');
    assert.deepEqual(await recipientsOf('ob_msg'), ['ntf_par_a']);
    assert.deepEqual(await recipientsOf('ob_pause_req'), ['ntf_mst_a'], 'pause request goes to the class leader');
    assert.deepEqual(await recipientsOf('ob_transfer_ok'), ['ntf_par_a', 'ntf_stu_a'], 'transfer approval goes to requester and family');
    assert.deepEqual(await recipientsOf('ob_enrol_rej'), ['ntf_par_a', 'ntf_stu_a'], 'enrollment decision goes to the applicant and family');
    assert.deepEqual(await recipientsOf('ob_handover'), ['ntf_mst_in'], 'handover request goes to the incoming Master');
    assert.deepEqual(await recipientsOf('ob_unknown'), [], 'unknown events are processed without recipients');
    assert.deepEqual(await recipientsOf('ob_msg_cross'), [], 'a recipient in another Persatuan is dropped');
    assert.deepEqual(await recipientsOf('ob_msg_sa'), [], 'Super Admin never receives notifications');
    console.log('✅ Recipients follow the business action; other Persatuans and Super Admin never receive.');

    const allParams = JSON.stringify((await dbClient.query(`SELECT params FROM user_notifications`)).rows);
    for (const secret of ['SECRET-REVIEW-TEXT', 'SECRET-TOKEN-123', 'SECRET-REJECTION-TEXT', 'private health reason', 'CERT-NTF-1']) {
      assert.ok(!allParams.includes(secret), `"${secret}" must not be copied into notifications`);
    }
    assert.equal((await paramsOf('ob_belt')).newBelt, 'Yellow Belt', 'safe display fields are kept');
    console.log('✅ Free text, certificate tokens and private reasons are never copied.');

    const statuses = (await dbClient.query(`SELECT id, status, processed_at FROM notification_outbox WHERE id LIKE 'ob_%'`)).rows;
    assert.ok(statuses.every((r: any) => r.status === 'PROCESSED' && r.processed_at), 'every outbox row is PROCESSED');
    const dup = await dbClient.query(`SELECT outbox_id, user_id, COUNT(*)::int AS n FROM user_notifications GROUP BY outbox_id, user_id HAVING COUNT(*) > 1`);
    assert.equal(dup.rows.length, 0, 'no duplicate notifications');
    console.log('✅ Delivery is idempotent and marks the outbox processed.');

    // ------------------------------------------------------------ API
    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const tPar = tok('ntf_par_a', UserRole.PARENT, A);
    const tOther = tok('ntf_par_other', UserRole.PARENT, A);
    const tSA = tok('ntf_sa', UserRole.SUPER_ADMIN);

    const mine = await request(server, 'GET', '/notifications', tPar);
    assert.equal(mine.status, 200);
    assert.equal(mine.data.unreadCount, 4, `parent has 4 unread (${JSON.stringify(mine.data)})`);
    assert.ok(mine.data.notifications.every((n: any) => n.userId === undefined), 'user ids are not echoed');
    assert.deepEqual(
      mine.data.notifications.map((n: any) => n.eventType).sort(),
      ['BeltPromotionAwarded', 'ClassTransferApproved', 'ParentMasterMessageReceived', 'StudentEnrollmentRejected']);
    const other = await request(server, 'GET', '/notifications', tOther);
    assert.equal(other.data.unreadCount, 0, 'an unlinked parent sees nothing');
    assert.equal(other.data.notifications.length, 0);
    const sa = await request(server, 'GET', '/notifications', tSA);
    assert.equal(sa.data.notifications.length, 0, 'Super Admin inbox is empty');
    const anon = await request(server, 'GET', '/notifications');
    assert.equal(anon.status, 401);

    const oneId = mine.data.notifications[0].id;
    const stolen = await request(server, 'POST', `/notifications/${oneId}/read`, tOther, {});
    assert.equal(stolen.status, 404, 'nobody can mark another person\'s notification');
    const read = await request(server, 'POST', `/notifications/${oneId}/read`, tPar, {});
    assert.equal(read.status, 200);
    assert.equal((await request(server, 'GET', '/notifications', tPar)).data.unreadCount, 3);
    const all = await request(server, 'POST', '/notifications/read-all', tPar, {});
    assert.equal(all.status, 200);
    assert.equal((await request(server, 'GET', '/notifications', tPar)).data.unreadCount, 0);
    console.log('✅ API returns only the caller\'s notifications; read and read-all work and are owner-only.');

    console.log('\n🎉 In-app notification inbox tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Notification inbox tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runNotificationInboxTests };
