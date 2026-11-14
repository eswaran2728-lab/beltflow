/**
 * Official Task H27 acceptance test: worker_replay_safe
 *
 * Every background job and externally retried request must be safe to run
 * twice, or many times at once (crash recovery, retries, duplicate
 * deliveries). For each path the job is fired concurrently and then again
 * sequentially, and the final state must equal a single run.
 *
 *   1. activateEffectiveTransfers   (scheduled class transfers, H18)
 *   2. sweepExpiredWaitlistOffers   (make-up waitlist expiry, H17)
 *   3. Payment gateway webhook      (duplicate and retried events, H13)
 *   4. Offline attendance sync      (duplicate mutation ids, H01/H08)
 *
 * Runs on embedded PGlite by default (replays are serialised). With
 * DATABASE_URL pointing at a disposable PostgreSQL server the concurrent
 * replays are truly parallel over a connection pool.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';
import { activateEffectiveTransfers } from '../routes/transfers.routes';
import { sweepExpiredWaitlistOffers } from '../routes/bookings.routes';

const CONCURRENCY = 6;

function post(server: http.Server, urlPath: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: addr.port, path: `/api/v1${urlPath}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)), Connection: 'close', ...headers },
    }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => { try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode || 0, data: raw }); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  const engine = process.env.DATABASE_URL ? 'PostgreSQL (truly concurrent)' : 'PGlite (serialised)';
  console.log(`🥋 Starting Task H27: worker_replay_safe on ${engine}...`);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beltflow-h27-replay-'));
  await dbClient.init(dataDir);
  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));

  const ts = Date.now();
  const id = (k: string) => `h27r_${k}_${ts}`;
  const ORG = id('org');
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = iso(new Date(Date.now() - 86400000));
  const tomorrow = iso(new Date(Date.now() + 86400000));

  try {
    // ------------------------------------------------------------- seed
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
       VALUES ($1, 'H27 Replay Persatuan', 'Selangor', 'Silambam', 'Guru', '0100000000', $2, 'ACTIVE')`, [ORG, `${ORG}@test.local`]);
    for (const [k, role] of [['master', 'MASTER'], ['parent', 'PARENT']] as const) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status) VALUES ($1, $2, 'h', $3, $4, $5, 'ACTIVE')`,
        [id(k), `${id(k)}@test.local`, `H27 ${k}`, role, ORG]);
    }
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, name, schedule, location, status, approval_status, capacity, monthly_fee) VALUES
       ($1, $4, 'Home Class', 'Tue 8pm', 'Hall A', 'ACTIVE', 'APPROVED', 30, 120),
       ($2, $4, 'Target Class', 'Thu 8pm', 'Hall B', 'ACTIVE', 'APPROVED', 30, 150),
       ($3, $4, 'Make-up Class', 'Sat 9am', 'Hall C', 'ACTIVE', 'APPROVED', 1, 120)`,
      [id('clsA'), id('clsB'), id('clsC'), ORG]);
    await dbClient.query(`INSERT INTO master_affiliations (id, master_id, organization_id, status) VALUES ($1, $2, $3, 'ACTIVE')`, [id('aff'), id('master'), ORG]);
    await dbClient.query(
      `INSERT INTO class_leaderships (id, class_id, master_id, organization_id, leadership_type, is_active) VALUES ($1, $2, $3, $4, 'PRIMARY', TRUE)`,
      [id('lead'), id('clsA'), id('master'), ORG]);
    await dbClient.query(
      `INSERT INTO training_groups (id, organization_id, class_id, name) VALUES ($1, $3, $4, 'All'), ($2, $3, $5, 'All')`,
      [id('grpA'), id('grpC'), ORG, id('clsA'), id('clsC')]);
    for (const k of ['s1', 's2', 's3', 's4', 'sT']) {
      await dbClient.query(
        `INSERT INTO students (id, organization_id, class_id, group_id, full_name, ic_number, status, monthly_fee) VALUES ($1, $2, $3, $4, $5, '000000-00-0000', 'ACTIVE', 120)`,
        [id(k), ORG, id('clsA'), id('grpA'), `Student ${k}`]);
    }
    await dbClient.query(
      `INSERT INTO training_sessions (id, organization_id, class_id, group_id, session_date, day_of_week, start_time, end_time, location, status) VALUES
       ($1, $3, $4, $5, $7, 'Tuesday', '20:00', '22:00', 'Hall A', 'Completed'),
       ($2, $3, $6, $8, $9, 'Saturday', '09:00', '11:00', 'Hall C', 'Scheduled')`,
      [id('sesA'), id('sesC'), ORG, id('clsA'), id('grpA'), id('clsC'), yesterday, id('grpC'), tomorrow]);

    // ------------------------------------------- 1. scheduled transfers
    console.log('\n--- 1. activateEffectiveTransfers ---');
    await dbClient.query(
      `INSERT INTO class_enrollments (id, student_id, class_id, organization_id, status, is_primary) VALUES
       ($1, $3, $4, $6, 'ACTIVE', TRUE), ($2, $3, $5, $6, 'SCHEDULED', FALSE)`,
      [id('enrA'), id('enrB'), id('sT'), id('clsA'), id('clsB'), ORG]);
    await dbClient.query(
      `INSERT INTO class_transfer_requests (id, student_id, organization_id, old_class_id, new_class_id, status, effective_date, old_master_approved, new_master_approved)
       VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, TRUE, TRUE)`,
      [id('xfer'), id('sT'), ORG, id('clsA'), id('clsB'), yesterday]);
    const parallelT = await Promise.all(Array.from({ length: CONCURRENCY }, () => activateEffectiveTransfers().catch(e => `ERR ${e.message}`)));
    const serialT = [await activateEffectiveTransfers(), await activateEffectiveTransfers()];
    const allT = [...parallelT, ...serialT];
    assert.ok(allT.every(v => typeof v === 'number'), `no worker run failed: ${JSON.stringify(allT)}`);
    assert.equal((allT as number[]).reduce((a, b) => a + b, 0), 1, `transfer activated exactly once across ${allT.length} runs (${JSON.stringify(allT)})`);
    const enr = await dbClient.query(`SELECT class_id, status, is_primary FROM class_enrollments WHERE student_id = $1 ORDER BY class_id`, [id('sT')]);
    assert.deepEqual(enr.rows.map((r: any) => [r.class_id, r.status, r.is_primary]), [[id('clsA'), 'TRANSFERRED', false], [id('clsB'), 'ACTIVE', true]]);
    const stuT = await dbClient.query(`SELECT class_id, monthly_fee FROM students WHERE id = $1`, [id('sT')]);
    assert.equal(stuT.rows[0].class_id, id('clsB'));
    assert.equal(Number(stuT.rows[0].monthly_fee), 150);
    console.log(`✅ ${allT.length} runs (${CONCURRENCY} concurrent): activated once; one ACTIVE primary enrolment; fee updated once.`);

    // ------------------------------------------------ 2. waitlist expiry
    console.log('\n--- 2. sweepExpiredWaitlistOffers ---');
    const booking = (k: string, student: string, status: string, pos: number | null, expires: string | null) => dbClient.query(
      `INSERT INTO make_up_bookings (id, organization_id, student_id, home_class_id, target_class_id, session_id, requested_by_user_id, status, waitlist_position, offer_expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP + ($11 || ' seconds')::interval)`,
      [id(k), ORG, id(student), id('clsA'), id('clsC'), id('sesC'), id('parent'), status, pos, expires, String(pos ?? 0)]);
    await booking('bExp', 's1', 'OFFERED', null, new Date(Date.now() - 3600000).toISOString());
    await booking('bW1', 's2', 'WAITLISTED', 1, null);
    await booking('bW2', 's3', 'WAITLISTED', 2, null);
    const parallelW = await Promise.all(Array.from({ length: CONCURRENCY }, () => sweepExpiredWaitlistOffers().catch(e => `ERR ${e.message}`)));
    const serialW = [await sweepExpiredWaitlistOffers(), await sweepExpiredWaitlistOffers()];
    const allW = [...parallelW, ...serialW];
    assert.ok(allW.every(v => typeof v === 'number'), `no sweep failed: ${JSON.stringify(allW)}`);
    assert.equal((allW as number[]).reduce((a, b) => a + b, 0), 1, `expired offer processed exactly once (${JSON.stringify(allW)})`);
    const bk = await dbClient.query(`SELECT id, status, waitlist_position FROM make_up_bookings WHERE session_id = $1 ORDER BY id`, [id('sesC')]);
    const byId = Object.fromEntries(bk.rows.map((r: any) => [r.id, r]));
    assert.equal(byId[id('bExp')].status, 'EXPIRED');
    assert.equal(byId[id('bW1')].status, 'OFFERED', 'first in line promoted');
    assert.equal(byId[id('bW2')].status, 'WAITLISTED', 'second stays waitlisted (capacity 1)');
    assert.equal(bk.rows.filter((r: any) => r.status === 'OFFERED').length, 1, 'exactly one live offer for the single seat');
    console.log(`✅ ${allW.length} sweeps: offer expired once; exactly one promotion into the single free seat.`);

    // ------------------------------------------------- 3. payment webhook
    console.log('\n--- 3. Payment gateway webhook ---');
    const secret = `whsec_${ts}`;
    await dbClient.query(
      `INSERT INTO persatuan_merchants (id, organization_id, provider, merchant_account_id, merchant_name, status, webhook_secret_hash)
       VALUES ($1, $2, 'SANDBOX', $3, 'H27 Merchant', 'ACTIVE', $4)`, [id('mer'), ORG, `acct_${ts}`, secret]);
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, $3, $4, '2026-10', 120, 0, 'Pending')`, [id('due'), ORG, id('clsA'), id('s4')]);
    await dbClient.query(
      `INSERT INTO payment_intents (id, organization_id, merchant_id, student_id, payer_user_id, amount_cents, currency, billing_month_ids, payment_method, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 12000, 'MYR', $6, 'FPX', 'PENDING_PROCESSING', CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
      [id('pi'), ORG, id('mer'), id('s4'), id('parent'), [id('due')]]);
    const event = (eventId: string) => JSON.stringify({
      eventId, eventType: 'payment.succeeded', intentId: id('pi'), merchantAccountId: `acct_${ts}`, amountCents: 12000, currency: 'MYR', providerTxId: `tx_${ts}`,
    });
    const send = (eventId: string) => {
      const body = event(eventId);
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return post(server, '/payments/webhooks/SANDBOX', body, { 'x-beltflow-signature': sig });
    };
    const parallelP = await Promise.all([
      ...Array.from({ length: CONCURRENCY }, () => send(`evt_${ts}_1`)),
      ...Array.from({ length: 3 }, () => send(`evt_${ts}_retry`)),
    ]);
    const serialP = [await send(`evt_${ts}_1`), await send(`evt_${ts}_retry`)];
    const allP = [...parallelP, ...serialP];
    assert.ok(allP.every(r => r.status < 500), `no webhook delivery crashed: ${allP.map(r => r.status).join(',')}`);
    const pays = await dbClient.query(`SELECT id, receipt_no, amount, status FROM payments WHERE payment_intent_id = $1`, [id('pi')]);
    assert.equal(pays.rowCount, 1, `exactly one ledger payment (found ${pays.rowCount})`);
    assert.ok(pays.rows[0].receipt_no, 'receipt issued');
    const due = await dbClient.query(`SELECT amount_paid, status FROM monthly_dues WHERE id = $1`, [id('due')]);
    assert.equal(Number(due.rows[0].amount_paid), 120, `due credited once (amount_paid ${due.rows[0].amount_paid})`);
    const alloc = await dbClient.query(`SELECT COUNT(*)::int AS n FROM monthly_due_payments WHERE monthly_due_id = $1`, [id('due')]);
    assert.equal(alloc.rows[0].n, 1, 'one allocation row');
    const intent = await dbClient.query(`SELECT status, settled_payment_id FROM payment_intents WHERE id = $1`, [id('pi')]);
    assert.equal(intent.rows[0].status, 'SUCCEEDED');
    assert.equal(intent.rows[0].settled_payment_id, pays.rows[0].id);
    console.log(`✅ ${allP.length} deliveries (same event ×${CONCURRENCY + 1}, retried event ×4): one payment, one receipt, due credited once.`);

    // -------------------------------------------- 4. offline attendance
    console.log('\n--- 4. Offline attendance sync ---');
    const masterToken = generateAuthToken({ id: id('master'), email: `${id('master')}@test.local`, role: UserRole.MASTER, organizationId: ORG });
    const mutation = { mutationId: `mut_${ts}_1`, sessionId: id('sesA'), studentId: id('s1'), status: 'Present', clientTimestamp: new Date().toISOString() };
    const sync = (mutations: unknown[]) => post(server, '/attendance/sync', { mutations }, { Authorization: `Bearer ${masterToken}` });
    const parallelS = await Promise.all([
      ...Array.from({ length: CONCURRENCY }, () => sync([mutation])),
      sync([mutation, mutation]),
    ]);
    const serialS = [await sync([mutation]), await sync([mutation])];
    const allS = [...parallelS, ...serialS];
    assert.ok(allS.every(r => r.status < 500), `no sync batch crashed: ${allS.map(r => r.status).join(',')}`);
    const att = await dbClient.query(`SELECT status, version FROM session_attendance WHERE session_id = $1 AND student_id = $2`, [id('sesA'), id('s1')]);
    assert.equal(att.rowCount, 1, 'one attendance record');
    assert.equal(att.rows[0].status, 'Present');
    assert.equal(Number(att.rows[0].version), 1, `applied once (version ${att.rows[0].version})`);
    const processed = await dbClient.query(`SELECT COUNT(*)::int AS n FROM processed_sync_mutations WHERE mutation_id = $1`, [mutation.mutationId]);
    assert.equal(processed.rows[0].n, 1, 'mutation recorded once');
    const lastSerial = serialS[serialS.length - 1].data;
    assert.ok(lastSerial.synced?.includes(mutation.mutationId), 'a later retry is acknowledged as already synced');
    // A duplicate of the SAME mutation is already done, not a conflict: the
    // Master must never be shown a false conflict for their own resend.
    const notAcked = allS.filter(r => !(r.data?.synced || []).includes(mutation.mutationId));
    assert.equal(notAcked.length, 0, `every duplicate acknowledged as synced, not a conflict: ${JSON.stringify(notAcked.slice(0, 1).map(r => r.data))}`);
    console.log(`✅ ${allS.length} sync batches: one attendance row (version 1), one processed mutation; every duplicate acknowledged as synced.`);

    console.log(`\n🎉 H27 acceptance test worker_replay_safe PASSED on ${engine}.`);
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    await dbClient.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ H27 worker replay test failed:', err);
    process.exitCode = 1;
  });
}

export { runTests as runH27WorkerReplayTests };
