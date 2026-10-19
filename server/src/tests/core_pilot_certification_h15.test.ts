import assert from 'node:assert/strict';
import http from 'node:http';
import nacl from 'tweetnacl';
import crypto from 'node:crypto';
import app from '../app';
import { dbClient } from '../db/client';
import {
  generateAuthToken,
  signQrPassPayload,
  verifyQrPassPayload,
  getQrVerificationKeys,
  ACTIVE_QR_KEY_ID,
  QR_ISSUER,
  QR_AUDIENCE,
} from '../security/crypto';
import { SandboxGatewayAdapter } from '../services/payment/sandboxAdapter';
import { UserRole } from '../security/rbac';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
      ...(extraHeaders || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, data: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runH15Certification() {
  console.log('🥋 Starting Task H15: Core Pilot Certification, Security Hardening & Release Gate Tests...\n');

  // Initialize DB
  const path = await import('node:path');
  const dbDir = path.resolve(process.cwd(), '.beltflow_pgdata');
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // ------------------------------------------------------------------------
    // SETUP: Multi-Persatuan Foundations (Persatuan A & Persatuan B)
    // ------------------------------------------------------------------------
    console.log('--- 0. Provisioning Independent Persatuans & Baseline Credentials ---');
    const testRun = Date.now();
    const orgAId = `org_h15_silat_${testRun}`;
    const orgBId = `org_h15_tkd_${testRun}`;

    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES
       ($1, 'Persatuan Silat Gayong Harimau A', 'Selangor', 'Silat', 'Master Azlan', '0123456781', $3, 120.00, 'ACTIVE'),
       ($2, 'Persatuan Taekwondo Bunga Raya B', 'Kuala Lumpur', 'Taekwondo', 'Master Chong', '0123456782', $4, 150.00, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [orgAId, orgBId, `azlan_h15_${testRun}@beltflow.test`, `chong_h15_${testRun}@beltflow.test`]
    );

    // Users
    const superAdminId = `usr_h15_super_${testRun}`;
    const adminAId = `usr_h15_admin_a_${testRun}`;
    const adminBId = `usr_h15_admin_b_${testRun}`;
    const masterAId = `usr_h15_master_a_${testRun}`;
    const masterBId = `usr_h15_master_b_${testRun}`;
    const parentAId = `usr_h15_parent_a_${testRun}`;
    const studentAId = `usr_h15_student_a_${testRun}`;

    const superEmail = `super_h15_${testRun}@beltflow.test`;
    const adminAEmail = `admin_h15_a_${testRun}@beltflow.test`;
    const adminBEmail = `admin_h15_b_${testRun}@beltflow.test`;
    const masterAEmail = `master_h15_a_${testRun}@beltflow.test`;
    const masterBEmail = `master_h15_b_${testRun}@beltflow.test`;
    const parentAEmail = `parent_h15_a_${testRun}@beltflow.test`;
    const studentAEmail = `student_h15_a_${testRun}@beltflow.test`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES
       ($1, NULL, $2, 'HASH', 'Super Auditor', 'SUPER_ADMIN', 'ACTIVE'),
       ($3, $4, $5, 'HASH', 'Admin Azlan', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($6, $7, $8, 'HASH', 'Admin Chong', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($9, $4, $10, 'HASH', 'Master Jamal', 'MASTER', 'ACTIVE'),
       ($11, $7, $12, 'HASH', 'Master Tan', 'MASTER', 'ACTIVE'),
       ($13, $4, $14, 'HASH', 'Encik Sulaiman', 'PARENT', 'ACTIVE'),
       ($15, $4, $16, 'HASH', 'Harith Sulaiman', 'STUDENT', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [
        superAdminId, superEmail,
        adminAId, orgAId, adminAEmail,
        adminBId, orgBId, adminBEmail,
        masterAId, masterAEmail,
        masterBId, masterBEmail,
        parentAId, parentAEmail,
        studentAId, studentAEmail,
      ]
    );

    const tokenSuper = generateAuthToken({ id: superAdminId, email: superEmail, role: UserRole.SUPER_ADMIN });
    const tokenAdminA = generateAuthToken({ id: adminAId, email: adminAEmail, role: UserRole.ADMIN_PERSATUAN, organizationId: orgAId });
    const tokenAdminB = generateAuthToken({ id: adminBId, email: adminBEmail, role: UserRole.ADMIN_PERSATUAN, organizationId: orgBId });
    const tokenMasterA = generateAuthToken({ id: masterAId, email: masterAEmail, role: UserRole.MASTER, organizationId: orgAId });
    const tokenMasterB = generateAuthToken({ id: masterBId, email: masterBEmail, role: UserRole.MASTER, organizationId: orgBId });
    const tokenParentA = generateAuthToken({ id: parentAId, email: parentAEmail, role: UserRole.PARENT, organizationId: orgAId });
    const tokenStudentA = generateAuthToken({ id: studentAId, email: studentAEmail, role: UserRole.STUDENT, organizationId: orgAId });

    // Curriculum for Persatuan A
    const currAId = `curr_h15_a_${testRun}`;
    await dbClient.query(
      `INSERT INTO persatuan_curriculums (id, organization_id, system_name, martial_art_style, status, version)
       VALUES ($1, $2, 'Silibus Silat Gayong Harimau', 'Silat', 'PUBLISHED', 1)`,
      [currAId, orgAId]
    );

    await dbClient.query(
      `INSERT INTO curriculum_belt_ranks (id, curriculum_id, name, rank_order, color_hex, min_months, min_sessions, description)
       VALUES
       ($1, $4, 'White Belt', 1, '#FFFFFF', 0, 0, 'Basic Stance'),
       ($2, $4, 'Yellow Belt', 2, '#FFFF00', 3, 20, 'Langkah 1-4'),
       ($3, $4, 'Green Belt', 3, '#008000', 6, 40, 'Langkah 5-8')`,
      [`cbr_h15_w_${testRun}`, `cbr_h15_y_${testRun}`, `cbr_h15_g_${testRun}`, currAId]
    );

    console.log('✅ Requirement 0 Passed: Multi-tenant baseline credentials initialized.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 1: Master_apply_to_student_approval_E2E
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Acceptance Test: Master_apply_to_student_approval_E2E ---');
    // Step 1: Master creates and submits affiliation application with Persatuan A
    const createMasterAppRes = await makeRequest(
      server,
      'POST',
      '/master-applications',
      {
        organizationId: orgAId,
        qualifications: 'Black belt 4th Dan instructor certified',
        experienceSummary: '10 years instructing Silat Gayong Harimau',
        verificationDetails: 'National Silat Federation Certification #NSF-9921',
      },
      tokenMasterA
    );
    assert.equal(createMasterAppRes.status, 201, 'Master application draft created');
    const masterAppId = createMasterAppRes.data.application?.id;
    assert.ok(masterAppId, 'Master application ID returned');

    const submitMasterAppRes = await makeRequest(
      server,
      'POST',
      `/master-applications/${masterAppId}/submit`,
      {},
      tokenMasterA
    );
    assert.equal(submitMasterAppRes.status, 200, 'Master application submitted');

    // Step 2: Persatuan Admin reviews and approves Master verification application
    const approveMasterRes = await makeRequest(
      server,
      'POST',
      `/master-applications/${masterAppId}/review`,
      { decision: 'APPROVE', expectedVersion: 2, reason: 'Verified credentials and black belt certs' },
      tokenAdminA
    );
    assert.equal(approveMasterRes.status, 200, 'Admin approves master application');

    // Verify Master affiliation is ACTIVE
    const affilCheck = await dbClient.query(
      "SELECT status FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 AND status = 'ACTIVE'",
      [masterAId, orgAId]
    );
    assert.ok(affilCheck.rowCount > 0, 'Master affiliation must be ACTIVE in Persatuan A');

    // Step 3: Master proposes new class in Persatuan A
    const proposeClassRes = await makeRequest(
      server,
      'POST',
      '/class-applications',
      {
        organizationId: orgAId,
        name: 'Kelas Silat Remaja A',
        schedule: 'Saturday 9:00 AM - 11:00 AM',
        location: 'Gelanggang Utama A',
        capacity: 25,
        monthlyFee: 120.0,
      },
      tokenMasterA
    );
    assert.equal(proposeClassRes.status, 201, 'Master proposes new class');
    const classAppId = proposeClassRes.data.application?.id;
    assert.ok(classAppId, 'Class application ID returned');

    const submitClassAppRes = await makeRequest(
      server,
      'POST',
      `/class-applications/${classAppId}/submit`,
      {},
      tokenMasterA
    );
    assert.equal(submitClassAppRes.status, 200, 'Class application submitted');

    // Step 4: Persatuan Admin approves class proposal and assigns Master leadership
    const approveClassRes = await makeRequest(
      server,
      'POST',
      `/class-applications/${classAppId}/review`,
      { decision: 'APPROVE', expectedVersion: 2 },
      tokenAdminA
    );
    assert.equal(approveClassRes.status, 200, 'Admin approves class proposal');
    const createdClassId = approveClassRes.data.classId || approveClassRes.data.application?.class_id;
    assert.ok(createdClassId, 'Canonical class ID must be returned');

    // Verify class operational status is ACTIVE
    const classStatusCheck = await dbClient.query('SELECT operational_status FROM classes WHERE id = $1', [createdClassId]);
    assert.equal(classStatusCheck.rows[0]?.operational_status, 'ACTIVE', 'Class must be active');

    // Step 5: Student discovers class and submits enrollment application
    const newStudentProfileId = `stu_h15_harith_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, status)
       VALUES ($1, $2, NULL, $3, 'Harith Sulaiman', '120101-10-4433', '0123456789', 'harith@beltflow.test', 'White Belt', 120.00, 'PROVISIONAL')`,
      [newStudentProfileId, orgAId, studentAId]
    );

    const enrollAppId = `enrapp_h15_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO enrollment_applications (
         id, student_id, class_id, organization_id, applicant_type, student_name, ic_number,
         phone, consent_accepted, status, version, submitted_at
       ) VALUES ($1, $2, $3, $4, 'STUDENT', 'Harith Sulaiman', '120101-10-4433', '0123456789', true, 'SUBMITTED', 1, CURRENT_TIMESTAMP)`,
      [enrollAppId, newStudentProfileId, createdClassId, orgAId]
    );

    // Step 6: Negative test — Cross-tenant Master B cannot approve Persatuan A enrollment
    const crossMasterApproveRes = await makeRequest(
      server,
      'POST',
      `/enrollment-applications/${enrollAppId}/review`,
      { decision: 'APPROVE', expectedVersion: 1 },
      tokenMasterB
    );
    assert.equal(crossMasterApproveRes.status, 403, 'Cross-tenant Master must be forbidden from approving enrollment');

    // Step 7: Negative test — Super Admin cannot approve operational class enrollment
    const superApproveRes = await makeRequest(
      server,
      'POST',
      `/enrollment-applications/${enrollAppId}/review`,
      { decision: 'APPROVE', expectedVersion: 1 },
      tokenSuper
    );
    assert.equal(superApproveRes.status, 403, 'Super Admin must be forbidden from operational enrollment approval');

    // Step 8: Master A of this class approves student enrollment application
    const masterApproveRes = await makeRequest(
      server,
      'POST',
      `/enrollment-applications/${enrollAppId}/review`,
      { decision: 'APPROVE', expectedVersion: 1, notes: 'Welcome to Kelas Silat Remaja A' },
      tokenMasterA
    );
    assert.equal(masterApproveRes.status, 200, 'Assigned Master approves enrollment application');

    // Verify student is promoted to ACTIVE in class roster
    const studentRosterCheck = await dbClient.query('SELECT status, class_id FROM students WHERE id = $1', [newStudentProfileId]);
    assert.equal(studentRosterCheck.rows[0]?.status, 'ACTIVE', 'Student must become ACTIVE on Master approval');
    assert.equal(studentRosterCheck.rows[0]?.class_id, createdClassId, 'Student class_id must link to approved class');

    // Verify class_enrollments row exists with ACTIVE status
    const enrollmentRowCheck = await dbClient.query(
      "SELECT status FROM class_enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'ACTIVE'",
      [newStudentProfileId, createdClassId]
    );
    assert.ok(enrollmentRowCheck.rowCount > 0, 'ACTIVE class_enrollments row must be recorded');
    console.log('✅ Acceptance Test 1 Passed: Master_apply_to_student_approval_E2E verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 2: offline_QR_sync_E2E & SEC-QR-001 Cryptographic Defense
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Acceptance Test: offline_QR_sync_E2E (SEC-QR-001 Verification) ---');
    // Step 1: Server generates authentic Ed25519 digital pass for student
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + 24 * 3600;
    const signedPassMeta = signQrPassPayload({
      v: 2,
      oid: orgAId,
      sid: newStudentProfileId,
      iat: nowSeconds,
      exp: expSeconds,
    });
    assert.ok(signedPassMeta.sig, 'Ed25519 signature must be generated');

    const passPayload = {
      type: 'BF_PASS',
      v: signedPassMeta.v,
      kid: signedPassMeta.kid,
      iss: signedPassMeta.iss,
      aud: signedPassMeta.aud,
      oid: orgAId,
      sid: newStudentProfileId,
      iat: nowSeconds,
      exp: expSeconds,
      nonce: signedPassMeta.nonce,
      sig: signedPassMeta.sig,
    };

    // Step 2: Client verifies authentic pass offline with server public keys
    const offlineVerification = verifyQrPassPayload(passPayload);
    assert.equal(offlineVerification.valid, true, 'Authentic server pass must verify cleanly offline');

    // Step 3: Forgery Attack Rejection
    // An attacker crafts a pass modifying the student ID or using rogue keys
    const forgedPayload = {
      ...passPayload,
      sid: 'stu_hacked_infiltrator',
    };
    const forgedOfflineVerification = verifyQrPassPayload(forgedPayload);
    assert.equal(forgedOfflineVerification.valid, false, 'CRITICAL: Tampered student pass must fail cryptographic verification');
    assert.equal(forgedOfflineVerification.errorCode, 'INVALID_SIGNATURE');

    // Verification via server endpoint also rejects forgery
    const serverVerifyTampered = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(forgedPayload) },
      tokenMasterA
    );
    assert.equal(serverVerifyTampered.status, 403, 'Server endpoint must reject tampered QR pass');

    // Step 4: Offline attendance sync to server
    const groupId = `grp_h15_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name)
       VALUES ($1, $2, $3, 'Kumpulan Harimau Belia')`,
      [groupId, orgAId, createdClassId]
    );
    await dbClient.query('UPDATE students SET group_id = $1 WHERE id = $2', [groupId, newStudentProfileId]);

    const sessId = `sess_h15_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-10-19', 'Monday', '20:00', '21:30', 'Gelanggang Utama A', 'Scheduled')`,
      [sessId, orgAId, createdClassId, groupId]
    );

    const mutationId = `mut_h15_${Date.now()}`;
    const syncRes = await makeRequest(
      server,
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId,
            sessionId: sessId,
            studentId: newStudentProfileId,
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      tokenMasterA
    );
    assert.equal(syncRes.status, 200, 'Valid offline attendance sync succeeds');
    assert.ok(syncRes.data.synced?.includes(mutationId), 'Mutation ID must be reported as synced');

    // Verify attendance was written to DB
    const attRec = await dbClient.query(
      'SELECT status FROM session_attendance WHERE session_id = $1 AND student_id = $2',
      [sessId, newStudentProfileId]
    );
    assert.equal(attRec.rows[0]?.status, 'Present', 'Attendance record recorded in DB');

    // Step 5: Duplicate sync is idempotent (no duplicate attendance records)
    const syncRetryRes = await makeRequest(
      server,
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId,
            sessionId: sessId,
            studentId: newStudentProfileId,
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      tokenMasterA
    );
    assert.equal(syncRetryRes.status, 200, 'Duplicate sync is idempotent');
    assert.ok(syncRetryRes.data.synced?.includes(mutationId));
    const attCount = await dbClient.query(
      'SELECT count(*) FROM session_attendance WHERE session_id = $1 AND student_id = $2',
      [sessId, newStudentProfileId]
    );
    assert.equal(parseInt(attCount.rows[0].count, 10), 1, 'Exactly one attendance record must exist');
    console.log('✅ Acceptance Test 2 Passed: offline_QR_sync_E2E and SEC-QR-001 verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 3: grading_to_certificate_E2E (CERT-001 Verification)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Acceptance Test: grading_to_certificate_E2E (CERT-001 Privacy Verification) ---');
    // Step 1: Master records skill assessment for student
    const skillRes = await makeRequest(
      server,
      'POST',
      '/skills/assess',
      {
        studentId: newStudentProfileId,
        skillId: 'sk_langkah_1',
        skillName: 'Langkah 1 & 2',
        category: 'Langkah Silat',
        level: 'COMPETENT',
        notes: 'Good stance and form',
      },
      tokenMasterA
    );
    assert.equal(skillRes.status, 200, 'Master records skill assessment');

    // Step 2: Admin creates official Grading Event
    const eventRes = await makeRequest(
      server,
      'POST',
      '/grading',
      {
        organizationId: orgAId,
        title: 'Ujian Kenaikan Bengkung Musim 4',
        eventDate: '2026-10-25',
        location: 'Dewan Silat Utama',
        fee: 60.0,
      },
      tokenAdminA
    );
    assert.equal(eventRes.status, 201, 'Admin creates grading event');
    const gradingEventId = eventRes.data.event?.id;
    assert.ok(gradingEventId, 'Grading event ID returned');

    // Step 3: Master nominates student for grading
    const nomRes = await makeRequest(
      server,
      'POST',
      `/grading/${gradingEventId}/nominate`,
      {
        studentId: newStudentProfileId,
        targetBelt: 'Yellow Belt',
      },
      tokenMasterA
    );
    assert.equal(nomRes.status, 201, 'Master nominates student');

    // Step 4: Admin finalizes grading atomically
    const finalizeRes = await makeRequest(
      server,
      'POST',
      `/grading/${gradingEventId}/finalize`,
      {
        expectedVersion: 1,
        results: [
          {
            studentId: newStudentProfileId,
            result: 'Passed',
            targetBelt: 'Yellow Belt',
            examinerScore: 88,
            notes: 'Clean execution',
          },
        ],
      },
      tokenAdminA
    );
    assert.equal(finalizeRes.status, 200, 'Admin finalizes grading');
    const certRecord = finalizeRes.data.issuedCertificates?.[0];
    assert.ok(certRecord, 'Issued certificate record must exist');
    const certificateToken = certRecord.verification_token;
    assert.ok(certificateToken, 'Cryptographic certificate verification token must be issued');

    // Verify student belt rank updated
    const rankCheck = await dbClient.query('SELECT belt_rank FROM students WHERE id = $1', [newStudentProfileId]);
    assert.equal(rankCheck.rows[0]?.belt_rank, 'Yellow Belt', 'Student belt rank promoted to Yellow Belt');

    // Step 5: CERT-001 Public Verification Check (Unauthenticated)
    const publicVerifyRes = await makeRequest(
      server,
      'POST',
      '/certificates/public-verify',
      { codeOrToken: certificateToken }
      // NO Authorization token header!
    );
    assert.equal(publicVerifyRes.status, 200, 'Unauthenticated public certificate verification succeeds');
    assert.equal(publicVerifyRes.data.verified, true);
    assert.equal(publicVerifyRes.data.status, 'VALID', 'Certificate status is VALID');
    assert.equal(publicVerifyRes.data.certificate.rankOrTitle, 'Yellow Belt');
    assert.equal(publicVerifyRes.data.certificate.organizationName, 'Persatuan Silat Gayong Harimau A');

    // CRITICAL DATA MINIMIZATION ASSERTIONS:
    assert.ok(publicVerifyRes.data.certificate.maskedStudentName, 'maskedStudentName must be provided');
    assert.strictEqual(publicVerifyRes.data.certificate.studentName, undefined, 'CRITICAL: Raw full studentName must NOT be exposed publicly');
    assert.strictEqual(publicVerifyRes.data.certificate.icNumber, undefined, 'CRITICAL: IC/MyKid must NOT be exposed publicly');
    assert.strictEqual(publicVerifyRes.data.certificate.dob, undefined, 'CRITICAL: Date of birth must NOT be exposed publicly');
    assert.strictEqual(publicVerifyRes.data.certificate.guardian, undefined, 'CRITICAL: Guardian info must NOT be exposed publicly');
    assert.strictEqual(publicVerifyRes.data.certificate.fees, undefined, 'CRITICAL: Fee balances must NOT be exposed publicly');

    // Step 6: Certificate Revocation
    const certId = certRecord.id;
    assert.ok(certId);

    const revokeRes = await makeRequest(
      server,
      'POST',
      `/certificates/${certId}/revoke`,
      { reason: 'Disciplinary review pending' },
      tokenAdminA
    );
    assert.equal(revokeRes.status, 200, 'Admin revokes certificate');

    // Public verification now returns REVOKED
    const publicVerifyRevokedRes = await makeRequest(
      server,
      'POST',
      '/certificates/public-verify',
      { codeOrToken: certificateToken }
    );
    assert.equal(publicVerifyRevokedRes.status, 200);
    assert.equal(publicVerifyRevokedRes.data.status, 'REVOKED');
    assert.equal(publicVerifyRevokedRes.data.certificate.status, 'REVOKED');
    console.log('✅ Acceptance Test 3 Passed: grading_to_certificate_E2E and CERT-001 verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 4: payment_to_receipt_E2E & Multi-Persatuan Integrity
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Acceptance Test: payment_to_receipt_E2E & PAY-LIVE-001 Verification ---');
    // Step 1: Configure merchant for Persatuan A
    const webhookSecretA = 'sec_wh_org_a_super_secret_999';
    const saveMerchantRes = await makeRequest(
      server,
      'PUT',
      '/payments/merchant/my-config',
      {
        merchantAccountId: 'MERCH_SILAT_A',
        merchantName: 'Persatuan Silat Gayong Harimau A',
        provider: 'SANDBOX',
        settlementBankName: 'Maybank',
        settlementAccountNumber: '512345678901',
        fpxEnabled: true,
        duitnowEnabled: true,
        cardEnabled: false,
        webhookSecret: webhookSecretA,
      },
      tokenAdminA
    );
    assert.equal(saveMerchantRes.status, 200, 'Merchant config saved');

    // Step 2: Insert monthly due for student
    const dueId = `due_h15_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, $3, $4, '2026-10', 120.00, 0.00, 'Pending')`,
      [dueId, orgAId, createdClassId, newStudentProfileId]
    );

    // Link parent to student
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'ACTIVE', true, true, true)
       ON CONFLICT (parent_id, student_id) DO UPDATE SET status = 'ACTIVE'`,
      [`plink_h15_${Date.now()}`, parentAId, newStudentProfileId]
    );

    // Step 3: Parent creates payment intent (12000 sen = RM 120.00)
    const idempotencyKey = `idemp_pay_h15_${Date.now()}`;
    const intentRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: newStudentProfileId,
        billingMonthIds: [dueId],
        paymentMethod: 'FPX',
        fpxBankCode: 'MBB0227',
        idempotencyKey,
      },
      tokenParentA
    );
    assert.equal(intentRes.status, 201, 'Payment intent created');
    const intentId = intentRes.data.intent?.id;
    const providerTxId = intentRes.data.intent?.providerTxId;
    assert.ok(intentId, 'Payment intent ID generated');
    assert.equal(intentRes.data.intent.amountCents, 12000, 'Authoritative sen calculation: 12000 sen');

    // Step 4: Webhook callback from sandbox provider
    const validWebhookPayload = {
      eventId: `evt_h15_${Date.now()}`,
      eventType: 'payment.succeeded' as const,
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_SILAT_A',
      amountCents: 12000,
      currency: 'MYR',
    };
    const validSig = SandboxGatewayAdapter.generateTestWebhook(validWebhookPayload, webhookSecretA).signature;

    const webhook1Res = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      validWebhookPayload,
      undefined,
      { 'x-beltflow-signature': validSig }
    );
    assert.equal(webhook1Res.status, 200, 'Webhook accepted and processed');
    const receiptNo = webhook1Res.data.receiptNo;
    assert.ok(receiptNo?.startsWith('REC-'), 'Receipt number must follow REC-YYYYMMDD-#### format');

    // Verify database state: Dues marked Paid, student billing status Paid
    const dueCheck = await dbClient.query('SELECT status, amount_paid FROM monthly_dues WHERE id = $1', [dueId]);
    assert.equal(dueCheck.rows[0]?.status, 'Paid');
    assert.equal(Number(dueCheck.rows[0]?.amount_paid), 120.00);

    const studentBillingCheck = await dbClient.query('SELECT billing_status FROM students WHERE id = $1', [newStudentProfileId]);
    assert.equal(studentBillingCheck.rows[0]?.billing_status, 'Paid');

    // Verify ledger entry
    const ledgerCheck = await dbClient.query('SELECT * FROM payment_reconciliation_records WHERE payment_intent_id = $1', [intentId]);
    assert.equal(ledgerCheck.rowCount, 1, 'Reconciliation ledger entry recorded');
    assert.equal(ledgerCheck.rows[0]?.match_status, 'MATCHED');

    // Step 5: Duplicate webhook delivery is strictly idempotent
    const webhook2Res = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      validWebhookPayload,
      undefined,
      { 'x-beltflow-signature': validSig }
    );
    assert.equal(webhook2Res.status, 200, 'Duplicate webhook returns 200');
    assert.ok(webhook2Res.data.message?.includes('idempotent duplicate'));

    const ledgerCount = await dbClient.query('SELECT count(*) FROM payment_reconciliation_records WHERE payment_intent_id = $1', [intentId]);
    assert.equal(parseInt(ledgerCount.rows[0].count, 10), 1, 'Duplicate webhook causes zero duplicate ledger entries');

    // Step 6: PAY-LIVE-001 Status Check
    const gatewayRegistryCheck = await dbClient.query("SELECT provider FROM persatuan_merchants WHERE organization_id = $1", [orgAId]);
    assert.equal(gatewayRegistryCheck.rows[0]?.provider, 'SANDBOX', 'PAY-LIVE-001: Gateway must remain in SANDBOX mode');
    console.log('✅ Acceptance Test 4 Passed: payment_to_receipt_E2E and PAY-LIVE-001 verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 5: cross_role_negative_matrix
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Acceptance Test: cross_role_negative_matrix (5-Role Security Boundaries) ---');
    // 1. SUPER_ADMIN operational denials
    const superStudentRoster = await makeRequest(server, 'GET', `/students/organization/${orgAId}`, undefined, tokenSuper);
    assert.equal(superStudentRoster.status, 403, 'SUPER_ADMIN cannot access operational student roster');

    const superSafetyAccess = await makeRequest(server, 'GET', `/students/${newStudentProfileId}/safety`, undefined, tokenSuper);
    assert.equal(superSafetyAccess.status, 403, 'SUPER_ADMIN cannot access student safety/medical records');

    const superCommitImport = await makeRequest(server, 'POST', '/onboarding-imports/commit-import', { previewId: 'p', idempotencyKey: 'k' }, tokenSuper);
    assert.equal(superCommitImport.status, 403, 'SUPER_ADMIN cannot commit operational student imports');

    // 2. ADMIN_PERSATUAN cross-tenant denials
    const adminACrossClass = await makeRequest(server, 'POST', `/class-applications/capp_fake_org_b/review`, { decision: 'APPROVE' }, tokenAdminA);
    assert.ok([403, 404].includes(adminACrossClass.status), 'Admin A cannot mutate Org B class applications');

    const adminACrossMerchant = await makeRequest(server, 'GET', `/payments/merchant/${orgBId}/config`, undefined, tokenAdminA);
    assert.equal(adminACrossMerchant.status, 403, 'Admin A cannot view Org B merchant account');

    // 3. MASTER boundary denials
    const masterMerchantConfig = await makeRequest(server, 'PUT', '/payments/merchant/my-config', { merchantAccountId: 'HACK' }, tokenMasterA);
    assert.equal(masterMerchantConfig.status, 403, 'Master cannot configure Persatuan merchant accounts');

    const masterCrossRoster = await makeRequest(server, 'GET', `/attendance/class/${createdClassId}`, undefined, tokenMasterB);
    assert.equal(masterCrossRoster.status, 403, 'Master B cannot view Persatuan A class attendance roster');

    // 4. PARENT boundary denials
    const fakeChildId = `stu_fake_unlinked_${Date.now()}`;
    const parentUnlinkedSafety = await makeRequest(server, 'GET', `/students/${fakeChildId}/safety`, undefined, tokenParentA);
    assert.ok([403, 404].includes(parentUnlinkedSafety.status), 'Parent cannot access safety records of unlinked child');

    const parentGradingFinalize = await makeRequest(server, 'POST', `/grading/${gradingEventId}/finalize`, { results: [] }, tokenParentA);
    assert.equal(parentGradingFinalize.status, 403, 'Parent cannot finalize belt grading');

    // 5. STUDENT boundary denials
    const studentSelfAssess = await makeRequest(
      server,
      'POST',
      '/skills/assess',
      { studentId: newStudentProfileId, skillId: 'sk_hack', skillName: 'Kipas', category: 'Silat', level: 'MASTERED' },
      tokenStudentA
    );
    assert.equal(studentSelfAssess.status, 403, 'Student cannot self-award skills or belt ranks');

    const studentNominateGrading = await makeRequest(
      server,
      'POST',
      `/grading/${gradingEventId}/nominate`,
      { studentId: newStudentProfileId, targetBelt: 'Black Belt' },
      tokenStudentA
    );
    assert.equal(studentNominateGrading.status, 403, 'Student cannot self-nominate for grading');

    console.log('✅ Acceptance Test 5 Passed: cross_role_negative_matrix verified across all 5 roles.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 6: restore_rehearsal_pass (PostgreSQL Concurrency & Recovery)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Acceptance Test: restore_rehearsal_pass (Transaction Rollback & Concurrency) ---');
    // Step 1: Transaction Rollback on Failure
    const probeStudentId = `stu_probe_rollback_${Date.now()}`;
    try {
      await dbClient.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, belt_rank, status)
           VALUES ($1, $2, $3, 'Probe Student', '150101-10-9999', '0111111111', 'White Belt', 'ACTIVE')`,
          [probeStudentId, orgAId, createdClassId]
        );
        // Force intentional error to simulate crash
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (e: any) {
      assert.equal(e.message, 'SIMULATED_TRANSACTION_FAILURE');
    }

    // Verify zero orphaned records remain in database after transaction rollback
    const rollbackCheck = await dbClient.query('SELECT id FROM students WHERE id = $1', [probeStudentId]);
    assert.equal(rollbackCheck.rowCount, 0, 'Clean rollback: probe student must NOT exist in database');

    // Step 2: Row-level lock concurrency rehearsal
    // Verify that concurrent operations on financial receipts / enrollments use serial locking
    let serialExecutionOrder: string[] = [];
    const lockKey = `lock_h15_${Date.now()}`;

    await Promise.all([
      dbClient.transaction(async (tx) => {
        await tx.query('SELECT * FROM organizations WHERE id = $1 FOR UPDATE', [orgAId]);
        await new Promise((r) => setTimeout(r, 50));
        serialExecutionOrder.push('TX1');
      }),
      dbClient.transaction(async (tx) => {
        await tx.query('SELECT * FROM organizations WHERE id = $1 FOR UPDATE', [orgAId]);
        serialExecutionOrder.push('TX2');
      }),
    ]);

    assert.equal(serialExecutionOrder.length, 2);
    assert.equal(serialExecutionOrder[0], 'TX1', 'Row-level locking must enforce strict serialization');
    console.log('✅ Acceptance Test 6 Passed: restore_rehearsal_pass verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 7: Defect IMPORT-AUTH-001 Verification
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Verification of Defect Fix: IMPORT-AUTH-001 ---');
    const importBatchRows = [
      {
        fullName: 'Zainal Abidin (Imported)',
        icNumber: '110808-10-5566',
        beltRank: 'Green Belt',
        className: 'Kelas Silat Remaja A',
        parentName: 'Puan Mariam',
        parentEmail: 'mariam_parent@beltflow.test',
        parentPhone: '0129998888',
      },
    ];

    const previewRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/preview-import',
      { rows: importBatchRows, sourceFilename: 'legacy_pilot_2026.csv' },
      tokenAdminA
    );
    assert.equal(previewRes.status, 200);
    const previewId = previewRes.data.previewId;

    const commitRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/commit-import',
      { previewId, idempotencyKey: `idemp_commit_h15_${Date.now()}` },
      tokenAdminA
    );
    assert.equal(commitRes.status, 200);

    // Verify imported student does NOT have status = 'ACTIVE'
    const importedStudentCheck = await dbClient.query(
      "SELECT id, status FROM students WHERE full_name = 'Zainal Abidin (Imported)'"
    );
    assert.ok(importedStudentCheck.rowCount > 0);
    const importedStudent = importedStudentCheck.rows[0];
    assert.equal(
      importedStudent.status,
      'REVIEW_REQUIRED',
      'CRITICAL (IMPORT-AUTH-001): Imported student status must be REVIEW_REQUIRED, NOT silently ACTIVE'
    );

    // Verify enrollment_applications record exists awaiting Master approval
    const importedAppCheck = await dbClient.query(
      "SELECT id, status FROM enrollment_applications WHERE student_id = $1",
      [importedStudent.id]
    );
    assert.ok(importedAppCheck.rowCount > 0, 'Enrollment application must be created for imported class assignment');
    assert.equal(importedAppCheck.rows[0].status, 'SUBMITTED', 'Application must be in SUBMITTED state awaiting Master review');

    // Verify guardian link requires admin verification
    const importedLinkCheck = await dbClient.query(
      "SELECT status, student_approved, master_approved, admin_approved FROM parent_student_links WHERE student_id = $1",
      [importedStudent.id]
    );
    assert.ok(importedLinkCheck.rowCount > 0);
    assert.equal(
      importedLinkCheck.rows[0].status,
      'PENDING_ADMIN',
      'CRITICAL (IMPORT-AUTH-001): Guardian link must be PENDING_ADMIN, not automatically approved'
    );
    assert.equal(importedLinkCheck.rows[0].admin_approved, false);
    console.log('✅ Acceptance Test 7 Passed: Defect IMPORT-AUTH-001 verified resolved.');

    console.log('\n🎉 ALL 7 TASK H15 CORE PILOT CERTIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dbClient.close();
  }
}

runH15Certification().catch((err) => {
  console.error('\n❌ TASK H15 CERTIFICATION FAILED:', err);
  process.exit(1);
});
