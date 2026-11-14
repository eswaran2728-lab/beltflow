import { DatabaseConnection, RunResult } from '../adapter';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

/**
 * Node 22+ Native SQLite Adapter
 * Provides genuine, real SQLite database execution for Jest & Node environments.
 */
export class NodeSqliteAdapter implements DatabaseConnection {
  private db: any;
  private inTransaction = false;

  constructor(filePath: string = ':memory:') {
    this.db = new DatabaseSync(filePath);
    // Enforce foreign key constraints by default
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  async execAsync(sql: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection is not open.');
    }
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: any[]): Promise<RunResult> {
    if (!this.db) {
      throw new Error('Database connection is not open.');
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...flatParams);

    return {
      lastInsertRowId: Number(result.lastInsertRowid ?? 0),
      changes: Number(result.changes ?? 0),
    };
  }

  async getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    if (!this.db) {
      throw new Error('Database connection is not open.');
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...flatParams);

    return (row as T) || null;
  }

  async getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database connection is not open.');
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...flatParams);

    return (rows as T[]) || [];
  }

  async withExclusiveTransactionAsync<T>(
    task: (txn: DatabaseConnection) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database connection is not open.');
    }

    if (this.inTransaction) {
      // Already in transaction, simply execute task
      return await task(this);
    }

    this.inTransaction = true;
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const result = await task(this);
      this.db.exec('COMMIT;');
      this.inTransaction = false;
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback failure if already rolled back
      }
      this.inTransaction = false;
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore if already closed
      }
      this.db = null;
    }
  }
}
