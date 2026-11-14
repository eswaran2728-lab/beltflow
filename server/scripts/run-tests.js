#!/usr/bin/env node
/* global __dirname */
/**
 * Backend test runner. Runs every suite in its own process.
 *
 * Each suite gets a fresh, empty embedded database (PG_DATA_DIR in a new
 * temp folder) that is deleted afterwards, so tests never write into the
 * developer's local database (server/.beltflow_pgdata), never see data or
 * rate limits left by another suite or an earlier run, and suites that need
 * an empty database (attendance_sync, server_rbac) always get one.
 * With DATABASE_URL set, suites use that PostgreSQL database instead.
 *
 * All suites run; failures are listed at the end and the exit code is 1.
 *   node scripts/run-tests.js            all suites
 *   node scripts/run-tests.js h13 push   only suites whose name contains a filter
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Order kept from the former npm test chain (phase2_backend_readiness was
// compiled but never run by it; added 2026-11-14).
const SUITES = [
  'transaction_pool', 'server_rbac', 'phase2_backend_readiness', 'attendance_sync', 'authority_relationships', 'master_verification',
  'class_lifecycle', 'student_enrollment', 'master_class_workspace', 'master_handover', 'qr_pass_security',
  'persatuan_curriculum', 'class_scheduling', 'student_safety_notices', 'grading_progression_h12',
  'persatuan_payments_h13', 'academy_onboarding_imports_h14', 'core_pilot_certification_h15', 'trials_retention_h16',
  'trial_auth_001_regression', 'makeup_waitlist_h17', 'booking_safety_h17_regression', 'membership_transfers_h18',
  'transfer_auth_001_regression', 'transfer_date_001_regression', 'booking_expiry_001_regression',
  'lesson_plans_family_hub_h19', 'sub_auth_001_regression', 'learning_library_rewards_h20', 'media_feedback_h21',
  'media_feedback_security_preflight', 'messaging_parent_master_h22', 'growth_analytics_h23',
  'tournament_operations_h24', 'tournament_security_preflight', 'equipment_merchandise_h25',
  'assistant_grounded_ai_h26', 'assistant_gemini_provider_h26', 'postgres_type_compat_h27',
  'release_certification_h27', 'worker_replay_h27', 'db_init_concurrency_h27', 'no_response_inside_transaction_h27',
  'ops_payment_safety_followups', 'notification_inbox', 'push_notifications', 'billing_status_sync',
  'tenant_feature_flags',
];

const distTests = path.join(__dirname, '..', 'dist', 'tests');
const filters = process.argv.slice(2).map(f => f.toLowerCase());
const selected = filters.length ? SUITES.filter(s => filters.some(f => s.includes(f))) : SUITES;

// Every compiled suite must be listed, so a new test cannot be forgotten.
const compiled = fs.existsSync(distTests)
  ? fs.readdirSync(distTests).filter(f => f.endsWith('.test.js')).map(f => f.replace(/\.test\.js$/, ''))
  : [];
const unlisted = compiled.filter(s => !SUITES.includes(s));
if (!filters.length && unlisted.length) {
  console.error(`❌ Test suites not listed in scripts/run-tests.js: ${unlisted.join(', ')}`);
  process.exit(1);
}

const failed = [];
const started = Date.now();
for (const suite of selected) {
  const file = path.join(distTests, `${suite}.test.js`);
  if (!fs.existsSync(file)) {
    console.error(`❌ ${suite}: ${file} not found (run npm run build first)`);
    failed.push(suite);
    continue;
  }
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `beltflow-test-${suite}-`));
  const env = { ...process.env };
  if (!env.DATABASE_URL) env.PG_DATA_DIR = dataDir;
  const t0 = Date.now();
  console.log(`\n▶ ${suite}`);
  const r = spawnSync(process.execPath, [file], { env, stdio: 'inherit' });
  fs.rmSync(dataDir, { recursive: true, force: true });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status === 0) console.log(`✔ ${suite} (${secs}s)`);
  else { console.log(`✖ ${suite} (exit ${r.status ?? r.signal}, ${secs}s)`); failed.push(suite); }
}

const total = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\n${selected.length - failed.length}/${selected.length} suites passed in ${total}s${process.env.DATABASE_URL ? ' (DATABASE_URL)' : ' (fresh embedded database per suite)'}.`);
if (failed.length) {
  console.log(`Failed: ${failed.join(', ')}`);
  process.exit(1);
}
