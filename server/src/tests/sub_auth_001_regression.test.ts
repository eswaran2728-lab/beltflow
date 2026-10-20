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
): Promise<{ status: number; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: resData });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSubAuthRegressionTests() {
  console.log('🥋 Starting SUB-AUTH-001 Substitute Master Authorization Regression Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const ts = Date.now();
  const orgAId = `org_subauth_a_${ts}`;
  const orgBId = `org_subauth_b_${ts}`;

  try {
    // 1. Seed Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email) VALUES
       ($1, 'Silat Gayong SubAuth Academy', 'Selangor', 'Silat Seni Gayong', 'Master Lead', '+60123456781', $3),
       ($2, 'Cross Persatuan Academy', 'Perak', 'Silat Gayung Fatani', 'Master Other', '+60123456782', $4)`,
      [orgAId, orgBId, `org_a_${ts}@test.com`, `org_b_${ts}@test.com`]
    );

    // 2. Seed Users
    // M1: Primary Master of Class
    const masterPrimaryId = `usr_m_prim_${ts}`;
    // M_Unassigned: Same Persatuan Master with NO assignment or delegation to this class
    const masterUnassignedId = `usr_m_unass_${ts}`;
    // M_Expired: Master with expired delegation
    const masterExpiredId = `usr_m_exp_${ts}`;
    // M_Future: Master with future delegation
    const masterFutureId = `usr_m_fut_${ts}`;
    // M_Revoked: Master with inactive/revoked delegation
    const masterRevokedId = `usr_m_rev_${ts}`;
    // M_MismatchedSession: Master with delegation scoped to another session
    const masterMismatchedId = `usr_m_mism_${ts}`;
    // M_ValidSub: Master with valid active delegation
    const masterValidSubId = `usr_m_val_${ts}`;
    // M_CrossOrg: Master from Org B
    const masterCrossOrgId = `usr_m_crx_${ts}`;
    // Admin Org A
    const adminOrgAId = `usr_admin_a_${ts}`;
    // Admin Org B
    const adminOrgBId = `usr_admin_b_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role) VALUES
       ($1, $2, $13, 'hash123', 'Master Primary Lead', 'MASTER'),
       ($3, $2, $14, 'hash123', 'Master Unassigned', 'MASTER'),
       ($4, $2, $15, 'hash123', 'Master Expired Delegation', 'MASTER'),
       ($5, $2, $16, 'hash123', 'Master Future Delegation', 'MASTER'),
       ($6, $2, $17, 'hash123', 'Master Revoked Delegation', 'MASTER'),
       ($7, $2, $18, 'hash123', 'Master Mismatched Session', 'MASTER'),
       ($8, $2, $19, 'hash123', 'Master Valid Substitute', 'MASTER'),
       ($9, $10, $20, 'hash123', 'Master Cross Org B', 'MASTER'),
       ($11, $2, $21, 'hash123', 'Admin Persatuan A', 'ADMIN_PERSATUAN'),
       ($12, $10, $22, 'hash123', 'Admin Persatuan B', 'ADMIN_PERSATUAN')`,
      [
        masterPrimaryId,
        orgAId,
        masterUnassignedId,
        masterExpiredId,
        masterFutureId,
        masterRevokedId,
        masterMismatchedId,
        masterValidSubId,
        masterCrossOrgId,
        orgBId,
        adminOrgAId,
        adminOrgBId,
        `m_prim_${ts}@subauth.test`,
        `m_unass_${ts}@subauth.test`,
        `m_exp_${ts}@subauth.test`,
        `m_fut_${ts}@subauth.test`,
        `m_rev_${ts}@subauth.test`,
        `m_mism_${ts}@subauth.test`,
        `m_val_${ts}@subauth.test`,
        `m_crx_${ts}@cross.test`,
        `admin_a_${ts}@subauth.test`,
        `admin_b_${ts}@cross.test`,
      ]
    );

    // 3. Seed Class and Training Sessions
    const classId = `cls_subauth_${ts}`;
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, capacity, status)
       VALUES ($1, $2, 'Silat Seni Gayong Level 1', 'Saturdays 09:00', 'Gelanggang Utama', 20, 'ACTIVE')`,
      [classId, orgAId]
    );

    // Primary Leadership for M1
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, provenance)
       VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days', 'SYSTEM')`,
      [`lead_prim_${ts}`, classId, masterPrimaryId, orgAId]
    );

    // Expired delegation for M_Expired (ended yesterday)
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, provenance)
       VALUES ($1, $2, $3, $4, 'SUBSTITUTE', TRUE, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '1 hour', 'DELEGATION')`,
      [`lead_exp_${ts}`, classId, masterExpiredId, orgAId]
    );

    // Future delegation for M_Future (starts in 2 days)
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, provenance)
       VALUES ($1, $2, $3, $4, 'SUBSTITUTE', TRUE, CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '5 days', 'DELEGATION')`,
      [`lead_fut_${ts}`, classId, masterFutureId, orgAId]
    );

    // Revoked delegation for M_Revoked (is_active = FALSE)
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, provenance)
       VALUES ($1, $2, $3, $4, 'SUBSTITUTE', FALSE, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '2 days', 'DELEGATION')`,
      [`lead_rev_${ts}`, classId, masterRevokedId, orgAId]
    );

    // Training Group
    const groupId = `grp_subauth_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name)
       VALUES ($1, $2, $3, 'Poomsae Intermediate')`,
      [groupId, orgAId, classId]
    );

    // Target Session
    const targetSessionId = `sess_subauth_target_${ts}`;
    // Another Session
    const otherSessionId = `sess_subauth_other_${ts}`;

    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES
       ($1, $2, $3, $4, '2026-10-25', 'Saturday', '09:00', '11:00', 'Gelanggang Utama', 'Scheduled'),
       ($5, $2, $3, $4, '2026-11-01', 'Saturday', '09:00', '11:00', 'Gelanggang Utama', 'Scheduled')`,
      [targetSessionId, orgAId, classId, groupId, otherSessionId]
    );

    // Mismatched session delegation for M_Mismatched (scoped specifically to otherSessionId)
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, session_id, provenance)
       VALUES ($1, $2, $3, $4, 'SUBSTITUTE', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '10 days', $5, 'DELEGATION')`,
      [`lead_mism_${ts}`, classId, masterMismatchedId, orgAId, otherSessionId]
    );

    // Valid active delegation for M_ValidSub (session-scoped to targetSessionId)
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, effective_to, session_id, provenance)
       VALUES ($1, $2, $3, $4, 'SUBSTITUTE', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '10 days', $5, 'DELEGATION')`,
      [`lead_val_${ts}`, classId, masterValidSubId, orgAId, targetSessionId]
    );

    // Seed Lesson Plan for Target Session with highly sensitive private notes
    await dbClient.query(
      `INSERT INTO lesson_plans (
         id, session_id, organization_id, class_id, author_master_id,
         title, objectives, drills, equipment, covered_material,
         private_master_notes, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
      [
        `lp_${ts}`,
        targetSessionId,
        orgAId,
        classId,
        masterPrimaryId,
        'Jurus Asas 1-4 & Pola Tapak',
        'Master footwork and counter-strike transitions',
        JSON.stringify([
          { name: 'Warmup Footwork', durationMinutes: 15, intensity: 'MODERATE' },
          { name: 'Kicking Combination Tapak Tiga', durationMinutes: 30, intensity: 'HIGH' },
        ]),
        ['Lompat Tali', 'Target Pad'],
        'Langkah Satu hingga Empat',
        'CONFIDENTIAL: Student Ali has behavioral dispute with sibling. Keep separate in sparring.',
      ]
    );

    // Student safety profile
    const studentId = `stu_subauth_${ts}`;
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, status)
       VALUES ($1, $2, $3, 'Ahmad Danial bin Razlan', '081212-10-1234', 'Kuning 1', 'ACTIVE')`,
      [studentId, orgAId, classId]
    );
    await dbClient.query(
      `INSERT INTO student_safety_profiles (
         id, student_id, organization_id, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
         medical_conditions, allergies, consent_signed_by, updated_by
       ) VALUES ($1, $2, $3, 'Razlan Ahmad', 'Father', '+60123456789', 'Mild asthma; carries Ventolin inhaler', 'Peanut allergy', 'Razlan Ahmad', $4)`,
      [`safe_${ts}`, studentId, orgAId, masterPrimaryId]
    );

    // Tokens
    const tokenPrimary = generateAuthToken({ id: masterPrimaryId, email: 'm_prim@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenUnassigned = generateAuthToken({ id: masterUnassignedId, email: 'm_unass@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenExpired = generateAuthToken({ id: masterExpiredId, email: 'm_exp@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenFuture = generateAuthToken({ id: masterFutureId, email: 'm_fut@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenRevoked = generateAuthToken({ id: masterRevokedId, email: 'm_rev@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenMismatched = generateAuthToken({ id: masterMismatchedId, email: 'm_mism@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenValidSub = generateAuthToken({ id: masterValidSubId, email: 'm_val@subauth.test', role: UserRole.MASTER, organizationId: orgAId });
    const tokenCrossOrg = generateAuthToken({ id: masterCrossOrgId, email: 'm_crx@cross.test', role: UserRole.MASTER, organizationId: orgBId });
    const tokenAdminA = generateAuthToken({ id: adminOrgAId, email: 'admin_a@subauth.test', role: UserRole.ADMIN_PERSATUAN, organizationId: orgAId });
    const tokenAdminB = generateAuthToken({ id: adminOrgBId, email: 'admin_b@cross.test', role: UserRole.ADMIN_PERSATUAN, organizationId: orgBId });

    // --- Invariant 1: Unassigned same-Persatuan Master is DENIED ---
    console.log('--- 1. Invariant 1: Unassigned same-Persatuan Master is DENIED ---');
    const resUnassigned = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenUnassigned
    );
    assert.strictEqual(
      resUnassigned.status,
      403,
      `Expected HTTP 403 for unassigned master, received ${resUnassigned.status}: ${JSON.stringify(resUnassigned.data)}`
    );
    console.log('✅ Invariant 1 Passed: Unassigned Master denied substitute brief.');

    // --- Invariant 2: Expired delegation Master is DENIED ---
    console.log('--- 2. Invariant 2: Expired delegation Master is DENIED ---');
    const resExpired = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenExpired
    );
    assert.strictEqual(
      resExpired.status,
      403,
      `Expected HTTP 403 for expired delegation, received ${resExpired.status}: ${JSON.stringify(resExpired.data)}`
    );
    console.log('✅ Invariant 2 Passed: Master with expired delegation denied substitute brief.');

    // --- Invariant 3: Future delegation Master is DENIED ---
    console.log('--- 3. Invariant 3: Future delegation Master is DENIED ---');
    const resFuture = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenFuture
    );
    assert.strictEqual(
      resFuture.status,
      403,
      `Expected HTTP 403 for future delegation, received ${resFuture.status}: ${JSON.stringify(resFuture.data)}`
    );
    console.log('✅ Invariant 3 Passed: Master with future delegation denied substitute brief.');

    // --- Invariant 4: Revoked/Inactive delegation Master is DENIED ---
    console.log('--- 4. Invariant 4: Revoked/Inactive delegation Master is DENIED ---');
    const resRevoked = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenRevoked
    );
    assert.strictEqual(
      resRevoked.status,
      403,
      `Expected HTTP 403 for revoked delegation, received ${resRevoked.status}: ${JSON.stringify(resRevoked.data)}`
    );
    console.log('✅ Invariant 4 Passed: Master with revoked delegation denied substitute brief.');

    // --- Invariant 5: Mismatched session-scoped delegation Master is DENIED ---
    console.log('--- 5. Invariant 5: Mismatched session-scoped delegation Master is DENIED ---');
    const resMismatched = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenMismatched
    );
    assert.strictEqual(
      resMismatched.status,
      403,
      `Expected HTTP 403 for mismatched session delegation, received ${resMismatched.status}: ${JSON.stringify(resMismatched.data)}`
    );
    console.log('✅ Invariant 5 Passed: Master with mismatched session delegation denied substitute brief.');

    // --- Invariant 6: Cross-Persatuan Master is DENIED ---
    console.log('--- 6. Invariant 6: Cross-Persatuan Master is DENIED ---');
    const resCrossOrg = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenCrossOrg
    );
    assert.strictEqual(
      resCrossOrg.status,
      403,
      `Expected HTTP 403 for cross-persatuan master, received ${resCrossOrg.status}: ${JSON.stringify(resCrossOrg.data)}`
    );
    console.log('✅ Invariant 6 Passed: Cross-Persatuan Master denied substitute brief.');

    // --- Invariant 7: Cross-Persatuan Admin is DENIED ---
    console.log('--- 7. Invariant 7: Cross-Persatuan Admin is DENIED ---');
    const resCrossAdmin = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenAdminB
    );
    assert.strictEqual(
      resCrossAdmin.status,
      403,
      `Expected HTTP 403 for cross-persatuan admin, received ${resCrossAdmin.status}: ${JSON.stringify(resCrossAdmin.data)}`
    );
    console.log('✅ Invariant 7 Passed: Cross-Persatuan Admin denied substitute brief.');

    // --- Invariant 8: Valid Active Substitute Master is GRANTED & Private Notes Excluded ---
    console.log('--- 8. Invariant 8: Valid Active Substitute Master is GRANTED ---');
    const resValidSub = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenValidSub
    );
    assert.strictEqual(
      resValidSub.status,
      200,
      `Expected HTTP 200 for valid substitute master, received ${resValidSub.status}: ${JSON.stringify(resValidSub.data)}`
    );
    assert.ok(resValidSub.data.lessonPlan, 'Expected lessonPlan in substitute brief');
    assert.strictEqual(resValidSub.data.lessonPlan.title, 'Jurus Asas 1-4 & Pola Tapak');
    assert.strictEqual(resValidSub.data.lessonPlan.private_master_notes, undefined);
    assert.ok(Array.isArray(resValidSub.data.studentSafetyBrief));
    assert.strictEqual(resValidSub.data.studentSafetyBrief[0].allergies, 'Peanut allergy');
    console.log('✅ Invariant 8 Passed: Valid active substitute Master granted substitute brief with private notes stripped.');

    // --- Invariant 9: Active Primary Lead Master is GRANTED ---
    console.log('--- 9. Invariant 9: Active Primary Lead Master is GRANTED ---');
    const resPrimary = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenPrimary
    );
    assert.strictEqual(
      resPrimary.status,
      200,
      `Expected HTTP 200 for primary master, received ${resPrimary.status}`
    );
    console.log('✅ Invariant 9 Passed: Primary Lead Master granted substitute brief.');

    // --- Invariant 10: Admin Persatuan in same Org is GRANTED ---
    console.log('--- 10. Invariant 10: Admin Persatuan in same Org is GRANTED ---');
    const resAdminA = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${targetSessionId}/substitute-brief`,
      undefined,
      tokenAdminA
    );
    assert.strictEqual(resAdminA.status, 200);
    console.log('✅ Invariant 10 Passed: Tenant Admin Persatuan granted substitute brief.');

    console.log('🎉 ALL 10 SUB-AUTH-001 REGRESSION TESTS PASSED!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runSubAuthRegressionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ SUB-AUTH-001 Test Failure:', err);
      process.exit(1);
    });
}

export { runSubAuthRegressionTests };
