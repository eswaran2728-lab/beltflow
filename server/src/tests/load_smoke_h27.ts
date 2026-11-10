/**
 * H27 load smoke test (indicative, not a capacity certificate).
 *
 * Starts the real server (dist/index.js) as a separate process against the
 * database in DATABASE_URL, seeds one pilot-sized Persatuan with synthetic
 * data, then runs concurrent virtual users for a fixed time and reports
 * latency percentiles and error rates per endpoint.
 *
 * Manual run (needs a disposable PostgreSQL database):
 *   DATABASE_URL=postgres://... node dist/tests/load_smoke_h27.js
 * Optional: LOAD_USERS (default 50), LOAD_SECONDS (default 30).
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { Client } from 'pg';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

const USERS = Number(process.env.LOAD_USERS || 50);
const SECONDS = Number(process.env.LOAD_SECONDS || 30);
const PORT = 4700 + Math.floor(Math.random() * 200);
const BUDGET_P95_MS = 500;

type Sample = { ms: number; ok: boolean; status: number };
const samples: Record<string, Sample[]> = {};

function call(method: string, urlPath: string, token: string, body?: unknown): Promise<Sample> {
  return new Promise(resolve => {
    const payload = body ? JSON.stringify(body) : '';
    const started = process.hrtime.bigint();
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: urlPath, method, agent: keepAlive,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': String(Buffer.byteLength(payload)) } : {}) },
    }, res => {
      res.resume();
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        resolve({ ms, ok: (res.statusCode || 0) < 400, status: res.statusCode || 0 });
      });
    });
    req.on('error', () => resolve({ ms: Number(process.hrtime.bigint() - started) / 1e6, ok: false, status: 0 }));
    if (payload) req.write(payload);
    req.end();
  });
}
const keepAlive = new http.Agent({ keepAlive: true, maxSockets: 256 });

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('SKIPPED: set DATABASE_URL to a disposable PostgreSQL database.'); return; }
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = jwtSecret;

  const serverProc = spawn('node', [path.resolve(__dirname, '../index.js')], {
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: jwtSecret, DATABASE_SSL: 'disable', AI_RATE_LIMIT_PER_MINUTE: '100000', AI_DAILY_TOKEN_BUDGET_PER_ORG: '100000000', AI_DAILY_TOKEN_BUDGET_PER_ACTOR: '100000000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 30000);
    serverProc.stdout.on('data', d => { if (String(d).includes('running on port')) { clearTimeout(t); resolve(); } });
  });
  // Wait for the server's own startup migration (readiness), as a load balancer would.
  for (let i = 0; i < 60; i++) {
    const ready = await new Promise<number>(r => http.get({ host: '127.0.0.1', port: PORT, path: '/api/health/ready' }, res => { res.resume(); r(res.statusCode || 0); }).on('error', () => r(0)));
    if (ready === 200) break;
    await new Promise(r => setTimeout(r, 500));
  }

  const db = new Client({ connectionString: url });
  await db.connect();
  const ts = Date.now();
  const ORG = `org_load_${ts}`;
  try {
    // ------------------------------------------------------------ seed
    await db.query(`INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
      VALUES ($1, 'Load Test Persatuan', 'Selangor', 'Silambam', 'Guru', '0100000000', $2, 'ACTIVE')`, [ORG, `${ORG}@load.test`]);
    const tokens: Array<{ role: string; token: string; studentId?: string }> = [];
    const addUser = async (idv: string, role: UserRole) => {
      await db.query(`INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE')`,
        [idv, `${idv}@load.test`, `Load ${idv}`, role, ORG]);
      return generateAuthToken({ id: idv, email: `${idv}@load.test`, role, organizationId: ORG });
    };
    const adminToken = await addUser(`ld_admin_${ts}`, UserRole.ADMIN_PERSATUAN);
    tokens.push({ role: 'ADMIN_PERSATUAN', token: adminToken });
    for (let c = 0; c < 5; c++) {
      const cls = `ld_cls_${c}_${ts}`;
      await db.query(`INSERT INTO classes (id, organization_id, name, schedule, location, status, approval_status, capacity) VALUES ($1, $2, $3, 'Tue 8pm', 'Hall', 'ACTIVE', 'APPROVED', 60)`,
        [cls, ORG, `Class ${c}`]);
      const mid = `ld_mst_${c}_${ts}`;
      const mt = await addUser(mid, UserRole.MASTER);
      await db.query(`INSERT INTO master_affiliations (id, master_id, organization_id, status) VALUES ($1, $2, $3, 'ACTIVE')`, [`ld_aff_${c}_${ts}`, mid, ORG]);
      await db.query(`INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active) VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE)`,
        [`ld_lead_${c}_${ts}`, cls, mid, ORG]);
      tokens.push({ role: 'MASTER', token: mt });
      for (let s = 0; s < 40; s++) {
        const sid = `ld_stu_${c}_${s}_${ts}`;
        const suid = `ld_su_${c}_${s}_${ts}`;
        const st = await addUser(suid, UserRole.STUDENT);
        await db.query(`INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, status) VALUES ($1, $2, $3, $4, $5, '000000-00-0000', 'ACTIVE')`,
          [sid, ORG, cls, suid, `Student ${c}-${s}`]);
        tokens.push({ role: 'STUDENT', token: st, studentId: sid });
        if (s < 20) {
          const pid = `ld_par_${c}_${s}_${ts}`;
          const pt = await addUser(pid, UserRole.PARENT);
          await db.query(`INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved) VALUES ($1, $2, $3, 'ACTIVE', TRUE, TRUE, TRUE)`,
            [`ld_link_${c}_${s}_${ts}`, pid, sid]);
          tokens.push({ role: 'PARENT', token: pt, studentId: sid });
        }
      }
    }
    console.log(`Seeded 1 Persatuan, 5 classes, 5 Masters, 200 students, 100 parents (synthetic). ${USERS} virtual users for ${SECONDS}s on port ${PORT}.`);

    const scenario = (u: typeof tokens[number], i: number): Array<[string, string, string, unknown?]> => {
      const common: Array<[string, string, string, unknown?]> = [
        ['auth/me', 'GET', '/api/v1/auth/me'],
        ['release/modules', 'GET', '/api/v1/release/modules'],
        ['curriculums/active', 'GET', '/api/v1/curriculums/active'],
        ['assistant/ask', 'POST', '/api/v1/assistant/ask', { query: i % 2 ? 'What is my belt progress?' : 'When is grading?' }],
      ];
      if (u.role === 'MASTER') common.push(['dashboard/master', 'GET', '/api/v1/dashboard/master']);
      if (u.role === 'ADMIN_PERSATUAN') common.push(['classes/organization', 'GET', `/api/v1/classes/organization/${ORG}`]);
      if (u.studentId) common.push(['students/:id', 'GET', `/api/v1/students/${u.studentId}`]);
      return common;
    };

    const deadline = Date.now() + SECONDS * 1000;
    const vus = Array.from({ length: USERS }, (_, i) => tokens[(i * 7) % tokens.length]);
    const started = Date.now();
    await Promise.all(vus.map(async (u, i) => {
      let n = 0;
      while (Date.now() < deadline) {
        const steps = scenario(u, i + n);
        const [name, method, urlPath, body] = steps[n % steps.length];
        const s = await call(method, urlPath, u.token, body);
        (samples[name] ||= []).push(s);
        n += 1;
      }
    }));
    const elapsed = (Date.now() - started) / 1000;

    let total = 0;
    let errors = 0;
    let worstP95 = 0;
    console.log(`\n${'endpoint'.padEnd(22)}${'requests'.padStart(9)}${'errors'.padStart(8)}${'p50 ms'.padStart(9)}${'p95 ms'.padStart(9)}${'p99 ms'.padStart(9)}`);
    for (const [name, list] of Object.entries(samples).sort()) {
      const ms = list.map(s => s.ms);
      const errs = list.filter(s => !s.ok);
      total += list.length;
      errors += errs.length;
      worstP95 = Math.max(worstP95, pct(ms, 95));
      console.log(`${name.padEnd(22)}${String(list.length).padStart(9)}${String(errs.length).padStart(8)}${pct(ms, 50).toFixed(0).padStart(9)}${pct(ms, 95).toFixed(0).padStart(9)}${pct(ms, 99).toFixed(0).padStart(9)}` +
        (errs.length ? `   statuses: ${Array.from(new Set(errs.map(e => e.status))).join(',')}` : ''));
    }
    console.log(`\nTotal ${total} requests in ${elapsed.toFixed(1)}s (${(total / elapsed).toFixed(0)} req/s), errors ${errors} (${((errors / Math.max(1, total)) * 100).toFixed(2)}%), worst p95 ${worstP95.toFixed(0)} ms (budget ${BUDGET_P95_MS} ms).`);
    const pass = errors === 0 && worstP95 <= BUDGET_P95_MS;
    console.log(pass ? '🎉 Load smoke within pilot budget (indicative, single machine).' : '❌ Load smoke outside budget.');
    process.exitCode = pass ? 0 : 1;
  } finally {
    await db.end();
    serverProc.kill('SIGTERM');
    keepAlive.destroy();
  }
}

main().catch(err => { console.error('❌ Load smoke failed:', err instanceof Error ? err.message : err); process.exitCode = 1; });
