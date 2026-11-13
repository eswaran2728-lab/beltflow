/**
 * Push notifications to phones (follow-up to the in-app inbox).
 *
 *  - A signed-in user registers their own device push token; tokens are
 *    validated and are never readable through the API.
 *  - sendPendingPushes() sends one push per new in-app notification to that
 *    recipient's devices only, with lock-screen-safe text in the device's
 *    language: no names, amounts, class names or message text.
 *  - Each notification is pushed at most once; notifications older than the
 *    push window are not pushed (no flood after enabling push).
 *  - A device the provider reports as unregistered is disabled.
 *  - With no provider configured nothing is sent and nothing is lost.
 * Uses a fake provider; no real push service is contacted. Synthetic data.
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
import { sendPendingPushes, PushProvider, PushMessage, PushTicket, ExpoPushProvider, getPushProvider } from '../services/notifications/push';

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

class FakeProvider implements PushProvider {
  sent: PushMessage[] = [];
  unregistered = new Set<string>();
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    this.sent.push(...messages);
    return messages.map(m => (this.unregistered.has(m.to) ? { status: 'error', error: 'DeviceNotRegistered' } : { status: 'ok' }));
  }
}

async function runTests() {
  console.log('📲 Starting push notification tests...');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-push-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  try {
    const org = 'org_push_a';
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Test Persatuan Push', 'Selangor', 'Silat', 'Test', '0100000000', 'push@example.test') ON CONFLICT (id) DO NOTHING`, [org]);
    for (const [id, role] of [['push_par', 'PARENT'], ['push_par2', 'PARENT'], ['push_mst', 'MASTER']]) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
        [id, `${id}@example.test`, `Test ${id}`, role, org]);
    }
    const tok = (id: string, role: UserRole) => generateAuthToken({ id, email: `${id}@example.test`, role, organizationId: org } as any);
    const tPar = tok('push_par', UserRole.PARENT);
    const tPar2 = tok('push_par2', UserRole.PARENT);

    // ------------------------------------------------ device registration
    const bad = await request(server, 'POST', '/notifications/devices', tPar, { token: 'not-a-push-token', platform: 'android', locale: 'ms' });
    assert.equal(bad.status, 400, 'malformed tokens are rejected');
    const anon = await request(server, 'POST', '/notifications/devices', undefined, { token: 'ExponentPushToken[abc]', platform: 'android' });
    assert.equal(anon.status, 401);
    const reg = await request(server, 'POST', '/notifications/devices', tPar, { token: 'ExponentPushToken[par-phone-1]', platform: 'android', locale: 'ms' });
    assert.equal(reg.status, 200, JSON.stringify(reg.data));
    assert.equal(reg.data.token, undefined, 'the token is not echoed back');
    const reg2 = await request(server, 'POST', '/notifications/devices', tPar, { token: 'ExponentPushToken[par-tablet-2]', platform: 'ios', locale: 'ta' });
    assert.equal(reg2.status, 200);
    const again = await request(server, 'POST', '/notifications/devices', tPar, { token: 'ExponentPushToken[par-phone-1]', platform: 'android', locale: 'ms' });
    assert.equal(again.status, 200, 'registering the same token again is fine');
    assert.equal((await dbClient.query(`SELECT id FROM device_push_tokens WHERE user_id = 'push_par'`)).rows.length, 2, 'no duplicate rows');
    // A phone handed to another family member moves to the new user.
    await request(server, 'POST', '/notifications/devices', tPar2, { token: 'ExponentPushToken[shared-phone]', platform: 'android', locale: 'en' });
    await request(server, 'POST', '/notifications/devices', tPar, { token: 'ExponentPushToken[shared-phone]', platform: 'android', locale: 'en' });
    assert.equal((await dbClient.query(`SELECT user_id FROM device_push_tokens WHERE token = 'ExponentPushToken[shared-phone]'`)).rows[0].user_id, 'push_par');
    // Unregister (logout) removes only the caller's own token.
    const steal = await request(server, 'DELETE', '/notifications/devices', tPar2, { token: 'ExponentPushToken[shared-phone]' });
    assert.equal(steal.status, 200);
    assert.equal((await dbClient.query(`SELECT disabled_at FROM device_push_tokens WHERE token = 'ExponentPushToken[shared-phone]'`)).rows[0].disabled_at, null, 'another user cannot remove my device');
    const logout = await request(server, 'DELETE', '/notifications/devices', tPar, { token: 'ExponentPushToken[shared-phone]' });
    assert.equal(logout.status, 200);
    assert.notEqual((await dbClient.query(`SELECT disabled_at FROM device_push_tokens WHERE token = 'ExponentPushToken[shared-phone]'`)).rows[0].disabled_at, null, 'logout disables my device');
    console.log('✅ Devices: validated, owner-only, no duplicates, logout disables, token never echoed.');

    // ------------------------------------------------ sending
    const notify = async (id: string, userId: string, eventType: string, params: object, ageMinutes = 0) =>
      dbClient.query(
        `INSERT INTO user_notifications (id, organization_id, user_id, outbox_id, event_type, params, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - ($7 || ' minutes')::interval)`,
        [id, org, userId, `ob_${id}`, eventType, JSON.stringify(params), String(ageMinutes)]);
    await notify('pn_belt', 'push_par', 'BeltPromotionAwarded', { studentName: 'Test Child Secret', newBelt: 'Yellow Belt' });
    await notify('pn_pay', 'push_par', 'PAYMENT_SETTLED', { amountRM: '80.00', receiptNo: 'REC-SECRET-1' });
    await notify('pn_old', 'push_par', 'ClassApproved', { className: 'Old Class' }, 3 * 24 * 60);
    await notify('pn_master', 'push_mst', 'ClassSubmitted', { className: 'Test Class' }); // master has no device

    // No provider configured: nothing is sent, nothing is marked.
    const off = await sendPendingPushes(null);
    assert.equal(off.sent, 0);
    assert.equal((await dbClient.query(`SELECT push_status FROM user_notifications WHERE id = 'pn_belt'`)).rows[0].push_status, 'PENDING');

    const provider = new FakeProvider();
    provider.unregistered.add('ExponentPushToken[par-tablet-2]');
    const r1 = await sendPendingPushes(provider);
    // 2 new notifications x 2 active devices of the parent.
    assert.equal(provider.sent.length, 4, `messages sent: ${JSON.stringify(provider.sent)}`);
    assert.ok(provider.sent.every(m => ['ExponentPushToken[par-phone-1]', 'ExponentPushToken[par-tablet-2]'].includes(m.to)), 'only the recipient\'s devices');
    const text = JSON.stringify(provider.sent);
    for (const secret of ['Test Child Secret', 'Yellow Belt', '80.00', 'REC-SECRET-1', 'Old Class', 'Test Class']) {
      assert.ok(!text.includes(secret), `push text must not contain "${secret}"`);
    }
    const ms = provider.sent.find(m => m.to === 'ExponentPushToken[par-phone-1]')!;
    const ta = provider.sent.find(m => m.to === 'ExponentPushToken[par-tablet-2]')!;
    assert.match(ms.body, /BeltFlow/);
    assert.notEqual(ms.body, ta.body, 'text follows each device\'s language');
    assert.match(ta.body, /[஀-௿]/, 'Tamil device gets Tamil text');
    assert.equal(ms.data?.notificationId !== undefined, true, 'data carries only the notification id');
    assert.deepEqual(Object.keys(ms.data || {}).sort(), ['notificationId']);
    assert.equal(r1.sent, 2, 'two delivered to the phone; the two to the uninstalled tablet are not counted');
    assert.equal(r1.devicesDisabled, 1);
    assert.notEqual((await dbClient.query(`SELECT disabled_at FROM device_push_tokens WHERE token = 'ExponentPushToken[par-tablet-2]'`)).rows[0].disabled_at, null, 'unregistered device disabled');
    const statuses = Object.fromEntries((await dbClient.query(`SELECT id, push_status FROM user_notifications WHERE id LIKE 'pn_%'`)).rows.map((r: any) => [r.id, r.push_status]));
    assert.equal(statuses.pn_belt, 'SENT');
    assert.equal(statuses.pn_pay, 'SENT');
    assert.equal(statuses.pn_old, 'SKIPPED', 'too old to push');
    assert.equal(statuses.pn_master, 'SKIPPED', 'no device registered');

    provider.sent = [];
    const r2 = await sendPendingPushes(provider);
    assert.equal(r2.sent, 0);
    assert.equal(provider.sent.length, 0, 'never pushed twice');
    console.log('✅ Sending: recipient devices only, neutral text per device language, once, old ones skipped, dead devices disabled.');

    // ------------------------------------------------ Expo adapter (local stand-in, no internet)
    assert.equal(getPushProvider({} as any), null, 'push is off by default');
    assert.ok(getPushProvider({ PUSH_PROVIDER: 'expo' } as any) instanceof ExpoPushProvider);
    let received: any = null;
    let auth: string | undefined;
    const fakeExpo = http.createServer((req, res) => {
      let raw = '';
      req.on('data', c => (raw += c));
      req.on('end', () => {
        received = JSON.parse(raw);
        auth = req.headers.authorization;
        res.setHeader('Content-Type', 'application/json');
        // Shape documented by Expo for POST /--/api/v2/push/send.
        res.end(JSON.stringify({ data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'error', message: '"ExponentPushToken[gone]" is not a registered push notification recipient', details: { error: 'DeviceNotRegistered' } },
        ] }));
      });
    });
    await new Promise<void>(r => fakeExpo.listen(0, '127.0.0.1', () => r()));
    try {
      const port = (fakeExpo.address() as any).port;
      const expo = new ExpoPushProvider('test-access-token', `http://127.0.0.1:${port}/--/api/v2/push/send`);
      const msgs: PushMessage[] = [
        { to: 'ExponentPushToken[ok]', title: 'BeltFlow', body: 'x', sound: 'default', data: { notificationId: 'n1' } },
        { to: 'ExponentPushToken[gone]', title: 'BeltFlow', body: 'x', sound: 'default', data: { notificationId: 'n2' } },
      ];
      const tickets = await expo.send(msgs);
      assert.deepEqual(tickets, [{ status: 'ok' }, { status: 'error', error: 'DeviceNotRegistered' }]);
      assert.equal(received.length, 2, 'messages sent as a JSON array');
      assert.equal(auth, 'Bearer test-access-token', 'access token sent when configured');
    } finally {
      await new Promise<void>(r => fakeExpo.close(() => r()));
    }
    console.log('✅ Expo adapter: request format, access token and DeviceNotRegistered parsing.');

    console.log('\n🎉 Push notification tests PASSED.');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Push notification tests failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runPushNotificationTests };
