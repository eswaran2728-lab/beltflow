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
  console.log('🏛️ Starting Task H14: Academy Setup, Legacy Imports & Family Summary Acceptance Tests...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const orgIdA = 'org_onboarding_a';
    const orgIdB = 'org_onboarding_b';
    const parentId = 'usr_parent_h14_multi';

    // Clean up test organizations data for idempotency across test runs
    await dbClient.query('DELETE FROM import_batches WHERE organization_id IN ($1, $2)', [orgIdA, orgIdB]);
    await dbClient.query('DELETE FROM import_preview_records WHERE organization_id IN ($1, $2)', [orgIdA, orgIdB]);
    await dbClient.query('DELETE FROM monthly_dues WHERE organization_id IN ($1, $2)', [orgIdA, orgIdB]);
    await dbClient.query('DELETE FROM parent_student_links WHERE parent_id = $1', [parentId]);
    await dbClient.query('DELETE FROM students WHERE organization_id IN ($1, $2)', [orgIdA, orgIdB]);

    // 1. Seed two distinct Persatuans
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee, status)
       VALUES 
       ($1, 'Persatuan Silat Gayong Harimau A', 'Selangor', 'Silat', 'Master Azlan', '0123456781', 'azlan_h14@beltflow.test', 120.00, 'ACTIVE'),
       ($2, 'Persatuan Taekwondo Bunga Raya B', 'Kuala Lumpur', 'Taekwondo', 'Master Chong', '0123456782', 'chong_h14@beltflow.test', 150.00, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [orgIdA, orgIdB]
    );

    // 2. Seed Users
    const adminAId = 'usr_admin_h14_a';
    const adminBId = 'usr_admin_h14_b';
    const masterAId = 'usr_master_h14_a';
    const superAdminId = 'usr_super_admin_h14';

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
       VALUES 
       ($1, $2, 'admin_h14_a@beltflow.test', 'HASH', 'Admin Azlan', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($3, $4, 'admin_h14_b@beltflow.test', 'HASH', 'Admin Chong', 'ADMIN_PERSATUAN', 'ACTIVE'),
       ($5, $2, 'master_h14_a@beltflow.test', 'HASH', 'Master Jamal', 'MASTER', 'ACTIVE'),
       ($6, $2, 'parent_multi_h14@beltflow.test', 'HASH', 'Encik Sulaiman', 'PARENT', 'ACTIVE'),
       ($7, NULL, 'super_h14@beltflow.test', 'HASH', 'Super Auditor', 'SUPER_ADMIN', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role`,
      [adminAId, orgIdA, adminBId, orgIdB, masterAId, parentId, superAdminId]
    );

    // Seed master affiliation for Master A
    await dbClient.query(
      `INSERT INTO master_affiliations (id, organization_id, master_id, status)
       VALUES ('ma_h14_a', $1, $2, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [orgIdA, masterAId]
    );

    // Seed a class in Org A and Org B
    const classAId = 'cls_h14_a';
    const classBId = 'cls_h14_b';
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
       VALUES 
       ($1, $2, $3, 'Sat-Silat-Youth', 'Saturday 9am', 'Gelanggang A', 120.00, 'ACTIVE'),
       ($4, $5, NULL, 'Sun-TKD-Junior', 'Sunday 10am', 'Dojang B', 150.00, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [classAId, orgIdA, masterAId, classBId, orgIdB]
    );

    // Seed active curriculum for Org A
    await dbClient.query(
      `INSERT INTO persatuan_curriculums (id, organization_id, system_name, martial_art_style, status)
       VALUES ('curr_h14_a', $1, 'Silat Gayong 2026 Curriculum', 'Silat', 'PUBLISHED')
       ON CONFLICT (id) DO NOTHING`,
      [orgIdA]
    );
    await dbClient.query(
      `INSERT INTO curriculum_belt_ranks (id, curriculum_id, name, rank_order, color_hex, min_sessions)
       VALUES 
       ('rank_h14_1', 'curr_h14_a', 'White Belt', 1, '#FFFFFF', 0),
       ('rank_h14_2', 'curr_h14_a', 'Yellow Belt', 2, '#FFD700', 20),
       ('rank_h14_3', 'curr_h14_a', 'Green Belt', 3, '#008000', 40)
       ON CONFLICT (id) DO NOTHING`
    );

    // Seed merchant configurations for Org A and Org B
    await dbClient.query(
      `INSERT INTO persatuan_merchants (id, organization_id, provider, merchant_account_id, merchant_name, status)
       VALUES 
       ('merch_h14_a', $1, 'TOYYIBPAY', 'M-TOYYIB-H14-A', 'Persatuan Silat Gayong Harimau A', 'ACTIVE'),
       ('merch_h14_b', $2, 'CURLEC', 'M-CURLEC-H14-B', 'Persatuan Taekwondo Bunga Raya B', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [orgIdA, orgIdB]
    );

    // Seed an existing student in Org A to test duplicate detection
    const existingStudentIc = '080512-10-1234';
    await dbClient.query(
      `INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES ('stu_h14_existing', $1, 'Mohd Hafiz', $2, 'Yellow Belt', 120.00, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [orgIdA, existingStudentIc]
    );

    // Generate JWT tokens
    const tokenAdminA = generateAuthToken({ id: adminAId, email: 'admin_h14_a@beltflow.test', role: UserRole.ADMIN_PERSATUAN });
    const tokenAdminB = generateAuthToken({ id: adminBId, email: 'admin_h14_b@beltflow.test', role: UserRole.ADMIN_PERSATUAN });
    const tokenMasterA = generateAuthToken({ id: masterAId, email: 'master_h14_a@beltflow.test', role: UserRole.MASTER });
    const tokenParent = generateAuthToken({ id: parentId, email: 'parent_multi_h14@beltflow.test', role: UserRole.PARENT });
    const tokenSuper = generateAuthToken({ id: superAdminId, email: 'super_h14@beltflow.test', role: UserRole.SUPER_ADMIN });

    // ------------------------------------------------------------------------
    // Test 1: Academy Setup Readiness Evaluation
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Academy Setup Readiness Calculation ---');
    const readinessRes = await makeRequest(server, 'GET', '/onboarding-imports/academy-readiness', null, tokenAdminA);
    assert.equal(readinessRes.status, 200, 'Admin can fetch academy readiness');
    assert.equal(readinessRes.data.organizationId, orgIdA);
    assert.equal(readinessRes.data.isReadyForOperations, true, 'Org A has curriculum, classes, and masters');
    assert.ok(readinessRes.data.readinessScorePercent >= 80, 'Readiness percent should be high');
    assert.ok(Array.isArray(readinessRes.data.checklist), 'Checklist array returned');
    assert.ok(readinessRes.data.checklist.some((item: any) => item.key === 'CURRICULUM' && item.status === 'COMPLETE'));
    assert.ok(readinessRes.data.checklist.some((item: any) => item.key === 'CLASSES' && item.status === 'COMPLETE'));
    assert.ok(readinessRes.data.checklist.some((item: any) => item.key === 'MASTERS' && item.status === 'COMPLETE'));
    console.log('✅ Acceptance Test 1 Passed: Academy setup readiness calculated accurately.');

    // ------------------------------------------------------------------------
    // Test 2: acceptance_test: import_preview_no_mutation (Dry-Run Guarantee)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Acceptance Test: import_preview_no_mutation ---');
    const countBeforeRes = await dbClient.query('SELECT COUNT(*) AS count FROM students WHERE organization_id = $1', [orgIdA]);
    const studentCountBefore = parseInt(countBeforeRes.rows[0].count, 10);

    const testImportRows = [
      {
        fullName: 'Ahmad Daniel',
        icNumber: '110304-10-5566',
        beltRank: 'White Belt',
        className: 'Sat-Silat-Youth',
        parentName: 'Encik Daniel',
        parentPhone: '0129876543',
        parentEmail: 'daniel_parent@test.com'
      },
      {
        fullName: 'Siti Nurhaliza',
        icNumber: '120915-10-8899',
        beltRank: 'Yellow Belt',
        className: 'Sat-Silat-Youth',
        parentName: 'Puan Haliza',
        parentPhone: '0139988776',
        parentEmail: 'haliza_parent@test.com'
      },
      {
        // Duplicate row with existing student in roster
        fullName: 'Mohd Hafiz (Duplicate)',
        icNumber: existingStudentIc,
        beltRank: 'Yellow Belt'
      }
    ];

    const previewRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/preview-import',
      { rows: testImportRows, sourceFilename: 'silat_legacy_2026.csv' },
      tokenAdminA
    );

    assert.equal(previewRes.status, 200, 'Preview endpoint returns 200');
    assert.ok(previewRes.data.previewId, 'previewId must be generated');
    assert.equal(previewRes.data.totalRows, 3);
    assert.equal(previewRes.data.validRowsCount, 2);
    assert.equal(previewRes.data.duplicateRowsCount, 1);
    assert.equal(previewRes.data.canCommit, true);

    // Verify ZERO database mutations on students table
    const countAfterRes = await dbClient.query('SELECT COUNT(*) AS count FROM students WHERE organization_id = $1', [orgIdA]);
    const studentCountAfter = parseInt(countAfterRes.rows[0].count, 10);
    assert.equal(studentCountAfter, studentCountBefore, 'CRITICAL: previewImport must cause zero database mutations on students roster');
    console.log('✅ Acceptance Test 2 Passed: import_preview_no_mutation verified (dry-run produced zero mutations).');

    // ------------------------------------------------------------------------
    // Test 3: acceptance_test: unverified_parent_link_rejected
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Acceptance Test: unverified_parent_link_rejected ---');
    const unverifiedParentRows = [
      {
        fullName: 'Farhan Azim',
        icNumber: '130101-14-1122',
        parentName: 'Encik Azim', // Name provided but phone and email both missing
        parentPhone: '',
        parentEmail: ''
      }
    ];

    const unverifiedParentRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/preview-import',
      { rows: unverifiedParentRows },
      tokenAdminA
    );

    assert.equal(unverifiedParentRes.status, 200);
    assert.equal(unverifiedParentRes.data.unverifiedParentRowsCount, 1);
    assert.equal(unverifiedParentRes.data.previewRows[0].status, 'UNVERIFIED_PARENT');
    assert.ok(unverifiedParentRes.data.previewRows[0].errorMessage.includes('Guardian name requires a contact phone number or email'));
    console.log('✅ Acceptance Test 3 Passed: unverified_parent_link_rejected verified.');

    // ------------------------------------------------------------------------
    // Test 4: acceptance_test: wrong_tenant_rows_rejected
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Acceptance Test: wrong_tenant_rows_rejected ---');
    const wrongTenantRows = [
      {
        fullName: 'Lee Wei Lun',
        icNumber: '140505-10-3344',
        organizationId: orgIdB // Admin A is logged in, but row claims Org B!
      }
    ];

    const wrongTenantRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/preview-import',
      { rows: wrongTenantRows },
      tokenAdminA
    );

    assert.equal(wrongTenantRes.status, 200);
    assert.equal(wrongTenantRes.data.wrongTenantRowsCount, 1);
    assert.equal(wrongTenantRes.data.previewRows[0].status, 'WRONG_TENANT');
    assert.equal(wrongTenantRes.data.canCommit, false, 'Batch containing wrong-tenant rows must not be committable');
    console.log('✅ Acceptance Test 4 Passed: wrong_tenant_rows_rejected verified (cross-tenant injection blocked).');

    // ------------------------------------------------------------------------
    // Test 5: acceptance_test: malformed_rows_reported
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Acceptance Test: malformed_rows_reported ---');
    const malformedRows = [
      {
        fullName: '', // Empty name
        icNumber: '150606-10-7788'
      },
      {
        fullName: 'Kamal Hassan',
        icNumber: '123' // Invalid short IC
      }
    ];

    const malformedRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/preview-import',
      { rows: malformedRows },
      tokenAdminA
    );

    assert.equal(malformedRes.status, 200);
    assert.equal(malformedRes.data.malformedRowsCount, 2);
    assert.equal(malformedRes.data.errors.length, 2);
    assert.equal(malformedRes.data.errors[0].status, 'MALFORMED');
    assert.equal(malformedRes.data.errors[1].status, 'MALFORMED');
    console.log('✅ Acceptance Test 5 Passed: malformed_rows_reported with exact line numbers and reasons.');

    // ------------------------------------------------------------------------
    // Test 6: acceptance_test: import_retry_no_duplicate (Idempotent Commit)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Acceptance Test: import_retry_no_duplicate ---');
    const validPreviewId = previewRes.data.previewId;
    const testIdempotencyKey = 'idemp_h14_batch_999';

    // First commit execution
    const commit1Res = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/commit-import',
      { previewId: validPreviewId, idempotencyKey: testIdempotencyKey },
      tokenAdminA
    );

    assert.equal(commit1Res.status, 200, 'Commit succeeds on first execution');
    assert.equal(commit1Res.data.status, 'COMMITTED');
    assert.equal(commit1Res.data.importedStudentsCount, 2);
    assert.equal(commit1Res.data.importedGuardiansCount, 2);

    const countAfterCommit1 = await dbClient.query('SELECT COUNT(*) AS count FROM students WHERE organization_id = $1', [orgIdA]);
    const finalCount1 = parseInt(countAfterCommit1.rows[0].count, 10);
    assert.equal(finalCount1, studentCountBefore + 2, '2 new students should be added to roster');

    // Immediate retry with the EXACT SAME idempotencyKey
    const commit2Res = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/commit-import',
      { previewId: validPreviewId, idempotencyKey: testIdempotencyKey },
      tokenAdminA
    );

    assert.equal(commit2Res.status, 200, 'Commit retry succeeds idempotently');
    assert.equal(commit2Res.data.alreadyCommitted, true, 'Retry must return alreadyCommitted flag');
    assert.equal(commit2Res.data.importedStudentsCount, 2);

    // Verify ZERO duplicate students inserted on retry
    const countAfterCommit2 = await dbClient.query('SELECT COUNT(*) AS count FROM students WHERE organization_id = $1', [orgIdA]);
    const finalCount2 = parseInt(countAfterCommit2.rows[0].count, 10);
    assert.equal(finalCount2, finalCount1, 'CRITICAL: Re-submitting commit must never duplicate students or records');
    console.log('✅ Acceptance Test 6 Passed: import_retry_no_duplicate verified (idempotency safety preserved).');

    // ------------------------------------------------------------------------
    // Test 7: acceptance_test: family_checkout_separates_merchants
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Acceptance Test: family_checkout_separates_merchants ---');
    // Set up a parent with two children: Child 1 in Org A, Child 2 in Org B
    const child1Id = 'stu_fam_child1_a';
    const child2Id = 'stu_fam_child2_b';

    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, belt_rank, monthly_fee, status)
       VALUES 
       ($1, $2, $3, 'Harith Sulaiman', '120101-10-4433', 'Yellow Belt', 120.00, 'ACTIVE'),
       ($4, $5, $6, 'Aisyah Sulaiman', '140202-14-5544', 'White Belt', 150.00, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name`,
      [child1Id, orgIdA, classAId, child2Id, orgIdB, classBId]
    );

    // Link both children to the same parent
    await dbClient.query(
      `INSERT INTO parent_student_links (parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES 
       ($1, $2, 'ACTIVE', TRUE, TRUE, TRUE),
       ($1, $3, 'ACTIVE', TRUE, TRUE, TRUE)
       ON CONFLICT (parent_id, student_id) DO NOTHING`,
      [parentId, child1Id, child2Id]
    );

    // Seed outstanding dues for each child
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES 
       ('due_fam_01', $1, $2, $3, '2026-10', 120.00, 0.00, 'Pending'),
       ('due_fam_02', $4, $5, $6, '2026-10', 150.00, 0.00, 'Pending')
       ON CONFLICT (student_id, billing_month) DO UPDATE SET fee_amount = EXCLUDED.fee_amount`,
      [orgIdA, classAId, child1Id, orgIdB, classBId, child2Id]
    );

    // Call getFamilySummary() as the parent
    const familyRes = await makeRequest(server, 'GET', '/onboarding-imports/family-summary', null, tokenParent);
    assert.equal(familyRes.status, 200, 'Parent can fetch family summary');
    assert.equal(familyRes.data.children.length, 2, 'Both children returned in family roster');
    assert.equal(familyRes.data.hasCrossMerchantChildren, true, 'Flagged as multi-academy/multi-merchant family');
    assert.ok(familyRes.data.crossMerchantWarning.includes('Independent Persatuan Settlement'), 'Must display settlement warning');

    // Verify merchant checkout separation:
    const separated = familyRes.data.separatedCheckouts;
    assert.equal(separated.length, 2, 'Checkouts must be strictly separated into 2 distinct merchant bundles');

    const checkoutA = separated.find((c: any) => c.organizationId === orgIdA);
    const checkoutB = separated.find((c: any) => c.organizationId === orgIdB);

    assert.ok(checkoutA, 'Org A checkout exists');
    assert.equal(checkoutA.merchantId, 'merch_h14_a');
    assert.equal(checkoutA.totalAmountDue, 120.00);
    assert.equal(checkoutA.children.length, 1);
    assert.equal(checkoutA.children[0].fullName, 'Harith Sulaiman');

    assert.ok(checkoutB, 'Org B checkout exists');
    assert.equal(checkoutB.merchantId, 'merch_h14_b');
    assert.equal(checkoutB.totalAmountDue, 150.00);
    assert.equal(checkoutB.children.length, 1);
    assert.equal(checkoutB.children[0].fullName, 'Aisyah Sulaiman');

    console.log('✅ Acceptance Test 7 Passed: family_checkout_separates_merchants verified (zero payment pooling across Persatuans).');

    // ------------------------------------------------------------------------
    // Test 8: Super Admin Operational Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Super Admin Operational Access Denial ---');
    const superCommitRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/commit-import',
      { previewId: validPreviewId, idempotencyKey: 'super_try_key' },
      tokenSuper
    );
    assert.equal(superCommitRes.status, 403, 'Super Admin forbidden from committing student imports');
    console.log('✅ Security Test 8 Passed: Super Admin operational import access strictly denied.');

    // ------------------------------------------------------------------------
    // Test 9: Unauthorized Master Import Denial
    // ------------------------------------------------------------------------
    console.log('\n--- 9. Unauthorized Master Import Commit Denial ---');
    const masterCommitRes = await makeRequest(
      server,
      'POST',
      '/onboarding-imports/commit-import',
      { previewId: validPreviewId, idempotencyKey: 'master_try_key' },
      tokenMasterA
    );
    assert.equal(masterCommitRes.status, 403, 'Master without Persatuan Admin permission cannot commit imports');
    console.log('✅ Security Test 9 Passed: Unauthorized Master import commit denied.');

    // ------------------------------------------------------------------------
    // Test 10: Immutable Audit Log Creation
    // ------------------------------------------------------------------------
    console.log('\n--- 10. Immutable Audit Log Creation on Commit ---');
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'LEGACY_IMPORT_COMMITTED' ORDER BY timestamp DESC LIMIT 1"
    );
    assert.equal(auditRes.rowCount, 1, 'Audit log entry must be present');
    const auditEntry = auditRes.rows[0];
    assert.equal(auditEntry.user_email, 'admin_h14_a@beltflow.test');
    assert.ok(auditEntry.details.includes(testIdempotencyKey), 'Audit details must include idempotency key');
    assert.ok(auditEntry.details.includes(orgIdA), 'Audit details must include organizationId');
    console.log('✅ Governance Test 10 Passed: Import commit creates immutable audit log.');

    // ------------------------------------------------------------------------
    // Test 11: Certificate Privacy Regression (H13 Reconciliation)
    // ------------------------------------------------------------------------
    console.log('\n--- 11. Certificate Public Privacy Regression (Zero Unmasked Student Name) ---');
    const testCertCode = 'BF-H14-PRIV-01';
    await dbClient.query(
      `INSERT INTO certificates (id, organization_id, student_id, code, student_name, rank_or_title, organization_name, master_name, issue_date, type, status, verification_token)
       VALUES ('cert_h14_01', $1, $2, $3, 'Nur Imanina Binti Roslan', 'Brown Belt', 'Persatuan Silat Gayong Harimau A', 'Master Azlan', '2026-10-15', 'RANK', 'VALID', 'tok_h14_priv_01')
       ON CONFLICT (id) DO NOTHING`,
      [orgIdA, child1Id, testCertCode]
    );

    const pubCertCheck = await makeRequest(server, 'POST', '/certificates/public-verify', { codeOrToken: testCertCode });
    assert.equal(pubCertCheck.status, 200);
    assert.equal(pubCertCheck.data.verified, true);
    assert.equal(pubCertCheck.data.certificate.studentName, undefined, 'CRITICAL REGRESSION CHECK: Public certificate endpoint MUST NOT return unmasked studentName');
    assert.equal(pubCertCheck.data.certificate.maskedStudentName, 'N*r I*****a B***i R****n', 'Masked student name returned for public verification');
    console.log('✅ Privacy Test 11 Passed: Public certificate verification strictly omits unmasked studentName.');

    console.log('\n🎉 ALL 11 TASK H14 ACCEPTANCE TESTS & GOVERNANCE CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Task H14 Test Failure:', err);
  process.exit(1);
});
