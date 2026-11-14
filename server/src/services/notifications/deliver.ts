/**
 * Delivers notification_outbox rows to per-user in-app notifications
 * (user_notifications). Runs from the background scheduler.
 *
 * Rules:
 *  - Recipients are resolved from database relationships for the event (the
 *    applicant, the student and their ACTIVE linked parents, the class
 *    leader, the Persatuan's admins, the payer...). A user id that appears in
 *    the payload is used only if the database confirms it.
 *  - Super Admin never receives a notification (child privacy), and only
 *    ACTIVE users receive one.
 *  - Only whitelisted, display-safe params are copied. Free-text reasons,
 *    requested information, certificate codes/tokens and message text never
 *    leave the outbox.
 *  - Idempotent: UNIQUE(outbox_id, user_id) and the outbox row is marked
 *    PROCESSED in the same transaction.
 * The mobile app turns event_type + params into text in EN/BM/Tamil.
 */
import { dbClient } from '../../db/client';
import crypto from 'node:crypto';

const newId = (prefix: string) => `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

type Tx = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> };

interface OutboxRow {
  id: string;
  organization_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: any;
}

/** Display-safe fields copied per event. Anything else in the payload is dropped. */
const SAFE_PARAMS: Record<string, string[]> = {
  WaitlistOfferAvailable: ['className', 'sessionDate', 'offerExpiresAt'],
  ClassSubmitted: ['className'],
  ClassInformationRequested: ['className'],
  ClassRejected: ['className'],
  ClassApproved: ['className'],
  BeltPromotionAwarded: ['studentName', 'newBelt'],
  ClassHandoverRequested: ['className'],
  ClassHandoverCompleted: ['className'],
  MasterApproved: [],
  MasterInformationRequested: [],
  MasterRejected: [],
  ParentMasterMessageReceived: ['senderRole'],
  PAYMENT_SETTLED: ['receiptNo', 'amountRM'],
  MembershipPauseRequested: ['studentName', 'startDate'],
  MembershipPauseApproved: ['startDate', 'expectedEndDate'],
  MembershipResumed: [],
  ClassTransferRequested: ['effectiveDate'],
  ClassTransferApproved: ['effectiveDate'],
  StudentEnrollmentApproved: ['studentName', 'className'],
  StudentEnrollmentInformationRequested: [],
  StudentEnrollmentRejected: [],
  StudentEnrollmentWaitlisted: [],
};

const ids = (rows: any[], col: string) => rows.map(r => r[col]).filter(Boolean) as string[];

async function family(tx: Tx, studentId?: string | null): Promise<string[]> {
  if (!studentId) return [];
  const stu = await tx.query(`SELECT user_id FROM students WHERE id = $1`, [studentId]);
  const parents = await tx.query(`SELECT parent_id FROM parent_student_links WHERE student_id = $1 AND status = 'ACTIVE'`, [studentId]);
  return [...ids(stu.rows, 'user_id'), ...ids(parents.rows, 'parent_id')];
}

async function classLeaders(tx: Tx, classId?: string | null): Promise<string[]> {
  if (!classId) return [];
  const lead = await tx.query(
    `SELECT master_id FROM class_leaderships WHERE class_id = $1 AND is_active = TRUE AND leadership_type = 'PRIMARY'`, [classId]);
  if (lead.rows.length) return ids(lead.rows, 'master_id');
  const cls = await tx.query(`SELECT master_id FROM classes WHERE id = $1`, [classId]);
  return ids(cls.rows, 'master_id');
}

async function orgAdmins(tx: Tx, orgId: string): Promise<string[]> {
  const r = await tx.query(`SELECT id FROM users WHERE organization_id = $1 AND role = 'ADMIN_PERSATUAN' AND status = 'ACTIVE'`, [orgId]);
  return ids(r.rows, 'id');
}

/** Extra display params looked up from the database (never from free text). */
interface Resolved { recipients: string[]; extra?: Record<string, unknown> }

async function resolve(tx: Tx, row: OutboxRow): Promise<Resolved> {
  const p = row.payload || {};
  const org = row.organization_id;
  switch (row.event_type) {
    case 'WaitlistOfferAvailable': {
      const b = await tx.query(`SELECT requested_by_user_id, student_id FROM make_up_bookings WHERE id = $1 AND organization_id = $2`, [row.aggregate_id, org]);
      if (!b.rows.length) return { recipients: [] };
      return { recipients: [b.rows[0].requested_by_user_id, ...(await family(tx, b.rows[0].student_id))] };
    }
    case 'ClassSubmitted':
      return { recipients: await orgAdmins(tx, org) };
    case 'ClassInformationRequested':
    case 'ClassRejected':
    case 'ClassApproved': {
      const a = await tx.query(`SELECT proposing_master_id, name FROM class_applications WHERE id = $1 AND organization_id = $2`, [p.applicationId || row.aggregate_id, org]);
      if (!a.rows.length) return { recipients: [] };
      return { recipients: [a.rows[0].proposing_master_id], extra: { className: a.rows[0].name } };
    }
    case 'BeltPromotionAwarded': {
      const s = await tx.query(`SELECT id FROM students WHERE id = $1 AND organization_id = $2`, [row.aggregate_id, org]);
      return { recipients: s.rows.length ? await family(tx, row.aggregate_id) : [] };
    }
    case 'ClassHandoverRequested':
    case 'ClassHandoverCompleted': {
      const h = await tx.query(
        `SELECT outgoing_master_id, incoming_master_id, initiated_by FROM class_handover_requests WHERE id = $1 AND organization_id = $2`,
        [row.aggregate_id, org]);
      if (!h.rows.length) return { recipients: [] };
      const { outgoing_master_id: outgoing, incoming_master_id: incoming, initiated_by: initiatedBy } = h.rows[0];
      if (row.event_type === 'ClassHandoverRequested') {
        // The incoming Master decides; tell the outgoing Master too if someone else started it.
        return { recipients: initiatedBy && initiatedBy !== outgoing ? [incoming, outgoing] : [incoming] };
      }
      return { recipients: [incoming, outgoing] };
    }
    case 'MasterApproved':
    case 'MasterInformationRequested':
    case 'MasterRejected': {
      const m = await tx.query(`SELECT user_id FROM master_applications WHERE id = $1 AND organization_id = $2`, [row.aggregate_id, org]);
      return { recipients: ids(m.rows, 'user_id') };
    }
    case 'ParentMasterMessageReceived': {
      const t = await tx.query(`SELECT parent_id, assigned_master_id FROM message_threads WHERE id = $1 AND organization_id = $2`, [p.threadId || row.aggregate_id, org]);
      if (!t.rows.length) return { recipients: [] };
      const participants = [t.rows[0].parent_id, t.rows[0].assigned_master_id];
      return { recipients: participants.includes(p.recipientId) ? [p.recipientId] : [] };
    }
    case 'PAYMENT_SETTLED': {
      const pi = await tx.query(`SELECT payer_user_id FROM payment_intents WHERE settled_payment_id = $1 AND organization_id = $2`, [row.aggregate_id, org]);
      return { recipients: ids(pi.rows, 'payer_user_id') };
    }
    case 'MembershipPauseRequested':
    case 'MembershipPauseApproved':
    case 'MembershipResumed': {
      const m = await tx.query(`SELECT class_id, student_id, requested_by_user_id FROM membership_pauses WHERE id = $1 AND organization_id = $2`, [row.aggregate_id, org]);
      if (!m.rows.length) return { recipients: [] };
      const r = m.rows[0];
      if (row.event_type === 'MembershipPauseRequested') return { recipients: await classLeaders(tx, r.class_id) };
      if (row.event_type === 'MembershipPauseApproved') return { recipients: [r.requested_by_user_id, ...(await family(tx, r.student_id))] };
      return { recipients: [...(await classLeaders(tx, r.class_id)), ...(await family(tx, r.student_id))] };
    }
    case 'ClassTransferRequested':
    case 'ClassTransferApproved': {
      const t = await tx.query(
        `SELECT new_class_id, student_id, requested_by_user_id FROM class_transfer_requests
         WHERE id = $1 AND (organization_id = $2 OR target_organization_id = $2)`, [row.aggregate_id, org]);
      if (!t.rows.length) return { recipients: [] };
      const r = t.rows[0];
      if (row.event_type === 'ClassTransferRequested') return { recipients: await classLeaders(tx, r.new_class_id) };
      return { recipients: [r.requested_by_user_id, ...(await family(tx, r.student_id))] };
    }
    case 'StudentEnrollmentApproved':
    case 'StudentEnrollmentInformationRequested':
    case 'StudentEnrollmentRejected':
    case 'StudentEnrollmentWaitlisted': {
      const e = await tx.query(
        `SELECT ea.submitted_by_user_id, ea.guardian_id, ea.student_id, c.name AS class_name
         FROM enrollment_applications ea LEFT JOIN classes c ON c.id = ea.class_id
         WHERE ea.id = $1 AND ea.organization_id = $2`, [row.aggregate_id, org]);
      if (!e.rows.length) return { recipients: [] };
      const r = e.rows[0];
      return { recipients: [r.submitted_by_user_id, r.guardian_id, ...(await family(tx, r.student_id))], extra: { className: r.class_name } };
    }
    default:
      return { recipients: [] };
  }
}

function safeParams(row: OutboxRow, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const allowed = SAFE_PARAMS[row.event_type] || [];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const v = extra[key] ?? row.payload?.[key];
    if (v !== undefined && v !== null && (typeof v === 'string' || typeof v === 'number')) out[key] = String(v).slice(0, 120);
  }
  return out;
}

export interface DeliveryResult { processed: number; delivered: number; errors: string[] }

/** Processes up to `limit` pending outbox rows. Safe to run concurrently and repeatedly. */
export async function deliverNotificationOutbox(limit = 200): Promise<DeliveryResult> {
  const result: DeliveryResult = { processed: 0, delivered: 0, errors: [] };
  const pending = await dbClient.query(
    `SELECT id FROM notification_outbox WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1`, [limit]);

  for (const { id } of pending.rows) {
    try {
      await dbClient.transaction(async (tx: Tx) => {
        const locked = await tx.query(
          `SELECT id, organization_id, event_type, aggregate_type, aggregate_id, payload
           FROM notification_outbox WHERE id = $1 AND status = 'PENDING' FOR UPDATE`, [id]);
        if (!locked.rows.length) return; // another worker took it
        const row: OutboxRow = locked.rows[0];
        if (typeof row.payload === 'string') row.payload = JSON.parse(row.payload);

        const { recipients, extra = {} } = await resolve(tx, row);
        const unique = Array.from(new Set(recipients.filter(Boolean)));
        let allowed: string[] = [];
        if (unique.length) {
          const users = await tx.query(
            `SELECT id FROM users WHERE id = ANY($1::text[]) AND status = 'ACTIVE' AND role <> 'SUPER_ADMIN'`, [unique]);
          allowed = ids(users.rows, 'id');
        }
        const params = JSON.stringify(safeParams(row, extra));
        for (const userId of allowed) {
          const ins = await tx.query(
            `INSERT INTO user_notifications (id, organization_id, user_id, outbox_id, event_type, aggregate_type, aggregate_id, params)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (outbox_id, user_id) DO NOTHING
             RETURNING id`,
            [newId('unt'), row.organization_id, userId, row.id, row.event_type, row.aggregate_type, row.aggregate_id, params]);
          result.delivered += ins.rows.length;
        }
        await tx.query(`UPDATE notification_outbox SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP WHERE id = $1`, [row.id]);
        result.processed++;
      });
    } catch (err) {
      result.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}
