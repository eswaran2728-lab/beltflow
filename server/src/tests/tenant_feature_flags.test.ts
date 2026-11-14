/**
 * Per-tenant feature enablement (PDF: "enable feature by tenant"; guardrail:
 * "tenant-specific PostgreSQL records and authorized admin editing").
 *
 *  - Each optional module can be ON, OFF or inherit for one Persatuan.
 *  - The platform release is the ceiling: ON cannot enable a module the
 *    release or a kill switch has turned off.
 *  - BELTFLOW_TENANT_OPT_IN_MODULES lists modules that stay off for every
 *    Persatuan until switched ON for it (staged rollout / pilots).
 *  - Enforced on the server for that Persatuan's users (404 MODULE_DISABLED);
 *    other Persatuans are unaffected; changes apply immediately.
 *  - Only Super Admin can change settings; every change is audited.
 *  - GET /release/modules returns the caller's effective modules.
 * Synthetic data only.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

type Res = { status: number; data: any };
function request(server: http.Server, method: string, urlPath: string, token?: string, body?: any): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port: addr.port, path: `/api/v1${urlPath}`, method, headers }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode || 0, data: raw }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🎚️  Starting per-tenant feature flag tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-tenant-flags-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const saved = { release: process.env.BELTFLOW_RELEASE, disabled: process.env.BELTFLOW_DISABLED_MODULES, optIn: process.env.BELTFLOW_TENANT_OPT_IN_MODULES };
  delete process.env.BELTFLOW_RELEASE;
  delete process.env.BELTFLOW_DISABLED_MODULES;
  delete process.env.BELTFLOW_TENANT_OPT_IN_MODULES;

  try {
    for (const org of ['org_tf_a', 'org_tf_b']) {
      await dbClient.query(
        `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
         VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3) ON CONFLICT (id) DO NOTHING`, [org, `Test ${org}`, `${org}@example.test`]);
    }
    const users: Array<[string, string, string | null]> = [
      ['tf_sa', 'SUPER_ADMIN', null], ['tf_adm_a', 'ADMIN_PERSATUAN', 'org_tf_a'],
      ['tf_par_a', 'PARENT', 'org_tf_a'], ['tf_par_b', 'PARENT', 'org_tf_b'],
    ];
    for (const [id, role, org] of users) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, org]);
    }
    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const tSA = tok('tf_sa', UserRole.SUPER_ADMIN);
    const tAdmA = tok('tf_adm_a', UserRole.ADMIN_PERSATUAN, 'org_tf_a');
    const tParA = tok('tf_par_a', UserRole.PARENT, 'org_tf_a');
    const tParB = tok('tf_par_b', UserRole.PARENT, 'org_tf_b');
    // A token claiming another Persatuan does not help: the gate uses the account's Persatuan in the database.
    const tParAForged = tok('tf_par_a', UserRole.PARENT, 'org_tf_b');

    const probe = (t: string) => request(server, 'GET', '/messaging/threads', t);
    const disabled = (r: Res) => r.status === 404 && r.data?.code === 'MODULE_DISABLED';
    const modulesOf = async (t?: string) => (await request(server, 'GET', '/release/modules', t)).data.enabledModules as string[];

    // ------------------------------------------------ default: inherit
    assert.ok(!disabled(await probe(tParA)), 'messaging reachable by default');
    assert.ok((await modulesOf(tParA)).includes('messaging'));

    // ------------------------------------------------ only Super Admin edits
    const byAdmin = await request(server, 'PUT', '/release/tenants/org_tf_a/modules/messaging', tAdmA, { setting: 'OFF' });
    assert.equal(byAdmin.status, 403, 'an Admin Persatuan cannot change module settings, even for their own Persatuan');
    const byParent = await request(server, 'GET', '/release/tenants/org_tf_a/modules', tParA);
    assert.equal(byParent.status, 403);
    assert.equal((await request(server, 'PUT', '/release/tenants/org_tf_a/modules/attendance', tSA, { setting: 'OFF' })).status, 400, 'core R1 modules cannot be switched off');
    assert.equal((await request(server, 'PUT', '/release/tenants/org_tf_a/modules/messaging', tSA, { setting: 'MAYBE' })).status, 400);
    assert.equal((await request(server, 'PUT', '/release/tenants/org_missing/modules/messaging', tSA, { setting: 'OFF' })).status, 404);

    // ------------------------------------------------ OFF for one Persatuan
    const off = await request(server, 'PUT', '/release/tenants/org_tf_a/modules/messaging', tSA, { setting: 'OFF' });
    assert.equal(off.status, 200, JSON.stringify(off.data));
    assert.ok(disabled(await probe(tParA)), 'Persatuan A users are refused immediately');
    assert.ok(disabled(await probe(tParAForged)), 'a token claiming another Persatuan does not bypass it');
    assert.ok(!disabled(await probe(tParB)), 'Persatuan B is unaffected');
    assert.ok(!(await modulesOf(tParA)).includes('messaging'), 'A no longer sees messaging in its module list');
    assert.ok((await modulesOf(tParB)).includes('messaging'));
    assert.ok((await modulesOf()).includes('messaging'), 'the anonymous list is the platform list');
    const listA = await request(server, 'GET', '/release/tenants/org_tf_a/modules', tSA);
    assert.equal(listA.status, 200);
    const msgRow = listA.data.modules.find((m: any) => m.key === 'messaging');
    assert.deepEqual({ setting: msgRow.setting, platformEnabled: msgRow.platformEnabled, effective: msgRow.effective }, { setting: 'OFF', platformEnabled: true, effective: false });
    const audit = await dbClient.query(`SELECT details FROM audit_logs WHERE action = 'Tenant Module Setting Changed' AND details LIKE '%org_tf_a%messaging%OFF%'`);
    assert.ok(audit.rows.length >= 1, 'the change is audited');
    console.log('✅ OFF applies to one Persatuan only, immediately, cannot be bypassed with a token claim, and is audited.');

    // ------------------------------------------------ back to inherit
    assert.equal((await request(server, 'PUT', '/release/tenants/org_tf_a/modules/messaging', tSA, { setting: 'INHERIT' })).status, 200);
    assert.ok(!disabled(await probe(tParA)), 'inherit restores the platform setting');

    // ------------------------------------------------ staged rollout
    process.env.BELTFLOW_TENANT_OPT_IN_MODULES = 'messaging';
    assert.ok(disabled(await probe(tParA)) && disabled(await probe(tParB)), 'opt-in modules start off for every Persatuan');
    assert.equal((await request(server, 'PUT', '/release/tenants/org_tf_b/modules/messaging', tSA, { setting: 'ON' })).status, 200);
    assert.ok(!disabled(await probe(tParB)), 'the pilot Persatuan gets it');
    assert.ok(disabled(await probe(tParA)), 'others still do not');
    delete process.env.BELTFLOW_TENANT_OPT_IN_MODULES;
    console.log('✅ Staged rollout: opt-in modules are off until switched ON per Persatuan.');

    // ------------------------------------------------ platform is the ceiling
    process.env.BELTFLOW_DISABLED_MODULES = 'messaging';
    assert.ok(disabled(await probe(tParB)), 'ON cannot override a platform kill switch');
    const listB = await request(server, 'GET', '/release/tenants/org_tf_b/modules', tSA);
    const rowB = listB.data.modules.find((m: any) => m.key === 'messaging');
    assert.deepEqual({ setting: rowB.setting, platformEnabled: rowB.platformEnabled, effective: rowB.effective }, { setting: 'ON', platformEnabled: false, effective: false });
    delete process.env.BELTFLOW_DISABLED_MODULES;
    console.log('✅ The platform release and kill switches remain the ceiling.');

    // Super Admin (no Persatuan) is governed by the platform setting only.
    assert.ok((await modulesOf(tSA)).includes('messaging'));

    console.log('\n🎉 Per-tenant feature flag tests PASSED.');
  } finally {
    for (const [k, v] of Object.entries({ BELTFLOW_RELEASE: saved.release, BELTFLOW_DISABLED_MODULES: saved.disabled, BELTFLOW_TENANT_OPT_IN_MODULES: saved.optIn })) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Per-tenant feature flag tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runTenantFeatureFlagTests };
