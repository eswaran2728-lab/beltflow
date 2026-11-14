/**
 * H27 regression: database initialisation must happen exactly once, even when
 * many requests arrive at the same moment on a freshly started server.
 *
 * dbClient initialises lazily on the first query. Without a shared
 * in-flight promise, N concurrent first queries each opened their own
 * connection pool (or PGlite instance on the same data folder) and applied
 * the schema N times in parallel.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dbClient } from '../db/client';

async function run() {
  console.log('🥋 H27 database initialisation concurrency test...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-h27-init-'));
  const previous = process.env.PG_DATA_DIR;
  process.env.PG_DATA_DIR = dataDir;
  const client: any = dbClient;
  const original = client.runMigrations.bind(client);
  let migrations = 0;
  client.runMigrations = async () => { migrations += 1; return original(); };
  try {
    const results = await Promise.all(Array.from({ length: 12 }, () => dbClient.query('SELECT COUNT(*)::int AS n FROM organizations')));
    assert.ok(results.every(r => r.rows.length === 1), 'every concurrent first query succeeds');
    assert.equal(migrations, 1, `schema applied exactly once (applied ${migrations} times)`);
    await dbClient.query('SELECT 1');
    assert.equal(migrations, 1, 'later queries do not re-run migrations');
    console.log('✅ 12 concurrent first queries: one initialisation, one schema run.');
    console.log('\n🎉 Database initialisation concurrency test passed.');
  } finally {
    client.runMigrations = original;
    await dbClient.close();
    if (previous === undefined) delete process.env.PG_DATA_DIR; else process.env.PG_DATA_DIR = previous;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('❌ Database initialisation concurrency test failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
