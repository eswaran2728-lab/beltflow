import { getDatabase } from '../connection';
import { SyncConflict, CreateConflictParams, ConflictResolution } from '../types';
import { AuthUser } from '../../types/auth';
import { assertAuthenticated, assertTenantAccess } from '../security/accessScope';

function generateConflictId(): string {
  return `conf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const conflictRepository = {
  /**
   * Records an attendance sync conflict detected during reconciliation
   */
  async recordConflict(user: AuthUser, params: CreateConflictParams): Promise<SyncConflict> {
    assertAuthenticated(user);
    const db = getDatabase();
    const conflictId = generateConflictId();

    await db.runAsync(
      `INSERT INTO sync_conflicts (
        id, mutation_id, organization_id, session_id, student_id,
        local_status, server_status, server_timestamp, conflict_reason,
        resolution, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', null, datetime('now'));`,
      conflictId,
      params.mutationId,
      user.organizationId,
      params.sessionId,
      params.studentId,
      params.localStatus,
      params.serverStatus,
      params.serverTimestamp,
      params.conflictReason
    );

    const record = await db.getFirstAsync<SyncConflict>(
      'SELECT * FROM sync_conflicts WHERE id = ?;',
      conflictId
    );

    return record!;
  },

  /**
   * Retrieves pending or all conflicts for the user's organization
   */
  async getConflicts(user: AuthUser, onlyPending = true): Promise<SyncConflict[]> {
    assertAuthenticated(user);
    const db = getDatabase();

    if (onlyPending) {
      return await db.getAllAsync<SyncConflict>(
        `SELECT * FROM sync_conflicts
         WHERE organization_id = ? AND resolution = 'PENDING'
         ORDER BY created_at DESC;`,
        user.organizationId
      );
    }

    return await db.getAllAsync<SyncConflict>(
      `SELECT * FROM sync_conflicts
       WHERE organization_id = ?
       ORDER BY created_at DESC;`,
      user.organizationId
    );
  },

  /**
   * Updates conflict resolution state
   */
  async resolveConflict(
    user: AuthUser,
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    assertAuthenticated(user);
    const db = getDatabase();

    const conflict = await db.getFirstAsync<SyncConflict>(
      'SELECT * FROM sync_conflicts WHERE id = ?;',
      conflictId
    );

    if (!conflict) throw new Error(`Conflict ${conflictId} not found.`);
    assertTenantAccess(user, conflict.organization_id);

    await db.runAsync(
      `UPDATE sync_conflicts
       SET resolution = ?, resolved_at = datetime('now')
       WHERE id = ?;`,
      resolution,
      conflictId
    );
  },

  /**
   * Purges all conflict records
   */
  async purgeAllConflicts(): Promise<void> {
    const db = getDatabase();
    await db.execAsync('DELETE FROM sync_conflicts;');
  },
};
