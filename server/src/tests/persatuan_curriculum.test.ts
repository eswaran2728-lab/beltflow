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
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
      ...(extraHeaders || {}),
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
  console.log('🧪 Starting Persatuan-Configurable Belt Curriculum (Task H09) Integration Tests...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const orgAId = `org_curr_a_${Date.now()}`;
    const orgBId = `org_curr_b_${Date.now()}`;

    // Seed organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, sibling_discount_percent, status)
       VALUES ($1, 'Selangor Silambam Persatuan', 'Selangor', 'Silambam', 'Master Guru A', '0123456789', 'admin_a@beltflow.test', 120, 10, 'ACTIVE'),
              ($2, 'Penang Martial Arts Club', 'Penang', 'Taekwondo', 'Master Guru B', '0198765432', 'admin_b@beltflow.test', 140, 15, 'ACTIVE')`,
      [orgAId, orgBId]
    );

    // Users
    const adminA = { id: `usr_admin_a_${Date.now()}`, organizationId: orgAId, email: 'admin_a@beltflow.test', role: UserRole.ADMIN_PERSATUAN };
    const adminB = { id: `usr_admin_b_${Date.now()}`, organizationId: orgBId, email: 'admin_b@beltflow.test', role: UserRole.ADMIN_PERSATUAN };
    const masterA = { id: `usr_master_a_${Date.now()}`, organizationId: orgAId, email: 'master_a@beltflow.test', role: UserRole.MASTER };
    const studentA = { id: `usr_student_a_${Date.now()}`, organizationId: orgAId, email: 'student_a@beltflow.test', role: UserRole.STUDENT };
    const superAdmin = { id: `usr_super_${Date.now()}`, email: 'super@beltflow.test', role: UserRole.SUPER_ADMIN };

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'hash', 'Admin A', $4, 'ACTIVE'),
              ($5, $6, $7, 'hash', 'Admin B', $8, 'ACTIVE'),
              ($9, $10, $11, 'hash', 'Master A', $12, 'ACTIVE'),
              ($13, $14, $15, 'hash', 'Student A', $16, 'ACTIVE'),
              ($17, NULL, $18, 'hash', 'Super Admin', $19, 'ACTIVE')`,
      [
        adminA.id, orgAId, adminA.email, adminA.role,
        adminB.id, orgBId, adminB.email, adminB.role,
        masterA.id, orgAId, masterA.email, masterA.role,
        studentA.id, orgAId, studentA.email, studentA.role,
        superAdmin.id, superAdmin.email, superAdmin.role,
      ]
    );

    const tokenAdminA = generateAuthToken(adminA as any);
    const tokenAdminB = generateAuthToken(adminB as any);
    const tokenMasterA = generateAuthToken(masterA as any);
    const tokenStudentA = generateAuthToken(studentA as any);
    const tokenSuper = generateAuthToken(superAdmin as any);

    // TEST 1: GET /curriculums/active auto-provisions default published curriculum
    console.log('Test 1: Auto-provision active published curriculum on first query');
    const res1 = await makeRequest(server, 'GET', '/curriculums/active', null, tokenAdminA);
    assert.equal(res1.status, 200);
    assert.equal(res1.data.organizationId, orgAId);
    assert.equal(res1.data.curriculum.status, 'PUBLISHED');
    assert.equal(res1.data.curriculum.version, 1);
    assert.equal(res1.data.ranks.length, 8);
    assert.equal(res1.data.ranks[0].name, 'White Belt');
    assert.equal(res1.data.ranks[7].name, 'Black Belt');
    const v1CurriculumId = res1.data.curriculum.id;
    console.log('✅ Test 1 Passed: Default curriculum v1 auto-provisioned with 8 ranks.');

    // TEST 2: Master and Student within tenant can read active curriculum
    console.log('Test 2: Master and Student access to active curriculum');
    const res2Master = await makeRequest(server, 'GET', '/curriculums/active', null, tokenMasterA);
    assert.equal(res2Master.status, 200);
    assert.equal(res2Master.data.curriculum.id, v1CurriculumId);

    const res2Student = await makeRequest(server, 'GET', '/curriculums/active', null, tokenStudentA);
    assert.equal(res2Student.status, 200);
    assert.equal(res2Student.data.curriculum.id, v1CurriculumId);
    console.log('✅ Test 2 Passed: Master and Student read tenant active curriculum.');

    // TEST 3: Cross-tenant isolation - Admin B gets their own isolated curriculum
    console.log('Test 3: Cross-tenant isolation for active curriculum');
    const res3 = await makeRequest(server, 'GET', '/curriculums/active', null, tokenAdminB);
    assert.equal(res3.status, 200);
    assert.equal(res3.data.organizationId, orgBId);
    assert.notEqual(res3.data.curriculum.id, v1CurriculumId);
    assert.equal(res3.data.curriculum.martial_art_style, 'Taekwondo');
    console.log('✅ Test 3 Passed: Tenant B receives separate curriculum isolated from Tenant A.');

    // TEST 4: GET /curriculums list versions for Persatuan Admin
    console.log('Test 4: List curriculum versions for Persatuan Admin');
    const res4 = await makeRequest(server, 'GET', '/curriculums', null, tokenAdminA);
    assert.equal(res4.status, 200);
    assert.equal(res4.data.curriculums.length, 1);
    assert.equal(res4.data.curriculums[0].version, 1);
    assert.equal(res4.data.curriculums[0].status, 'PUBLISHED');
    console.log('✅ Test 4 Passed: Listed 1 curriculum version.');

    // TEST 5: Master and Student denied access to manage curriculums endpoint
    console.log('Test 5: RBAC enforcement on curriculum management');
    const res5Master = await makeRequest(server, 'GET', '/curriculums', null, tokenMasterA);
    assert.equal(res5Master.status, 403);
    const res5Student = await makeRequest(server, 'POST', '/curriculums', { systemName: 'Hacked' }, tokenStudentA);
    assert.equal(res5Student.status, 403);
    console.log('✅ Test 5 Passed: Non-admin users forbidden from curriculum management.');

    // TEST 6: Create new DRAFT version (v2) cloned from v1
    console.log('Test 6: Create DRAFT curriculum v2 cloned from v1');
    const res6 = await makeRequest(
      server,
      'POST',
      '/curriculums',
      {
        systemName: '2026 Enhanced Silambam Syllabus',
        cloneFromVersionId: v1CurriculumId,
      },
      tokenAdminA
    );
    assert.equal(res6.status, 201);
    assert.equal(res6.data.curriculum.status, 'DRAFT');
    assert.equal(res6.data.curriculum.version, 2);
    assert.equal(res6.data.ranks.length, 8);
    const v2CurriculumId = res6.data.curriculum.id;
    console.log('✅ Test 6 Passed: Created DRAFT v2 with 8 cloned ranks.');

    // TEST 7: Update DRAFT curriculum metadata
    console.log('Test 7: Update DRAFT metadata');
    const res7 = await makeRequest(
      server,
      'PUT',
      `/curriculums/${v2CurriculumId}`,
      {
        systemName: 'Official 2026 Selangor Silambam Syllabus',
      },
      tokenAdminA
    );
    assert.equal(res7.status, 200);
    assert.equal(res7.data.curriculum.system_name, 'Official 2026 Selangor Silambam Syllabus');
    console.log('✅ Test 7 Passed: Updated DRAFT system_name.');

    // TEST 8: Modify belt ranks in DRAFT (custom 6-rank Traditional Silambam syllabus)
    console.log('Test 8: Customize belt ranks in DRAFT v2');
    const customRanks = [
      { rankOrder: 1, name: 'Vellai (White)', colorHex: '#FFFFFF', minMonths: 0, minSessions: 0, gradingFee: 0, description: 'Beginner' },
      { rankOrder: 2, name: 'Manjal (Yellow)', colorHex: '#FACC15', minMonths: 3, minSessions: 24, gradingFee: 50, description: 'Basic Forms' },
      { rankOrder: 3, name: 'Pachai (Green)', colorHex: '#22C55E', minMonths: 6, minSessions: 48, gradingFee: 70, description: 'Intermediate Staff' },
      { rankOrder: 4, name: 'Neelam (Blue)', colorHex: '#3B82F6', minMonths: 9, minSessions: 72, gradingFee: 90, description: 'Advanced Sparring' },
      { rankOrder: 5, name: 'Kapi (Brown)', colorHex: '#92400E', minMonths: 12, minSessions: 96, gradingFee: 120, description: 'Pre-Instructor' },
      { rankOrder: 6, name: 'Karuppu (Black Asan)', colorHex: '#0F172A', minMonths: 24, minSessions: 192, gradingFee: 250, isDanRank: true, danLevel: 1, description: 'Mastery' },
    ];

    const res8 = await makeRequest(
      server,
      'PUT',
      `/curriculums/${v2CurriculumId}/ranks`,
      { ranks: customRanks },
      tokenAdminA
    );
    assert.equal(res8.status, 200);
    assert.equal(res8.data.ranks.length, 6);
    assert.equal(res8.data.ranks[0].name, 'Vellai (White)');
    assert.equal(res8.data.ranks[5].name, 'Karuppu (Black Asan)');
    assert.equal(res8.data.ranks[5].is_dan_rank, true);
    console.log('✅ Test 8 Passed: Belt ranks modified in DRAFT v2.');

    // TEST 9: Rank validation - Duplicate rank orders rejected
    console.log('Test 9: Rank validation rejects duplicate rank orders');
    const invalidRanks = [
      { rankOrder: 1, name: 'Rank A', colorHex: '#FFFFFF' },
      { rankOrder: 1, name: 'Rank B', colorHex: '#FACC15' },
    ];
    const res9 = await makeRequest(
      server,
      'PUT',
      `/curriculums/${v2CurriculumId}/ranks`,
      { ranks: invalidRanks },
      tokenAdminA
    );
    assert.equal(res9.status, 400);
    assert.match(res9.data.error, /Duplicate rankOrder/);
    console.log('✅ Test 9 Passed: Duplicate rank orders correctly rejected with 400.');

    // TEST 10: Cannot publish curriculum with zero ranks
    console.log('Test 10: Cannot publish empty curriculum');
    const emptyDraft = await makeRequest(server, 'POST', '/curriculums', { systemName: 'Empty Draft' }, tokenAdminA);
    // Delete ranks from this draft directly to simulate empty
    await dbClient.query('DELETE FROM curriculum_belt_ranks WHERE curriculum_id = $1', [emptyDraft.data.curriculum.id]);
    const res10 = await makeRequest(server, 'POST', `/curriculums/${emptyDraft.data.curriculum.id}/publish`, null, tokenAdminA);
    assert.equal(res10.status, 400);
    assert.match(res10.data.error, /without belt ranks/);
    // Clean up empty draft
    await makeRequest(server, 'DELETE', `/curriculums/${emptyDraft.data.curriculum.id}`, null, tokenAdminA);
    console.log('✅ Test 10 Passed: Cannot publish empty curriculum.');

    // TEST 11: Publish DRAFT v2 - Atomically archives v1 and publishes v2
    console.log('Test 11: Atomic publish transitions v2 to PUBLISHED and v1 to ARCHIVED');
    const res11 = await makeRequest(server, 'POST', `/curriculums/${v2CurriculumId}/publish`, null, tokenAdminA);
    assert.equal(res11.status, 200);
    assert.equal(res11.data.curriculum.status, 'PUBLISHED');
    assert.equal(res11.data.curriculum.version, 2);

    // Verify v1 is now ARCHIVED
    const v1Check = await dbClient.query('SELECT status FROM persatuan_curriculums WHERE id = $1', [v1CurriculumId]);
    assert.equal(v1Check.rows[0].status, 'ARCHIVED');

    // Verify GET /curriculums/active now immediately returns v2 with the 6 custom ranks
    const res11Active = await makeRequest(server, 'GET', '/curriculums/active', null, tokenStudentA);
    assert.equal(res11Active.status, 200);
    assert.equal(res11Active.data.curriculum.id, v2CurriculumId);
    assert.equal(res11Active.data.ranks.length, 6);
    assert.equal(res11Active.data.ranks[5].name, 'Karuppu (Black Asan)');
    console.log('✅ Test 11 Passed: v2 published and v1 archived atomically.');

    // TEST 12: Immutability - Cannot modify published or archived curriculums
    console.log('Test 12: Published and archived curriculums are immutable');
    const res12Pub = await makeRequest(
      server,
      'PUT',
      `/curriculums/${v2CurriculumId}/ranks`,
      { ranks: customRanks },
      tokenAdminA
    );
    assert.equal(res12Pub.status, 400);
    assert.match(res12Pub.data.error, /Cannot modify belt ranks of a published or archived curriculum/);

    const res12Arch = await makeRequest(
      server,
      'PUT',
      `/curriculums/${v1CurriculumId}/ranks`,
      { ranks: customRanks },
      tokenAdminA
    );
    assert.equal(res12Arch.status, 400);
    console.log('✅ Test 12 Passed: Immutability enforced on published and archived versions.');

    // TEST 13: Cannot delete published or archived curriculums
    console.log('Test 13: Cannot delete published or archived curriculums');
    const res13Pub = await makeRequest(server, 'DELETE', `/curriculums/${v2CurriculumId}`, null, tokenAdminA);
    assert.equal(res13Pub.status, 400);

    const res13Arch = await makeRequest(server, 'DELETE', `/curriculums/${v1CurriculumId}`, null, tokenAdminA);
    assert.equal(res13Arch.status, 400);
    console.log('✅ Test 13 Passed: Cannot delete published/archived versions.');

    // TEST 14: Draft deletion works cleanly
    console.log('Test 14: Draft deletion');
    const draft3 = await makeRequest(server, 'POST', '/curriculums', { systemName: 'Temporary Draft v3' }, tokenAdminA);
    assert.equal(draft3.status, 201);
    const draft3Id = draft3.data.curriculum.id;

    const res14Del = await makeRequest(server, 'DELETE', `/curriculums/${draft3Id}`, null, tokenAdminA);
    assert.equal(res14Del.status, 200);

    const draft3Check = await dbClient.query('SELECT id FROM persatuan_curriculums WHERE id = $1', [draft3Id]);
    assert.equal(draft3Check.rowCount, 0);
    console.log('✅ Test 14 Passed: Draft deletion succeeded.');

    // TEST 15: Cross-tenant modification rejected (Admin B trying to edit Admin A's draft)
    console.log('Test 15: Cross-tenant draft modification rejected');
    const draft4 = await makeRequest(server, 'POST', '/curriculums', { systemName: 'Draft v4' }, tokenAdminA);
    const draft4Id = draft4.data.curriculum.id;

    const res15 = await makeRequest(
      server,
      'PUT',
      `/curriculums/${draft4Id}`,
      { systemName: 'Malicious update' },
      tokenAdminB
    );
    assert.equal(res15.status, 403);
    console.log('✅ Test 15 Passed: Cross-tenant modification rejected with 403.');

    console.log('\n🎉 ALL 15 PERSATUAN CURRICULUM INTEGRATION TESTS PASSED!');
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
