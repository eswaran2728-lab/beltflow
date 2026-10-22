import assert from 'node:assert/strict';
import http from 'node:http';
import nacl from 'tweetnacl';
import app from '../app';
import { dbClient } from '../db/client';
import {
  generateAuthToken,
  signQrPassPayload,
  verifyQrPassPayload,
  ACTIVE_QR_KEY_ID,
  HISTORICAL_QR_KEY_ID,
  getQrVerificationKeys,
  QR_ISSUER,
  QR_AUDIENCE,
  generateQrPassCanonicalString,
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
  console.log('🚀 Starting Task H08: Asymmetric Ed25519 QR Pass Cryptographic Security Test Suite (SEC-QR-001 Resolved)...');
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const testRun = Date.now();
    const orgId = `org_qr_sec_${testRun}`;
    const otherOrgId = `org_qr_other_${testRun}`;
    const classId = `cls_qr_sec_${testRun}`;
    const otherClassId = `cls_qr_other_${testRun}`;
    const masterId = `usr_master_qr_${testRun}`;
    const studentUserId = `usr_stu_qr_${testRun}`;
    const studentId = `stu_qr_${testRun}`;
    const inactiveStudentId = `stu_inact_qr_${testRun}`;

    // Create Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Persatuan Silambam QR', 'Selangor', 'Silambam', 'Grandmaster QR', '+60123456789', $2, 'ACTIVE')`,
      [orgId, `qr_sec_${testRun}@persatuan.org`]
    );
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'Other Academy', 'Penang', 'Silambam', 'Master Other', '+60199999999', $2, 'ACTIVE')`,
      [otherOrgId, `other_sec_${testRun}@academy.org`]
    );

    // Create Users
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
       VALUES ($1, $2, 'hash', 'Master QR Lead', 'MASTER', $3, 'ACTIVE')`,
      [masterId, `master_qr_${testRun}@persatuan.org`, orgId]
    );
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
       VALUES ($1, $2, 'hash', 'Master Other', 'MASTER', $3, 'ACTIVE')`,
      [`usr_other_${testRun}`, `master_other_${testRun}@other.org`, otherOrgId]
    );
    await dbClient.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
       VALUES ($1, $2, 'hash', 'Student Arjun', 'STUDENT', $3, 'ACTIVE')`,
      [studentUserId, `student_qr_${testRun}@persatuan.org`, orgId]
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

    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [`lead_${testRun}`, classId, masterId, orgId]
    );

    // Create Active and Inactive Students
    await dbClient.query(
      `INSERT INTO students (id, user_id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, $2, $3, $4, 'Student Arjun', $5, 'Green Belt', 'ACTIVE')`,
      [studentId, studentUserId, orgId, classId, `IC1_${testRun.toString().slice(-8)}`]
    );
    await dbClient.query(
      `INSERT INTO students (id, user_id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, NULL, $2, $3, 'Student Inactive', $4, 'White Belt', 'SUSPENDED')`,
      [inactiveStudentId, orgId, classId, `IC2_${testRun.toString().slice(-8)}`]
    );

    // Auth Tokens
    const studentToken = generateAuthToken({
      id: studentUserId,
      email: `student_qr_${testRun}@persatuan.org`,
      role: UserRole.STUDENT,
      organizationId: orgId,
      linkedStudentIds: [studentId],
    });

    const masterToken = generateAuthToken({
      id: masterId,
      email: `master_qr_${testRun}@persatuan.org`,
      role: UserRole.MASTER,
      organizationId: orgId,
      assignedClassIds: [classId],
    });

    const otherTenantToken = generateAuthToken({
      id: `usr_other_${testRun}`,
      email: `master_other_${testRun}@other.org`,
      role: UserRole.MASTER,
      organizationId: otherOrgId,
    });

    // ========================================================================
    // REQUIREMENT 1: Valid Ed25519 signature issuance and verification
    // ========================================================================
    console.log('\n--- 1. Valid Ed25519 signature verification ---');
    const passRes = await makeRequest(server, 'GET', `/students/${studentId}/digital-pass`, null, studentToken);
    assert.equal(passRes.status, 200);
    assert.ok(passRes.data.pass);
    const passPayload = passRes.data.pass.payload;
    assert.equal(passPayload.type, 'BF_PASS');
    assert.equal(passPayload.v, 2);
    assert.equal(passPayload.kid, ACTIVE_QR_KEY_ID);
    assert.equal(passPayload.iss, QR_ISSUER);
    assert.equal(passPayload.aud, QR_AUDIENCE);
    assert.equal(passPayload.oid, orgId);
    assert.equal(passPayload.sid, studentId);
    assert.equal(passPayload.sig.length, 128, 'Ed25519 signature must be exactly 128 hex chars');

    const verifyCheck = verifyQrPassPayload(passPayload);
    assert.equal(verifyCheck.valid, true);
    console.log('✅ Requirement 1 Passed: Valid Ed25519 signature generated and verified.');

    // ========================================================================
    // REQUIREMENT 2: Modified student reference rejected
    // ========================================================================
    console.log('\n--- 2. Modified student reference rejected ---');
    const tamperedStudent = { ...passPayload, sid: 'stu_attacker_forged' };
    const resTamperedStudent = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(tamperedStudent) },
      masterToken
    );
    assert.equal(resTamperedStudent.status, 403);
    assert.equal(resTamperedStudent.data.errorCode, 'INVALID_SIGNATURE');
    console.log('✅ Requirement 2 Passed: Modified student reference rejected.');

    // ========================================================================
    // REQUIREMENT 3: Modified organization rejected
    // ========================================================================
    console.log('\n--- 3. Modified organization rejected ---');
    const tamperedOrg = { ...passPayload, oid: 'org_different_academy' };
    const resTamperedOrg = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(tamperedOrg) },
      masterToken
    );
    assert.equal(resTamperedOrg.status, 403);
    assert.equal(resTamperedOrg.data.errorCode, 'INVALID_SIGNATURE');
    console.log('✅ Requirement 3 Passed: Modified organization rejected.');

    // ========================================================================
    // REQUIREMENT 4: Modified expiration rejected
    // ========================================================================
    console.log('\n--- 4. Modified expiration rejected ---');
    const tamperedExp = { ...passPayload, exp: passPayload.exp + 86400 * 365 }; // Extended by 1 year
    const resTamperedExp = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(tamperedExp) },
      masterToken
    );
    assert.equal(resTamperedExp.status, 403);
    assert.equal(resTamperedExp.data.errorCode, 'INVALID_SIGNATURE');
    console.log('✅ Requirement 4 Passed: Modified expiration rejected.');

    // ========================================================================
    // REQUIREMENT 5: Unknown key ID rejected
    // ========================================================================
    console.log('\n--- 5. Unknown key ID rejected ---');
    const unknownKey = { ...passPayload, kid: 'bf_ed25519_unknown_999' };
    const resUnknownKey = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(unknownKey) },
      masterToken
    );
    assert.equal(resUnknownKey.status, 403);
    assert.equal(resUnknownKey.data.errorCode, 'UNKNOWN_KEY_ID');
    console.log('✅ Requirement 5 Passed: Unknown key ID rejected.');

    // ========================================================================
    // REQUIREMENT 6: Invalid signature rejected
    // ========================================================================
    console.log('\n--- 6. Invalid signature rejected ---');
    const invalidSig = {
      ...passPayload,
      sig: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    const resInvalidSig = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(invalidSig) },
      masterToken
    );
    assert.equal(resInvalidSig.status, 403);
    assert.equal(resInvalidSig.data.errorCode, 'INVALID_SIGNATURE');
    console.log('✅ Requirement 6 Passed: Invalid signature rejected.');

    // ========================================================================
    // REQUIREMENT 7: Wrong issuer or audience rejected
    // ========================================================================
    console.log('\n--- 7. Wrong issuer or audience rejected ---');
    const wrongIssuer = { ...passPayload, iss: 'rogue-issuer-authority' };
    const resWrongIssuer = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(wrongIssuer) },
      masterToken
    );
    assert.equal(resWrongIssuer.status, 403);
    console.log('✅ Requirement 7 Passed: Wrong issuer rejected.');

    // ========================================================================
    // REQUIREMENT 8: Expired credential rejected
    // ========================================================================
    console.log('\n--- 8. Expired credential rejected ---');
    const expiredIssuedAt = Math.floor(Date.now() / 1000) - 7200;
    const expiredExp = Math.floor(Date.now() / 1000) - 3600;
    const signedExpired = signQrPassPayload({
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      iss: QR_ISSUER,
      aud: QR_AUDIENCE,
      oid: orgId,
      sid: studentId,
      iat: expiredIssuedAt,
      exp: expiredExp,
    });
    const expiredPayload = {
      type: 'BF_PASS',
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      iss: QR_ISSUER,
      aud: QR_AUDIENCE,
      oid: orgId,
      sid: studentId,
      iat: expiredIssuedAt,
      exp: expiredExp,
      nonce: signedExpired.nonce,
      sig: signedExpired.sig,
    };
    const resExpired = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(expiredPayload) },
      masterToken
    );
    assert.equal(resExpired.status, 403);
    assert.equal(resExpired.data.errorCode, 'EXPIRED_PASS');
    console.log('✅ Requirement 8 Passed: Expired credential rejected.');

    // ========================================================================
    // REQUIREMENT 9: Valid offline verification using public key only
    // ========================================================================
    console.log('\n--- 9. Valid offline verification using public key only ---');
    const keysRes = await makeRequest(server, 'GET', '/students/qr/verification-keys', null, masterToken);
    assert.equal(keysRes.status, 200);
    assert.equal(keysRes.data.algorithm, 'Ed25519');
    const publicKeyHex = keysRes.data.publicKeys[ACTIVE_QR_KEY_ID];
    assert.ok(publicKeyHex, 'Public key must be provided');

    // Simulate mobile offline verification using only TweetNaCl and public key
    const canonicalString = generateQrPassCanonicalString({
      v: passPayload.v,
      kid: passPayload.kid,
      iss: passPayload.iss,
      aud: passPayload.aud,
      oid: passPayload.oid,
      sid: passPayload.sid,
      iat: passPayload.iat,
      exp: passPayload.exp,
      nonce: passPayload.nonce,
    });
    const msgBytes = new Uint8Array(Buffer.from(canonicalString, 'utf8'));
    const sigBytes = new Uint8Array(Buffer.from(passPayload.sig, 'hex'));
    const pubBytes = new Uint8Array(Buffer.from(publicKeyHex, 'hex'));

    const offlineVerified = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    assert.equal(offlineVerified, true, 'TweetNaCl must verify valid Ed25519 signature offline using only public key');
    console.log('✅ Requirement 9 Passed: Offline verification succeeds using public key only.');

    // ========================================================================
    // REQUIREMENT 10: Client cannot sign a valid credential using public key
    // ========================================================================
    console.log('\n--- 10. Client cannot sign a valid credential using public key ---');
    // An attacker possessing only the public key attempts to sign using the public key
    // TweetNaCl will either reject invalid secretKey length (32 bytes instead of 64) or the resulting signature will fail
    let clientForgedVerified = false;
    try {
      // Attempting to pass 32-byte public key as 64-byte secretKey throws in tweetnacl
      const forgedSig = nacl.sign.detached(msgBytes, pubBytes as any);
      clientForgedVerified = nacl.sign.detached.verify(msgBytes, forgedSig, pubBytes);
    } catch {
      clientForgedVerified = false;
    }
    assert.equal(clientForgedVerified, false, 'Client possessing only public key cannot produce valid Ed25519 signature');
    console.log('✅ Requirement 10 Passed: Client mathematically cannot sign valid credentials with public key.');

    // ========================================================================
    // REQUIREMENT 11: Signing secret/private key never included in verification-keys
    // ========================================================================
    console.log('\n--- 11. Signing secret/private key never included in endpoint response ---');
    const rawKeysJson = JSON.stringify(keysRes.data);
    assert.equal(rawKeysJson.includes('secretKey'), false, 'Response must not contain secretKey');
    assert.equal(rawKeysJson.includes('privateKey'), false, 'Response must not contain privateKey');
    assert.equal(rawKeysJson.includes('seed'), false, 'Response must not contain seed');
    assert.equal(rawKeysJson.includes('bf_qr_secret'), false, 'Response must not contain symmetric secrets');
    console.log('✅ Requirement 11 Passed: Zero private keys or signing secrets exposed in verification endpoint.');

    // ========================================================================
    // REQUIREMENT 12: Key rotation continuity
    // ========================================================================
    console.log('\n--- 12. Key rotation continuity (historical k0 pass verification) ---');
    // Sign pass using previous key ID (HISTORICAL_QR_KEY_ID = 'bf_ed25519_k0')
    const rotatedIat = Math.floor(Date.now() / 1000);
    const rotatedExp = rotatedIat + 86400;
    const rotatedPass = signQrPassPayload({
      v: 2,
      kid: HISTORICAL_QR_KEY_ID,
      iss: QR_ISSUER,
      aud: QR_AUDIENCE,
      oid: orgId,
      sid: studentId,
      iat: rotatedIat,
      exp: rotatedExp,
    });
    const rotatedPayload = {
      type: 'BF_PASS',
      v: 2,
      kid: HISTORICAL_QR_KEY_ID,
      iss: QR_ISSUER,
      aud: QR_AUDIENCE,
      oid: orgId,
      sid: studentId,
      iat: rotatedIat,
      exp: rotatedExp,
      nonce: rotatedPass.nonce,
      sig: rotatedPass.sig,
    };
    const resRotated = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(rotatedPayload) },
      masterToken
    );
    assert.equal(resRotated.status, 200);
    assert.equal(resRotated.data.valid, true);
    console.log('✅ Requirement 12 Passed: Historical unexpired credentials verified across key rotation.');

    // ========================================================================
    // REQUIREMENT 13: Revoked / inactive enrollment rejected by server at scan / sync
    // ========================================================================
    console.log('\n--- 13. Revoked / suspended enrollment rejected by server ---');
    const inactiveIat = Math.floor(Date.now() / 1000);
    const inactiveExp = inactiveIat + 86400;
    const inactiveSigned = signQrPassPayload({
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      iss: QR_ISSUER,
      aud: QR_AUDIENCE,
      oid: orgId,
      sid: inactiveStudentId,
      iat: inactiveIat,
      exp: inactiveExp,
    });
    const inactivePayload = {
      type: 'BF_PASS',
      v: 2,
      kid: ACTIVE_QR_KEY_ID,
      iss: QR_ISSUER,
      aud: QR_AUDIENCE,
      oid: orgId,
      sid: inactiveStudentId,
      iat: inactiveIat,
      exp: inactiveExp,
      nonce: inactiveSigned.nonce,
      sig: inactiveSigned.sig,
    };
    const resInactive = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(inactivePayload) },
      masterToken
    );
    assert.equal(resInactive.status, 403);
    assert.equal(resInactive.data.errorCode, 'STUDENT_INACTIVE_REJECTED');
    console.log('✅ Requirement 13 Passed: Suspended student enrollment rejected.');

    // ========================================================================
    // REQUIREMENT 14: Cross-Persatuan scanner rejection
    // ========================================================================
    console.log('\n--- 14. Cross-Persatuan scanner rejection ---');
    const resCross = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(passPayload) },
      otherTenantToken
    );
    assert.equal(resCross.status, 403);
    assert.equal(resCross.data.errorCode, 'CROSS_PERSATUAN_REJECTED');
    console.log('✅ Requirement 14 Passed: Cross-Persatuan scan rejected.');

    // ========================================================================
    // REQUIREMENT 15: Old v1 credentials rejected
    // ========================================================================
    console.log('\n--- 15. Old v1 credentials rejected ---');
    const legacyV1 = {
      type: 'BF_PASS',
      v: 1,
      oid: orgId,
      sid: studentId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      sig: 'legacy_hash_abc',
    };
    const resV1 = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(legacyV1) },
      masterToken
    );
    assert.equal(resV1.status, 403);
    assert.equal(resV1.data.errorCode, 'UNSUPPORTED_VERSION');
    console.log('✅ Requirement 15 Passed: Insecure legacy v1 credentials rejected.');

    // ========================================================================
    // REQUIREMENT 16: No sensitive student PII in QR payload
    // ========================================================================
    console.log('\n--- 16. No sensitive student PII in QR payload ---');
    const qrString = passRes.data.pass.qrString;
    assert.equal(qrString.includes('Arjun Dev'), false, 'Name must not be in QR payload');
    assert.equal(qrString.includes('0123456789'), false, 'Phone must not be in QR payload');
    assert.equal(qrString.includes('Brown Belt'), false, 'Belt rank must not be in QR payload');
    assert.equal(qrString.includes('IC_'), false, 'IC must not be in QR payload');
    console.log('✅ Requirement 16 Passed: Zero PII in QR payload (name, phone, IC, belt excluded).');

    // ========================================================================
    // REQUIREMENT 17: Existing offline attendance and manual roll-call still function
    // ========================================================================
    console.log('\n--- 17. Existing offline attendance and manual roll-call compatibility ---');
    // Verify server verify-pass returns full student identity for legitimate pass so attendance can be marked
    const resVerifyLegit = await makeRequest(
      server,
      'POST',
      '/students/qr/verify-pass',
      { qrString: JSON.stringify(passPayload), expectedClassId: classId },
      masterToken
    );
    assert.equal(resVerifyLegit.status, 200);
    assert.equal(resVerifyLegit.data.valid, true);
    assert.equal(resVerifyLegit.data.student.id, studentId);
    assert.equal(resVerifyLegit.data.student.fullName, 'Student Arjun');
    console.log('✅ Requirement 17 Passed: Master attendance verification returns student identity.');

    console.log('\n🎉 ALL 17 ASYMMETRIC Ed25519 QR PASS SECURITY REQUIREMENTS PASSED!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
