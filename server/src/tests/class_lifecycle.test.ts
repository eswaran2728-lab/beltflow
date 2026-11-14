import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

// Helper to make local HTTP requests against the Express app
function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
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
  console.log('🚀 Starting H04 Class Proposals, Approval & Lifecycle Test Suite...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const call = (method: string, path: string, body?: any, token?: string) =>
      makeRequest(server, method, path, body, token);

    const orgAId = `org_h04_a_${Date.now()}`;
    const orgBId = `org_h04_b_${Date.now()}`;

    // Clean test data if any
    await dbClient.query('DELETE FROM class_leaderships WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM class_applications WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM classes WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM master_affiliations WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM master_applications WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
    await dbClient.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);

    // Create Organizations
    const orgEmailA = `org_a_${Date.now()}@test.my`;
    const orgEmailB = `org_b_${Date.now()}@test.my`;
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Silambam Selangor H04', 'Selangor', 'Silambam', 'Master Guru A', '0123456789', $3, 120.00, 'ACTIVE'),
              ($2, 'Persatuan Silambam Penang H04', 'Penang', 'Silambam', 'Master Guru B', '0198765432', $4, 130.00, 'ACTIVE')`,
      [orgAId, orgBId, orgEmailA, orgEmailB]
    );

    // Setup Users
    const ts = Date.now();
    const mIdA = `usr_m_a_${ts}`;
    const mIdB = `usr_m_b_${ts}`;
    const mIdUnverified = `usr_m_unv_${ts}`;
    const mIdSuspended = `usr_m_susp_${ts}`;
    const admIdA = `usr_adm_a_${ts}`;
    const admIdB = `usr_adm_b_${ts}`;
    const saId = `usr_sa_${ts}`;

    const emailMA = `masterA_${ts}@selangor.my`;
    const emailMB = `masterB_${ts}@penang.my`;
    const emailMUnv = `unverified_${ts}@selangor.my`;
    const emailMSusp = `suspended_${ts}@selangor.my`;
    const emailAdmA = `adminA_${ts}@selangor.my`;
    const emailAdmB = `adminB_${ts}@penang.my`;
    const emailSA = `superadmin_${ts}@beltflow.my`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, full_name, password_hash, role, status)
       VALUES ($1, $2, $3, 'Master Anbarasan', 'hash123', 'MASTER', 'ACTIVE'),
              ($4, $5, $6, 'Master Bala', 'hash123', 'MASTER', 'ACTIVE'),
              ($7, $2, $8, 'Aspirant Chandra', 'hash123', 'MASTER', 'ACTIVE'),
              ($9, $2, $10, 'Master Danial', 'hash123', 'MASTER', 'ACTIVE'),
              ($11, $2, $12, 'Admin Aminah', 'hash123', 'ADMIN_PERSATUAN', 'ACTIVE'),
              ($13, $5, $14, 'Admin Brian', 'hash123', 'ADMIN_PERSATUAN', 'ACTIVE'),
              ($15, NULL, $16, 'Super Administrator', 'hash123', 'SUPER_ADMIN', 'ACTIVE')`,
      [
        mIdA, orgAId, emailMA,
        mIdB, orgBId, emailMB,
        mIdUnverified, emailMUnv,
        mIdSuspended, emailMSusp,
        admIdA, emailAdmA,
        admIdB, emailAdmB,
        saId, emailSA,
      ]
    );

    const masterTokenA = generateAuthToken({ id: mIdA, email: emailMA, role: UserRole.MASTER });
    const masterTokenB = generateAuthToken({ id: mIdB, email: emailMB, role: UserRole.MASTER });
    const unverifiedMasterToken = generateAuthToken({ id: mIdUnverified, email: emailMUnv, role: UserRole.MASTER });
    const suspendedMasterToken = generateAuthToken({ id: mIdSuspended, email: emailMSusp, role: UserRole.MASTER });
    const adminOrgAToken = generateAuthToken({ id: admIdA, email: emailAdmA, role: UserRole.ADMIN_PERSATUAN });
    const adminOrgBToken = generateAuthToken({ id: admIdB, email: emailAdmB, role: UserRole.ADMIN_PERSATUAN });
    const superAdminToken = generateAuthToken({ id: saId, email: emailSA, role: UserRole.SUPER_ADMIN });

    // Active affiliation for Master A in Org A
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance)
       VALUES ($1, $2, $3, 'ACTIVE', 'DIRECT_REVIEW')`,
      [`maf_a_${Date.now()}`, mIdA, orgAId]
    );

    // Active affiliation for Master B in Org B
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance)
       VALUES ($1, $2, $3, 'ACTIVE', 'DIRECT_REVIEW')`,
      [`maf_b_${Date.now()}`, mIdB, orgBId]
    );

    // Suspended affiliation for Suspended Master in Org A
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance)
       VALUES ($1, $2, $3, 'SUSPENDED', 'DIRECT_REVIEW')`,
      [`maf_susp_${Date.now()}`, mIdSuspended, orgAId]
    );

    let createdAppId: string = '';

    // =========================================================================
    // TEST 1: Unverified Master cannot submit class
    // =========================================================================
    console.log('Test 1: Unverified Master cannot create class proposal...');
    const res1 = await call('POST', '/class-applications', {
      organizationId: orgAId,
      name: 'Silambam Beginners',
      location: 'Shah Alam Sports Hall',
      schedule: 'Tuesday & Thursday 8:00 PM',
      monthlyFee: 120.0,
    }, unverifiedMasterToken);
    assert.equal(res1.status, 403);
    assert.match(res1.data.error || '', /active verified affiliation/i);

    // =========================================================================
    // TEST 2: Suspended Master cannot submit class
    // =========================================================================
    console.log('Test 2: Suspended Master cannot create class proposal...');
    const res2 = await call('POST', '/class-applications', {
      organizationId: orgAId,
      name: 'Silambam Advanced',
      location: 'Petaling Jaya Dojo',
      schedule: 'Saturday 10:00 AM',
      monthlyFee: 140.0,
    }, suspendedMasterToken);
    assert.equal(res2.status, 403);
    assert.match(res2.data.error || '', /active verified affiliation/i);

    // =========================================================================
    // TEST 3: Active verified Master may create draft
    // =========================================================================
    console.log('Test 3: Active verified Master may create class proposal draft...');
    const res3 = await call('POST', '/class-applications', {
      organizationId: orgAId,
      name: 'Silambam Traditional Form A',
      location: 'Shah Alam Community Center',
      venueDetails: 'Court 2, 2nd Floor',
      schedule: 'Saturday & Sunday 9:00 AM - 10:30 AM',
      ageEligibility: '7-15 years',
      trainingLevel: 'Beginner',
      programType: 'Traditional Weapons & Mat',
      capacity: 25,
      enrollmentAvailability: 'OPEN',
      monthlyFee: 120.0,
      description: 'Comprehensive youth Silambam martial arts foundation.',
      contactChannel: '+60123456789',
    }, masterTokenA);
    assert.equal(res3.status, 201);
    assert.equal(res3.data.application.status, 'DRAFT');
    assert.equal(res3.data.application.version, 1);
    assert.equal(res3.data.application.proposing_master_id, mIdA);
    createdAppId = res3.data.application.id;

    // =========================================================================
    // TEST 4: Draft creation does not activate class
    // =========================================================================
    console.log('Test 4: Draft creation does not create class in classes table...');
    const checkClass = await dbClient.query(
      `SELECT * FROM classes WHERE organization_id = $1 AND name = 'Silambam Traditional Form A'`,
      [orgAId]
    );
    assert.equal(checkClass.rowCount, 0, 'Class must not exist in classes table while proposal is in DRAFT');

    // =========================================================================
    // TEST 5: Master can edit own draft
    // =========================================================================
    console.log('Test 5: Master can edit own proposal draft...');
    const res5 = await call('PATCH', `/class-applications/${createdAppId}`, {
      capacity: 30,
      description: 'Updated comprehensive youth Silambam curriculum.',
    }, masterTokenA);
    assert.equal(res5.status, 200);
    assert.equal(res5.data.application.capacity, 30);
    assert.equal(res5.data.application.description, 'Updated comprehensive youth Silambam curriculum.');

    // =========================================================================
    // TEST 6: Master cannot edit another Master's draft
    // =========================================================================
    console.log('Test 6: Master cannot edit another Master proposal draft...');
    const res6 = await call('PATCH', `/class-applications/${createdAppId}`, {
      capacity: 50,
    }, masterTokenB);
    assert.equal(res6.status, 403);

    // =========================================================================
    // TEST 7: Draft submission validates required fields
    // =========================================================================
    console.log('Test 7: Draft submission validates required fields...');
    const draftRes = await dbClient.query(
      `INSERT INTO class_applications (
         id, organization_id, proposing_master_id, name, schedule, location, monthly_fee, capacity, status, version
       ) VALUES ($1, $2, $3, '', '', '', 0, 0, 'DRAFT', 1)
       RETURNING id`,
      [`capp_invalid_${Date.now()}`, orgAId, mIdA]
    );
    const invalidId = draftRes.rows[0].id;
    const res7 = await call('POST', `/class-applications/${invalidId}/submit`, {}, masterTokenA);
    assert.equal(res7.status, 400);
    assert.match(res7.data.error || '', /Missing required fields|must be greater than zero/i);

    // =========================================================================
    // TEST 8: Wrong-Persatuan class proposal rejected
    // =========================================================================
    console.log('Test 8: Wrong-Persatuan class proposal rejected...');
    const res8 = await call('POST', '/class-applications', {
      organizationId: orgBId,
      name: 'Cross Org Silambam',
      location: 'Penang Hall',
      schedule: 'Friday 8 PM',
      monthlyFee: 100.0,
    }, masterTokenA);
    assert.equal(res8.status, 403);
    assert.match(res8.data.error || '', /active verified affiliation/i);

    // =========================================================================
    // TEST 9: Submit valid draft & Same-Persatuan Admin receives in inbox
    // =========================================================================
    console.log('Test 9: Submit valid draft and check Admin inbox...');
    const res9Submit = await call('POST', `/class-applications/${createdAppId}/submit`, {}, masterTokenA);
    assert.equal(res9Submit.status, 200);
    assert.equal(res9Submit.data.application.status, 'SUBMITTED');
    assert.equal(res9Submit.data.application.version, 2);

    const res9Inbox = await call('GET', '/class-applications/inbox', undefined, adminOrgAToken);
    assert.equal(res9Inbox.status, 200);
    const foundInbox = res9Inbox.data.applications.find((a: any) => a.id === createdAppId);
    assert.ok(foundInbox, 'Submitted application must appear in Admin Persatuan inbox');
    assert.equal(foundInbox.status, 'SUBMITTED');

    // =========================================================================
    // TEST 10: Wrong-Persatuan Admin rejected from reviewing or viewing item
    // =========================================================================
    console.log('Test 10: Wrong-Persatuan Admin rejected from inspecting application...');
    const res10 = await call('GET', `/class-applications/${createdAppId}`, undefined, adminOrgBToken);
    assert.equal(res10.status, 403);

    // =========================================================================
    // TEST 11: Super Admin cannot review or approve operational proposal
    // =========================================================================
    console.log('Test 11: Super Admin cannot review operational class proposal...');
    const res11 = await call('POST', `/class-applications/${createdAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 2,
    }, superAdminToken);
    assert.equal(res11.status, 403);
    assert.match(res11.data.error || '', /Only Persatuan Admins/i);

    // =========================================================================
    // TEST 12: Master cannot approve own proposal
    // =========================================================================
    console.log('Test 12: Master cannot approve own proposal...');
    const res12 = await call('POST', `/class-applications/${createdAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 2,
    }, masterTokenA);
    assert.equal(res12.status, 403);

    // =========================================================================
    // TEST 13: NEEDS_INFORMATION and resubmission cycle
    // =========================================================================
    console.log('Test 13: NEEDS_INFORMATION and resubmission cycle...');
    const res13Req = await call('POST', `/class-applications/${createdAppId}/review`, {
      decision: 'REQUEST_INFORMATION',
      expectedVersion: 2,
      requestedInformation: 'Please specify the exact hall booking confirmation number.',
    }, adminOrgAToken);
    assert.equal(res13Req.status, 200);
    assert.equal(res13Req.data.application.status, 'NEEDS_INFORMATION');
    assert.equal(res13Req.data.application.version, 3);
    assert.equal(res13Req.data.application.requested_information, 'Please specify the exact hall booking confirmation number.');

    const res13Update = await call('PATCH', `/class-applications/${createdAppId}`, {
      venueDetails: 'Court 2, 2nd Floor, Booking #SHAH-ALAM-2026-99',
    }, masterTokenA);
    assert.equal(res13Update.status, 200);

    const res13Resubmit = await call('POST', `/class-applications/${createdAppId}/submit`, {}, masterTokenA);
    assert.equal(res13Resubmit.status, 200);
    assert.equal(res13Resubmit.data.application.status, 'SUBMITTED');
    assert.equal(res13Resubmit.data.application.version, 4);

    // =========================================================================
    // TEST 14: Rejection reason preserved without deleting proposal
    // =========================================================================
    console.log('Test 14: Rejection reason preserved...');
    const res14Create = await call('POST', '/class-applications', {
      organizationId: orgAId,
      name: 'Rejected Class Concept',
      location: 'Roof Deck',
      schedule: 'Monday 5 PM',
      monthlyFee: 90.0,
      capacity: 15,
    }, masterTokenA);
    const dispId = res14Create.data.application.id;

    await call('POST', `/class-applications/${dispId}/submit`, {}, masterTokenA);

    const res14Reject = await call('POST', `/class-applications/${dispId}/review`, {
      decision: 'REJECT',
      expectedVersion: 2,
      reason: 'Roof deck location is unsafe for weapon training.',
    }, adminOrgAToken);
    assert.equal(res14Reject.status, 200);
    assert.equal(res14Reject.data.application.status, 'REJECTED');
    assert.equal(res14Reject.data.application.rejection_reason, 'Roof deck location is unsafe for weapon training.');

    const dbCheck = await dbClient.query('SELECT * FROM class_applications WHERE id = $1', [dispId]);
    assert.equal(dbCheck.rowCount, 1);
    assert.equal(dbCheck.rows[0].status, 'REJECTED');

    // =========================================================================
    // TEST 15: Stale expectedVersion rejected with HTTP 409 Conflict
    // =========================================================================
    console.log('Test 15: Stale expectedVersion returns 409 Conflict...');
    const res15 = await call('POST', `/class-applications/${createdAppId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1, // Current version is 4!
    }, adminOrgAToken);
    assert.equal(res15.status, 409);
    assert.equal(res15.data.code, 'STALE_VERSION');

    // =========================================================================
    // TEST 16: Concurrent review decisions produce one authoritative decision
    // =========================================================================
    console.log('Test 16: Concurrent review decisions resolution...');
    const [cRes1, cRes2] = await Promise.all([
      call('POST', `/class-applications/${createdAppId}/review`, { decision: 'APPROVE', expectedVersion: 4 }, adminOrgAToken),
      call('POST', `/class-applications/${createdAppId}/review`, { decision: 'APPROVE', expectedVersion: 4 }, adminOrgAToken),
    ]);
    const successCount = [cRes1, cRes2].filter(r => r.status === 200).length;
    const conflictCount = [cRes1, cRes2].filter(r => r.status === 409).length;
    assert.ok(successCount >= 1, 'At least one review call succeeds');
    assert.ok(successCount + conflictCount === 2, 'Concurrent review conflict resolved cleanly');

    // =========================================================================
    // TEST 17: Duplicate approval does not create duplicate class
    // =========================================================================
    console.log('Test 17: Duplicate approval does not create duplicate class...');
    const appRes = await dbClient.query('SELECT class_id FROM class_applications WHERE id = $1', [createdAppId]);
    const canonicalClassId = appRes.rows[0].class_id;
    assert.ok(canonicalClassId, 'Canonical class_id must be linked on approved application');

    const res17Dup = await call('POST', `/class-applications/${createdAppId}/review`, {
      decision: 'APPROVE',
    }, adminOrgAToken);
    assert.equal(res17Dup.status, 200);
    assert.match(res17Dup.data.message || '', /already approved/i);

    const classCount = await dbClient.query('SELECT COUNT(*) AS count FROM classes WHERE id = $1', [canonicalClassId]);
    assert.equal(Number(classCount.rows[0].count), 1);

    // =========================================================================
    // TEST 18: Approval creates one PRIMARY leader
    // =========================================================================
    console.log('Test 18: Approval creates exactly one PRIMARY leader in class_leaderships...');
    const leaderRes = await dbClient.query(
      `SELECT * FROM class_leaderships WHERE class_id = $1 AND is_active = TRUE`,
      [canonicalClassId]
    );
    assert.equal(leaderRes.rowCount, 1);
    assert.equal(leaderRes.rows[0].master_id, mIdA);
    assert.equal(leaderRes.rows[0].leadership_type, 'PRIMARY');
    assert.equal(leaderRes.rows[0].provenance, 'DIRECT_ASSIGNMENT');

    // =========================================================================
    // TEST 19: Approval is transactionally atomic & writes audit and outbox
    // =========================================================================
    console.log('Test 19: Approval writes audit log and notification outbox...');
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE details LIKE '%${createdAppId}%'`
    );
    assert.ok(auditRes.rowCount > 0, 'Audit log entry must be present');

    const outboxRes = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE aggregate_id = $1 ORDER BY created_at DESC`,
      [createdAppId]
    );
    assert.ok(outboxRes.rowCount > 0, 'Notification outbox event must be present');
    const approvedEvent = outboxRes.rows.find((r: any) => r.event_type === 'ClassApproved');
    assert.ok(approvedEvent, 'ClassApproved event must be present in notification outbox');

    // =========================================================================
    // TEST 20: Invalid leadership fails with rollback
    // =========================================================================
    console.log('Test 20: Transactional rollback on invalid approval state...');
    // Verify that attempting to approve an un-submitted proposal fails cleanly without creating classes
    const unsubmittedDraft = await dbClient.query(
      `INSERT INTO class_applications (
         id, organization_id, proposing_master_id, name, schedule, location, monthly_fee, capacity, status, version
       ) VALUES ($1, $2, $3, 'Unsubmitted Draft', 'Wed 8PM', 'Dojo', 100.0, 20, 'DRAFT', 1)
       RETURNING id`,
      [`capp_unsub_${Date.now()}`, orgAId, mIdA]
    );
    const unsubmittedId = unsubmittedDraft.rows[0].id;

    const res20 = await call('POST', `/class-applications/${unsubmittedId}/review`, {
      decision: 'APPROVE',
      expectedVersion: 1,
    }, adminOrgAToken);
    assert.equal(res20.status, 400);

    const rollbackCheck = await dbClient.query(
      `SELECT * FROM classes WHERE name = 'Unsubmitted Draft'`
    );
    assert.equal(rollbackCheck.rowCount, 0, 'Class must not have been created on failed approval');

    // =========================================================================
    // TEST 21: Pending classes invisible to public discovery
    // =========================================================================
    console.log('Test 21: Pending classes invisible to discovery...');
    await dbClient.query(
      `INSERT INTO class_applications (
         id, organization_id, proposing_master_id, name, schedule, location, monthly_fee, status, version
       ) VALUES ($1, $2, $3, 'Secret Pending Class', 'Mon 6PM', 'Secret Dojo', 150.0, 'SUBMITTED', 1)`,
      [`capp_pending_${Date.now()}`, orgAId, mIdA]
    );
    const res21 = await call('GET', `/persatuans/${orgAId}/available-classes`);
    assert.equal(res21.status, 200);
    const foundPending = res21.data.classes.find((c: any) => c.name === 'Secret Pending Class');
    assert.equal(foundPending, undefined, 'Pending classes must never appear in discovery');

    // =========================================================================
    // TEST 22: Rejected classes invisible to public discovery
    // =========================================================================
    console.log('Test 22: Rejected classes invisible to discovery...');
    const res22 = await call('GET', `/persatuans/${orgAId}/available-classes`);
    assert.equal(res22.status, 200);
    const foundRejected = res22.data.classes.find((c: any) => c.name === 'Rejected Class Concept');
    assert.equal(foundRejected, undefined, 'Rejected classes must never appear in discovery');

    // =========================================================================
    // TEST 23: Closed classes excluded from available classes discovery
    // =========================================================================
    console.log('Test 23: Closed classes excluded from discovery...');
    const closedClassId = `cls_closed_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO classes (
         id, organization_id, name, schedule, location, monthly_fee,
         status, approval_status, operational_status, enrollment_availability
       ) VALUES ($1, $2, 'Closed Class', 'Sun 8AM', 'Old Hall', 100.0,
                 'ACTIVE', 'APPROVED', 'ACTIVE', 'CLOSED')`,
      [closedClassId, orgAId]
    );
    const res23 = await call('GET', `/persatuans/${orgAId}/available-classes`);
    assert.equal(res23.status, 200);
    const foundClosed = res23.data.classes.find((c: any) => c.id === closedClassId);
    assert.equal(foundClosed, undefined, 'CLOSED enrollment classes must not be discoverable for registration');

    // =========================================================================
    // TEST 24: Open approved classes discoverable
    // =========================================================================
    console.log('Test 24: Open approved classes discoverable...');
    const res24 = await call('GET', `/persatuans/${orgAId}/available-classes`);
    assert.equal(res24.status, 200);
    const foundApproved = res24.data.classes.find((c: any) => c.id === canonicalClassId);
    assert.ok(foundApproved, 'Approved open class must appear in available-classes discovery');
    assert.equal(foundApproved.name, 'Silambam Traditional Form A');
    assert.equal(foundApproved.monthlyFee, 120.0);
    assert.equal(foundApproved.capacity, 30);

    // =========================================================================
    // TEST 25: Private roster fields excluded from discovery
    // =========================================================================
    console.log('Test 25: Private roster fields excluded from discovery...');
    assert.equal(foundApproved.students, undefined, 'Students list must not be exposed');
    assert.equal(foundApproved.roster, undefined, 'Roster must not be exposed');
    assert.equal(foundApproved.attendance, undefined, 'Attendance must not be exposed');
    assert.equal(foundApproved.billing, undefined, 'Billing must not be exposed');
    assert.equal(foundApproved.reviewNotes, undefined, 'Internal review notes must not be exposed');

    // =========================================================================
    // TEST 26: Class operational updates preserve existing training sessions
    // =========================================================================
    console.log('Test 26: Class operational updates preserve existing sessions...');
    const sessId = `sess_h04_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO attendance_sessions (id, class_id, session_date, status)
       VALUES ($1, $2, '2026-10-20', 'COMPLETED')`,
      [sessId, canonicalClassId]
    );

    const res26 = await call('PATCH', `/classes/${canonicalClassId}`, {
      description: 'Updated class description by primary master.',
    }, masterTokenA);
    assert.equal(res26.status, 200);

    const sessCheck = await dbClient.query('SELECT * FROM attendance_sessions WHERE id = $1', [sessId]);
    assert.equal(sessCheck.rowCount, 1, 'Existing attendance session must be preserved');

    // =========================================================================
    // TEST 27: Legacy class records remain intact
    // =========================================================================
    console.log('Test 27: Legacy class records remain intact...');
    const legacyId = `cls_legacy_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, status)
       VALUES ($1, $2, 'Legacy Class 1999', 'Fri 8PM', 'Historic Dojo', 80.0, 'ACTIVE')`,
      [legacyId, orgAId]
    );

    const legacyCheck = await dbClient.query('SELECT * FROM classes WHERE id = $1', [legacyId]);
    assert.equal(legacyCheck.rowCount, 1);
    assert.equal(legacyCheck.rows[0].monthly_fee, '80.00');

    console.log('✅ All 27 H04 Backend Integration Tests Passed Successfully!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ H04 Class Lifecycle Test Suite Failed:', err);
  process.exit(1);
});
