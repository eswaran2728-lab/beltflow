/**
 * Background jobs (H27 known gap #2, H13 follow-up).
 *
 * Each job is idempotent and safe to replay (worker_replay_h27 proves it for
 * transfers and waitlist expiry), so the cycle can run on every instance.
 *  - activateEffectiveTransfers  (transfers module, H18)
 *  - sweepExpiredWaitlistOffers  (bookings module, H17)
 *  - expireStalePaymentIntents   (core payments, H13)
 *  - deliverNotificationOutbox   (in-app notifications, core)
 * Jobs of a disabled release module are skipped.
 *
 * BELTFLOW_WORKERS=off                  do not start the timer (e.g. when an
 *                                       external scheduler calls the routes)
 * BELTFLOW_WORKER_INTERVAL_MINUTES=5    how often the cycle runs (1-60)
 */
import { dbClient } from '../db/client';
import { isModuleEnabled } from '../release/modules';
import { activateEffectiveTransfers } from '../routes/transfers.routes';
import { sweepExpiredWaitlistOffers } from '../routes/bookings.routes';
import { deliverNotificationOutbox } from '../services/notifications/deliver';

/**
 * Marks unpaid intents past their window as EXPIRED. This only stops the
 * parent waiting on a dead link: a genuine bank success webhook that arrives
 * later still settles the intent (the money has moved), see
 * paymentGateway.routes.ts.
 */
export async function expireStalePaymentIntents(): Promise<number> {
  const res = await dbClient.query(
    `UPDATE payment_intents
     SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('REQUIRES_PAYMENT_METHOD', 'PENDING_PROCESSING')
       AND expires_at <= CURRENT_TIMESTAMP
     RETURNING id`
  );
  return res.rows.length;
}

export interface WorkerCycleResult {
  /** null when the module is disabled and the job was skipped */
  transfersActivated: number | null;
  waitlistOffersExpired: number | null;
  paymentIntentsExpired: number | null;
  notificationsDelivered: number | null;
  errors: string[];
}

export async function runWorkerCycle(env: NodeJS.ProcessEnv = process.env): Promise<WorkerCycleResult> {
  const result: WorkerCycleResult = { transfersActivated: null, waitlistOffersExpired: null, paymentIntentsExpired: null, notificationsDelivered: null, errors: [] };
  const run = async (name: string, fn: () => Promise<number>, assign: (n: number) => void) => {
    try {
      assign(await fn());
    } catch (err) {
      // One failing job must not stop the others.
      result.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  if (isModuleEnabled('transfers', env)) {
    await run('transfers', () => activateEffectiveTransfers(), n => (result.transfersActivated = n));
  }
  if (isModuleEnabled('bookings', env)) {
    await run('bookings', () => sweepExpiredWaitlistOffers(), n => (result.waitlistOffersExpired = n));
  }
  await run('payments', () => expireStalePaymentIntents(), n => (result.paymentIntentsExpired = n));
  // Last, so events raised by the jobs above are delivered in the same cycle.
  await run('notifications', async () => {
    const d = await deliverNotificationOutbox();
    if (d.errors.length) result.errors.push(...d.errors.map(e => `notifications ${e}`));
    return d.delivered;
  }, n => (result.notificationsDelivered = n));
  return result;
}

/** Starts the periodic cycle. Returns a function that stops it. */
export function startBackgroundWorkers(env: NodeJS.ProcessEnv = process.env): () => void {
  if ((env.BELTFLOW_WORKERS || '').toLowerCase() === 'off') {
    console.log('[Workers] BELTFLOW_WORKERS=off: background jobs not started.');
    return () => undefined;
  }
  const minutes = Math.min(60, Math.max(1, Number(env.BELTFLOW_WORKER_INTERVAL_MINUTES) || 5));
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap a slow cycle
    running = true;
    try {
      const r = await runWorkerCycle(env);
      const changed = [r.transfersActivated, r.waitlistOffersExpired, r.paymentIntentsExpired, r.notificationsDelivered].some(n => (n ?? 0) > 0);
      if (changed || r.errors.length) {
        console.log(`[Workers] transfers=${r.transfersActivated ?? 'off'} waitlist=${r.waitlistOffersExpired ?? 'off'} payments=${r.paymentIntentsExpired} notifications=${r.notificationsDelivered}${r.errors.length ? ` errors=${r.errors.join('; ')}` : ''}`);
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), minutes * 60 * 1000);
  timer.unref();
  console.log(`[Workers] background jobs every ${minutes} min.`);
  return () => clearInterval(timer);
}
