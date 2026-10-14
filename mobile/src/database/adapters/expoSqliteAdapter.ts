import * as SQLite from 'expo-sqlite';
import { DatabaseConnection, RunResult } from '../adapter';

/**
 * Expo SQLite Native Adapter
 * Wraps expo-sqlite's SQLiteDatabase for real React Native mobile execution.
 */
export class ExpoSqliteAdapter implements DatabaseConnection {
  private nativeDb: SQLite.SQLiteDatabase;

  constructor(nativeDb: SQLite.SQLiteDatabase) {
    this.nativeDb = nativeDb;
  }

  static async open(dbName: string = 'beltflow_offline.db'): Promise<ExpoSqliteAdapter> {
    const db = await SQLite.openDatabaseAsync(dbName);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return new ExpoSqliteAdapter(db);
  }

  async execAsync(sql: string): Promise<void> {
    if (!this.nativeDb) {
      throw new Error('Database connection is not open.');
    }
    await this.nativeDb.execAsync(sql);
  }

  async runAsync(sql: string, ...params: any[]): Promise<RunResult> {
    if (!this.nativeDb) {
      throw new Error('Database connection is not open.');
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const res = await this.nativeDb.runAsync(sql, ...flatParams);
    return {
      lastInsertRowId: res.lastInsertRowId,
      changes: res.changes,
    };
  }

  async getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    if (!this.nativeDb) {
      throw new Error('Database connection is not open.');
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return await this.nativeDb.getFirstAsync<T>(sql, ...flatParams);
  }

  async getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    if (!this.nativeDb) {
      throw new Error('Database connection is not open.');
    }

    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return await this.nativeDb.getAllAsync<T>(sql, ...flatParams);
  }

  async withExclusiveTransactionAsync<T>(
    task: (txn: DatabaseConnection) => Promise<T>
  ): Promise<T> {
    if (!this.nativeDb) {
      throw new Error('Database connection is not open.');
    }

    let result!: T;
    await this.nativeDb.withExclusiveTransactionAsync(async (nativeTxn) => {
      const wrappedTxn = new ExpoSqliteAdapter(nativeTxn as any);
      result = await task(wrappedTxn);
    });
    return result;
  }

  async closeAsync(): Promise<void> {
    if (this.nativeDb) {
      await this.nativeDb.closeAsync();
      this.nativeDb = null as any;
    }
  }
}
