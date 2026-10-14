import { getDatabase } from '../connection';
import { CachedClass, CachedTrainingGroup, CachedStudent } from '../types';
import { AuthUser } from '../../types/auth';
import { assertTenantAccess, assertClassAccess, assertAuthenticated } from '../security/accessScope';

export const rosterRepository = {
  /**
   * Caches classes authorized for the user
   */
  async saveClasses(user: AuthUser, classes: CachedClass[]): Promise<void> {
    assertAuthenticated(user);
    const db = getDatabase();

    for (const cls of classes) {
      assertClassAccess(user, cls.organization_id, cls.id);
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const cls of classes) {
        await txn.runAsync(
          `INSERT INTO cached_classes (id, organization_id, name, schedule, location, monthly_fee, master_id, cached_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             schedule = excluded.schedule,
             location = excluded.location,
             monthly_fee = excluded.monthly_fee,
             master_id = excluded.master_id,
             updated_at = datetime('now');`,
          cls.id,
          cls.organization_id,
          cls.name,
          cls.schedule || null,
          cls.location || null,
          cls.monthly_fee || 0.0,
          cls.master_id || null
        );
      }
    });
  },

  /**
   * Retrieves cached classes authorized for the user
   */
  async getClasses(user: AuthUser): Promise<CachedClass[]> {
    assertAuthenticated(user);
    const db = getDatabase();

    if (user.role === 'MASTER') {
      const assigned = user.assignedClassIds || [];
      if (assigned.length === 0) return [];

      const placeholders = assigned.map(() => '?').join(',');
      return await db.getAllAsync<CachedClass>(
        `SELECT * FROM cached_classes
         WHERE organization_id = ? AND id IN (${placeholders})
         ORDER BY name ASC;`,
        user.organizationId,
        ...assigned
      );
    }

    return await db.getAllAsync<CachedClass>(
      `SELECT * FROM cached_classes
       WHERE organization_id = ?
       ORDER BY name ASC;`,
      user.organizationId
    );
  },

  /**
   * Caches training groups for a class
   */
  async saveTrainingGroups(user: AuthUser, groups: CachedTrainingGroup[]): Promise<void> {
    assertAuthenticated(user);
    const db = getDatabase();

    for (const grp of groups) {
      assertClassAccess(user, grp.organization_id, grp.class_id);
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const grp of groups) {
        await txn.runAsync(
          `INSERT INTO cached_training_groups (id, organization_id, class_id, name, status, cached_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             status = excluded.status,
             updated_at = datetime('now');`,
          grp.id,
          grp.organization_id,
          grp.class_id,
          grp.name,
          grp.status || 'ACTIVE'
        );
      }
    });
  },

  /**
   * Retrieves cached training groups for a class
   */
  async getTrainingGroups(user: AuthUser, classId: string): Promise<CachedTrainingGroup[]> {
    assertAuthenticated(user);
    assertClassAccess(user, user.organizationId, classId);
    const db = getDatabase();

    return await db.getAllAsync<CachedTrainingGroup>(
      `SELECT * FROM cached_training_groups
       WHERE organization_id = ? AND class_id = ?
       ORDER BY name ASC;`,
      user.organizationId,
      classId
    );
  },

  /**
   * Caches authorized student roster
   * DATA MINIMIZATION: Only operational check-in fields are stored.
   */
  async saveStudentsRoster(user: AuthUser, students: CachedStudent[]): Promise<void> {
    assertAuthenticated(user);
    const db = getDatabase();

    for (const stu of students) {
      assertTenantAccess(user, stu.organization_id);
      if (stu.class_id) {
        assertClassAccess(user, stu.organization_id, stu.class_id);
      }
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const stu of students) {
        await txn.runAsync(
          `INSERT INTO cached_students (id, organization_id, class_id, group_id, full_name, belt_rank, status, photo_url, cached_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             class_id = excluded.class_id,
             group_id = excluded.group_id,
             full_name = excluded.full_name,
             belt_rank = excluded.belt_rank,
             status = excluded.status,
             photo_url = excluded.photo_url,
             updated_at = datetime('now');`,
          stu.id,
          stu.organization_id,
          stu.class_id || null,
          stu.group_id || null,
          stu.full_name,
          stu.belt_rank || 'White Belt',
          stu.status || 'ACTIVE',
          stu.photo_url || null
        );
      }
    });
  },

  /**
   * Retrieves cached student roster for an assigned class and optional group
   */
  async getStudentsRoster(
    user: AuthUser,
    classId: string,
    groupId?: string
  ): Promise<CachedStudent[]> {
    assertAuthenticated(user);
    assertClassAccess(user, user.organizationId, classId);
    const db = getDatabase();

    if (groupId) {
      return await db.getAllAsync<CachedStudent>(
        `SELECT * FROM cached_students
         WHERE organization_id = ? AND class_id = ? AND group_id = ?
         ORDER BY full_name ASC;`,
        user.organizationId,
        classId,
        groupId
      );
    }

    return await db.getAllAsync<CachedStudent>(
      `SELECT * FROM cached_students
       WHERE organization_id = ? AND class_id = ?
       ORDER BY full_name ASC;`,
      user.organizationId,
      classId
    );
  },

  /**
   * Purges all cached roster data (used upon account switch / logout)
   */
  async purgeAllRosters(): Promise<void> {
    const db = getDatabase();
    await db.execAsync(`
      DELETE FROM cached_students;
      DELETE FROM cached_training_groups;
      DELETE FROM cached_classes;
    `);
  },
};
