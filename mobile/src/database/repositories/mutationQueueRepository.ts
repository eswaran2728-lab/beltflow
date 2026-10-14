import { getDatabase } from '../connection';
import { AttendanceMutation, AttendanceStatus, EnqueueAttendanceParams } from '../types';
import { AuthUser } from '../../types/auth';
import { assertAuthenticated, assertTenantAccess } from '../security/accessScope';

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
   * Fetches all pending mutations for the user's organization in FIFO order
   */
  async getPendingMutations(user: AuthUser): Promise<AttendanceMutation[]> {
    assertAuthenticated(user);
    const db = getDatabase();

    return await db.getAllAsync<AttendanceMutation>(
      `SELECT * FROM attendance_mutation_queue
       WHERE organization_id = ? AND queue_status = 'PENDING'
       ORDER BY created_at ASC, sequence_number ASC;`,
      user.organizationId
    );
  },

  /**
   * Retrieves single mutation by ID
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
    }

    return mutation;
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
