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
  token?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode || 500, data });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

async function runBookingSafetyTests() {
  console.log('🥋 Starting H17 Booking Safety & Entitlement Separation Regression Tests...');
  const path = await import('node:path');
  // Fresh database per run (scripts/run-tests.js sets PG_DATA_DIR); never the developer's local .beltflow_pgdata.
  const dbDir = process.env.PG_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-test-'));
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgId = `org_saf_${ts}`;

    // 1. Organization
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Safety H17', 'Selangor', 'Silat', 'Guru Safety', '0129998888', $2, 130.00, 'ACTIVE')`,
      [orgId, `safety_${ts}@beltflow.test`]
    );

    // 2. Users
    const masterHomeId = `usr_mst_home_${ts}`;
    const masterTargetId = `usr_mst_tgt_${ts}`;
    const parentId = `usr_par_saf_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Master Home', '0111', 'MASTER', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Master Target', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Parent Safety', '0113', 'PARENT', 'ACTIVE')`,
      [
        masterHomeId, orgId, `mst_home_${ts}@test.com`,
        masterTargetId, orgId, `mst_tgt_${ts}@test.com`,
        parentId, orgId, `par_saf_${ts}@test.com`,
      ]
    );

    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES 
       ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($4, $5, $6, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [`aff_h_${ts}`, masterHomeId, orgId, `aff_t_${ts}`, masterTargetId, orgId]
    );

    // 3. Classes
    const classHomeId = `cls_home_${ts}`;
    const classTargetId = `cls_tgt_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Home Class', 'Mon 8PM', 'Dojo Home', 20, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $5, $6, $6, 'Target Class Limited', 'Tue 8PM', 'Dojo Target', 2, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [classHomeId, orgId, masterHomeId, classTargetId, orgId, masterTargetId]
    );

    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES 
       ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($5, $6, $7, $8, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [
        `lead_h_${ts}`, classHomeId, masterHomeId, orgId,
        `lead_t_${ts}`, classTargetId, masterTargetId, orgId,
      ]
    );
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE), ($3, $4, TRUE)`,
      [masterHomeId, classHomeId, masterTargetId, classTargetId]
    );

    // Group & Session for Target Class
    const groupId = `grp_tgt_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, class_id, organization_id, name)
       VALUES ($1, $2, $3, 'Group General')`,
      [groupId, classTargetId, orgId]
    );

    const sessionId = `sess_tgt_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-11-20', 'Friday', '20:00', '21:30', 'Dojo Target', 'Scheduled')`,
      [sessionId, orgId, classTargetId, groupId]
    );

    // Students
    // Student 1 (in Home Class)
    const student1Id = `stu_saf_1_${ts}`;
    // Student 2 (Home Student in Target Class occupying 1 of 2 seats)
    const student2TargetHomeId = `stu_saf_2_${ts}`;
    // Student 3 (in Home Class, will be waitlisted)
    const student3WaitlistId = `stu_saf_3_${ts}`;

    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES 
       ($1, $2, $3, 'Safwan bin Razif', '110101-10-1101', 'White Belt', 'ACTIVE'),
       ($4, $5, $6, 'Target Home Student', '110202-10-1102', 'White Belt', 'ACTIVE'),
       ($7, $8, $9, 'Waitlist Candidate 3', '110303-10-1103', 'White Belt', 'ACTIVE')`,
      [
        student1Id, orgId, classHomeId,
        student2TargetHomeId, orgId, classTargetId,
        student3WaitlistId, orgId, classHomeId,
      ]
    );

    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary)
       VALUES 
       ($1, $2, $3, $4, 'ACTIVE', TRUE),
       ($5, $6, $7, $8, 'ACTIVE', TRUE),
       ($9, $10, $11, $12, 'ACTIVE', TRUE)`,
      [
        `enr_s1_${ts}`, student1Id, classHomeId, orgId,
        `enr_s2_${ts}`, student2TargetHomeId, classTargetId, orgId,
        `enr_s3_${ts}`, student3WaitlistId, classHomeId, orgId,
      ]
    );

    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status)
       VALUES ($1, $2, $3, 'ACTIVE'), ($4, $5, $6, 'ACTIVE')`,
      [
        `link_s1_${ts}`, parentId, student1Id,
        `link_s3_${ts}`, parentId, student3WaitlistId,
      ]
    );

    // Tokens
    const tokenMasterTarget = generateAuthToken({ id: masterTargetId, email: `mst_tgt_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgId, assignedClassIds: [classTargetId] });
    const tokenParent = generateAuthToken({ id: parentId, email: `par_saf_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgId });

    // ------------------------------------------------------------------------
    // REGRESSION TEST 1: Entitlement vs Actual Attendance
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Regression Test: Make-up approval sets Booked entitlement, NOT Present ---');
    // Request make-up for Student 1 in Target Class Session
    const req1 = await makeRequest(server, 'POST', '/bookings/make-up/request', {
      studentId: student1Id,
      targetSessionId: sessionId,
      reason: 'Need make up class',
    }, tokenParent);
    assert.equal(req1.status, 201);
    const booking1Id = req1.data.booking.id;

    // Master approves booking
    const app1 = await makeRequest(server, 'POST', `/bookings/make-up/${booking1Id}/approve`, {}, tokenMasterTarget);
    assert.equal(app1.status, 200);

    // Verify session_attendance record status is 'Booked'
    const attRec = await dbClient.query(
      'SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2',
      [sessionId, student1Id]
    );
    assert.equal(attRec.rowCount, 1, 'Session attendance entitlement record must exist');
    assert.equal(
      attRec.rows[0].status,
      'Booked',
      'Make-up approval must set entitlement status to "Booked", NOT "Present"'
    );

    // Verify student attendance count is NOT inflated in class memberships or grading
    const memRes = await makeRequest(server, 'GET', `/classes/${classHomeId}/memberships`, undefined, tokenMasterTarget);
    // Student 1's attended_sessions_count must be 0
    const student1Attended = await dbClient.query(
      "SELECT count(*)::int AS count FROM session_attendance WHERE student_id = $1 AND status IN ('Present', 'Late')",
      [student1Id]
    );
    assert.equal(Number(student1Attended.rows[0].count), 0, 'Entitlement must not count as attended sessions');
    console.log('✅ Regression Test 1 Passed: Entitlement stored safely as "Booked"; zero attendance inflation.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 2: Expired Waitlist Offer Cannot Be Accepted
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Regression Test: Expired waitlist offer rejected and released ---');
    // Session is now full (1 home student + 1 confirmed make-up = 2 capacity)
    // Student 3 requests make-up -> placed on WAITLIST
    const req3 = await makeRequest(server, 'POST', '/bookings/make-up/request', {
      studentId: student3WaitlistId,
      targetSessionId: sessionId,
      reason: 'Waitlist candidate',
    }, tokenParent);
    assert.equal(req3.status, 201);
    const booking3Id = req3.data.booking.id;
    assert.equal(req3.data.booking.status, 'WAITLISTED');

    // Simulate promotion to OFFERED with expired offer timestamp (in the past)
    await dbClient.query(
      `UPDATE make_up_bookings
       SET status = 'OFFERED',
           offer_expires_at = CURRENT_TIMESTAMP - INTERVAL '2 hours'
       WHERE id = $1`,
      [booking3Id]
    );

    // Parent attempts to accept expired offer -> MUST BE REJECTED (410 Gone / 400 Bad Request)
    const acceptRes = await makeRequest(server, 'POST', `/bookings/make-up/${booking3Id}/accept`, {}, tokenParent);
    assert.equal(acceptRes.status, 410, 'Accepting an expired offer must return 410 Gone');
    assert.ok(
      acceptRes.data.error.toLowerCase().includes('expired'),
      'Error message must clearly state offer expired'
    );

    // Verify booking status is transitioned to EXPIRED
    const b3Check = await dbClient.query('SELECT status FROM make_up_bookings WHERE id = $1', [booking3Id]);
    assert.equal(b3Check.rows[0].status, 'EXPIRED', 'Expired offer must be marked EXPIRED');
    console.log('✅ Regression Test 2 Passed: Expired offer cannot be accepted and transitioned to EXPIRED.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 3: Expired Offers Do Not Block Capacity
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Regression Test: Expired offers release capacity ---');
    // Verify that expired offer does not count as occupied seat
    const capCheck = await makeRequest(server, 'GET', `/bookings/sessions/${sessionId}`, undefined, tokenMasterTarget);
    // Capacity = 2, 1 home student + 1 confirmed booking1 = 2 occupied.
    // If student 1 cancels, available seat opens up, regardless of expired booking 3
    const cancel1 = await makeRequest(server, 'POST', `/bookings/make-up/${booking1Id}/cancel`, {}, tokenParent);
    assert.equal(cancel1.status, 200);

    const capAfterCancel = await makeRequest(server, 'GET', `/bookings/sessions/${sessionId}`, undefined, tokenMasterTarget);
    assert.equal(capAfterCancel.data.availableSeats, 1, 'Expired offer must not block capacity release');
    console.log('✅ Regression Test 3 Passed: Expired offer does not block capacity.');

    console.log('\n🎉 ALL H17 BOOKING SAFETY REGRESSION TESTS PASSED!');
  } finally {
    server.close();
  }
}

runBookingSafetyTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Booking Safety Tests Failed:', err);
    process.exit(1);
  });
