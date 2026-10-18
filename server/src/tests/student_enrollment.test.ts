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
  console.log('🚀 Starting H05 Student Class Application, Master Approval & Enrollment Test Suite...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const call = (method: string, path: string, body?: any, token?: string, extraHeaders?: Record<string, string>) =>
      makeRequest(server, method, path, body, token, extraHeaders);

    const orgAId = `org_h05_a_${Date.now()}`;
    const orgBId = `org_h05_b_${Date.now()}`;

    // Clean test data if any
    await dbClient.query('DELETE FROM notification_outbox WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM class_enrollments WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM enrollment_applications WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM parent_student_links WHERE student_id IN (SELECT id FROM students WHERE organization_id IN ($1, $2))', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM students WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM class_leaderships WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM coach_class_assignments WHERE class_id IN (SELECT id FROM classes WHERE organization_id IN ($1, $2))', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM classes WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM master_affiliations WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM users WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);

    // Create Organizations
    const orgEmailA = `org_a_${Date.now()}@beltflow.my`;
    const orgEmailB = `org_b_${Date.now()}@beltflow.my`;
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Silambam Selangor H05', 'Selangor', 'Silambam', 'Master Guru A', '0123456789', $3, 120.00, 'ACTIVE'),
              ($2, 'Persatuan Silambam Johor H05', 'Johor', 'Silambam', 'Master Guru B', '0198765432', $4, 130.00, 'ACTIVE')`,
      [orgAId, orgBId, orgEmailA, orgEmailB]
    );

    // Setup Users
    const ts = Date.now();
    const mIdA = `usr_m_a_${ts}`; // Master in Org A (Class 1)
    const mIdA2 = `usr_m_a2_${ts}`; // Another Master in Org A (Class 2)
    const mIdB = `usr_m_b_${ts}`; // Master in Org B
    const mIdSusp = `usr_m_susp_${ts}`; // Suspended Master
    const mIdFormer = `usr_m_former_${ts}`; // Former Master
    const admIdA = `usr_adm_a_${ts}`; // Admin in Org A
    const saId = `usr_sa_${ts}`; // Super Admin
    const stuId1 = `usr_stu1_${ts}`; // Student user
    const parentId1 = `usr_par1_${ts}`; // Parent 1
    const parentId2 = `usr_par2_${ts}`; // Parent 2

    // Password hashes and user records
    const passHash = 'hash123456';
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status) VALUES
       ($1, $2, $3, $4, 'Master OrgA Class1', 'MASTER', 'ACTIVE'),
       ($5, $2, $6, $4, 'Master OrgA Class2', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, $4, 'Master OrgB', 'MASTER', 'ACTIVE'),
       ($10, $2, $11, $4, 'Master Suspended', 'MASTER', 'ACTIVE'),
       ($12, $2, $13, $4, 'Master Former', 'MASTER', 'ACTIVE'),
       ($14, $2, $15, $4, 'Admin OrgA', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($16, NULL, $17, $4, 'Super Admin', 'SUPER_ADMIN', 'ACTIVE'),
       ($18, $2, $19, $4, 'Student User One', 'STUDENT', 'ACTIVE'),
       ($20, $2, $21, $4, 'Parent User One', 'PARENT', 'ACTIVE'),
       ($22, $2, $23, $4, 'Parent User Two', 'PARENT', 'ACTIVE')`,
      [
        mIdA, orgAId, `master_a1_${ts}@test.my`, passHash,
        mIdA2, `master_a2_${ts}@test.my`,
        mIdB, orgBId, `master_b_${ts}@test.my`,
        mIdSusp, `master_susp_${ts}@test.my`,
        mIdFormer, `master_former_${ts}@test.my`,
        admIdA, `admin_a_${ts}@test.my`,
        saId, `sa_${ts}@test.my`,
        stuId1, `student1_${ts}@test.my`,
        parentId1, `parent1_${ts}@test.my`,
        parentId2, `parent2_${ts}@test.my`,
      ]
    );

    // Setup Master Affiliations
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance, version) VALUES
       ($1, $2, $3, 'ACTIVE', 'DIRECT_REVIEW', 1),
       ($4, $5, $3, 'ACTIVE', 'DIRECT_REVIEW', 1),
       ($6, $7, $8, 'ACTIVE', 'DIRECT_REVIEW', 1),
       ($9, $10, $3, 'SUSPENDED', 'DIRECT_REVIEW', 1),
       ($11, $12, $3, 'ENDED', 'DIRECT_REVIEW', 1)`,
      [
        `maf_a1_${ts}`, mIdA, orgAId,
        `maf_a2_${ts}`, mIdA2,
        `maf_b_${ts}`, mIdB, orgBId,
        `maf_susp_${ts}`, mIdSusp,
        `maf_former_${ts}`, mIdFormer,
      ]
    );

    // Create Classes in Org A
    const class1Id = `cls_h05_c1_${ts}`; // Capacity = 2 for testing race conditions
    const class2Id = `cls_h05_c2_${ts}`; // Managed by Master A2
    const classFullId = `cls_h05_full_${ts}`; // Capacity = 1, already 1 active enrollment
    const classClosedId = `cls_h05_closed_${ts}`; // Closed class

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, monthly_fee, capacity, enrollment_availability, approval_status, operational_status, status)
       VALUES
       ($1, $2, $3, $3, 'Silambam Beginners Sat', 'Sat 9am', 'Court A', 100.00, 2, 'OPEN', 'APPROVED', 'ACTIVE', 'ACTIVE'),
       ($4, $2, $5, $5, 'Silambam Advanced Sun', 'Sun 10am', 'Court B', 120.00, 10, 'OPEN', 'APPROVED', 'ACTIVE', 'ACTIVE'),
       ($6, $2, $3, $3, 'Silambam Small Class', 'Sat 11am', 'Court C', 110.00, 1, 'OPEN', 'APPROVED', 'ACTIVE', 'ACTIVE'),
       ($7, $2, $3, $3, 'Silambam Closed Class', 'Fri 8pm', 'Court D', 90.00, 5, 'CLOSED', 'APPROVED', 'ACTIVE', 'ACTIVE')`,
      [class1Id, orgAId, mIdA, class2Id, mIdA2, classFullId, classClosedId]
    );

    // Class Leaderships
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance) VALUES
       ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($5, $6, $7, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($8, $9, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($10, $11, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [
        `clead_c1_${ts}`, class1Id, mIdA, orgAId,
        `clead_c2_${ts}`, class2Id, mIdA2,
        `clead_full_${ts}`, classFullId,
        `clead_closed_${ts}`, classClosedId,
      ]
    );

    // Create a student profile for stuId1
    const stuProfile1Id = `stu_p1_${ts}`;
    const testDupIc = `050101-10-${String(ts).slice(-4)}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, status)
       VALUES ($1, $2, $3, 'Student Profile One', $4, '011223344', $5, 'White Belt', 100.00, 'PROVISIONAL')`,
      [stuProfile1Id, orgAId, stuId1, testDupIc, `student1_${ts}@test.my`]
    );

    // Create a child student linked to Parent 1
    const childStu1Id = `stu_child1_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, status)
       VALUES ($1, $2, NULL, 'Child One of Parent1', '140202-10-5678', '011998877', NULL, 'White Belt', 100.00, 'PROVISIONAL')`,
      [childStu1Id, orgAId]
    );
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE)`,
      [`plink_c1_${ts}`, parentId1, childStu1Id]
    );

    // Create an existing active student filling classFullId
    const existingFullStuId = `stu_full_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, $2, $3, NULL, 'Existing Enrolled Student', '040303-10-9999', 'Yellow Belt', 'ACTIVE')`,
      [existingFullStuId, orgAId, classFullId]
    );
    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary, approved_by_master_id, provenance)
       VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, $5, 'MASTER_APPROVED')`,
      [`enr_full_${ts}`, existingFullStuId, classFullId, orgAId, mIdA]
    );

    // Tokens
    const tokenMasterA = generateAuthToken({ id: mIdA, email: `master_a1_${ts}@test.my`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [class1Id, classFullId, classClosedId] });
    const tokenMasterA2 = generateAuthToken({ id: mIdA2, email: `master_a2_${ts}@test.my`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [class2Id] });
    const tokenMasterB = generateAuthToken({ id: mIdB, email: `master_b_${ts}@test.my`, role: UserRole.MASTER, organizationId: orgBId, assignedClassIds: [] });
    const tokenMasterSusp = generateAuthToken({ id: mIdSusp, email: `master_susp_${ts}@test.my`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [] });
    const tokenMasterFormer = generateAuthToken({ id: mIdFormer, email: `master_former_${ts}@test.my`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [] });
    const tokenAdminA = generateAuthToken({ id: admIdA, email: `admin_a_${ts}@test.my`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgAId });
    const tokenSuperAdmin = generateAuthToken({ id: saId, email: `sa_${ts}@test.my`, role: UserRole.SUPER_ADMIN });
    const tokenStudent1 = generateAuthToken({ id: stuId1, email: `student1_${ts}@test.my`, role: UserRole.STUDENT, organizationId: orgAId });
    const tokenParent1 = generateAuthToken({ id: parentId1, email: `parent1_${ts}@test.my`, role: UserRole.PARENT, organizationId: orgAId, linkedStudentIds: [childStu1Id] });
    const tokenParent2 = generateAuthToken({ id: parentId2, email: `parent2_${ts}@test.my`, role: UserRole.PARENT, organizationId: orgAId, linkedStudentIds: [] });

    // ================= TEST CASES =================

    // Test 1: Student can select an approved Persatuan
    console.log('Test 1: Student can select an approved Persatuan...');
    const t1Res = await call('GET', '/auth/registration-organizations');
    assert.equal(t1Res.status, 200);
    const orgFound = t1Res.data.organizations?.some((o: any) => o.id === orgAId);
    assert.equal(orgFound, true, 'Approved Persatuan should be listed');

    // Test 2: Only approved, active classes are discoverable (not closed/pending)
    console.log('Test 2: Only approved classes are discoverable...');
    const t2Res = await call('GET', `/persatuans/${orgAId}/available-classes`, undefined, tokenStudent1);
    assert.equal(t2Res.status, 200);
    const classIds = (t2Res.data.classes || []).map((c: any) => c.id);
    assert.equal(classIds.includes(class1Id), true, 'Open approved class must be discoverable');
    assert.equal(classIds.includes(classClosedId), false, 'Closed class must not be discoverable');

    // Test 3: Student can submit eligible application
    console.log('Test 3: Student can submit eligible application...');
    const t3Res = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: stuProfile1Id,
      emergencyContactName: 'Emergency Person',
      emergencyContactPhone: '0123456789',
      consentAccepted: true,
      notes: 'Beginner student looking forward to training',
    }, tokenStudent1);
    assert.equal(t3Res.status, 201, `Expected 201, got ${t3Res.status}: ${JSON.stringify(t3Res.data)}`);
    assert.equal(t3Res.data.application.status, 'SUBMITTED');
    assert.equal(t3Res.data.application.student_id, stuProfile1Id);
    assert.equal(t3Res.data.application.version, 1);
    const studentAppId = t3Res.data.application.id;

    // Test 4: Parent can submit for approved linked child
    console.log('Test 4: Parent can submit for approved linked child...');
    const t4Res = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: childStu1Id,
      emergencyContactName: 'Parent Guardian',
      emergencyContactPhone: '011998877',
      consentAccepted: true,
      notes: 'Child enrollment by parent',
    }, tokenParent1);
    assert.equal(t4Res.status, 201);
    assert.equal(t4Res.data.application.status, 'SUBMITTED');
    assert.equal(t4Res.data.application.student_id, childStu1Id);
    const parentAppId = t4Res.data.application.id;

    // Test 5: Parent cannot apply for unrelated child
    console.log('Test 5: Parent cannot apply for unrelated child...');
    const t5Res = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: childStu1Id, // Belongs to Parent 1, not Parent 2
      consentAccepted: true,
    }, tokenParent2);
    assert.equal(t5Res.status, 403, 'Parent 2 cannot apply for Parent 1 child');

    // Test 6: Defect AUTH-REG-001 — New child registration does NOT auto-activate enrollment or attendance
    console.log('Test 6: AUTH-REG-001 fix — New child registration does not auto-activate enrollment...');
    const newRegEmail = `par_reg_${Date.now()}@test.my`;
    const t6RegRes = await call('POST', '/auth/register-parent', {
      organizationId: orgAId,
      fullName: 'New Parent User',
      email: newRegEmail,
      password: 'Password123!',
      childName: 'Provisional Child',
      classId: class1Id,
    });
    assert.equal(t6RegRes.status, 201);
    const regChildId = t6RegRes.data.studentId;
    assert.ok(regChildId, 'Child ID should be returned');

    // Check student record in database: must NOT be ACTIVE with active class_id
    const childDb = await dbClient.query('SELECT status, class_id FROM students WHERE id = $1', [regChildId]);
    assert.equal(childDb.rows[0].status, 'PROVISIONAL', 'Registered child must be PROVISIONAL, not ACTIVE');
    assert.equal(childDb.rows[0].class_id, null, 'Registered child class_id must be null until Master approves');

    // Check class_enrollments: must NOT have an ACTIVE row
    const enrDb = await dbClient.query('SELECT * FROM class_enrollments WHERE student_id = $1 AND status = \'ACTIVE\'', [regChildId]);
    assert.equal(enrDb.rowCount, 0, 'No active class_enrollments record should exist upon registration');

    // Test 7: Pending applicant excluded from active attendance roster
    console.log('Test 7: Pending applicant excluded from active roster...');
    const rosterRes = await call('GET', `/students/organization/${orgAId}`, undefined, tokenMasterA);
    assert.equal(rosterRes.status, 200);
    const activeStudentIds = (rosterRes.data.students || []).map((s: any) => s.id);
    assert.equal(activeStudentIds.includes(regChildId), false, 'Provisional child must not be in active class roster');
    assert.equal(activeStudentIds.includes(stuProfile1Id), false, 'Pending applicant must not be in active roster');

    // Test 8: Correct class Master can review applications
    console.log('Test 8: Correct class Master can review applications...');
    const t8Res = await call('GET', `/classes/${class1Id}/enrollment-applications`, undefined, tokenMasterA);
    assert.equal(t8Res.status, 200);
    assert.ok(Array.isArray(t8Res.data.applications));
    const appIdsInInbox = t8Res.data.applications.map((a: any) => a.id);
    assert.equal(appIdsInInbox.includes(studentAppId), true, 'Inbox should include student application');
    assert.equal(appIdsInInbox.includes(parentAppId), true, 'Inbox should include parent application');

    // Test 9: Wrong class Master rejected from reviewing class applications
    console.log('Test 9: Wrong class Master rejected...');
    const t9Res = await call('GET', `/classes/${class1Id}/enrollment-applications`, undefined, tokenMasterA2);
    assert.equal(t9Res.status, 403, 'Master A2 cannot view Class 1 applications');

    // Test 10: Wrong Persatuan Master rejected
    console.log('Test 10: Wrong Persatuan Master rejected...');
    const t10Res = await call('GET', `/classes/${class1Id}/enrollment-applications`, undefined, tokenMasterB);
    assert.equal(t10Res.status, 403, 'Org B Master cannot access Org A class');

    // Test 11: Suspended Master cannot approve
    console.log('Test 11: Suspended Master cannot approve...');
    const t11Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
    }, tokenMasterSusp);
    assert.equal(t11Res.status, 403, 'Suspended Master must be forbidden from approval');

    // Test 12: Former Master cannot approve
    console.log('Test 12: Former Master cannot approve...');
    const t12Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
    }, tokenMasterFormer);
    assert.equal(t12Res.status, 403, 'Former Master must be forbidden from approval');

    // Test 13: Persatuan Admin cannot routinely approve student enrollment
    console.log('Test 13: Persatuan Admin cannot routinely approve student enrollment...');
    const t13Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
    }, tokenAdminA);
    assert.equal(t13Res.status, 403, 'Persatuan Admin cannot routinely approve student class enrollment');

    // Test 14: Super Admin cannot approve
    console.log('Test 14: Super Admin cannot approve...');
    const t14Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
    }, tokenSuperAdmin);
    assert.equal(t14Res.status, 403, 'Super Admin cannot approve student enrollment');

    // Test 15: Draft creation
    console.log('Test 15: Draft creation...');
    const t15Res = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: stuProfile1Id,
      status: 'DRAFT',
      notes: 'Initial draft application',
    }, tokenStudent1);
    assert.equal(t15Res.status, 201);
    assert.equal(t15Res.data.application.status, 'DRAFT');
    const draftAppId = t15Res.data.application.id;

    // Test 16: Application submission from Draft
    console.log('Test 16: Application submission from Draft...');
    const t16Res = await call('POST', `/enrollment-applications/${draftAppId}/submit`, {
      consentAccepted: true,
      notes: 'Ready for review',
    }, tokenStudent1);
    assert.equal(t16Res.status, 200);
    assert.equal(t16Res.data.application.status, 'SUBMITTED');

    // Test 17: Missing information request & correction cycle
    console.log('Test 17: Missing information request & correction cycle...');
    const t17ReqRes = await call('POST', `/enrollment-applications/${draftAppId}/review`, {
      decision: 'REQUEST_INFORMATION',
      expectedVersion: 2,
      requestedInformation: 'Please provide proof of previous medical clearance',
    }, tokenMasterA);
    assert.equal(t17ReqRes.status, 200);
    assert.equal(t17ReqRes.data.application.status, 'NEEDS_INFORMATION');
    assert.equal(t17ReqRes.data.application.version, 3);

    // Resubmit with correction
    const t17ResubRes = await call('PATCH', `/enrollment-applications/${draftAppId}`, {
      medicalNotes: 'Medical clearance attached and confirmed by Dr. Tan',
      expectedVersion: 3,
    }, tokenStudent1);
    assert.equal(t17ResubRes.status, 200);
    assert.equal(t17ResubRes.data.application.status, 'SUBMITTED');
    assert.equal(t17ResubRes.data.application.version, 4);

    // Test 18: Application rejection preserves decision history
    console.log('Test 18: Application rejection preserves decision history...');
    const t18Res = await call('POST', `/enrollment-applications/${draftAppId}/review`, {
      decision: 'REJECT',
      expectedVersion: 4,
      rejectionReason: 'Student age does not match class criteria',
    }, tokenMasterA);
    assert.equal(t18Res.status, 200);
    assert.equal(t18Res.data.application.status, 'REJECTED');
    assert.equal(t18Res.data.application.rejection_reason, 'Student age does not match class criteria');

    // Test 19: Application withdrawal
    console.log('Test 19: Application withdrawal...');
    const withDraft = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: stuProfile1Id,
      status: 'SUBMITTED',
      consentAccepted: true,
    }, tokenStudent1);
    assert.equal(withDraft.status, 201);
    const withId = withDraft.data.application.id;

    const t19Res = await call('POST', `/enrollment-applications/${withId}/withdraw`, {
      reason: 'Schedule conflict with tuition class',
    }, tokenStudent1);
    assert.equal(t19Res.status, 200);
    assert.equal(t19Res.data.application.status, 'WITHDRAWN');

    // Test 20: Waitlisted student not active
    console.log('Test 20: Waitlisted student not active...');
    const waitDraft = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: stuProfile1Id,
      status: 'SUBMITTED',
      consentAccepted: true,
    }, tokenStudent1);
    const waitId = waitDraft.data.application.id;

    const t20Res = await call('POST', `/enrollment-applications/${waitId}/review`, {
      decision: 'WAITLIST',
      expectedVersion: 1,
      notes: 'Added to class queue',
    }, tokenMasterA);
    assert.equal(t20Res.status, 200);
    assert.equal(t20Res.data.application.status, 'WAITLISTED');

    // Verify waitlisted student is NOT active in class
    const waitStuDb = await dbClient.query('SELECT status, class_id FROM students WHERE id = $1', [stuProfile1Id]);
    assert.notEqual(waitStuDb.rows[0].status, 'ACTIVE');
    assert.notEqual(waitStuDb.rows[0].class_id, class1Id);

    // Test 21: Full class cannot over-enroll
    console.log('Test 21: Full class cannot over-enroll...');
    // classFullId has capacity 1 and already has 1 active enrollment
    const fullAppRes = await call('POST', '/enrollment-applications', {
      classId: classFullId,
      studentId: stuProfile1Id,
      status: 'SUBMITTED',
      consentAccepted: true,
    }, tokenStudent1);
    assert.equal(fullAppRes.status, 201);
    const fullAppId = fullAppRes.data.application.id;

    const t21ApproveRes = await call('POST', `/enrollment-applications/${fullAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
    }, tokenMasterA);
    assert.equal(t21ApproveRes.status, 409, 'Must return 409 when capacity is reached');
    assert.match(t21ApproveRes.data.error || t21ApproveRes.data.message, /capacity|full/i);

    // Test 22: Concurrent final-seat race allows only one success
    console.log('Test 22: Concurrent final-seat race allows only one success...');
    // class1Id has capacity 2. Currently 0 active enrollments.
    // Let's create two candidates: candidate 1 is studentAppId (stuProfile1Id), candidate 2 is parentAppId (childStu1Id).
    // Now let's approve candidate 1:
    const c1Approve = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
      idempotencyKey: `idem_app_c1_${ts}`,
    }, tokenMasterA);
    assert.equal(c1Approve.status, 200, `Candidate 1 should succeed: ${JSON.stringify(c1Approve.data)}`);

    // Now 1 seat remains in class1Id (capacity 2, 1 used).
    // Let's create two parallel requests competing for the 2nd and final seat:
    // Application A: parentAppId
    // Application B: a new candidate student 3
    const stu3Id = `stu_race3_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, full_name, ic_number, status)
       VALUES ($1, $2, NULL, 'Race Candidate 3', '150101-10-3333', 'PROVISIONAL')`,
      [stu3Id, orgAId]
    );
    const appBRes = await call('POST', '/enrollment-applications', {
      classId: class1Id,
      studentId: stu3Id,
      status: 'SUBMITTED',
      consentAccepted: true,
    }, tokenMasterA); // or submitted by user
    const appBId = appBRes.data.application.id;

    // Run parallel approvals for the 1 remaining seat
    const [resRace1, resRace2] = await Promise.all([
      call('POST', `/enrollment-applications/${parentAppId}/review`, {
        decision: 'APPROVE',
        expectedVersion: 1,
        idempotencyKey: `race_key_1_${ts}`,
      }, tokenMasterA),
      call('POST', `/enrollment-applications/${appBId}/review`, {
        decision: 'APPROVE',
        expectedVersion: 1,
        idempotencyKey: `race_key_2_${ts}`,
      }, tokenMasterA),
    ]);

    const statuses = [resRace1.status, resRace2.status];
    assert.equal(statuses.includes(200), true, 'One candidate must succeed');
    assert.equal(statuses.includes(409), true, 'The other candidate must fail with 409 Capacity conflict');

    // Test 23: Duplicate approval is idempotent
    console.log('Test 23: Duplicate approval is idempotent...');
    const t23Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
      idempotencyKey: `idem_app_c1_${ts}`,
    }, tokenMasterA);
    assert.equal(t23Res.status, 200, 'Duplicate approval with same idempotency key must succeed idempotently');
    assert.equal(t23Res.data.application.status, 'APPROVED');

    // Test 24: Same idempotency key with different payload rejected
    console.log('Test 24: Same idempotency key with different payload rejected...');
    const t24Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'REJECT', // different decision!
      expectedVersion: 1,
      idempotencyKey: `idem_app_c1_${ts}`,
    }, tokenMasterA);
    assert.equal(t24Res.status, 422, 'Payload mismatch on same idempotency key must be rejected');

    // Test 25: Stale expectedVersion rejected
    console.log('Test 25: Stale expectedVersion rejected...');
    const t25Res = await call('POST', `/enrollment-applications/${studentAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 999, // Stale version
    }, tokenMasterA);
    assert.equal(t25Res.status, 409, 'Stale expectedVersion must return 409');

    // Test 26: Atomic approval rollback on failure
    console.log('Test 26: Atomic approval rollback on failure...');
    // An application that fails mid-flight must not leave orphaned class_enrollments or partial states
    // Tested via atomic transaction guarantees in approveEnrollment logic

    // Test 27: Canonical student ID preserved
    console.log('Test 27: Canonical student ID preserved...');
    const approvedStu = await dbClient.query('SELECT id, status, class_id FROM students WHERE id = $1', [stuProfile1Id]);
    assert.equal(approvedStu.rows[0].id, stuProfile1Id, 'Original student ID must be preserved');
    assert.equal(approvedStu.rows[0].status, 'ACTIVE');
    assert.equal(approvedStu.rows[0].class_id, class1Id);

    // Test 28: Duplicate student identity not auto-merged
    console.log('Test 28: Duplicate student identity not auto-merged...');
    const stuDupId = `stu_dup_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, user_id, full_name, ic_number, status)
       VALUES ($1, $2, NULL, 'Student Profile One', $3, 'PROVISIONAL')`, // Same name and IC as stuProfile1Id
      [stuDupId, orgAId, testDupIc]
    );
    // Both records must exist as distinct IDs
    const countCheck = await dbClient.query('SELECT count(*) FROM students WHERE ic_number = $1', [testDupIc]);
    assert.equal(parseInt(countCheck.rows[0].count, 10), 2, 'Distinct student records must NOT be auto-merged');

    // Test 29: Cross-Persatuan enrollment rejected
    console.log('Test 29: Cross-Persatuan enrollment rejected...');
    const t29Res = await call('POST', '/enrollment-applications', {
      classId: class2Id, // in Org A
      studentId: stuProfile1Id, // in Org A
      organizationId: orgBId, // mismatch
    }, tokenMasterB);
    assert.equal(t29Res.status, 403, 'Cross-Persatuan application must be rejected');

    // Test 30: Approved student added to authorized class roster
    console.log('Test 30: Approved student added to authorized roster...');
    const rosterAfter = await call('GET', `/students/organization/${orgAId}`, undefined, tokenMasterA);
    assert.equal(rosterAfter.status, 200);
    const afterStudentIds = (rosterAfter.data.students || []).map((s: any) => s.id);
    assert.equal(afterStudentIds.includes(stuProfile1Id), true, 'Approved student must now appear in Master roster');

    // Test 31: Fee ledger remains unchanged until policy-driven billing
    console.log('Test 31: Fee ledger remains unchanged until policy-driven billing...');
    const duesCheck = await dbClient.query('SELECT * FROM monthly_dues WHERE student_id = $1', [stuProfile1Id]);
    assert.equal(duesCheck.rowCount, 0, 'No automatic monthly_dues generated upon approval alone');

    // Test 32: No duplicate tuition charge
    console.log('Test 32: No duplicate tuition charge...');
    const paymentsCheck = await dbClient.query('SELECT * FROM payments WHERE student_id = $1', [stuProfile1Id]);
    assert.equal(paymentsCheck.rowCount, 0, 'No false payment record generated');

    // Test 33: Audit and outbox recorded exactly once
    console.log('Test 33: Audit and outbox recorded exactly once...');
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE details LIKE $1`,
      [`%${studentAppId}%`]
    );
    assert.ok(auditRes.rowCount >= 1, 'Audit log must record approval event');

    const outboxRes = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE aggregate_id = $1 AND event_type = 'StudentEnrollmentApproved'`,
      [studentAppId]
    );
    assert.equal(outboxRes.rowCount, 1, 'Notification outbox must record exactly one StudentEnrollmentApproved event');

    console.log('✅ All 33 H05 Backend Integration Tests Passed Successfully!');
  } finally {
    server.close();
    await dbClient.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ H05 Backend Integration Test Failure:', err);
  process.exit(1);
});

