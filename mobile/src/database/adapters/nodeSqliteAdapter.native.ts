import { DatabaseConnection, RunResult } from '../adapter';

/**
 * Native stub for NodeSqliteAdapter.
 * NodeSqliteAdapter is exclusively used in Node / Jest environments.
 * On native React Native / Expo platforms, ExpoSqliteAdapter is used instead.
 */
export class NodeSqliteAdapter implements DatabaseConnection {
  constructor(_filePath?: string) {
    throw new Error('NodeSqliteAdapter is not supported on native platforms. Use ExpoSqliteAdapter instead.');
  }

  async execAsync(_sql: string): Promise<void> {
    throw new Error('NodeSqliteAdapter is not supported on native platforms.');
  }

  async runAsync(_sql: string, ..._params: any[]): Promise<RunResult> {
    throw new Error('NodeSqliteAdapter is not supported on native platforms.');
  }

  async getFirstAsync<T = any>(_sql: string, ..._params: any[]): Promise<T | null> {
    throw new Error('NodeSqliteAdapter is not supported on native platforms.');
  }

  async getAllAsync<T = any>(_sql: string, ..._params: any[]): Promise<T[]> {
    throw new Error('NodeSqliteAdapter is not supported on native platforms.');
  }

  async withExclusiveTransactionAsync<T>(_task: (txn: DatabaseConnection) => Promise<T>): Promise<T> {
    throw new Error('NodeSqliteAdapter is not supported on native platforms.');
  }

  async closeAsync(): Promise<void> {}
}
