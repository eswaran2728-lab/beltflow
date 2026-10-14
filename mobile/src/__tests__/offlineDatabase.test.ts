import {
  initDatabase,
  closeDatabase,
  resetDatabaseForTesting,
} from '../database/connection';
import { runMigrations, getDatabaseVersion } from '../database/migrations/migrator';
import { v1InitialSchema } from '../database/migrations/v1_initial_schema';
import { Migration } from '../database/migrations/types';
import { rosterRepository } from '../database/repositories/rosterRepository';
import { mutationQueueRepository } from '../database/repositories/mutationQueueRepository';
import { conflictRepository } from '../database/repositories/conflictRepository';
import {
  SessionRequiredError,
  TenantMismatchError,
  UnauthorizedClassError,
} from '../database/security/accessScope';
import { databaseLifecycle } from '../database/lifecycle';
import { AuthUser } from '../types/auth';

describe('BeltFlow Phase 2 Task 2.1 — Offline SQLite Database Foundation', () => {
  // Test users representing two separate academies (tenants)
  const masterA: AuthUser = {
    id: 'usr_master_a',
    email: 'master@academy-a.org',
    fullName: 'Master Arumugam',
    role: 'MASTER',
    organizationId: 'org_academy_a',
    assignedClassIds: ['cls_a1'],
  };

  const masterB: AuthUser = {
    id: 'usr_master_b',
    email: 'master@academy-b.org',
    fullName: 'Master Benjamin',
    role: 'MASTER',
    organizationId: 'org_academy_b',
    assignedClassIds: ['cls_b1'],
  };

  const adminA: AuthUser = {
    id: 'usr_admin_a',
    email: 'admin@academy-a.org',
    fullName: 'Admin Alice',
    role: 'ADMIN_PERSATUAN',
    organizationId: 'org_academy_a',
    assignedClassIds: [],
  };

  beforeEach(async () => {
    // Reset test database to an isolated, fresh in-memory SQLite state
    await resetDatabaseForTesting();
    databaseLifecycle.setActiveUser(masterA);
  });

  afterEach(async () => {
    await closeDatabase();
    databaseLifecycle.clearActiveUser();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Fresh SQLite Initialization
  // --------------------------------------------------------------------------
  it('1. should initialize fresh SQLite database with foreign keys enabled', async () => {
    const db = await initDatabase({ useMemory: true });
    expect(db).toBeDefined();

    // Verify foreign key pragma is ON
    const fkPragma = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;');
    expect(fkPragma?.foreign_keys).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Migration Execution
  // --------------------------------------------------------------------------
  it('2. should execute initial migrations and record version 1', async () => {
    const db = await initDatabase({ useMemory: true });
    const version = await getDatabaseVersion(db);
    expect(version).toBe(1);

    // Verify expected tables exist
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    );
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('schema_migrations');
    expect(tableNames).toContain('cached_classes');
    expect(tableNames).toContain('cached_training_groups');
    expect(tableNames).toContain('cached_students');
    expect(tableNames).toContain('cached_training_sessions');
    expect(tableNames).toContain('attendance_mutation_queue');
    expect(tableNames).toContain('sync_conflicts');
    expect(tableNames).toContain('sync_metadata');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Repeated Migration Safety (Idempotency)
  // --------------------------------------------------------------------------
  it('3. should be idempotent when running migrations repeatedly', async () => {
    const db = await initDatabase({ useMemory: true });
    expect(await getDatabaseVersion(db)).toBe(1);

    // Run again
    await runMigrations(db, [v1InitialSchema]);
    expect(await getDatabaseVersion(db)).toBe(1);

    // Verify migrations table has exactly 1 row for version 1
    const records = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = 1;'
    );
    expect(records.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Database Version Upgrades
  // --------------------------------------------------------------------------
  it('4. should apply schema upgrades when new migration version is provided', async () => {
    const db = await initDatabase({ useMemory: true });

    // Mock a version 2 migration that adds an auxiliary audit index
    const v2Upgrade: Migration = {
      version: 2,
      name: 'v2_add_attendance_notes_column',
      up: async (database) => {
        await database.execAsync(
          'ALTER TABLE attendance_mutation_queue ADD COLUMN notes TEXT;'
        );
      },
    };

    await runMigrations(db, [v1InitialSchema, v2Upgrade]);
    expect(await getDatabaseVersion(db)).toBe(2);

    // Verify the new column is usable
    const columnCheck = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info('attendance_mutation_queue');"
    );
    expect(columnCheck.some(c => c.name === 'notes')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Foreign-Key Constraints Enforcement
  // --------------------------------------------------------------------------
  it('5. should enforce foreign-key constraints on cached entities', async () => {
    await initDatabase({ useMemory: true });
    databaseLifecycle.setActiveUser(adminA);

    // Attempt to insert a training group referencing a non-existent class
    await expect(
      rosterRepository.saveTrainingGroups(adminA, [
        {
          id: 'grp_invalid',
          organization_id: 'org_academy_a',
          class_id: 'cls_non_existent',
          name: 'Invalid Group',
          status: 'ACTIVE',
          updated_at: new Date().toISOString(),
        },
      ])
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  // --------------------------------------------------------------------------
  // TEST 6: User & Tenant Isolation
  // --------------------------------------------------------------------------
  it('6. should strictly isolate records between organizations (multi-tenant boundary)', async () => {
    await initDatabase({ useMemory: true });

    // Master A saves Class A1 in Academy A
    await rosterRepository.saveClasses(masterA, [
      {
        id: 'cls_a1',
        organization_id: 'org_academy_a',
        name: 'Academy A Class 1',
        schedule: 'Tue 6pm',
        location: 'Hall A',
        monthly_fee: 100,
        master_id: masterA.id,
        updated_at: new Date().toISOString(),
      },
    ]);

    // Master A can query Class A1
    const classesA = await rosterRepository.getClasses(masterA);
    expect(classesA.length).toBe(1);
    expect(classesA[0].id).toBe('cls_a1');

    // Master B (from Academy B) attempts to query Academy A records -> Denied / Empty
    databaseLifecycle.setActiveUser(masterB);
    const classesB = await rosterRepository.getClasses(masterB);
    expect(classesB.length).toBe(0);

    // Master B attempting to insert with Academy A organization ID -> Throws TenantMismatchError
    await expect(
      rosterRepository.saveClasses(masterB, [
        {
          id: 'cls_b_forged',
          organization_id: 'org_academy_a', // mismatch!
          name: 'Forged Class',
          schedule: 'Wed 7pm',
          location: 'Hall B',
          monthly_fee: 120,
          master_id: masterB.id,
          updated_at: new Date().toISOString(),
        },
      ])
    ).rejects.toThrow(TenantMismatchError);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Assigned-Class Cache Scoping
  // --------------------------------------------------------------------------
  it('7. should restrict Master strictly to their assigned classes', async () => {
    await initDatabase({ useMemory: true });

    // Master A is assigned ONLY to 'cls_a1', NOT to 'cls_a2'
    await expect(
      rosterRepository.saveClasses(masterA, [
        {
          id: 'cls_a2', // unassigned!
          organization_id: 'org_academy_a',
          name: 'Unassigned Class',
          schedule: 'Sat 9am',
          location: 'Hall 2',
          monthly_fee: 80,
          master_id: 'other_master',
          updated_at: new Date().toISOString(),
        },
      ])
    ).rejects.toThrow(UnauthorizedClassError);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Logout Handling
  // --------------------------------------------------------------------------
  it('8. should lock local protected storage upon user logout', async () => {
    await initDatabase({ useMemory: true });

    // Save initial class
    await rosterRepository.saveClasses(masterA, [
      {
        id: 'cls_a1',
        organization_id: 'org_academy_a',
        name: 'Silambam Class 1',
        schedule: 'Mon 6pm',
        location: 'Hall',
        monthly_fee: 100,
        master_id: masterA.id,
        updated_at: new Date().toISOString(),
      },
    ]);

    // Simulate logout
    databaseLifecycle.onLogout();

    // Querying repository without active authenticated identity must fail
    await expect(rosterRepository.getClasses(null as any)).rejects.toThrow(SessionRequiredError);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Account Switching
  // --------------------------------------------------------------------------
  it('9. should invalidate and isolate cache when switching accounts', async () => {
    await initDatabase({ useMemory: true });

    // Master A saves Class A1
    await rosterRepository.saveClasses(masterA, [
      {
        id: 'cls_a1',
        organization_id: 'org_academy_a',
        name: 'Class A1',
        schedule: 'Thu 7pm',
        location: 'Hall A',
        monthly_fee: 100,
        master_id: masterA.id,
        updated_at: new Date().toISOString(),
      },
    ]);

    // User switches to Master B
    databaseLifecycle.onAccountSwitched(masterA, masterB);

    // Database should purge stale unauthenticated records for the new tenant
    const rosterB = await rosterRepository.getClasses(masterB);
    expect(rosterB.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Duplicate Mutation Prevention (Idempotency)
  // --------------------------------------------------------------------------
  it('10. should prevent duplicate pending mutations for the same session and student', async () => {
    await initDatabase({ useMemory: true });

    const mutation1 = await mutationQueueRepository.enqueueAttendance(masterA, {
      sessionId: 'sess_101',
      studentId: 'stu_201',
      status: 'Present',
    });

    expect(mutation1.id).toBeDefined();
    expect(mutation1.queue_status).toBe('PENDING');

    // Enqueue identical mutation again (e.g. rapid taps in UI)
    const mutation2 = await mutationQueueRepository.enqueueAttendance(masterA, {
      sessionId: 'sess_101',
      studentId: 'stu_201',
      status: 'Present',
    });

    // Should return existing pending mutation without duplicating
    expect(mutation2.id).toBe(mutation1.id);

    const pending = await mutationQueueRepository.getPendingMutations(masterA);
    expect(pending.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST 11: Durable Retry Identifiers
  // --------------------------------------------------------------------------
  it('11. should preserve durable mutation ID and idempotency key across retries', async () => {
    await initDatabase({ useMemory: true });

    const mutation = await mutationQueueRepository.enqueueAttendance(masterA, {
      sessionId: 'sess_102',
      studentId: 'stu_202',
      status: 'Late',
    });

    const originalId = mutation.id;
    const originalKey = mutation.idempotency_key;

    // Simulate network attempt failure
    await mutationQueueRepository.markMutationInFlight(masterA, mutation.id);
    await mutationQueueRepository.recordMutationFailure(
      masterA,
      mutation.id,
      'HTTP 503 Server Unavailable',
      true
    );

    const updated = await mutationQueueRepository.getMutationById(masterA, originalId);
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(originalId); // Durable ID unchanged
    expect(updated!.idempotency_key).toBe(originalKey); // Idempotency key unchanged
    expect(updated!.retry_count).toBe(1); // Increment retry count
    expect(updated!.queue_status).toBe('PENDING'); // Back to pending
    expect(updated!.last_error).toContain('HTTP 503');
  });

  // --------------------------------------------------------------------------
  // TEST 12: Attendance Correction Representation
  // --------------------------------------------------------------------------
  it('12. should model legitimate attendance corrections with sequence linking', async () => {
    await initDatabase({ useMemory: true });

    // Step 1: Initial check-in: marked Absent by mistake
    const initial = await mutationQueueRepository.enqueueAttendance(masterA, {
      sessionId: 'sess_103',
      studentId: 'stu_203',
      status: 'Absent',
    });

    // Step 2: Mutation was synced to server
    await mutationQueueRepository.markMutationSynced(masterA, initial.id);

    // Step 3: Coach realizes student arrived and submits a legitimate correction: 'Late'
    const correction = await mutationQueueRepository.recordLegitimateCorrection(
      masterA,
      'sess_103',
      'stu_203',
      'Late'
    );

    expect(correction.id).not.toBe(initial.id);
    expect(correction.correction_of_mutation_id).toBe(initial.id);
    expect(correction.sequence_number).toBe(2);
    expect(correction.status).toBe('Late');
    expect(correction.queue_status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Conflict-Record Storage
  // --------------------------------------------------------------------------
  it('13. should store synchronization conflict records for offline audit', async () => {
    await initDatabase({ useMemory: true });

    const mutation = await mutationQueueRepository.enqueueAttendance(masterA, {
      sessionId: 'sess_104',
      studentId: 'stu_204',
      status: 'Present',
    });

    const conflict = await conflictRepository.recordConflict(masterA, {
      mutationId: mutation.id,
      sessionId: 'sess_104',
      studentId: 'stu_204',
      localStatus: 'Present',
      serverStatus: 'Excused',
      serverTimestamp: new Date().toISOString(),
      conflictReason: 'Parent submitted medical certificate online while coach was offline',
    });

    expect(conflict.id).toBeDefined();
    expect(conflict.resolution).toBe('PENDING');

    const conflicts = await conflictRepository.getConflicts(masterA);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflict_reason).toContain('medical certificate');
  });

  // --------------------------------------------------------------------------
  // TEST 14: Recovery from Interrupted Local Transactions
  // --------------------------------------------------------------------------
  it('14. should roll back atomic transaction completely when an error occurs', async () => {
    const db = await initDatabase({ useMemory: true });

    // Create a valid class first
    await rosterRepository.saveClasses(masterA, [
      {
        id: 'cls_a1',
        organization_id: 'org_academy_a',
        name: 'Silambam Main',
        schedule: 'Tue 6pm',
        location: 'Hall A',
        monthly_fee: 100,
        master_id: masterA.id,
        updated_at: new Date().toISOString(),
      },
    ]);

    // Attempt transaction where second statement fails
    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `INSERT INTO cached_training_groups (id, organization_id, class_id, name, status, cached_at, updated_at)
           VALUES ('grp_valid', 'org_academy_a', 'cls_a1', 'Valid Group', 'ACTIVE', datetime('now'), datetime('now'));`
        );
        // Force error with duplicate primary key or FK failure
        await txn.runAsync(
          `INSERT INTO cached_training_groups (id, organization_id, class_id, name, status, cached_at, updated_at)
           VALUES ('grp_valid', 'org_academy_a', 'cls_a1', 'Duplicate Group', 'ACTIVE', datetime('now'), datetime('now'));`
        );
      });
    } catch {
      // Expected to fail
    }

    // Verify 'grp_valid' was rolled back and does not exist
    const row = await db.getFirstAsync(
      "SELECT id FROM cached_training_groups WHERE id = 'grp_valid';"
    );
    expect(row).toBeNull();
  });

  // --------------------------------------------------------------------------
  // TEST 15: Safe Behavior When Local Storage is Unavailable
  // --------------------------------------------------------------------------
  it('15. should fail safely with structured error when database is closed or unavailable', async () => {
    await initDatabase({ useMemory: true });
    await closeDatabase();

    // Calling repository when database is closed should reject gracefully with clear error
    await expect(rosterRepository.getClasses(masterA)).rejects.toThrow(
      /Database connection is not open/i
    );
  });
});
