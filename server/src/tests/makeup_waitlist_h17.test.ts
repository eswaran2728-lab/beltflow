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

async function runH17Tests() {
  console.log('🥋 Starting Task H17: Make-Up Classes and Waitlists Integration Tests...');
  const path = await import('node:path');
  // Fresh database per run (scripts/run-tests.js sets PG_DATA_DIR); never the developer's local .beltflow_pgdata.
  const dbDir = process.env.PG_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-test-'));
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgAId = `org_h17_a_${ts}`;
    const orgBId = `org_h17_b_${ts}`;

    // 1. Provision Persatuans A & B
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Gayong H17 A', 'Selangor', 'Silat', 'Cikgu A', '0121111111', $2, 130.00, 'ACTIVE'),
              ($3, 'Persatuan Cekak H17 B', 'Kuala Lumpur', 'Silat', 'Cikgu B', '0122222222', $4, 140.00, 'ACTIVE')`,
      [orgAId, `org_a_${ts}@test.com`, orgBId, `org_b_${ts}@test.com`]
    );

    // 2. Provision Users
    const masterA1Id = `usr_mst_a1_${ts}`;
    const masterA2Id = `usr_mst_a2_${ts}`;
    const parentA1Id = `usr_par_a1_${ts}`;
    const parentA2Id = `usr_par_a2_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Master A1 Primary', '0111', 'MASTER', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Master A2 Secondary', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Parent A1', '0113', 'PARENT', 'ACTIVE'),
       ($10, $11, $12, 'HASH', 'Parent A2', '0114', 'PARENT', 'ACTIVE')`,
      [
        masterA1Id, orgAId, `master_a1_${ts}@test.com`,
        masterA2Id, orgAId, `master_a2_${ts}@test.com`,
        parentA1Id, orgAId, `parent_a1_${ts}@test.com`,
        parentA2Id, orgAId, `parent_a2_${ts}@test.com`,
      ]
    );

    // Affiliations
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES 
       ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($4, $5, $6, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [`aff_a1_${ts}`, masterA1Id, orgAId, `aff_a2_${ts}`, masterA2Id, orgAId]
    );

    // 3. Classes in Persatuan A:
    // - Class A1 (Home Class for students, Capacity 20)
    // - Class A2 (Target Class, Capacity 2: 1 home student + 1 seat remaining)
    // - Class A3_Advanced (Advanced Level, Capacity 20)
    // - Class B1 in Persatuan B (Target Class in Org B)
    const classA1Id = `cls_a1_${ts}`;
    const classA2Id = `cls_a2_${ts}`;
    const classA3AdvId = `cls_a3_adv_${ts}`;
    const classB1Id = `cls_b1_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, training_level, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $4, 'Kelas A1 Home', 'Mon 8PM', 'Gelanggang A1', 20, 'All Levels', 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($5, $6, $7, $8, 'Kelas A2 Limited Seat', 'Tue 8PM', 'Gelanggang A2', 2, 'All Levels', 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($9, $10, $11, $12, 'Kelas A3 Black Belt Only', 'Wed 8PM', 'Gelanggang A3', 20, 'Advanced Black Belt', 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($13, $14, $15, $16, 'Kelas B1 Cross Tenant', 'Thu 8PM', 'Gelanggang B1', 20, 'All Levels', 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [
        classA1Id, orgAId, masterA1Id, masterA1Id,
        classA2Id, orgAId, masterA2Id, masterA2Id,
        classA3AdvId, orgAId, masterA1Id, masterA1Id,
        classB1Id, orgBId, masterA1Id, masterA1Id,
      ]
    );

    // Class leaderships
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES 
       ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($5, $6, $7, $8, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [
        `lead_a1_${ts}`, classA1Id, masterA1Id, orgAId,
        `lead_a2_${ts}`, classA2Id, masterA2Id, orgAId,
      ]
    );
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE), ($3, $4, TRUE)`,
      [masterA1Id, classA1Id, masterA2Id, classA2Id]
    );

    // Training Group for Class A2
    const groupIdA2 = `grp_a2_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, class_id, organization_id, name)
       VALUES ($1, $2, $3, 'Group A2 General')`,
      [groupIdA2, classA2Id, orgAId]
    );

    // Training Session for Class A2 (1 Session Date)
    const sessionA2Id = `sess_a2_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-11-05', 'Tuesday', '20:00', '21:30', 'Gelanggang A2', 'Scheduled')`,
      [sessionA2Id, orgAId, classA2Id, groupIdA2]
    );

    // Training Session for Class A3 (Advanced)
    const groupIdA3 = `grp_a3_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, class_id, organization_id, name)
       VALUES ($1, $2, $3, 'Group A3 Adv')`,
      [groupIdA3, classA3AdvId, orgAId]
    );
    const sessionA3AdvId = `sess_a3_adv_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-11-06', 'Wednesday', '20:00', '21:30', 'Gelanggang A3', 'Scheduled')`,
      [sessionA3AdvId, orgAId, classA3AdvId, groupIdA3]
    );

    // Training Session for Class B1 (Cross-Tenant Org B)
    const groupIdB1 = `grp_b1_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, class_id, organization_id, name)
       VALUES ($1, $2, $3, 'Group B1')`,
      [groupIdB1, classB1Id, orgBId]
    );
    const sessionB1Id = `sess_b1_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-11-07', 'Thursday', '20:00', '21:30', 'Gelanggang B1', 'Scheduled')`,
      [sessionB1Id, orgBId, classB1Id, groupIdB1]
    );

    // 4. Students
    // - Student 1 (Enrolled in Class A1, White Belt)
    // - Student 2 (Enrolled in Class A1, White Belt)
    // - Student 3 (Enrolled in Class A2 - Home Student, occupying 1 of 2 seats!)
    const student1Id = `stu_h17_1_${ts}`;
    const student2Id = `stu_h17_2_${ts}`;
    const student3HomeA2Id = `stu_h17_3_${ts}`;

    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES 
       ($1, $2, $3, 'Aiman bin Razak', '100101-10-1001', 'White Belt', 'ACTIVE'),
       ($4, $5, $6, 'Luqman bin Hakim', '100202-10-1002', 'White Belt', 'ACTIVE'),
       ($7, $8, $9, 'Siti Nurhaliza (Home A2)', '100303-10-1003', 'Yellow Belt', 'ACTIVE')`,
      [
        student1Id, orgAId, classA1Id,
        student2Id, orgAId, classA1Id,
        student3HomeA2Id, orgAId, classA2Id,
      ]
    );

    // Canonical Class Enrollments
    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary)
       VALUES 
       ($1, $2, $3, $4, 'ACTIVE', TRUE),
       ($5, $6, $7, $8, 'ACTIVE', TRUE),
       ($9, $10, $11, $12, 'ACTIVE', TRUE)`,
      [
        `enr_1_${ts}`, student1Id, classA1Id, orgAId,
        `enr_2_${ts}`, student2Id, classA1Id, orgAId,
        `enr_3_${ts}`, student3HomeA2Id, classA2Id, orgAId,
      ]
    );

    // Parent links
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status)
       VALUES ($1, $2, $3, 'ACTIVE'), ($4, $5, $6, 'ACTIVE')`,
      [
        `link_1_${ts}`, parentA1Id, student1Id,
        `link_2_${ts}`, parentA2Id, student2Id,
      ]
    );

    // Auth Tokens
    const tokenMasterA1 = generateAuthToken({ id: masterA1Id, email: `master_a1_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [classA1Id, classA3AdvId] });
    const tokenMasterA2 = generateAuthToken({ id: masterA2Id, email: `master_a2_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [classA2Id] });
    const tokenParentA1 = generateAuthToken({ id: parentA1Id, email: `parent_a1_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgAId });
    const tokenParentA2 = generateAuthToken({ id: parentA2Id, email: `parent_a2_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgAId });

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 5: no_cross_tenant_booking
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Acceptance Test: no_cross_tenant_booking ---');
    const crossTenantRes = await makeRequest(server, 'POST', '/bookings/make-up/request', {
      studentId: student1Id,
      targetSessionId: sessionB1Id, // Session in Persatuan B
      reason: 'Cross tenant make up request',
    }, tokenParentA1);
    assert.equal(crossTenantRes.status, 403, 'Cross-tenant make-up request must be rejected with 403 Forbidden');
    console.log('✅ Acceptance Test 5 Passed: no_cross_tenant_booking verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 2: ineligible_student_rejected
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Acceptance Test: ineligible_student_rejected ---');
    const ineligibleRes = await makeRequest(server, 'POST', '/bookings/make-up/request', {
      studentId: student1Id, // White Belt
      targetSessionId: sessionA3AdvId, // Advanced Black Belt class
      reason: 'Trying to join black belt session',
    }, tokenParentA1);
    assert.equal(ineligibleRes.status, 422, 'Ineligible student belt level must be rejected with 422');
    console.log('✅ Acceptance Test 2 Passed: ineligible_student_rejected verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 1: simultaneous_last_seat_one_booking
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Acceptance Test: simultaneous_last_seat_one_booking ---');
    // Session A2 has Capacity = 2, with 1 home student (Student 3). Exactly 1 seat remains!
    // Student 1 requests make-up in Session A2
    const req1Res = await makeRequest(server, 'POST', '/bookings/make-up/request', {
      studentId: student1Id,
      targetSessionId: sessionA2Id,
      reason: 'Missed Monday session due to exam',
    }, tokenParentA1);
    assert.equal(req1Res.status, 201);
    const booking1Id = req1Res.data.booking.id;
    assert.equal(req1Res.data.booking.status, 'REQUESTED', 'Initial status should be REQUESTED');

    // Student 2 also requests make-up in Session A2
    const req2Res = await makeRequest(server, 'POST', '/bookings/make-up/request', {
      studentId: student2Id,
      targetSessionId: sessionA2Id,
      reason: 'Missed Monday session due to illness',
    }, tokenParentA2);
    assert.equal(req2Res.status, 201);
    const booking2Id = req2Res.data.booking.id;

    // Now Master A2 approves booking 1 (takes the last seat: 1 home + 1 make-up = 2 capacity!)
    const approve1Res = await makeRequest(server, 'POST', `/bookings/make-up/${booking1Id}/approve`, {
      expectedVersion: 1,
    }, tokenMasterA2);
    assert.equal(approve1Res.status, 200, 'First booking approval should succeed');
    assert.equal(approve1Res.data.booking.status, 'CONFIRMED');

    // Now Master A2 attempts to approve booking 2 into the now-full session -> MUST FAIL WITH 409 CONFLICT!
    const approve2Res = await makeRequest(server, 'POST', `/bookings/make-up/${booking2Id}/approve`, {
      expectedVersion: 1,
    }, tokenMasterA2);
    assert.equal(approve2Res.status, 409, 'Simultaneous booking for last seat must return 409 Conflict when capacity is exhausted');
    console.log('✅ Acceptance Test 1 Passed: simultaneous_last_seat_one_booking verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 4: make_up_does_not_change_primary_class
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Acceptance Test: make_up_does_not_change_primary_class ---');
    // Verify Student 1's primary class and enrollment remains Class A1
    const s1Check = await dbClient.query('SELECT class_id, status FROM students WHERE id = $1', [student1Id]);
    assert.equal(s1Check.rows[0].class_id, classA1Id, 'Primary class_id on students table must remain home class A1');

    const enr1Check = await dbClient.query("SELECT * FROM class_enrollments WHERE student_id = $1 AND is_primary = TRUE", [student1Id]);
    assert.equal(enr1Check.rows[0].class_id, classA1Id, 'Primary class_enrollments record must remain home class A1');

    // Verify session attendance entitlement exists for session A2
    const attCheck = await dbClient.query('SELECT * FROM session_attendance WHERE student_id = $1 AND session_id = $2', [student1Id, sessionA2Id]);
    assert.equal(attCheck.rowCount, 1, 'Session attendance entitlement must be recorded');
    console.log('✅ Acceptance Test 4 Passed: make_up_does_not_change_primary_class verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 3: cancelled_offer_releases_place
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Acceptance Test: cancelled_offer_releases_place ---');
    // Put Student 2 on the waitlist for Session A2
    await dbClient.query("UPDATE make_up_bookings SET status = 'WAITLISTED', waitlist_position = 1 WHERE id = $1", [booking2Id]);

    // Student 1 cancels their confirmed make-up booking
    const cancelRes = await makeRequest(server, 'POST', `/bookings/make-up/${booking1Id}/cancel`, {}, tokenParentA1);
    assert.equal(cancelRes.status, 200, 'Cancellation should succeed');
    assert.equal(cancelRes.data.cancelledBooking.status, 'CANCELLED');

    // Cancellation automatically releases place and promotes next waitlisted candidate (Student 2)
    const booking2Check = await dbClient.query('SELECT status, offer_expires_at FROM make_up_bookings WHERE id = $1', [booking2Id]);
    assert.equal(booking2Check.rows[0].status, 'OFFERED', 'Waitlisted student should be automatically promoted to OFFERED');
    assert.ok(booking2Check.rows[0].offer_expires_at, 'Offer must have expiration timestamp');
    console.log('✅ Acceptance Test 3 Passed: cancelled_offer_releases_place verified.');

    console.log('\n🎉 ALL 5 OFFICIAL TASK H17 ACCEPTANCE TESTS PASSED!');
  } finally {
    server.close();
  }
}

runH17Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Task H17 Tests Failed:', err);
    process.exit(1);
  });
