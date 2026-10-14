import { DatabaseConnection } from '../adapter';
import { Migration } from './types';
import { v1InitialSchema } from './v1_initial_schema';

export const ALL_MIGRATIONS: Migration[] = [v1InitialSchema];

/**
 * Retrieves the highest migration version applied to the database.
 */
export async function getDatabaseVersion(db: DatabaseConnection): Promise<number> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const result = await db.getFirstAsync<{ max_version: number | null }>(
    'SELECT MAX(version) as max_version FROM schema_migrations;'
  );

  return result?.max_version ?? 0;
}

/**
 * Executes all pending migrations in strict version order inside a transaction.
 */
export async function runMigrations(
  db: DatabaseConnection,
  migrations: Migration[] = ALL_MIGRATIONS
): Promise<void> {
  // Ensure migrations tracking table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  // Sort migrations in ascending order
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    if (!appliedVersions.has(migration.version)) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Run migration DDL/DML
        await migration.up(txn);

        // Record applied version
        await txn.runAsync(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'));",
          migration.version,
          migration.name
        );
      });
    }
  }
}
