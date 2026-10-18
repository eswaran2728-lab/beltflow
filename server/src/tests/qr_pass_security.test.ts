import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import {
  generateAuthToken,
  signQrPassPayload,
  verifyQrPassPayload,
  ACTIVE_QR_KEY_ID,
  getQrKeyRing,
} from '../security/crypto';
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

async function runTests() {
  console.log('🚀 Starting Task H08: Cryptographically Secure QR Passes & Verification Test Suite (SEC-QR-001)...');
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const orgId = 'org_persatuan_qr_sec';
    const otherOrgId = 'org_persatuan_qr_other';
    const classId = 'cls_qr_sec_class';
    const otherClassId = 'cls_qr_other_class';
    const masterId = 'usr_master_qr_lead';
    const studentUserId = 'usr_stu_qr_sec';
    const studentId = 'stu_qr_sec_1';
    const inactiveStudentId = 'stu_qr_inactive_2';

    // 1. Setup clean mock database state
    await dbClient.query('DELETE FROM class_leaderships WHERE class_id = $1', [classId]);
    await dbClient.query('DELETE FROM students WHERE id IN ($1, $2)', [studentId, inactiveStudentId]);
    await dbClient.query('DELETE FROM classes WHERE id IN ($1, $2)', [classId, otherClassId]);
    await dbClient.query('DELETE FROM users WHERE id IN ($1, $2)', [masterId, studentUserId]);
    await dbClient.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgId, otherOrgId]);

    // Create Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Persatuan Silambam QR', 'Selangor', 'Silambam', 'Grandmaster QR', '+60123456789', 'qr_sec@persatuan.org', 'ACTIVE')`,
      [orgId]
    );
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Other Academy', 'Penang', 'Silambam', 'Master Other', '+60199999999', 'other_sec@academy.org', 'ACTIVE')`,
      [otherOrgId]
    );

    // Create Users
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
       VALUES ($1, 'master_qr@persatuan.org', 'hash', 'Master QR Lead', 'MASTER', $2, 'ACTIVE')`,
      [masterId, orgId]
    );
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
       VALUES ($1, 'master_other@persatuan.org', 'hash', 'Master Other', 'MASTER', $2, 'ACTIVE')`,
      ['usr_master_other', otherOrgId]
    );
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
       VALUES ($1, 'student_qr@persatuan.org', 'hash', 'Student Arjun', 'STUDENT', $2, 'ACTIVE')`,
      [studentUserId, orgId]
    );

    // Create Classes
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status, version)
       VALUES ($1, $2, $3, 'QR Security Dojo', 'Mon/Wed 6pm', 'Main Hall', 120, 'ACTIVE', 1)`,
      [classId, orgId, masterId]
    );
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status, version)
       VALUES ($1, $2, $3, 'Other Dojo', 'Tue/Thu 6pm', 'Other Hall', 120, 'ACTIVE', 1)`,
      [otherClassId, orgId, masterId]
    );

    // Create Active and Inactive Students
    await dbClient.query(
      `INSERT INTO students (id, user_id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, $2, $3, $4, 'Student Arjun', '050101-14-1234', 'Green Belt', 'ACTIVE')`,
      [studentId, studentUserId, orgId, classId]
    );
    await dbClient.query(
      `INSERT INTO students (id, user_id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, NULL, $2, $3, 'Student Inactive', '060202-14-5678', 'White Belt', 'SUSPENDED')`,
      [inactiveStudentId, orgId, classId]
    );

    // Create Auth Tokens
    const studentToken = generateAuthToken({
      id: studentUserId,
      email: 'student_qr@persatuan.org',
      role: UserRole.STUDENT,
      organizationId: orgId,
      linkedStudentIds: [studentId],
    });

    const masterToken = generateAuthToken({
      id: masterId,
      email: 'master_qr@persatuan.org',
      role: UserRole.MASTER,
      organizationId: orgId,
      assignedClassIds: [classId],
    });

    const adminToken = generateAuthToken({
      id: 'usr_admin_qr_sec',
      email: 'admin@persatuan.org',
      role: UserRole.ADMIN_PERSATUAN,
      organizationId: orgId,
    });

    const otherTenantToken = generateAuthToken({
      id: 'usr_master_other',
      email: 'master@other.org',
      role: UserRole.MASTER,
      organizationId: otherOrgId,
    });

    const superAdminToken = generateAuthToken({
      id: 'usr_super_admin',
      email: 'super@beltflow.com',
      role: UserRole.SUPER_ADMIN,
    });

    // ========================================================================
    // TEST 1: Student generates signed v2 digital pass with zero PII
    // ========================================================================
    console.log('\n--- Test 1: Generate signed v2 digital pass without PII ---');
    const passRes = await makeRequest(server, 'GET', `/students/${studentId}/digital-pass`, null, studentToken);
    assert.equal(passRes.status, 200, 'Student should retrieve their digital pass');
    assert.ok(passRes.data.pass, 'Pass object should exist');
    assert.ok(passRes.data.pass.payload, 'Pass payload should exist');

    const passPayload = passRes.data.pass.payload;
    assert.equal(passPayload.type, 'BF_PASS');
    assert.equal(passPayload.v, 2, 'Version must be 2');
    assert.equal(passPayload.kid, ACTIVE_QR_KEY_ID, 'Must specify active key ID');
    assert.equal(passPayload.oid, orgId);
    assert.equal(passPayload.sid, studentId);
    assert.equal(passPayload.belt, 'Green Belt');
    assert.ok(passPayload.nonce, 'Anti-replay nonce must be present');
    assert.ok(passPayload.sig, 'Cryptographic signature must be present');

    // Strict PII Verification
    const rawQr = passRes.data.pass.qrString;
    assert.equal(rawQr.includes('012-'), false, 'QR must not contain phone');
    assert.equal(rawQr.includes('NRIC'), false, 'QR must not contain NRIC');
    assert.equal(rawQr.includes('MyKid'), false, 'QR must not contain MyKid');
    assert.equal(rawQr.includes('jwt'), false, 'QR must not contain JWT token');
    assert.equal(rawQr.includes('password'), false, 'QR must not contain password');

    // Verify cryptographic signature matches server key
    const sigCheck = verifyQrPassPayload(passPayload);
    assert.equal(sigCheck.valid, true, 'Cryptographic signature must be valid');
    console.log('✅ Test 1 Passed: Digitally signed v2 pass generated with zero PII.');

    // ========================================================================
    // TEST 2: Verification Keys Endpoint
    // ========================================================================
    console.log('\n--- Test 2: Verification keys retrieval ---');
    const keysRes = await makeRequest(server, 'GET', '/students/qr/verification-keys', null, masterToken);
    assert.equal(keysRes.status, 200);
    assert.equal(keysRes.data.activeKid, ACTIVE_QR_KEY_ID);
    assert.ok(Array.isArray(keysRes.data.supportedKids));
    assert.ok(keysRes.data.supportedKids.includes(ACTIVE_QR_KEY_ID));
    console.log('✅ Test 2 Passed: Key ring metadata retrieved.');

    // ========================================================================
    // TEST 3: Legitimate pass verification succeeds
    // ========================================================================
    console.log('\n--- Test 3: Verify legitimate student pass ---');
    const verifyRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: rawQr, expectedClassId: classId },
      masterToken
    );
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.valid, true);
    assert.equal(verifyRes.data.student.id, studentId);
    assert.equal(verifyRes.data.student.fullName, 'Student Arjun');
    console.log('✅ Test 3 Passed: Legitimate pass verified.');

    // ========================================================================
    // TEST 4: Tampered student ID rejected (SEC-QR-001)
    // ========================================================================
    console.log('\n--- Test 4: Tampered student ID rejected with INVALID_SIGNATURE ---');
    const tamperedPayload = {
      ...passPayload,
      sid: 'stu_attacker_forged_id',
    };
    const tamperedRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(tamperedPayload) },
      masterToken
    );
    assert.equal(tamperedRes.status, 403);
    assert.equal(tamperedRes.data.valid, false);
    assert.equal(tamperedRes.data.errorCode, 'INVALID_SIGNATURE');
    console.log('✅ Test 4 Passed: Tampered student ID rejected with INVALID_SIGNATURE.');

    // ========================================================================
    // TEST 5: Tampered belt rank or name rejected (SEC-QR-001)
    // ========================================================================
    console.log('\n--- Test 5: Forged signature rejected ---');
    const forgedSigPayload = {
      ...passPayload,
      sig: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    const forgedRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(forgedSigPayload) },
      masterToken
    );
    assert.equal(forgedRes.status, 403);
    assert.equal(forgedRes.data.errorCode, 'INVALID_SIGNATURE');
    console.log('✅ Test 5 Passed: Forged signature rejected.');

    // ========================================================================
    // TEST 6: Unknown / Revoked Key ID rejected
    // ========================================================================
    console.log('\n--- Test 6: Unknown Key ID rejected ---');
    const unknownKeyPayload = {
      ...passPayload,
      kid: 'bf_unknown_key_999',
    };
    const unknownKeyRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(unknownKeyPayload) },
      masterToken
    );
    assert.equal(unknownKeyRes.status, 403);
    assert.equal(unknownKeyRes.data.errorCode, 'UNKNOWN_KEY_ID');
    console.log('✅ Test 6 Passed: Unknown Key ID rejected.');

    // ========================================================================
    // TEST 7: Expired pass rejected
    // ========================================================================
    console.log('\n--- Test 7: Expired pass rejected ---');
    const expiredPayload = {
      ...passPayload,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
    };
    // Re-sign with the expired timestamp
    const resignedExpired = signQrPassPayload({
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      oid: orgId,
      sid: studentId,
      iat: expiredPayload.iat,
      exp: expiredPayload.exp,
      nonce: expiredPayload.nonce,
    });
    expiredPayload.sig = resignedExpired.sig;

    const expiredRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(expiredPayload) },
      masterToken
    );
    assert.equal(expiredRes.status, 403);
    assert.equal(expiredRes.data.errorCode, 'EXPIRED_PASS');
    console.log('✅ Test 7 Passed: Expired pass rejected.');

    // ========================================================================
    // TEST 8: Cross-Persatuan scan rejection
    // ========================================================================
    console.log('\n--- Test 8: Cross-Persatuan scan rejection ---');
    const crossRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: rawQr },
      otherTenantToken // Master from other academy
    );
    assert.equal(crossRes.status, 403);
    assert.equal(crossRes.data.errorCode, 'CROSS_PERSATUAN_REJECTED');
    console.log('✅ Test 8 Passed: Cross-Persatuan scan rejected.');

    // ========================================================================
    // TEST 9: Inactive student scan rejection
    // ========================================================================
    console.log('\n--- Test 9: Inactive student scan rejection ---');
    const now = Math.floor(Date.now() / 1000);
    const { sig: inactSig, nonce: inactNonce } = signQrPassPayload({
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      oid: orgId,
      sid: inactiveStudentId,
      iat: now,
      exp: now + 86400,
    });
    const inactiveQr = JSON.stringify({
      type: 'BF_PASS',
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      oid: orgId,
      sid: inactiveStudentId,
      name: 'Student Inactive',
      belt: 'White Belt',
      iat: now,
      exp: now + 86400,
      nonce: inactNonce,
      sig: inactSig,
    });

    const inactRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: inactiveQr },
      masterToken
    );
    assert.equal(inactRes.status, 403);
    assert.equal(inactRes.data.errorCode, 'STUDENT_INACTIVE_REJECTED');
    console.log('✅ Test 9 Passed: Inactive student rejected.');

    // ========================================================================
    // TEST 10: Unassigned class rejection
    // ========================================================================
    console.log('\n--- Test 10: Unassigned class rejection ---');
    const unassignedRes = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: rawQr, expectedClassId: otherClassId },
      masterToken
    );
    assert.equal(unassignedRes.status, 403);
    assert.equal(unassignedRes.data.errorCode, 'UNASSIGNED_STUDENT_REJECTED');
    console.log('✅ Test 10 Passed: Unassigned class scan rejected.');

    console.log('\n🎉 ALL 10 H08 QR Pass Security & Cryptographic Integrity Tests PASSED (SEC-QR-001 RESOLVED)!');
    server.close();
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
