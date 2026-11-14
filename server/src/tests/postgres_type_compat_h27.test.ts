/**
 * H27 regression: values that real PostgreSQL returns differently from the
 * embedded PGlite test engine.
 *
 * node-postgres returns BIGINT and NUMERIC columns as strings ("16"), while
 * PGlite returns numbers. Found during the H27 real-PostgreSQL run: video
 * finalize compared the stored BIGINT size with the file size using !==, so
 * every video upload failed on PostgreSQL with
 * "Size mismatch: expected 16 bytes, found 16 bytes".
 */
import assert from 'node:assert/strict';
import { mediaStorageAdapter } from '../services/mediaStorageAdapter';

async function run() {
  console.log('🥋 H27 PostgreSQL type-compatibility regression tests...');
  const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00]);
  const key = `h27-compat/test_${Date.now()}.mp4`;
  await mediaStorageAdapter.saveObject(key, mp4, 'video/mp4');

  // BIGINT size as node-postgres returns it (a string).
  const asString = await mediaStorageAdapter.verifyObject(key, '16' as unknown as number, 'video/mp4');
  assert.equal(asString.exists, true);
  assert.equal(asString.magicValid, true, `string BIGINT size must match: ${asString.error || ''}`);

  const asNumber = await mediaStorageAdapter.verifyObject(key, 16, 'video/mp4');
  assert.equal(asNumber.magicValid, true, 'numeric size still matches');

  const wrong = await mediaStorageAdapter.verifyObject(key, '17' as unknown as number, 'video/mp4');
  assert.equal(wrong.magicValid, false, 'a genuinely different size is still rejected');
  assert.match(String(wrong.error), /Size mismatch/);

  console.log('✅ Video size check works with PostgreSQL BIGINT strings and still rejects real mismatches.');
  console.log('\n🎉 H27 PostgreSQL type-compatibility regression tests passed.');
}

if (require.main === module) {
  run().catch(err => {
    console.error('❌ PostgreSQL type-compatibility tests failed:', err);
    process.exitCode = 1;
  });
}
