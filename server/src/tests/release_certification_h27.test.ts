/**
 * Official Task H27 — Advanced Release Certification
 * Acceptance test: disabled_module_inaccessible
 *
 * Releases (governing PDF): R1 core academy; R2 teaching and retention;
 * R3 events and commerce; R4 assisted operations (AI). A deployment set to
 * a release must make every module of a later release unreachable for every
 * role, while keeping earlier releases working. BELTFLOW_DISABLED_MODULES
 * switches individual modules off (rollback by feature disablement).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { RELEASE_MODULES, enabledModuleKeys, resolveReleaseLevel } from '../release/modules';

type Res = { status: number; data: any };

function request(server: http.Server, method: string, urlPath: string, token?: string, body?: any): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Connection: 'close' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = String(Buffer.byteLength(payload));
    const req = http.request({ host: '127.0.0.1', port: addr.port, path: urlPath, method, headers }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode || 0, data: raw }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** One representative call per gated module. */
const PROBES: Record<string, Array<[string, string]>> = {
  trials: [['GET', '/api/v1/trials/follow-ups'], ['POST', '/api/v1/trials/book']],
  bookings: [['GET', '/api/v1/bookings/sessions/x'], ['POST', '/api/v1/bookings/waitlist/sweep-expired']],
  transfers: [['GET', '/api/v1/transfers/pending'], ['POST', '/api/v1/memberships/pause']],
  teaching: [['GET', '/api/v1/teaching/sessions/x/lesson-plan']],
  family: [['GET', '/api/v1/family/children']],
  learning: [['GET', '/api/v1/learning/lessons']],
  media: [['POST', '/api/v1/media/videos/presign']],
  tournaments: [['GET', '/api/v1/tournaments/organization/x'], ['POST', '/api/v1/tournaments']],
  analytics: [['GET', '/api/v1/analytics/metrics']],
  messaging: [['GET', '/api/v1/messaging/threads']],
  commerce: [['GET', '/api/v1/commerce/products']],
  assistant: [['POST', '/api/v1/assistant/ask']],
};

/** Core (R1) calls that must never be disabled by a release setting. */
const CORE_PROBES: Array<[string, string]> = [
  ['GET', '/api/v1/auth/me'],
  ['GET', '/api/v1/classes/organization/org_h27'],
  ['GET', '/api/v1/curriculums/active'],
  ['GET', '/api/health'],
];

async function runTests() {
  console.log('🥋 Starting Task H27: release certification (disabled_module_inaccessible)...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-h27-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const saved = { release: process.env.BELTFLOW_RELEASE, disabled: process.env.BELTFLOW_DISABLED_MODULES, ai: process.env.AI_ASSISTANT_ENABLED };

  try {
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ('org_h27', 'H27 Persatuan', 'Selangor', 'Silambam', 'Guru', '0100000000', 'h27@test.local', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`);
    const users: Array<[string, UserRole, string | undefined]> = [
      ['h27_sa', UserRole.SUPER_ADMIN, undefined], ['h27_adm', UserRole.ADMIN_PERSATUAN, 'org_h27'],
      ['h27_mst', UserRole.MASTER, 'org_h27'], ['h27_par', UserRole.PARENT, 'org_h27'], ['h27_stu', UserRole.STUDENT, 'org_h27'],
    ];
    for (const [id, role, org] of users) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`, [id, `${id}@test.local`, `User ${id}`, role, org || null]);
    }
    const tokens = users.map(([id, role, org]) => generateAuthToken({ id, email: `${id}@test.local`, role, organizationId: org }));
    const callers: Array<string | undefined> = [undefined, ...tokens];

    // ------------------------------------------------ registry completeness
    const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
    const mounted = Array.from(appSource.matchAll(/app\.use\('(\/api\/v1[^']*)'/g)).map(m => m[1]);
    const gatedMounts = RELEASE_MODULES.flatMap(m => m.mounts);
    const coreMounts = mounted.filter(p => !gatedMounts.includes(p));
    for (const mount of gatedMounts) assert.ok(mounted.includes(mount), `registry mount ${mount} exists in app`);
    for (const mod of RELEASE_MODULES) {
      for (const mount of mod.mounts) {
        assert.match(appSource, new RegExp(`app\\.use\\('${mount.replace(/\//g, '\\/')}',\\s*\\(0,\\s*modules_1\\.moduleGate\\)\\('${mod.key}'\\)`),
          `${mount} is mounted behind moduleGate('${mod.key}')`);
      }
    }
    assert.deepEqual(Object.keys(PROBES).sort(), RELEASE_MODULES.map(m => m.key).sort(), 'every gated module has probes');
    console.log(`✅ Registry: ${RELEASE_MODULES.length} gated modules, ${coreMounts.length} core (R1) mounts, every gated mount wrapped.`);

    const expectDisabled = async (key: string, label: string) => {
      for (const [method, url] of PROBES[key]) {
        for (const tok of callers) {
          const res = await request(server, method, url, tok, method === 'POST' ? {} : undefined);
          assert.equal(res.status, 404, `${label}: ${method} ${url} must be 404 (got ${res.status})`);
          assert.equal(res.data?.code, 'MODULE_DISABLED', `${label}: ${method} ${url} code`);
        }
      }
    };
    const expectEnabled = async (key: string, label: string) => {
      for (const [method, url] of PROBES[key]) {
        const res = await request(server, method, url, tokens[1], method === 'POST' ? {} : undefined);
        assert.notEqual(res.data?.code, 'MODULE_DISABLED', `${label}: ${method} ${url} must reach the module`);
      }
    };
    const expectCoreWorks = async (label: string) => {
      for (const [method, url] of CORE_PROBES) {
        const res = await request(server, method, url, tokens[1]);
        assert.notEqual(res.data?.code, 'MODULE_DISABLED', `${label}: core ${url} must stay enabled`);
        assert.ok(res.status < 500, `${label}: core ${url} healthy (got ${res.status})`);
      }
    };

    // ------------------------------------------- per-release certification
    delete process.env.BELTFLOW_DISABLED_MODULES;
    delete process.env.AI_ASSISTANT_ENABLED;
    for (const level of ['R1', 'R2', 'R3', 'R4'] as const) {
      process.env.BELTFLOW_RELEASE = level;
      const rank = Number(level[1]);
      for (const mod of RELEASE_MODULES) {
        if (Number(mod.release[1]) <= rank) await expectEnabled(mod.key, `${level}/${mod.key}`);
        else await expectDisabled(mod.key, `${level}/${mod.key}`);
      }
      await expectCoreWorks(level);
      const info = await request(server, 'GET', '/api/v1/release/modules');
      assert.equal(info.status, 200, 'module list is public');
      assert.equal(info.data.release, level);
      assert.deepEqual([...info.data.enabledModules].sort(), enabledModuleKeys().sort());
      assert.ok(!JSON.stringify(info.data).includes('org_h27'), 'module list contains no tenant data');
      console.log(`✅ ${level}: ${info.data.enabledModules.length} optional modules enabled; later-release modules return 404 MODULE_DISABLED for all roles.`);
    }

    // ---------------------------------------------- kill switches (rollback)
    process.env.BELTFLOW_RELEASE = 'R4';
    process.env.BELTFLOW_DISABLED_MODULES = 'messaging, commerce';
    await expectDisabled('messaging', 'kill switch');
    await expectDisabled('commerce', 'kill switch');
    await expectEnabled('tournaments', 'kill switch leaves others');
    await expectEnabled('assistant', 'kill switch leaves others');
    process.env.BELTFLOW_DISABLED_MODULES = 'auth,classes';
    await expectCoreWorks('core cannot be switched off');
    delete process.env.BELTFLOW_DISABLED_MODULES;
    process.env.AI_ASSISTANT_ENABLED = 'false';
    await expectDisabled('assistant', 'legacy AI flag');
    delete process.env.AI_ASSISTANT_ENABLED;
    console.log('✅ Kill switches disable single modules; core modules cannot be disabled; AI_ASSISTANT_ENABLED=false still works.');

    // --------------------------------------------------- fail-closed config
    assert.equal(resolveReleaseLevel(undefined), 'R4', 'unset keeps the current full release');
    assert.equal(resolveReleaseLevel('r2'), 'R2');
    assert.equal(resolveReleaseLevel('R9'), 'R1', 'unknown value fails closed to core only');
    assert.equal(resolveReleaseLevel('everything'), 'R1');
    process.env.BELTFLOW_RELEASE = 'banana';
    await expectDisabled('assistant', 'invalid release value');
    await expectDisabled('trials', 'invalid release value');
    await expectCoreWorks('invalid release value');
    console.log('✅ Invalid release settings fail closed to R1 (core only).');

    console.log('\n🎉 H27 acceptance test disabled_module_inaccessible PASSED.');
  } finally {
    if (saved.release === undefined) delete process.env.BELTFLOW_RELEASE; else process.env.BELTFLOW_RELEASE = saved.release;
    if (saved.disabled === undefined) delete process.env.BELTFLOW_DISABLED_MODULES; else process.env.BELTFLOW_DISABLED_MODULES = saved.disabled;
    if (saved.ai === undefined) delete process.env.AI_ASSISTANT_ENABLED; else process.env.AI_ASSISTANT_ENABLED = saved.ai;
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ H27 release certification test failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runH27ReleaseTests };
