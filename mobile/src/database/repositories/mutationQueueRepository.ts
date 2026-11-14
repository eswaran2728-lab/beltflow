import { getDatabase } from '../connection';
import { AttendanceMutation, AttendanceStatus, EnqueueAttendanceParams } from '../types';
import { AuthUser } from '../../types/auth';
import {
  assertAuthenticated,
  assertTenantAccess,
  UnauthorizedClassError,
} from '../security/accessScope';

function generateMutationId(): string {
  return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const mutationQueueRepository = {
  /**
   * Enqueues an attendance check-in mutation with durable idempotency key and deduplication.
   */
  async enqueueAttendance(
    user: AuthUser,
    params: EnqueueAttendanceParams
  ): Promise<AttendanceMutation> {
    assertAuthenticated(user);
    const db = getDatabase();
    const { sessionId, studentId, status, clientTimestamp } = params;
    const nowIso = clientTimestamp || new Date().toISOString();
    const idempotencyKey = `${sessionId}::${studentId}`;

    return await db.withExclusiveTransactionAsync(async (txn) => {
      // Check for an existing latest mutation for this student and session
      const existing = await txn.getFirstAsync<AttendanceMutation>(
        `SELECT * FROM attendance_mutation_queue
         WHERE organization_id = ? AND idempotency_key = ?
         ORDER BY sequence_number DESC LIMIT 1;`,
        user.organizationId,
        idempotencyKey
      );

      // Scenario A: An unsynced PENDING mutation already exists
      if (existing && existing.queue_status === 'PENDING') {
        if (existing.status === status) {
          // Identical status: safely return existing mutation (deduplication)
          return existing;
        }

        // Legitimate offline modification before network sync: update existing pending mutation
        await txn.runAsync(
          `UPDATE attendance_mutation_queue
           SET status = ?, client_timestamp = ?, updated_at = datetime('now')
           WHERE id = ?;`,
          status,
          nowIso,
          existing.id
        );

        return {
          ...existing,
          status,
          client_timestamp: nowIso,
        };
      }

      // Scenario B: Mutation is SYNCED or IN_FLIGHT, or no mutation exists yet
      const nextSequence = existing ? existing.sequence_number + 1 : 1;
      const correctionOf = existing ? existing.id : null;
      const mutationId = generateMutationId();

      await txn.runAsync(
        `INSERT INTO attendance_mutation_queue (
          id, idempotency_key, organization_id, actor_id, session_id, student_id,
          status, base_version, retry_count, queue_status, last_error,
          client_timestamp, created_at, updated_at, synced_at,
          correction_of_mutation_id, sequence_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?);`,
        mutationId,
        idempotencyKey,
        user.organizationId,
        user.id,
        sessionId,
        studentId,
        status,
        1,
        0,
        'PENDING',
        null,
        nowIso,
        null,
        correctionOf,
        nextSequence
      );

      const created = await txn.getFirstAsync<AttendanceMutation>(
        'SELECT * FROM attendance_mutation_queue WHERE id = ?;',
        mutationId
      );

      return created!;
    });
  },

  /**
   * Fetches pending mutations for the authorized actor in FIFO order.
   * Can optionally filter to a specific session.
   */
  async getPendingMutations(user: AuthUser, sessionId?: string): Promise<AttendanceMutation[]> {
    assertAuthenticated(user);
    const db = getDatabase();

    if (sessionId) {
      return await db.getAllAsync<AttendanceMutation>(
        `SELECT * FROM attendance_mutation_queue
         WHERE organization_id = ? AND actor_id = ? AND session_id = ? AND queue_status = 'PENDING'
         ORDER BY created_at ASC, sequence_number ASC;`,
        user.organizationId,
        user.id,
        sessionId
      );
    }

    return await db.getAllAsync<AttendanceMutation>(
      `SELECT * FROM attendance_mutation_queue
       WHERE organization_id = ? AND actor_id = ? AND queue_status = 'PENDING'
       ORDER BY created_at ASC, sequence_number ASC;`,
      user.organizationId,
      user.id
    );
  },

  /**
   * Retrieves single mutation by ID, asserting both organization and actor isolation
   */
  async getMutationById(user: AuthUser, id: string): Promise<AttendanceMutation | null> {
    assertAuthenticated(user);
    const db = getDatabase();

    const mutation = await db.getFirstAsync<AttendanceMutation>(
      'SELECT * FROM attendance_mutation_queue WHERE id = ?;',
      id
    );

    if (mutation) {
      assertTenantAccess(user, mutation.organization_id);
      if (user.role === 'MASTER' && mutation.actor_id !== user.id) {
        throw new UnauthorizedClassError(
          `Access denied: Master ${user.id} cannot access mutation recorded by actor ${mutation.actor_id}.`
        );
      }
    }

    return mutation;
  },

  /**
   * Quarantines all pending mutations for a specific actor (e.g. on logout or account switch).
   * Prevents pending mutations from being uploaded under another user's session without data loss.
   */
  async quarantineMutationsForActor(actorId: string, reason: string): Promise<number> {
    const db = getDatabase();
    const result = await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'QUARANTINED', quarantine_reason = ?, updated_at = datetime('now')
       WHERE actor_id = ? AND queue_status = 'PENDING';`,
      reason,
      actorId
    );
    return result.changes;
  },

  /**
   * Restores quarantined mutations for an actor when they re-authenticate.
   * Keeps AUTH_REVOKED and REVOKED_CLASS_ASSIGNMENT quarantined pending manual reconciliation.
   */
  async restoreQuarantinedMutationsForActor(actorId: string): Promise<number> {
    const db = getDatabase();
    const result = await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'PENDING', quarantine_reason = NULL, updated_at = datetime('now')
       WHERE actor_id = ? AND queue_status = 'QUARANTINED'
         AND quarantine_reason NOT IN ('AUTH_REVOKED', 'REVOKED_CLASS_ASSIGNMENT');`,
      actorId
    );
    return result.changes;
  },

  /**
   * Restores quarantined mutations verifying assigned class scope and preserving revoked status.
   */
  async restoreEligibleQuarantinedMutations(user: AuthUser, assignedClassIds?: string[]): Promise<number> {
    assertAuthenticated(user);
    const db = getDatabase();

    if (assignedClassIds && assignedClassIds.length > 0) {
      const placeholders = assignedClassIds.map(() => '?').join(',');
      const result = await db.runAsync(
        `UPDATE attendance_mutation_queue
         SET queue_status = 'PENDING', quarantine_reason = NULL, updated_at = datetime('now')
         WHERE actor_id = ? AND organization_id = ? AND queue_status = 'QUARANTINED'
           AND quarantine_reason NOT IN ('AUTH_REVOKED', 'REVOKED_CLASS_ASSIGNMENT')
           AND session_id IN (
             SELECT id FROM cached_training_sessions WHERE class_id IN (${placeholders})
           );`,
        user.id,
        user.organizationId,
        ...assignedClassIds
      );
      return result.changes;
    }

    return await this.restoreQuarantinedMutationsForActor(user.id);
  },

  /**
   * Resets interrupted IN_FLIGHT mutations back to PENDING (e.g. after crash/restart)
   */
  async resetInFlightMutations(actorId: string): Promise<number> {
    const db = getDatabase();
    const result = await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'PENDING', updated_at = datetime('now')
       WHERE actor_id = ? AND queue_status = 'IN_FLIGHT';`,
      actorId
    );
    return result.changes;
  },

  /**
   * Marks a mutation as CONFLICT when rejected by server reconciliation
   */
  async markMutationConflict(user: AuthUser, id: string, reason: string): Promise<void> {
    const mutation = await this.getMutationById(user, id);
    if (!mutation) throw new Error(`Mutation ${id} not found.`);

    const db = getDatabase();
    await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'CONFLICT', last_error = ?, updated_at = datetime('now')
       WHERE id = ?;`,
      reason,
      id
    );
  },

  /**
   * Counts mutations currently flagged as CONFLICT for an actor
   */
  async getConflictCount(user: AuthUser): Promise<number> {
    assertAuthenticated(user);
    const db = getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM attendance_mutation_queue
       WHERE organization_id = ? AND actor_id = ? AND queue_status = 'CONFLICT';`,
      user.organizationId,
      user.id
    );
    return row?.count || 0;
  },

  /**
   * Fetches quarantined mutations for the current actor.
   */
  async getQuarantinedMutations(user: AuthUser): Promise<AttendanceMutation[]> {
    assertAuthenticated(user);
    const db = getDatabase();

    return await db.getAllAsync<AttendanceMutation>(
      `SELECT * FROM attendance_mutation_queue
       WHERE organization_id = ? AND actor_id = ? AND queue_status = 'QUARANTINED'
       ORDER BY created_at ASC, sequence_number ASC;`,
      user.organizationId,
      user.id
    );
  },

  /**
   * Quarantines pending mutations if a Master's class assignment is revoked.
   */
  async quarantineMutationsForRevokedClass(user: AuthUser, classId: string): Promise<number> {
    assertAuthenticated(user);
    const db = getDatabase();

    const result = await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'QUARANTINED', quarantine_reason = 'REVOKED_CLASS_ASSIGNMENT', updated_at = datetime('now')
       WHERE organization_id = ? AND actor_id = ? AND queue_status = 'PENDING'
       AND session_id IN (SELECT id FROM cached_training_sessions WHERE class_id = ?);`,
      user.organizationId,
      user.id,
      classId
    );
    return result.changes;
  },

  /**
   * Marks a mutation as IN_FLIGHT during network dispatch
   */
  async markMutationInFlight(user: AuthUser, id: string): Promise<void> {
    const mutation = await this.getMutationById(user, id);
    if (!mutation) throw new Error(`Mutation ${id} not found.`);

    const db = getDatabase();
    await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'IN_FLIGHT', updated_at = datetime('now')
       WHERE id = ?;`,
      id
    );
  },

  /**
   * Marks a mutation as SYNCED upon server confirmation
   */
  async markMutationSynced(user: AuthUser, id: string): Promise<void> {
    const mutation = await this.getMutationById(user, id);
    if (!mutation) throw new Error(`Mutation ${id} not found.`);

    const db = getDatabase();
    await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'SYNCED', synced_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?;`,
      id
    );
  },

  /**
   * Records a network/server failure while preserving durable mutation ID and idempotency key
   */
  async recordMutationFailure(
    user: AuthUser,
    id: string,
    errorMessage: string,
    incrementRetry: boolean = true
  ): Promise<void> {
    const mutation = await this.getMutationById(user, id);
    if (!mutation) throw new Error(`Mutation ${id} not found.`);

    const db = getDatabase();
    const retryAdd = incrementRetry ? 1 : 0;

    await db.runAsync(
      `UPDATE attendance_mutation_queue
       SET queue_status = 'PENDING',
           retry_count = retry_count + ?,
           last_error = ?,
           updated_at = datetime('now')
       WHERE id = ?;`,
      retryAdd,
      errorMessage,
      id
    );
  },

  /**
   * Explicitly records a legitimate attendance correction (e.g. Master changes Present -> Late)
   */
  async recordLegitimateCorrection(
    user: AuthUser,
    sessionId: string,
    studentId: string,
    newStatus: AttendanceStatus
  ): Promise<AttendanceMutation> {
    return await this.enqueueAttendance(user, {
      sessionId,
      studentId,
      status: newStatus,
    });
  },

  /**
   * Purges all queued mutations
   */
  async purgeAllMutations(): Promise<void> {
    const db = getDatabase();
    await db.execAsync('DELETE FROM attendance_mutation_queue;');
  },
};
