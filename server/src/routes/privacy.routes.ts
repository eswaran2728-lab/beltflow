import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';
import { rateLimit } from '../middleware/rateLimit';
import { DATA_REQUEST_DUE_DAYS } from '../config/legal';
import { eraseStudentProfile, eraseUserAccount } from '../services/erasure';

/**
 * A person's rights over their own data (Malaysia PDPA):
 *  - GET  /privacy/my-data            download what is held about your account
 *  - POST /privacy/requests           ask for deletion, correction, or to withdraw consent
 *  - GET  /privacy/requests/mine      see your own requests
 *  - GET  /privacy/requests           (staff) requests waiting for you
 *  - POST /privacy/requests/:id/resolve  (staff) carry out or refuse a request
 *
 * Who handles a request: the Admin of the requester's own Persatuan. A
 * Persatuan Admin's own request (and one from an account with no Persatuan)
 * goes to the Super Admin, who therefore never handles family or child data.
 */
const router = Router();
const requestLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many requests. Please try again later.' });
const TYPES = ['DELETE', 'CORRECT', 'WITHDRAW_CONSENT'];

const present = (r: any) => ({
  id: r.id, type: r.type, status: r.status, details: r.details, studentId: r.student_id,
  createdAt: r.created_at, dueAt: r.due_at, resolvedAt: r.resolved_at, resolutionNote: r.resolution_note,
});

// ---------------------------------------------------------------------------
// Download my data
// ---------------------------------------------------------------------------
router.get('/my-data', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const me = req.user!;
    const account = (await dbClient.query(
      `SELECT id, full_name, email, phone, role, organization_id, status, created_at FROM users WHERE id = $1`, [me.id])).rows[0];
    const consents = await dbClient.query(
      `SELECT consent_type, document_version, accepted_at FROM user_consents WHERE user_id = $1 ORDER BY accepted_at`, [me.id]);
    const requests = await dbClient.query(`SELECT * FROM data_requests WHERE user_id = $1 ORDER BY created_at DESC`, [me.id]);

    // A student's own record, or a guardian's actively linked children.
    const students = me.role === UserRole.STUDENT
      ? await dbClient.query(
          `SELECT id, full_name, belt_rank, class_id, status, registered_at FROM students WHERE user_id = $1`, [me.id])
      : me.role === UserRole.PARENT
        ? await dbClient.query(
            `SELECT s.id, s.full_name, s.belt_rank, s.class_id, s.status, s.registered_at
             FROM parent_student_links l JOIN students s ON s.id = l.student_id
             WHERE l.parent_id = $1 AND l.status = 'ACTIVE'`, [me.id])
        : { rows: [] as any[] };
    const payments = await dbClient.query(
      `SELECT id, amount, method, status, receipt_no, created_at FROM payments WHERE submitted_by = $1 ORDER BY created_at DESC LIMIT 500`, [me.id]);

    res.setHeader('Content-Disposition', 'attachment; filename="beltflow-my-data.json"');
    return res.json({
      generatedAt: new Date().toISOString(),
      account: {
        id: account.id, fullName: account.full_name, email: account.email, phone: account.phone,
        role: account.role, organizationId: account.organization_id, status: account.status, createdAt: account.created_at,
      },
      consents: consents.rows.map((c: any) => ({ type: c.consent_type, documentVersion: c.document_version, acceptedAt: c.accepted_at })),
      [me.role === UserRole.STUDENT ? 'studentRecord' : 'children']: students.rows.map((s: any) => ({
        id: s.id, fullName: s.full_name, beltRank: s.belt_rank, classId: s.class_id, status: s.status, registeredAt: s.registered_at,
      })),
      paymentsSubmitted: payments.rows.map((p: any) => ({
        id: p.id, amount: Number(p.amount), method: p.method, status: p.status, receiptNo: p.receipt_no, createdAt: p.created_at,
      })),
      dataRequests: requests.rows.map(present),
      note: 'Attendance, grading and other class records are kept by your Persatuan. Ask its administrator for a copy.',
    });
  } catch (err: any) {
    console.error('[My data error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not prepare your data.') });
  }
});

// ---------------------------------------------------------------------------
// Make a request
// ---------------------------------------------------------------------------
router.post('/requests', requestLimit, authenticateJWT, async (req: Request, res: Response) => {
  try {
    const me = req.user!;
    const { type, details, studentId } = req.body || {};
    if (typeof type !== 'string' || !TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${TYPES.join(', ')}.` });
    }
    if (details !== undefined && (typeof details !== 'string' || details.length > 1000)) {
      return res.status(400).json({ error: 'details must be text of at most 1000 characters.' });
    }
    // A guardian may include one of their own actively linked children.
    let childId: string | null = null;
    if (studentId !== undefined && studentId !== null && studentId !== '') {
      const linked = typeof studentId === 'string' && me.role === UserRole.PARENT && (me.linkedStudentIds || []).includes(studentId);
      if (!linked) {
        return res.status(403).json({ error: 'You can only make a request for your own child.' });
      }
      childId = studentId;
    }

    const open = await dbClient.query(
      `SELECT id FROM data_requests WHERE user_id = $1 AND type = $2 AND status = 'OPEN' LIMIT 1`, [me.id, type]);
    if (open.rows.length > 0) {
      return res.status(409).json({ error: 'You already have an open request of this kind.', code: 'REQUEST_ALREADY_OPEN' });
    }

    const dueAt = new Date(Date.now() + DATA_REQUEST_DUE_DAYS * 86400000);
    const inserted = await dbClient.query(
      `INSERT INTO data_requests (id, user_id, organization_id, student_id, type, details, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [`dr_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`, me.id, me.organizationId || null, childId, type, details ? details.trim() : null, dueAt]
    );
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, 'Data Request Created', `${type} request ${inserted.rows[0].id}`, me.role, me.email]
    );
    return res.status(201).json({
      message: `Your request has been sent. You will get an answer within ${DATA_REQUEST_DUE_DAYS} days.`,
      request: present(inserted.rows[0]),
    });
  } catch (err: any) {
    console.error('[Data request error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not send your request.') });
  }
});

router.get('/requests/mine', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const rows = await dbClient.query(`SELECT * FROM data_requests WHERE user_id = $1 ORDER BY created_at DESC`, [req.user!.id]);
    return res.json({ requests: rows.rows.map(present) });
  } catch (err: any) {
    console.error('[Data request list error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not load your requests.') });
  }
});

// ---------------------------------------------------------------------------
// Staff: requests waiting for me
// ---------------------------------------------------------------------------
/** SQL condition (with its parameters) selecting the requests this staff member handles. */
function handledBy(user: NonNullable<Request['user']>): { where: string; params: any[] } | null {
  if (user.role === UserRole.ADMIN_PERSATUAN && user.organizationId) {
    // Own Persatuan's Masters, parents and students. Not other Admins, not themselves.
    return { where: `r.organization_id = $1 AND u.role IN ('MASTER', 'PARENT', 'STUDENT')`, params: [user.organizationId] };
  }
  if (user.role === UserRole.SUPER_ADMIN) {
    // Persatuan Admins and accounts with no Persatuan. Never family or child requests.
    return { where: `(u.role = 'ADMIN_PERSATUAN' OR r.organization_id IS NULL) AND u.id <> $1 AND r.student_id IS NULL`, params: [user.id] };
  }
  return null;
}

router.get('/requests', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const scope = handledBy(req.user!);
    if (!scope) return res.status(403).json({ error: 'Only an administrator can view data requests.' });
    const rows = await dbClient.query(
      `SELECT r.*, u.full_name AS requester_name, u.email AS requester_email, u.role AS requester_role
       FROM data_requests r JOIN users u ON u.id = r.user_id
       WHERE ${scope.where}
       ORDER BY (r.status = 'OPEN') DESC, r.due_at ASC`,
      scope.params
    );
    return res.json({
      requests: rows.rows.map((r: any) => ({
        ...present(r),
        requester: { name: r.requester_name, email: r.requester_email, role: r.requester_role },
        overdue: r.status === 'OPEN' && new Date(r.due_at).getTime() < Date.now(),
      })),
    });
  } catch (err: any) {
    console.error('[Data request admin list error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not load data requests.') });
  }
});

router.post('/requests/:id/resolve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const scope = handledBy(actor);
    if (!scope) return res.status(403).json({ error: 'Only an administrator can resolve data requests.' });
    const { action, note } = req.body || {};
    if (action !== 'COMPLETE' && action !== 'REJECT') {
      return res.status(400).json({ error: 'action must be COMPLETE or REJECT.' });
    }
    if (note !== undefined && (typeof note !== 'string' || note.length > 1000)) {
      return res.status(400).json({ error: 'note must be text of at most 1000 characters.' });
    }
    if (action === 'REJECT' && !(typeof note === 'string' && note.trim())) {
      return res.status(400).json({ error: 'A reason is required when a request is refused.' });
    }

    const idParam = scope.params.length + 1;
    const found = await dbClient.query(
      `SELECT r.* FROM data_requests r JOIN users u ON u.id = r.user_id WHERE ${scope.where} AND r.id = $${idParam}`,
      [...scope.params, req.params.id]
    );
    const request = found.rows[0];
    // Outside this person's scope looks the same as not existing.
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    // Claim it first, so two people (or a double click) cannot both act on it.
    const claimed = await dbClient.query(
      `UPDATE data_requests
       SET status = $2, resolved_by = $3, resolved_at = CURRENT_TIMESTAMP, resolution_note = $4
       WHERE id = $1 AND status = 'OPEN' RETURNING id`,
      [request.id, action === 'COMPLETE' ? 'COMPLETED' : 'REJECTED', actor.id, typeof note === 'string' ? note.trim() : null]
    );
    if (claimed.rows.length === 0) {
      return res.status(409).json({ error: 'This request has already been resolved.', code: 'REQUEST_ALREADY_RESOLVED' });
    }

    if (action === 'COMPLETE' && request.type === 'DELETE') {
      if (request.student_id) await eraseStudentProfile(request.student_id);
      await eraseUserAccount(request.user_id);
    }
    // CORRECT and WITHDRAW_CONSENT are carried out by the administrator in the
    // normal screens; completing the request records that it was done.

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, 'Data Request Resolved', `${request.type} request ${request.id}: ${action}`, actor.role, actor.email]
    );
    return res.json({
      message: action === 'COMPLETE'
        ? (request.type === 'DELETE' ? 'Personal details removed and access ended. Financial records are kept without those details.' : 'Request marked as completed.')
        : 'Request refused.',
    });
  } catch (err: any) {
    console.error('[Data request resolve error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not resolve the request.') });
  }
});

export default router;
