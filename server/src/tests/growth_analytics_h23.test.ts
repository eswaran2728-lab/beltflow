import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { sanitizeCsvValue } from '../routes/analytics.routes';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; rawBody: string; headers: http.IncomingHttpHeaders }> {
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
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: resData, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🥋 Starting Task H23: Growth Analytics & Authorized Exports Acceptance Tests...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const orgAId = 'org_h23_selangor';
    const orgBId = 'org_h23_penang';
    const timestamp = Date.now();

    // 1. Seed Organizations
    await dbClient.query(`
      INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
      VALUES 
        ('${orgAId}', 'Selangor Silambam H23', 'Selangor', 'Silambam', 'Master A', '0123456789', 'org_a_${timestamp}@h23.test', 'ACTIVE'),
        ('${orgBId}', 'Penang Silambam H23', 'Penang', 'Silambam', 'Master B', '0198765432', 'org_b_${timestamp}@h23.test', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `);

    // 2. Seed Users
    const superAdminId = `usr_sa_${timestamp}`;
    const adminAId = `usr_adm_a_${timestamp}`;
    const adminBId = `usr_adm_b_${timestamp}`;
    const masterAId = `usr_mst_a_${timestamp}`;
    const parentId = `usr_par_${timestamp}`;
    const studentId = `usr_stu_${timestamp}`;

    const usersToInsert = [
      { id: superAdminId, email: `sa_${timestamp}@test.com`, role: UserRole.SUPER_ADMIN, org: null },
      { id: adminAId, email: `adm_a_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, org: orgAId },
      { id: adminBId, email: `adm_b_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, org: orgBId },
      { id: masterAId, email: `mst_a_${timestamp}@test.com`, role: UserRole.MASTER, org: orgAId },
      { id: parentId, email: `par_${timestamp}@test.com`, role: UserRole.PARENT, org: orgAId },
      { id: studentId, email: `stu_${timestamp}@test.com`, role: UserRole.STUDENT, org: orgAId },
    ];

    for (const u of usersToInsert) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'hash', $2, $3, $4, 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
        [u.id, u.email, u.role, u.org]
      );
    }

    const tokenSuper = generateAuthToken({ id: superAdminId, email: `sa_${timestamp}@test.com`, role: UserRole.SUPER_ADMIN, organizationId: undefined });
    const tokenAdminA = generateAuthToken({ id: adminAId, email: `adm_a_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgAId });
    const tokenAdminB = generateAuthToken({ id: adminBId, email: `adm_b_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: orgBId });
    const tokenMasterA = generateAuthToken({ id: masterAId, email: `mst_a_${timestamp}@test.com`, role: UserRole.MASTER, organizationId: orgAId, assignedClassIds: ['cls_h23_a1'] });
    const tokenParent = generateAuthToken({ id: parentId, email: `par_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: orgAId });
    const tokenStudent = generateAuthToken({ id: studentId, email: `stu_${timestamp}@test.com`, role: UserRole.STUDENT, organizationId: orgAId });

    // 3. Seed Classes
    await dbClient.query(`
      INSERT INTO classes (id, organization_id, master_id, name, schedule, location, capacity, monthly_fee, status)
      VALUES 
        ('cls_h23_a1', '${orgAId}', '${masterAId}', 'Class A1 Morning', 'Mon 8am', 'Dojang A', 20, 120.00, 'ACTIVE'),
        ('cls_h23_a2', '${orgAId}', NULL, 'Class A2 Evening', 'Wed 6pm', 'Dojang A', 25, 140.00, 'ACTIVE'),
        ('cls_h23_b1', '${orgBId}', NULL, 'Class B1 Penang', 'Sat 10am', 'Dojang B', 30, 150.00, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `);

    // Assign Master A to cls_h23_a1
    await dbClient.query(`
      INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
      VALUES ('${masterAId}', 'cls_h23_a1', TRUE)
      ON CONFLICT (coach_id, class_id) DO NOTHING;
    `);

    // 4. Seed Active Students
    await dbClient.query(`
      INSERT INTO students (id, organization_id, class_id, full_name, ic_number, monthly_fee, status)
      VALUES 
        ('stu_h23_1', '${orgAId}', 'cls_h23_a1', 'Student One', '080101-10-1111', 120.00, 'ACTIVE'),
        ('stu_h23_2', '${orgAId}', 'cls_h23_a1', 'Student Two', '080202-10-2222', 120.00, 'ACTIVE'),
        ('stu_h23_3', '${orgAId}', 'cls_h23_a2', 'Student Three', '080303-10-3333', 140.00, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `);

    await dbClient.query(`
      INSERT INTO class_enrollments (id, organization_id, class_id, student_id, status)
      VALUES 
        ('enr_h23_1', '${orgAId}', 'cls_h23_a1', 'stu_h23_1', 'ACTIVE'),
        ('enr_h23_2', '${orgAId}', 'cls_h23_a1', 'stu_h23_2', 'ACTIVE'),
        ('enr_h23_3', '${orgAId}', 'cls_h23_a2', 'stu_h23_3', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `);

    // 5. Seed Students with PENDING status (applicants awaiting approval)
    await dbClient.query(`
      INSERT INTO students (id, organization_id, class_id, full_name, ic_number, monthly_fee, status)
      VALUES 
        ('stu_h23_p1', '${orgAId}', 'cls_h23_a1', 'Pending Applicant 1', '090101-10-9991', 120.00, 'PENDING'),
        ('stu_h23_p2', '${orgAId}', 'cls_h23_a2', 'Pending Applicant 2', '090202-10-9992', 140.00, 'PENDING')
      ON CONFLICT (id) DO UPDATE SET status = 'PENDING';
    `);

    // Seed Pending Applications (NOT active students)
    await dbClient.query(`
      INSERT INTO enrollment_applications (id, organization_id, class_id, student_id, status)
      VALUES 
        ('app_h23_p1', '${orgAId}', 'cls_h23_a1', 'stu_h23_p1', 'SUBMITTED'),
        ('app_h23_p2', '${orgAId}', 'cls_h23_a2', 'stu_h23_p2', 'UNDER_REVIEW')
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `);

    // 6. Seed Trial Bookings
    await dbClient.query(`
      INSERT INTO trial_bookings (id, organization_id, class_id, candidate_name, guardian_phone, scheduled_date, status)
      VALUES 
        ('tb_h23_1', '${orgAId}', 'cls_h23_a1', 'Trial Attendee 1', '0133333333', CURRENT_DATE, 'CONVERTED'),
        ('tb_h23_2', '${orgAId}', 'cls_h23_a1', 'Trial Attendee 2', '0144444444', CURRENT_DATE, 'ATTENDED'),
        ('tb_h23_3', '${orgAId}', 'cls_h23_a2', 'Trial Attendee 3', '0155555555', CURRENT_DATE, 'BOOKED')
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `);

    // 7. Seed Payments in Ledger
    await dbClient.query(`
      INSERT INTO payments (id, organization_id, student_id, amount, method, status, receipt_no, submitted_by)
      VALUES 
        ('pay_h23_1', '${orgAId}', 'stu_h23_1', 120.00, 'FPX', 'Approved', 'RCP-H23-001', '${adminAId}'),
        ('pay_h23_2', '${orgAId}', 'stu_h23_2', 120.00, 'DuitNow QR', 'Approved', 'RCP-H23-002', '${adminAId}'),
        ('pay_h23_failed', '${orgAId}', 'stu_h23_3', 140.00, 'FPX', 'Rejected', 'RCP-H23-FAIL', '${adminAId}')
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `);

    // 8. Seed Unpaid Monthly Dues
    await dbClient.query(`
      INSERT INTO monthly_dues (id, organization_id, student_id, class_id, billing_month, fee_amount, amount_paid, status)
      VALUES 
        ('due_h23_1', '${orgAId}', 'stu_h23_3', 'cls_h23_a2', '2026-10', 140.00, 0.00, 'Pending')
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `);

    console.log('\n--- Test 1: tenant_filter_enforced_server_side ---');
    // Persatuan Admin attempting to query metrics for another organization is DENIED
    const crossOrgRes = await makeRequest(server, 'GET', `/analytics/metrics?organizationId=${orgBId}`, undefined, tokenAdminA);
    assert.strictEqual(crossOrgRes.status, 403, 'Cross-tenant query must be rejected with 403');
    assert.match(crossOrgRes.data.error, /tenant|organization|forbidden|access denied/i);

    // Persatuan Admin querying without organizationId is automatically scoped to their own organization
    const autoScopedRes = await makeRequest(server, 'GET', '/analytics/metrics', undefined, tokenAdminA);
    assert.strictEqual(autoScopedRes.status, 200);
    assert.strictEqual(autoScopedRes.data.metadata.organizationId, orgAId);

    // Master attempting to query an unassigned class is DENIED
    const masterUnassignedRes = await makeRequest(server, 'GET', '/analytics/metrics?classId=cls_h23_a2', undefined, tokenMasterA);
    assert.strictEqual(masterUnassignedRes.status, 403, 'Unassigned class query by Master must be rejected with 403');

    // Super Admin can query specific organization
    const superOrgBRes = await makeRequest(server, 'GET', `/analytics/metrics?organizationId=${orgBId}`, undefined, tokenSuper);
    assert.strictEqual(superOrgBRes.status, 200);
    assert.strictEqual(superOrgBRes.data.metadata.organizationId, orgBId);

    // Parent and Student denied
    const parentRes = await makeRequest(server, 'GET', '/analytics/metrics', undefined, tokenParent);
    assert.strictEqual(parentRes.status, 403);
    const studentRes = await makeRequest(server, 'GET', '/analytics/metrics', undefined, tokenStudent);
    assert.strictEqual(studentRes.status, 403);
    console.log('✅ Criterion 1 (tenant_filter_enforced_server_side) PASSED.');

    console.log('\n--- Test 2: finance_matches_ledger ---');
    const finRes = await makeRequest(server, 'GET', `/analytics/metrics?organizationId=${orgAId}`, undefined, tokenAdminA);
    assert.strictEqual(finRes.status, 200);
    assert.ok(finRes.data.ledgerTotals, 'ledgerTotals must exist');
    assert.strictEqual(finRes.data.ledgerTotals.totalCollected, 240.00, 'totalCollected must match completed ledger payments (120 + 120)');
    assert.strictEqual(finRes.data.ledgerTotals.totalOutstanding, 140.00, 'totalOutstanding must match unpaid dues');
    console.log('✅ Criterion 2 (finance_matches_ledger) PASSED.');

    console.log('\n--- Test 3: transfers_not_double_counted ---');
    // Transferred student: stu_h23_transfer from cls_h23_a1 to cls_h23_a2
    await dbClient.query(`
      INSERT INTO students (id, organization_id, class_id, full_name, ic_number, monthly_fee, status)
      VALUES ('stu_h23_transfer', '${orgAId}', 'cls_h23_a2', 'Transferred Student', '080404-10-4444', 140.00, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET class_id = 'cls_h23_a2', status = 'ACTIVE';
    `);
    await dbClient.query(`
      INSERT INTO class_transfer_requests (id, student_id, organization_id, old_class_id, new_class_id, status)
      VALUES ('trf_h23_1', 'stu_h23_transfer', '${orgAId}', 'cls_h23_a1', 'cls_h23_a2', 'APPROVED')
      ON CONFLICT (id) DO NOTHING;
    `);
    await dbClient.query(`
      INSERT INTO class_enrollments (id, organization_id, class_id, student_id, status)
      VALUES 
        ('enr_h23_trf_old', '${orgAId}', 'cls_h23_a1', 'stu_h23_transfer', 'TRANSFERRED'),
        ('enr_h23_trf_new', '${orgAId}', 'cls_h23_a2', 'stu_h23_transfer', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `);

    const transferOrgRes = await makeRequest(server, 'GET', '/analytics/metrics', undefined, tokenAdminA);
    assert.strictEqual(transferOrgRes.status, 200);
    assert.strictEqual(transferOrgRes.data.enrollment.activeEnrolledStudents, 4, 'Transferred student must not be double counted in org totals');

    const transferMasterRes = await makeRequest(server, 'GET', '/analytics/metrics?classId=cls_h23_a1', undefined, tokenMasterA);
    assert.strictEqual(transferMasterRes.status, 200);
    assert.strictEqual(transferMasterRes.data.enrollment.activeEnrolledStudents, 2, 'Transferred-out student must not be counted in source class');
    console.log('✅ Criterion 3 (transfers_not_double_counted) PASSED.');

    console.log('\n--- Test 4: pending_applicants_not_active_students ---');
    const applicantRes = await makeRequest(server, 'GET', '/analytics/metrics', undefined, tokenAdminA);
    assert.strictEqual(applicantRes.status, 200);
    assert.strictEqual(applicantRes.data.enrollment.pendingApplicants, 2, 'Must report 2 pending applicants');
    assert.strictEqual(applicantRes.data.enrollment.activeEnrolledStudents, 4, 'Active enrolled students must strictly exclude pending applicants');
    assert.strictEqual(applicantRes.data.trialConversion.totalTrialsBooked, 3, 'Must track 3 total trial bookings');
    assert.strictEqual(applicantRes.data.trialConversion.trialsConverted, 1, 'Must track 1 converted trial');
    assert.strictEqual(applicantRes.data.trialConversion.conversionRatePercent, 33.33, 'Conversion rate must be 33.33%');
    console.log('✅ Criterion 4 (pending_applicants_not_active_students) PASSED.');

    console.log('\n--- Test 5: export_cannot_expand_query_scope ---');
    // Admin A requests export for Org B -> 403 Forbidden
    const expandOrgRes = await makeRequest(server, 'POST', '/analytics/export', { reportType: 'ACADEMY_GROWTH_METRICS', organizationId: orgBId, format: 'csv' }, tokenAdminA);
    assert.strictEqual(expandOrgRes.status, 403, 'Cross-tenant export request must be rejected');

    // Master requests export for organization-wide report -> 403 Forbidden
    const expandMasterRes = await makeRequest(server, 'POST', '/analytics/export', { reportType: 'ACADEMY_GROWTH_METRICS', scope: 'organization', format: 'json' }, tokenMasterA);
    assert.strictEqual(expandMasterRes.status, 403, 'Master cannot expand export scope beyond assigned classes');

    // Valid Persatuan Admin CSV Export
    const csvExportRes = await makeRequest(server, 'POST', '/analytics/export', { reportType: 'ACADEMY_GROWTH_METRICS', format: 'csv' }, tokenAdminA);
    assert.strictEqual(csvExportRes.status, 200);
    assert.ok(csvExportRes.rawBody.includes('Metric,Value'), 'CSV header must be present');
    assert.ok(csvExportRes.rawBody.includes('Active Enrolled Students,4'), 'CSV data must match calculated metrics');
    assert.ok(csvExportRes.rawBody.includes('Total Collected (MYR),240'), 'CSV ledger must match');

    // Audit log check
    const auditRes = await dbClient.query(`
      SELECT * FROM audit_logs 
      WHERE user_email = 'adm_a_${timestamp}@test.com' AND action = 'EXPORT_ANALYTICS_REPORT'
      ORDER BY timestamp DESC LIMIT 1
    `);
    assert.strictEqual(auditRes.rowCount, 1, 'Audit log entry must be created on export');

    // Valid Master JSON Export
    const jsonMasterExport = await makeRequest(server, 'POST', '/analytics/export', { reportType: 'ACADEMY_GROWTH_METRICS', classId: 'cls_h23_a1', format: 'json' }, tokenMasterA);
    assert.strictEqual(jsonMasterExport.status, 200);
    assert.strictEqual(jsonMasterExport.data.classId, 'cls_h23_a1');
    assert.strictEqual(jsonMasterExport.data.metrics.enrollment.activeEnrolledStudents, 2);
    // Super Admin restricted from class operational records
    const saClassRes = await makeRequest(server, 'GET', '/analytics/metrics?classId=cls_h23_a1', undefined, tokenSuper);
    assert.strictEqual(saClassRes.status, 403, 'Super Admin must not access individual class operational records');
    assert.ok(saClassRes.data.error.includes('Super Admin is restricted to platform-level analytics'));

    const saExportRes = await makeRequest(server, 'POST', '/analytics/export', { reportType: 'ACADEMY_GROWTH_METRICS', classId: 'cls_h23_a1', format: 'json' }, tokenSuper);
    assert.strictEqual(saExportRes.status, 403, 'Super Admin class operational export must be forbidden');

    // CSV Formula Injection Prevention verification (prepends single quote to neutralize formula evaluation)
    assert.strictEqual(sanitizeCsvValue('=cmd|/c calc'), '"\'=cmd|/c calc"');
    assert.strictEqual(sanitizeCsvValue('+12345'), '"\'+12345"');
    assert.strictEqual(sanitizeCsvValue('-SUM(A1:A10)'), '"\'-SUM(A1:A10)"');
    assert.strictEqual(sanitizeCsvValue('@alert(1)'), '"\'@alert(1)"');
    assert.strictEqual(sanitizeCsvValue('\ttabbed'), '"\'\ttabbed"');
    assert.strictEqual(sanitizeCsvValue('Standard Value'), 'Standard Value');
    assert.strictEqual(sanitizeCsvValue('Value, With Comma'), '"Value, With Comma"');

    console.log('✅ Criterion 5 (export_cannot_expand_query_scope & CSV sanitization) PASSED.');

    console.log('\n🎉 ALL 5 OFFICIAL H23 ACCEPTANCE CRITERIA PASSED WITHOUT REGRESSION!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ H23 Acceptance Tests Failed:', err);
      process.exit(1);
    });
}

export { runTests as runH23Tests };
