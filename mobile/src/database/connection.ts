import { DatabaseConnection } from './adapter';
import { runMigrations } from './migrations/migrator';
import { NodeSqliteAdapter } from './adapters/nodeSqliteAdapter';
import { ExpoSqliteAdapter } from './adapters/expoSqliteAdapter';

import { Migration } from './migrations/types';

let activeConnection: DatabaseConnection | null = null;

export interface InitDatabaseOptions {
  useMemory?: boolean;
  dbName?: string;
  customAdapter?: DatabaseConnection;
  migrations?: Migration[];
}

/**
 * Initializes and migrates the local SQLite database.
 */
export async function initDatabase(options: InitDatabaseOptions = {}): Promise<DatabaseConnection> {
  if (activeConnection) {
    return activeConnection;
  }

  let db: DatabaseConnection;

  if (options.customAdapter) {
    db = options.customAdapter;
  } else if (options.useMemory || process.env.NODE_ENV === 'test') {
    // In Node / Jest testing environment, use native NodeSqliteAdapter
    db = new NodeSqliteAdapter(options.useMemory ? ':memory:' : (options.dbName || ':memory:'));
  } else {
    // In Native React Native / Expo environment
    db = await ExpoSqliteAdapter.open(options.dbName || 'beltflow_offline.db');
  }

  // Ensure foreign keys are enabled
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run migrations
  await runMigrations(db, options.migrations);

  activeConnection = db;
  return activeConnection;
}

/**
 * Returns the currently active SQLite database connection.
 * Throws error if connection is not open.
 */
export function getDatabase(): DatabaseConnection {
  if (!activeConnection) {
    throw new Error('Database connection is not open. Please call initDatabase() first.');
  }
  return activeConnection;
}

/**
 * Closes the active SQLite connection safely.
 */
export async function closeDatabase(): Promise<void> {
  if (activeConnection) {
    await activeConnection.closeAsync();
    activeConnection = null;
  }
}

/**
 * Testing helper: closes existing connection and clears references.
 */
export async function resetDatabaseForTesting(): Promise<void> {
  await closeDatabase();
}
