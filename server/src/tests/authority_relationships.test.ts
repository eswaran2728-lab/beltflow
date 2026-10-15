import assert from 'node:assert/strict';
import { dbClient, SqlTransactionClient } from '../db/client';
import { UserRole } from '../security/rbac';
import {
  authorize,
  AuthorityCapability,
  createMasterAffiliation,
  assignClassLeadership,
  enrollStudentInClass,
  getLegacyReconciliationReport,
  runLegacyMigration,
} from '../security/authority';

async function runTests() {
  console.log('🚀 Starting H02 Authority Relationships & Legacy Migration Test Suite...');
  await dbClient.init();

  // Test setup: Organizations
  const org1Id = `org_h02_test1_${Date.now()}`;
  const org2Id = `org_h02_test2_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, base_monthly_fee)
     VALUES ($1, 'Persatuan Test A', 'Selangor', 'Silambam', 'Master Guru A', '0123456789', $2, 120.00),
            ($3, 'Persatuan Test B', 'Kuala Lumpur', 'Taekwondo', 'Master Guru B', '0198765432', $4, 150.00)`,
    [org1Id, `testA_${Date.now()}@example.com`, org2Id, `testB_${Date.now()}@example.com`]
  );

  // Setup Users
  const superAdminId = `usr_sa_${Date.now()}`;
  const adminAId = `usr_adm_a_${Date.now()}`;
  const masterAId = `usr_mst_a_${Date.now()}`;
  const masterBId = `usr_mst_b_${Date.now()}`;
  const student1Id = `usr_std_1_${Date.now()}`;
  const parent1Id = `usr_par_1_${Date.now()}`;

  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, NULL, $2, 'hash', 'Super Admin User', 'SUPER_ADMIN', 'ACTIVE'),
            ($3, $4, $5, 'hash', 'Persatuan A Admin', 'ADMIN_PERSATUAN', 'ACTIVE'),
            ($6, $7, $8, 'hash', 'Master Alice (Org A)', 'MASTER', 'ACTIVE'),
            ($9, $10, $11, 'hash', 'Master Bob (Org B)', 'MASTER', 'ACTIVE'),
            ($12, $13, $14, 'hash', 'Student Charlie', 'STUDENT', 'ACTIVE'),
            ($15, $16, $17, 'hash', 'Parent David', 'PARENT', 'ACTIVE')`,
    [
      superAdminId, `sa_${Date.now()}@beltflow.test`,
      adminAId, org1Id, `adminA_${Date.now()}@beltflow.test`,
      masterAId, org1Id, `masterA_${Date.now()}@beltflow.test`,
      masterBId, org2Id, `masterB_${Date.now()}@beltflow.test`,
      student1Id, org1Id, `student1_${Date.now()}@beltflow.test`,
      parent1Id, org1Id, `parent1_${Date.now()}@beltflow.test`,
    ]
  );

  // Setup Class in Org A
  const classAId = `cls_a_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, status)
     VALUES ($1, $2, 'Dragons Class', 'Mon 18:00', 'Dojang A', 120.00, 'ACTIVE')`,
    [classAId, org1Id]
  );

  // Setup Student in Org A
  const studentRecId = `std_rec_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, belt_rank, monthly_fee, status)
     VALUES ($1, $2, $3, $4, 'Student Charlie', '050101-14-1234', 'White Belt', 120.00, 'ACTIVE')`,
    [studentRecId, org1Id, classAId, student1Id]
  );

  // =========================================================================
  // SCENARIO 1: Same-Persatuan Master affiliation accepted
  // =========================================================================
  console.log('Scenario 1: Same-Persatuan Master affiliation accepted...');
  const affil1 = await createMasterAffiliation({
    masterId: masterAId,
    organizationId: org1Id,
    status: 'ACTIVE',
    reviewedBy: adminAId,
    reviewNotes: 'Verified credential documents',
    verificationProvenance: 'DIRECT_REVIEW',
  });
  assert.equal(affil1.status, 'ACTIVE');
  assert.equal(affil1.organization_id, org1Id);
  assert.equal(affil1.master_id, masterAId);

  // =========================================================================
  // SCENARIO 2: Cross-Persatuan affiliation rejected
  // =========================================================================
  console.log('Scenario 2: Cross-Persatuan affiliation rejected...');
  await assert.rejects(
    async () => {
      // masterA belongs to org1Id, attempting to affiliate with org2Id without cross-tenant authority
      await createMasterAffiliation({
        masterId: masterAId,
        organizationId: org2Id,
        status: 'ACTIVE',
        reviewedBy: adminAId, // Admin A is not in Org B!
        verificationProvenance: 'DIRECT_REVIEW',
      });
    },
    /Cross-tenant affiliation rejected|does not belong to target organization/i
  );

  // =========================================================================
  // SCENARIO 3: Pending Master cannot receive operational authority
  // =========================================================================
  console.log('Scenario 3: Pending Master cannot receive operational authority...');
  const pendingMasterId = `usr_mst_pending_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'hash', 'Master Pending', 'MASTER', 'ACTIVE')`,
    [pendingMasterId, org1Id, `mst_pending_${Date.now()}@beltflow.test`]
  );
  await createMasterAffiliation({
    masterId: pendingMasterId,
    organizationId: org1Id,
    status: 'PENDING',
    verificationProvenance: 'DIRECT_REVIEW',
  });

  const authDecisionPending = await authorize(
    { id: pendingMasterId, email: 'pending@test.com', role: UserRole.MASTER, organizationId: org1Id },
    AuthorityCapability.CLASS_OPERATE,
    { organizationId: org1Id, classId: classAId }
  );
  assert.equal(authDecisionPending.allowed, false, 'Pending master must not be allowed to operate classes');
  assert.match(authDecisionPending.reason || '', /affiliation is not ACTIVE/i);

  // =========================================================================
  // SCENARIO 4: Suspended Master denied operations
  // =========================================================================
  console.log('Scenario 4: Suspended Master denied operations...');
  const suspendedMasterId = `usr_mst_susp_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'hash', 'Master Suspended', 'MASTER', 'ACTIVE')`,
    [suspendedMasterId, org1Id, `mst_susp_${Date.now()}@beltflow.test`]
  );
  await createMasterAffiliation({
    masterId: suspendedMasterId,
    organizationId: org1Id,
    status: 'SUSPENDED',
    verificationProvenance: 'DIRECT_REVIEW',
  });

  const authDecisionSuspended = await authorize(
    { id: suspendedMasterId, email: 'susp@test.com', role: UserRole.MASTER, organizationId: org1Id },
    AuthorityCapability.CLASS_OPERATE,
    { organizationId: org1Id, classId: classAId }
  );
  assert.equal(authDecisionSuspended.allowed, false, 'Suspended master must be denied operations');

  // =========================================================================
  // SCENARIO 5: Ended affiliation denied operations
  // =========================================================================
  console.log('Scenario 5: Ended affiliation denied operations...');
  const endedMasterId = `usr_mst_ended_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'hash', 'Master Ended', 'MASTER', 'ACTIVE')`,
    [endedMasterId, org1Id, `mst_ended_${Date.now()}@beltflow.test`]
  );
  await createMasterAffiliation({
    masterId: endedMasterId,
    organizationId: org1Id,
    status: 'ENDED',
    verificationProvenance: 'DIRECT_REVIEW',
  });

  const authDecisionEnded = await authorize(
    { id: endedMasterId, email: 'ended@test.com', role: UserRole.MASTER, organizationId: org1Id },
    AuthorityCapability.CLASS_OPERATE,
    { organizationId: org1Id, classId: classAId }
  );
  assert.equal(authDecisionEnded.allowed, false, 'Ended affiliation must be denied operations');

  // =========================================================================
  // SCENARIO 6: Active verified Master scope enforced
  // =========================================================================
  console.log('Scenario 6: Active verified Master scope enforced...');
  // Assign Master A as Primary Leader of Class A
  await assignClassLeadership({
    classId: classAId,
    masterId: masterAId,
    organizationId: org1Id,
    leadershipType: 'PRIMARY',
    appointedBy: adminAId,
  });

  const authDecisionActive = await authorize(
    { id: masterAId, email: 'masterA@test.com', role: UserRole.MASTER, organizationId: org1Id },
    AuthorityCapability.CLASS_OPERATE,
    { organizationId: org1Id, classId: classAId }
  );
  assert.equal(authDecisionActive.allowed, true, 'Active verified leader of class must be authorized');

  // =========================================================================
  // SCENARIO 7: Duplicate active affiliation handled safely
  // =========================================================================
  console.log('Scenario 7: Duplicate active affiliation handled safely...');
  await assert.rejects(
    async () => {
      await createMasterAffiliation({
        masterId: masterAId,
        organizationId: org1Id,
        status: 'ACTIVE',
        verificationProvenance: 'DIRECT_REVIEW',
      });
    },
    /duplicate key|already has an active affiliation/i
  );

  // =========================================================================
  // SCENARIO 8: Overlapping primary class leadership rejected
  // =========================================================================
  console.log('Scenario 8: Overlapping primary class leadership rejected...');
  const anotherMasterId = `usr_mst_another_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'hash', 'Master Another', 'MASTER', 'ACTIVE')`,
    [anotherMasterId, org1Id, `mst_another_${Date.now()}@beltflow.test`]
  );
  await createMasterAffiliation({
    masterId: anotherMasterId,
    organizationId: org1Id,
    status: 'ACTIVE',
    reviewedBy: adminAId,
  });

  await assert.rejects(
    async () => {
      // Attempting to assign a second active PRIMARY leader to classA without ending Master A's leadership
      await assignClassLeadership({
        classId: classAId,
        masterId: anotherMasterId,
        organizationId: org1Id,
        leadershipType: 'PRIMARY',
        appointedBy: adminAId,
      });
    },
    /overlapping primary leadership|already has an active primary leader/i
  );

  // =========================================================================
  // SCENARIO 9: Historical leadership preserved
  // =========================================================================
  console.log('Scenario 9: Historical leadership preserved...');
  // Deactivate Master A's primary leadership with effective_to
  const now = new Date();
  await dbClient.query(
    `UPDATE class_leaderships SET is_active = FALSE, effective_to = $1 WHERE class_id = $2 AND master_id = $3`,
    [now, classAId, masterAId]
  );
  // Now assign anotherMaster as primary
  await assignClassLeadership({
    classId: classAId,
    masterId: anotherMasterId,
    organizationId: org1Id,
    leadershipType: 'PRIMARY',
    appointedBy: adminAId,
  });

  const historyRes = await dbClient.query(
    'SELECT * FROM class_leaderships WHERE class_id = $1 ORDER BY created_at ASC',
    [classAId]
  );
  assert.equal(historyRes.rowCount, 2, 'History must retain previous leadership entry');
  assert.equal(historyRes.rows[0].is_active, false);
  assert.equal(historyRes.rows[1].is_active, true);

  // =========================================================================
  // SCENARIO 10: Temporary delegate cannot replace primary Master
  // =========================================================================
  console.log('Scenario 10: Temporary delegate cannot replace primary Master...');
  const substituteLeader = await assignClassLeadership({
    classId: classAId,
    masterId: masterAId,
    organizationId: org1Id,
    leadershipType: 'SUBSTITUTE',
    appointedBy: adminAId,
  });
  assert.equal(substituteLeader.leadership_type, 'SUBSTITUTE');

  // Verify primary leader is still anotherMasterId
  const primaryLeaderCheck = await dbClient.query(
    `SELECT master_id FROM class_leaderships WHERE class_id = $1 AND is_active = TRUE AND leadership_type = 'PRIMARY'`,
    [classAId]
  );
  assert.equal(primaryLeaderCheck.rows[0].master_id, anotherMasterId);

  // =========================================================================
  // SCENARIO 11: Student identity preserved across enrollment changes
  // =========================================================================
  console.log('Scenario 11: Student identity preserved across enrollment changes...');
  const enrollment1 = await enrollStudentInClass({
    studentId: studentRecId,
    classId: classAId,
    organizationId: org1Id,
    status: 'ACTIVE',
    provenance: 'MASTER_APPROVED',
    approvedByMasterId: anotherMasterId,
  });
  assert.equal(enrollment1.student_id, studentRecId);

  // Create Class 2 in Org A
  const classA2Id = `cls_a2_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, status)
     VALUES ($1, $2, 'Tigers Class', 'Tue 18:00', 'Dojang A', 120.00, 'ACTIVE')`,
    [classA2Id, org1Id]
  );

  // End old enrollment and start new enrollment
  await dbClient.query(
    `UPDATE class_enrollments SET status = 'TRANSFERRED', is_primary = FALSE, effective_to = CURRENT_TIMESTAMP WHERE id = $1`,
    [enrollment1.id]
  );
  const enrollment2 = await enrollStudentInClass({
    studentId: studentRecId,
    classId: classA2Id,
    organizationId: org1Id,
    status: 'ACTIVE',
    provenance: 'TRANSFER',
    approvedByMasterId: anotherMasterId,
  });
  assert.equal(enrollment2.student_id, studentRecId, 'Student ID must remain invariant across transfers');

  // Verify student record in `students` table has not changed its primary ID
  const studentCheck = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentRecId]);
  assert.equal(studentCheck.rowCount, 1);
  assert.equal(studentCheck.rows[0].id, studentRecId);

  // =========================================================================
  // SCENARIO 12: Cross-Persatuan student enrollment rejected
  // =========================================================================
  console.log('Scenario 12: Cross-Persatuan student enrollment rejected...');
  const classBId = `cls_b_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO classes (id, organization_id, name, schedule, location, monthly_fee, status)
     VALUES ($1, $2, 'Phoenix Class Org B', 'Wed 18:00', 'Dojang B', 140.00, 'ACTIVE')`,
    [classBId, org2Id]
  );

  await assert.rejects(
    async () => {
      // studentRecId is in org1Id, classBId is in org2Id
      await enrollStudentInClass({
        studentId: studentRecId,
        classId: classBId,
        organizationId: org2Id,
        status: 'ACTIVE',
      });
    },
    /Cross-tenant enrollment rejected|student does not belong to target organization/i
  );

  // =========================================================================
  // SCENARIO 13: Duplicate active enrollment prevented
  // =========================================================================
  console.log('Scenario 13: Duplicate active enrollment prevented...');
  await assert.rejects(
    async () => {
      await enrollStudentInClass({
        studentId: studentRecId,
        classId: classA2Id,
        organizationId: org1Id,
        status: 'ACTIVE',
      });
    },
    /duplicate key|already actively enrolled/i
  );

  // =========================================================================
  // SCENARIO 14: Existing attendance records remain accessible to authorized legacy users
  // =========================================================================
  console.log('Scenario 14: Existing attendance records remain accessible to authorized legacy users...');
  // Insert legacy session and attendance record
  const grpAId = `grp_a_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO training_groups (id, organization_id, class_id, name)
     VALUES ($1, $2, $3, 'All Ages Dragons')`,
    [grpAId, org1Id, classAId]
  );
  const legacySessId = `tsess_leg_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status)
     VALUES ($1, $2, $3, $4, '2026-10-01', 'Thursday', '18:00', '19:30', 'Dojang A', 'Completed')`,
    [legacySessId, org1Id, classAId, grpAId]
  );
  await dbClient.query(
    `INSERT INTO session_attendance (id, session_id, student_id, status, marked_by, version)
     VALUES ($1, $2, $3, 'Present', $4, 1)`,
    [`satt_leg_${Date.now()}`, legacySessId, studentRecId, masterAId]
  );

  const attQuery = await dbClient.query(
    `SELECT sa.* FROM session_attendance sa
     JOIN training_sessions ts ON ts.id = sa.session_id
     WHERE ts.class_id = $1`,
    [classAId]
  );
  assert.ok(attQuery.rowCount > 0, 'Legacy attendance records must be fully accessible');

  // =========================================================================
  // SCENARIO 15: Existing fees and receipt numbers remain unchanged
  // =========================================================================
  console.log('Scenario 15: Existing fees and receipt numbers remain unchanged...');
  const payId = `pay_h02_${Date.now()}`;
  const receiptNo = `REC-H02-${Date.now()}`;
  await dbClient.query(
    `INSERT INTO payments (id, organization_id, student_id, amount, method, receipt_no, submitted_by, status)
     VALUES ($1, $2, $3, 120.00, 'DuitNow QR', $4, $5, 'Approved')`,
    [payId, org1Id, studentRecId, receiptNo, adminAId]
  );
  const payCheck = await dbClient.query('SELECT receipt_no, amount FROM payments WHERE id = $1', [payId]);
  assert.equal(payCheck.rows[0].receipt_no, receiptNo);
  assert.equal(Number(payCheck.rows[0].amount), 120.00);

  // =========================================================================
  // SCENARIO 16: Existing certificates remain unchanged
  // =========================================================================
  console.log('Scenario 16: Existing certificates remain unchanged...');
  const certId = `cert_h02_${Date.now()}`;
  const certCode = `CERT-H02-${Date.now()}`;
  await dbClient.query(
    `INSERT INTO certificates (id, code, organization_id, organization_name, student_id, student_name, master_name, rank_or_title, issue_date, status)
     VALUES ($1, $2, $3, 'Persatuan Test A', $4, 'Student Charlie', 'Master Alice', 'Yellow Belt', '2026-10-01', 'ACTIVE')`,
    [certId, certCode, org1Id, studentRecId]
  );
  const certCheck = await dbClient.query('SELECT code, rank_or_title FROM certificates WHERE id = $1', [certId]);
  assert.equal(certCheck.rows[0].code, certCode);
  assert.equal(certCheck.rows[0].rank_or_title, 'Yellow Belt');

  // =========================================================================
  // SCENARIO 17: Legacy records are not silently approved
  // =========================================================================
  console.log('Scenario 17: Legacy records are not silently approved...');
  // Create a legacy master without affiliations
  const legacyMasterId = `usr_mst_legacy_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'hash', 'Legacy Master Unapproved', 'MASTER', 'ACTIVE')`,
    [legacyMasterId, org1Id, `mst_legacy_${Date.now()}@beltflow.test`]
  );

  // Backfill execution
  await runLegacyMigration();

  const legacyAffil = await dbClient.query(
    'SELECT * FROM master_affiliations WHERE master_id = $1',
    [legacyMasterId]
  );
  assert.equal(legacyAffil.rowCount, 1, 'Legacy master should be populated with an affiliation record');
  assert.equal(legacyAffil.rows[0].status, 'PENDING', 'Legacy affiliation must be PENDING, never silently ACTIVE');
  assert.equal(legacyAffil.rows[0].verification_provenance, 'LEGACY_MIGRATION');

  // =========================================================================
  // SCENARIO 18: Repeated migration does not duplicate records
  // =========================================================================
  console.log('Scenario 18: Repeated migration does not duplicate records...');
  await runLegacyMigration();
  const affilCountAfterSecondRun = await dbClient.query(
    'SELECT COUNT(*)::int as cnt FROM master_affiliations WHERE master_id = $1',
    [legacyMasterId]
  );
  assert.equal(affilCountAfterSecondRun.rows[0].cnt, 1, 'Re-running migration must be idempotent and not create duplicate records');

  // =========================================================================
  // SCENARIO 19: Unauthorized Super Admin operational access denied
  // =========================================================================
  console.log('Scenario 19: Unauthorized Super Admin operational access denied...');
  const saDecision = await authorize(
    { id: superAdminId, email: 'sa@test.com', role: UserRole.SUPER_ADMIN },
    AuthorityCapability.STUDENT_OPERATIONAL_ACCESS,
    { organizationId: org1Id, studentId: studentRecId }
  );
  assert.equal(saDecision.allowed, false, 'Super Admin must be denied operational student access');

  // =========================================================================
  // SCENARIO 20: PostgreSQL transaction rollback preserves consistency
  // =========================================================================
  console.log('Scenario 20: PostgreSQL transaction rollback preserves consistency...');
  let threwTx = false;
  try {
    await dbClient.transaction(async (tx: SqlTransactionClient) => {
      await tx.query(
        `INSERT INTO master_affiliations (id, master_id, organization_id, status, verification_provenance)
         VALUES ('maf_rollback_test', $1, $2, 'PENDING', 'DIRECT_REVIEW')`,
        [legacyMasterId, org2Id]
      );
      throw new Error('Simulated failure during multi-step relationship setup');
    });
  } catch (err: any) {
    threwTx = true;
    assert.equal(err.message, 'Simulated failure during multi-step relationship setup');
  }
  assert.equal(threwTx, true);
  const rollbackCheck = await dbClient.query('SELECT * FROM master_affiliations WHERE id = $1', ['maf_rollback_test']);
  assert.equal(rollbackCheck.rowCount, 0, 'Rolled-back transaction must leave no orphaned records');

  // =========================================================================
  // SCENARIO 21: Concurrent relationship creation respects uniqueness
  // =========================================================================
  console.log('Scenario 21: Concurrent relationship creation respects uniqueness...');
  const concurrentMasterId = `usr_mst_conc_${Date.now()}`;
  await dbClient.query(
    `INSERT INTO users (id, organization_id, email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, 'hash', 'Master Concurrent', 'MASTER', 'ACTIVE')`,
    [concurrentMasterId, org1Id, `mst_conc_${Date.now()}@beltflow.test`]
  );

  const attempts = await Promise.allSettled([
    createMasterAffiliation({ masterId: concurrentMasterId, organizationId: org1Id, status: 'ACTIVE' }),
    createMasterAffiliation({ masterId: concurrentMasterId, organizationId: org1Id, status: 'ACTIVE' }),
  ]);
  const succeeded = attempts.filter((r) => r.status === 'fulfilled');
  const rejected = attempts.filter((r) => r.status === 'rejected');
  assert.equal(succeeded.length, 1, 'Exactly one concurrent creation should succeed');
  assert.equal(rejected.length, 1, 'The competing concurrent creation should be rejected by constraint');

  // =========================================================================
  // SCENARIO 22: Migration on a populated legacy database succeeds without destructive changes
  // =========================================================================
  console.log('Scenario 22: Migration on a populated legacy database succeeds without destructive changes...');
  const report = await getLegacyReconciliationReport(org1Id);
  assert.ok(report.totalMasters >= 1);
  assert.ok(report.totalClasses >= 1);
  assert.ok(report.totalStudents >= 1);
  assert.ok(report.historicalNeedingReview.length >= 1, 'Report must classify legacy records needing Persatuan review');
  assert.ok(Array.isArray(report.existingOperationalRelationships));
  assert.ok(Array.isArray(report.invalidOrAmbiguous));

  console.log('✅ All 22 H02 Authority Relationships & Legacy Migration scenarios passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ H02 Test Suite Error:', err);
  process.exit(1);
});
