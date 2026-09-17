import fs from 'fs';
import path from 'path';
import { Pool, QueryResult } from 'pg';
import { PGlite } from '@electric-sql/pglite';

export interface SqlQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

class PostgresDatabaseClient {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  private isInitialized = false;

  async init(customDataDir?: string): Promise<void> {
    if (this.isInitialized) return;

    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      console.log('🔌 Connecting to remote PostgreSQL database via DATABASE_URL...');
      this.pgPool = new Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      // Test connection
      const client = await this.pgPool.connect();
      client.release();
    } else {
      const dataDir = customDataDir || process.env.PG_DATA_DIR || path.join(process.cwd(), '.beltflow_pgdata');
      console.log(`📦 Initializing embedded persistent PostgreSQL engine at: ${dataDir}`);
      this.pglite = new PGlite(dataDir);
    }

    // Run schema migrations
    await this.runMigrations();
    this.isInitialized = true;
  }

  async runMigrations(): Promise<void> {
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, '../../src/db/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(process.cwd(), 'server/src/db/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`CRITICAL: Database schema file not found at ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    await this.exec(sql);
    console.log('✅ PostgreSQL Schema migrations successfully applied.');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<SqlQueryResult<T>> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.pgPool) {
      const res: any = await this.pgPool.query(sql, params);
      return { rows: res.rows, rowCount: res.rowCount || 0 };
    }

    if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.rows.length };
    }

    throw new Error('Database client not initialized');
  }

  async exec(sql: string): Promise<void> {
    if (this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
      return;
    }

    if (this.pglite) {
      await this.pglite.exec(sql);
      return;
    }

    // Initialize if needed
    const dataDir = process.env.PG_DATA_DIR || path.join(process.cwd(), '.beltflow_pgdata');
    this.pglite = new PGlite(dataDir);
    await this.pglite.exec(sql);
  }

  async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
    }
    this.isInitialized = false;
  }
}

export const dbClient = new PostgresDatabaseClient();
