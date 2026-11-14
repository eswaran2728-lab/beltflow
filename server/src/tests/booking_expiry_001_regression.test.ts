import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { sweepExpiredWaitlistOffers } from '../routes/bookings.routes';

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

async function runBookingExpiryRegression() {
  console.log('🥋 Starting BOOKING-EXPIRY-001 Waitlist Offer Expiry Worker Tests...');
  const path = await import('node:path');
  // Fresh database per run (scripts/run-tests.js sets PG_DATA_DIR); never the developer's local .beltflow_pgdata.
  const dbDir = process.env.PG_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-test-'));
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgId = `org_bexp_${ts}`;

    // 1. Organization
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan BExp', 'Selangor', 'Silat', 'Guru BExp', '0121111111', $2, 120.00, 'ACTIVE')`,
      [orgId, `org_bexp_${ts}@test.com`]
    );

    // 2. Users
    const masterId = `usr_mst_bexp_${ts}`;
    const parent1Id = `usr_par1_bexp_${ts}`;
    const parent2Id = `usr_par2_bexp_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Master BExp', '0111', 'MASTER', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Parent 1', '0112', 'PARENT', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Parent 2', '0113', 'PARENT', 'ACTIVE')`,
      [
        masterId, orgId, `m_bexp_${ts}@test.com`,
        parent1Id, orgId, `p1_bexp_${ts}@test.com`,
        parent2Id, orgId, `p2_bexp_${ts}@test.com`,
      ]
    );

    // Active affiliation for master
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [`aff_bexp_${ts}`, masterId, orgId]
    );

    // 3. Classes: Home Class (capacity 20) & Target Class (capacity 1)
    const homeClassId = `cls_home_${ts}`;
    const targetClassId = `cls_bexp_${ts}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, monthly_fee, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Home Class', 'Mon 8PM', 'Hall 0', 20, 120.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $2, $3, $3, 'Target Limited Class', 'Fri 10AM', 'Hall 1', 1, 120.00, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [homeClassId, orgId, masterId, targetClassId]
    );

    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, provenance)
       VALUES 
       ($1, $2, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED'),
       ($5, $6, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED')`,
      [`lead_home_${ts}`, homeClassId, masterId, orgId, `lead_bexp_${ts}`, targetClassId]
    );

    // 4. Training Group & Session for Target Class
    const groupId = `grp_bexp_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name)
       VALUES ($1, $2, $3, 'Group BExp')`,
      [groupId, orgId, targetClassId]
    );

    const sessionId = `sess_bexp_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-11-20', 'Friday', '10:00', '11:30', 'Hall 1', 'Scheduled')`,
      [sessionId, orgId, targetClassId, groupId]
    );

    // 5. Two Waitlisted Students from Home Class
    const student1Id = `stu1_bexp_${ts}`;
    const student2Id = `stu2_bexp_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES 
       ($1, $2, $3, 'Candidate 1', '120101-10-1203', 'White Belt', 'ACTIVE'),
       ($4, $2, $3, 'Candidate 2', '120101-10-1204', 'White Belt', 'ACTIVE')`,
      [student1Id, orgId, homeClassId, student2Id]
    );

    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status)
       VALUES 
       ($1, $2, $3, 'ACTIVE'),
       ($4, $5, $6, 'ACTIVE')`,
      [`psl1_${ts}`, parent1Id, student1Id, `psl2_${ts}`, parent2Id, student2Id]
    );

    // Tokens
    const masterToken = generateAuthToken({
      id: masterId,
      organizationId: orgId,
      role: UserRole.MASTER,
      email: `m_bexp_${ts}@test.com`,
      assignedClassIds: [targetClassId, homeClassId],
    });
    const parent1Token = generateAuthToken({
      id: parent1Id,
      organizationId: orgId,
      role: UserRole.PARENT,
      email: `p1_bexp_${ts}@test.com`,
      linkedStudentIds: [student1Id],
    });
    const parent2Token = generateAuthToken({
      id: parent2Id,
      organizationId: orgId,
      role: UserRole.PARENT,
      email: `p2_bexp_${ts}@test.com`,
      linkedStudentIds: [student2Id],
    });

    // Create Candidate 1 booking in OFFERED status with backdated offer_expires_at (EXPIRED)
    const booking1Id = `mb_exp1_${ts}`;
    await dbClient.query(
      `INSERT INTO make_up_bookings (
         id, organization_id, student_id, home_class_id, target_class_id, session_id,
         status, waitlist_position, offer_expires_at, requested_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, 'OFFERED', 1, CURRENT_TIMESTAMP - INTERVAL '2 hours', $7)`,
      [booking1Id, orgId, student1Id, homeClassId, targetClassId, sessionId, parent1Id]
    );

    // Create Candidate 2 booking in WAITLISTED status
    const booking2Id = `mb_exp2_${ts}`;
    await dbClient.query(
      `INSERT INTO make_up_bookings (
         id, organization_id, student_id, home_class_id, target_class_id, session_id,
         status, waitlist_position, requested_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, 'WAITLISTED', 1, $7)`,
      [booking2Id, orgId, student2Id, homeClassId, targetClassId, sessionId, parent2Id]
    );

    // --- Invariant 1: Candidate 1 cannot accept expired offer ---
    console.log('--- 1. Candidate 1 attempting to accept expired offer ---');
    const acceptRes = await makeRequest(server, 'POST', `/bookings/make-up/${booking1Id}/accept`, {}, parent1Token);
    assert.equal(acceptRes.status, 410, 'Expired offer acceptance must return HTTP 410');
    console.log('✅ Invariant 1 Passed: Expired offer cannot be accepted.');

    // --- Invariant 2: Candidate 2 is promoted by the expiry event ---
    console.log('--- 2. Verifying Candidate 2 was promoted to OFFERED ---');
    const b2Check = await dbClient.query('SELECT status, offer_expires_at FROM make_up_bookings WHERE id = $1', [booking2Id]);
    assert.equal(b2Check.rows[0].status, 'OFFERED', 'Candidate 2 must now be in OFFERED status');
    assert.ok(new Date(b2Check.rows[0].offer_expires_at) > new Date(), 'Candidate 2 must have future offer expiry');
    console.log('✅ Invariant 2 Passed: Capacity released and Candidate 2 promoted.');

    // --- Invariant 3: Expiry Worker Sweep is Idempotent ---
    console.log('--- 3. Verifying sweepExpiredWaitlistOffers is idempotent ---');
    const sweepCount = await sweepExpiredWaitlistOffers();
    assert.equal(sweepCount, 0, 'No remaining expired offers should be swept');
    console.log('✅ Invariant 3 Passed: Expiry sweep worker is completely idempotent.');

    // --- Invariant 4: Candidate 2 accepts active offer ---
    console.log('--- 4. Candidate 2 accepts valid offer ---');
    const b2Accept = await makeRequest(server, 'POST', `/bookings/make-up/${booking2Id}/accept`, {}, parent2Token);
    assert.equal(b2Accept.status, 200, 'Valid offer acceptance must succeed');
    assert.equal(b2Accept.data.booking.status, 'CONFIRMED');
    console.log('✅ Invariant 4 Passed: Candidate 2 confirmed make-up booking.');

    console.log('🎉 ALL BOOKING-EXPIRY-001 REGRESSION TESTS PASSED!');
  } finally {
    server.close();
  }
}

runBookingExpiryRegression()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ BOOKING-EXPIRY-001 Test Failed:', err);
    process.exit(1);
  });
