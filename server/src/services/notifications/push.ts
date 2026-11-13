/**
 * Push notifications to phones for new in-app notifications.
 *
 * Privacy: the lock screen can be seen by anyone near the phone, and many
 * recipients are parents of minors. A push therefore carries only neutral
 * text ("You have a new update in BeltFlow") in the device's language and the
 * notification id. The details stay in the signed-in in-app inbox.
 *
 * Off unless PUSH_PROVIDER=expo. EXPO_ACCESS_TOKEN is optional (needed only
 * if "enhanced push security" is on in the Expo project). Android delivery
 * also needs FCM credentials configured in the Expo/EAS project.
 */
import crypto from 'node:crypto';
import { dbClient } from '../../db/client';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { notificationId: string };
}

export interface PushTicket {
  status: 'ok' | 'error';
  /** e.g. 'DeviceNotRegistered' */
  error?: string;
}

export interface PushProvider {
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}

const PUSH_TEXT: Record<string, { title: string; body: string }> = {
  en: { title: 'BeltFlow', body: 'You have a new update in BeltFlow.' },
  ms: { title: 'BeltFlow', body: 'Anda ada kemas kini baharu dalam BeltFlow.' },
  ta: { title: 'BeltFlow', body: 'BeltFlow இல் உங்களுக்கு ஒரு புதிய அறிவிப்பு உள்ளது.' },
};

export class ExpoPushProvider implements PushProvider {
  constructor(private accessToken?: string, private endpoint = 'https://exp.host/--/api/v2/push/send') {}

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
      const json: any = await res.json();
      const data: any[] = Array.isArray(json?.data) ? json.data : [];
      chunk.forEach((_, k) => {
        const t = data[k];
        tickets.push(t?.status === 'ok' ? { status: 'ok' } : { status: 'error', error: t?.details?.error || t?.message || 'Unknown' });
      });
    }
    return tickets;
  }
}

export function getPushProvider(env: NodeJS.ProcessEnv = process.env): PushProvider | null {
  return (env.PUSH_PROVIDER || '').toLowerCase() === 'expo' ? new ExpoPushProvider(env.EXPO_ACCESS_TOKEN || undefined) : null;
}

export const PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,200}\]$/;

export async function registerDevice(userId: string, token: string, platform: string, locale: string): Promise<void> {
  await dbClient.query(
    `INSERT INTO device_push_tokens (id, user_id, token, platform, locale)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, locale = EXCLUDED.locale,
           last_seen_at = CURRENT_TIMESTAMP, disabled_at = NULL`,
    [`dpt_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`, userId, token, platform, locale]);
}

export async function unregisterDevice(userId: string, token: string): Promise<void> {
  await dbClient.query(
    `UPDATE device_push_tokens SET disabled_at = CURRENT_TIMESTAMP WHERE token = $1 AND user_id = $2 AND disabled_at IS NULL`,
    [token, userId]);
}

export interface PushResult { sent: number; skipped: number; failed: number; devicesDisabled: number }

/**
 * Pushes new in-app notifications once each. Rows are claimed (SENDING) before
 * sending so two workers never push the same one. Notifications older than
 * windowHours are skipped, so turning push on later does not flood phones.
 */
export async function sendPendingPushes(provider: PushProvider | null, opts: { windowHours?: number; limit?: number } = {}): Promise<PushResult> {
  const result: PushResult = { sent: 0, skipped: 0, failed: 0, devicesDisabled: 0 };
  if (!provider) return result;
  const windowHours = opts.windowHours ?? 24;
  const limit = opts.limit ?? 200;

  const old = await dbClient.query(
    `UPDATE user_notifications SET push_status = 'SKIPPED'
     WHERE push_status = 'PENDING' AND created_at < CURRENT_TIMESTAMP - ($1 || ' hours')::interval
     RETURNING id`, [String(windowHours)]);
  result.skipped += old.rows.length;

  const claimed = await dbClient.query(
    `UPDATE user_notifications SET push_status = 'SENDING'
     WHERE id IN (
       SELECT id FROM user_notifications WHERE push_status = 'PENDING'
       ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING id, user_id`, [limit]);
  if (!claimed.rows.length) return result;

  const userIds = Array.from(new Set(claimed.rows.map((r: any) => r.user_id)));
  const devices = await dbClient.query(
    `SELECT user_id, token, locale FROM device_push_tokens WHERE user_id = ANY($1::text[]) AND disabled_at IS NULL`, [userIds]);
  const byUser = new Map<string, { token: string; locale: string }[]>();
  for (const d of devices.rows) byUser.set(d.user_id, [...(byUser.get(d.user_id) || []), { token: d.token, locale: d.locale }]);

  const messages: PushMessage[] = [];
  const owner: string[] = []; // notification id per message
  const noDevice: string[] = [];
  for (const n of claimed.rows) {
    const list = byUser.get(n.user_id) || [];
    if (!list.length) { noDevice.push(n.id); continue; }
    for (const d of list) {
      const text = PUSH_TEXT[d.locale] || PUSH_TEXT.en;
      messages.push({ to: d.token, title: text.title, body: text.body, sound: 'default', data: { notificationId: n.id } });
      owner.push(n.id);
    }
  }
  if (noDevice.length) {
    await dbClient.query(`UPDATE user_notifications SET push_status = 'SKIPPED' WHERE id = ANY($1::text[])`, [noDevice]);
    result.skipped += noDevice.length;
  }
  if (!messages.length) return result;

  let tickets: PushTicket[];
  try {
    tickets = await provider.send(messages);
  } catch (err) {
    // Provider down: put them back to try next cycle (they still expire after windowHours).
    const ids = Array.from(new Set(owner));
    await dbClient.query(`UPDATE user_notifications SET push_status = 'PENDING' WHERE id = ANY($1::text[])`, [ids]);
    throw err;
  }

  const okByNotification = new Map<string, boolean>();
  const deadTokens: string[] = [];
  messages.forEach((m, i) => {
    const t = tickets[i];
    if (t?.status === 'ok') { okByNotification.set(owner[i], true); result.sent++; }
    else {
      if (!okByNotification.has(owner[i])) okByNotification.set(owner[i], false);
      if (t?.error === 'DeviceNotRegistered') deadTokens.push(m.to);
      else result.failed++;
    }
  });
  if (deadTokens.length) {
    const d = await dbClient.query(
      `UPDATE device_push_tokens SET disabled_at = CURRENT_TIMESTAMP WHERE token = ANY($1::text[]) AND disabled_at IS NULL RETURNING id`, [deadTokens]);
    result.devicesDisabled += d.rows.length;
  }
  const sentIds = [...okByNotification].filter(([, ok]) => ok).map(([id]) => id);
  const failedIds = [...okByNotification].filter(([, ok]) => !ok).map(([id]) => id);
  if (sentIds.length) await dbClient.query(`UPDATE user_notifications SET push_status = 'SENT', push_sent_at = CURRENT_TIMESTAMP WHERE id = ANY($1::text[])`, [sentIds]);
  if (failedIds.length) await dbClient.query(`UPDATE user_notifications SET push_status = 'FAILED' WHERE id = ANY($1::text[])`, [failedIds]);
  return result;
}
