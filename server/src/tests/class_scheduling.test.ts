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
  console.log('🧪 Starting Class Scheduling & Membership Foundation (Task H10) Integration Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const orgId = `org_sched_${Date.now()}`;
    const masterId = `usr_master_${Date.now()}`;
    const otherMasterId = `usr_other_master_${Date.now()}`;
    const adminId = `usr_admin_${Date.now()}`;
    const student1Id = `stu_1_${Date.now()}`;
    const student2Id = `stu_2_${Date.now()}`;
    const classId = `cls_sched_${Date.now()}`;

    const testRun = Date.now();
    // Seed organization
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, sibling_discount_percent, status)
       VALUES ($1, 'Klang Silambam Academy', 'Selangor', 'Silambam', 'Master Guru', '0123456789', $2, 120, 10, 'ACTIVE')`,
      [orgId, `org_sched_${testRun}@beltflow.test`]
    );

    // Seed users
    const masterUser = { id: masterId, organizationId: orgId, email: `master_sched_${testRun}@beltflow.test`, role: UserRole.MASTER };
    const otherMasterUser = { id: otherMasterId, organizationId: orgId, email: `other_master_${testRun}@beltflow.test`, role: UserRole.MASTER };
    const adminUser = { id: adminId, organizationId: orgId, email: `admin_sched_${testRun}@beltflow.test`, role: UserRole.ADMIN_PERSATUAN };

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'hash', 'Master Kumar', 'MASTER', 'ACTIVE'),
              ($4, $2, $5, 'hash', 'Master Wong', 'MASTER', 'ACTIVE'),
              ($6, $2, $7, 'hash', 'Admin Aminah', 'ADMIN_PERSATUAN', 'ACTIVE')`,
      [masterId, orgId, masterUser.email, otherMasterId, otherMasterUser.email, adminId, adminUser.email]
    );

    // Seed class with capacity = 25
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, monthly_fee, capacity, enrollment_availability, status)
       VALUES ($1, $2, $3, $3, 'Klang Silambam Warriors', 'Tue & Thu 6:00 PM', 'Hall 1', 120, 25, 'OPEN', 'ACTIVE')`,
      [classId, orgId, masterId]
    );

    // Assign Master as PRIMARY leader
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [`lead_${testRun}`, classId, masterId, orgId]
    );

    // Seed students & enrollments
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

    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary)
       VALUES ($1, $2, $4, $5, 'ACTIVE', TRUE),
              ($3, $6, $4, $5, 'ACTIVE', TRUE)`,
      [`enr_1_${Date.now()}`, student1Id, `enr_2_${Date.now()}`, classId, orgId, student2Id]
    );

    // Seed a training group
    const groupId = `grp_youth_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name, created_by)
       VALUES ($1, $2, $3, 'Youth Training Group', $4)`,
      [groupId, orgId, classId, masterId]
    );

    // Seed recurring schedules (Tuesday & Thursday)
    const schedTueId = `sched_tue_${Date.now()}`;
    const schedThuId = `sched_thu_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO class_schedules (id, organization_id, class_id, group_id, day_of_week, start_time, end_time, location, recurring, created_by)
       VALUES ($1, $3, $4, $5, 'Tuesday', '6:00 PM', '7:30 PM', 'Dojo A', TRUE, $6),
              ($2, $3, $4, $5, 'Thursday', '6:00 PM', '7:30 PM', 'Dojo A', TRUE, $6)`,
      [schedTueId, schedThuId, orgId, classId, groupId, masterId]
    );

    const tokenMaster = generateAuthToken(masterUser as any);
    const tokenOtherMaster = generateAuthToken(otherMasterUser as any);
    const tokenAdmin = generateAuthToken(adminUser as any);

    // TEST 1: Generate recurring sessions for a 2-week window
    // 2026-11-01 (Sunday) to 2026-11-14 (Saturday):
    // In this 14-day window:
    // Tuesdays: Nov 3, Nov 10 (2 sessions)
    // Thursdays: Nov 5, Nov 12 (2 sessions)
    // Total expected = 4 sessions
    console.log('Test 1: Generate recurring sessions for date range');
    const res1 = await makeRequest(
      server,
      'POST',
      `/classes/${classId}/schedules/generate-sessions`,
      {
        startDate: '2026-11-01',
        endDate: '2026-11-14',
      },
      tokenMaster
    );
    assert.equal(res1.status, 201);
    assert.equal(res1.data.generatedCount, 4);
    assert.equal(res1.data.skippedCount, 0);
    assert.equal(res1.data.sessions.length, 4);
    const generatedSessions = res1.data.sessions;
    console.log(`✅ Test 1 Passed: Successfully generated ${res1.data.generatedCount} recurring sessions.`);

    // TEST 2: Idempotent regeneration skips existing sessions
    console.log('Test 2: Idempotent generation skips existing sessions');
    const res2 = await makeRequest(
      server,
      'POST',
      `/classes/${classId}/schedules/generate-sessions`,
      {
        startDate: '2026-11-01',
        endDate: '2026-11-14',
      },
      tokenMaster
    );
    assert.equal(res2.status, 201);
    assert.equal(res2.data.generatedCount, 0);
    assert.equal(res2.data.skippedCount, 4);
    console.log('✅ Test 2 Passed: 0 new sessions generated, 4 existing sessions skipped.');

    // TEST 3: Validation on date range (rejects range > 90 days or startDate > endDate)
    console.log('Test 3: Date range bounds validation');
    const res3InvalidRange = await makeRequest(
      server,
      'POST',
      `/classes/${classId}/schedules/generate-sessions`,
      {
        startDate: '2026-11-15',
        endDate: '2026-11-01',
      },
      tokenMaster
    );
    assert.equal(res3InvalidRange.status, 400);

    const res3Exceeds90 = await makeRequest(
      server,
      'POST',
      `/classes/${classId}/schedules/generate-sessions`,
      {
        startDate: '2026-01-01',
        endDate: '2026-05-01',
      },
      tokenMaster
    );
    assert.equal(res3Exceeds90.status, 400);
    assert.match(res3Exceeds90.data.error, /cannot exceed 90 days/);
    console.log('✅ Test 3 Passed: Invalid date ranges correctly rejected.');

    // TEST 4: Unauthorized Master cannot generate sessions for another class
    console.log('Test 4: RBAC boundary on session generation');
    const res4 = await makeRequest(
      server,
      'POST',
      `/classes/${classId}/schedules/generate-sessions`,
      {
        startDate: '2026-11-01',
        endDate: '2026-11-14',
      },
      tokenOtherMaster
    );
    assert.equal(res4.status, 403);
    console.log('✅ Test 4 Passed: Non-assigned Master forbidden from session generation.');

    // TEST 5: Cancel session with mandatory reason
    console.log('Test 5: Dedicated session cancellation');
    const targetSession = generatedSessions[0];
    const res5NoReason = await makeRequest(
      server,
      'PATCH',
      `/classes/sessions/${targetSession.id}/cancel`,
      {},
      tokenMaster
    );
    assert.equal(res5NoReason.status, 400);
    assert.match(res5NoReason.data.error, /reason is required/);

    const res5Cancel = await makeRequest(
      server,
      'PATCH',
      `/classes/sessions/${targetSession.id}/cancel`,
      {
        reason: 'Master attending National Silambam Technical Symposium',
        notifyGroup: true,
      },
      tokenMaster
    );
    assert.equal(res5Cancel.status, 200);
    assert.equal(res5Cancel.data.session.status, 'Cancelled');
    assert.equal(res5Cancel.data.session.cancelled_reason, 'Master attending National Silambam Technical Symposium');

    // Verify cancellation notice was created
    const noticeCheck = await dbClient.query('SELECT * FROM notices WHERE session_id = $1', [targetSession.id]);
    assert.equal(noticeCheck.rowCount, 1);
    assert.equal(noticeCheck.rows[0].type, 'CANCELLED');
    console.log('✅ Test 5 Passed: Session cancelled with reason and notice created.');

    // TEST 6: Session Attendance Roster endpoint
    console.log('Test 6: Session attendance roster includes active class members');
    const activeSession = generatedSessions[1];
    const res6 = await makeRequest(server, 'GET', `/classes/sessions/${activeSession.id}/roster`, null, tokenMaster);
    assert.equal(res6.status, 200);
    assert.equal(res6.data.session.id, activeSession.id);
    assert.equal(res6.data.roster.length, 2);
    assert.equal(res6.data.roster[0].attendance_status, 'Unmarked');
    console.log('✅ Test 6 Passed: Session roster returned 2 active enrolled students.');

    // TEST 7: Mark attendance and verify session roster status updates
    console.log('Test 7: Attendance marking reflected in session roster');
    await dbClient.query(
      `INSERT INTO session_attendance (id, session_id, student_id, status, marked_by)
       VALUES ($1, $2, $3, 'Present', $4)`,
      [`satt_${Date.now()}`, activeSession.id, student1Id, masterId]
    );

    const res7 = await makeRequest(server, 'GET', `/classes/sessions/${activeSession.id}/roster`, null, tokenMaster);
    assert.equal(res7.status, 200);
    const kavitha = res7.data.roster.find((r: any) => r.id === student1Id);
    assert.equal(kavitha.attendance_status, 'Present');
    const ahmad = res7.data.roster.find((r: any) => r.id === student2Id);
    assert.equal(ahmad.attendance_status, 'Unmarked');
    console.log('✅ Test 7 Passed: Attendance status updated in session roster.');

    // TEST 8: Class Memberships endpoint
    console.log('Test 8: Class memberships list with attendance calculations');
    const res8 = await makeRequest(server, 'GET', `/classes/${classId}/memberships`, null, tokenMaster);
    assert.equal(res8.status, 200);
    assert.equal(res8.data.memberships.length, 2);
    assert.equal(res8.data.memberships[0].enrollment_status, 'ACTIVE');
    console.log('✅ Test 8 Passed: Class memberships list verified.');

    // TEST 9: Membership lifecycle status transitions (ACTIVE -> PAUSED -> ACTIVE -> ENDED)
    console.log('Test 9: Membership status transition (ACTIVE -> PAUSED)');
    const res9Pause = await makeRequest(
      server,
      'PATCH',
      `/classes/${classId}/memberships/${student2Id}/status`,
      { status: 'PAUSED', reason: 'School examination period' },
      tokenMaster
    );
    assert.equal(res9Pause.status, 200);
    assert.equal(res9Pause.data.enrollment.status, 'PAUSED');

    console.log('Test 9b: Membership status transition (PAUSED -> ENDED)');
    const res9End = await makeRequest(
      server,
      'PATCH',
      `/classes/${classId}/memberships/${student2Id}/status`,
      { status: 'ENDED', reason: 'Relocated to Johor' },
      tokenMaster
    );
    assert.equal(res9End.status, 200);
    assert.equal(res9End.data.enrollment.status, 'ENDED');
    assert.ok(res9End.data.enrollment.effective_to);

    // Verify student status was set to INACTIVE since they have no other active class enrollments
    const stu2Check = await dbClient.query('SELECT status FROM students WHERE id = $1', [student2Id]);
    assert.equal(stu2Check.rows[0].status, 'INACTIVE');
    console.log('✅ Test 9 Passed: Membership transitions executed cleanly.');

    // TEST 10: Capacity status endpoint
    console.log('Test 10: Class capacity status evaluation');
    const res10 = await makeRequest(server, 'GET', `/classes/${classId}/capacity-status`, null, tokenMaster);
    assert.equal(res10.status, 200);
    assert.equal(res10.data.capacity, 25);
    // Student 1 is ACTIVE, Student 2 is ENDED -> enrolledCount = 1
    assert.equal(res10.data.enrolledCount, 1);
    assert.equal(res10.data.availableSpots, 24);
    assert.equal(res10.data.isAtCapacity, false);
    assert.equal(res10.data.enrollmentAvailability, 'OPEN');
    console.log('✅ Test 10 Passed: Capacity status evaluated correctly.');

    console.log('\n🎉 ALL 10 CLASS SCHEDULING & MEMBERSHIP FOUNDATION TESTS PASSED!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
