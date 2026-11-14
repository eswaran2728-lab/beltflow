import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: resData });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🥋 Starting Task H22: Parent-Master Messaging Acceptance Tests...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const orgIdA = 'org_msg_alpha';
    const orgIdB = 'org_msg_beta';
    const timestamp = Date.now();

    // 1. Seed Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Persatuan Silat Gayong Messaging', 'Selangor', 'Silat Seni Gayong', 'Master Halim', '+60123456793', $3, 'ACTIVE'),
              ($2, 'Persatuan Taekwondo Messaging', 'Perak', 'WT Taekwondo', 'Master Tan', '+60123456794', $4, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
      [orgIdA, orgIdB, `silat-msg-${timestamp}@test.com`, `taekwondo-msg-${timestamp}@test.com`]
    );

    // 2. Seed Users
    const superAdminId = `usr_sa_${timestamp}`;
    const adminAId = `usr_adm_a_${timestamp}`;
    const masterInitialId = `usr_mst_init_${timestamp}`;
    const masterNewIncomingId = `usr_mst_incom_${timestamp}`;
    const masterOrgBId = `usr_mst_orgb_${timestamp}`;
    const parentValidId = `usr_par_valid_${timestamp}`;
    const parentUnlinkedId = `usr_par_unlinked_${timestamp}`;
    const studentUserId = `usr_stu_${timestamp}`;

    const usersToInsert = [
      { id: superAdminId, email: `sa_${timestamp}@test.com`, role: UserRole.SUPER_ADMIN, org: null },
      { id: adminAId, email: `admin_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, org: orgIdA },
      { id: masterInitialId, email: `mst_init_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdA },
      { id: masterNewIncomingId, email: `mst_incom_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdA },
      { id: masterOrgBId, email: `mst_b_${timestamp}@test.com`, role: UserRole.MASTER, org: orgIdB },
      { id: parentValidId, email: `par_ok_${timestamp}@test.com`, role: UserRole.PARENT, org: orgIdA },
      { id: parentUnlinkedId, email: `par_unlinked_${timestamp}@test.com`, role: UserRole.PARENT, org: orgIdA },
      { id: studentUserId, email: `student_${timestamp}@test.com`, role: UserRole.STUDENT, org: orgIdA },
    ];

    for (const u of usersToInsert) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'hash', $2, $3, $4, 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
        [u.id, u.email, u.role, u.org]
      );
    }

    // Generate Auth Tokens
    const tokenSuperAdmin = generateAuthToken({ id: superAdminId, email: `sa_${timestamp}@test.com`, role: UserRole.SUPER_ADMIN, organizationId: undefined });
    const tokenAdminA = generateAuthToken({ id: adminAId, email: `admin_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgIdA });
    const tokenMasterInit = generateAuthToken({ id: masterInitialId, email: `mst_init_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdA });
    const tokenMasterIncoming = generateAuthToken({ id: masterNewIncomingId, email: `mst_incom_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdA });
    const tokenMasterOrgB = generateAuthToken({ id: masterOrgBId, email: `mst_b_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgIdB });
    const tokenParentValid = generateAuthToken({ id: parentValidId, email: `par_ok_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: orgIdA });
    const tokenParentUnlinked = generateAuthToken({ id: parentUnlinkedId, email: `par_unlinked_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: orgIdA });
    const tokenStudent = generateAuthToken({ id: studentUserId, email: `student_${timestamp}@test.com`, role: UserRole.STUDENT, organizationId: orgIdA });

    // 3. Seed Class and Enrolled Student
    const classIdA = `cls_msg_a_${timestamp}`;
    const classIdOther = `cls_msg_other_${timestamp}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, status)
       VALUES ($1, $2, $3, 'Gayong Junior Saturday', 'Sat 09:00', 'Dewan Silat', 'ACTIVE'),
              ($4, $2, $3, 'Gayong Advanced Sunday', 'Sun 10:00', 'Dewan Silat', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [classIdA, orgIdA, masterInitialId, classIdOther]
    );

    // Initial Master active leadership on classIdA
    await dbClient.query(
      `INSERT INTO class_leaderships (id, organization_id, class_id, master_id, leadership_type, is_active, effective_from)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING;`,
      [`lead_init_${timestamp}`, orgIdA, classIdA, masterInitialId]
    );

    const studentEnrolledId = `stu_enrolled_${timestamp}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, class_id, full_name, ic_number, status)
       VALUES ($1, $2, $3, $4, 'Danial bin Ahmad', '101010-10-5678', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [studentEnrolledId, orgIdA, studentUserId, classIdA]
    );

    // Link parentValidId to studentEnrolledId
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE)
       ON CONFLICT (parent_id, student_id) DO UPDATE SET status = 'ACTIVE';`,
      [`psl_msg_${timestamp}`, parentValidId, studentEnrolledId]
    );

    console.log('✅ Base test fixtures successfully seeded.');

    // =========================================================================
    // CRITERION 1: cross_class_thread_denied
    // =========================================================================
    console.log('\n--- Test 1: cross_class_thread_denied ---');

    // 1a. Attempt thread creation for student in a class they are NOT enrolled in (classIdOther)
    const resWrongClass = await makeRequest(
      server,
      'POST',
      '/messaging/threads',
      { childId: studentEnrolledId, classId: classIdOther },
      tokenParentValid
    );
    assert.equal(resWrongClass.status, 403, 'Must deny thread creation for student not enrolled in target class');
    assert.match(resWrongClass.data.error, /cross_class_thread_denied/, 'Error message must cite cross_class_thread_denied');

    // 1b. Attempt thread creation by unlinked guardian
    const resUnlinkedParent = await makeRequest(
      server,
      'POST',
      '/messaging/threads',
      { childId: studentEnrolledId, classId: classIdA },
      tokenParentUnlinked
    );
    assert.equal(resUnlinkedParent.status, 403, 'Must deny thread creation by unlinked guardian');
    assert.match(resUnlinkedParent.data.error, /cross_class_thread_denied/, 'Error must cite cross_class_thread_denied');

    // 1c. Attempt thread creation directly by student (minor communication policy)
    const resStudentDirect = await makeRequest(
      server,
      'POST',
      '/messaging/threads',
      { childId: studentEnrolledId, classId: classIdA },
      tokenStudent
    );
    assert.equal(resStudentDirect.status, 403, 'Must deny direct thread creation by minor student');
    assert.match(resStudentDirect.data.error, /cross_class_thread_denied/, 'Error must cite cross_class_thread_denied policy');

    // 1d. Cross-tenant Master cannot create thread
    const resCrossTenantMaster = await makeRequest(
      server,
      'POST',
      '/messaging/threads',
      { childId: studentEnrolledId, classId: classIdA },
      tokenMasterOrgB
    );
    assert.equal(resCrossTenantMaster.status, 403, 'Must deny cross-tenant thread creation');

    // 1e. Legitimate thread creation succeeds
    const resValidCreate = await makeRequest(
      server,
      'POST',
      '/messaging/threads',
      { childId: studentEnrolledId, classId: classIdA, subject: 'Attendance Inquiry' },
      tokenParentValid
    );
    assert.equal(resValidCreate.status, 201, 'Valid thread creation must return 201');
    const validThread = resValidCreate.data;
    assert.ok(validThread.id, 'Thread ID must be generated');
    assert.equal(validThread.assigned_master_id, masterInitialId, 'Thread must be assigned to current active Master');
    assert.equal(validThread.parent_id, parentValidId, 'Thread must be bound to parent');
    console.log('✅ Criterion 1 (cross_class_thread_denied) PASSED.');

    // =========================================================================
    // CRITERION 2: former_master_cannot_send
    // =========================================================================
    console.log('\n--- Test 2: former_master_cannot_send ---');

    // 2a. Active master sends a message successfully
    const resMsg1 = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      { content: 'Welcome to class! Danial performed very well today.' },
      tokenMasterInit
    );
    assert.equal(resMsg1.status, 201, 'Active master message sending must return 201');
    assert.equal(resMsg1.data.content, 'Welcome to class! Danial performed very well today.');

    // 2b. Now deactivate MasterInitial's leadership for classIdA (reassign or handover)
    await dbClient.query(
      `UPDATE class_leaderships
       SET is_active = FALSE, effective_to = CURRENT_TIMESTAMP
       WHERE class_id = $1 AND master_id = $2;`,
      [classIdA, masterInitialId]
    );

    // 2c. Former master tries to send message in the thread -> denied 403
    const resFormerMasterMsg = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      { content: 'Attempting to send as former master.' },
      tokenMasterInit
    );
    assert.equal(resFormerMasterMsg.status, 403, 'Former master sending message must be denied with 403');
    assert.match(resFormerMasterMsg.data.error, /former_master_cannot_send/, 'Error message must cite former_master_cannot_send');
    console.log('✅ Criterion 2 (former_master_cannot_send) PASSED.');

    // =========================================================================
    // CRITERION 3: no_private_thread_auto_handover
    // =========================================================================
    console.log('\n--- Test 3: no_private_thread_auto_handover ---');

    // 3a. Assign masterNewIncomingId as the NEW active leader for classIdA
    await dbClient.query(
      `INSERT INTO class_leaderships (id, organization_id, class_id, master_id, leadership_type, is_active, effective_from)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET is_active = TRUE;`,
      [`lead_incoming_${timestamp}`, orgIdA, classIdA, masterNewIncomingId]
    );

    // 3b. When masterNewIncomingId queries GET /messaging/threads, previous private thread with masterInitial MUST NOT appear
    const resIncomingThreads = await makeRequest(
      server,
      'GET',
      '/messaging/threads',
      undefined,
      tokenMasterIncoming
    );
    assert.equal(resIncomingThreads.status, 200, 'Incoming master thread listing returns 200');
    const incomingThreadList = resIncomingThreads.data as any[];
    const leakedThread = incomingThreadList.find((t) => t.id === validThread.id);
    assert.equal(leakedThread, undefined, 'no_private_thread_auto_handover: incoming master must not inherit previous private thread in list');

    // 3c. When masterNewIncomingId attempts direct GET on previous thread /messages -> denied 403
    const resDirectAccessMsg = await makeRequest(
      server,
      'GET',
      `/messaging/threads/${validThread.id}/messages`,
      undefined,
      tokenMasterIncoming
    );
    assert.equal(resDirectAccessMsg.status, 403, 'Incoming master direct access to old private messages must return 403');
    assert.match(resDirectAccessMsg.data.error, /no_private_thread_auto_handover/, 'Must cite no_private_thread_auto_handover policy');
    console.log('✅ Criterion 3 (no_private_thread_auto_handover) PASSED.');

    // Restore MasterInitial's leadership to allow further messaging tests
    await dbClient.query(
      `UPDATE class_leaderships SET is_active = FALSE WHERE class_id = $1 AND master_id = $2;`,
      [classIdA, masterNewIncomingId]
    );
    await dbClient.query(
      `UPDATE class_leaderships
       SET is_active = TRUE, effective_to = NULL
       WHERE class_id = $1 AND master_id = $2;`,
      [classIdA, masterInitialId]
    );

    // =========================================================================
    // CRITERION 4: message_retry_once (Idempotency Key)
    // =========================================================================
    console.log('\n--- Test 4: message_retry_once ---');

    const clientMsgId = `cl_msg_${timestamp}_retry_key_01`;
    const messagePayload = {
      content: 'Please ensure Danial brings his sparring gear on Saturday.',
      clientMessageId: clientMsgId,
    };

    // First attempt -> 201 Created
    const resFirstSend = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      messagePayload,
      tokenParentValid
    );
    assert.equal(resFirstSend.status, 201, 'First message attempt returns 201');
    const firstMsgRecord = resFirstSend.data;
    assert.equal(firstMsgRecord.client_message_id, clientMsgId);

    // Second attempt (retry) with identical clientMessageId -> 200 OK idempotent replay, NO duplicate row
    const resSecondSend = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      messagePayload,
      tokenParentValid
    );
    assert.equal(resSecondSend.status, 200, 'Retry attempt with clientMessageId returns 200 idempotent replay');
    assert.equal(resSecondSend.data.id, firstMsgRecord.id, 'Must return the existing message record ID');
    assert.equal(resSecondSend.data.idempotentReplay, true, 'Must indicate idempotentReplay');

    // Verify row count in database for this clientMessageId is exactly 1
    const dbCountRes = await dbClient.query(
      `SELECT COUNT(*) FROM thread_messages WHERE client_message_id = $1;`,
      [clientMsgId]
    );
    assert.equal(Number(dbCountRes.rows[0].count), 1, 'Exactly one message row must exist for idempotent key');
    console.log('✅ Criterion 4 (message_retry_once) PASSED.');

    // =========================================================================
    // CRITERION 5: blocked_attachment_rejected
    // =========================================================================
    console.log('\n--- Test 5: blocked_attachment_rejected ---');

    // 5a. Executable extension rejected
    const resBlockedExe = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      {
        content: 'Check out this file',
        attachmentName: 'training_video.exe',
        attachmentMime: 'application/octet-stream',
      },
      tokenParentValid
    );
    assert.equal(resBlockedExe.status, 400, 'Blocked .exe attachment must return 400');
    assert.match(resBlockedExe.data.error, /blocked_attachment_rejected/, 'Error must cite blocked_attachment_rejected');

    // 5b. Script extension (.sh) rejected
    const resBlockedSh = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      {
        content: 'Check out this script',
        attachmentName: 'deploy.sh',
        attachmentMime: 'text/plain',
      },
      tokenParentValid
    );
    assert.equal(resBlockedSh.status, 400, 'Blocked .sh attachment must return 400');
    assert.match(resBlockedSh.data.error, /blocked_attachment_rejected/, 'Error must cite blocked_attachment_rejected');

    // 5c. Zip archive extension rejected
    const resBlockedZip = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      {
        content: 'Compressed photos',
        attachmentName: 'photos.zip',
        attachmentMime: 'application/zip',
      },
      tokenParentValid
    );
    assert.equal(resBlockedZip.status, 400, 'Blocked .zip attachment must return 400');
    assert.match(resBlockedZip.data.error, /blocked_attachment_rejected/, 'Error must cite blocked_attachment_rejected');

    // 5d. Permitted image attachment (.jpg) accepted
    const resPermittedImg = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      {
        content: 'Here is the medical cert receipt image',
        attachmentName: 'medical_note.jpg',
        attachmentMime: 'image/jpeg',
        attachmentSizeBytes: 204800,
        attachmentUrl: 'https://storage.beltflow.test/media/medical_note.jpg',
      },
      tokenParentValid
    );
    assert.equal(resPermittedImg.status, 201, 'Permitted image attachment returns 201');
    assert.equal(resPermittedImg.data.attachment_name, 'medical_note.jpg');
    console.log('✅ Criterion 5 (blocked_attachment_rejected) PASSED.');

    // =========================================================================
    // CRITERION 6: lock_screen_content_minimized
    // =========================================================================
    console.log('\n--- Test 6: lock_screen_content_minimized ---');

    // 6a. Send message from Parent to Master
    const parentSensitiveMsg = 'Danial has mild asthma flareup today, please watch him.';
    const resParentMsg = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      { content: parentSensitiveMsg },
      tokenParentValid
    );
    assert.equal(resParentMsg.status, 201);
    const sentMsgId = resParentMsg.data.id;

    // Check notification_outbox for the notification generated for the recipient (Master)
    const notifResMaster = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE aggregate_id = $1 AND event_type = 'ParentMasterMessageReceived' ORDER BY created_at DESC LIMIT 1;`,
      [validThread.id]
    );
    assert.ok(notifResMaster.rows.length > 0, 'Notification outbox record must be created for recipient');
    const notifMasterRow = notifResMaster.rows[0];
    const payloadMaster = typeof notifMasterRow.payload === 'string' ? JSON.parse(notifMasterRow.payload) : notifMasterRow.payload;

    // Lock screen body MUST be minimized (never leak child health or raw message)
    assert.equal(payloadMaster.recipientId, masterInitialId, 'Notification must target the assigned master');
    assert.equal(payloadMaster.body, 'New message from parent', 'Lock screen body must be strictly minimized to neutral text');
    assert.equal(payloadMaster.title, 'New Message', 'Lock screen title must be neutral');
    assert.ok(!payloadMaster.body.includes('asthma'), 'Lock screen body must not contain sensitive health keywords');
    assert.ok(!payloadMaster.body.includes('Danial'), 'Lock screen body must not contain student name');
    assert.equal(payloadMaster.lockScreenSafe, true, 'lockScreenSafe flag must be true');

    // 6b. Send message from Master to Parent
    const masterReplyMsg = 'Understood, we will keep his sparring light and provide water breaks.';
    const resMasterMsg = await makeRequest(
      server,
      'POST',
      `/messaging/threads/${validThread.id}/messages`,
      { content: masterReplyMsg },
      tokenMasterInit
    );
    assert.equal(resMasterMsg.status, 201);

    // Check notification_outbox for the notification generated for Parent
    const notifResParent = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE aggregate_id = $1 AND event_type = 'ParentMasterMessageReceived' ORDER BY created_at DESC LIMIT 1;`,
      [validThread.id]
    );
    assert.ok(notifResParent.rows.length > 0, 'Notification outbox record must be created for parent');
    const notifParentRow = notifResParent.rows[0];
    const payloadParent = typeof notifParentRow.payload === 'string' ? JSON.parse(notifParentRow.payload) : notifParentRow.payload;
    assert.equal(payloadParent.recipientId, parentValidId, 'Notification must target the parent');
    assert.equal(payloadParent.body, 'New message from instructor', 'Lock screen body for parent must be strictly minimized to instructor notice');
    assert.equal(payloadParent.title, 'New Message');
    assert.ok(!payloadParent.body.includes('sparring'), 'Lock screen body must not contain message body contents');
    console.log('✅ Criterion 6 (lock_screen_content_minimized) PASSED.');

    // =========================================================================
    // FEATURE: reportMessage(id) & Admin Moderation
    // =========================================================================
    console.log('\n--- Test 7: reportMessage(id) and Moderation ---');

    // Parent reports the message sent by Master
    const resReport = await makeRequest(
      server,
      'POST',
      `/messaging/messages/${sentMsgId}/report`,
      { reason: 'Requested review of communication tone' },
      tokenParentValid
    );
    assert.equal(resReport.status, 200, 'Reporting message returns 200');
    assert.equal(resReport.data.success, true);
    assert.equal(resReport.data.status, 'PENDING_REVIEW');

    // Admin Persatuan inspects reports
    const resAdminReports = await makeRequest(
      server,
      'GET',
      '/messaging/reports',
      undefined,
      tokenAdminA
    );
    assert.equal(resAdminReports.status, 200, 'Admin Persatuan can view message reports');
    const reportsList = resAdminReports.data as any[];
    const foundReport = reportsList.find((r) => r.message_id === sentMsgId);
    assert.ok(foundReport, 'Report must be found in Admin list');
    assert.equal(foundReport.status, 'PENDING_REVIEW');
    console.log('✅ reportMessage(id) and Moderation PASSED.');

    console.log('\n🎉 ALL 6 OFFICIAL H22 ACCEPTANCE CRITERIA PASSED WITHOUT REGRESSION!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Task H22 Acceptance Tests Failed:', err);
      process.exit(1);
    });
}

export { runTests as runH22Tests };
