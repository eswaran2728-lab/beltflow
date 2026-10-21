import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// Metric version identifier as mandated by H23 specification
export const METRIC_VERSION = 'v2.0-h23';

export interface AcademyMetricsResult {
  metadata: {
    metricVersion: string;
    calculatedAt: string;
    scope: 'global' | 'organization' | 'class';
    period: string;
    organizationId?: string;
    organizationName?: string;
    classId?: string;
    className?: string;
  };
  enrollment: {
    activeEnrolledStudents: number;
    pendingApplicants: number;
    totalClassCapacity: number;
    capacityUtilizationPercent: number;
    activeClassesCount: number;
  };
  trialConversion: {
    totalTrialsBooked: number;
    trialsAttended: number;
    trialsConverted: number;
    conversionRatePercent: number;
  };
  retention: {
    activeStudents: number;
    pausedMemberships: number;
    transfersCount: number;
    retentionRatePercent: number;
  };
  ledgerTotals: {
    currency: string;
    totalCollected: number;
    totalOutstanding: number;
    siblingDiscountSavings: number;
  };
}

/**
 * CSV Formula Injection Prevention (OWASP):
 * If a value starts with =, +, -, @, \t, or \r, prefix with a single quote to neutralize formula execution in spreadsheets.
 */
export function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Helper to resolve and strictly enforce tenant/class authority server-side.
 * Throws 403 error message if actor attempts to expand scope.
 */
async function resolveAuthorizedScope(req: Request): Promise<{
  targetOrgId?: string;
  targetClassId?: string;
  targetScope: 'global' | 'organization' | 'class';
  assignedClassIds?: string[];
}> {
  const user = req.user!;
  const requestedOrgId = (req.query.organizationId as string) || req.body?.organizationId;
  const requestedClassId = (req.query.classId as string) || req.body?.classId;
  const requestedScope = (req.query.scope as string) || req.body?.scope;

  // 1. Parent and Student roles are strictly forbidden from Growth Analytics
  if (user.role === UserRole.PARENT || user.role === UserRole.STUDENT) {
    const err: any = new Error('Access denied. Growth analytics are restricted to administrative and teaching roles.');
    err.statusCode = 403;
    throw err;
  }

  // 2. Persatuan Admin Scope Enforcement
  if (user.role === UserRole.ADMIN_PERSATUAN) {
    if (!user.organizationId) {
      const err: any = new Error('Organization context missing for Persatuan Admin.');
      err.statusCode = 403;
      throw err;
    }
    if (requestedOrgId && requestedOrgId !== user.organizationId) {
      const err: any = new Error('Access denied. Cross-tenant organization analytics access is forbidden.');
      err.statusCode = 403;
      throw err;
    }

    if (requestedClassId) {
      // Verify class belongs to this organization
      const classCheck = await dbClient.query(
        'SELECT id FROM classes WHERE id = $1 AND organization_id = $2',
        [requestedClassId, user.organizationId]
      );
      if (classCheck.rowCount === 0) {
        const err: any = new Error('Access denied. Class does not belong to your organization.');
        err.statusCode = 403;
        throw err;
      }
      return { targetOrgId: user.organizationId, targetClassId: requestedClassId, targetScope: 'class' };
    }

    return { targetOrgId: user.organizationId, targetScope: 'organization' };
  }

  // 3. Master Scope Enforcement
  if (user.role === UserRole.MASTER) {
    if (!user.organizationId) {
      const err: any = new Error('Organization context missing for Master.');
      err.statusCode = 403;
      throw err;
    }

    if (requestedOrgId && requestedOrgId !== user.organizationId) {
      const err: any = new Error('Access denied. Cross-tenant organization analytics access is forbidden.');
      err.statusCode = 403;
      throw err;
    }

    // Masters cannot query or export organization-wide reports
    if (requestedScope === 'organization' && !requestedClassId) {
      const err: any = new Error('Access denied. Master cannot expand query or export scope beyond assigned classes.');
      err.statusCode = 403;
      throw err;
    }

    // Resolve active assigned classes for this Master
    const assignRes = await dbClient.query(
      `SELECT DISTINCT c.id FROM classes c
       LEFT JOIN coach_class_assignments cca ON cca.class_id = c.id AND cca.coach_id = $1
       LEFT JOIN class_leaderships cl ON cl.class_id = c.id AND cl.master_id = $1 AND cl.is_active = TRUE
       WHERE c.organization_id = $2 AND (c.master_id = $1 OR cca.coach_id IS NOT NULL OR cl.id IS NOT NULL)`,
      [user.id, user.organizationId]
    );
    const assignedIds = assignRes.rows.map((r: any) => r.id);

    if (requestedClassId) {
      if (!assignedIds.includes(requestedClassId)) {
        const err: any = new Error('Access denied. Master is not assigned to this class.');
        err.statusCode = 403;
        throw err;
      }
      return {
        targetOrgId: user.organizationId,
        targetClassId: requestedClassId,
        targetScope: 'class',
        assignedClassIds: assignedIds,
      };
    }

    if (assignedIds.length === 0) {
      return {
        targetOrgId: user.organizationId,
        targetScope: 'class',
        assignedClassIds: [],
      };
    }

    return {
      targetOrgId: user.organizationId,
      targetScope: 'class',
      assignedClassIds: assignedIds,
    };
  }

  // 4. Super Admin Scope Enforcement (Platform-level aggregate metrics only)
  if (user.role === UserRole.SUPER_ADMIN) {
    if (requestedClassId) {
      const err: any = new Error('Access denied. Super Admin is restricted to platform-level analytics and cannot access individual class operational records.');
      err.statusCode = 403;
      throw err;
    }
    if (requestedOrgId) {
      return { targetOrgId: requestedOrgId, targetScope: 'organization' };
    }
    return { targetScope: 'global' };
  }

  const err: any = new Error('Unauthorized role for analytics.');
  err.statusCode = 403;
  throw err;
}

/**
 * Core Metric Calculation Engine (getAcademyMetrics)
 * Implements server-authoritative calculations strictly meeting all 5 acceptance criteria.
 */
export async function calculateAcademyMetrics(
  targetScope: 'global' | 'organization' | 'class',
  targetOrgId?: string,
  targetClassId?: string,
  assignedClassIds?: string[],
  period: string = 'current_month'
): Promise<AcademyMetricsResult> {
  const now = new Date();
  let orgName: string | undefined;
  let className: string | undefined;

  if (targetOrgId) {
    const oRes = await dbClient.query('SELECT name FROM organizations WHERE id = $1', [targetOrgId]);
    orgName = oRes.rows[0]?.name;
  }
  if (targetClassId) {
    const cRes = await dbClient.query('SELECT name FROM classes WHERE id = $1', [targetClassId]);
    className = cRes.rows[0]?.name;
  }

  // Scope filter builders
  // For classes:
  let classFilterSql = '';
  let classParams: any[] = [];
  if (targetClassId) {
    classFilterSql = 'AND c.id = $1';
    classParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    classFilterSql = 'AND c.id = ANY($1::text[])';
    classParams = [assignedClassIds];
  } else if (targetOrgId) {
    classFilterSql = 'AND c.organization_id = $1';
    classParams = [targetOrgId];
  }

  // 1. Enrollment & Capacity Metrics
  // Criteria: pending_applicants_not_active_students
  // Criteria: transfers_not_double_counted
  let activeStudentsSql = '';
  let activeStudentsParams: any[] = [];

  if (targetClassId) {
    // Single class scope: only active enrollments in this class
    activeStudentsSql = `
      SELECT COUNT(DISTINCT ce.student_id)::int AS count
      FROM class_enrollments ce
      JOIN students s ON s.id = ce.student_id
      WHERE ce.class_id = $1
        AND ce.status = 'ACTIVE'
        AND s.status = 'ACTIVE'
    `;
    activeStudentsParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    // Multiple assigned classes scope: count distinct active students
    activeStudentsSql = `
      SELECT COUNT(DISTINCT ce.student_id)::int AS count
      FROM class_enrollments ce
      JOIN students s ON s.id = ce.student_id
      WHERE ce.class_id = ANY($1::text[])
        AND ce.status = 'ACTIVE'
        AND s.status = 'ACTIVE'
    `;
    activeStudentsParams = [assignedClassIds];
  } else if (targetOrgId) {
    // Organization scope: count distinct active students in organization
    // Even if student transferred, COUNT(DISTINCT s.id) counts them exactly once!
    activeStudentsSql = `
      SELECT COUNT(DISTINCT s.id)::int AS count
      FROM students s
      JOIN class_enrollments ce ON ce.student_id = s.id AND ce.status = 'ACTIVE'
      WHERE s.organization_id = $1
        AND s.status = 'ACTIVE'
    `;
    activeStudentsParams = [targetOrgId];
  } else {
    // Global scope
    activeStudentsSql = `
      SELECT COUNT(DISTINCT s.id)::int AS count
      FROM students s
      JOIN class_enrollments ce ON ce.student_id = s.id AND ce.status = 'ACTIVE'
      WHERE s.status = 'ACTIVE'
    `;
    activeStudentsParams = [];
  }

  const activeStudentsRes = await dbClient.query(activeStudentsSql, activeStudentsParams);
  const activeEnrolledStudents = activeStudentsRes.rows[0]?.count || 0;

  // Pending Applicants (Criteria: pending_applicants_not_active_students)
  let pendingAppSql = `
    SELECT COUNT(*)::int AS count
    FROM enrollment_applications ea
    WHERE ea.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'WAITLISTED', 'DRAFT')
  `;
  let pendingAppParams: any[] = [];
  if (targetClassId) {
    pendingAppSql += ' AND ea.class_id = $1';
    pendingAppParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    pendingAppSql += ' AND ea.class_id = ANY($1::text[])';
    pendingAppParams = [assignedClassIds];
  } else if (targetOrgId) {
    pendingAppSql += ' AND ea.organization_id = $1';
    pendingAppParams = [targetOrgId];
  }

  const pendingAppRes = await dbClient.query(pendingAppSql, pendingAppParams);
  const pendingApplicants = pendingAppRes.rows[0]?.count || 0;

  // Capacity & Active Classes Count
  let capacitySql = `
    SELECT COALESCE(SUM(c.capacity), 0)::int AS total_capacity, COUNT(*)::int AS active_classes_count
    FROM classes c
    WHERE c.status = 'ACTIVE'
  `;
  let capacityParams: any[] = [];
  if (targetClassId) {
    capacitySql += ' AND c.id = $1';
    capacityParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    capacitySql += ' AND c.id = ANY($1::text[])';
    capacityParams = [assignedClassIds];
  } else if (targetOrgId) {
    capacitySql += ' AND c.organization_id = $1';
    capacityParams = [targetOrgId];
  }
  const capRes = await dbClient.query(capacitySql, capacityParams);
  const totalClassCapacity = capRes.rows[0]?.total_capacity || 0;
  const activeClassesCount = capRes.rows[0]?.active_classes_count || 0;
  const capacityUtilizationPercent =
    totalClassCapacity > 0
      ? Math.round((activeEnrolledStudents / totalClassCapacity) * 10000) / 100
      : 0;

  // 2. Trial Conversion Metrics
  let trialSql = `
    SELECT 
      COUNT(*)::int AS total_trials,
      COUNT(*) FILTER (WHERE status IN ('ATTENDED', 'COMPLETED', 'CONVERTED'))::int AS trials_attended,
      COUNT(*) FILTER (WHERE status = 'CONVERTED')::int AS trials_converted
    FROM trial_bookings tb
    WHERE 1=1
  `;
  let trialParams: any[] = [];
  if (targetClassId) {
    trialSql += ' AND tb.class_id = $1';
    trialParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    trialSql += ' AND tb.class_id = ANY($1::text[])';
    trialParams = [assignedClassIds];
  } else if (targetOrgId) {
    trialSql += ' AND tb.organization_id = $1';
    trialParams = [targetOrgId];
  }
  const trialRes = await dbClient.query(trialSql, trialParams);
  const totalTrialsBooked = trialRes.rows[0]?.total_trials || 0;
  const trialsAttended = trialRes.rows[0]?.trials_attended || 0;
  const trialsConverted = trialRes.rows[0]?.trials_converted || 0;
  const conversionRatePercent =
    totalTrialsBooked > 0
      ? Math.round((trialsConverted / totalTrialsBooked) * 10000) / 100
      : 0;

  // 3. Retention & Transfers Metrics
  let pauseSql = `
    SELECT COUNT(*)::int AS count
    FROM membership_pauses mp
    WHERE mp.status = 'ACTIVE'
  `;
  let pauseParams: any[] = [];
  if (targetOrgId) {
    pauseSql += ' AND mp.organization_id = $1';
    pauseParams = [targetOrgId];
  }
  const pauseRes = await dbClient.query(pauseSql, pauseParams);
  const pausedMemberships = pauseRes.rows[0]?.count || 0;

  let transferSql = `
    SELECT COUNT(*)::int AS count
    FROM class_transfer_requests ctr
    WHERE ctr.status = 'APPROVED'
  `;
  let transferParams: any[] = [];
  if (targetClassId) {
    transferSql += ' AND (ctr.old_class_id = $1 OR ctr.new_class_id = $1)';
    transferParams = [targetClassId];
  } else if (targetOrgId) {
    transferSql += ' AND ctr.organization_id = $1';
    transferParams = [targetOrgId];
  }
  const transferRes = await dbClient.query(transferSql, transferParams);
  const transfersCount = transferRes.rows[0]?.count || 0;

  const retentionDenominator = activeEnrolledStudents + pausedMemberships;
  const retentionRatePercent =
    retentionDenominator > 0
      ? Math.round(((activeEnrolledStudents) / retentionDenominator) * 10000) / 100
      : 100;

  // 4. Financial Ledger Metrics (Criteria: finance_matches_ledger)
  // Strictly sums verified approved/completed payments from payments table
  let paymentSql = `
    SELECT COALESCE(SUM(p.amount), 0.00)::numeric(10,2) AS total_collected
    FROM payments p
    WHERE p.status IN ('Approved', 'COMPLETED')
  `;
  let paymentParams: any[] = [];
  if (targetClassId) {
    paymentSql += ` AND p.student_id IN (SELECT student_id FROM class_enrollments WHERE class_id = $1 AND status = 'ACTIVE')`;
    paymentParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    paymentSql += ` AND p.student_id IN (SELECT student_id FROM class_enrollments WHERE class_id = ANY($1::text[]) AND status = 'ACTIVE')`;
    paymentParams = [assignedClassIds];
  } else if (targetOrgId) {
    paymentSql += ' AND p.organization_id = $1';
    paymentParams = [targetOrgId];
  }
  const paymentRes = await dbClient.query(paymentSql, paymentParams);
  const totalCollected = parseFloat(paymentRes.rows[0]?.total_collected) || 0.00;

  // Total Outstanding from monthly_dues
  let dueSql = `
    SELECT COALESCE(SUM(md.fee_amount - md.amount_paid), 0.00)::numeric(10,2) AS total_outstanding
    FROM monthly_dues md
    WHERE md.status IN ('Pending', 'UNPAID', 'Partially Paid')
  `;
  let dueParams: any[] = [];
  if (targetClassId) {
    dueSql += ' AND md.class_id = $1';
    dueParams = [targetClassId];
  } else if (assignedClassIds && assignedClassIds.length > 0) {
    dueSql += ' AND md.class_id = ANY($1::text[])';
    dueParams = [assignedClassIds];
  } else if (targetOrgId) {
    dueSql += ' AND md.organization_id = $1';
    dueParams = [targetOrgId];
  }
  const dueRes = await dbClient.query(dueSql, dueParams);
  const totalOutstanding = parseFloat(dueRes.rows[0]?.total_outstanding) || 0.00;

  // Sibling discount savings from invoices or student records
  let discSql = `
    SELECT COALESCE(SUM(inv.discount_amount), 0.00)::numeric(10,2) AS total_discount
    FROM invoices inv
    WHERE 1=1
  `;
  let discParams: any[] = [];
  if (targetOrgId) {
    discSql += ' AND inv.organization_id = $1';
    discParams = [targetOrgId];
  }
  const discRes = await dbClient.query(discSql, discParams);
  const siblingDiscountSavings = parseFloat(discRes.rows[0]?.total_discount) || 0.00;

  return {
    metadata: {
      metricVersion: METRIC_VERSION,
      calculatedAt: now.toISOString(),
      scope: targetScope,
      period,
      organizationId: targetOrgId,
      organizationName: orgName,
      classId: targetClassId,
      className,
    },
    enrollment: {
      activeEnrolledStudents,
      pendingApplicants,
      totalClassCapacity,
      capacityUtilizationPercent,
      activeClassesCount,
    },
    trialConversion: {
      totalTrialsBooked,
      trialsAttended,
      trialsConverted,
      conversionRatePercent,
    },
    retention: {
      activeStudents: activeEnrolledStudents,
      pausedMemberships,
      transfersCount,
      retentionRatePercent,
    },
    ledgerTotals: {
      currency: 'MYR',
      totalCollected,
      totalOutstanding,
      siblingDiscountSavings,
    },
  };
}

// ----------------------------------------------------------------------------
// GET /metrics — Retrieve Academy Growth Metrics (getAcademyMetrics)
// ----------------------------------------------------------------------------
router.get('/metrics', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const scopeData = await resolveAuthorizedScope(req);
    const period = (req.query.period as string) || 'current_month';

    const metrics = await calculateAcademyMetrics(
      scopeData.targetScope,
      scopeData.targetOrgId,
      scopeData.targetClassId,
      scopeData.assignedClassIds,
      period
    );

    return res.json(metrics);
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[Analytics Metrics Error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to calculate analytics metrics.') });
  }
});

// ----------------------------------------------------------------------------
// POST /export and GET /export — Authorized Report Exports (exportAuthorizedReport)
// Enforces: export_cannot_expand_query_scope
// ----------------------------------------------------------------------------
const handleExport = async (req: Request, res: Response) => {
  try {
    const scopeData = await resolveAuthorizedScope(req);
    const reportType = (req.query.reportType as string) || req.body?.reportType || 'ACADEMY_GROWTH_METRICS';
    const format = ((req.query.format as string) || req.body?.format || 'json').toLowerCase();
    const period = (req.query.period as string) || req.body?.period || 'current_month';

    const metrics = await calculateAcademyMetrics(
      scopeData.targetScope,
      scopeData.targetOrgId,
      scopeData.targetClassId,
      scopeData.assignedClassIds,
      period
    );

    // Audit the export action
    const auditId = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'EXPORT_ANALYTICS_REPORT', $2, $3, $4)`,
      [
        auditId,
        JSON.stringify({
          reportType,
          format,
          scope: scopeData.targetScope,
          organizationId: scopeData.targetOrgId || null,
          classId: scopeData.targetClassId || null,
          exportedAt: new Date().toISOString(),
        }),
        req.user!.role,
        req.user!.email,
      ]
    );

    if (format === 'csv') {
      let csvContent = 'Metric,Value,Category\n';
      csvContent += `${sanitizeCsvValue('Metric Version')},${sanitizeCsvValue(metrics.metadata.metricVersion)},${sanitizeCsvValue('Metadata')}\n`;
      csvContent += `${sanitizeCsvValue('Calculated At')},${sanitizeCsvValue(metrics.metadata.calculatedAt)},${sanitizeCsvValue('Metadata')}\n`;
      csvContent += `${sanitizeCsvValue('Scope')},${sanitizeCsvValue(metrics.metadata.scope)},${sanitizeCsvValue('Metadata')}\n`;
      if (metrics.metadata.organizationId) {
        csvContent += `${sanitizeCsvValue('Organization ID')},${sanitizeCsvValue(metrics.metadata.organizationId)},${sanitizeCsvValue('Metadata')}\n`;
      }
      if (metrics.metadata.classId) {
        csvContent += `${sanitizeCsvValue('Class ID')},${sanitizeCsvValue(metrics.metadata.classId)},${sanitizeCsvValue('Metadata')}\n`;
      }
      csvContent += `${sanitizeCsvValue('Active Enrolled Students')},${sanitizeCsvValue(metrics.enrollment.activeEnrolledStudents)},${sanitizeCsvValue('Enrollment')}\n`;
      csvContent += `${sanitizeCsvValue('Pending Applicants')},${sanitizeCsvValue(metrics.enrollment.pendingApplicants)},${sanitizeCsvValue('Enrollment')}\n`;
      csvContent += `${sanitizeCsvValue('Total Class Capacity')},${sanitizeCsvValue(metrics.enrollment.totalClassCapacity)},${sanitizeCsvValue('Enrollment')}\n`;
      csvContent += `${sanitizeCsvValue('Capacity Utilization Percent')},${sanitizeCsvValue(metrics.enrollment.capacityUtilizationPercent + '%')},${sanitizeCsvValue('Enrollment')}\n`;
      csvContent += `${sanitizeCsvValue('Total Trials Booked')},${sanitizeCsvValue(metrics.trialConversion.totalTrialsBooked)},${sanitizeCsvValue('Trial Conversion')}\n`;
      csvContent += `${sanitizeCsvValue('Trials Attended')},${sanitizeCsvValue(metrics.trialConversion.trialsAttended)},${sanitizeCsvValue('Trial Conversion')}\n`;
      csvContent += `${sanitizeCsvValue('Trials Converted')},${sanitizeCsvValue(metrics.trialConversion.trialsConverted)},${sanitizeCsvValue('Trial Conversion')}\n`;
      csvContent += `${sanitizeCsvValue('Conversion Rate Percent')},${sanitizeCsvValue(metrics.trialConversion.conversionRatePercent + '%')},${sanitizeCsvValue('Trial Conversion')}\n`;
      csvContent += `${sanitizeCsvValue('Active Students')},${sanitizeCsvValue(metrics.retention.activeStudents)},${sanitizeCsvValue('Retention')}\n`;
      csvContent += `${sanitizeCsvValue('Paused Memberships')},${sanitizeCsvValue(metrics.retention.pausedMemberships)},${sanitizeCsvValue('Retention')}\n`;
      csvContent += `${sanitizeCsvValue('Transfers Count')},${sanitizeCsvValue(metrics.retention.transfersCount)},${sanitizeCsvValue('Retention')}\n`;
      csvContent += `${sanitizeCsvValue('Retention Rate Percent')},${sanitizeCsvValue(metrics.retention.retentionRatePercent + '%')},${sanitizeCsvValue('Retention')}\n`;
      csvContent += `${sanitizeCsvValue('Total Collected (MYR)')},${sanitizeCsvValue(metrics.ledgerTotals.totalCollected)},${sanitizeCsvValue('Ledger Totals')}\n`;
      csvContent += `${sanitizeCsvValue('Total Outstanding (MYR)')},${sanitizeCsvValue(metrics.ledgerTotals.totalOutstanding)},${sanitizeCsvValue('Ledger Totals')}\n`;
      csvContent += `${sanitizeCsvValue('Sibling Discount Savings (MYR)')},${sanitizeCsvValue(metrics.ledgerTotals.siblingDiscountSavings)},${sanitizeCsvValue('Ledger Totals')}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="beltflow-analytics-${Date.now()}.csv"`);
      return res.status(200).send(csvContent);
    }

    // Default JSON export
    return res.json({
      reportType,
      format: 'json',
      scope: scopeData.targetScope,
      organizationId: scopeData.targetOrgId,
      classId: scopeData.targetClassId,
      period,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.email,
      metrics,
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[Analytics Export Error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to export analytics report.') });
  }
};

router.post('/export', authenticateJWT, handleExport);
router.get('/export', authenticateJWT, handleExport);

export default router;
