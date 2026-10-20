import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// ----------------------------------------------------------------------------
// 1. Get All Linked Children for Parent
// Enforces: revoked_guardian_loses_access (only ACTIVE links)
// Enforces: long_multilingual_child_names_readable
// ----------------------------------------------------------------------------
router.get('/children', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.PARENT && user.role !== UserRole.ADMIN_PERSATUAN && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied. Only guardians can access family children roster.' });
    }

    if (user.role === UserRole.PARENT) {
      const result = await dbClient.query(
        `SELECT s.id, s.full_name, s.ic_number, s.belt_rank, s.monthly_fee, s.billing_status, s.status,
                s.class_id, c.name AS class_name, c.location AS class_location,
                s.organization_id, o.name AS organization_name,
                psl.status AS link_status, psl.created_at AS linked_at
         FROM parent_student_links psl
         JOIN students s ON s.id = psl.student_id
         LEFT JOIN classes c ON c.id = s.class_id
         JOIN organizations o ON o.id = s.organization_id
         WHERE psl.parent_id = $1 AND psl.status = 'ACTIVE'
         ORDER BY s.full_name ASC`,
        [user.id]
      );
      return res.json({ children: result.rows });
    }

    // Admin view
    const adminRes = await dbClient.query(
      `SELECT s.id, s.full_name, s.ic_number, s.belt_rank, s.monthly_fee, s.billing_status, s.status,
              s.class_id, c.name AS class_name, c.location AS class_location,
              s.organization_id, o.name AS organization_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.organization_id = $1
       ORDER BY s.full_name ASC`,
      [user.organizationId]
    );
    return res.json({ children: adminRes.rows });
  } catch (err: any) {
    console.error('[Get family children error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch family children.') });
  }
});

// ----------------------------------------------------------------------------
// 2. Get Child Timeline (getChildTimeline)
// Enforces: revoked_guardian_loses_access
// Enforces: long_multilingual_child_names_readable
// Enforces: family_totals_correct_per_merchant
// ----------------------------------------------------------------------------
router.get('/students/:studentId/timeline', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { studentId } = req.params;

    // Check student existence
    const studentRes = await dbClient.query(
      `SELECT s.*, c.name AS class_name, c.schedule AS class_schedule, c.location AS class_location,
              o.name AS organization_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.id = $1`,
      [studentId]
    );

    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const student = studentRes.rows[0];

    // CRITICAL SECURITY ENFORCEMENT: revoked_guardian_loses_access
    if (user.role === UserRole.PARENT) {
      const linkCheck = await dbClient.query(
        'SELECT status FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
        [user.id, studentId]
      );

      if (linkCheck.rowCount === 0 || linkCheck.rows[0].status !== 'ACTIVE') {
        return res.status(403).json({
          error: 'Access denied. Guardian access has been revoked or is not active.',
          linkStatus: linkCheck.rows[0]?.status || 'NONE',
        });
      }
    } else if (user.role === UserRole.STUDENT) {
      if (student.user_id !== user.id) {
        return res.status(403).json({ error: 'Access denied. You can only view your own timeline.' });
      }
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      if (student.organization_id !== user.organizationId) {
        return res.status(403).json({ error: 'Access denied to students in another Persatuan.' });
      }
    }

    // 1. Attendance Timeline (Descending by date)
    const attendanceRes = await dbClient.query(
      `SELECT ar.id, ar.session_date, ar.status, ar.marked_at,
              c.name AS class_name
       FROM attendance_records ar
       JOIN classes c ON c.id = ar.class_id
       WHERE ar.student_id = $1
       ORDER BY ar.session_date DESC, ar.marked_at DESC
       LIMIT 50`,
      [studentId]
    );

    // 2. Grading & Belt Progress Timeline
    const rankHistoryRes = await dbClient.query(
      `SELECT srh.*, c.code AS certificate_code, c.verification_token
       FROM student_rank_history srh
       LEFT JOIN certificates c ON c.id = srh.certificate_id
       WHERE srh.student_id = $1
       ORDER BY srh.awarded_at DESC`,
      [studentId]
    );

    // 3. Upcoming Training Sessions for Student's Class
    const upcomingSessionsRes = await dbClient.query(
      `SELECT ts.id, ts.session_date, ts.day_of_week, ts.start_time, ts.end_time, ts.location, ts.status,
              c.name AS class_name, tg.name AS group_name
       FROM training_sessions ts
       JOIN classes c ON c.id = ts.class_id
       LEFT JOIN training_groups tg ON tg.id = ts.group_id
       WHERE ts.class_id = $1 AND ts.status = 'Scheduled' AND ts.session_date >= CURRENT_DATE::text
       ORDER BY ts.session_date ASC, ts.start_time ASC
       LIMIT 10`,
      [student.class_id]
    );

    // 4. Financial Ledger Partitioned Strictly Per Merchant (family_totals_correct_per_merchant)
    // Monthly Dues for this student
    const duesRes = await dbClient.query(
      `SELECT md.*, o.id AS org_id, o.name AS org_name, c.name AS class_name,
              pm.id AS merchant_id, pm.merchant_name, pm.status AS merchant_status
       FROM monthly_dues md
       JOIN organizations o ON o.id = md.organization_id
       JOIN classes c ON c.id = md.class_id
       LEFT JOIN persatuan_merchants pm ON pm.organization_id = o.id AND pm.status = 'ACTIVE'
       WHERE md.student_id = $1
       ORDER BY md.billing_month DESC`,
      [studentId]
    );

    // Invoices for this student
    const invoicesRes = await dbClient.query(
      `SELECT inv.*, o.id AS org_id, o.name AS org_name
       FROM invoices inv
       JOIN organizations o ON o.id = inv.organization_id
       WHERE inv.student_id = $1
       ORDER BY inv.created_at DESC`,
      [studentId]
    );

    // Payments for this student
    const paymentsRes = await dbClient.query(
      `SELECT p.*, o.name AS org_name
       FROM payments p
       JOIN organizations o ON o.id = p.organization_id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC`,
      [studentId]
    );

    // Group dues cleanly by Merchant / Organization
    const merchantGroups = new Map<string, any>();

    for (const due of duesRes.rows) {
      const orgId = due.org_id;
      if (!merchantGroups.has(orgId)) {
        merchantGroups.set(orgId, {
          organizationId: orgId,
          merchantName: due.merchant_name || due.org_name,
          currency: 'MYR',
          totalFeeAmount: 0,
          totalAmountPaid: 0,
          totalOutstandingAmount: 0,
          dues: [],
          invoices: [],
          payments: [],
        });
      }
      const mGroup = merchantGroups.get(orgId);
      const fee = parseFloat(due.fee_amount) || 0;
      const paid = parseFloat(due.amount_paid) || 0;
      mGroup.totalFeeAmount = Math.round((mGroup.totalFeeAmount + fee) * 100) / 100;
      mGroup.totalAmountPaid = Math.round((mGroup.totalAmountPaid + paid) * 100) / 100;
      mGroup.totalOutstandingAmount = Math.round((mGroup.totalFeeAmount - mGroup.totalAmountPaid) * 100) / 100;
      mGroup.dues.push({
        id: due.id,
        billingMonth: due.billing_month,
        feeAmount: fee,
        amountPaid: paid,
        status: due.status,
        className: due.class_name,
      });
    }

    // Attach invoices and payments to corresponding merchant group
    for (const inv of invoicesRes.rows) {
      if (merchantGroups.has(inv.org_id)) {
        merchantGroups.get(inv.org_id).invoices.push(inv);
      }
    }
    for (const p of paymentsRes.rows) {
      if (merchantGroups.has(p.organization_id)) {
        merchantGroups.get(p.organization_id).payments.push(p);
      }
    }

    const merchantPartitions = Array.from(merchantGroups.values());

    return res.json({
      student: {
        id: student.id,
        fullName: student.full_name, // Preserves long multilingual characters
        icNumber: student.ic_number,
        beltRank: student.belt_rank,
        monthlyFee: parseFloat(student.monthly_fee) || 120.00,
        billingStatus: student.billing_status,
        status: student.status,
        registeredAt: student.registered_at,
        classId: student.class_id,
        className: student.class_name,
        classSchedule: student.class_schedule,
        classLocation: student.class_location,
        organizationId: student.organization_id,
        organizationName: student.organization_name,
      },
      attendance: attendanceRes.rows,
      rankHistory: rankHistoryRes.rows,
      upcomingSessions: upcomingSessionsRes.rows,
      financialPartitions: merchantPartitions,
    });
  } catch (err: any) {
    console.error('[Get child timeline error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch child timeline.') });
  }
});

// ----------------------------------------------------------------------------
// 3. Get Combined Family Merchant Financial Summary
// Enforces: family_totals_correct_per_merchant
// ----------------------------------------------------------------------------
router.get('/merchant-dues-summary', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.PARENT && user.role !== UserRole.ADMIN_PERSATUAN && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get linked student IDs
    let studentIds: string[] = [];
    if (user.role === UserRole.PARENT) {
      const links = await dbClient.query(
        "SELECT student_id FROM parent_student_links WHERE parent_id = $1 AND status = 'ACTIVE'",
        [user.id]
      );
      studentIds = links.rows.map((r: any) => r.student_id);
      if (studentIds.length === 0) {
        return res.json({ merchants: [] });
      }
    } else {
      const stuRes = await dbClient.query('SELECT id FROM students WHERE organization_id = $1', [user.organizationId]);
      studentIds = stuRes.rows.map((r: any) => r.id);
    }

    const duesRes = await dbClient.query(
      `SELECT md.*, s.full_name AS student_name, o.id AS org_id, o.name AS org_name,
              pm.id AS merchant_id, pm.merchant_name
       FROM monthly_dues md
       JOIN students s ON s.id = md.student_id
       JOIN organizations o ON o.id = md.organization_id
       LEFT JOIN persatuan_merchants pm ON pm.organization_id = o.id AND pm.status = 'ACTIVE'
       WHERE md.student_id = ANY($1::text[])
       ORDER BY o.id, md.billing_month DESC`,
      [studentIds]
    );

    const merchantsMap = new Map<string, any>();

    for (const due of duesRes.rows) {
      const orgId = due.org_id;
      if (!merchantsMap.has(orgId)) {
        merchantsMap.set(orgId, {
          organizationId: orgId,
          merchantName: due.merchant_name || due.org_name,
          currency: 'MYR',
          totalFeeAmount: 0,
          totalAmountPaid: 0,
          totalOutstandingAmount: 0,
          studentDues: [],
        });
      }
      const m = merchantsMap.get(orgId);
      const fee = parseFloat(due.fee_amount) || 0;
      const paid = parseFloat(due.amount_paid) || 0;
      m.totalFeeAmount = Math.round((m.totalFeeAmount + fee) * 100) / 100;
      m.totalAmountPaid = Math.round((m.totalAmountPaid + paid) * 100) / 100;
      m.totalOutstandingAmount = Math.round((m.totalFeeAmount - m.totalAmountPaid) * 100) / 100;
      m.studentDues.push({
        dueId: due.id,
        studentId: due.student_id,
        studentName: due.student_name,
        billingMonth: due.billing_month,
        feeAmount: fee,
        amountPaid: paid,
        status: due.status,
      });
    }

    return res.json({
      merchants: Array.from(merchantsMap.values()),
    });
  } catch (err: any) {
    console.error('[Get merchant dues summary error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch merchant dues summary.') });
  }
});

export default router;
