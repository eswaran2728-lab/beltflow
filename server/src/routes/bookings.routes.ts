import { Router, Request, Response } from 'express';
import { dbClient, SqlTransactionClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { requireWorkerOrSuperAdmin } from '../middleware/workerAuth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Internal helper for checking master access to a class
async function assignedMasterAccess(user: any, classId: string): Promise<boolean> {
  if (user.role !== UserRole.MASTER) return false;
  const leadRes = await dbClient.query(
    'SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE',
    [classId, user.id]
  );
  if (leadRes.rowCount && leadRes.rowCount > 0) return true;

  const coachRes = await dbClient.query(
    'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
    [classId, user.id]
  );
  return (coachRes.rowCount ?? 0) > 0;
}

// Internal waitlist promotion logic reusable inside transactions
export async function promoteWaitlistInternal(
  tx: SqlTransactionClient,
  sessionId: string,
  organizationId: string
): Promise<any | null> {
  // 1. Expire any stale offers for this session first
  await tx.query(
    `UPDATE make_up_bookings
     SET status = 'EXPIRED',
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE session_id = $1 AND status = 'OFFERED' AND offer_expires_at <= CURRENT_TIMESTAMP`,
    [sessionId]
  );

  // 2. Lock session and class
  const sessRes = await tx.query(
    `SELECT s.*, c.capacity, c.organization_id AS class_org_id, c.name AS class_name
     FROM training_sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1 FOR UPDATE`,
    [sessionId]
  );
  if (sessRes.rowCount === 0) return null;
  const sess = sessRes.rows[0];

  // 3. Count occupied places (excluding expired offers)
  const homeCountRes = await tx.query(
    "SELECT count(*)::int AS count FROM students WHERE class_id = $1 AND status = 'ACTIVE'",
    [sess.class_id]
  );
  const makeupCountRes = await tx.query(
    `SELECT count(*)::int AS count FROM make_up_bookings
     WHERE session_id = $1
       AND (status = 'CONFIRMED' OR (status = 'OFFERED' AND (offer_expires_at IS NULL OR offer_expires_at > CURRENT_TIMESTAMP)))`,
    [sessionId]
  );
  const occupied = Number(homeCountRes.rows[0]?.count || 0) + Number(makeupCountRes.rows[0]?.count || 0);
  const capacityLimit = Number(sess.capacity || 30);

  if (occupied >= capacityLimit) {
    return null; // No seats to promote into
  }

  // 4. Find next waitlisted booking (FIFO)
  const nextWlRes = await tx.query(
    `SELECT * FROM make_up_bookings
     WHERE session_id = $1 AND status = 'WAITLISTED'
     ORDER BY waitlist_position ASC, created_at ASC
     LIMIT 1 FOR UPDATE`,
    [sessionId]
  );
  if (nextWlRes.rowCount === 0) return null;
  const nextBooking = nextWlRes.rows[0];

  // 5. Promote to OFFERED with 24-hour expiry
  const offerExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  const promotedRes = await tx.query(
    `UPDATE make_up_bookings
     SET status = 'OFFERED',
         offer_expires_at = $1,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING *`,
    [offerExpiresAt, nextBooking.id]
  );

  // 6. Re-index remaining waitlisted items for this session
  await tx.query(
    `WITH ranked AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY waitlist_position ASC, created_at ASC) as new_pos
       FROM make_up_bookings
       WHERE session_id = $1 AND status = 'WAITLISTED'
     )
     UPDATE make_up_bookings b
     SET waitlist_position = ranked.new_pos,
         updated_at = CURRENT_TIMESTAMP
     FROM ranked
     WHERE b.id = ranked.id`,
    [sessionId]
  );

  // 6. Record notification outbox event for family
  await tx.query(
    `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, $2, 'WaitlistOfferAvailable', 'make_up_booking', $3, $4)`,
    [
      newId('ntf'),
      organizationId,
      nextBooking.id,
      JSON.stringify({
        bookingId: nextBooking.id,
        studentId: nextBooking.student_id,
        sessionId,
        className: sess.class_name,
        sessionDate: sess.session_date,
        offerExpiresAt,
      }),
    ]
  );

  // 7. Audit log
  await tx.query(
    `INSERT INTO audit_logs (id, action, details, user_role, user_email)
     VALUES ($1, 'Waitlist Place Offered', $2, 'SYSTEM', 'system@beltflow.test')`,
    [
      newId('audit'),
      `Waitlist candidate ${nextBooking.student_id} offered place in session ${sessionId} for class ${sess.class_name}`,
    ]
  );

  return promotedRes.rows[0];
}

// 1. Request Make-Up Class (Parent, Student, or Master)
router.post('/make-up/request', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { studentId, targetSessionId, reason } = req.body;

    if (!studentId || !targetSessionId) {
      return res.status(400).json({ error: 'studentId and targetSessionId are required.' });
    }

    // 1. Fetch Student & verify actor authorization
    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = studentRes.rows[0];

    // Authorization
    if (user.role === UserRole.STUDENT) {
      if (student.user_id !== user.id) {
        return res.status(403).json({ error: 'Students can only request make-ups for their own profile.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const linkCheck = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, student.id]
      );
      if (linkCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Parent is not verified for this child student.' });
      }
    } else if (user.role === UserRole.MASTER) {
      const homeMasterCheck = await assignedMasterAccess(user, student.class_id);
      if (!homeMasterCheck && user.organizationId !== student.organization_id) {
        return res.status(403).json({ error: 'Master cannot request make-up for unmanaged student.' });
      }
    } else if (user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }

    // 2. Fetch target Session & Class
    const sessRes = await dbClient.query(
      `SELECT s.*, c.organization_id AS class_org_id, c.capacity, c.name AS class_name,
              c.training_level, c.age_eligibility, c.program_type, c.approval_status, c.operational_status
       FROM training_sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [targetSessionId]
    );
    if (sessRes.rowCount === 0) {
      return res.status(404).json({ error: 'Target training session not found.' });
    }
    const targetSession = sessRes.rows[0];

    // Acceptance Test: no_cross_tenant_booking
    if (student.organization_id !== targetSession.class_org_id) {
      return res.status(403).json({
        error: 'Cross-Persatuan make-up booking is strictly prohibited. Student and session belong to different organizations.',
      });
    }

    // Check student primary status (must be ACTIVE)
    if (student.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Student membership is not active. Make-ups require an active membership.' });
    }

    // Check same-class booking
    if (student.class_id === targetSession.class_id) {
      return res.status(400).json({ error: 'Cannot book a make-up in the student\'s own primary class session.' });
    }

    // Acceptance Test: ineligible_student_rejected
    // Verify Program / Training Level / Belt Rank Compatibility
    if (targetSession.training_level) {
      const level = targetSession.training_level.toLowerCase();
      const studentBelt = (student.belt_rank || '').toLowerCase();
      if ((level.includes('advanced') || level.includes('black')) && (studentBelt.includes('white') || studentBelt.includes('yellow'))) {
        return res.status(422).json({
          error: `Ineligible student: ${student.belt_rank} cannot book into an ${targetSession.training_level} session.`,
        });
      }
    }

    // Check if duplicate active make-up booking already exists for this session
    const existingBooking = await dbClient.query(
      `SELECT id, status FROM make_up_bookings
       WHERE student_id = $1 AND session_id = $2
         AND status IN ('REQUESTED', 'CONFIRMED', 'WAITLISTED', 'OFFERED')`,
      [student.id, targetSession.id]
    );
    if (existingBooking.rowCount && existingBooking.rowCount > 0) {
      return res.status(409).json({ error: 'Student already has an active make-up booking or waitlist request for this session.' });
    }

    // 3. Concurrency-Safe Transaction: Capacity check and Booking creation
    const bookingResult = await dbClient.transaction(async (tx) => {
      // Row-lock target class
      await tx.query('SELECT * FROM classes WHERE id = $1 FOR UPDATE', [targetSession.class_id]);

      // Count participants
      const homeCountRes = await tx.query(
        "SELECT count(*)::int AS count FROM students WHERE class_id = $1 AND status = 'ACTIVE'",
        [targetSession.class_id]
      );
      const makeupCountRes = await tx.query(
        `SELECT count(*)::int AS count FROM make_up_bookings
         WHERE session_id = $1
           AND (status = 'CONFIRMED' OR (status = 'OFFERED' AND (offer_expires_at IS NULL OR offer_expires_at > CURRENT_TIMESTAMP)))`,
        [targetSession.id]
      );
      const occupied = Number(homeCountRes.rows[0]?.count || 0) + Number(makeupCountRes.rows[0]?.count || 0);
      const capacityLimit = Number(targetSession.capacity || 30);

      const bookingId = newId('mbk');
      let initialStatus = 'REQUESTED';
      let waitlistPos: number | null = null;

      if (occupied >= capacityLimit) {
        // Class is full -> Place on Waitlist
        initialStatus = 'WAITLISTED';
        const wlCountRes = await tx.query(
          "SELECT count(*)::int AS count FROM make_up_bookings WHERE session_id = $1 AND status = 'WAITLISTED'",
          [targetSession.id]
        );
        waitlistPos = Number(wlCountRes.rows[0]?.count || 0) + 1;
      } else {
        // If requested by target class Master directly, can confirm immediately
        const isTargetMaster = user.role === UserRole.MASTER && (await assignedMasterAccess(user, targetSession.class_id));
        if (isTargetMaster) {
          initialStatus = 'CONFIRMED';
        }
      }

      const insertRes = await tx.query(
        `INSERT INTO make_up_bookings (
           id, organization_id, student_id, home_class_id, target_class_id, session_id,
           requested_by_user_id, status, reason, eligibility_notes, waitlist_position,
           approved_by_master_id, approved_at, version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1)
         RETURNING *`,
        [
          bookingId,
          student.organization_id,
          student.id,
          student.class_id,
          targetSession.class_id,
          targetSession.id,
          user.id,
          initialStatus,
          reason?.trim() || 'Make-up training session',
          `Home Class: ${student.class_id}; Belt: ${student.belt_rank}`,
          waitlistPos,
          initialStatus === 'CONFIRMED' ? user.id : null,
          initialStatus === 'CONFIRMED' ? new Date() : null,
        ]
      );

      // Audit log
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, 'Make-Up Requested', $2, $3, $4)`,
        [
          newId('audit'),
          `Make-up request for ${student.full_name} in ${targetSession.class_name} session ${targetSession.session_date} (status: ${initialStatus})`,
          user.role,
          user.email,
        ]
      );

      return insertRes.rows[0];
    });

    return res.status(201).json({
      message: bookingResult.status === 'WAITLISTED'
        ? `Class is at capacity. Placed on waitlist (Position #${bookingResult.waitlist_position}).`
        : bookingResult.status === 'CONFIRMED'
        ? 'Make-up class confirmed.'
        : 'Make-up class requested. Awaiting Master approval.',
      booking: bookingResult,
    });
  } catch (err: any) {
    console.error('[Request make-up error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to request make-up.') });
  }
});

// 2. Approve Make-Up Class (Master of target class only)
// Acceptance Test: simultaneous_last_seat_one_booking & make_up_does_not_change_primary_class
router.post('/make-up/:bookingId/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { expectedVersion } = req.body;

    const bookingRes = await dbClient.query('SELECT * FROM make_up_bookings WHERE id = $1', [req.params.bookingId]);
    if (bookingRes.rowCount === 0) {
      return res.status(404).json({ error: 'Make-up booking not found.' });
    }
    const booking = bookingRes.rows[0];

    // Master of target class authority
    const isAuthorizedMaster = user.role === UserRole.MASTER && (await assignedMasterAccess(user, booking.target_class_id));
    if (!isAuthorizedMaster) {
      return res.status(403).json({ error: 'Only the assigned Master of the target class can approve make-up bookings.' });
    }

    if (expectedVersion !== undefined && Number(booking.version) !== Number(expectedVersion)) {
      return res.status(409).json({ error: `Version conflict: Expected version ${expectedVersion}, found ${booking.version}.` });
    }

    if (booking.status === 'CONFIRMED') {
      return res.json({ message: 'Make-up booking is already confirmed.', booking, idempotentReplay: true });
    }

    // Concurrency-Safe Transaction: Row-lock class & check remaining capacity
    const updated = await dbClient.transaction(async (tx) => {
      // 1. Lock class & session
      const classRes = await tx.query('SELECT * FROM classes WHERE id = $1 FOR UPDATE', [booking.target_class_id]);
      const cls = classRes.rows[0];

      // 2. Count occupied
      const homeCountRes = await tx.query(
        "SELECT count(*)::int AS count FROM students WHERE class_id = $1 AND status = 'ACTIVE'",
        [cls.id]
      );
      const makeupCountRes = await tx.query(
        `SELECT count(*)::int AS count FROM make_up_bookings
         WHERE session_id = $1
           AND (status = 'CONFIRMED' OR (status = 'OFFERED' AND (offer_expires_at IS NULL OR offer_expires_at > CURRENT_TIMESTAMP)))`,
        [booking.session_id]
      );
      const occupied = Number(homeCountRes.rows[0]?.count || 0) + Number(makeupCountRes.rows[0]?.count || 0);
      const capacityLimit = Number(cls.capacity || 30);

      // Acceptance Test: simultaneous_last_seat_one_booking
      if (occupied >= capacityLimit) {
        const err: any = new Error(`Simultaneous booking conflict: Last seat was taken (${occupied}/${capacityLimit}). Cannot confirm make-up.`);
        err.statusCode = 409;
        throw err;
      }

      // 3. Confirm make-up
      const updRes = await tx.query(
        `UPDATE make_up_bookings
         SET status = 'CONFIRMED',
             approved_by_master_id = $1,
             approved_at = CURRENT_TIMESTAMP,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [user.id, booking.id]
      );

      // 4. Pre-register session attendance entitlement (without duplicating primary enrollment)
      await tx.query(
        `INSERT INTO session_attendance (id, session_id, student_id, status, marked_by)
         VALUES ($1, $2, $3, 'Booked', $4)
         ON CONFLICT (session_id, student_id) DO NOTHING`,
        [newId('att'), booking.session_id, booking.student_id, user.id]
      );

      // 5. Audit log
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, 'Make-Up Approved', $2, $3, $4)`,
        [
          newId('audit'),
          `Make-up booking ${booking.id} confirmed for student ${booking.student_id} in class ${cls.name} by Master ${user.email}`,
          user.role,
          user.email,
        ]
      );

      return updRes.rows[0];
    });

    return res.json({
      message: 'Make-up booking approved successfully.',
      booking: updated,
    });
  } catch (err: any) {
    console.error('[Approve make-up error]', err);
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to approve make-up.') });
  }
});

// 3. Cancel Make-Up Booking or Decline Offer
// Acceptance Test: cancelled_offer_releases_place
router.post('/make-up/:bookingId/cancel', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const bookingRes = await dbClient.query('SELECT * FROM make_up_bookings WHERE id = $1', [req.params.bookingId]);
    if (bookingRes.rowCount === 0) {
      return res.status(404).json({ error: 'Make-up booking not found.' });
    }
    const booking = bookingRes.rows[0];

    // Authorization: Requester, Student, Parent, or Target Master
    const isRequester = booking.requested_by_user_id === user.id;
    const isMaster = user.role === UserRole.MASTER && (await assignedMasterAccess(user, booking.target_class_id));
    if (!isRequester && !isMaster && user.role !== UserRole.ADMIN_PERSATUAN) {
      return res.status(403).json({ error: 'Not authorized to cancel this make-up booking.' });
    }

    const wasActiveSeat = ['CONFIRMED', 'OFFERED'].includes(booking.status);

    const result = await dbClient.transaction(async (tx) => {
      const updRes = await tx.query(
        `UPDATE make_up_bookings
         SET status = 'CANCELLED',
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [booking.id]
      );

      // Remove pre-registered attendance entitlement if present
      await tx.query('DELETE FROM session_attendance WHERE session_id = $1 AND student_id = $2', [
        booking.session_id,
        booking.student_id,
      ]);

      // If an active seat was released, trigger automatic waitlist promotion!
      let promotedCandidate: any = null;
      if (wasActiveSeat) {
        promotedCandidate = await promoteWaitlistInternal(tx, booking.session_id, booking.organization_id);
      }

      return {
        cancelledBooking: updRes.rows[0],
        promotedCandidate,
      };
    });

    return res.json({
      message: 'Make-up booking cancelled. Place released.',
      cancelledBooking: result.cancelledBooking,
      promotedCandidate: result.promotedCandidate,
    });
  } catch (err: any) {
    console.error('[Cancel make-up error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to cancel make-up.') });
  }
});

// 4. Promote Waitlist Manually (Contract: promoteWaitlist(sessionId))
router.post('/waitlist/promote/:sessionId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const sessionId = req.params.sessionId;

    const sessRes = await dbClient.query('SELECT * FROM training_sessions WHERE id = $1', [sessionId]);
    if (sessRes.rowCount === 0) {
      return res.status(404).json({ error: 'Training session not found.' });
    }
    const sess = sessRes.rows[0];

    const isMaster = user.role === UserRole.MASTER && (await assignedMasterAccess(user, sess.class_id));
    const isAdmin = user.role === UserRole.ADMIN_PERSATUAN && user.organizationId === sess.organization_id;
    if (!isMaster && !isAdmin) {
      return res.status(403).json({ error: 'Only the assigned Master or Admin can trigger waitlist promotion.' });
    }

    const promoted = await dbClient.transaction(async (tx) => {
      await sweepExpiredWaitlistOffers(tx);
      return await promoteWaitlistInternal(tx, sessionId, sess.organization_id);
    });

    if (!promoted) {
      return res.status(200).json({
        message: 'No candidates promoted (either session capacity is full or waitlist is empty).',
        promoted: null,
      });
    }

    return res.json({
      message: 'Waitlisted student promoted successfully.',
      promoted,
    });
  } catch (err: any) {
    console.error('[Promote waitlist error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to promote waitlist.') });
  }
});

// 4b. Accept Waitlist Offer (Student or Parent)
router.post('/make-up/:bookingId/accept', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const bookingRes = await dbClient.query('SELECT * FROM make_up_bookings WHERE id = $1', [req.params.bookingId]);
    if (bookingRes.rowCount === 0) {
      return res.status(404).json({ error: 'Make-up booking not found.' });
    }
    const booking = bookingRes.rows[0];

    // Authorization
    if (user.role === UserRole.STUDENT) {
      const stu = await dbClient.query('SELECT user_id FROM students WHERE id = $1', [booking.student_id]);
      if (stu.rowCount === 0 || stu.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: 'Unauthorized.' });
      }
    } else if (user.role === UserRole.PARENT) {
      const link = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, booking.student_id]
      );
      if (link.rowCount === 0) {
        return res.status(403).json({ error: 'Parent not authorized for this child student.' });
      }
    } else if (user.role !== UserRole.ADMIN_PERSATUAN && user.role !== UserRole.MASTER) {
      return res.status(403).json({ error: 'Unauthorized role.' });
    }

    if (booking.status === 'CONFIRMED') {
      return res.json({ message: 'Booking is already confirmed.', booking });
    }

    if (booking.status !== 'OFFERED') {
      return res.status(400).json({ error: `Cannot accept booking with status ${booking.status}. Offer must be in OFFERED status.` });
    }

    // Check expiry
    const now = new Date();
    if (booking.offer_expires_at && new Date(booking.offer_expires_at) <= now) {
      // Lazily expire under transaction and promote next candidate
      await dbClient.transaction(async (tx) => {
        await tx.query(
          `UPDATE make_up_bookings
           SET status = 'EXPIRED',
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [booking.id]
        );
        await promoteWaitlistInternal(tx, booking.session_id, booking.organization_id);
      });
      return res.status(410).json({ error: 'Waitlist offer has expired and can no longer be accepted. Place released to next waitlist candidate.' });
    }

    // Accept offer within transaction
    const confirmed = await dbClient.transaction(async (tx) => {
      const updRes = await tx.query(
        `UPDATE make_up_bookings
         SET status = 'CONFIRMED',
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [booking.id]
      );

      // Pre-register session attendance entitlement as 'Booked'
      await tx.query(
        `INSERT INTO session_attendance (id, session_id, student_id, status, marked_by)
         VALUES ($1, $2, $3, 'Booked', $4)
         ON CONFLICT (session_id, student_id) DO NOTHING`,
        [newId('att'), booking.session_id, booking.student_id, user.id]
      );

      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, 'Waitlist Offer Accepted', $2, $3, $4)`,
        [
          newId('audit'),
          `Student ${booking.student_id} accepted waitlist offer for session ${booking.session_id}`,
          user.role,
          user.email,
        ]
      );

      return updRes.rows[0];
    });

    return res.json({ message: 'Waitlist offer accepted and make-up booking confirmed.', booking: confirmed });
  } catch (err: any) {
    console.error('[Accept offer error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to accept offer.') });
  }
});

// ----------------------------------------------------------------------------
// 4c. Sweep Expired Waitlist Offers (Worker / Periodic sweep)
// Enforces: BOOKING-EXPIRY-001
// ----------------------------------------------------------------------------
export async function sweepExpiredWaitlistOffers(client?: any): Promise<number> {
  const runner = client || dbClient;
  return await runner.transaction(async (tx: any) => {
    // 1. Find all expired OFFERED bookings FOR UPDATE
    const expiredRes = await tx.query(
      `SELECT * FROM make_up_bookings
       WHERE status = 'OFFERED'
         AND offer_expires_at IS NOT NULL
         AND offer_expires_at <= CURRENT_TIMESTAMP
       FOR UPDATE`
    );
    if (expiredRes.rowCount === 0) return 0;

    let expiredCount = 0;
    const sessionOrgPairs = new Map<string, string>();

    for (const b of expiredRes.rows) {
      await tx.query(
        `UPDATE make_up_bookings
         SET status = 'EXPIRED',
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [b.id]
      );
      sessionOrgPairs.set(b.session_id, b.organization_id);
      expiredCount++;
    }

    // 2. For each affected session, promote the next waitlisted candidate
    for (const [sessionId, orgId] of sessionOrgPairs.entries()) {
      await promoteWaitlistInternal(tx, sessionId, orgId);
    }

    return expiredCount;
  });
}

router.post('/waitlist/sweep-expired', requireWorkerOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const expiredCount = await sweepExpiredWaitlistOffers();
    return res.json({ message: 'Expired waitlist offers processed.', expiredCount });
  } catch (err: any) {
    console.error('[Sweep expired waitlist error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to sweep expired waitlist offers.') });
  }
});

// 5. Get Session Bookings & Waitlist Queue
router.get('/sessions/:sessionId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    await sweepExpiredWaitlistOffers();
    const sessRes = await dbClient.query(
      `SELECT s.*, c.name AS class_name, c.capacity, c.organization_id
       FROM training_sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [req.params.sessionId]
    );
    if (sessRes.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    const sess = sessRes.rows[0];

    // Bookings list
    const bookingsRes = await dbClient.query(
      `SELECT mb.*, s.full_name AS student_name, s.belt_rank AS student_belt,
              u.full_name AS requester_name
       FROM make_up_bookings mb
       JOIN students s ON s.id = mb.student_id
       LEFT JOIN users u ON u.id = mb.requested_by_user_id
       WHERE mb.session_id = $1
       ORDER BY mb.status = 'CONFIRMED' DESC, mb.waitlist_position ASC NULLS LAST, mb.created_at ASC`,
      [sess.id]
    );

    const homeCountRes = await dbClient.query(
      "SELECT count(*)::int AS count FROM students WHERE class_id = $1 AND status = 'ACTIVE'",
      [sess.class_id]
    );

    const now = new Date();
    const confirmedMakeups = bookingsRes.rows.filter(
      (b) => b.status === 'CONFIRMED' || (b.status === 'OFFERED' && (!b.offer_expires_at || new Date(b.offer_expires_at) > now))
    );
    const waitlisted = bookingsRes.rows.filter((b) => b.status === 'WAITLISTED');

    return res.json({
      session: sess,
      capacity: Number(sess.capacity || 30),
      enrolledHomeCount: Number(homeCountRes.rows[0]?.count || 0),
      confirmedMakeupCount: confirmedMakeups.length,
      availableSeats: Math.max(0, Number(sess.capacity || 30) - Number(homeCountRes.rows[0]?.count || 0) - confirmedMakeups.length),
      bookings: bookingsRes.rows,
      waitlist: waitlisted,
    });
  } catch (err: any) {
    console.error('[Get session bookings error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch bookings.') });
  }
});

// 6. Get Student Make-Up Bookings
router.get('/student/:studentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const studentRes = await dbClient.query('SELECT * FROM students WHERE id = $1', [req.params.studentId]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = studentRes.rows[0];

    // Permission
    if (user.role === UserRole.STUDENT && student.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (user.role === UserRole.PARENT) {
      const link = await dbClient.query(
        "SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'",
        [user.id, student.id]
      );
      if (link.rowCount === 0) {
        return res.status(403).json({ error: 'Access denied to unlinked student.' });
      }
    }

    const bookingsRes = await dbClient.query(
      `SELECT mb.*, s.session_date, s.start_time, s.end_time, s.location,
              c.name AS target_class_name
       FROM make_up_bookings mb
       JOIN training_sessions s ON s.id = mb.session_id
       JOIN classes c ON c.id = mb.target_class_id
       WHERE mb.student_id = $1
       ORDER BY s.session_date DESC, mb.created_at DESC`,
      [student.id]
    );

    return res.json({ bookings: bookingsRes.rows });
  } catch (err: any) {
    console.error('[Get student make-ups error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch student make-ups.') });
  }
});

export default router;
