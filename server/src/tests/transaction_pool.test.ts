import assert from 'node:assert/strict';
import { dbClient, SqlTransactionClient } from '../db/client';

async function runPoolTests() {
  console.log('🚀 Starting Database Transaction & Pool Client Verification Tests...');

  // Mock pool client
  let clientReleased = false;
  let queriesExecuted: string[] = [];
  const mockClient = {
    query: async (sql: string, params: any[] = []) => {
      queriesExecuted.push(sql);
      return { rows: [{ id: 1 }], rowCount: 1 };
    },
    release: () => {
      clientReleased = true;
    },
  };

  let connectCallCount = 0;
  const mockPool = {
    connect: async () => {
      connectCallCount++;
      clientReleased = false;
      return mockClient;
    },
    query: async () => {
      throw new Error('pool.query should not be called directly during transaction');
    },
    end: async () => {},
  };

  // 1. Test successful transaction with pool
  console.log('Test P1: Pool client reuse, BEGIN, COMMIT, and release on success...');
  (dbClient as any).pgPool = mockPool;
  (dbClient as any).isInitialized = true;
  queriesExecuted = [];
  connectCallCount = 0;
  clientReleased = false;

  const result = await (dbClient as any).transaction(async (tx: SqlTransactionClient) => {
    assert.equal(connectCallCount, 1, 'connect() must be called exactly once');
    assert.equal(queriesExecuted[0], 'BEGIN', 'BEGIN must be first query');
    await tx.query('SELECT 1');
    await tx.query('UPDATE test SET val = 2');
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.equal(connectCallCount, 1);
  assert.equal(clientReleased, true, 'client.release() must be called in finally');
  assert.equal(queriesExecuted[0], 'BEGIN');
  assert.equal(queriesExecuted[1], 'SELECT 1');
  assert.equal(queriesExecuted[2], 'UPDATE test SET val = 2');
  assert.equal(queriesExecuted[3], 'COMMIT');

  // 2. Test rollback on failure with pool
  console.log('Test P2: Pool client rollback and release on error...');
  queriesExecuted = [];
  connectCallCount = 0;
  clientReleased = false;
  let txErrorCaught = false;

  try {
    await (dbClient as any).transaction(async (tx: SqlTransactionClient) => {
      await tx.query('INSERT INTO fail_test VALUES (1)');
      throw new Error('Simulated failure inside transaction');
    });
  } catch (err: any) {
    txErrorCaught = true;
    assert.equal(err.message, 'Simulated failure inside transaction');
  }

  assert.equal(txErrorCaught, true);
  assert.equal(connectCallCount, 1);
  assert.equal(clientReleased, true, 'client.release() must be called on failure');
  assert.equal(queriesExecuted[0], 'BEGIN');
  assert.equal(queriesExecuted[1], 'INSERT INTO fail_test VALUES (1)');
  assert.equal(queriesExecuted[2], 'ROLLBACK');

  // Clean up mock
  (dbClient as any).pgPool = null;
  (dbClient as any).isInitialized = false;

  console.log('✅ All Database Transaction & Pool Client Verification Tests Passed!');
}

runPoolTests().catch(err => {
  console.error('❌ Transaction Pool Test Failed:', err);
  process.exit(1);
});
