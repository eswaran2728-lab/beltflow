import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { activateEffectiveTransfers } from '../routes/transfers.routes';

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

async function runTransferDateRegression() {
  console.log('🥋 Starting TRANSFER-DATE-001 Regression & Future-Dated Transfer Tests...');
  const path = await import('node:path');
  const dbDir = path.resolve(process.cwd(), '.beltflow_pgdata');
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgId = `org_tdate_${ts}`;

    // 1. Provision Organization
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Gayong TDate', 'Selangor', 'Silat', 'Guru TDate', '0121111111', $2, 120.00, 'ACTIVE')`,
      [orgId, `org_tdate_${ts}@test.com`]
    );

    // 2. Provision Users
    const sourceMasterId = `usr_mst_src_${ts}`;
    const targetMasterId = `usr_mst_tgt_${ts}`;
    const parentId = `usr_par_tdate_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Source Master', '0111', 'MASTER', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Target Master', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Parent TDate', '0113', 'PARENT', 'ACTIVE')`,
      [
        sourceMasterId, orgId, `m_src_${ts}@test.com`,
        targetMasterId, orgId, `m_tgt_${ts}@test.com`,
        parentId, orgId, `par_${ts}@test.com`,
      ]
    );

    // 3. Classes
    const sourceClassId = `cls_src_${ts}`;
    const targetClassId = `cls_tgt_${ts}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, monthly_fee, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Morning Class', 'Mon 8PM', 'Hall A', 20, 120.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $2, $5, $5, 'Evening Class', 'Tue 8PM', 'Hall B', 20, 140.00, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [sourceClassId, orgId, sourceMasterId, targetClassId, targetMasterId]
    );

    // Active affiliations
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES 
       ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($4, $5, $6, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [
        `aff_src_${ts}`, sourceMasterId, orgId,
        `aff_tgt_${ts}`, targetMasterId, orgId,
      ]
    );

    // Leaderships
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, provenance)
       VALUES 
       ($1, $2, $3, $7, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED'),
       ($4, $5, $6, $7, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED')`,
      [
        `lead_src_${ts}`, sourceClassId, sourceMasterId,
        `lead_tgt_${ts}`, targetClassId, targetMasterId,
        orgId,
      ]
    );

    // 4. Student
    const studentId = `stu_tdate_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES ($1, $2, $3, 'Student Future Transfer', '120101-10-1202', 'White Belt', 120.00, 'ACTIVE')`,
      [studentId, orgId, sourceClassId]
    );
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [`psl_${ts}`, parentId, studentId]
    );
    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary, provenance)
       VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, 'MANUAL_IMPORT')`,
      [`enr_src_${ts}`, studentId, sourceClassId, orgId]
    );

    // Tokens
    const parentToken = generateAuthToken({
      id: parentId,
      organizationId: orgId,
      role: UserRole.PARENT,
      email: `par_${ts}@test.com`,
      linkedStudentIds: [studentId],
    });
    const targetMasterToken = generateAuthToken({
      id: targetMasterId,
      organizationId: orgId,
      role: UserRole.MASTER,
      email: `m_tgt_${ts}@test.com`,
      assignedClassIds: [targetClassId],
    });

    // Request future-dated transfer: effective date is 10 days in future
    const futureDate = new Date(Date.now() + 10 * 86400 * 1000).toISOString().slice(0, 10);
    const reqRes = await makeRequest(
      server,
      'POST',
      '/transfers/request',
      {
        studentId,
        targetClassId,
        effectiveDate: futureDate,
        reason: 'Relocating next month',
        consentAccepted: true,
      },
      parentToken
    );
    assert.equal(reqRes.status, 201, 'Future transfer request should succeed');
    const transferId = reqRes.data.transfer.id;

    // --- Invariant 1: Approve Future-Dated Transfer ---
    console.log('--- 1. Approving future-dated transfer ---');
    const appRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, {}, targetMasterToken);
    assert.equal(appRes.status, 200, 'Transfer approval must succeed');
    assert.equal(appRes.data.transfer.status, 'APPROVED');

    // --- Invariant 2: Student remains active in source class prior to effective date ---
    console.log('--- 2. Verifying student eligibility prior to effective date ---');
    const stuCheck = await dbClient.query('SELECT class_id, monthly_fee FROM students WHERE id = $1', [studentId]);
    assert.equal(stuCheck.rows[0].class_id, sourceClassId, 'Student must remain assigned to source class until effective date');

    const enrollmentsCheck = await dbClient.query(
      'SELECT class_id, status, is_primary, effective_to, effective_from FROM class_enrollments WHERE student_id = $1 ORDER BY effective_from ASC',
      [studentId]
    );
    // There must be 2 enrollments:
    // 1) Old enrollment: ACTIVE, is_primary = TRUE, effective_to = futureDate
    // 2) New enrollment: SCHEDULED, is_primary = FALSE, effective_from = futureDate
    const oldEnrollment = enrollmentsCheck.rows.find((e: any) => e.class_id === sourceClassId);
    const newEnrollment = enrollmentsCheck.rows.find((e: any) => e.class_id === targetClassId);

    assert.ok(oldEnrollment, 'Old enrollment must exist');
    assert.equal(oldEnrollment.status, 'ACTIVE', 'Old enrollment must remain ACTIVE prior to effective date');
    assert.equal(oldEnrollment.is_primary, true, 'Old enrollment must remain primary prior to effective date');

    assert.ok(newEnrollment, 'New enrollment must exist');
    assert.equal(newEnrollment.status, 'SCHEDULED', 'New enrollment must be in SCHEDULED status');
    assert.equal(newEnrollment.is_primary, false, 'New enrollment must not be primary before effective date');
    console.log('✅ Invariant 2 Passed: Student remains active in source class; target enrollment is SCHEDULED.');

    // --- Invariant 3: Target Class Capacity Reserves Seat for SCHEDULED ---
    console.log('--- 3. Verifying capacity reservation for SCHEDULED enrollment ---');
    const capRes = await dbClient.query(
      "SELECT count(*)::int AS count FROM class_enrollments WHERE class_id = $1 AND status IN ('ACTIVE', 'SCHEDULED')",
      [targetClassId]
    );
    assert.equal(capRes.rows[0].count, 1, 'SCHEDULED enrollment must count toward target capacity reservation');
    console.log('✅ Invariant 3 Passed: Target class capacity reserves seat for future transfer.');

    // --- Invariant 4: Server Activation Trigger at/after Effective Date ---
    console.log('--- 4. Verifying server activation when effective date is reached ---');
    // Simulate that the effective date has now arrived by backdating the transfer effective_date and enrollment
    await dbClient.query(
      `UPDATE class_transfer_requests SET effective_date = CURRENT_DATE WHERE id = $1`,
      [transferId]
    );
    await dbClient.query(
      `UPDATE class_enrollments SET effective_from = CURRENT_DATE WHERE student_id = $1 AND class_id = $2`,
      [studentId, targetClassId]
    );

    // Call activation worker / endpoint
    const activatedCount = await activateEffectiveTransfers();
    assert.ok(activatedCount >= 1, 'At least one transfer must be activated');

    // Verify post-activation state
    const postStuCheck = await dbClient.query('SELECT class_id, monthly_fee FROM students WHERE id = $1', [studentId]);
    assert.equal(postStuCheck.rows[0].class_id, targetClassId, 'Student class pointer must update to target class upon activation');
    assert.equal(parseFloat(postStuCheck.rows[0].monthly_fee), 140.00, 'Student monthly fee must update to prospective fee');

    const postEnrCheck = await dbClient.query(
      'SELECT class_id, status, is_primary FROM class_enrollments WHERE student_id = $1 ORDER BY class_id ASC',
      [studentId]
    );
    const postOldEnr = postEnrCheck.rows.find((e: any) => e.class_id === sourceClassId);
    const postNewEnr = postEnrCheck.rows.find((e: any) => e.class_id === targetClassId);

    assert.equal(postOldEnr.status, 'TRANSFERRED', 'Old enrollment must transition to TRANSFERRED');
    assert.equal(postOldEnr.is_primary, false, 'Old enrollment is no longer primary');
    assert.equal(postNewEnr.status, 'ACTIVE', 'New enrollment must transition to ACTIVE');
    assert.equal(postNewEnr.is_primary, true, 'New enrollment must become primary');
    console.log('✅ Invariant 4 Passed: Transfer activated safely upon reaching effective date.');

    // --- Invariant 5: Idempotent Activation ---
    console.log('--- 5. Verifying idempotency of activation worker ---');
    const repeatCount = await activateEffectiveTransfers();
    assert.equal(repeatCount, 0, 'Subsequent activation sweep must be a no-op');
    console.log('✅ Invariant 5 Passed: Activation worker is completely idempotent.');

    console.log('🎉 ALL TRANSFER-DATE-001 REGRESSION & FUTURE-DATED TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTransferDateRegression()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ TRANSFER-DATE-001 Test Failed:', err);
    process.exit(1);
  });
