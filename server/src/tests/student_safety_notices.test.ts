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
  console.log('🧪 Starting Task H11: Student Safety, Consent, Notices & Acknowledgements Integration Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const testRun = Date.now();
    const orgId = `org_safe_${testRun}`;
    const otherOrgId = `org_other_${testRun}`;
    const masterId = `usr_master_${testRun}`;
    const otherMasterId = `usr_other_master_${testRun}`;
    const parentUserId = `usr_parent_${testRun}`;
    const unrelatedParentId = `usr_unrelated_parent_${testRun}`;
    const student1Id = `stu_safe1_${testRun}`;
    const student2Id = `stu_safe2_${testRun}`;
    const classId = `cls_safe_${testRun}`;
    const otherClassId = `cls_other_${testRun}`;

    // 1. Seed Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, sibling_discount_percent, status)
       VALUES ($1, 'Klang Silambam Academy', 'Selangor', 'Silambam', 'Master Guru', '0123456789', $2, 120, 10, 'ACTIVE'),
              ($3, 'Penang Wushu Academy', 'Penang', 'Wushu', 'Master Tan', '0198765432', $4, 150, 10, 'ACTIVE')`,
      [orgId, `org_safe_${testRun}@beltflow.test`, otherOrgId, `org_other_${testRun}@beltflow.test`]
    );

    // 2. Seed Users
    const masterUser = { id: masterId, organizationId: orgId, email: `master_${testRun}@beltflow.test`, role: UserRole.MASTER, assignedClassIds: [classId] };
    const otherMasterUser = { id: otherMasterId, organizationId: orgId, email: `other_master_${testRun}@beltflow.test`, role: UserRole.MASTER, assignedClassIds: [otherClassId] };
    const parentUser = { id: parentUserId, organizationId: orgId, email: `parent_${testRun}@beltflow.test`, role: UserRole.PARENT, linkedStudentIds: [student1Id] };
    const unrelatedParentUser = { id: unrelatedParentId, organizationId: orgId, email: `unrelated_${testRun}@beltflow.test`, role: UserRole.PARENT, linkedStudentIds: [] };
    const superAdminUser = { id: `super_${testRun}`, email: `super_${testRun}@beltflow.test`, role: UserRole.SUPER_ADMIN };
    const crossOrgMasterUser = { id: `usr_cross_${testRun}`, organizationId: otherOrgId, email: `cross_${testRun}@beltflow.test`, role: UserRole.MASTER, assignedClassIds: [] };

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'hash', 'Master Kumar', 'MASTER', 'ACTIVE'),
              ($4, $5, $6, 'hash', 'Master Wong', 'MASTER', 'ACTIVE'),
              ($7, $8, $9, 'hash', 'Parent Siti', 'PARENT', 'ACTIVE'),
              ($10, $11, $12, 'hash', 'Parent Ali', 'PARENT', 'ACTIVE'),
              ($13, NULL, $14, 'hash', 'Super Admin', 'SUPER_ADMIN', 'ACTIVE'),
              ($15, $16, $17, 'hash', 'Master Tan', 'MASTER', 'ACTIVE')`,
      [
        masterId, orgId, masterUser.email,
        otherMasterId, orgId, otherMasterUser.email,
        parentUserId, orgId, parentUser.email,
        unrelatedParentId, orgId, unrelatedParentUser.email,
        superAdminUser.id, superAdminUser.email,
        crossOrgMasterUser.id, otherOrgId, crossOrgMasterUser.email
      ]
    );

    // 3. Seed Classes
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, monthly_fee, capacity, enrollment_availability, status)
       VALUES ($1, $2, $3, $3, 'Klang Silambam Warriors', 'Tue 6:00 PM', 'Hall 1', 120, 30, 'OPEN', 'ACTIVE'),
              ($4, $2, $5, $5, 'Klang Karate Club', 'Wed 7:00 PM', 'Hall 2', 130, 20, 'OPEN', 'ACTIVE')`,
      [classId, orgId, masterId, otherClassId, otherMasterId]
    );

    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
              ($5, $6, $7, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [`lead1_${testRun}`, classId, masterId, orgId, `lead2_${testRun}`, otherClassId, otherMasterId]
    );

    // 4. Seed Students
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, billing_status, status)
       VALUES ($1, $3, $4, NULL, 'Kavitha Devi', $5, '0111111111', $6, 'Yellow Belt', 120, 'PAID', 'ACTIVE'),
              ($2, $3, $4, NULL, 'Ahmad Dani', $7, '0122222222', $8, 'Green Belt', 120, 'PAID', 'ACTIVE')`,
      [
        student1Id,
        student2Id,
        orgId,
        classId,
        `IC1_${testRun.toString().slice(-8)}`,
        `kavitha_${testRun}@test.my`,
        `IC2_${testRun.toString().slice(-8)}`,
        `ahmad_${testRun}@test.my`,
      ]
    );

    // Link parent to student 1
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE)`,
      [`ps_${testRun}`, parentUserId, student1Id]
    );

    // Generate Tokens
    const tokenMaster = generateAuthToken(masterUser as any);
    const tokenOtherMaster = generateAuthToken(otherMasterUser as any);
    const tokenParent = generateAuthToken(parentUser as any);
    const tokenUnrelatedParent = generateAuthToken(unrelatedParentUser as any);
    const tokenSuperAdmin = generateAuthToken(superAdminUser as any);
    const tokenCrossOrg = generateAuthToken(crossOrgMasterUser as any);

    // -------------------------------------------------------------------------
    // TEST 1: Initial query returns hasProfile: false
    // -------------------------------------------------------------------------
    console.log('Test 1: Initial safety profile query');
    const res1 = await makeRequest(server, 'GET', `/students/${student1Id}/safety`, null, tokenParent);
    assert.equal(res1.status, 200);
    assert.equal(res1.data.hasProfile, false);
    assert.equal(res1.data.safetyProfile, null);
    console.log('✅ Test 1 Passed: Correctly returned hasProfile: false.');

    // -------------------------------------------------------------------------
    // TEST 2: Validation check on required fields (rejects incomplete submissions)
    // -------------------------------------------------------------------------
    console.log('Test 2: Validation on mandatory safety fields');
    const res2Incomplete = await makeRequest(
      server,
      'PUT',
      `/students/${student1Id}/safety`,
      {
        emergencyContactName: 'Ravi Devi',
        // missing emergencyContactPhone & emergencyContactRelationship & consent
      },
      tokenParent
    );
    assert.equal(res2Incomplete.status, 400);
    console.log('✅ Test 2 Passed: Incomplete safety profile rejected.');

    // -------------------------------------------------------------------------
    // TEST 3: Linked parent successfully creates/updates student safety profile
    // -------------------------------------------------------------------------
    console.log('Test 3: Parent creates protected student safety profile');
    const res3 = await makeRequest(
      server,
      'PUT',
      `/students/${student1Id}/safety`,
      {
        emergencyContactName: 'Ravi Devi',
        emergencyContactPhone: '012-3456789',
        emergencyContactRelationship: 'Father',
        medicalConditions: 'Mild exercise-induced asthma, carries inhaler',
        allergies: 'Peanut allergy',
        dietaryRestrictions: 'Vegetarian',
        bloodType: 'O+',
        activityConsentGiven: true,
        medicalConsentGiven: true,
        photoConsentGiven: true,
        consentSignedBy: 'Ravi Devi (Father)',
      },
      tokenParent
    );
    assert.equal(res3.status, 200);
    assert.equal(res3.data.safetyProfile.emergency_contact_name, 'Ravi Devi');
    assert.equal(res3.data.safetyProfile.allergies, 'Peanut allergy');
    assert.equal(res3.data.safetyProfile.blood_type, 'O+');
    assert.equal(res3.data.safetyProfile.activity_consent_given, true);
    console.log('✅ Test 3 Passed: Safety profile created successfully.');

    // -------------------------------------------------------------------------
    // TEST 4: Authorized assigned Master can view student safety profile
    // -------------------------------------------------------------------------
    console.log('Test 4: Assigned Master retrieves student safety profile');
    const res4 = await makeRequest(server, 'GET', `/students/${student1Id}/safety`, null, tokenMaster);
    assert.equal(res4.status, 200);
    assert.equal(res4.data.hasProfile, true);
    assert.equal(res4.data.safetyProfile.medical_conditions, 'Mild exercise-induced asthma, carries inhaler');
    console.log('✅ Test 4 Passed: Assigned Master successfully retrieved safety profile.');

    // -------------------------------------------------------------------------
    // TEST 5: Unassigned Master from another class is denied with 403
    // -------------------------------------------------------------------------
    console.log('Test 5: Unassigned Master denied from safety profile');
    const res5 = await makeRequest(server, 'GET', `/students/${student1Id}/safety`, null, tokenOtherMaster);
    assert.equal(res5.status, 403);
    console.log('✅ Test 5 Passed: Unassigned Master denied.');

    // -------------------------------------------------------------------------
    // TEST 6: Unrelated parent is denied with 403
    // -------------------------------------------------------------------------
    console.log('Test 6: Unrelated Parent denied from safety profile');
    const res6 = await makeRequest(server, 'GET', `/students/${student1Id}/safety`, null, tokenUnrelatedParent);
    assert.equal(res6.status, 403);
    console.log('✅ Test 6 Passed: Unrelated Parent denied.');

    // -------------------------------------------------------------------------
    // TEST 7: Cross-organization user is denied with 403
    // -------------------------------------------------------------------------
    console.log('Test 7: Cross-organization user denied from safety profile');
    const res7 = await makeRequest(server, 'GET', `/students/${student1Id}/safety`, null, tokenCrossOrg);
    assert.equal(res7.status, 403);
    console.log('✅ Test 7 Passed: Cross-organization user denied.');

    // -------------------------------------------------------------------------
    // TEST 8: Super Admin is denied with 403 (Zero operational access)
    // -------------------------------------------------------------------------
    console.log('Test 8: Super Admin denied from student safety profile');
    const res8 = await makeRequest(server, 'GET', `/students/${student1Id}/safety`, null, tokenSuperAdmin);
    assert.equal(res8.status, 403);
    console.log('✅ Test 8 Passed: Super Admin zero operational access enforced.');

    // -------------------------------------------------------------------------
    // TEST 9: Master sends notice requiring acknowledgement
    // -------------------------------------------------------------------------
    console.log('Test 9: Master sends notice requiring acknowledgement');
    const res9 = await makeRequest(
      server,
      'POST',
      '/notices',
      {
        classId,
        type: 'SCHEDULE_CHANGE',
        message: 'National Championship preparation camp notice: mandatory parent consent acknowledgement required.',
        requiresAcknowledgement: true,
        acknowledgementDeadline: '2026-11-30T23:59:59.000Z',
      },
      tokenMaster
    );
    assert.equal(res9.status, 201);
    assert.equal(res9.data.notice.requires_acknowledgement, true);
    assert.ok(res9.data.notice.acknowledgement_deadline);
    const noticeId = res9.data.notice.id;
    console.log(`✅ Test 9 Passed: Created notice requiring acknowledgement (${noticeId}).`);

    // -------------------------------------------------------------------------
    // TEST 10: Parent acknowledges notice on behalf of linked child
    // -------------------------------------------------------------------------
    console.log('Test 10: Parent acknowledges notice on behalf of linked child');
    const res10 = await makeRequest(
      server,
      'POST',
      `/notices/${noticeId}/acknowledge`,
      {
        studentId: student1Id,
        notes: 'Acknowledged and confirmed Kavitha will attend.',
      },
      tokenParent
    );
    assert.equal(res10.status, 200);
    assert.equal(res10.data.acknowledged, true);
    assert.equal(res10.data.acknowledgement.student_id, student1Id);
    assert.equal(res10.data.acknowledgement.user_id, parentUserId);
    console.log('✅ Test 10 Passed: Notice acknowledged by parent.');

    // -------------------------------------------------------------------------
    // TEST 11: Idempotent re-acknowledgement updates timestamp without duplicate rows
    // -------------------------------------------------------------------------
    console.log('Test 11: Idempotent re-acknowledgement');
    const res11 = await makeRequest(
      server,
      'POST',
      `/notices/${noticeId}/acknowledge`,
      {
        studentId: student1Id,
        notes: 'Updated acknowledgement note.',
      },
      tokenParent
    );
    assert.equal(res11.status, 200);
    assert.equal(res11.data.acknowledged, true);

    const acksCount = await dbClient.query('SELECT count(*) FROM notice_acknowledgements WHERE notice_id = $1', [noticeId]);
    assert.equal(parseInt(acksCount.rows[0].count, 10), 1);
    console.log('✅ Test 11 Passed: Idempotent acknowledgement verified (exactly 1 row persisted).');

    // -------------------------------------------------------------------------
    // TEST 12: Unrelated parent cannot acknowledge for unlinked student
    // -------------------------------------------------------------------------
    console.log('Test 12: Unrelated Parent denied acknowledgement');
    const res12 = await makeRequest(
      server,
      'POST',
      `/notices/${noticeId}/acknowledge`,
      {
        studentId: student1Id,
        notes: 'Unauthorized acknowledgement attempt.',
      },
      tokenUnrelatedParent
    );
    assert.equal(res12.status, 403);
    console.log('✅ Test 12 Passed: Unrelated parent forbidden from acknowledging.');

    // -------------------------------------------------------------------------
    // TEST 13: Assigned Master views acknowledgement list & compliance metrics
    // -------------------------------------------------------------------------
    console.log('Test 13: Assigned Master views notice compliance metrics');
    const res13 = await makeRequest(server, 'GET', `/notices/${noticeId}/acknowledgements`, null, tokenMaster);
    assert.equal(res13.status, 200);
    assert.equal(res13.data.acknowledgements.length, 1);
    assert.equal(res13.data.acknowledgements[0].student_name, 'Kavitha Devi');
    assert.equal(res13.data.summary.totalRequired, 2); // 2 active students in class
    assert.equal(res13.data.summary.totalAcknowledged, 1);
    assert.equal(res13.data.summary.totalPending, 1);
    assert.equal(res13.data.summary.complianceRatePercent, 50);
    assert.equal(res13.data.pendingStudents.length, 1);
    assert.equal(res13.data.pendingStudents[0].id, student2Id);
    console.log('✅ Test 13 Passed: Compliance metrics calculated accurately.');

    // -------------------------------------------------------------------------
    // TEST 14: Unassigned Master forbidden from viewing acknowledgements
    // -------------------------------------------------------------------------
    console.log('Test 14: Unassigned Master forbidden from viewing acknowledgements');
    const res14 = await makeRequest(server, 'GET', `/notices/${noticeId}/acknowledgements`, null, tokenOtherMaster);
    assert.equal(res14.status, 403);
    console.log('✅ Test 14 Passed: Unassigned Master forbidden.');

    console.log('\n🎉 ALL 14 TASK H11 STUDENT SAFETY, CONSENT & NOTICE ACKNOWLEDGEMENT TESTS PASSED!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
