import { Migration } from './types';
import { DatabaseConnection } from '../adapter';

/**
 * Migration v2: Adds quarantine support and actor-scoped indexing to attendance_mutation_queue.
 *
 * Ensures pending attendance mutations are quarantined rather than deleted or leaked
 * when account switching, logging out, or experiencing revoked authorizations.
 */
export const v2QuarantineSupport: Migration = {
  version: 2,
  name: 'v2_quarantine_support',
  up: async (db: DatabaseConnection) => {
    // 1. Add quarantine_reason column to record reason for quarantine
    await db.execAsync(`
      ALTER TABLE attendance_mutation_queue
      ADD COLUMN quarantine_reason TEXT;
    `);

    // 2. Add composite index on actor_id and queue_status for fast actor-isolated queries
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_mutation_queue_actor_status
      ON attendance_mutation_queue(actor_id, queue_status);
    `);
  },
  down: async (db: DatabaseConnection) => {
    await db.execAsync(`
      DROP INDEX IF EXISTS idx_mutation_queue_actor_status;
    `);
  },
};
