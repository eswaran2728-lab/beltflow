#!/usr/bin/env node
/**
 * H27 acceptance test migration_restore_pass — rehearsal on real PostgreSQL.
 *
 * For each earlier release ref (default: main 595bd0f and pre-H26 v2 1faf876):
 *   1. Check the ref out into a temporary git worktree, build its backend and
 *      run its own test suites against a fresh PostgreSQL database, so the
 *      data was written by that release's code.
 *   2. Snapshot every table (row count + checksum over the original columns).
 *   3. Apply the CURRENT schema migrations twice (idempotency).
 *   4. Verify every original row is unchanged and run current test suites
 *      against the upgraded database.
 * Then for the newest upgraded database:
 *   5. backup.sh -> restore.sh into a clean database -> verify_restore.js.
 *   6. Re-run current migrations on the restored copy and verify again.
 * Finally:
 *   7. Check the schema changes since each ref are additive only.
 *
 * Never touches production. Needs PostgreSQL client tools and a disposable
 * server: PG_ADMIN_URL=postgres://postgres@127.0.0.1:55432/postgres
 *
 * Usage (from repo root, after `cd server && npm run build`):
 *   PG_ADMIN_URL=... node scripts/db/h27_migration_restore_rehearsal.js [ref ...]
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '../..');
const SERVER = path.join(REPO, 'server');
const ADMIN_URL = process.env.PG_ADMIN_URL;
const REFS = process.argv.slice(2).length ? process.argv.slice(2) : ['595bd0f', '1faf876'];
// server_rbac is excluded on purpose: it needs an empty database (first-time
// setup). The upgraded-database setup lock is checked explicitly instead.
const CURRENT_SUITES = ['core_pilot_certification_h15', 'equipment_merchandise_h25', 'assistant_grounded_ai_h26', 'release_certification_h27'];
const results = [];
let failed = false;

const log = (...a) => console.log(...a);
const record = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) failed = true; log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`); };
const dbUrl = name => { const u = new URL(ADMIN_URL); u.pathname = `/${name}`; return u.toString(); };

async function admin(sql) {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  try { await c.query(sql); } finally { await c.end(); }
}
async function freshDb(name) {
  await admin(`DROP DATABASE IF EXISTS ${name}`);
  await admin(`CREATE DATABASE ${name}`);
  return dbUrl(name);
}

/** Per table: columns, row count, checksum over the given columns (default: all). */
async function snapshot(url, columnsByTable) {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const tables = (await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).rows.map(r => r.table_name);
    const out = {};
    for (const t of tables) {
      const cols = columnsByTable?.[t] || (await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t])).rows.map(r => r.column_name);
      const list = cols.map(col => `"${col}"`).join(', ');
      const count = (await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)).rows[0].n;
      const sum = (await c.query(
        `SELECT md5(COALESCE(string_agg(x.r, '|' ORDER BY x.r), '')) AS h FROM (SELECT ROW(${list})::text AS r FROM "${t}") x`)).rows[0].h;
      out[t] = { columns: cols, count, checksum: sum };
    }
    return out;
  } finally { await c.end(); }
}

function runNode(script, env, cwd = SERVER) {
  const r = spawnSync('node', [script], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 300000 });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function applyCurrentMigrations(url) {
  const code = `const { dbClient } = require('./dist/db/client'); dbClient.init().then(() => dbClient.close()).then(() => console.log('migrated'), e => { console.error(e.message); process.exit(1); });`;
  const r = spawnSync('node', ['-e', code], { cwd: SERVER, env: { ...process.env, DATABASE_URL: url, DATABASE_SSL: 'disable' }, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}

function compareOriginal(before, after) {
  const problems = [];
  for (const [t, b] of Object.entries(before)) {
    const a = after[t];
    if (!a) { problems.push(`${t}: table missing after upgrade`); continue; }
    if (a.count !== b.count) problems.push(`${t}: rows ${b.count} -> ${a.count}`);
    else if (a.checksum !== b.checksum) problems.push(`${t}: original column values changed`);
  }
  return problems;
}

function additiveOnly(ref) {
  const diff = execFileSync('git', ['diff', `${ref}..HEAD`, '--', 'server/src/db/schema.sql'], { cwd: REPO, encoding: 'utf8' });
  const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
  const destructive = added.filter(l => /\b(DROP\s+TABLE|DROP\s+COLUMN|RENAME\s+(?:TO|COLUMN)|ALTER\s+COLUMN\s+\S+\s+(?:SET\s+DATA\s+)?TYPE|TRUNCATE|DELETE\s+FROM)\b/i.test(l) && !/^\+\s*--/.test(l));
  return { addedLines: added.length, destructive };
}

async function upgradeFrom(ref) {
  log(`\n=== Upgrade rehearsal from ${ref} ===`);
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), `beltflow-wt-${ref}-`));
  fs.rmSync(wt, { recursive: true, force: true });
  execFileSync('git', ['worktree', 'add', '--detach', wt, ref], { cwd: REPO, stdio: 'ignore' });
  try {
    const oldServer = path.join(wt, 'server');
    execFileSync('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: oldServer, stdio: 'ignore' });
    execFileSync('npm', ['run', 'build', '--silent'], { cwd: oldServer, stdio: 'ignore' });
    const pkg = JSON.parse(fs.readFileSync(path.join(oldServer, 'package.json'), 'utf8'));
    const suites = Array.from(String(pkg.scripts.test).matchAll(/dist\/tests\/([a-z0-9_]+)\.test\.js/g)).map(m => m[1]);
    const name = `h27_up_${ref.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
    const url = await freshDb(name);
    let passedOld = 0;
    for (const s of suites) {
      const r = runNode(`dist/tests/${s}.test.js`, { DATABASE_URL: url, DATABASE_SSL: 'disable' }, oldServer);
      if (r.ok) passedOld += 1;
    }
    log(`   ${ref}: ran ${suites.length} of its own suites to create data (${passedOld} passed on PostgreSQL)`);

    const before = await snapshot(url);
    const totalRows = Object.values(before).reduce((n, t) => n + t.count, 0);
    record(`${ref}: data written by ${ref} code`, totalRows > 0, `${Object.keys(before).length} tables, ${totalRows} rows`);

    const m1 = applyCurrentMigrations(url);
    const m2 = applyCurrentMigrations(url);
    record(`${ref}: current migrations apply`, m1.ok, m1.ok ? '' : m1.out.slice(0, 300));
    record(`${ref}: current migrations re-run safely (idempotent)`, m2.ok, m2.ok ? '' : m2.out.slice(0, 300));

    const columns = Object.fromEntries(Object.entries(before).map(([t, v]) => [t, v.columns]));
    const after = await snapshot(url, columns);
    const problems = compareOriginal(before, after);
    record(`${ref}: every original row unchanged after upgrade`, problems.length === 0, problems.slice(0, 5).join('; '));

    const lock = spawnSync('node', ['-e', `
      const http=require('http'); const app=require('./dist/app').default; const { dbClient }=require('./dist/db/client');
      dbClient.init().then(()=>{ const s=http.createServer(app).listen(0,'127.0.0.1',()=>{
        http.get({host:'127.0.0.1',port:s.address().port,path:'/api/v1/auth/setup-status'},res=>{ let b='';res.on('data',c=>b+=c);res.on('end',()=>{console.log(b);s.close(()=>dbClient.close());});});});});`],
      { cwd: SERVER, env: { ...process.env, DATABASE_URL: url, DATABASE_SSL: 'disable' }, encoding: 'utf8' });
    const setupRequired = /"setupRequired":\s*true/.test(lock.stdout);
    const usersExist = Object.values(before).some(() => true) && (before.users?.count || 0) > 0;
    record(`${ref}: first-time setup stays locked after upgrade`, usersExist ? !setupRequired : true, lock.stdout.trim().split('\n').pop());

    for (const s of CURRENT_SUITES) {
      const r = runNode(`dist/tests/${s}.test.js`, { DATABASE_URL: url, DATABASE_SSL: 'disable' });
      record(`${ref}: current suite ${s} on upgraded DB`, r.ok, r.ok ? '' : r.out.split('\n').filter(l => /Assertion|Error|❌/.test(l)).slice(0, 2).join(' | '));
    }

    const add = additiveOnly(ref);
    record(`${ref}: schema changes since ${ref} are additive only`, add.destructive.length === 0,
      add.destructive.length ? add.destructive.slice(0, 3).join(' | ') : `${add.addedLines} added schema lines, 0 destructive`);
    return url;
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: REPO, stdio: 'ignore' });
  }
}

async function backupRestore(sourceUrl) {
  log('\n=== Backup and restore rehearsal (scripts/db) ===');
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-backup-'));
  try {
    const b = spawnSync('bash', [path.join(__dirname, 'backup.sh')], { env: { ...process.env, DATABASE_URL: sourceUrl, BACKUP_DIR: backupDir }, encoding: 'utf8' });
    const dump = fs.readdirSync(backupDir).find(f => f.endsWith('.dump'));
    record('backup.sh produced a backup', b.status === 0 && !!dump, dump ? `${(fs.statSync(path.join(backupDir, dump)).size / 1024).toFixed(0)} KB` : `${b.stderr}`.slice(0, 200));
    if (!dump) return;

    const targetUrl = await freshDb('h27_restored');
    const r = spawnSync('bash', [path.join(__dirname, 'restore.sh')], {
      env: { ...process.env, TARGET_DATABASE_URL: targetUrl, BACKUP_FILE: path.join(backupDir, dump), I_UNDERSTAND_THIS_TARGET_IS_CORRECT: 'yes' }, encoding: 'utf8' });
    record('restore.sh restored into a clean database', r.status === 0, r.status === 0 ? '' : `${r.stderr}`.slice(0, 300));

    const verify = () => spawnSync('node', [path.join(__dirname, 'verify_restore.js')], {
      env: { ...process.env, SOURCE_DATABASE_URL: sourceUrl, RESTORED_DATABASE_URL: targetUrl }, encoding: 'utf8' });
    const v1 = verify();
    const tableLine = (v1.stdout.match(/TABLE COMPARISON \((\d+) tables/) || [])[1];
    record('verify_restore.js: every table count and checksum matches', v1.status === 0, `${tableLine || '?'} tables compared; ${(v1.stdout.match(/OVERALL: \w+/) || [''])[0]}`);
    if (v1.status !== 0) log(v1.stdout.split('\n').filter(l => /MISMATCH|MISSING|FAIL/.test(l)).slice(0, 10).join('\n'));

    const m = applyCurrentMigrations(targetUrl);
    record('current migrations run on the restored copy', m.ok, m.ok ? '' : m.out.slice(0, 200));
    const v2 = verify();
    record('restored copy unchanged by migrations (verify again)', v2.status === 0, (v2.stdout.match(/OVERALL: \w+/) || [''])[0]);

    const health = spawnSync('node', ['-e', `
      process.env.DATABASE_URL=${JSON.stringify(targetUrl)}; process.env.DATABASE_SSL='disable';
      const http=require('http'); const app=require('./dist/app').default; const { dbClient }=require('./dist/db/client');
      dbClient.init().then(()=>{ const s=http.createServer(app).listen(0,'127.0.0.1',()=>{
        http.get({host:'127.0.0.1',port:s.address().port,path:'/api/health/ready'},res=>{ let b='';res.on('data',c=>b+=c);res.on('end',()=>{console.log(res.statusCode,b);s.close(()=>dbClient.close());});});});});`],
      { cwd: SERVER, encoding: 'utf8' });
    record('backend starts on the restored database (/api/health/ready)', /^200 /m.test(health.stdout), health.stdout.trim().split('\n').pop());
  } finally {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}

(async () => {
  if (!ADMIN_URL) { console.log('SKIPPED: set PG_ADMIN_URL to a disposable PostgreSQL server.'); return; }
  const pgVersion = execFileSync('pg_dump', ['--version'], { encoding: 'utf8' }).trim();
  log(`H27 migration/restore rehearsal — ${pgVersion}; refs: ${REFS.join(', ')}; HEAD ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()}`);
  let lastUpgraded;
  for (const ref of REFS) lastUpgraded = await upgradeFrom(ref);
  if (lastUpgraded) await backupRestore(lastUpgraded);
  const passed = results.filter(r => r.ok).length;
  log(`\n${failed ? '❌' : '🎉'} migration_restore_pass: ${passed}/${results.length} checks passed.`);
  process.exitCode = failed ? 1 : 0;
})().catch(err => { console.error('❌ Rehearsal error:', err.message); process.exitCode = 1; });
