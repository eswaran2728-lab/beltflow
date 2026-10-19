import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken, resetEd25519KeyRingForTesting, getQrEd25519Seed } from '../security/crypto';
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
  console.log('🥋 Starting Task H12: Belt Grading, Student Readiness, Progression & Certificate Verification Tests...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const orgIdA = 'org_persatuan_grading_a';
    const orgIdB = 'org_persatuan_grading_b';

    // Seed test organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Persatuan Silambam A', 'Selangor', 'Silambam', 'Master Arumugam', '0123456789', 'admin@persatuan-a.org'),
              ($2, 'Persatuan Silambam B', 'Kuala Lumpur', 'Silambam', 'Master Bala', '0198765432', 'admin@persatuan-b.org')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [orgIdA, orgIdB]
    );

    // Seed users
    const classIdA = 'cls_silambam_junior';
    const student1Id = 'stu_dinesh_ga1';
    const student2InactiveId = 'stu_inactive_ga2';

    const masterA = { id: 'usr_master_ga', organizationId: orgIdA, email: 'master@a.org', role: UserRole.MASTER, assignedClassIds: [classIdA] };
    const masterB = { id: 'usr_master_gb', organizationId: orgIdB, email: 'master@b.org', role: UserRole.MASTER, assignedClassIds: [] };
    const adminA = { id: 'usr_admin_ga', organizationId: orgIdA, email: 'admin@a.org', role: UserRole.ADMIN_PERSATUAN };
    const parentA = { id: 'usr_parent_ga', organizationId: orgIdA, email: 'parent@a.org', role: UserRole.PARENT, linkedStudentIds: [student1Id] };
    const unrelatedParent = { id: 'usr_parent_unrelated', organizationId: orgIdA, email: 'stranger@a.org', role: UserRole.PARENT, linkedStudentIds: [] };
    const studentUser = { id: 'usr_student_ga', organizationId: orgIdA, email: 'student@a.org', role: UserRole.STUDENT };

    const tokenMasterA = generateAuthToken(masterA);
    const tokenMasterB = generateAuthToken(masterB);
    const tokenAdminA = generateAuthToken(adminA);
    const tokenParentA = generateAuthToken(parentA);
    const tokenUnrelatedParent = generateAuthToken(unrelatedParent);
    const tokenStudent = generateAuthToken(studentUser);

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, full_name, password_hash, role, status)
       VALUES ($1, $2, $3, 'Master Arumugam', 'hash123', 'MASTER', 'ACTIVE'),
              ($4, $5, $6, 'Master Bala', 'hash123', 'MASTER', 'ACTIVE'),
              ($7, $2, $8, 'Admin Aminah', 'hash123', 'ADMIN_PERSATUAN', 'ACTIVE'),
              ($9, $2, $10, 'Parent Priya', 'hash123', 'PARENT', 'ACTIVE'),
              ($11, $2, $12, 'Parent Unrelated', 'hash123', 'PARENT', 'ACTIVE'),
              ($13, $2, $14, 'Student Dinesh', 'hash123', 'STUDENT', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [
        masterA.id, orgIdA, masterA.email,
        masterB.id, orgIdB, masterB.email,
        adminA.id, adminA.email,
        parentA.id, parentA.email,
        unrelatedParent.id, unrelatedParent.email,
        studentUser.id, studentUser.email,
      ]
    );

    // Seed master affiliation
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status)
       VALUES ('maf_ga', $1, $2, 'APPROVED')
       ON CONFLICT (id) DO NOTHING`,
      [masterA.id, orgIdA]
    );

    // Seed class
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, master_id)
       VALUES ($1, $2, 'Junior Silambam Dojo', 'Sat/Sun 9am', 'Main Hall', 80.00, $3)
       ON CONFLICT (id) DO UPDATE SET master_id = EXCLUDED.master_id`,
      [classIdA, orgIdA, masterA.id]
    );

    // Seed class leadership
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active)
       VALUES ('ldr_ga', $1, $2, $3, 'PRIMARY', TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [classIdA, masterA.id, orgIdA]
    );

    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, full_name, ic_number, class_id, belt_rank, status)
       VALUES ($1, $2, $3, 'Dinesh Kumar', '080101-10-1234', $4, 'White Belt', 'ACTIVE'),
              ($5, $2, NULL, 'Suresh Rao', '090202-14-5678', $4, 'White Belt', 'INACTIVE')
       ON CONFLICT (id) DO UPDATE SET belt_rank = 'White Belt', status = EXCLUDED.status`,
      [student1Id, orgIdA, studentUser.id, classIdA, student2InactiveId]
    );

    // Clean up test records from any previous runs
    await dbClient.query('DELETE FROM parent_student_links WHERE student_id IN ($1, $2)', [student1Id, student2InactiveId]);
    await dbClient.query('DELETE FROM grading_candidates WHERE student_id IN ($1, $2)', [student1Id, student2InactiveId]);
    await dbClient.query('DELETE FROM certificates WHERE student_id IN ($1, $2)', [student1Id, student2InactiveId]);
    await dbClient.query('DELETE FROM student_rank_history WHERE student_id IN ($1, $2)', [student1Id, student2InactiveId]);
    await dbClient.query('DELETE FROM student_skills WHERE student_id IN ($1, $2)', [student1Id, student2InactiveId]);
    await dbClient.query('DELETE FROM session_attendance WHERE student_id IN ($1, $2)', [student1Id, student2InactiveId]);
    await dbClient.query('DELETE FROM grading_events WHERE organization_id = $1', [orgIdA]);

    // Insert active parent-student link
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_h12_ga', $1, $2, 'ACTIVE', TRUE, TRUE, TRUE)
       ON CONFLICT (parent_id, student_id) DO UPDATE SET status = 'ACTIVE', student_approved = TRUE, master_approved = TRUE, admin_approved = TRUE`,
      [parentA.id, student1Id]
    );

    // ------------------------------------------------------------------------
    // Test 1: Production QR Signing Key Entropy & Safety Guard
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Production QR Signing Key Entropy & Safety Guard ---');
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      resetEd25519KeyRingForTesting();

      // In production, missing seed or default dev seed must throw fatal error
      assert.throws(
        () => {
          getQrEd25519Seed('TEST_UNSET_SEED', 'beltflow_ed25519_primary_seed_phase2_2026');
        },
        /FATAL SECURITY CONFIGURATION/,
        'Production must reject unset or missing private seed.'
      );

      // Low entropy (< 32 chars) must throw fatal error
      process.env.TEST_LOW_ENTROPY = 'too_short';
      assert.throws(
        () => {
          getQrEd25519Seed('TEST_LOW_ENTROPY', 'beltflow_ed25519_primary_seed_phase2_2026');
        },
        /FATAL SECURITY CONFIGURATION/,
        'Production must reject low-entropy seed (< 32 chars).'
      );
      delete process.env.TEST_LOW_ENTROPY;
    } finally {
      process.env.NODE_ENV = prevEnv;
      resetEd25519KeyRingForTesting();
    }
    console.log('✅ Requirement 1 Passed: Production QR signing key entropy & safety guard strictly enforced.');

    // ------------------------------------------------------------------------
    // Test 2: Active Persatuan Curriculum & Rank Hierarchy
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Active Persatuan Curriculum & Rank Hierarchy ---');
    const currRes = await makeRequest(server, 'GET', '/curriculums/active', undefined, tokenMasterA);
    assert.equal(currRes.status, 200, 'Should return active published curriculum');
    assert.ok(currRes.data.curriculum.id, 'Curriculum ID should exist');
    assert.ok(Array.isArray(currRes.data.ranks), 'Curriculum should have ranks array');
    assert.ok(currRes.data.ranks.length >= 8, 'Curriculum should have at least 8 ranks');
    const activeCurriculumId = currRes.data.curriculum.id;
    const yellowRank = currRes.data.ranks.find((r: any) => r.name === 'Yellow Belt');
    assert.ok(yellowRank, 'Yellow Belt rank should exist in curriculum');
    console.log(`✅ Requirement 2 Passed: Active curriculum retrieved (${currRes.data.ranks.length} ranks).`);

    // ------------------------------------------------------------------------
    // Test 3: Student Readiness Passport Calculation (Advisory)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Student Readiness Passport Calculation ---');
    const readinessRes1 = await makeRequest(server, 'GET', `/grading/readiness/${student1Id}`, undefined, tokenMasterA);
    assert.equal(readinessRes1.status, 200, 'Master should fetch student readiness');
    assert.equal(readinessRes1.data.currentBelt, 'White Belt');
    assert.equal(readinessRes1.data.nextEligibleBelt.name, 'Yellow Belt');
    assert.equal(readinessRes1.data.eligibilityStatus, 'NOT YET ELIGIBLE');
    assert.ok(readinessRes1.data.requirements.minSessions > 0, 'Min sessions required');
    console.log('✅ Requirement 3 Passed: Initial readiness shows NOT YET ELIGIBLE.');

    // ------------------------------------------------------------------------
    // Test 4: Unauthorized Master Denied from Readiness Passport
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Cross-Persatuan / Unassigned Master Denied Readiness ---');
    const unauthReadiness = await makeRequest(server, 'GET', `/grading/readiness/${student1Id}`, undefined, tokenMasterB);
    assert.equal(unauthReadiness.status, 403, 'Cross-org Master must be forbidden from student readiness');
    console.log('✅ Requirement 4 Passed: Cross-tenant readiness query safely blocked.');

    // ------------------------------------------------------------------------
    // Test 5: Master Records Structured Skill Assessment
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Master Records Structured Skill Assessment ---');
    const assessRes = await makeRequest(
      server,
      'POST',
      '/skills/assess',
      {
        studentId: student1Id,
        skillId: 'skl_silambam_stance_01',
        skillName: 'Basic Footwork & Stances',
        category: 'Footwork',
        level: 'Proficient',
        criteria: {
          technique: 5,
          power: 4,
          speed: 4,
          balance: 5,
          discipline: 5,
        },
        notes: 'Demonstrates clean footwork and balanced transitions.',
      },
      tokenMasterA
    );
    assert.equal(assessRes.status, 200, 'Master should record skill assessment');
    assert.equal(assessRes.data.assessment.level, 'Proficient');

    // Student role cannot record assessments
    const studentAssessRes = await makeRequest(
      server,
      'POST',
      '/skills/assess',
      {
        studentId: student1Id,
        skillId: 'skl_forged',
        level: 'Mastered',
      },
      tokenStudent
    );
    assert.equal(studentAssessRes.status, 403, 'Student cannot self-award skills');
    console.log('✅ Requirement 5 Passed: Structured skill assessment recorded; student self-award rejected.');

    // ------------------------------------------------------------------------
    // Test 6: Persatuan Admin Creates Grading Event
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Persatuan Admin Creates Official Grading Event ---');
    const eventRes = await makeRequest(
      server,
      'POST',
      '/grading',
      {
        organizationId: orgIdA,
        title: 'Spring 2026 Belt Promotion Examination',
        eventDate: '2026-04-15',
        location: 'Dojo Main Hall',
        fee: 60.00,
        curriculumId: activeCurriculumId,
        chiefExaminerId: masterA.id,
        status: 'REGISTRATION_OPEN',
      },
      tokenAdminA
    );
    assert.equal(eventRes.status, 201, 'Admin should create grading event');
    const eventId = eventRes.data.event.id;
    assert.ok(eventId, 'Event ID generated');
    assert.equal(eventRes.data.event.status, 'REGISTRATION_OPEN');
    console.log(`✅ Requirement 6 Passed: Grading event created (${eventId}).`);

    // ------------------------------------------------------------------------
    // Test 7: Candidate Nomination & Eligibility Validation
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Candidate Nomination & Eligibility Validation ---');
    const nomRes = await makeRequest(
      server,
      'POST',
      `/grading/${eventId}/nominate`,
      {
        studentId: student1Id,
        targetBelt: 'Yellow Belt',
        notes: 'Master recommendation based on diligence and skill.',
      },
      tokenMasterA
    );
    assert.equal(nomRes.status, 201, 'Assigned Master should nominate student');
    assert.equal(nomRes.data.candidate.result, 'Nominated');

    // Duplicate nomination prevention
    const dupNomRes = await makeRequest(
      server,
      'POST',
      `/grading/${eventId}/nominate`,
      {
        studentId: student1Id,
        targetBelt: 'Yellow Belt',
      },
      tokenMasterA
    );
    assert.equal(dupNomRes.status, 409, 'Duplicate candidate nomination must be rejected');

    // Inactive student rejection
    const inactiveNomRes = await makeRequest(
      server,
      'POST',
      `/grading/${eventId}/nominate`,
      {
        studentId: student2InactiveId,
        targetBelt: 'Yellow Belt',
      },
      tokenMasterA
    );
    assert.equal(inactiveNomRes.status, 400, 'Inactive student must be rejected from nomination');
    assert.ok(inactiveNomRes.data.error.includes('INACTIVE'), 'Error mentions inactive membership');
    console.log('✅ Requirement 7 Passed: Valid nomination accepted; duplicates and inactive students rejected.');

    // ------------------------------------------------------------------------
    // Test 8: Final Grading Atomic Transaction & Rank Progression
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Final Grading Atomic Transaction & Rank Progression ---');
    const finalizeRes = await makeRequest(
      server,
      'POST',
      `/grading/${eventId}/finalize`,
      {
        expectedVersion: 1,
        results: [
          {
            studentId: student1Id,
            result: 'Passed',
            targetBelt: 'Yellow Belt',
            examinerScore: 92.5,
            criteriaScores: { technique: 90, power: 95, accuracy: 92 },
            notes: 'Exemplary form and discipline.',
          },
        ],
      },
      tokenMasterA
    );
    assert.equal(finalizeRes.status, 200, 'Finalization should succeed');
    assert.ok(finalizeRes.data.issuedCertificates.length === 1, 'Certificate should be issued');
    const issuedCert = finalizeRes.data.issuedCertificates[0];
    assert.ok(issuedCert.code, 'Certificate code exists');
    assert.ok(issuedCert.verification_token, 'Certificate verification token exists');
    assert.equal(issuedCert.rank_or_title, 'Yellow Belt');

    // Verify student belt rank updated in DB
    const stuCheck = await dbClient.query('SELECT belt_rank FROM students WHERE id = $1', [student1Id]);
    assert.equal(stuCheck.rows[0].belt_rank, 'Yellow Belt', 'Student belt rank must be updated in DB');

    // Verify immutable rank history created
    const histCheck = await dbClient.query(
      'SELECT * FROM student_rank_history WHERE student_id = $1 AND rank_name = $2',
      [student1Id, 'Yellow Belt']
    );
    assert.equal(histCheck.rowCount, 1, 'student_rank_history record must be appended');
    assert.equal(histCheck.rows[0].certificate_number, issuedCert.code);

    // Verify event marked FINALIZED and version incremented
    const eventCheck = await dbClient.query('SELECT status, version FROM grading_events WHERE id = $1', [eventId]);
    assert.equal(eventCheck.rows[0].status, 'FINALIZED');
    assert.equal(eventCheck.rows[0].version, 2);

    // Stale version / already finalized event rejected
    const retryFinalize = await makeRequest(
      server,
      'POST',
      `/grading/${eventId}/finalize`,
      {
        expectedVersion: 1,
        results: [{ studentId: student1Id, result: 'Passed', targetBelt: 'Yellow Belt' }],
      },
      tokenMasterA
    );
    assert.equal(retryFinalize.status, 409, 'Re-finalizing a finalized event must be rejected with 409 Conflict');
    console.log('✅ Requirement 8 Passed: Atomic grading finalization updated student, created history, and issued certificate.');

    // ------------------------------------------------------------------------
    // Test 9: Public-Safe Certificate Verification (Fix CERT-001)
    // ------------------------------------------------------------------------
    console.log('\n--- 9. Public-Safe Certificate Verification (Fix CERT-001) ---');
    // Public user checks certificate WITHOUT ANY AUTH TOKEN
    const pubCheckByCode = await makeRequest(
      server,
      'POST',
      '/certificates/public-verify',
      { codeOrToken: issuedCert.code }
      // Zero auth token!
    );
    assert.equal(pubCheckByCode.status, 200, 'Public user should verify certificate by code without login');
    assert.equal(pubCheckByCode.data.verified, true);
    assert.equal(pubCheckByCode.data.status, 'VALID');
    assert.equal(pubCheckByCode.data.certificate.studentName, undefined, 'Public endpoint must not leak unmasked student name');
    assert.equal(pubCheckByCode.data.certificate.maskedStudentName, 'D****h K***r', 'Masked student name must be returned');
    assert.equal(pubCheckByCode.data.certificate.rankOrTitle, 'Yellow Belt');
    assert.equal(pubCheckByCode.data.certificate.organizationName, 'Persatuan Silambam A');

    // Zero sensitive PII check
    assert.equal((pubCheckByCode.data.certificate as any).ic_number, undefined, 'Must not leak IC');
    assert.equal((pubCheckByCode.data.certificate as any).phone, undefined, 'Must not leak phone');
    assert.equal((pubCheckByCode.data.certificate as any).dob, undefined, 'Must not leak DOB');
    assert.equal((pubCheckByCode.data.certificate as any).medical, undefined, 'Must not leak medical data');

    // Public user checks certificate by verification_token
    const pubCheckByToken = await makeRequest(
      server,
      'POST',
      '/certificates/public-verify',
      { codeOrToken: issuedCert.verification_token }
    );
    assert.equal(pubCheckByToken.status, 200, 'Public user should verify certificate by token');
    assert.equal(pubCheckByToken.data.certificate.code, issuedCert.code);

    // Non-existent certificate code
    const invalidCheck = await makeRequest(
      server,
      'POST',
      '/certificates/public-verify',
      { codeOrToken: 'BF-INVALID-9999' }
    );
    assert.equal(invalidCheck.status, 404, 'Invalid certificate must return 404');
    assert.equal(invalidCheck.data.verified, false);
    assert.equal(invalidCheck.data.status, 'NOT_FOUND');
    console.log('✅ Requirement 9 Passed: CERT-001 resolved (unauthenticated public verification succeeded with zero PII leaks).');

    // ------------------------------------------------------------------------
    // Test 10: Certificate Revocation Workflow & Verification Status Update
    // ------------------------------------------------------------------------
    console.log('\n--- 10. Certificate Revocation & Verification Status ---');
    const revokeRes = await makeRequest(
      server,
      'POST',
      `/certificates/${issuedCert.id}/revoke`,
      { reason: 'Administrative review: duplicate issuance correction.' },
      tokenAdminA
    );
    assert.equal(revokeRes.status, 200, 'Admin can revoke certificate');
    assert.equal(revokeRes.data.certificate.status, 'REVOKED');

    // Re-verify publicly after revocation
    const revokedPubCheck = await makeRequest(
      server,
      'POST',
      '/certificates/public-verify',
      { codeOrToken: issuedCert.code }
    );
    assert.equal(revokedPubCheck.status, 200);
    assert.equal(revokedPubCheck.data.verified, true);
    assert.equal(revokedPubCheck.data.status, 'REVOKED');
    assert.ok(revokedPubCheck.data.certificate.revocationReason.includes('duplicate issuance'), 'Revocation reason returned');
    console.log('✅ Requirement 10 Passed: Certificate revoked and verified as REVOKED.');

    // ------------------------------------------------------------------------
    // Test 11: Parent & Student Progress Visibility
    // ------------------------------------------------------------------------
    console.log('\n--- 11. Parent & Student Progress Visibility ---');
    // Linked parent views child progress
    const parentProgressRes = await makeRequest(
      server,
      'GET',
      `/students/${student1Id}/progress`,
      undefined,
      tokenParentA
    );
    assert.equal(parentProgressRes.status, 200, 'Linked parent should view child progress');
    assert.equal(parentProgressRes.data.currentBelt, 'Yellow Belt');
    assert.ok(parentProgressRes.data.rankHistory.length >= 1, 'Rank history included');

    // Unrelated parent denied access
    const unrelatedParentProgress = await makeRequest(
      server,
      'GET',
      `/students/${student1Id}/progress`,
      undefined,
      tokenUnrelatedParent
    );
    assert.equal(unrelatedParentProgress.status, 403, 'Unrelated parent must be denied from progress');
    console.log('✅ Requirement 11 Passed: Linked parent granted progress access; unrelated parent denied.');

    // ------------------------------------------------------------------------
    // Test 12: Rate Limiting & Enumeration Defense on Public Verification
    // ------------------------------------------------------------------------
    console.log('\n--- 12. Public Verification Rate Limiting & Enumeration Defense ---');
    const rateLimitHeaders = { 'X-Forwarded-For': '198.51.100.42' };
    let gotThrottled = false;

    // Send rapid consecutive requests from same IP
    for (let i = 0; i < 20; i++) {
      const res = await makeRequest(
        server,
        'POST',
        '/certificates/public-verify',
        { codeOrToken: `BF-GUESS-${i}` },
        undefined,
        rateLimitHeaders
      );
      if (res.status === 429) {
        gotThrottled = true;
        break;
      }
    }
    assert.ok(gotThrottled, 'Rapid repetitive attempts from same IP must be throttled with 429');
    console.log('✅ Requirement 12 Passed: Public verification rate limiting and enumeration defense active.');

    console.log('\n🎉 ALL TASK H12 BELT GRADING, READINESS, PROGRESSION & CERTIFICATE VERIFICATION TESTS PASSED!\n');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Task H12 Test Failure:', err);
  process.exit(1);
});
