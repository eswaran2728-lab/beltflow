import os from 'node:os';
import fs from 'node:fs';
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

async function runH16TrialsRetentionTests() {
  console.log('🥋 Starting Task H16: Trials and Actionable Follow-Up Integration Tests...');

  const path = await import('node:path');
  // Fresh database per run (scripts/run-tests.js sets PG_DATA_DIR); never the developer's local .beltflow_pgdata.
  const dbDir = process.env.PG_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-test-'));
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const ts = Date.now();
    const orgAId = `org_h16_a_${ts}`;
    const orgBId = `org_h16_b_${ts}`;

    // Provision Persatuan A and B
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Silat Gayong H16 A', 'Selangor', 'Silat', 'Guru A', '0121111111', $2, 130.00, 'ACTIVE'),
              ($3, 'Persatuan Taekwondo H16 B', 'Kuala Lumpur', 'Taekwondo', 'Master B', '0122222222', $4, 140.00, 'ACTIVE')`,
      [orgAId, `org_a_${ts}@beltflow.test`, orgBId, `org_b_${ts}@beltflow.test`]
    );

    // Users
    const adminAId = `usr_adm_a_${ts}`;
    const masterA1Id = `usr_mst_a1_${ts}`;
    const masterA2Id = `usr_mst_a2_${ts}`;
    const masterB1Id = `usr_mst_b1_${ts}`;
    const parentAId = `usr_par_a_${ts}`;
    const studentAId = `usr_stu_a_${ts}`;
    const superAdminId = `usr_super_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Admin Persatuan A', '0111', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Master A1 Assigned', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Master A2 Unassigned', '0113', 'MASTER', 'ACTIVE'),
       ($10, $11, $12, 'HASH', 'Master B1 Other Org', '0114', 'MASTER', 'ACTIVE'),
       ($13, $14, $15, 'HASH', 'Parent A', '0115', 'PARENT', 'ACTIVE'),
       ($16, $17, $18, 'HASH', 'Student A', '0116', 'STUDENT', 'ACTIVE'),
       ($19, NULL, $20, 'HASH', 'Super Admin', '0117', 'SUPER_ADMIN', 'ACTIVE')`,
      [
        adminAId, orgAId, `admin_a_${ts}@test.com`,
        masterA1Id, orgAId, `master_a1_${ts}@test.com`,
        masterA2Id, orgAId, `master_a2_${ts}@test.com`,
        masterB1Id, orgBId, `master_b1_${ts}@test.com`,
        parentAId, orgAId, `parent_a_${ts}@test.com`,
        studentAId, orgAId, `student_a_${ts}@test.com`,
        superAdminId, `super_${ts}@test.com`
      ]
    );

    // Classes: Class A1 (assigned to Master A1), Class A2 (assigned to Master A2), Class B1 (assigned to Master B1)
    const classA1Id = `cls_a1_${ts}`;
    const classA2Id = `cls_a2_${ts}`;
    const classB1Id = `cls_b1_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, monthly_fee, status)
       VALUES 
       ($1, $2, $3, $4, 'Kelas Silat A1', 'Mon 8PM', 'Gelanggang A1', 130.00, 'ACTIVE'),
       ($5, $6, $7, $8, 'Kelas Silat A2', 'Tue 8PM', 'Gelanggang A2', 130.00, 'ACTIVE'),
       ($9, $10, $11, $12, 'Kelas Taekwondo B1', 'Wed 8PM', 'Dojang B1', 140.00, 'ACTIVE')`,
      [
        classA1Id, orgAId, masterA1Id, masterA1Id,
        classA2Id, orgAId, masterA2Id, masterA2Id,
        classB1Id, orgBId, masterB1Id, masterB1Id
      ]
    );

    // Coach class assignments
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE), ($3, $4, TRUE), ($5, $6, TRUE)`,
      [masterA1Id, classA1Id, masterA2Id, classA2Id, masterB1Id, classB1Id]
    );

    // Tokens
    const tokenAdminA = generateAuthToken({ id: adminAId, email: `admin_a_${ts}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgAId });
    const tokenMasterA1 = generateAuthToken({ id: masterA1Id, email: `master_a1_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [classA1Id] });
    const tokenMasterA2 = generateAuthToken({ id: masterA2Id, email: `master_a2_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [classA2Id] });
    const tokenMasterB1 = generateAuthToken({ id: masterB1Id, email: `master_b1_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgBId, assignedClassIds: [classB1Id] });
    const tokenParentA = generateAuthToken({ id: parentAId, email: `parent_a_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgAId });
    const tokenStudentA = generateAuthToken({ id: studentAId, email: `student_a_${ts}@test.com`, role: UserRole.STUDENT, organizationId: orgAId });
    const tokenSuper = generateAuthToken({ id: superAdminId, email: `super_${ts}@test.com`, role: UserRole.SUPER_ADMIN });

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 1: trial_conversion_no_duplicate
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Acceptance Test: trial_conversion_no_duplicate ---');
    // Step 1: Create Trial Booking
    const trialBookingPayload = {
      organizationId: orgAId,
      classId: classA1Id,
      scheduledDate: new Date().toISOString().slice(0, 10),
      candidateName: 'Amirul bin Razak',
      candidateAge: 12,
      guardianName: 'Encik Razak',
      guardianEmail: 'razak@parent.test',
      guardianPhone: '0123456789',
      emergencyPhone: '0129876543',
      medicalNotes: 'No known allergies or asthma',
      consentAccepted: true,
    };

    const bookRes1 = await makeRequest(server, 'POST', '/trials/book', trialBookingPayload, tokenParentA);
    assert.equal(bookRes1.status, 201, 'Trial booking should succeed with 201 Created');
    assert.ok(bookRes1.data.trial?.id, 'Trial record should contain generated ID');
    const trial1Id = bookRes1.data.trial.id;

    // Verify initial status is BOOKED
    assert.equal(bookRes1.data.trial.status, 'BOOKED');

    // Step 2: Master converts trial into canonical student enrollment
    const convertRes1 = await makeRequest(server, 'POST', `/trials/${trial1Id}/convert`, { beltRank: 'White Belt' }, tokenMasterA1);
    assert.equal(convertRes1.status, 200, 'Master conversion should succeed with 200 OK');
    assert.equal(convertRes1.data.trial?.status, 'CONVERTED');
    assert.ok(convertRes1.data.student?.id, 'Canonical student record must be created');
    const canonicalStudentId = convertRes1.data.student.id;

    // Verify student is enrolled in Class A1 with ACTIVE status
    const studentCheck = await dbClient.query('SELECT * FROM students WHERE id = $1', [canonicalStudentId]);
    assert.equal(studentCheck.rowCount, 1);
    assert.equal(studentCheck.rows[0].class_id, classA1Id);
    assert.equal(studentCheck.rows[0].status, 'ACTIVE');
    assert.equal(studentCheck.rows[0].full_name, 'Amirul bin Razak');

    // Step 3: Re-calling conversion on an already-converted trial MUST fail with 409 Conflict
    const duplicateConvertRes = await makeRequest(server, 'POST', `/trials/${trial1Id}/convert`, { beltRank: 'White Belt' }, tokenMasterA1);
    assert.equal(duplicateConvertRes.status, 409, 'trial_conversion_no_duplicate: duplicate conversion must return 409 Conflict');

    // Verify exactly 1 student record exists
    const duplicateStudentCount = await dbClient.query('SELECT count(*) FROM students WHERE full_name = $1 AND class_id = $2', ['Amirul bin Razak', classA1Id]);
    assert.equal(parseInt(duplicateStudentCount.rows[0].count, 10), 1, 'Exactly one student record should exist');
    console.log('✅ Acceptance Test 1 Passed: trial_conversion_no_duplicate verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 2: conversion_requires_master
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Acceptance Test: conversion_requires_master ---');
    const trialBooking2 = {
      organizationId: orgAId,
      classId: classA1Id,
      scheduledDate: new Date().toISOString().slice(0, 10),
      candidateName: 'Nurul Huda binti Ahmad',
      candidateAge: 10,
      guardianName: 'Puan Halimah',
      guardianPhone: '0198887777',
      consentAccepted: true,
    };

    const bookRes2 = await makeRequest(server, 'POST', '/trials/book', trialBooking2, tokenParentA);
    assert.equal(bookRes2.status, 201);
    const trial2Id = bookRes2.data.trial.id;

    // Attempt 1: Parent attempts conversion -> 403 Forbidden
    const parentConvert = await makeRequest(server, 'POST', `/trials/${trial2Id}/convert`, {}, tokenParentA);
    assert.equal(parentConvert.status, 403, 'Parent cannot convert trial to canonical enrollment');

    // Attempt 2: Student attempts conversion -> 403 Forbidden
    const studentConvert = await makeRequest(server, 'POST', `/trials/${trial2Id}/convert`, {}, tokenStudentA);
    assert.equal(studentConvert.status, 403, 'Student cannot convert trial to canonical enrollment');

    // Attempt 3: Super Admin attempts operational conversion -> 403 Forbidden
    const superConvert = await makeRequest(server, 'POST', `/trials/${trial2Id}/convert`, {}, tokenSuper);
    assert.equal(superConvert.status, 403, 'Super Admin cannot perform operational trial conversion');

    // Attempt 4: Master B1 from different organization attempts conversion -> 403 Forbidden
    const crossOrgMasterConvert = await makeRequest(server, 'POST', `/trials/${trial2Id}/convert`, {}, tokenMasterB1);
    assert.equal(crossOrgMasterConvert.status, 403, 'Cross-organization Master cannot convert trial');

    // Attempt 5: Master A2 from SAME organization but assigned to Class A2 attempts conversion -> 403 Forbidden
    const wrongClassMasterConvert = await makeRequest(server, 'POST', `/trials/${trial2Id}/convert`, {}, tokenMasterA2);
    assert.equal(wrongClassMasterConvert.status, 403, 'Unassigned Master cannot convert trial for another class');

    // Attempt 6: Assigned Master A1 converts trial -> 200 OK
    const assignedMasterConvert = await makeRequest(server, 'POST', `/trials/${trial2Id}/convert`, {}, tokenMasterA1);
    assert.equal(assignedMasterConvert.status, 200, 'Assigned Master can convert trial to canonical enrollment');
    console.log('✅ Acceptance Test 2 Passed: conversion_requires_master verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 3: follow_up_only_own_class
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Acceptance Test: follow_up_only_own_class ---');
    // Master A1 evaluates rules for own class (Class A1) -> 200 OK
    const evalOwnClass = await makeRequest(server, 'POST', `/trials/follow-ups/evaluate/${classA1Id}`, {}, tokenMasterA1);
    assert.equal(evalOwnClass.status, 200, 'Master A1 can evaluate follow-up rules for assigned Class A1');

    // Master A1 evaluates rules for Class A2 (assigned to Master A2) -> 403 Forbidden
    const evalOtherClass = await makeRequest(server, 'POST', `/trials/follow-ups/evaluate/${classA2Id}`, {}, tokenMasterA1);
    assert.equal(evalOtherClass.status, 403, 'Master A1 cannot evaluate follow-up rules for unassigned Class A2');

    // Master A1 evaluates rules for Class B1 (Org B) -> 403 Forbidden
    const evalCrossOrgClass = await makeRequest(server, 'POST', `/trials/follow-ups/evaluate/${classB1Id}`, {}, tokenMasterA1);
    assert.equal(evalCrossOrgClass.status, 403, 'Master A1 cannot evaluate follow-up rules for Org B Class B1');

    // Master A1 views follow-up queue for Class A1 -> 200 OK
    const queueOwnClass = await makeRequest(server, 'GET', `/trials/follow-ups/class/${classA1Id}`, undefined, tokenMasterA1);
    assert.equal(queueOwnClass.status, 200, 'Master A1 can view follow-up queue for assigned Class A1');

    // Master A1 views follow-up queue for Class A2 -> 403 Forbidden
    const queueOtherClass = await makeRequest(server, 'GET', `/trials/follow-ups/class/${classA2Id}`, undefined, tokenMasterA1);
    assert.equal(queueOtherClass.status, 403, 'Master A1 cannot view follow-up queue for unassigned Class A2');
    console.log('✅ Acceptance Test 3 Passed: follow_up_only_own_class verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 4: reason_visible
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Acceptance Test: reason_visible ---');
    // Setup retention risk scenarios in Class A1:
    // a) Enrolled student with 2 consecutive unexcused absences
    const studentAbsenceId = `stu_abs_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, status, billing_status)
       VALUES ($1, $2, $3, 'Faris bin Kamaruddin', '140101-10-1234', '0134445555', 'ACTIVE', 'Paid')`,
      [studentAbsenceId, orgAId, classA1Id]
    );

    // Record two recent sessions marked 'Absent'
    const date1 = '2026-10-05';
    const date2 = '2026-10-08';
    await dbClient.query(
      `INSERT INTO attendance_records (id, class_id, session_date, student_id, status)
       VALUES 
       ($1, $2, $3, $4, 'Absent'),
       ($5, $2, $6, $4, 'Absent')
       ON CONFLICT (class_id, session_date, student_id) DO UPDATE SET status = 'Absent'`,
      [`att_1_${ts}`, classA1Id, date1, studentAbsenceId, `att_2_${ts}`, date2]
    );

    // b) Missed trial booking (scheduled in past with status 'MISSED' or 'BOOKED')
    const missedTrialId = `trl_missed_${ts}`;
    await dbClient.query(
      `INSERT INTO trial_bookings (id, organization_id, class_id, scheduled_date, candidate_name, guardian_phone, consent_accepted, status)
       VALUES ($1, $2, $3, '2026-10-01', 'Luqman Hakim', '0177778888', TRUE, 'MISSED')`,
      [missedTrialId, orgAId, classA1Id]
    );

    // c) Student with overdue unpaid tuition fees
    const studentOverdueId = `stu_overdue_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, status, billing_status)
       VALUES ($1, $2, $3, 'Siti Sarah', '150202-10-5678', '0139990000', 'ACTIVE', 'Unpaid')`,
      [studentOverdueId, orgAId, classA1Id]
    );

    // Run rules evaluation
    const evalRes = await makeRequest(server, 'POST', `/trials/follow-ups/evaluate/${classA1Id}`, {}, tokenMasterA1);
    assert.equal(evalRes.status, 200);

    // Query active follow-up queue
    const queueRes = await makeRequest(server, 'GET', `/trials/follow-ups/class/${classA1Id}`, undefined, tokenMasterA1);
    assert.equal(queueRes.status, 200);
    const items = queueRes.data.items || [];
    assert.ok(items.length >= 2, 'Follow-up queue must contain generated retention risk items');

    // Verify reason is visible, non-empty, and descriptive on every item
    for (const item of items) {
      assert.ok(item.reason && item.reason.trim().length > 0, `reason must be visible and non-empty (got: ${item.reason})`);
      assert.ok(['CONSECUTIVE_ABSENCE', 'MISSED_TRIAL', 'OVERDUE_TUITION', 'INACTIVE_RISK'].includes(item.type));
      assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(item.severity));
      assert.equal(item.status, 'PENDING');
    }

    const absenceItem = items.find((i: any) => i.student_id === studentAbsenceId);
    assert.ok(absenceItem, 'Queue must contain consecutive absence follow-up for Faris bin Kamaruddin');
    assert.match(absenceItem.reason, /absent|absence/i, 'Reason must explicitly explain the consecutive absences');
    console.log('✅ Acceptance Test 4 Passed: reason_visible verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 5: corrected_attendance_recalculates_flag
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Acceptance Test: corrected_attendance_recalculates_flag ---');
    // Master corrects attendance record: student was actually 'Present' or 'Excused' on date2
    await dbClient.query(
      `UPDATE attendance_records SET status = 'Present' WHERE class_id = $1 AND session_date = $2 AND student_id = $3`,
      [classA1Id, date2, studentAbsenceId]
    );

    // Re-evaluate follow-up rules for Class A1
    const reEvalRes = await makeRequest(server, 'POST', `/trials/follow-ups/evaluate/${classA1Id}`, {}, tokenMasterA1);
    assert.equal(reEvalRes.status, 200);

    // Fetch queue again
    const updatedQueueRes = await makeRequest(server, 'GET', `/trials/follow-ups/class/${classA1Id}`, undefined, tokenMasterA1);
    const updatedItems = updatedQueueRes.data.items || [];

    // The absence flag for Faris bin Kamaruddin should be automatically recalculated and cleared/resolved
    const remainingAbsence = updatedItems.find((i: any) => i.student_id === studentAbsenceId && i.type === 'CONSECUTIVE_ABSENCE');
    assert.equal(remainingAbsence, undefined, 'corrected_attendance_recalculates_flag: absence flag must be automatically cleared upon attendance correction');
    console.log('✅ Acceptance Test 5 Passed: corrected_attendance_recalculates_flag verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 6: no_auto_contact_without_authorized_action
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Acceptance Test: no_auto_contact_without_authorized_action ---');
    // Find an active pending follow up item in queue
    assert.ok(updatedItems.length > 0, 'Should have pending items in queue');
    const targetItem = updatedItems[0];
    assert.equal(targetItem.status, 'PENDING', 'Item must be in PENDING state with zero unsolicited automatic messages sent');

    // Attempt 1: Unauthorized parent attempts to resolve follow up -> 403 Forbidden
    const parentAction = await makeRequest(server, 'POST', `/trials/follow-ups/${targetItem.id}/action`, { outcome: 'RESOLVED_RETURNING' }, tokenParentA);
    assert.equal(parentAction.status, 403, 'Parent cannot record Master follow-up actions');

    // Attempt 2: Authorized Master records outcome manually
    const masterAction = await makeRequest(
      server,
      'POST',
      `/trials/follow-ups/${targetItem.id}/action`,
      {
        outcome: 'CONTACTED_PHONE',
        notes: 'Contacted parent via phone call. Confirmed student is recovering from fever and will attend next Monday.',
      },
      tokenMasterA1
    );
    assert.equal(masterAction.status, 200, 'Authorized Master can record follow-up outcome');
    assert.equal(masterAction.data.item.status, 'RESOLVED');
    assert.equal(masterAction.data.item.outcome, 'CONTACTED_PHONE');
    assert.equal(masterAction.data.item.actioned_by, masterA1Id);

    // Verify audit log exists
    const auditCheck = await dbClient.query('SELECT * FROM audit_logs WHERE details LIKE $1', [`%${targetItem.id}%`]);
    assert.ok(auditCheck.rowCount > 0, 'Audit log must record follow-up action');
    console.log('✅ Acceptance Test 6 Passed: no_auto_contact_without_authorized_action verified.');

    console.log('\n🎉 ALL 6 OFFICIAL TASK H16 ACCEPTANCE TESTS PASSED!\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dbClient.close();
  }
}

runH16TrialsRetentionTests().catch((err) => {
  console.error('\n❌ TASK H16 INTEGRATION TESTS FAILED:', err);
  process.exit(1);
});
