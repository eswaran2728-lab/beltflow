import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient, SqlTransactionClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { authorize, AuthorityCapability } from '../security/authority';
import { assignedMasterAccess } from '../security/access';

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
  console.log('🚀 Starting H03 Master Registration, Verification & Approval Test Suite...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const call = (method: string, path: string, body?: any, token?: string) =>
      makeRequest(server, method, path, body, token);

    // Setup Test Persatuans
    const orgAId = `org_h03_a_${Date.now()}`;
    const orgBId = `org_h03_b_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Persatuan Silambam Selangor', 'Selangor', 'Silambam', 'Master Guru A', '0123456789', $2),
              ($3, 'Persatuan Taekwondo KL', 'Kuala Lumpur', 'Taekwondo', 'Master Guru B', '0198765432', $4)`,
      [orgAId, `orgA_${Date.now()}@beltflow.test`, orgBId, `orgB_${Date.now()}@beltflow.test`]
    );

    // Setup Users
    const adminA = {
      id: `usr_adm_a_${Date.now()}`,
      email: `adminA_${Date.now()}@beltflow.test`,
      role: UserRole.ADMIN_PERSATUAN,
      organizationId: orgAId,
      token: '',
    };
    const adminB = {
      id: `usr_adm_b_${Date.now()}`,
      email: `adminB_${Date.now()}@beltflow.test`,
      role: UserRole.ADMIN_PERSATUAN,
      organizationId: orgBId,
      token: '',
    };
    const superAdmin = {
      id: `usr_sa_${Date.now()}`,
      email: `sa_${Date.now()}@beltflow.test`,
      role: UserRole.SUPER_ADMIN,
      token: '',
    };
    const masterApplicant = {
      id: `usr_mst_app_${Date.now()}`,
      email: `applicant_${Date.now()}@beltflow.test`,
      role: UserRole.MASTER,
      token: '',
    };
    const masterA2 = {
      id: `usr_mst_a2_${Date.now()}`,
      email: `masterA2_${Date.now()}@beltflow.test`,
      role: UserRole.MASTER,
      token: '',
    };
    const dualRoleAdminMaster = {
      id: `usr_dual_${Date.now()}`,
      email: `dual_${Date.now()}@beltflow.test`,
      role: UserRole.ADMIN_PERSATUAN,
      organizationId: orgAId,
      token: '',
    };
    const parentUser = {
      id: `usr_par_${Date.now()}`,
      email: `parent_${Date.now()}@beltflow.test`,
      role: UserRole.PARENT,
      organizationId: orgAId,
      token: '',
    };

    // Insert users into DB
    const insertUser = async (u: any, orgId: string | null, role: string) => {
      await dbClient.query(
        `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
         VALUES ($1, $2, $3, 'hash', $4, $5, 'ACTIVE')`,
        [u.id, orgId, u.email, `User ${u.id}`, role]
      );
      u.token = generateAuthToken({ id: u.id, email: u.email, role: role as UserRole });
    };

    await insertUser(adminA, orgAId, 'ADMIN_PERSATUAN');
    await insertUser(adminB, orgBId, 'ADMIN_PERSATUAN');
    await insertUser(superAdmin, null, 'SUPER_ADMIN');
    await insertUser(masterApplicant, null, 'MASTER');
    await insertUser(masterA2, orgAId, 'MASTER');
    await insertUser(dualRoleAdminMaster, orgAId, 'ADMIN_PERSATUAN');
    await insertUser(parentUser, orgAId, 'PARENT');

    // =========================================================================
    // TEST 1: Master application draft creation
    // =========================================================================
    console.log('Test 1: Master application draft creation...');
    const createDraftRes = await call(
      'POST',
      '/master-applications',
      {
        organizationId: orgAId,
        qualifications: '5th Dan Black Belt, National Coach Certified',
        experienceSummary: '12 years teaching martial arts',
        verificationDetails: 'Certificate No. MY-SIL-2015-889',
        documentsUrl: 'https://vault.beltflow.internal/docs/cert-889.pdf',
      },
      masterApplicant.token
    );
    assert.equal(createDraftRes.status, 201, JSON.stringify(createDraftRes.data));
    const draftApp = createDraftRes.data.application;
    assert.equal(draftApp.status, 'DRAFT');
    assert.equal(draftApp.user_id, masterApplicant.id);
    assert.equal(draftApp.organization_id, orgAId);
    assert.equal(draftApp.version, 1);

    // =========================================================================
    // TEST 2: Application submission
    // =========================================================================
    console.log('Test 2: Application submission...');
    const submitRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/submit`,
      {},
      masterApplicant.token
    );
    assert.equal(submitRes.status, 200, JSON.stringify(submitRes.data));
    assert.equal(submitRes.data.application.status, 'SUBMITTED');
    assert.equal(submitRes.data.application.version, 2, 'Version must increment upon submission');
    assert.ok(submitRes.data.application.submitted_at);

    // =========================================================================
    // TEST 3: Persatuan selection validation
    // =========================================================================
    console.log('Test 3: Persatuan selection validation (non-existent Persatuan rejected)...');
    const invalidOrgRes = await call(
      'POST',
      '/master-applications',
      {
        organizationId: 'org_non_existent_999',
        qualifications: 'Instructor',
        experienceSummary: '5 years',
      },
      masterApplicant.token
    );
    assert.equal(invalidOrgRes.status, 400);
    assert.match(invalidOrgRes.data.error || '', /organization does not exist|invalid organization/i);

    // =========================================================================
    // TEST 4: Missing required fields rejected on submit
    // =========================================================================
    console.log('Test 4: Missing required fields rejected on submit...');
    const emptyDraftRes = await call(
      'POST',
      '/master-applications',
      { organizationId: orgAId },
      masterA2.token
    );
    assert.equal(emptyDraftRes.status, 201);
    const emptySubmitRes = await call(
      'POST',
      `/master-applications/${emptyDraftRes.data.application.id}/submit`,
      {},
      masterA2.token
    );
    assert.equal(emptySubmitRes.status, 400);
    assert.match(emptySubmitRes.data.error || '', /qualifications|experience/i);

    // =========================================================================
    // TEST 5: Applicant views only their own applications
    // =========================================================================
    console.log('Test 5: Applicant views only their own applications...');
    const myAppsRes = await call('GET', '/master-applications/me', undefined, masterApplicant.token);
    assert.equal(myAppsRes.status, 200);
    assert.ok(Array.isArray(myAppsRes.data.applications));
    assert.equal(myAppsRes.data.applications.length, 1);
    assert.equal(myAppsRes.data.applications[0].id, draftApp.id);

    const otherMasterMeRes = await call('GET', '/master-applications/me', undefined, masterA2.token);
    assert.equal(otherMasterMeRes.data.applications.length, 1);
    assert.equal(otherMasterMeRes.data.applications[0].id, emptyDraftRes.data.application.id);

    // =========================================================================
    // TEST 6: Cross-Persatuan application isolation
    // =========================================================================
    console.log('Test 6: Cross-Persatuan application isolation...');
    // Admin B is from orgBId. draftApp is for orgAId.
    const crossViewRes = await call(
      'GET',
      `/master-applications/${draftApp.id}`,
      undefined,
      adminB.token
    );
    assert.equal(crossViewRes.status, 403, 'Admin from different Persatuan must be denied view');

    // =========================================================================
    // TEST 7: Same-Persatuan Admin review allowed
    // =========================================================================
    console.log('Test 7: Same-Persatuan Admin review allowed...');
    const viewAppRes = await call(
      'GET',
      `/master-applications/${draftApp.id}`,
      undefined,
      adminA.token
    );
    assert.equal(viewAppRes.status, 200);
    assert.equal(viewAppRes.data.application.id, draftApp.id);
    assert.equal(viewAppRes.data.application.organization_id, orgAId);

    // =========================================================================
    // TEST 8: Wrong-Persatuan Admin review decision rejected
    // =========================================================================
    console.log('Test 8: Wrong-Persatuan Admin review decision rejected...');
    const crossReviewRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      {
        decision: 'APPROVE',
        expectedVersion: 2,
        reason: 'Attempted cross-persatuan approval',
      },
      adminB.token
    );
    assert.equal(crossReviewRes.status, 403, 'Cross-tenant admin review must be rejected');

    // =========================================================================
    // TEST 9: Applicant self-approval rejected
    // =========================================================================
    console.log('Test 9: Applicant self-approval rejected...');
    // Create an application for dualRoleAdminMaster
    const dualAppRes = await call(
      'POST',
      '/master-applications',
      {
        organizationId: orgAId,
        qualifications: 'Grandmaster',
        experienceSummary: '20 years',
      },
      dualRoleAdminMaster.token
    );
    await call('POST', `/master-applications/${dualAppRes.data.application.id}/submit`, {}, dualRoleAdminMaster.token);

    // Attempt to self-approve using their own admin token
    const selfApproveRes = await call(
      'POST',
      `/master-applications/${dualAppRes.data.application.id}/review`,
      {
        decision: 'APPROVE',
        expectedVersion: 2,
        reason: 'Self approving',
      },
      dualRoleAdminMaster.token
    );
    assert.equal(selfApproveRes.status, 403, 'Self approval must be strictly denied');
    assert.match(selfApproveRes.data.error || '', /self-approval|cannot approve your own/i);

    // =========================================================================
    // TEST 10: Non-admin approval rejected
    // =========================================================================
    console.log('Test 10: Non-admin approval rejected...');
    const parentReviewRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      { decision: 'APPROVE', expectedVersion: 2 },
      parentUser.token
    );
    assert.equal(parentReviewRes.status, 403, 'Parent cannot review master applications');

    const superAdminReviewRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      { decision: 'APPROVE', expectedVersion: 2 },
      superAdmin.token
    );
    assert.equal(superAdminReviewRes.status, 403, 'Super Admin cannot approve master teaching applications');

    // =========================================================================
    // TEST 11: Stale expectedVersion rejected (HTTP 409)
    // =========================================================================
    console.log('Test 11: Stale expectedVersion rejected (HTTP 409)...');
    // Current version is 2
    const staleReviewRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      {
        decision: 'APPROVE',
        expectedVersion: 1, // Stale!
        reason: 'Stale version approval attempt',
      },
      adminA.token
    );
    assert.equal(staleReviewRes.status, 409, 'Stale version must return HTTP 409');
    assert.equal(staleReviewRes.data.code, 'STALE_VERSION');

    // =========================================================================
    // TEST 12: Requested information recorded & status updated
    // =========================================================================
    console.log('Test 12: Requested information recorded & status updated...');
    const reqInfoRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      {
        decision: 'REQUEST_INFORMATION',
        expectedVersion: 2,
        reason: 'Please provide certified instructor coaching license document',
      },
      adminA.token
    );
    assert.equal(reqInfoRes.status, 200, JSON.stringify(reqInfoRes.data));
    assert.equal(reqInfoRes.data.application.status, 'NEEDS_INFORMATION');
    assert.equal(reqInfoRes.data.application.version, 3);
    assert.equal(
      reqInfoRes.data.application.requested_information,
      'Please provide certified instructor coaching license document'
    );

    // =========================================================================
    // TEST 13: Correction and resubmission
    // =========================================================================
    console.log('Test 13: Correction and resubmission...');
    const patchRes = await call(
      'PATCH',
      `/master-applications/${draftApp.id}`,
      {
        verificationDetails: 'Certified Coach License #MY-COACH-7729',
        documentsUrl: 'https://vault.beltflow.internal/docs/coach-license-7729.pdf',
      },
      masterApplicant.token
    );
    assert.equal(patchRes.status, 200);

    const resubmitRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/submit`,
      {},
      masterApplicant.token
    );
    assert.equal(resubmitRes.status, 200);
    assert.equal(resubmitRes.data.application.status, 'SUBMITTED');
    assert.equal(resubmitRes.data.application.version, 4);

    // =========================================================================
    // TEST 14: Atomic affiliation activation upon APPROVE
    // =========================================================================
    console.log('Test 14: Atomic affiliation activation upon APPROVE...');
    const approveRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      {
        decision: 'APPROVE',
        expectedVersion: 4,
        reason: 'Credentials and certification verified',
      },
      adminA.token
    );
    assert.equal(approveRes.status, 200, JSON.stringify(approveRes.data));
    assert.equal(approveRes.data.application.status, 'APPROVED');
    assert.equal(approveRes.data.application.version, 5);

    // Verify master_affiliations has an ACTIVE record
    const affilRes = await dbClient.query(
      `SELECT * FROM master_affiliations WHERE master_id = $1 AND organization_id = $2`,
      [masterApplicant.id, orgAId]
    );
    assert.equal(affilRes.rowCount, 1);
    assert.equal(affilRes.rows[0].status, 'ACTIVE');
    assert.equal(affilRes.rows[0].verification_provenance, 'DIRECT_REVIEW');
    assert.equal(affilRes.rows[0].reviewed_by, adminA.id);

    // =========================================================================
    // TEST 15: Duplicate approval idempotent
    // =========================================================================
    console.log('Test 15: Duplicate approval idempotent...');
    const dupApproveRes = await call(
      'POST',
      `/master-applications/${draftApp.id}/review`,
      {
        decision: 'APPROVE',
        expectedVersion: 5,
        reason: 'Credentials and certification verified',
      },
      adminA.token
    );
    assert.equal(dupApproveRes.status, 200);
    assert.equal(dupApproveRes.data.application.status, 'APPROVED');

    // Ensure still only 1 active affiliation row exists
    const affilCount = await dbClient.query(
      `SELECT COUNT(*)::int as cnt FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
      [masterApplicant.id, orgAId]
    );
    assert.equal(affilCount.rows[0].cnt, 1);

    // =========================================================================
    // TEST 16: Audit event and outbox event created exactly once
    // =========================================================================
    console.log('Test 16: Audit event and outbox event created...');
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE action = 'Master Application Approved' AND details LIKE $1`,
      [`%${draftApp.id}%`]
    );
    assert.ok(auditRes.rowCount >= 1, 'Audit log entry must be recorded');

    const outboxRes = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE aggregate_id = $1 AND event_type = 'MasterApproved'`,
      [draftApp.id]
    );
    assert.ok(outboxRes.rowCount >= 1, 'Outbox event must be recorded');

    // =========================================================================
    // TEST 17: Rejection reason persisted without deleting user
    // =========================================================================
    console.log('Test 17: Rejection reason persisted without deleting user...');
    // Create and submit application to reject
    const rejAppRes = await call(
      'POST',
      '/master-applications',
      {
        organizationId: orgAId,
        qualifications: 'Uncertified assistant',
        experienceSummary: '1 month',
      },
      masterA2.token
    );
    await call('POST', `/master-applications/${rejAppRes.data.application.id}/submit`, {}, masterA2.token);

    const rejectRes = await call(
      'POST',
      `/master-applications/${rejAppRes.data.application.id}/review`,
      {
        decision: 'REJECT',
        expectedVersion: 2,
        reason: 'Instructor credentials do not satisfy minimum Dan certification requirements',
      },
      adminA.token
    );
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.data.application.status, 'REJECTED');
    assert.equal(
      rejectRes.data.application.rejection_reason,
      'Instructor credentials do not satisfy minimum Dan certification requirements'
    );

    // Confirm master user is NOT deleted
    const userStillExists = await dbClient.query('SELECT id, status FROM users WHERE id = $1', [masterA2.id]);
    assert.equal(userStillExists.rowCount, 1, 'User account must not be deleted on rejection');

    // =========================================================================
    // TEST 18: Withdrawal behavior
    // =========================================================================
    console.log('Test 18: Application withdrawal behavior...');
    const withdrawableAppRes = await call(
      'POST',
      '/master-applications',
      {
        organizationId: orgAId,
        qualifications: 'Candidate',
        experienceSummary: 'Applying',
      },
      masterA2.token
    );
    await call('POST', `/master-applications/${withdrawableAppRes.data.application.id}/submit`, {}, masterA2.token);

    const withdrawRes = await call(
      'POST',
      `/master-applications/${withdrawableAppRes.data.application.id}/withdraw`,
      {},
      masterA2.token
    );
    assert.equal(withdrawRes.status, 200);
    assert.equal(withdrawRes.data.application.status, 'WITHDRAWN');

    // =========================================================================
    // TEST 19: Pending Master denied class operations & attendance write
    // =========================================================================
    console.log('Test 19: Pending Master denied class operations...');
    const pendingMaster = {
      id: `usr_pending_${Date.now()}`,
      email: `pending_${Date.now()}@beltflow.test`,
      role: UserRole.MASTER,
      organizationId: orgAId,
    };
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'hash', 'Master Pending', 'MASTER', 'ACTIVE')`,
      [pendingMaster.id, orgAId, pendingMaster.email]
    );
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance)
       VALUES ($1, $2, $3, 'PENDING', 'DIRECT_REVIEW')`,
      [`maf_pend_${Date.now()}`, pendingMaster.id, orgAId]
    );

    const pendingDecision = await authorize(
      pendingMaster,
      AuthorityCapability.CLASS_OPERATE,
      { organizationId: orgAId }
    );
    assert.equal(pendingDecision.allowed, false, 'Pending master must be denied CLASS_OPERATE');

    // =========================================================================
    // TEST 20: Suspended Master denied attendance
    // =========================================================================
    console.log('Test 20: Suspended Master denied attendance...');
    const suspMaster = {
      id: `usr_susp_${Date.now()}`,
      email: `susp_${Date.now()}@beltflow.test`,
      role: UserRole.MASTER,
      organizationId: orgAId,
    };
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'hash', 'Master Suspended', 'MASTER', 'ACTIVE')`,
      [suspMaster.id, orgAId, suspMaster.email]
    );
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance)
       VALUES ($1, $2, $3, 'SUSPENDED', 'DIRECT_REVIEW')`,
      [`maf_susp_${Date.now()}`, suspMaster.id, orgAId]
    );

    const suspDecision = await authorize(
      suspMaster,
      AuthorityCapability.ATTENDANCE_WRITE,
      { organizationId: orgAId }
    );
    assert.equal(suspDecision.allowed, false, 'Suspended master must be denied ATTENDANCE_WRITE');

    // =========================================================================
    // TEST 21: Legacy fallback cannot bypass explicit denial
    // =========================================================================
    console.log('Test 21: Legacy fallback cannot bypass explicit denial...');
    // Create class in Org A
    const testClassId = `cls_t21_${Date.now()}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, status)
       VALUES ($1, $2, 'Class T21', 'Fri 18:00', 'Mat A', 120.00, 'ACTIVE')`,
      [testClassId, orgAId]
    );
    // Assign suspended master in coach_class_assignments
    await dbClient.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE)`,
      [suspMaster.id, testClassId]
    );

    // assignedMasterAccess checks if legacy fallback overrides SUSPENDED
    const legacyAccess = await assignedMasterAccess(
      {
        id: suspMaster.id,
        email: suspMaster.email,
        role: UserRole.MASTER,
        organizationId: orgAId,
        assignedClassIds: [testClassId],
      },
      testClassId
    );
    assert.equal(legacyAccess, false, 'Legacy assignedClassIds must not override SUSPENDED affiliation');

    // =========================================================================
    // TEST 22: Approved Master receives correct affiliation
    // =========================================================================
    console.log('Test 22: Approved Master receives correct affiliation...');
    const approvedAffil = await dbClient.query(
      `SELECT * FROM master_affiliations WHERE master_id = $1 AND organization_id = $2`,
      [masterApplicant.id, orgAId]
    );
    assert.equal(approvedAffil.rows[0].status, 'ACTIVE');

    // =========================================================================
    // TEST 23: Approved Master still needs class leadership to operate a specific class
    // =========================================================================
    console.log('Test 23: Approved Master still needs class leadership for specific class...');
    const unledClassDecision = await authorize(
      {
        id: masterApplicant.id,
        email: masterApplicant.email,
        role: UserRole.MASTER,
        organizationId: orgAId,
      },
      AuthorityCapability.CLASS_OPERATE,
      { organizationId: orgAId, classId: testClassId }
    );
    assert.equal(
      unledClassDecision.allowed,
      false,
      'Approved master with no leadership assignment for testClassId must be denied class operation'
    );

    // =========================================================================
    // TEST 24: Admin approval inbox properly scoped to own tenant
    // =========================================================================
    console.log('Test 24: Admin approval inbox properly scoped...');
    const inboxA = await call('GET', '/master-applications/inbox', undefined, adminA.token);
    assert.equal(inboxA.status, 200);
    assert.ok(Array.isArray(inboxA.data.applications));
    // All returned applications must belong to orgAId
    for (const appRow of inboxA.data.applications) {
      assert.equal(appRow.organization_id, orgAId);
    }

    const inboxB = await call('GET', '/master-applications/inbox', undefined, adminB.token);
    assert.equal(inboxB.status, 200);
    for (const appRow of inboxB.data.applications) {
      assert.equal(appRow.organization_id, orgBId);
    }

    // =========================================================================
    // TEST 25: No sensitive verification data in list/inbox API response
    // =========================================================================
    console.log('Test 25: No sensitive verification data in list projection...');
    for (const item of inboxA.data.applications) {
      assert.equal(item.documents_url, undefined, 'documents_url must be excluded from list/inbox view');
      assert.equal(item.verification_details, undefined, 'verification_details must be excluded from list/inbox view');
      assert.ok(item.applicant_name !== undefined || item.user_id !== undefined);
      assert.ok(item.experience_summary !== undefined);
    }

    console.log('✅ All H03 Master Verification Integration Tests Passed!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ H03 Master Verification Test Suite Failed:', err);
  process.exit(1);
});
