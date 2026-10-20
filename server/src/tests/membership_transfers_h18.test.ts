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

async function runH18Tests() {
  console.log('🥋 Starting Task H18: Pauses, Returns and Controlled Transfers Integration Tests...');
  const path = await import('node:path');
  const dbDir = path.resolve(process.cwd(), '.beltflow_pgdata');
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgAId = `org_h18_a_${ts}`;
    const orgBId = `org_h18_b_${ts}`;

    // 1. Provision Persatuans A & B
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Gayong H18 A', 'Selangor', 'Silat', 'Guru A', '0121111111', $2, 120.00, 'ACTIVE'),
              ($3, 'Persatuan Cekak H18 B', 'Kuala Lumpur', 'Silat', 'Guru B', '0122222222', $4, 150.00, 'ACTIVE')`,
      [orgAId, `org_a_${ts}@test.com`, orgBId, `org_b_${ts}@test.com`]
    );

    // 2. Provision Users
    const masterA1Id = `usr_mst_a1_${ts}`;
    const masterA2Id = `usr_mst_a2_${ts}`;
    const masterB1Id = `usr_mst_b1_${ts}`;
    const parentAId = `usr_par_a_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Master A1 Source', '0111', 'MASTER', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Master A2 Target', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Master B1 Cross', '0113', 'MASTER', 'ACTIVE'),
       ($10, $11, $12, 'HASH', 'Parent A', '0114', 'PARENT', 'ACTIVE')`,
      [
        masterA1Id, orgAId, `master_a1_${ts}@test.com`,
        masterA2Id, orgAId, `master_a2_${ts}@test.com`,
        masterB1Id, orgBId, `master_b1_${ts}@test.com`,
        parentAId, orgAId, `parent_a_${ts}@test.com`,
      ]
    );

    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES 
       ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($4, $5, $6, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($7, $8, $9, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [
        `aff_a1_${ts}`, masterA1Id, orgAId,
        `aff_a2_${ts}`, masterA2Id, orgAId,
        `aff_b1_${ts}`, masterB1Id, orgBId,
      ]
    );

    // 3. Classes
    // - Class A1: Source class in Org A (Capacity 20)
    // - Class A2: Target class in Org A (Capacity 20)
    // - Class A3_Full: Capacity-limited class in Org A (Capacity 1, with 1 student)
    // - Class B1: Target class in Org B (Capacity 20)
    const classA1Id = `cls_a1_${ts}`;
    const classA2Id = `cls_a2_${ts}`;
    const classA3FullId = `cls_a3_full_${ts}`;
    const classB1Id = `cls_b1_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, monthly_fee, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Kelas A1 Asas', 'Mon 8PM', 'Gelanggang A1', 20, 120.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $5, $6, $6, 'Kelas A2 Lanjutan', 'Tue 8PM', 'Gelanggang A2', 20, 140.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($7, $8, $9, $9, 'Kelas A3 Penuh', 'Wed 8PM', 'Gelanggang A3', 1, 130.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($10, $11, $12, $12, 'Kelas B1 Gayong KL', 'Thu 8PM', 'Gelanggang B1', 20, 150.00, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [
        classA1Id, orgAId, masterA1Id,
        classA2Id, orgAId, masterA2Id,
        classA3FullId, orgAId, masterA2Id,
        classB1Id, orgBId, masterB1Id,
      ]
    );

    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES 
       ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($5, $6, $7, $8, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($9, $10, $11, $12, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($13, $14, $15, $16, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [
        `lead_a1_${ts}`, classA1Id, masterA1Id, orgAId,
        `lead_a2_${ts}`, classA2Id, masterA2Id, orgAId,
        `lead_a3_${ts}`, classA3FullId, masterA2Id, orgAId,
        `lead_b1_${ts}`, classB1Id, masterB1Id, orgBId,
      ]
    );
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE), ($3, $4, TRUE), ($3, $5, TRUE), ($6, $7, TRUE)`,
      [masterA1Id, classA1Id, masterA2Id, classA2Id, classA3FullId, masterB1Id, classB1Id]
    );

    // 4. Students
    // - Student 1 (Enrolled in Class A1, has active monthly bills)
    // - Student 2 (Already in Class A3Full, filling it to capacity)
    // - Student 3 (Enrolled in Class A1, used for capacity test)
    const student1Id = `stu_h18_1_${ts}`;
    const student2FullId = `stu_h18_2_${ts}`;
    const student3Id = `stu_h18_3_${ts}`;

    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES 
       ($1, $2, $3, 'Danial bin Iskandar', '120101-10-1201', 'Yellow Belt', 120.00, 'ACTIVE'),
       ($4, $5, $6, 'Student Occupying Full Seat', '120202-10-1202', 'White Belt', 130.00, 'ACTIVE'),
       ($7, $2, $3, 'Capacity Test Student', '120303-10-1203', 'White Belt', 120.00, 'ACTIVE')`,
      [
        student1Id, orgAId, classA1Id,
        student2FullId, orgAId, classA3FullId,
        student3Id,
      ]
    );

    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary, provenance, approved_by_master_id)
       VALUES 
       ($1, $2, $3, $4, 'ACTIVE', TRUE, 'MASTER_APPROVED', $5),
       ($6, $7, $8, $9, 'ACTIVE', TRUE, 'MASTER_APPROVED', $10),
       ($11, $12, $3, $4, 'ACTIVE', TRUE, 'MASTER_APPROVED', $5)`,
      [
        `enr_1_${ts}`, student1Id, classA1Id, orgAId, masterA1Id,
        `enr_2_${ts}`, student2FullId, classA3FullId, orgAId, masterA2Id,
        `enr_3_${ts}`, student3Id,
      ]
    );

    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status)
       VALUES ($1, $2, $3, 'ACTIVE'), ($4, $2, $5, 'ACTIVE')`,
      [`link_1_${ts}`, parentAId, student1Id, `link_3_${ts}`, student3Id]
    );

    // Generate monthly dues & historical payment for Student 1 in Persatuan A
    const bill1Id = `bill_1_${ts}`;
    const bill2Id = `bill_2_${ts}`;
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES 
       ($1, $2, $3, $4, '2026-09', 120.00, 120.00, 'Paid'),
       ($5, $6, $7, $8, '2026-10', 120.00, 0.00, 'Pending')`,
      [
        bill1Id, orgAId, classA1Id, student1Id,
        bill2Id, orgAId, classA1Id, student1Id,
      ]
    );

    const payment1Id = `pay_1_${ts}`;
    await dbClient.query(
      `INSERT INTO payments (id, organization_id, student_id, parent_id, submitted_by, amount, status, receipt_no, billing_month_ids)
       VALUES ($1, $2, $3, $4, $4, 120.00, 'Approved', $5, $6)`,
      [payment1Id, orgAId, student1Id, parentAId, `REC_A_${ts}`, [bill1Id]]
    );

    // Auth Tokens
    const tokenMasterA1 = generateAuthToken({ id: masterA1Id, email: `master_a1_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [classA1Id] });
    const tokenMasterA2 = generateAuthToken({ id: masterA2Id, email: `master_a2_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: [classA2Id, classA3FullId] });
    const tokenMasterB1 = generateAuthToken({ id: masterB1Id, email: `master_b1_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgBId, assignedClassIds: [classB1Id] });
    const tokenParentA = generateAuthToken({ id: parentAId, email: `parent_a_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgAId });

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 1: pause_no_silent_bill_erasure
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Acceptance Test: pause_no_silent_bill_erasure ---');
    // Parent requests membership pause for Student 1
    const pauseReqRes = await makeRequest(server, 'POST', '/memberships/pause/request', {
      studentId: student1Id,
      startDate: '2026-11-01',
      expectedEndDate: '2026-12-31',
      reason: 'School exam preparation and family commitments',
    }, tokenParentA);
    assert.equal(pauseReqRes.status, 201, 'Pause request should succeed with 201 Created');
    const pauseId = pauseReqRes.data.pause.id;
    assert.equal(pauseReqRes.data.pause.status, 'REQUESTED');

    // Master A1 approves pause
    const pauseApproveRes = await makeRequest(server, 'POST', `/memberships/pause/${pauseId}/approve`, {
      expectedVersion: 1,
    }, tokenMasterA1);
    assert.equal(pauseApproveRes.status, 200, 'Pause approval should succeed');
    assert.equal(pauseApproveRes.data.pause.status, 'APPROVED');

    // Verify student status is updated to PAUSED
    const stuPaused = await dbClient.query('SELECT status FROM students WHERE id = $1', [student1Id]);
    assert.equal(stuPaused.rows[0].status, 'PAUSED', 'Student status must become PAUSED');

    // INVARIANT: Pre-existing monthly_dues and payment records remain untouched and un-erased
    const duesCheck = await dbClient.query('SELECT id, billing_month, fee_amount, amount_paid, status FROM monthly_dues WHERE student_id = $1 ORDER BY billing_month ASC', [student1Id]);
    assert.equal(duesCheck.rowCount, 2, 'All pre-existing billing ledger rows must be preserved');
    assert.equal(duesCheck.rows[0].id, bill1Id);
    assert.equal(duesCheck.rows[0].status, 'Paid');
    assert.equal(duesCheck.rows[1].id, bill2Id);
    assert.equal(duesCheck.rows[1].status, 'Pending');

    const payCheck = await dbClient.query('SELECT id, receipt_no, amount, status FROM payments WHERE student_id = $1', [student1Id]);
    assert.equal(payCheck.rowCount, 1, 'Payment receipt must be preserved without alteration');
    assert.equal(payCheck.rows[0].receipt_no, `REC_A_${ts}`);
    console.log('✅ Acceptance Test 1 Passed: pause_no_silent_bill_erasure verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 2: return_restores_correct_status
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Acceptance Test: return_restores_correct_status ---');
    // Student returns / resumes training
    const resumeRes = await makeRequest(server, 'POST', `/memberships/resume/${pauseId}`, {}, tokenParentA);
    assert.equal(resumeRes.status, 200, 'Resuming membership should succeed with 200 OK');
    assert.equal(resumeRes.data.pause.status, 'RESUMED');

    // Verify student status is restored to ACTIVE
    const stuResumed = await dbClient.query('SELECT status, belt_rank, class_id FROM students WHERE id = $1', [student1Id]);
    assert.equal(stuResumed.rows[0].status, 'ACTIVE', 'Student status must be restored to ACTIVE');
    assert.equal(stuResumed.rows[0].belt_rank, 'Yellow Belt', 'Belt rank must remain preserved');
    assert.equal(stuResumed.rows[0].class_id, classA1Id, 'Class assignment must remain preserved');

    // Verify class_enrollments status is ACTIVE
    const enrResumed = await dbClient.query('SELECT status, is_primary FROM class_enrollments WHERE student_id = $1 AND class_id = $2', [student1Id, classA1Id]);
    assert.equal(enrResumed.rows[0].status, 'ACTIVE');
    assert.equal(enrResumed.rows[0].is_primary, true);
    console.log('✅ Acceptance Test 2 Passed: return_restores_correct_status verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 6: target_capacity_checked
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Acceptance Test: target_capacity_checked ---');
    // Class A3 has capacity 1, occupied by student2FullId.
    // Parent requests transfer for Student 3 into Class A3
    const transferFullReq = await makeRequest(server, 'POST', '/transfers/request', {
      studentId: student3Id,
      targetClassId: classA3FullId,
      reason: 'Wants to move to full class',
      effectiveDate: '2026-11-15',
    }, tokenParentA);
    assert.equal(transferFullReq.status, 201);
    const transferFullId = transferFullReq.data.transfer.id;

    // Master A2 attempts to approve transfer into full class -> MUST FAIL WITH 409 CONFLICT
    const approveFullRes = await makeRequest(server, 'POST', `/transfers/${transferFullId}/approve`, {
      expectedVersion: 1,
    }, tokenMasterA2);
    assert.equal(approveFullRes.status, 409, 'Transfer into full class must return 409 Conflict');
    assert.ok(
      approveFullRes.data.error.toLowerCase().includes('capacity'),
      'Error message must specify class capacity'
    );
    console.log('✅ Acceptance Test 6 Passed: target_capacity_checked verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 3: transfer_preserves_student_id
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Acceptance Test: transfer_preserves_student_id ---');
    // Request valid transfer for Student 1 to Class A2 (capacity 20)
    const transferA2Req = await makeRequest(server, 'POST', '/transfers/request', {
      studentId: student1Id,
      targetClassId: classA2Id,
      reason: 'Moving to intermediate level',
      effectiveDate: new Date().toISOString().slice(0, 10),
    }, tokenParentA);
    assert.equal(transferA2Req.status, 201);
    const transferA2Id = transferA2Req.data.transfer.id;

    // Receiving Master (Master A2) approves transfer
    const approveA2Res = await makeRequest(server, 'POST', `/transfers/${transferA2Id}/approve`, {
      expectedVersion: 1,
    }, tokenMasterA2);
    assert.equal(approveA2Res.status, 200, 'Receiving Master approval should succeed');
    assert.equal(approveA2Res.data.transfer.status, 'APPROVED');

    // INVARIANT: Canonical student ID is preserved, NOT deleted and recreated
    const stuAfterTransfer = await dbClient.query('SELECT id, class_id, belt_rank, monthly_fee FROM students WHERE id = $1', [student1Id]);
    assert.equal(stuAfterTransfer.rowCount, 1, 'Student record must exist with same primary key');
    assert.equal(stuAfterTransfer.rows[0].id, student1Id, 'Canonical student ID must remain exactly identical');
    assert.equal(stuAfterTransfer.rows[0].class_id, classA2Id, 'Student class_id updated to target class A2');
    assert.equal(stuAfterTransfer.rows[0].belt_rank, 'Yellow Belt', 'Belt rank preserved');
    assert.equal(Number(stuAfterTransfer.rows[0].monthly_fee), 140.00, 'Tuition updated prospectively to target class fee');

    // Verify historical enrollment preserved
    const enrOld = await dbClient.query('SELECT status, is_primary FROM class_enrollments WHERE student_id = $1 AND class_id = $2', [student1Id, classA1Id]);
    assert.equal(enrOld.rows[0].status, 'TRANSFERRED');
    assert.equal(enrOld.rows[0].is_primary, false);

    const enrNew = await dbClient.query('SELECT status, is_primary, provenance, approved_by_master_id FROM class_enrollments WHERE student_id = $1 AND class_id = $2', [student1Id, classA2Id]);
    assert.equal(enrNew.rows[0].status, 'ACTIVE');
    assert.equal(enrNew.rows[0].is_primary, true);
    assert.equal(enrNew.rows[0].provenance, 'CLASS_TRANSFER');
    assert.equal(enrNew.rows[0].approved_by_master_id, masterA2Id);
    console.log('✅ Acceptance Test 3 Passed: transfer_preserves_student_id verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 4: concurrent_transfer_rejected
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Acceptance Test: concurrent_transfer_rejected ---');
    // Stale version approval attempt on transferA2Id (which is now version 2)
    const staleApproveRes = await makeRequest(server, 'POST', `/transfers/${transferA2Id}/approve`, {
      expectedVersion: 1, // Stale!
    }, tokenMasterA2);
    assert.equal(staleApproveRes.status, 409, 'Stale expectedVersion on transfer approval must return 409 Conflict');
    console.log('✅ Acceptance Test 4 Passed: concurrent_transfer_rejected verified.');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 5: cross_tenant_no_implicit_history_copy
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Acceptance Test: cross_tenant_no_implicit_history_copy ---');
    // Attempt cross-tenant transfer to Persatuan B WITHOUT consent -> REJECTED
    const noConsentCrossRes = await makeRequest(server, 'POST', '/transfers/request', {
      studentId: student1Id,
      targetClassId: classB1Id, // In Org B
      reason: 'Relocating to KL',
      consentAccepted: false, // Missing consent!
    }, tokenParentA);
    assert.equal(noConsentCrossRes.status, 400, 'Cross-tenant transfer without consent must return 400');

    // Cross-tenant transfer WITH consent
    const crossRes = await makeRequest(server, 'POST', '/transfers/request', {
      studentId: student1Id,
      targetClassId: classB1Id, // In Org B
      reason: 'Relocating to KL',
      consentAccepted: true,
      effectiveDate: new Date().toISOString().slice(0, 10),
    }, tokenParentA);
    assert.equal(crossRes.status, 201);
    const crossTransferId = crossRes.data.transfer.id;

    // Master B1 approves cross-tenant transfer
    const approveCrossRes = await makeRequest(server, 'POST', `/transfers/${crossTransferId}/approve`, {
      expectedVersion: 1,
    }, tokenMasterB1);
    assert.equal(approveCrossRes.status, 200);

    // Verify canonical student identity is maintained in new tenant
    const stuCross = await dbClient.query('SELECT id, organization_id, class_id FROM students WHERE id = $1', [student1Id]);
    assert.equal(stuCross.rows[0].id, student1Id, 'Student ID maintained across tenants');
    assert.equal(stuCross.rows[0].organization_id, orgBId, 'Organization updated to Persatuan B');
    assert.equal(stuCross.rows[0].class_id, classB1Id, 'Class updated to B1');

    // INVARIANT: Historical monthly dues and payments remain in Persatuan A!
    // Persatuan B cannot see or query Persatuan A's financial transactions
    const orgADues = await dbClient.query('SELECT organization_id, receipt_no FROM payments WHERE student_id = $1', [student1Id]);
    assert.equal(orgADues.rows[0].organization_id, orgAId, 'Past payments remain strictly owned by Org A');

    const orgBDues = await dbClient.query('SELECT * FROM payments WHERE organization_id = $1 AND student_id = $2', [orgBId, student1Id]);
    assert.equal(orgBDues.rowCount, 0, 'No payments copied to Org B');

    console.log('✅ Acceptance Test 5 Passed: cross_tenant_no_implicit_history_copy verified.');

    console.log('\n🎉 ALL 6 OFFICIAL TASK H18 ACCEPTANCE TESTS PASSED!');
  } finally {
    server.close();
  }
}

runH18Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Task H18 Tests Failed:', err);
    process.exit(1);
  });
