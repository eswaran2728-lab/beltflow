/**
 * Security hardening pass (2026-11-15).
 *
 *  A. Passwords: scrypt hashes, constant-time compare, old hashes still
 *     verify and are upgraded at the next sign-in.
 *  B. Sign-in: bad input is a 400, an account locks after repeated wrong
 *     passwords, and failures are recorded.
 *  C. Security events: recorded, readable by Super Admin only, no secrets.
 *  D. Sessions end when the password changes.
 *  E. Password reset: staff-issued one-time codes that expire, work once and
 *     stay inside the Persatuan.
 *  F. Response headers; API responses are never cached.
 *  G. HTTPS is required in production.
 *  H. Production configuration is checked in one place.
 *  I. Only the web client's own files are served as static files.
 *  J. Rate limiter: limits, and forgets old entries.
 *  K. Server errors never echo raw exception text in route code.
 * Synthetic data only.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken, hashPasswordServer, verifyPasswordServer, passwordNeedsRehash } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { rateLimit } from '../middleware/rateLimit';
import { insecureRequestBlocked } from '../middleware/httpsOnly';
import { validateProductionEnv } from '../config/validateEnv';

type Res = { status: number; data: any; headers: http.IncomingHttpHeaders };
function request(server: http.Server, method: string, urlPath: string, token?: string, body?: any, extraHeaders: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close', ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    const full = urlPath.startsWith('/api') || urlPath === '/' || urlPath.startsWith('/_') ? urlPath : `/api/v1${urlPath}`;
    const req = http.request({ host: '127.0.0.1', port: addr.port, path: full, method, headers }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw), headers: res.headers }); } catch { resolve({ status: res.statusCode || 0, data: raw, headers: res.headers }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const raw = (server: http.Server, urlPath: string) => new Promise<number>((resolve, reject) => {
  const addr = server.address() as any;
  http.get({ host: '127.0.0.1', port: addr.port, path: urlPath, headers: { Connection: 'close' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode || 0)); }).on('error', reject);
});

async function runTests() {
  console.log('🛡️  Starting security hardening tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-sec-hard-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const q = (sql: string, p: any[] = []) => dbClient.query(sql, p);
  const PASSWORD = 'Test-Password-0001';

  try {
    // ------------------------------------------------------------------ A
    const hashed = hashPasswordServer(PASSWORD);
    assert.ok(hashed.startsWith('scrypt$'), 'new hashes use scrypt');
    assert.notEqual(hashed, hashPasswordServer(PASSWORD), 'every hash has its own salt');
    assert.equal(verifyPasswordServer(PASSWORD, hashed), true);
    assert.equal(verifyPasswordServer('Wrong-Password-0001', hashed), false);
    assert.equal(passwordNeedsRehash(hashed), false);
    const legacySalt = crypto.randomBytes(16).toString('hex');
    const legacyPbkdf2 = `${legacySalt}:${crypto.pbkdf2Sync(PASSWORD, legacySalt, 10000, 64, 'sha256').toString('hex')}`;
    assert.equal(verifyPasswordServer(PASSWORD, legacyPbkdf2), true, 'old PBKDF2 hashes still verify');
    assert.equal(passwordNeedsRehash(legacyPbkdf2), true);
    const legacySha = crypto.createHash('sha256').update(PASSWORD).digest('hex');
    assert.equal(verifyPasswordServer(PASSWORD, legacySha), true, 'oldest unsalted hashes still verify (to be upgraded)');
    assert.equal(passwordNeedsRehash(legacySha), true);
    assert.equal(verifyPasswordServer(PASSWORD, ''), false);
    assert.equal(verifyPasswordServer(PASSWORD, 'scrypt$broken'), false, 'a malformed hash is a clean false');
    console.log('✅ A: scrypt hashing; old hashes verify and are flagged for upgrade.');

    // ------------------------------------------------------------------ fixtures
    for (const org of ['org_sh_a', 'org_sh_b']) {
      await q(`INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
               VALUES ($1, $2, 'Selangor', 'Silat', 'Test', '0100000000', $3, 'ACTIVE') ON CONFLICT (id) DO NOTHING`, [org, `Test ${org}`, `${org}@example.test`]);
    }
    const users: Array<[string, string, string | null, string]> = [
      ['sh_super', 'SUPER_ADMIN', null, hashed], ['sh_adm_a', 'ADMIN_PERSATUAN', 'org_sh_a', hashed], ['sh_adm_b', 'ADMIN_PERSATUAN', 'org_sh_b', hashed],
      ['sh_par_a', 'PARENT', 'org_sh_a', legacyPbkdf2], ['sh_par_lock', 'PARENT', 'org_sh_a', hashed], ['sh_par_reset', 'PARENT', 'org_sh_a', hashed],
      ['sh_par_b', 'PARENT', 'org_sh_b', hashed],
    ];
    for (const [id, role, org, hash] of users) {
      await q(`INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, hash, `Test ${id}`, role, org]);
    }
    const tok = (id: string, role: UserRole, org?: string) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const tSuper = tok('sh_super', UserRole.SUPER_ADMIN);
    const tAdmA = tok('sh_adm_a', UserRole.ADMIN_PERSATUAN, 'org_sh_a');
    const tAdmB = tok('sh_adm_b', UserRole.ADMIN_PERSATUAN, 'org_sh_b');
    const login = (email: any, password: any, ip = '198.51.100.1') => request(server, 'POST', '/auth/login', undefined, { email, password }, { 'X-Test-Client': ip });

    // ------------------------------------------------------------------ B
    assert.equal((await login({ $ne: '' }, PASSWORD)).status, 400, 'a non-text email is refused, not a server error');
    assert.equal((await login('sh_par_a@example.test', ['x'])).status, 400);
    const upgraded = await login('sh_par_a@example.test', PASSWORD);
    assert.equal(upgraded.status, 200, JSON.stringify(upgraded.data));
    const stored = (await q(`SELECT password_hash FROM users WHERE id = 'sh_par_a'`)).rows[0].password_hash;
    assert.ok(stored.startsWith('scrypt$'), 'an old hash is upgraded at sign-in');

    let lastFail: Res | null = null;
    for (let i = 0; i < 10; i++) lastFail = await login('sh_par_lock@example.test', 'Wrong-Password-0001');
    assert.equal(lastFail!.status, 401);
    const locked = await login('sh_par_lock@example.test', PASSWORD);
    assert.equal(locked.status, 429, `the account is locked after repeated failures, even with the right password: ${JSON.stringify(locked.data)}`);
    assert.equal(locked.data.code, 'ACCOUNT_LOCKED');
    assert.ok(!JSON.stringify(locked.data).includes('sh_par_lock'), 'the lock message does not confirm the account');
    await q(`UPDATE users SET locked_until = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = 'sh_par_lock'`);
    assert.equal((await login('sh_par_lock@example.test', PASSWORD)).status, 200, 'the lock ends by itself');
    const unknown = await login('nobody@example.test', PASSWORD);
    assert.equal(unknown.status, 401);
    assert.equal(unknown.data.error, lastFail!.data.error, 'unknown account and wrong password look the same');
    console.log('✅ B: sign-in validates input, locks after repeated failures, and upgrades old hashes.');

    // ------------------------------------------------------------------ C
    const events = await request(server, 'GET', '/security/events?limit=200', tSuper);
    assert.equal(events.status, 200, JSON.stringify(events.data));
    const types = new Set(events.data.events.map((e: any) => e.type));
    assert.ok(types.has('LOGIN_FAILED') && types.has('ACCOUNT_LOCKED'), `failures and lockouts are recorded: ${[...types].join(',')}`);
    assert.ok(!JSON.stringify(events.data).includes('Wrong-Password-0001') && !JSON.stringify(events.data).includes(PASSWORD), 'no password is ever recorded');
    assert.equal((await request(server, 'GET', '/security/events', tAdmA)).status, 403, 'only Super Admin reads security events');
    assert.equal((await request(server, 'GET', '/security/events')).status, 401);
    await request(server, 'GET', '/security/events', 'not-a-real-token');
    const after = await request(server, 'GET', '/security/events?limit=200', tSuper);
    assert.ok(after.data.events.some((e: any) => e.type === 'ACCESS_DENIED'), 'refused requests are recorded');
    assert.ok(typeof after.data.summary?.last24h === 'object', 'a summary by type is included');
    console.log('✅ C: security events are recorded and visible to Super Admin only.');

    // ------------------------------------------------------------------ D
    const session = await login('sh_par_b@example.test', PASSWORD);
    assert.equal(session.status, 200);
    const oldToken = session.data.token as string;
    assert.equal((await request(server, 'GET', '/auth/me', oldToken)).status, 200);
    await new Promise(r => setTimeout(r, 1100)); // token timestamps have 1-second resolution
    const NEW_PASSWORD = 'Test-Password-0002';
    const changed = await request(server, 'POST', '/auth/change-password', oldToken, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.ok(changed.data.token, 'the caller gets a fresh session');
    assert.notEqual((await request(server, 'GET', '/auth/me', oldToken)).status, 200, 'sessions from before the change stop working');
    assert.equal((await request(server, 'GET', '/auth/me', changed.data.token)).status, 200);
    console.log('✅ D: changing the password ends older sessions.');

    // ------------------------------------------------------------------ E
    const issueOther = await request(server, 'POST', '/auth/password-reset/issue', tAdmB, { userId: 'sh_par_reset' });
    assert.equal(issueOther.status, 403, 'another Persatuan\'s Admin cannot issue a reset');
    assert.equal((await request(server, 'POST', '/auth/password-reset/issue', tAdmA, { userId: 'sh_adm_a' })).status, 403, 'an Admin cannot reset an Admin');
    const issued = await request(server, 'POST', '/auth/password-reset/issue', tAdmA, { userId: 'sh_par_reset' });
    assert.equal(issued.status, 201, JSON.stringify(issued.data));
    const code = issued.data.code as string;
    assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), 'a one-time code is shown once');
    const storedCode = await q(`SELECT token_hash, expires_at FROM password_reset_tokens WHERE user_id = 'sh_par_reset'`);
    assert.ok(!storedCode.rows.some((r: any) => r.token_hash.includes(code.replace(/-/g, ''))), 'only a hash of the code is stored');
    const minutes = (new Date(storedCode.rows[0].expires_at).getTime() - Date.now()) / 60000;
    assert.ok(minutes > 25 && minutes <= 30.5, `the code expires in 30 minutes (got ${minutes.toFixed(1)})`);
    const complete = (c: string, pw: string) => request(server, 'POST', '/auth/password-reset/complete', undefined, { email: 'sh_par_reset@example.test', code: c, newPassword: pw });
    assert.equal((await complete('AAAA-BBBB-CCCC', NEW_PASSWORD)).status, 400, 'a wrong code is refused');
    assert.equal((await complete(code, 'short')).status, 400, 'the password policy still applies');
    await q(`UPDATE password_reset_tokens SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE user_id = 'sh_par_reset'`);
    assert.equal((await complete(code, NEW_PASSWORD)).status, 400, 'an expired code is refused');
    const issued2 = await request(server, 'POST', '/auth/password-reset/issue', tAdmA, { userId: 'sh_par_reset' });
    const code2 = issued2.data.code as string;
    assert.equal((await complete(code2, NEW_PASSWORD)).status, 200);
    assert.equal((await complete(code2, 'Test-Password-0003')).status, 400, 'a code works once');
    assert.equal((await login('sh_par_reset@example.test', NEW_PASSWORD)).status, 200);
    assert.equal((await login('sh_par_reset@example.test', PASSWORD)).status, 401);
    console.log('✅ E: reset codes are hashed, expire in 30 minutes, work once and stay inside the Persatuan.');

    // ------------------------------------------------------------------ F
    const health = await request(server, 'GET', '/api/health');
    assert.equal(health.headers['x-powered-by'], undefined, 'the server does not advertise its framework');
    assert.equal(health.headers['x-content-type-options'], 'nosniff');
    assert.equal(health.headers['x-frame-options'], 'DENY');
    const me = await request(server, 'GET', '/auth/me', changed.data.token);
    assert.ok(String(me.headers['cache-control']).includes('no-store'), 'API responses are never cached');
    assert.ok(String(me.headers['content-security-policy']).includes("default-src 'none'"), 'API responses carry a locked-down CSP');
    console.log('✅ F: security headers present; API responses are not cached.');

    // ------------------------------------------------------------------ G
    const prod = { NODE_ENV: 'production' };
    assert.equal(insecureRequestBlocked({ path: '/api/v1/auth/login', secure: false, forwardedProto: 'http' }, prod), true, 'plain HTTP is refused in production');
    assert.equal(insecureRequestBlocked({ path: '/api/v1/auth/login', secure: false, forwardedProto: 'https' }, prod), false);
    assert.equal(insecureRequestBlocked({ path: '/api/v1/auth/login', secure: true, forwardedProto: undefined }, prod), false);
    assert.equal(insecureRequestBlocked({ path: '/api/health', secure: false, forwardedProto: undefined }, prod), false, 'health probes inside the network still work');
    assert.equal(insecureRequestBlocked({ path: '/api/v1/auth/login', secure: false, forwardedProto: 'http' }, {}), false, 'development is not affected');
    assert.equal(insecureRequestBlocked({ path: '/api/v1/auth/login', secure: false, forwardedProto: 'http' }, { NODE_ENV: 'production', ALLOW_INSECURE_HTTP: 'true' }), false);
    console.log('✅ G: HTTPS is required in production.');

    // ------------------------------------------------------------------ H
    const bad = validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: 'short', DATABASE_SSL: 'disable' });
    for (const name of ['JWT_SECRET', 'MEDIA_STORAGE_SECRET', 'CORS_ALLOWED_ORIGINS', 'DATABASE_URL', 'QR_ED25519_PRIVATE_KEY_SEED', 'DATABASE_SSL']) {
      assert.ok(bad.some(p => p.includes(name)), `${name} is reported: ${bad.join(' | ')}`);
    }
    const strong = 'k'.repeat(48);
    const good = validateProductionEnv({
      NODE_ENV: 'production', JWT_SECRET: strong, MEDIA_STORAGE_SECRET: strong + '2', CORS_ALLOWED_ORIGINS: 'https://app.example.test',
      DATABASE_URL: 'postgres://db.example.test/beltflow', QR_ED25519_PRIVATE_KEY_SEED: strong + '3', QR_ED25519_PREVIOUS_SEED: strong + '4',
    });
    assert.deepEqual(good, [], `a complete configuration passes: ${good.join(' | ')}`);
    assert.ok(validateProductionEnv({ ...{ NODE_ENV: 'production', JWT_SECRET: strong, MEDIA_STORAGE_SECRET: strong, CORS_ALLOWED_ORIGINS: '*', DATABASE_URL: 'postgres://x/y', QR_ED25519_PRIVATE_KEY_SEED: strong + '3', QR_ED25519_PREVIOUS_SEED: strong + '4' } })
      .some(p => p.includes('CORS_ALLOWED_ORIGINS') || p.includes('same value')), 'wildcard origins and reused secrets are reported');
    assert.deepEqual(validateProductionEnv({}), [], 'development needs nothing');
    assert.ok(!bad.join(' ').includes('short'), 'values are never printed');
    console.log('✅ H: production configuration is validated in one place, without printing values.');

    // ------------------------------------------------------------------ I
    for (const p of ['/server/src/app.ts', '/server/package.json', '/mobile/package.json', '/docs/claude-handover/01_PROJECT_OVERVIEW.md', '/scripts/db/backup.sh',
      '/CLAUDE.md', '/README.md', '/.github/workflows/mobile_apk.yml', '/scratch/test_receipt_integrity.js', '/build.gradle.kts', '/package.json', '/uploads/pasted-1788411041725-0.png']) {
      assert.equal(await raw(server, p), 404, `${p} is not served`);
    }
    for (const p of ['/', '/index.html', '/manifest.json', '/sw.js', '/assets/beltflow-logo.png', '/.well-known/assetlinks.json']) {
      assert.equal(await raw(server, p), 200, `${p} is served`);
    }
    console.log('✅ I: only the web client\'s own files are served.');

    // ------------------------------------------------------------------ J
    const limiter = rateLimit({ windowMs: 60_000, max: 3, name: 'test' });
    const run = (ip: string, p = '/x') => new Promise<number>(resolve => {
      const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json() { resolve(this.statusCode); }, setHeader() { /* noop */ } };
      limiter({ ip, path: p, method: 'GET', headers: {} } as any, res, () => resolve(200));
    });
    assert.deepEqual([await run('1.1.1.1'), await run('1.1.1.1'), await run('1.1.1.1'), await run('1.1.1.1')], [200, 200, 200, 429]);
    assert.equal(await run('2.2.2.2'), 200, 'another address is unaffected');
    for (let i = 0; i < 12000; i++) await run(`10.0.${Math.floor(i / 250)}.${i % 250}`, '/y');
    assert.ok(limiter.size() <= 10000, `the limiter forgets old entries (size ${limiter.size()})`);
    console.log('✅ J: rate limiter limits per address and bounds its memory.');

    // ------------------------------------------------------------------ K
    const routesDir = path.resolve(__dirname, '../../src/routes');
    const leaks: string[] = [];
    for (const f of fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))) {
      fs.readFileSync(path.join(routesDir, f), 'utf8').split('\n').forEach((line, i) => {
        if (/status\(5\d\d\)\.json\(\{[^}]*(error|message):\s*(err|error|e)\.message/.test(line)) leaks.push(`${f}:${i + 1}`);
      });
    }
    assert.deepEqual(leaks, [], `5xx responses must use safeErrorMessage: ${leaks.join(', ')}`);
    console.log('✅ K: server errors do not echo raw exception text.');

    console.log('\n🎉 Security hardening tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Security hardening tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runSecurityHardeningTests };
