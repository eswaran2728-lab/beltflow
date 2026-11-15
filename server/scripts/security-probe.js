// Live security probe of a running BeltFlow TEST server (seeded with npm run seed:test).
// It attacks the server on purpose: never point it at production.
// Usage: node scripts/security-probe.js http://127.0.0.1:4000
const base = process.argv[2] || 'http://127.0.0.1:4100';
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); };
const call = async (method, path, { token, body, headers = {}, raw } = {}) => {
  const h = { ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers, text };
};
const login = (email, password) => call('POST', '/api/v1/auth/login', { body: { email, password } });
const PW = 'TestPass2026!';

(async () => {
  const superToken = (await login('superadmin@beltflow.test', PW)).data.token;
  // 1. SQL injection in sign-in
  for (const payload of ["' OR '1'='1", "admin@selangor.silambam.test' --", "'; DROP TABLE users; --"]) {
    const r = await login(payload, payload);
    check('SQL injection in sign-in refused: ' + payload.slice(0, 18), r.status === 401 || r.status === 400, 'status ' + r.status);
  }
  const still = await login('parent.suresh@family.test', PW);
  check('Database intact after injection attempts (real sign-in works)', still.status === 200, 'status ' + still.status);
  const parent = still.data.token;

  // 2. Object / array injection
  check('Non-text credentials refused', (await login({ $gt: '' }, { $gt: '' })).status === 400);

  // 3. Forged and tampered tokens
  const parts = parent.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.role = 'SUPER_ADMIN';
  const tampered = parts[0] + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + parts[2];
  check('Tampered token (role changed to SUPER_ADMIN) refused', (await call('GET', '/api/v1/auth/me', { token: tampered })).status >= 401);
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.';
  check('Unsigned "alg: none" token refused', (await call('GET', '/api/v1/auth/me', { token: none })).status >= 401);
  check('No token refused', (await call('GET', '/api/v1/auth/me')).status === 401);

  // 4. Admin routes with a parent account
  const adminProbes = [
    ['GET', '/api/v1/security/events'], ['GET', '/api/v1/release/tenants/org_selangor_silambam/modules'],
    ['PUT', '/api/v1/payments/merchant/my-config'], ['POST', '/api/v1/auth/password-reset/issue'],
    ['GET', '/api/v1/analytics/overview'], ['POST', '/api/v1/commerce/products'],
  ];
  for (const [m, p] of adminProbes) {
    const r = await call(m, p, { token: parent, body: m === 'GET' ? undefined : { userId: 'x' } });
    check('Parent refused on ' + m + ' ' + p, [401, 403, 404].includes(r.status), 'status ' + r.status);
  }

  // 5. Other family's child
  const me = await call('GET', '/api/v1/auth/me', { token: parent });
  const own = (still.data.user.linkedStudentIds || [])[0];
  const student = await login('student.aryan@beltflow.test', PW);
  check('Parent can read own child', own ? (await call('GET', '/api/v1/students/' + own, { token: parent })).status === 200 : false, own || 'no linked child');
  check('Parent refused on a made-up student id', (await call('GET', '/api/v1/students/stu_does_not_exist', { token: parent })).status >= 403);

  // 6. Exposed files
  for (const p of ['/.env', '/server/.env', '/.git/config', '/server/src/app.ts', '/package.json', '/docs/claude-handover/12_SECURITY_REVIEW_2026-11-14.md',
    '/scripts/db/backup.sh', '/..%2f..%2fetc/passwd', '/assets/..%2f..%2fserver/package.json', '/mobile/app.json', '/release.keystore.base64', '/server/.beltflow_pgdata/PG_VERSION']) {
    const r = await call('GET', p);
    check('Not served: ' + p, r.status === 404, 'status ' + r.status);
  }

  // 7. Headers
  const h = (await call('GET', '/api/v1/auth/me', { token: parent })).headers;
  check('No X-Powered-By header', !h.get('x-powered-by'));
  check('nosniff, frame DENY, no-store, CSP present on API', h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY' && /no-store/.test(h.get('cache-control') || '') && /default-src 'none'/.test(h.get('content-security-policy') || ''));

  // 8. XSS payload is returned as data, not as a page
  const x = await call('POST', '/api/v1/auth/login', { body: { email: '<script>alert(1)</script>@x.test', password: 'x' } });
  check('Script payload answered as JSON, never HTML', /application\/json/.test(x.headers.get('content-type') || '') && !/<script>/.test(x.text));

  // 9. Oversized JSON body
  const big = await call('POST', '/api/v1/auth/login', { body: { email: 'a@b.test', password: 'x'.repeat(400000) } });
  check('Oversized request body refused', big.status === 413 || big.status === 400, 'status ' + big.status);

  // 10. Errors do not leak internals
  const bad = await call('POST', '/api/v1/auth/login', { body: '{bad json', raw: true, headers: { 'Content-Type': 'application/json' } });
  check('Malformed JSON: no stack trace or file path in the answer', !/at .*\.js|node_modules|\/home\//.test(bad.text), 'status ' + bad.status);

  // 11. Brute force: account lock
  let last;
  for (let i = 0; i < 10; i++) last = await login('master.ravi@selangor.silambam.test', 'wrong-password-' + i);
  const locked = await login('master.ravi@selangor.silambam.test', PW);
  check('Account locks after 10 wrong passwords (right password then refused)', locked.status === 429, 'status ' + locked.status);

  // 12. Sign-in rate limit per address
  let limited = 0;
  for (let i = 0; i < 12; i++) { const r = await login('nobody' + i + '@example.test', 'x'); if (r.status === 429) limited++; }
  check('Sign-in rate limit engages for one address', limited > 0, limited + ' of 12 limited');

  // 13. Security log shows the attack (Super Admin)
  // The sign-in limiter is now active for this address, so read the log with a token minted before it.
  const log = await call('GET', '/api/v1/security/events?limit=500', { token: superToken });
  const seen = log.status === 200 ? log.data.summary.last24h : {};
  check('Security log recorded the attack (failed sign-ins, lockout, refusals, alert)',
    seen.LOGIN_FAILED > 0 && seen.ACCOUNT_LOCKED > 0 && seen.ACCESS_DENIED > 0 && seen.SUSPICIOUS_ACTIVITY > 0, JSON.stringify(seen));
  check('Security log holds no password', log.status === 200 && !/wrong-password-|TestPass2026/.test(log.text));

  // 14. Whole-API flood
  let flood = 0;
  const burst = await Promise.all(Array.from({ length: 700 }, () => call('GET', '/api/v1/release/modules').then(r => r.status)));
  flood = burst.filter(s => s === 429).length;
  check('Whole-API flood limit engages (700 requests in a burst)', flood > 0, flood + ' limited');

  const failed = results.filter(r => !r.pass);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' protections held' + (failed.length ? '; FAILED: ' + failed.map(f => f.name).join(' | ') : ''));
})().catch(e => { console.error('probe error', e); process.exit(1); });
