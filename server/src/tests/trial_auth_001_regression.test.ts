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

async function runRegressionTests() {
  console.log('🥋 Starting TRIAL-AUTH-001 Regression & Security Hardening Tests...');
  const path = await import('node:path');
  // Fresh database per run (scripts/run-tests.js sets PG_DATA_DIR); never the developer's local .beltflow_pgdata.
  const dbDir = process.env.PG_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-test-'));
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgId = `org_sec_${ts}`;

    // 1. Provision Persatuan
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Silat Security Test', 'Selangor', 'Silat', 'Guru Besar', '0123334444', $2, 120.00, 'ACTIVE')`,
      [orgId, `sec_org_${ts}@beltflow.test`]
    );

    // 2. Provision Users
    const adminId = `usr_adm_sec_${ts}`;
    const activeMasterId = `usr_mst_act_${ts}`;
    const suspendedMasterId = `usr_mst_susp_${ts}`;
    const unassignedMasterId = `usr_mst_unass_${ts}`;
    const parentId = `usr_par_sec_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Admin Persatuan Sec', '0111', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Active Master Assigned', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Suspended Master', '0113', 'MASTER', 'ACTIVE'),
       ($10, $11, $12, 'HASH', 'Unassigned Master', '0114', 'MASTER', 'ACTIVE'),
       ($13, $14, $15, 'HASH', 'Parent Sec', '0115', 'PARENT', 'ACTIVE')`,
      [
        adminId, orgId, `admin_sec_${ts}@test.com`,
        activeMasterId, orgId, `mst_act_${ts}@test.com`,
        suspendedMasterId, orgId, `mst_susp_${ts}@test.com`,
        unassignedMasterId, orgId, `mst_unass_${ts}@test.com`,
        parentId, orgId, `par_sec_${ts}@test.com`,
      ]
    );

    // 3. Affiliations (Active vs Suspended)
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES 
       ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($4, $5, $6, 'SUSPENDED', CURRENT_TIMESTAMP - INTERVAL '30 days', 'ADMIN_SUSPENDED'),
       ($7, $8, $9, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '5 days', 'ADMIN_VERIFIED')`,
      [
        `aff_act_${ts}`, activeMasterId, orgId,
        `aff_susp_${ts}`, suspendedMasterId, orgId,
        `aff_unass_${ts}`, unassignedMasterId, orgId,
      ]
    );

    // 4. Classes (Normal Class vs Full Capacity Class)
    const normalClassId = `cls_norm_${ts}`;
    const fullClassId = `cls_full_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, monthly_fee, capacity, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Normal Class', 'Mon 8PM', 'Gelanggang A', 120.00, 20, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $5, $3, $3, 'Full Class', 'Tue 8PM', 'Gelanggang B', 120.00, 1, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [normalClassId, orgId, activeMasterId, fullClassId, orgId]
    );

    // Assign Active Master to both classes in class_leaderships & coach_class_assignments
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, provenance)
       VALUES 
       ($1, $2, $3, $4, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT'),
       ($5, $6, $7, $8, 'PRIMARY', TRUE, 'DIRECT_ASSIGNMENT')`,
      [
        `lead_norm_${ts}`, normalClassId, activeMasterId, orgId,
        `lead_full_${ts}`, fullClassId, activeMasterId, orgId,
      ]
    );
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE), ($1, $3, TRUE)`,
      [activeMasterId, normalClassId, fullClassId]
    );

    // Fill Full Class to capacity (1 student)
    const existingStudentId = `stu_exist_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES ($1, $2, $3, 'Existing Student', '000101-01-0001', 'White Belt', 120.00, 'ACTIVE')`,
      [existingStudentId, orgId, fullClassId]
    );
    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary, provenance, approved_by_master_id, approved_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, 'MASTER_APPROVED', $5, CURRENT_TIMESTAMP)`,
      [`enr_exist_${ts}`, existingStudentId, fullClassId, orgId, activeMasterId]
    );

    // Auth Tokens
    const tokenAdmin = generateAuthToken({ id: adminId, email: `admin_sec_${ts}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgId });
    const tokenActiveMaster = generateAuthToken({ id: activeMasterId, email: `mst_act_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgId, assignedClassIds: [normalClassId, fullClassId] });
    const tokenSuspendedMaster = generateAuthToken({ id: suspendedMasterId, email: `mst_susp_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgId, assignedClassIds: [normalClassId] });
    const tokenUnassignedMaster = generateAuthToken({ id: unassignedMasterId, email: `mst_unass_${ts}@test.com`, role: UserRole.MASTER, organizationId: orgId, assignedClassIds: [] });
    const tokenParent = generateAuthToken({ id: parentId, email: `par_sec_${ts}@test.com`, role: UserRole.PARENT, organizationId: orgId });

    // Book 2 Trials (one for normal class, one for full class)
    const bookNormalRes = await makeRequest(server, 'POST', '/trials/book', {
      organizationId: orgId,
      classId: normalClassId,
      scheduledDate: '2026-10-30',
      candidateName: 'Tariq bin Ziyad',
      candidateAge: 11,
      guardianName: 'Puan Aminah',
      guardianPhone: '0129990001',
      emergencyPhone: '0129990002',
      medicalNotes: 'No allergies',
      consentAccepted: true,
    }, tokenParent);
    assert.equal(bookNormalRes.status, 201);
    const normalTrialId = bookNormalRes.data.trial.id;

    const bookFullRes = await makeRequest(server, 'POST', '/trials/book', {
      organizationId: orgId,
      classId: fullClassId,
      scheduledDate: '2026-10-30',
      candidateName: 'Zubair bin Awwam',
      candidateAge: 12,
      guardianName: 'Encik Awwam',
      guardianPhone: '0129990003',
      consentAccepted: true,
    }, tokenParent);
    assert.equal(bookFullRes.status, 201);
    const fullTrialId = bookFullRes.data.trial.id;

    // ------------------------------------------------------------------------
    // REGRESSION TEST 1: Admin Persatuan cannot convert trial (TRIAL-AUTH-001)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Verification of Invariant 1 & 2: Admin Persatuan Bypassing Student Approval Rejected (TRIAL-AUTH-001) ---');
    const adminConvertRes = await makeRequest(server, 'POST', `/trials/${normalTrialId}/convert`, {}, tokenAdmin);
    assert.equal(
      adminConvertRes.status,
      403,
      'TRIAL-AUTH-001: Admin Persatuan must be denied converting trial to canonical enrollment'
    );
    assert.ok(
      adminConvertRes.data.error.includes('Master') || adminConvertRes.data.error.includes('approval'),
      'Error message must state that enrollment approval requires authorized Master'
    );
    console.log('✅ Invariant 1 & 2 Passed: Admin Persatuan denied trial conversion.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 2: Suspended Master cannot convert trial
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Verification of Invariant 4 & 9: Suspended Master Rejected ---');
    const suspConvertRes = await makeRequest(server, 'POST', `/trials/${normalTrialId}/convert`, {}, tokenSuspendedMaster);
    assert.equal(suspConvertRes.status, 403, 'Suspended Master must be denied converting trial');
    console.log('✅ Invariant 4 & 9 Passed: Suspended Master denied conversion.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 3: Unassigned Master cannot convert trial
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Verification of Invariant 4: Unassigned Master Rejected ---');
    const unassConvertRes = await makeRequest(server, 'POST', `/trials/${normalTrialId}/convert`, {}, tokenUnassignedMaster);
    assert.equal(unassConvertRes.status, 403, 'Unassigned Master must be denied converting trial');
    console.log('✅ Invariant 4 Passed: Unassigned Master denied conversion.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 4: Capacity-full class rejects conversion
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Verification of Invariant 5: Transactional Capacity Enforcement ---');
    const fullConvertRes = await makeRequest(server, 'POST', `/trials/${fullTrialId}/convert`, {}, tokenActiveMaster);
    assert.equal(fullConvertRes.status, 409, 'Conversion into capacity-full class must return 409 Conflict');
    console.log('✅ Invariant 5 Passed: Class capacity enforcement verified.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 5: Active Assigned Master successfully converts trial
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Verification of Invariants 6, 7, 8, 10: Canonical Master Approval ---');
    const validConvertRes = await makeRequest(server, 'POST', `/trials/${normalTrialId}/convert`, { beltRank: 'White Belt' }, tokenActiveMaster);
    assert.equal(validConvertRes.status, 200, 'Active assigned Master can convert trial to student');
    const convertedStudentId = validConvertRes.data.student.id;

    // Verify class_enrollments row
    const enrCheck = await dbClient.query('SELECT * FROM class_enrollments WHERE student_id = $1 AND class_id = $2', [convertedStudentId, normalClassId]);
    assert.equal(enrCheck.rowCount, 1, 'class_enrollments record must be inserted');
    assert.equal(enrCheck.rows[0].status, 'ACTIVE');
    assert.equal(enrCheck.rows[0].approved_by_master_id, activeMasterId, 'Enrollment must record approving Master ID');
    assert.equal(enrCheck.rows[0].provenance, 'TRIAL_CONVERSION');

    // Verify enrollment_applications row
    const appCheck = await dbClient.query('SELECT * FROM enrollment_applications WHERE student_id = $1 AND class_id = $2', [convertedStudentId, normalClassId]);
    assert.equal(appCheck.rowCount, 1, 'enrollment_applications record must be preserved for audit');
    assert.equal(appCheck.rows[0].status, 'APPROVED');
    assert.equal(appCheck.rows[0].reviewed_by_master_id, activeMasterId);

    // Verify trial_bookings row updated
    const trialCheck = await dbClient.query('SELECT * FROM trial_bookings WHERE id = $1', [normalTrialId]);
    assert.equal(trialCheck.rows[0].status, 'CONVERTED');
    assert.equal(trialCheck.rows[0].converted_student_id, convertedStudentId);
    assert.equal(trialCheck.rows[0].converted_by, activeMasterId);

    // Verify audit_logs row
    const auditCheck = await dbClient.query('SELECT * FROM audit_logs WHERE details LIKE $1', [`%${normalTrialId}%`]);
    assert.ok(auditCheck.rowCount > 0, 'Audit log entry must be created');

    // Duplicate conversion fails
    const dupRes = await makeRequest(server, 'POST', `/trials/${normalTrialId}/convert`, {}, tokenActiveMaster);
    assert.equal(dupRes.status, 409, 'Duplicate conversion attempt must return 409 Conflict');
    console.log('✅ Invariants 6, 7, 8, 10 Passed: Canonical student, enrollment, application, and audit trails created.');

    console.log('\n🎉 ALL TRIAL-AUTH-001 REGRESSION & GOVERNANCE CHECKS PASSED!');
  } finally {
    server.close();
  }
}

runRegressionTests().catch((err) => {
  console.error('❌ TRIAL-AUTH-001 Regression Failed:', err);
  process.exit(1);
});
