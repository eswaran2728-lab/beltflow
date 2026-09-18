/**
 * Captures a non-secret integrity manifest for a database: row counts,
 * relationship counts, and business identifiers (receipt numbers,
 * certificate codes, class membership). Never includes password_hash,
 * JWT secrets, or any credential.
 *
 * Usage: DATABASE_URL=... node scripts/db/baseline_manifest.js > manifest.json
 */
const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL is required.');
    process.exit(2);
  }
  const client = new Client({ connectionString: url });
  await client.connect();

  const manifest = {};

  const q = async (label, sql) => {
    const r = await client.query(sql);
    manifest[label] = r.rows;
  };

  await q('organizations', `SELECT id, name, status FROM organizations`);
  await q('users_by_role', `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role`);
  await q('classes', `SELECT id, organization_id, name, status FROM classes`);
  await q('students', `SELECT id, organization_id, class_id, full_name, belt_rank, billing_status FROM students`);
  await q('parent_links', `SELECT parent_id, student_id, status FROM parent_student_links`);
  await q('class_transfers', `SELECT student_id, old_class_id, new_class_id, status FROM class_transfer_requests`);
  await q('attendance_counts', `SELECT class_id, COUNT(*)::int AS count FROM attendance_records GROUP BY class_id`);
  await q('skills_counts', `SELECT COUNT(*)::int AS count FROM student_skills`);
  await q('payments', `SELECT id, student_id, amount, receipt_no, status FROM payments ORDER BY created_at`);
  await q('grading_candidates', `SELECT id, grading_event_id, student_id, result FROM grading_candidates`);
  await q('certificates', `SELECT id, code, student_id, rank_or_title, type, status FROM certificates ORDER BY created_at`);
  await q('tournament_participants', `SELECT id, tournament_id, student_id, category, medal FROM tournament_participants`);

  const financial = await client.query(
    `SELECT COUNT(*)::int AS payment_count, COALESCE(SUM(amount),0)::numeric AS total_amount FROM payments WHERE status = 'Approved'`
  );
  manifest.financial_totals = financial.rows[0];

  await client.end();
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error('Manifest script error:', err.message);
  process.exit(1);
});
