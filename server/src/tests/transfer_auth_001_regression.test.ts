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

async function runTransferAuthRegression() {
  console.log('🥋 Starting TRANSFER-AUTH-001 Regression & Governance Tests...');
  const path = await import('node:path');
  const dbDir = path.resolve(process.cwd(), '.beltflow_pgdata');
  await dbClient.init(dbDir);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const ts = Date.now();
    const orgId = `org_tauth_${ts}`;
    const wrongOrgId = `org_tauth_wrong_${ts}`;

    // 1. Provision Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES ($1, 'Persatuan Gayong TAuth', 'Selangor', 'Silat', 'Guru TAuth', '0121111111', $2, 120.00, 'ACTIVE'),
              ($3, 'Persatuan Wrong TAuth', 'Perak', 'Silat', 'Guru Wrong', '0122222222', $4, 120.00, 'ACTIVE')`,
      [orgId, `org_tauth_${ts}@test.com`, wrongOrgId, `org_wrong_${ts}@test.com`]
    );

    // 2. Provision Users
    const receivingMasterId = `usr_mst_recv_${ts}`;
    const unassignedMasterId = `usr_mst_unassign_${ts}`;
    const suspendedMasterId = `usr_mst_susp_${ts}`;
    const formerMasterId = `usr_mst_former_${ts}`;
    const adminPersatuanId = `usr_adm_org_${ts}`;
    const wrongAdminId = `usr_adm_wrong_${ts}`;
    const parentId = `usr_par_tauth_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Master Receiving', '0111', 'MASTER', 'ACTIVE'),
       ($4, $5, $6, 'HASH', 'Master Unassigned', '0112', 'MASTER', 'ACTIVE'),
       ($7, $8, $9, 'HASH', 'Master Suspended', '0113', 'MASTER', 'ACTIVE'),
       ($10, $11, $12, 'HASH', 'Master Former', '0114', 'MASTER', 'ACTIVE'),
       ($13, $14, $15, 'HASH', 'Admin Persatuan', '0115', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($16, $17, $18, 'HASH', 'Admin Wrong', '0116', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($19, $20, $21, 'HASH', 'Parent Student', '0117', 'PARENT', 'ACTIVE')`,
      [
        receivingMasterId, orgId, `m_recv_${ts}@test.com`,
        unassignedMasterId, orgId, `m_unass_${ts}@test.com`,
        suspendedMasterId, orgId, `m_susp_${ts}@test.com`,
        formerMasterId, orgId, `m_form_${ts}@test.com`,
        adminPersatuanId, orgId, `adm_${ts}@test.com`,
        wrongAdminId, wrongOrgId, `adm_wrong_${ts}@test.com`,
        parentId, orgId, `par_${ts}@test.com`,
      ]
    );

    // 3. Classes: Class Old & Class Target
    const oldClassId = `cls_old_${ts}`;
    const targetClassId = `cls_target_${ts}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, monthly_fee, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Old Class', 'Mon 8PM', 'Hall 1', 20, 120.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $2, $5, $5, 'Target Class', 'Tue 8PM', 'Hall 2', 20, 130.00, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [oldClassId, orgId, formerMasterId, targetClassId, receivingMasterId]
    );

    // Active affiliation for receiving master
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [`aff_recv_${ts}`, receivingMasterId, orgId]
    );

    // 4. Leaderships
    // Receiving master has active primary leadership for target class
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, provenance)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED')`,
      [`lead_recv_${ts}`, targetClassId, receivingMasterId, orgId]
    );
    // Suspended master has an affiliation marked SUSPENDED
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status)
       VALUES ($1, $2, $3, 'SUSPENDED')`,
      [`aff_susp_${ts}`, suspendedMasterId, orgId]
    );
    // Former master leadership ended yesterday
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, provenance)
       VALUES ($1, $2, $3, $4, 'PRIMARY', FALSE, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED')`,
      [`lead_form_${ts}`, targetClassId, formerMasterId, orgId]
    );

    // 5. Student in Old Class
    const studentId = `stu_tauth_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES ($1, $2, $3, 'Student TAuth', '120101-10-1201', 'White Belt', 120.00, 'ACTIVE')`,
      [studentId, orgId, oldClassId]
    );
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [`psl_${ts}`, parentId, studentId]
    );
    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary, provenance)
       VALUES ($1, $2, $3, $4, 'ACTIVE', TRUE, 'MANUAL_IMPORT')`,
      [`enr_old_${ts}`, studentId, oldClassId, orgId]
    );

    // Tokens
    const receivingMasterToken = generateAuthToken({
      id: receivingMasterId,
      organizationId: orgId,
      role: UserRole.MASTER,
      email: `m_recv_${ts}@test.com`,
      assignedClassIds: [targetClassId],
    });
    const unassignedMasterToken = generateAuthToken({
      id: unassignedMasterId,
      organizationId: orgId,
      role: UserRole.MASTER,
      email: `m_unass_${ts}@test.com`,
      assignedClassIds: [],
    });
    const suspendedMasterToken = generateAuthToken({
      id: suspendedMasterId,
      organizationId: orgId,
      role: UserRole.MASTER,
      email: `m_susp_${ts}@test.com`,
      assignedClassIds: [targetClassId],
    });
    const formerMasterToken = generateAuthToken({
      id: formerMasterId,
      organizationId: orgId,
      role: UserRole.MASTER,
      email: `m_form_${ts}@test.com`,
      assignedClassIds: [],
    });
    const adminPersatuanToken = generateAuthToken({
      id: adminPersatuanId,
      organizationId: orgId,
      role: UserRole.ADMIN_PERSATUAN,
      email: `adm_${ts}@test.com`,
    });
    const wrongAdminToken = generateAuthToken({
      id: wrongAdminId,
      organizationId: wrongOrgId,
      role: UserRole.ADMIN_PERSATUAN,
      email: `adm_wrong_${ts}@test.com`,
    });
    const parentToken = generateAuthToken({
      id: parentId,
      organizationId: orgId,
      role: UserRole.PARENT,
      email: `par_${ts}@test.com`,
      linkedStudentIds: [studentId],
    });

    // Request a class transfer
    const reqRes = await makeRequest(
      server,
      'POST',
      '/transfers/request',
      {
        studentId,
        targetClassId,
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Change to morning batch',
        consentAccepted: true,
      },
      parentToken
    );
    assert.equal(reqRes.status, 201, 'Transfer request should succeed');
    const transferId = reqRes.data.transfer.id;

    // --- Invariant 2: Unassigned Master Denial ---
    console.log('--- 1. Invariant 2: Unassigned Master Denial ---');
    const unassRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, {}, unassignedMasterToken);
    assert.equal(unassRes.status, 403, 'Unassigned master must be denied transfer approval');
    console.log('✅ Invariant 2 Passed: Unassigned master rejected.');

    // --- Invariant 3: Suspended Master Denial ---
    console.log('--- 2. Invariant 3: Suspended Master Denial ---');
    const suspRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, {}, suspendedMasterToken);
    assert.equal(suspRes.status, 403, 'Suspended master must be denied transfer approval');
    console.log('✅ Invariant 3 Passed: Suspended master rejected.');

    // --- Invariant 4: Former Master Denial ---
    console.log('--- 3. Invariant 4: Former Master Denial ---');
    const formRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, {}, formerMasterToken);
    assert.equal(formRes.status, 403, 'Former master whose leadership ended must be denied');
    console.log('✅ Invariant 4 Passed: Former master rejected.');

    // --- Invariant 5: Persatuan Admin cannot bypass required receiving Master approval ---
    console.log('--- 4. Invariant 5: Persatuan Admin Cannot Bypass Master Approval ---');
    const adminRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, {}, adminPersatuanToken);
    assert.equal(adminRes.status, 403, 'Admin Persatuan must not bypass receiving Master approval for transfers');
    console.log('✅ Invariant 5 Passed: Persatuan Admin rejected from bypassing receiving Master.');

    // --- Invariant 6: Wrong Persatuan Admin Denial ---
    console.log('--- 5. Invariant 6: Wrong Persatuan Admin Denial ---');
    const wrongAdmRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, {}, wrongAdminToken);
    assert.equal(wrongAdmRes.status, 403, 'Wrong tenant admin must be denied');
    console.log('✅ Invariant 6 Passed: Wrong tenant admin rejected.');

    // --- Invariant 7: Concurrent Approval Safety (expectedVersion) ---
    console.log('--- 6. Invariant 7: Version Conflict Enforced ---');
    const conflictRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, { expectedVersion: 999 }, receivingMasterToken);
    assert.equal(conflictRes.status, 409, 'Stale expectedVersion must be rejected with 409');
    console.log('✅ Invariant 7 Passed: Optimistic concurrency conflict enforced.');

    // --- Invariant 1: Receiving Master Approval Succeeds ---
    console.log('--- 7. Invariant 1: Authorized Receiving Master Approval ---');
    const recvRes = await makeRequest(server, 'POST', `/transfers/${transferId}/approve`, { expectedVersion: 1 }, receivingMasterToken);
    assert.equal(recvRes.status, 200, 'Authorized receiving master should approve transfer');
    assert.equal(recvRes.data.transfer.status, 'APPROVED');
    console.log('✅ Invariant 1 Passed: Authorized receiving master approval succeeded.');

    // --- Invariant 8: Audit Provenance ---
    console.log('--- 8. Invariant 8: Audit Provenance Verified ---');
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE action = 'Class Transfer Approved' AND user_email = $1`,
      [`m_recv_${ts}@test.com`]
    );
    assert.equal(auditRes.rowCount > 0, true, 'Audit log must record receiving master approval action');
    console.log('✅ Invariant 8 Passed: Audit provenance verified.');

    console.log('🎉 ALL TRANSFER-AUTH-001 REGRESSION & GOVERNANCE TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTransferAuthRegression()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ TRANSFER-AUTH-001 Test Failed:', err);
    process.exit(1);
  });
