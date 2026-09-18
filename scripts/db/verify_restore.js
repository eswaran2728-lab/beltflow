/**
 * Compares row counts and key business-integrity aggregates between a
 * SOURCE and a RESTORED PostgreSQL database. Never prints password/hash
 * columns - only counts, ids, and non-secret business values.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=... RESTORED_DATABASE_URL=... node scripts/db/verify_restore.js
 */
const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const { Client } = require('pg');

const TABLES = [
  'organizations', 'users', 'classes', 'coach_class_assignments', 'students',
  'parent_student_links', 'class_transfer_requests', 'attendance_sessions',
  'attendance_records', 'invoices', 'payments', 'grading_events',
  'grading_candidates', 'certificates', 'skills', 'student_skills',
  'tournaments', 'tournament_participants', 'audit_logs'
];

async function inventory(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  const counts = {};
  for (const t of TABLES) {
    const r = await client.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    counts[t] = r.rows[0].c;
  }
  const financial = await client.query(
    `SELECT COUNT(*)::int AS payment_count, COALESCE(SUM(amount), 0)::numeric AS total_amount,
            COUNT(DISTINCT receipt_no)::int AS distinct_receipts
     FROM payments WHERE status = 'Approved'`
  );
  const receiptDup = await client.query(
    `SELECT receipt_no, COUNT(*) c FROM payments WHERE receipt_no IS NOT NULL GROUP BY receipt_no HAVING COUNT(*) > 1`
  );
  await client.end();
  return { counts, financial: financial.rows[0], duplicateReceipts: receiptDup.rows };
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const restoredUrl = process.env.RESTORED_DATABASE_URL;
  if (!sourceUrl || !restoredUrl) {
    console.error('ERROR: SOURCE_DATABASE_URL and RESTORED_DATABASE_URL are both required.');
    process.exit(2);
  }

  const source = await inventory(sourceUrl);
  const restored = await inventory(restoredUrl);

  let allMatch = true;
  console.log('TABLE ROW COUNT COMPARISON');
  console.log('table'.padEnd(30), 'source'.padEnd(10), 'restored'.padEnd(10), 'result');
  for (const t of TABLES) {
    const ok = source.counts[t] === restored.counts[t];
    if (!ok) allMatch = false;
    console.log(t.padEnd(30), String(source.counts[t]).padEnd(10), String(restored.counts[t]).padEnd(10), ok ? 'MATCH' : 'MISMATCH');
  }

  console.log('\nFINANCIAL INTEGRITY');
  console.log('source:', JSON.stringify(source.financial));
  console.log('restored:', JSON.stringify(restored.financial));
  const financialOk = source.financial.payment_count === restored.financial.payment_count &&
    Number(source.financial.total_amount) === Number(restored.financial.total_amount) &&
    source.financial.distinct_receipts === restored.financial.distinct_receipts;
  if (!financialOk) allMatch = false;
  console.log('financial match:', financialOk);

  console.log('\nDUPLICATE RECEIPT CHECK (restored DB)');
  console.log('duplicates found:', restored.duplicateReceipts.length, restored.duplicateReceipts.length === 0 ? '(PASS)' : '(FAIL)');
  if (restored.duplicateReceipts.length > 0) allMatch = false;

  console.log('\nOVERALL:', allMatch ? 'PASS' : 'FAIL');
  process.exit(allMatch ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification script error:', err.message);
  process.exit(1);
});
