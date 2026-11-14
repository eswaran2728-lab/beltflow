/**
 * BeltFlow Mobile Database Connection Interface
 * Enables transparent switching between Expo SQLite (production native)
 * and Node SQLite (fast deterministic integration tests).
 */

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface DatabaseConnection {
  /**
   * Execute raw SQL statements (e.g. DDL scripts, multi-statement migrations)
   */
  execAsync(sql: string): Promise<void>;

  /**
   * Execute parameterized write queries (INSERT, UPDATE, DELETE)
   */
  runAsync(sql: string, ...params: any[]): Promise<RunResult>;

  /**
   * Fetch single row or null
   */
  getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null>;

  /**
   * Fetch all matching rows
   */
  getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;

  /**
   * Execute a block inside an isolated exclusive database transaction.
   * Automatically commits on resolution and rolls back on error.
   */
  withExclusiveTransactionAsync<T>(
    task: (txn: DatabaseConnection) => Promise<T>
  ): Promise<T>;

  /**
   * Closes database handle safely
   */
  closeAsync(): Promise<void>;
}
