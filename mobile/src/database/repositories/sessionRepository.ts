import { getDatabase } from '../connection';
import { CachedSession } from '../types';
import { AuthUser } from '../../types/auth';
import { assertClassAccess, assertAuthenticated } from '../security/accessScope';

export const sessionRepository = {
  /**
   * Caches training sessions for authorized classes
   */
  async saveSessions(user: AuthUser, sessions: CachedSession[]): Promise<void> {
    assertAuthenticated(user);
    const db = getDatabase();

    for (const sess of sessions) {
      assertClassAccess(user, sess.organization_id, sess.class_id);
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const sess of sessions) {
        await txn.runAsync(
          `INSERT INTO cached_training_sessions (
            id, organization_id, class_id, group_id, schedule_id,
            session_date, day_of_week, start_time, end_time, location,
            status, cached_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            schedule_id = excluded.schedule_id,
            session_date = excluded.session_date,
            day_of_week = excluded.day_of_week,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            location = excluded.location,
            status = excluded.status,
            updated_at = datetime('now');`,
          sess.id,
          sess.organization_id,
          sess.class_id,
          sess.group_id || null,
          sess.schedule_id || null,
          sess.session_date,
          sess.day_of_week || null,
          sess.start_time || null,
          sess.end_time || null,
          sess.location || null,
          sess.status || 'Scheduled'
        );
      }
    });
  },

  /**
   * Retrieves cached sessions for a class with optional date range filter
   */
  async getSessions(
    user: AuthUser,
    classId: string,
    dateRange?: { from: string; to: string }
  ): Promise<CachedSession[]> {
    assertAuthenticated(user);
    assertClassAccess(user, user.organizationId, classId);
    const db = getDatabase();

    if (dateRange) {
      return await db.getAllAsync<CachedSession>(
        `SELECT * FROM cached_training_sessions
         WHERE organization_id = ? AND class_id = ? AND session_date >= ? AND session_date <= ?
         ORDER BY session_date ASC, start_time ASC;`,
        user.organizationId,
        classId,
        dateRange.from,
        dateRange.to
      );
    }

    return await db.getAllAsync<CachedSession>(
      `SELECT * FROM cached_training_sessions
       WHERE organization_id = ? AND class_id = ?
       ORDER BY session_date ASC, start_time ASC;`,
      user.organizationId,
      classId
    );
  },

  /**
   * Purges all cached sessions
   */
  async purgeAllSessions(): Promise<void> {
    const db = getDatabase();
    await db.execAsync('DELETE FROM cached_training_sessions;');
  },
};
