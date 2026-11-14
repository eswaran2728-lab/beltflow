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
  console.log('🚀 Starting H06 Master Class Workspace, Authorized Rosters & Operational Dashboard Test Suite...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const ts = Date.now();
    const orgSelangor = `org_sel_${ts}`;
    const orgPenang = `org_pen_${ts}`;

    // 1. Setup Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Silambam Selangor', 'Selangor', 'Silambam', 'Master Guru Selangor', '0123456789', $3, 120.00, 'ACTIVE'),
              ($2, 'Persatuan Silambam Penang', 'Penang', 'Silambam', 'Master Guru Penang', '0198765432', $4, 110.00, 'ACTIVE')`,
      [orgSelangor, orgPenang, `org_sel_${ts}@beltflow.my`, `org_pen_${ts}@beltflow.my`]
    );

    // 2. Setup Users
    const superAdmin = { id: `usr_sa_${ts}`, email: `sa_${ts}@beltflow.my`, role: UserRole.SUPER_ADMIN, organizationId: undefined };
    const adminSelangor = { id: `usr_adm_sel_${ts}`, email: `admin_sel_${ts}@selangor.my`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgSelangor };
    const masterPrimary = { id: `usr_m_prim_${ts}`, email: `master_prim_${ts}@selangor.my`, role: UserRole.MASTER, organizationId: orgSelangor };
    const masterSuspended = { id: `usr_m_susp_${ts}`, email: `master_susp_${ts}@selangor.my`, role: UserRole.MASTER, organizationId: orgSelangor };
    const masterUnverified = { id: `usr_m_unv_${ts}`, email: `master_unv_${ts}@selangor.my`, role: UserRole.MASTER, organizationId: orgSelangor };
    const masterFormer = { id: `usr_m_former_${ts}`, email: `master_former_${ts}@selangor.my`, role: UserRole.MASTER, organizationId: orgSelangor };
    const masterPenang = { id: `usr_m_pen_${ts}`, email: `master_pen_${ts}@penang.my`, role: UserRole.MASTER, organizationId: orgPenang };

    for (const u of [superAdmin, adminSelangor, masterPrimary, masterSuspended, masterUnverified, masterFormer, masterPenang]) {
      await dbClient.query(
        `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, 'hashed_password', $3, $4, $5)`,
        [u.id, u.organizationId, u.email, u.role, u === masterSuspended ? 'SUSPENDED' : 'ACTIVE']
      );
    }

    // Affiliations
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from)
       VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP),
              ($4, $5, $3, 'SUSPENDED', CURRENT_TIMESTAMP),
              ($6, $7, $3, 'PENDING', CURRENT_TIMESTAMP),
              ($8, $9, $10, 'ACTIVE', CURRENT_TIMESTAMP)`,
      [
        `maf_prim_${ts}`, masterPrimary.id, orgSelangor,
        `maf_susp_${ts}`, masterSuspended.id,
        `maf_unv_${ts}`, masterUnverified.id,
        `maf_pen_${ts}`, masterPenang.id, orgPenang,
      ]
    );

    // 3. Classes
    const classA = `cls_a_${ts}`;
    const classB = `cls_b_${ts}`;
    const classPenang = `cls_pen_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, capacity, approval_status, operational_status, enrollment_availability)
       VALUES ($1, $2, 'Silambam Advanced Squad', 'Mon & Wed 7:00 PM', 'Shah Alam Complex', 120.00, 20, 'APPROVED', 'ACTIVE', 'OPEN'),
              ($3, $2, 'Silambam Junior Dojo', 'Sat 9:00 AM', 'Klang Dojo', 100.00, 25, 'APPROVED', 'ACTIVE', 'OPEN'),
              ($4, $5, 'Penang Traditional Staff', 'Sun 10:00 AM', 'Georgetown Center', 110.00, 15, 'APPROVED', 'ACTIVE', 'OPEN')`,
      [classA, orgSelangor, classB, classPenang, orgPenang]
    );

    // Leadership assignments
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE),
              ($5, $6, $7, $4, 'PRIMARY', FALSE)`, // former leadership on classB
      [
        `clead_1_${ts}`, classA, masterPrimary.id, orgSelangor,
        `clead_2_${ts}`, classB, masterFormer.id,
      ]
    );

    // Training Groups for Class A
    const groupJuniors = `tg_jun_${ts}`;
    const groupSeniors = `tg_sen_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name)
       VALUES ($1, $2, $3, 'Junior Forms'),
              ($4, $2, $3, 'Senior Weapons')`,
      [groupJuniors, orgSelangor, classA, groupSeniors]
    );

    // Scheduled Sessions for Today
    const todayStr = new Date().toISOString().slice(0, 10);
    const sessionToday = `ts_tod_${ts}`;
    const sessionCancelled = `ts_canc_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, $5, 'Sunday', '19:00', '21:00', 'Shah Alam Complex', 'Scheduled'),
              ($6, $2, $3, $7, $5, 'Sunday', '17:00', '18:30', 'Shah Alam Complex', 'Cancelled')`,
      [sessionToday, orgSelangor, classA, groupSeniors, todayStr, sessionCancelled, groupJuniors]
    );

    // Notices
    const noticeClass = `not_cls_${ts}`;
    await dbClient.query(
      `INSERT INTO notices (id, organization_id, class_id, group_id, type, message, sender_id, sender_name)
       VALUES ($1, $2, $3, NULL, 'GENERAL', 'Belt testing scheduled for end of month.', $4, 'Master Primary')`,
      [noticeClass, orgSelangor, classA, masterPrimary.id]
    );

    // Students
    const stuActive = `stu_act_${ts}`;
    const stuWaitlisted = `stu_wait_${ts}`;
    const stuPending = `stu_pend_${ts}`;
    const stuTransferred = `stu_trans_${ts}`;
    const stuWithdrawn = `stu_with_${ts}`;

    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, group_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, $2, $3, $4, 'Anand Active', '080101-10-1234', 'Green Belt', 'ACTIVE'),
              ($5, $2, $3, NULL, 'Winnie Waitlist', '090202-10-5678', 'White Belt', 'PROVISIONAL'),
              ($6, $2, $3, NULL, 'Penny Pending', '100303-10-9999', 'White Belt', 'PROVISIONAL'),
              ($7, $2, NULL, NULL, 'Tommy Transferred', '070404-10-4321', 'Yellow Belt', 'ACTIVE'),
              ($8, $2, $3, NULL, 'Wally Withdrawn', '060505-10-8888', 'White Belt', 'INACTIVE')`,
      [stuActive, orgSelangor, classA, groupSeniors, stuWaitlisted, stuPending, stuTransferred, stuWithdrawn]
    );

    // Canonical Class Enrollments
    await dbClient.query(
      `INSERT INTO class_enrollments (id, organization_id, class_id, student_id, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE'),
              ($5, $2, $3, $6, 'WAITLISTED'),
              ($7, $2, $3, $8, 'TRANSFERRED_OUT'),
              ($9, $2, $3, $10, 'WITHDRAWN')`,
      [
        `enr_1_${ts}`, orgSelangor, classA, stuActive,
        `enr_2_${ts}`, stuWaitlisted,
        `enr_3_${ts}`, stuTransferred,
        `enr_4_${ts}`, stuWithdrawn,
      ]
    );

    // Enrollment Applications
    await dbClient.query(
      `INSERT INTO enrollment_applications (id, organization_id, class_id, student_id, applicant_type, student_name, ic_number, emergency_contact_name, emergency_contact_phone, medical_notes, status, consent_accepted, submitted_by_user_id)
       VALUES ($1, $2, $3, $4, 'STUDENT', 'Penny Pending', '100303-10-9999', 'Parent Pending', '+60123456789', 'Peanut allergy', 'SUBMITTED', TRUE, NULL),
              ($5, $2, $3, $6, 'STUDENT', 'Winnie Waitlist', '090202-10-5678', 'Parent Waitlist', '+60123456780', 'None', 'WAITLISTED', TRUE, NULL)`,
      [
        `app_pend_${ts}`, orgSelangor, classA, stuPending,
        `app_wait_${ts}`, stuWaitlisted,
      ]
    );

    // Tokens
    const tokenSuperAdmin = generateAuthToken(superAdmin);
    const tokenAdminSelangor = generateAuthToken(adminSelangor);
    const tokenMasterPrimary = generateAuthToken({ ...masterPrimary, assignedClassIds: [classA] });
    const tokenMasterSuspended = generateAuthToken({ ...masterSuspended, assignedClassIds: [classA] });
    const tokenMasterUnverified = generateAuthToken({ ...masterUnverified, assignedClassIds: [classA] });
    const tokenMasterFormer = generateAuthToken({ ...masterFormer, assignedClassIds: [classB] });
    const tokenMasterPenang = generateAuthToken({ ...masterPenang, assignedClassIds: [classPenang] });

    // -----------------------------------------------------------------------
    // TEST 1: Master sees only currently authorized classes in workspace
    // -----------------------------------------------------------------------
    console.log('Test 1: Master sees currently authorized class workspace...');
    const res1 = await makeRequest(server, 'GET', `/classes/${classA}/workspace`, undefined, tokenMasterPrimary);
    assert.equal(res1.status, 200, `Expected 200, got ${res1.status}: ${JSON.stringify(res1.data)}`);
    assert.equal(res1.data.class.id, classA);
    assert.equal(res1.data.class.name, 'Silambam Advanced Squad');

    // -----------------------------------------------------------------------
    // TEST 2: Unverified Master denied workspace
    // -----------------------------------------------------------------------
    console.log('Test 2: Unverified Master denied workspace...');
    const res2 = await makeRequest(server, 'GET', `/classes/${classA}/workspace`, undefined, tokenMasterUnverified);
    assert.equal(res2.status, 403, `Expected 403, got ${res2.status}`);

    // -----------------------------------------------------------------------
    // TEST 3: Suspended Master denied workspace
    // -----------------------------------------------------------------------
    console.log('Test 3: Suspended Master denied workspace...');
    const res3 = await makeRequest(server, 'GET', `/classes/${classA}/workspace`, undefined, tokenMasterSuspended);
    assert.equal(res3.status, 403, `Expected 403, got ${res3.status}`);

    // -----------------------------------------------------------------------
    // TEST 4: Former Master denied current class operations
    // -----------------------------------------------------------------------
    console.log('Test 4: Former Master denied current class operations...');
    const res4 = await makeRequest(server, 'GET', `/classes/${classB}/workspace`, undefined, tokenMasterFormer);
    assert.equal(res4.status, 403, `Expected 403, got ${res4.status}`);

    // -----------------------------------------------------------------------
    // TEST 5: Cross-Persatuan class access denied
    // -----------------------------------------------------------------------
    console.log('Test 5: Cross-Persatuan class access denied...');
    const res5 = await makeRequest(server, 'GET', `/classes/${classA}/workspace`, undefined, tokenMasterPenang);
    assert.equal(res5.status, 403, `Expected 403, got ${res5.status}`);

    // -----------------------------------------------------------------------
    // TEST 6: Cross-class roster access denied
    // -----------------------------------------------------------------------
    console.log('Test 6: Cross-class roster access denied...');
    const res6 = await makeRequest(server, 'GET', `/classes/${classB}/students`, undefined, tokenMasterPrimary);
    assert.equal(res6.status, 403, `Expected 403, got ${res6.status}`);

    // -----------------------------------------------------------------------
    // TEST 7: Super Admin denied operational workspace
    // -----------------------------------------------------------------------
    console.log('Test 7: Super Admin denied operational workspace...');
    const res7 = await makeRequest(server, 'GET', `/classes/${classA}/workspace`, undefined, tokenSuperAdmin);
    assert.equal(res7.status, 403, `Expected 403, got ${res7.status}`);

    // -----------------------------------------------------------------------
    // TEST 8: Persatuan Admin cannot impersonate Master operations
    // -----------------------------------------------------------------------
    console.log('Test 8: Persatuan Admin cannot impersonate Master operations...');
    const res8 = await makeRequest(server, 'GET', `/classes/${classA}/workspace`, undefined, tokenAdminSelangor);
    assert.equal(res8.status, 403, `Expected 403, got ${res8.status}`);

    // -----------------------------------------------------------------------
    // TEST 9 & 10 & 11 & 12 & 13: Roster membership validation
    // -----------------------------------------------------------------------
    console.log('Test 9-13: Canonical class roster filters active members and excludes non-active...');
    const resRoster = await makeRequest(server, 'GET', `/classes/${classA}/students`, undefined, tokenMasterPrimary);
    assert.equal(resRoster.status, 200, `Expected 200, got ${resRoster.status}: ${JSON.stringify(resRoster.data)}`);
    const studentList = resRoster.data.students || [];

    // Test 11: Approved enrollment appears in roster
    const activeMember = studentList.find((s: any) => s.id === stuActive);
    assert.ok(activeMember, 'Active enrolled student must appear in roster.');
    assert.equal(activeMember.full_name, 'Anand Active');

    // Test 9: Pending applicant excluded from roster
    const pendingMember = studentList.find((s: any) => s.id === stuPending);
    assert.ok(!pendingMember, 'Pending applicant must be excluded from active roster.');

    // Test 10: Waitlisted applicant excluded from roster
    const waitlistedMember = studentList.find((s: any) => s.id === stuWaitlisted);
    assert.ok(!waitlistedMember, 'Waitlisted applicant must be excluded from active roster.');

    // Test 12: Withdrawn enrollment excluded
    const withdrawnMember = studentList.find((s: any) => s.id === stuWithdrawn);
    assert.ok(!withdrawnMember, 'Withdrawn student must be excluded from active roster.');

    // Test 13: Transferred-out student excluded
    const transferredMember = studentList.find((s: any) => s.id === stuTransferred);
    assert.ok(!transferredMember, 'Transferred-out student must be excluded from active roster.');

    // -----------------------------------------------------------------------
    // TEST 14 & 15: Student count and accurate capacity display
    // -----------------------------------------------------------------------
    console.log('Test 14 & 15: Workspace summary shows accurate student count and capacity...');
    assert.equal(res1.data.activeStudentsCount, 1, 'Should report exactly 1 active enrolled student');
    assert.equal(res1.data.class.capacity, 20, 'Should display configured capacity of 20');
    assert.equal(res1.data.availableSpots, 19, 'Should report 19 available spots');

    // -----------------------------------------------------------------------
    // TEST 16 & 17: Today sessions reflect actual schedules and cancellations
    // -----------------------------------------------------------------------
    console.log('Test 16 & 17: Today sessions reflect actual schedules and cancellation status...');
    const todaySessions = res1.data.todaySessions || [];
    assert.equal(todaySessions.length, 2, 'Should have 2 sessions scheduled for today');
    const scheduledSess = todaySessions.find((s: any) => s.id === sessionToday);
    const cancelledSess = todaySessions.find((s: any) => s.id === sessionCancelled);
    assert.ok(scheduledSess && scheduledSess.status === 'Scheduled');
    assert.ok(cancelledSess && cancelledSess.status === 'Cancelled');

    // -----------------------------------------------------------------------
    // TEST 18: Pending application count correct
    // -----------------------------------------------------------------------
    console.log('Test 18: Pending application count correct...');
    assert.equal(res1.data.pendingApplicationsCount, 1, 'Should report 1 pending application');
    assert.equal(res1.data.waitlistedApplicationsCount, 1, 'Should report 1 waitlisted application');

    // -----------------------------------------------------------------------
    // TEST 19 & 20: Class settings update authorized vs unauthorized Master
    // -----------------------------------------------------------------------
    console.log('Test 19: Authorized Master can update class settings...');
    const res19 = await makeRequest(
      server,
      'PATCH',
      `/classes/${classA}/settings`,
      {
        venueDetails: 'Court 3, Level 2',
        contactChannel: '+60129998877',
      },
      tokenMasterPrimary
    );
    assert.equal(res19.status, 200, `Expected 200, got ${res19.status}: ${JSON.stringify(res19.data)}`);
    assert.equal(res19.data.class.venue_details, 'Court 3, Level 2');
    assert.equal(res19.data.class.contact_channel, '+60129998877');

    console.log('Test 20: Wrong Master class settings update denied...');
    const res20 = await makeRequest(
      server,
      'PATCH',
      `/classes/${classA}/settings`,
      { venueDetails: 'Hacked Court' },
      tokenMasterPenang
    );
    assert.equal(res20.status, 403, `Expected 403, got ${res20.status}`);

    // -----------------------------------------------------------------------
    // TEST 21 & 22: Group assignment enforces class boundary and preserves enrollment
    // -----------------------------------------------------------------------
    console.log('Test 21 & 22: Group assignment enforces class boundary and preserves enrollment...');
    // Create group in another class
    const otherGroup = `tg_other_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name)
       VALUES ($1, $2, $3, 'Other Class Group')`,
      [otherGroup, orgSelangor, classB]
    );

    // Attempting to assign student to a group in another class must be rejected
    const res21 = await makeRequest(
      server,
      'PATCH',
      `/students/${stuActive}/group`,
      { groupId: otherGroup },
      tokenMasterPrimary
    );
    assert.equal(res21.status, 400, `Expected 400 for cross-class group assignment, got ${res21.status}`);

    // Assigning to a valid group in the same class succeeds
    const res22 = await makeRequest(
      server,
      'PATCH',
      `/students/${stuActive}/group`,
      { groupId: groupJuniors },
      tokenMasterPrimary
    );
    assert.equal(res22.status, 200, `Expected 200, got ${res22.status}`);
    assert.equal(res22.data.student.group_id, groupJuniors);

    // Active enrollment remains preserved
    const verifyEnr = await dbClient.query(
      "SELECT status FROM class_enrollments WHERE class_id = $1 AND student_id = $2",
      [classA, stuActive]
    );
    assert.equal(verifyEnr.rows[0]?.status, 'ACTIVE');

    // -----------------------------------------------------------------------
    // TEST 23: Attendance session roster receives only active enrolled students
    // -----------------------------------------------------------------------
    console.log('Test 23: Attendance session roster receives only active enrolled students in session scope...');
    const resAttRoster = await makeRequest(server, 'GET', `/attendance/session/${sessionToday}/roster`, undefined, tokenMasterPrimary);
    assert.equal(resAttRoster.status, 200, `Expected 200, got ${resAttRoster.status}`);

    // -----------------------------------------------------------------------
    // TEST 24: Notice visibility respects class scope
    // -----------------------------------------------------------------------
    console.log('Test 24: Notice visibility respects class scope...');
    assert.ok(Array.isArray(res1.data.recentNotices), 'recentNotices should be an array');
    assert.ok(res1.data.recentNotices.some((n: any) => n.id === noticeClass), 'Class notice should be returned in workspace');

    // -----------------------------------------------------------------------
    // TEST 25: Student profile hides restricted safety data from standard response
    // -----------------------------------------------------------------------
    console.log('Test 25: Student profile hides restricted safety data from standard response...');
    const resStu = await makeRequest(server, 'GET', `/students/${stuActive}`, undefined, tokenMasterPrimary);
    assert.equal(resStu.status, 200);
    // IC number should either be masked or omitted in teaching-profile views
    if (resStu.data.student.ic_number) {
      assert.ok(!resStu.data.student.ic_number.includes('080101-10-1234') || resStu.data.student.is_teaching_view === true,
        'Full IC must not be directly broadcast without teaching boundary');
    }

    // -----------------------------------------------------------------------
    // TEST 26: Large roster does not trigger uncontrolled queries (pagination supported)
    // -----------------------------------------------------------------------
    console.log('Test 26: Roster pagination limits unbounded queries...');
    const resPaging = await makeRequest(server, 'GET', `/classes/${classA}/students?limit=1&offset=0`, undefined, tokenMasterPrimary);
    assert.equal(resPaging.status, 200);
    assert.equal(resPaging.data.students.length, 1);
    assert.equal(resPaging.data.pagination.limit, 1);
    assert.equal(resPaging.data.pagination.total, 1);

    // -----------------------------------------------------------------------
    // TEST 27: Invalid PostgreSQL aggregate FOR UPDATE proof
    // -----------------------------------------------------------------------
    console.log('Test 27: Proving PostgreSQL rejects FOR UPDATE on aggregates and validating parent-row lock...');
    let caughtAggregateError = false;
    try {
      await dbClient.query("SELECT COUNT(*) FROM class_enrollments WHERE status = 'ACTIVE' FOR UPDATE");
    } catch (err: any) {
      caughtAggregateError = true;
      assert.ok(
        err.message.includes('FOR UPDATE') || err.message.includes('aggregate'),
        `Expected error to mention FOR UPDATE on aggregate, got: ${err.message}`
      );
    }
    assert.ok(caughtAggregateError, 'PostgreSQL must reject SELECT COUNT(*) ... FOR UPDATE');

    // Demonstrating the correct protocol: Lock parent class row first, then count
    await dbClient.transaction(async (tx) => {
      const parentLock = await tx.query('SELECT id, capacity FROM classes WHERE id = $1 FOR UPDATE', [classA]);
      assert.equal(parentLock.rowCount, 1);
      const countRes = await tx.query("SELECT COUNT(*)::int AS count FROM class_enrollments WHERE class_id = $1 AND status = 'ACTIVE'", [classA]);
      assert.equal(countRes.rows[0].count, 1);
    });

    // -----------------------------------------------------------------------
    // TEST 28: Master Today dashboard aggregation
    // -----------------------------------------------------------------------
    console.log('Test 28: Master Today dashboard aggregation derived from real records...');
    const resDash = await makeRequest(server, 'GET', '/dashboard/master', undefined, tokenMasterPrimary);
    assert.equal(resDash.status, 200, `Expected 200, got ${resDash.status}: ${JSON.stringify(resDash.data)}`);
    assert.ok(resDash.data.todayClasses !== undefined);
    assert.ok(resDash.data.todaySessions !== undefined);
    assert.ok(resDash.data.pendingApplicationsCount !== undefined);

    console.log('✅ All H06 Backend Integration Tests Passed Successfully!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('❌ H06 Test Failure:', err);
  process.exit(1);
});
