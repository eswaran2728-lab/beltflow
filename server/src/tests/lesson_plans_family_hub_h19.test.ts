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

async function runH19Tests() {
  console.log('🥋 Starting Task H19: Lesson Plans & Family Hub Depth Integration Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const ts = Date.now();
  const orgAId = `org_h19_a_${ts}`;
  const orgBId = `org_h19_b_${ts}`;

  try {
    // 1. Provision Two Distinct Organizations (Merchants)
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES 
       ($1, 'Persatuan Taekwondo Selangor', 'Selangor', 'Taekwondo', 'Grandmaster Lim', '0123456789', $3, 120.00, 'ACTIVE'),
       ($2, 'Persatuan Taekwondo Wilayah KL', 'Kuala Lumpur', 'Taekwondo', 'Grandmaster Tan', '0123456788', $4, 150.00, 'ACTIVE')`,
      [orgAId, orgBId, `admin_a_${ts}@selangor.test`, `admin_b_${ts}@kl.test`]
    );

    await dbClient.query(
      `INSERT INTO persatuan_merchants (id, organization_id, merchant_account_id, merchant_name, status)
       VALUES 
       ($1, $2, 'acct_sel_123', 'Selangor Martial Arts Merchant', 'ACTIVE'),
       ($3, $4, 'acct_kl_456', 'KL Martial Arts Merchant', 'ACTIVE')`,
      [`merch_a_${ts}`, orgAId, `merch_b_${ts}`, orgBId]
    );

    // 2. Provision Users
    const masterA1Id = `usr_mst_a1_${ts}`;
    const masterA2SubstituteId = `usr_mst_sub_${ts}`;
    const parentId = `usr_par_${ts}`;
    const revokedParentId = `usr_par_rev_${ts}`;

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES 
       ($1, $2, $3, 'HASH', 'Master A1 Author', '0111', 'MASTER', 'ACTIVE'),
       ($4, $2, $5, 'HASH', 'Master A2 Substitute', '0112', 'MASTER', 'ACTIVE'),
       ($6, $2, $7, 'HASH', 'Parent Active', '0113', 'PARENT', 'ACTIVE'),
       ($8, $2, $9, 'HASH', 'Parent Revoked', '0114', 'PARENT', 'ACTIVE')`,
      [
        masterA1Id, orgAId, `m_a1_${ts}@test.com`,
        masterA2SubstituteId, `m_sub_${ts}@test.com`,
        parentId, `parent_${ts}@test.com`,
        revokedParentId, `revoked_par_${ts}@test.com`,
      ]
    );

    // Master affiliations
    await dbClient.query(
      `INSERT INTO master_affiliations (id, master_id, organization_id, status, effective_from, verification_provenance)
       VALUES 
       ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED'),
       ($4, $5, $6, 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '10 days', 'ADMIN_VERIFIED')`,
      [`aff_a1_${ts}`, masterA1Id, orgAId, `aff_sub_${ts}`, masterA2SubstituteId, orgAId]
    );

    // 3. Classes in Persatuan A & B
    const classAId = `cls_a_${ts}`;
    const classBId = `cls_b_${ts}`;

    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, main_master_id, name, schedule, location, capacity, monthly_fee, status, approval_status, operational_status)
       VALUES 
       ($1, $2, $3, $3, 'Poomsae Elite Class', 'Mon/Wed 8PM', 'Shah Alam Center', 25, 120.00, 'ACTIVE', 'APPROVED', 'ACTIVE'),
       ($4, $5, $3, $3, 'Sparring KL Class', 'Tue/Thu 8PM', 'KL Center', 25, 150.00, 'ACTIVE', 'APPROVED', 'ACTIVE')`,
      [classAId, orgAId, masterA1Id, classBId, orgBId]
    );

    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active, effective_from, provenance)
       VALUES 
       ($1, $2, $3, $4, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED'),
       ($5, $6, $3, $7, 'PRIMARY', TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day', 'ADMIN_ASSIGNED')`,
      [`lead_a_${ts}`, classAId, masterA1Id, orgAId, `lead_b_${ts}`, classBId, orgBId]
    );

    // Training Group & Sessions in Class A
    const groupIdA = `grp_a_${ts}`;
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name)
       VALUES ($1, $2, $3, 'Poomsae Intermediate')`,
      [groupIdA, orgAId, classAId]
    );

    const sessionAId = `sess_a_${ts}`;
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
       VALUES ($1, $2, $3, $4, '2026-11-10', 'Monday', '20:00', '21:30', 'Shah Alam Center', 'Scheduled')`,
      [sessionAId, orgAId, classAId, groupIdA]
    );

    // 4. Students
    // Child 1 with Long Multilingual Name (Malay, Jawi, Chinese, Tamil)
    const multilingualChildName = 'Tengku Muhammad Danial Asyraf bin Raja Noor Azam / 莫哈末丹尼尔 / முகமது டேனியல்';
    const child1Id = `stu1_multi_${ts}`;
    const child2Id = `stu2_kl_${ts}`;

    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES 
       ($1, $2, $3, $4, '120101-10-5555', 'Green Belt', 120.00, 'ACTIVE'),
       ($5, $6, $7, 'Siti Nur Aisyah binti Ahmad', '130202-14-6666', 'Yellow Belt', 150.00, 'ACTIVE')`,
      [child1Id, orgAId, classAId, multilingualChildName, child2Id, orgBId, classBId]
    );

    // Student safety profile for Child 1
    await dbClient.query(
      `INSERT INTO student_safety_profiles (
         id, student_id, organization_id, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
         medical_conditions, allergies, consent_signed_by, updated_by
       ) VALUES ($1, $2, $3, 'Parent Active', 'Mother', '0123456789', 'Mild Asthma', 'Peanuts, Shellfish', 'Parent Active', $4)`,
      [`safe_${ts}`, child1Id, orgAId, parentId]
    );

    // Parent Student Links
    // Active link for parentId -> child1Id (Org A) and child2Id (Org B)
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES 
       ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE),
       ($4, $5, $6, 'ACTIVE', TRUE, TRUE, TRUE),
       ($7, $8, $9, 'REVOKED', FALSE, FALSE, FALSE)`,
      [
        `psl1_${ts}`, parentId, child1Id,
        `psl2_${ts}`, parentId, child2Id,
        `psl_rev_${ts}`, revokedParentId, child1Id,
      ]
    );

    // Dues for Child 1 in Org A (Merchant A)
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, $3, $4, '2026-10', 120.00, 0.00, 'Pending')`,
      [`due_a_${ts}`, orgAId, classAId, child1Id]
    );

    // Dues for Child 2 in Org B (Merchant B)
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, $3, $4, '2026-10', 150.00, 50.00, 'Partially Paid')`,
      [`due_b_${ts}`, orgBId, classBId, child2Id]
    );

    // Auth Tokens
    const masterA1Token = generateAuthToken({
      id: masterA1Id,
      organizationId: orgAId,
      role: UserRole.MASTER,
      email: `m_a1_${ts}@test.com`,
      assignedClassIds: [classAId],
    });

    const substituteMasterToken = generateAuthToken({
      id: masterA2SubstituteId,
      organizationId: orgAId,
      role: UserRole.MASTER,
      email: `m_sub_${ts}@test.com`,
      assignedClassIds: [], // Not primary master for this class
    });

    const activeParentToken = generateAuthToken({
      id: parentId,
      organizationId: orgAId,
      role: UserRole.PARENT,
      email: `parent_${ts}@test.com`,
      linkedStudentIds: [child1Id, child2Id],
    });

    const revokedParentToken = generateAuthToken({
      id: revokedParentId,
      organizationId: orgAId,
      role: UserRole.PARENT,
      email: `revoked_par_${ts}@test.com`,
      linkedStudentIds: [child1Id],
    });

    // ========================================================================
    // ACCEPTANCE TEST 1: substitute_brief_hides_private_messages
    // ========================================================================
    console.log('\n--- 1. Acceptance Test: substitute_brief_hides_private_messages ---');
    const privateNoteContent = 'CONFIDENTIAL_NOTE: Student has knee recovery instructions; do not force jump kicks!';

    // Author Master saves lesson plan with public drills + private master notes
    const savePlanRes = await makeRequest(
      server,
      'PUT',
      `/teaching/sessions/${sessionAId}/lesson-plan`,
      {
        title: 'Taegeuk 4 Jang Precision & Sparring Footwork',
        objectives: 'Improve lateral stability and stance transitions.',
        drills: [
          { name: 'Pyramid Stance Holds', duration_minutes: 15, instructions: 'Hold Ap-Kubi 60s each' },
          { name: 'Side Step Counter Drills', duration_minutes: 20, instructions: 'Evade and roundhouse counter' },
        ],
        equipment: ['Kicking Shields', 'Agility Ladders', 'Cones'],
        coveredMaterial: 'Taegeuk 4 Jang Movements 1 to 14',
        privateMasterNotes: privateNoteContent,
        expectedVersion: 1,
      },
      masterA1Token
    );

    assert.equal(savePlanRes.status, 200, 'Author Master must successfully save lesson plan');
    assert.equal(savePlanRes.data.lessonPlan.title, 'Taegeuk 4 Jang Precision & Sparring Footwork');
    assert.equal(savePlanRes.data.lessonPlan.version, 1);
    assert.equal(savePlanRes.data.lessonPlan.private_master_notes, privateNoteContent);

    // Substitute Master requests substitute brief
    const subBriefRes = await makeRequest(
      server,
      'GET',
      `/teaching/sessions/${sessionAId}/substitute-brief`,
      {},
      substituteMasterToken
    );

    assert.equal(subBriefRes.status, 200, 'Substitute Master must be allowed to fetch substitute brief');
    assert.equal(subBriefRes.data.isSubstituteBrief, true);
    assert.ok(subBriefRes.data.lessonPlan, 'Lesson plan payload must be present');
    assert.equal(subBriefRes.data.lessonPlan.title, 'Taegeuk 4 Jang Precision & Sparring Footwork');
    assert.equal(subBriefRes.data.lessonPlan.objectives, 'Improve lateral stability and stance transitions.');
    assert.equal(subBriefRes.data.lessonPlan.drills.length, 2);
    assert.deepEqual(subBriefRes.data.lessonPlan.equipment, ['Kicking Shields', 'Agility Ladders', 'Cones']);

    // STRICT PRIVACY VERIFICATION: Private notes are completely stripped out
    assert.strictEqual(
      subBriefRes.data.lessonPlan.private_master_notes,
      undefined,
      'private_master_notes must be completely omitted from substitute brief'
    );
    assert.strictEqual(
      subBriefRes.data.lessonPlan.privateMasterNotes,
      undefined,
      'privateMasterNotes must be completely omitted from substitute brief'
    );
    assert.equal(
      subBriefRes.rawBody.includes(privateNoteContent),
      false,
      'Private master note string must never appear in raw substitute brief response'
    );
    console.log('✅ Acceptance Test 1 Passed: substitute_brief_hides_private_messages verified.');

    // ========================================================================
    // ACCEPTANCE TEST 2: lesson_edit_version_conflict
    // ========================================================================
    console.log('\n--- 2. Acceptance Test: lesson_edit_version_conflict ---');
    // First edit advances version to 2
    const edit1Res = await makeRequest(
      server,
      'PUT',
      `/teaching/sessions/${sessionAId}/lesson-plan`,
      {
        title: 'Taegeuk 4 Jang - Extended Conditioning',
        objectives: 'Added endurance circuit.',
        drills: [{ name: 'Stance Drills', duration_minutes: 20 }],
        expectedVersion: 1, // Matches current version 1 -> advances to version 2
      },
      masterA1Token
    );
    assert.equal(edit1Res.status, 200, 'Valid expectedVersion update should succeed');
    assert.equal(edit1Res.data.lessonPlan.version, 2, 'Version must increment to 2');

    // Concurrent user attempts update using stale expectedVersion 1 -> MUST FAIL 409 CONFLICT
    const staleEditRes = await makeRequest(
      server,
      'PUT',
      `/teaching/sessions/${sessionAId}/lesson-plan`,
      {
        title: 'Stale Concurrent Edit by Another Instructor',
        objectives: 'Stale objectives',
        expectedVersion: 1, // Stale! Current version is 2
      },
      masterA1Token
    );

    assert.equal(staleEditRes.status, 409, 'Stale expectedVersion edit must return HTTP 409 Conflict');
    assert.ok(
      staleEditRes.data.error.toLowerCase().includes('version conflict'),
      'Error message must clearly identify version conflict'
    );
    assert.equal(staleEditRes.data.currentVersion, 2, 'Response must return current version for client reconciliation');
    console.log('✅ Acceptance Test 2 Passed: lesson_edit_version_conflict verified.');

    // ========================================================================
    // ACCEPTANCE TEST 3: revoked_guardian_loses_access
    // ========================================================================
    console.log('\n--- 3. Acceptance Test: revoked_guardian_loses_access ---');
    // Active parent accesses Child 1 timeline -> 200 OK
    const activeTimelineRes = await makeRequest(
      server,
      'GET',
      `/family/students/${child1Id}/timeline`,
      {},
      activeParentToken
    );
    assert.equal(activeTimelineRes.status, 200, 'Active linked parent must have access to child timeline');
    assert.equal(activeTimelineRes.data.student.id, child1Id);

    // Revoked parent attempts to access Child 1 timeline -> MUST FAIL 403 FORBIDDEN
    const revokedTimelineRes = await makeRequest(
      server,
      'GET',
      `/family/students/${child1Id}/timeline`,
      {},
      revokedParentToken
    );
    assert.equal(revokedTimelineRes.status, 403, 'Revoked guardian must receive HTTP 403 Forbidden');
    assert.ok(
      revokedTimelineRes.data.error.toLowerCase().includes('revoked') ||
        revokedTimelineRes.data.error.toLowerCase().includes('access denied'),
      'Error message must state guardian access is revoked or denied'
    );
    console.log('✅ Acceptance Test 3 Passed: revoked_guardian_loses_access verified.');

    // ========================================================================
    // ACCEPTANCE TEST 4: long_multilingual_child_names_readable
    // ========================================================================
    console.log('\n--- 4. Acceptance Test: long_multilingual_child_names_readable ---');
    // Retrieve timeline and children roster for parent with multilingual child
    const timelineData = activeTimelineRes.data;
    assert.equal(
      timelineData.student.fullName,
      multilingualChildName,
      'Student timeline must preserve exact multilingual characters without truncation or question marks'
    );

    const childrenRosterRes = await makeRequest(server, 'GET', '/family/children', {}, activeParentToken);
    assert.equal(childrenRosterRes.status, 200);
    const multiChild = childrenRosterRes.data.children.find((c: any) => c.id === child1Id);
    assert.ok(multiChild, 'Child 1 must be present in children roster');
    assert.equal(
      multiChild.full_name,
      multilingualChildName,
      'Children list must preserve exact multi-byte characters (Malay, Chinese, Tamil, etc.)'
    );
    console.log('✅ Acceptance Test 4 Passed: long_multilingual_child_names_readable verified.');

    // ========================================================================
    // ACCEPTANCE TEST 5: family_totals_correct_per_merchant
    // ========================================================================
    console.log('\n--- 5. Acceptance Test: family_totals_correct_per_merchant ---');
    // Active parent has Child 1 in Org A (RM 120 due) and Child 2 in Org B (RM 150 due, RM 50 paid -> RM 100 outstanding)
    const summaryRes = await makeRequest(server, 'GET', '/family/merchant-dues-summary', {}, activeParentToken);
    assert.equal(summaryRes.status, 200, 'Merchant dues summary must return 200 OK');

    const merchants = summaryRes.data.merchants;
    assert.equal(merchants.length, 2, 'Family summary must return exactly 2 distinct merchant partitions');

    const merchA = merchants.find((m: any) => m.organizationId === orgAId);
    const merchB = merchants.find((m: any) => m.organizationId === orgBId);

    assert.ok(merchA, 'Merchant A partition must exist');
    assert.equal(merchA.totalFeeAmount, 120.00, 'Merchant A fee amount must be RM 120.00');
    assert.equal(merchA.totalAmountPaid, 0.00, 'Merchant A amount paid must be RM 0.00');
    assert.equal(merchA.totalOutstandingAmount, 120.00, 'Merchant A outstanding must be RM 120.00');
    assert.equal(merchA.studentDues.length, 1);
    assert.equal(merchA.studentDues[0].studentId, child1Id);

    assert.ok(merchB, 'Merchant B partition must exist');
    assert.equal(merchB.totalFeeAmount, 150.00, 'Merchant B fee amount must be RM 150.00');
    assert.equal(merchB.totalAmountPaid, 50.00, 'Merchant B amount paid must be RM 50.00');
    assert.equal(merchB.totalOutstandingAmount, 100.00, 'Merchant B outstanding must be RM 100.00');
    assert.equal(merchB.studentDues.length, 1);
    assert.equal(merchB.studentDues[0].studentId, child2Id);

    // Verify individual child timeline financial partitions
    const child1Partitions = activeTimelineRes.data.financialPartitions;
    assert.equal(child1Partitions.length, 1, 'Child 1 timeline must only contain its own merchant dues');
    assert.equal(child1Partitions[0].organizationId, orgAId);
    assert.equal(child1Partitions[0].totalOutstandingAmount, 120.00);

    console.log('✅ Acceptance Test 5 Passed: family_totals_correct_per_merchant verified.');

    console.log('\n🎉 ALL 5 OFFICIAL TASK H19 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runH19Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Task H19 Test Suite Failed:', err);
    process.exit(1);
  });
