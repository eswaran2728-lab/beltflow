/**
 * H27 regression guard: never send an HTTP response from inside a database
 * transaction callback.
 *
 * Found during H27 on real PostgreSQL: commerce routes replied "201 Created"
 * before COMMIT. A client acting on that reply over another connection
 * (e.g. reserving the new order) could get "Order not found", and a failed
 * COMMIT would leave the client believing a record exists that does not.
 * PGlite runs one transaction at a time, which hid it.
 *
 * Static check over every route file: the transaction callback must return
 * a result; the handler responds after the transaction has resolved.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function transactionBodies(source: string): Array<{ line: number; body: string }> {
  const out: Array<{ line: number; body: string }> = [];
  const opener = /\.transaction\(\s*async\s*\([^)]*\)\s*(?::\s*[^=]+)?=>\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(source))) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ line: source.slice(0, m.index).split('\n').length, body: source.slice(m.index + m[0].length, i) });
  }
  return out;
}

function run() {
  console.log('🥋 H27 guard: no HTTP response inside a database transaction...');
  const routesDir = path.resolve(__dirname, '../../src/routes');
  const offenders: string[] = [];
  let checked = 0;
  for (const file of fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
    for (const t of transactionBodies(src)) {
      checked += 1;
      if (/\bres\.(?:status|json|send|sendStatus|end)\(/.test(t.body)) offenders.push(`${file}:${t.line}`);
    }
  }
  assert.ok(checked > 10, `found transactions to check (${checked})`);
  assert.deepEqual(offenders, [], `responses sent before COMMIT in: ${offenders.join(', ')}`);
  console.log(`✅ ${checked} transaction callbacks checked; none sends a response before COMMIT.`);
  console.log('\n🎉 No-response-inside-transaction guard passed.');
}

if (require.main === module) {
  try {
    run();
  } catch (err) {
    console.error('❌ No-response-inside-transaction guard failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}
