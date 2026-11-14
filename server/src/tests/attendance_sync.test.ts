import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-att-sync-'));
  await dbClient.init(dir);
  const server = app.listen(0);
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;

  const call = async (method: string, endpoint: string, body?: any, token?: string) => {
    const res = await fetch(base + endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json()) as any };
  };

  try {
    console.log('🚀 Starting Offline Attendance Sync Server Integration Tests...');

    // 1. Setup platform admin
    const setup = await call('POST', '/auth/setup-admin', {
      fullName: 'Sync Platform Owner',
      email: 'owner@sync.test.local',
      password: 'safe-password-123',
    });
    assert.equal(setup.status, 201);
    const superToken = setup.data.token;

    // 2. Setup Organization A and Organization B
    const createOrg = async (name: string, email: string) => {
      const res = await call(
        'POST',
        '/organizations',
        {
          name,
          state: 'Kuala Lumpur',
          martialArtStyle: 'Taekwondo',
          masterName: 'Master Admin',
          phone: '0123456789',
          email,
          password: 'safe-password-123',
          baseMonthlyFee: 80,
        },
        superToken
      );
      assert.equal(res.status, 201);
      const login = await call('POST', '/auth/login', {
        email,
        password: 'safe-password-123',
      });
      assert.equal(login.status, 200);
      return { id: res.data.organization.id, token: login.data.token };
    };

    const orgA = await createOrg('Persatuan A', 'adminA@sync.test.local');
    const orgB = await createOrg('Persatuan B', 'adminB@sync.test.local');

    // 3. Create Masters
    const createCoach = async (org: typeof orgA, email: string) => {
      const res = await call(
        'POST',
        '/coaches',
        {
          organizationId: org.id,
          fullName: 'Instructor ' + email,
          email,
          password: 'safe-password-123',
        },
        org.token
      );
      assert.equal(res.status, 201);
      const login = await call('POST', '/auth/login', {
        email,
        password: 'safe-password-123',
      });
      assert.equal(login.status, 200);
      return { id: res.data.coach.id, token: login.data.token };
    };

    const masterA1 = await createCoach(orgA, 'masterA1@sync.test.local');
    const masterA2 = await createCoach(orgA, 'masterA2@sync.test.local');
    const masterB = await createCoach(orgB, 'masterB@sync.test.local');

    // 4. Create Class in Org A assigned to masterA1
    const classRes = await call(
      'POST',
      '/classes',
      {
        organizationId: orgA.id,
        name: 'Dragons Class',
        schedule: 'Every Mon 18:00',
        location: 'Main Dojang',
        mainMasterId: masterA1.id,
      },
      orgA.token
    );
    assert.equal(classRes.status, 201);
    const classA = classRes.data.class;

    // 5. Create Training Groups in Class A
    const grp1Res = await call(
      'POST',
      `/classes/${classA.id}/groups`,
      { name: 'Junior Dragons' },
      masterA1.token
    );
    assert.equal(grp1Res.status, 201);
    const group1 = grp1Res.data.group;

    const grp2Res = await call(
      'POST',
      `/classes/${classA.id}/groups`,
      { name: 'Senior Dragons' },
      masterA1.token
    );
    assert.equal(grp2Res.status, 201);
    const group2 = grp2Res.data.group;

    // 6. Create Students in Group 1
    const createStudent = async (name: string, grpId: string, status = 'ACTIVE') => {
      const res = await call(
        'POST',
        '/students',
        {
          organizationId: orgA.id,
          fullName: name,
          nric: '050101-14-' + Math.random().toString().slice(2, 6),
          gender: 'Male',
          classId: classA.id,
          emergencyContact: '0199999999',
        },
        orgA.token
      );
      assert.equal(res.status, 201, JSON.stringify(res.data));
      await dbClient.query('UPDATE students SET group_id = $1, status = $2 WHERE id = $3', [
        grpId,
        status,
        res.data.student.id,
      ]);
      return res.data.student;
    };

    const student1 = await createStudent('Alice Tan', group1.id);
    const student2 = await createStudent('Bob Lee', group1.id);
    const student3 = await createStudent('Charlie Wong', group1.id);
    const studentInactive = await createStudent('Diana Prince', group1.id, 'INACTIVE');

    // 7. Create Session for Class A, Group 1
    const today = new Date().toISOString().slice(0, 10);
    const sessRes = await call(
      'POST',
      `/classes/${classA.id}/sessions`,
      {
        groupId: group1.id,
        sessionDate: today,
        dayOfWeek: 'Monday',
        startTime: '18:00',
        endTime: '19:30',
        location: 'Main Dojang',
        isExtra: true,
        notes: 'BeltFlow Test Session',
      },
      masterA1.token
    );
    assert.equal(sessRes.status, 201, JSON.stringify(sessRes.data));
    const session1 = sessRes.data.session;

    // Create a Cancelled Session
    const sessCancelledRes = await call(
      'POST',
      `/classes/${classA.id}/sessions`,
      {
        groupId: group1.id,
        sessionDate: today,
        dayOfWeek: 'Monday',
        startTime: '20:00',
        endTime: '21:00',
        location: 'Main Dojang',
        isExtra: true,
      },
      masterA1.token
    );
    assert.equal(sessCancelledRes.status, 201, JSON.stringify(sessCancelledRes.data));
    const sessionCancelled = sessCancelledRes.data.session;
    await dbClient.query("UPDATE training_sessions SET status = 'Cancelled' WHERE id = $1", [sessionCancelled.id]);

    // =========================================================================
    // TEST 1: Successful Batch Sync
    // =========================================================================
    console.log('Test 1: Batch sync of offline attendance records...');
    const syncRes1 = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_101',
            sessionId: session1.id,
            studentId: student1.id,
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
          {
            mutationId: 'mut_test_102',
            sessionId: session1.id,
            studentId: student2.id,
            status: 'Late',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    console.log('syncRes1:', JSON.stringify(syncRes1.data));
    assert.equal(syncRes1.status, 200);
    assert.deepEqual(syncRes1.data.synced, ['mut_test_101', 'mut_test_102']);
    assert.equal(syncRes1.data.conflicts.length, 0);

    // Verify session_attendance updated in PostgreSQL
    const att1 = await dbClient.query('SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2', [
      session1.id,
      student1.id,
    ]);
    assert.equal(att1.rowCount, 1);
    assert.equal(att1.rows[0].status, 'Present');
    assert.equal(att1.rows[0].marked_by, masterA1.id);

    // =========================================================================
    // TEST 2: Replay Protection (Idempotent replay)
    // =========================================================================
    console.log('Test 2: Idempotent replay of previously processed mutation...');
    const replayRes = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_101',
            sessionId: session1.id,
            studentId: student1.id,
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(replayRes.status, 200);
    assert.deepEqual(replayRes.data.synced, ['mut_test_101']);
    assert.equal(replayRes.data.conflicts.length, 0);

    // Verify processed_sync_mutations has only 1 row
    const processed = await dbClient.query('SELECT * FROM processed_sync_mutations WHERE mutation_id = $1', [
      'mut_test_101',
    ]);
    assert.equal(processed.rowCount, 1);

    // =========================================================================
    // TEST 3: Revoked Master Assignment Access
    // =========================================================================
    console.log('Test 3: Reject sync if Master assignment is not authorized...');
    const unassignedSync = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_103',
            sessionId: session1.id,
            studentId: student3.id,
            status: 'Absent',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA2.token // masterA2 is in Org A, but NOT assigned to Class A
    );
    assert.equal(unassignedSync.status, 200);
    assert.equal(unassignedSync.data.synced.length, 0);
    assert.equal(unassignedSync.data.conflicts.length, 1);
    assert.equal(unassignedSync.data.conflicts[0].code, 'MASTER_ASSIGNMENT_REVOKED');

    // =========================================================================
    // TEST 4: Student Transferred Out of Group
    // =========================================================================
    console.log('Test 4: Detect conflict if student transferred out of session group...');
    // Transfer student3 to Group 2
    await dbClient.query('UPDATE students SET group_id = $1 WHERE id = $2', [group2.id, student3.id]);

    const transferredSync = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_104',
            sessionId: session1.id, // Group 1 session
            studentId: student3.id, // Now in Group 2
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(transferredSync.status, 200);
    assert.equal(transferredSync.data.synced.length, 0);
    assert.equal(transferredSync.data.conflicts.length, 1);
    assert.equal(transferredSync.data.conflicts[0].code, 'STUDENT_TRANSFERRED');

    // =========================================================================
    // TEST 5: Inactive or Removed Student
    // =========================================================================
    console.log('Test 5: Detect conflict if student was removed or inactive...');
    const inactiveSync = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_105',
            sessionId: session1.id,
            studentId: studentInactive.id,
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(inactiveSync.status, 200);
    assert.equal(inactiveSync.data.synced.length, 0);
    assert.equal(inactiveSync.data.conflicts.length, 1);
    assert.equal(inactiveSync.data.conflicts[0].code, 'STUDENT_REMOVED');

    // =========================================================================
    // TEST 6: Closed/Cancelled Training Session
    // =========================================================================
    console.log('Test 6: Detect conflict if session is cancelled on server...');
    const cancelledSync = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_106',
            sessionId: sessionCancelled.id,
            studentId: student1.id,
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(cancelledSync.status, 200);
    assert.equal(cancelledSync.data.synced.length, 0);
    assert.equal(cancelledSync.data.conflicts.length, 1);
    assert.equal(cancelledSync.data.conflicts[0].code, 'SESSION_CLOSED');

    // =========================================================================
    // TEST 7: Cross-Tenant Isolation
    // =========================================================================
    console.log('Test 7: Cross-tenant isolation verification...');
    const crossTenantSync = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_107',
            sessionId: session1.id, // Org A session
            studentId: student1.id, // Org A student
            status: 'Present',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterB.token // Master from Org B
    );
    assert.equal(crossTenantSync.status, 200);
    assert.equal(crossTenantSync.data.synced.length, 0);
    assert.equal(crossTenantSync.data.conflicts.length, 1);
    assert.equal(crossTenantSync.data.conflicts[0].code, 'CROSS_TENANT_REJECTED');

    // =========================================================================
    // TEST 8: Non-Master Role Denied
    // =========================================================================
    console.log('Test 8: Deny non-Master roles from sync endpoint...');
    const adminSync = await call(
      'POST',
      '/attendance/sync',
      { mutations: [] },
      orgA.token // Admin role, not Master
    );
    assert.equal(adminSync.status, 403);

    const superAdminSync = await call(
      'POST',
      '/attendance/sync',
      { mutations: [] },
      superToken
    );
    assert.equal(superAdminSync.status, 403);

    // =========================================================================
    // TEST 9: Scoped Transaction API — Commit and Rollback Verification
    // =========================================================================
    console.log('Test 9: Verify dbClient.transaction commits on success and rolls back on failure...');
    assert(typeof (dbClient as any).transaction === 'function', 'dbClient.transaction must be implemented as a function');

    // 9a. Commit verification
    await (dbClient as any).transaction(async (tx: any) => {
      await tx.query("INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)", [
        'audit_tx_test_commit',
        'Tx Commit Test',
        'Committed successfully',
        'SUPER_ADMIN',
        'owner@sync.test.local'
      ]);
    });
    const commitCheck = await dbClient.query('SELECT * FROM audit_logs WHERE id = $1', ['audit_tx_test_commit']);
    assert.equal(commitCheck.rowCount, 1, 'Transaction write must commit and be visible');

    // 9b. Rollback verification
    let rollbackThrew = false;
    try {
      await (dbClient as any).transaction(async (tx: any) => {
        await tx.query("INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)", [
          'audit_tx_test_rollback',
          'Tx Rollback Test',
          'Should be rolled back',
          'SUPER_ADMIN',
          'owner@sync.test.local'
        ]);
        throw new Error('Forced transaction failure for testing rollback');
      });
    } catch (err: any) {
      rollbackThrew = true;
      assert.equal(err.message, 'Forced transaction failure for testing rollback');
    }
    assert.equal(rollbackThrew, true);
    const rollbackCheck = await dbClient.query('SELECT * FROM audit_logs WHERE id = $1', ['audit_tx_test_rollback']);
    assert.equal(rollbackCheck.rowCount, 0, 'Transaction write must be rolled back on error');

    // =========================================================================
    // TEST 10: Valid Attendance Correction (baseVersion match)
    // =========================================================================
    console.log('Test 10: Valid attendance correction with matching baseVersion...');
    // student1 currently at version 1 (marked 'Present' in Test 1)
    const currStudent1 = await dbClient.query('SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2', [
      session1.id,
      student1.id,
    ]);
    assert.equal(currStudent1.rowCount, 1);
    assert.equal(currStudent1.rows[0].version, 1);

    const correctionRes = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_corr_1',
            sessionId: session1.id,
            studentId: student1.id,
            status: 'Late',
            baseVersion: 1, // matches server version 1
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(correctionRes.status, 200);
    assert.deepEqual(correctionRes.data.synced, ['mut_test_corr_1']);
    assert.equal(correctionRes.data.conflicts.length, 0);

    const updatedStudent1 = await dbClient.query('SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2', [
      session1.id,
      student1.id,
    ]);
    assert.equal(updatedStudent1.rows[0].status, 'Late');
    assert.equal(updatedStudent1.rows[0].version, 2, 'Version must increment to 2 on correction');

    // =========================================================================
    // TEST 11: Stale baseVersion Rejection (CONCURRENT_MODIFICATION)
    // =========================================================================
    console.log('Test 11: Reject stale baseVersion mutation and preserve existing server record...');
    // Server is now at version 2. Client submits with stale baseVersion = 1
    const staleRes = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_stale_1',
            sessionId: session1.id,
            studentId: student1.id,
            status: 'Absent',
            baseVersion: 1, // Stale! Server is version 2
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(staleRes.status, 200);
    assert.equal(staleRes.data.synced.length, 0);
    assert.equal(staleRes.data.conflicts.length, 1);
    assert.equal(staleRes.data.conflicts[0].code, 'CONCURRENT_MODIFICATION');

    // Verify server record is PRESERVED (still 'Late' and version 2)
    const preservedStudent1 = await dbClient.query('SELECT * FROM session_attendance WHERE session_id = $1 AND student_id = $2', [
      session1.id,
      student1.id,
    ]);
    assert.equal(preservedStudent1.rows[0].status, 'Late');
    assert.equal(preservedStudent1.rows[0].version, 2);

    // Verify stale mutation was NOT added to processed_sync_mutations
    const staleProcessed = await dbClient.query('SELECT * FROM processed_sync_mutations WHERE mutation_id = $1', [
      'mut_test_stale_1',
    ]);
    assert.equal(staleProcessed.rowCount, 0);

    // =========================================================================
    // TEST 12: Interrupted Synchronization Recovery & Atomic Ledger
    // =========================================================================
    console.log('Test 12: Interrupted sync recovery — successful mutation synced, invalid mutation rejected atomically...');
    const mixedRes = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_mixed_valid',
            sessionId: session1.id,
            studentId: student2.id,
            status: 'Excused',
            baseVersion: 1,
            clientTimestamp: new Date().toISOString(),
          },
          {
            mutationId: 'mut_test_mixed_invalid',
            sessionId: session1.id,
            studentId: studentInactive.id, // Inactive student
            status: 'Present',
            baseVersion: 1,
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(mixedRes.status, 200);
    assert.deepEqual(mixedRes.data.synced, ['mut_test_mixed_valid']);
    assert.equal(mixedRes.data.conflicts.length, 1);
    assert.equal(mixedRes.data.conflicts[0].mutationId, 'mut_test_mixed_invalid');
    assert.equal(mixedRes.data.conflicts[0].code, 'STUDENT_REMOVED');

    // Retry the batch with fixed mutation — valid mutation is replayed idempotently, new one is synced
    const recoveryRes = await call(
      'POST',
      '/attendance/sync',
      {
        mutations: [
          {
            mutationId: 'mut_test_mixed_valid', // already processed
            sessionId: session1.id,
            studentId: student2.id,
            status: 'Excused',
            baseVersion: 1,
            clientTimestamp: new Date().toISOString(),
          },
          {
            mutationId: 'mut_test_recovered',
            sessionId: session1.id,
            studentId: student1.id,
            status: 'Present',
            baseVersion: 2, // matches version 2
            clientTimestamp: new Date().toISOString(),
          },
        ],
      },
      masterA1.token
    );
    assert.equal(recoveryRes.status, 200);
    assert.deepEqual(recoveryRes.data.synced, ['mut_test_mixed_valid', 'mut_test_recovered']);
    assert.equal(recoveryRes.data.conflicts.length, 0);

    console.log('✅ All Offline Attendance Sync Server Integration Tests Passed!');
  } finally {
    server.close();
    await dbClient.close();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore tmp cleanup
    }
  }
}

run().catch(err => {
  console.error('❌ Sync Integration Test Failed:', err);
  process.exit(1);
});
