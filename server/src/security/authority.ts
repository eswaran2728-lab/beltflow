import crypto from 'crypto';
import { dbClient, SqlTransactionClient } from '../db/client';
import { AuthUserContext, UserRole } from './rbac';

export class AuthorityError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode: number = 400, code: string = 'AUTHORITY_ERROR') {
    super(message);
    this.name = 'AuthorityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export enum AuthorityCapability {
  MASTER_AFFILIATION_MANAGE = 'MASTER_AFFILIATION_MANAGE',
  CLASS_PROPOSE = 'CLASS_PROPOSE',
  CLASS_OPERATE = 'CLASS_OPERATE',
  CLASS_APPROVE = 'CLASS_APPROVE',
  ENROLLMENT_APPLY = 'ENROLLMENT_APPLY',
  ENROLLMENT_APPROVE = 'ENROLLMENT_APPROVE',
  ATTENDANCE_WRITE = 'ATTENDANCE_WRITE',
  STUDENT_OPERATIONAL_ACCESS = 'STUDENT_OPERATIONAL_ACCESS',
}

export interface AuthorityResource {
  organizationId?: string;
  classId?: string;
  studentId?: string;
  targetUserId?: string;
  effectiveAt?: Date;
}

export interface AuthorizationDecision {
  allowed: boolean;
  code?: string;
  reason?: string;
}

export interface MasterAffiliationRecord {
  id: string;
  master_id: string;
  organization_id: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
  effective_from: Date;
  effective_to?: Date | null;
  verification_provenance: string;
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  review_notes?: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ClassLeadershipRecord {
  id: string;
  class_id: string;
  master_id: string;
  organization_id: string;
  leadership_type: 'PRIMARY' | 'SUBSTITUTE' | 'INTERN';
  effective_from: Date;
  effective_to?: Date | null;
  is_active: boolean;
  appointed_by?: string | null;
  notes?: string | null;
  provenance: string;
  created_at: Date;
  updated_at: Date;
}

export interface ClassEnrollmentRecord {
  id: string;
  student_id: string;
  class_id: string;
  organization_id: string;
  status: 'APPLIED' | 'ACTIVE' | 'TRANSFERRED' | 'PAUSED' | 'ENDED';
  effective_from: Date;
  effective_to?: Date | null;
  is_primary: boolean;
  provenance: string;
  approved_by_master_id?: string | null;
  approved_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LegacyReconciliationReport {
  totalMasters: number;
  verifiedMasters: number;
  pendingMasters: number;
  suspendedMasters: number;
  totalClasses: number;
  assignedClasses: number;
  unassignedClasses: number;
  totalStudents: number;
  enrolledStudents: number;
  unenrolledStudents: number;
  verifiedSourceEvidence: Array<{ id: string; type: string; details: string }>;
  existingOperationalRelationships: Array<{ classId: string; className: string; masterId?: string; sessionCount: number }>;
  historicalNeedingReview: Array<{ masterId: string; fullName: string; organizationId: string; reason: string }>;
  newApplicationsAwaitingApproval: Array<{ id: string; type: string; applicantName: string }>;
  invalidOrAmbiguous: Array<{ id: string; description: string }>;
}

/**
 * Central Authority Decision Contract
 * authorize(actor, capability, resource, effectiveAt) -> decision
 */
export async function authorize(
  actor: AuthUserContext,
  capability: AuthorityCapability,
  resource?: AuthorityResource,
  effectiveAt?: Date
): Promise<AuthorizationDecision> {
  if (!actor) {
    return { allowed: false, code: 'UNAUTHENTICATED', reason: 'Actor context missing.' };
  }

  // 1. Super Admin is strictly denied operational access to student and academy operational records
  if (actor.role === UserRole.SUPER_ADMIN) {
    const operationalCapabilities = [
      AuthorityCapability.CLASS_OPERATE,
      AuthorityCapability.ATTENDANCE_WRITE,
      AuthorityCapability.STUDENT_OPERATIONAL_ACCESS,
      AuthorityCapability.ENROLLMENT_APPROVE,
    ];
    if (operationalCapabilities.includes(capability)) {
      return {
        allowed: false,
        code: 'SUPER_ADMIN_OPERATIONAL_DENIED',
        reason: 'Super Admin is strictly denied operational access to academy records.',
      };
    }
  }

  // 2. Strict Tenant Isolation
  if (resource?.organizationId && actor.organizationId && resource.organizationId !== actor.organizationId) {
    return {
      allowed: false,
      code: 'CROSS_TENANT_DENIED',
      reason: 'Cross-tenant resource access denied.',
    };
  }

  const checkDate = effectiveAt || new Date();

  // 3. Class Operational Capabilities: CLASS_OPERATE and ATTENDANCE_WRITE
  if (capability === AuthorityCapability.CLASS_OPERATE || capability === AuthorityCapability.ATTENDANCE_WRITE) {
    if (actor.role === UserRole.ADMIN_PERSATUAN) {
      return {
        allowed: false,
        code: 'ADMIN_OPERATIONAL_DENIED',
        reason: 'Persatuan Admin cannot assume Master-only operational privileges.',
      };
    }

    if (actor.role !== UserRole.MASTER) {
      return {
        allowed: false,
        code: 'ROLE_UNAUTHORIZED',
        reason: 'Only Masters can operate classes or record attendance.',
      };
    }

    const orgId = resource?.organizationId || actor.organizationId;
    if (!orgId) {
      return { allowed: false, code: 'NO_ORG', reason: 'Organization context missing.' };
    }

    // Verify Master Affiliation
    const affilRes = await dbClient.query(
      `SELECT status, effective_from, effective_to FROM master_affiliations
       WHERE master_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [actor.id, orgId]
    );

    if (affilRes.rowCount === 0) {
      // Check legacy transition: is Master in coach_class_assignments?
      const legacyCheck = await dbClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE coach_id = $1',
        [actor.id]
      );
      if (legacyCheck.rowCount === 0) {
        return {
          allowed: false,
          code: 'AFFILIATION_NOT_FOUND',
          reason: 'Master has no registered affiliation with this organization.',
        };
      }
      // If legacy check passed, check class assignment below
    } else {
      const affil = affilRes.rows[0];
      if (affil.status !== 'ACTIVE') {
        return {
          allowed: false,
          code: 'AFFILIATION_NOT_ACTIVE',
          reason: `Master affiliation is not ACTIVE (status: ${affil.status}).`,
        };
      }
      if (affil.effective_from && new Date(affil.effective_from) > checkDate) {
        return {
          allowed: false,
          code: 'AFFILIATION_NOT_EFFECTIVE',
          reason: 'Master affiliation effective date is in the future.',
        };
      }
      if (affil.effective_to && new Date(affil.effective_to) < checkDate) {
        return {
          allowed: false,
          code: 'AFFILIATION_EXPIRED',
          reason: 'Master affiliation has expired.',
        };
      }
    }

    // Verify Class Leadership
    if (resource?.classId) {
      const leadershipRes = await dbClient.query(
        `SELECT is_active, leadership_type, effective_from, effective_to
         FROM class_leaderships
         WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [resource.classId, actor.id]
      );

      if (leadershipRes.rowCount > 0) {
        const lead = leadershipRes.rows[0];
        if (lead.effective_from && new Date(lead.effective_from) > checkDate) {
          return {
            allowed: false,
            code: 'LEADERSHIP_NOT_EFFECTIVE',
            reason: 'Class leadership effective date is in the future.',
          };
        }
        if (lead.effective_to && new Date(lead.effective_to) < checkDate) {
          return {
            allowed: false,
            code: 'LEADERSHIP_EXPIRED',
            reason: 'Class leadership period has ended.',
          };
        }
        return { allowed: true };
      }

      // Legacy fallback check on coach_class_assignments
      const legacyAssignRes = await dbClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
        [resource.classId, actor.id]
      );
      if (legacyAssignRes.rowCount > 0) {
        return { allowed: true };
      }

      return {
        allowed: false,
        code: 'NOT_CLASS_LEADER',
        reason: 'Master does not hold active leadership for this class.',
      };
    }

    return { allowed: true };
  }

  // 4. Student Operational Access
  if (capability === AuthorityCapability.STUDENT_OPERATIONAL_ACCESS) {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return {
        allowed: false,
        code: 'SUPER_ADMIN_OPERATIONAL_DENIED',
        reason: 'Super Admin is strictly denied operational student access.',
      };
    }

    if (!resource?.studentId) {
      return { allowed: false, code: 'STUDENT_REQUIRED', reason: 'Target student ID required.' };
    }

    const studentRes = await dbClient.query(
      'SELECT id, organization_id, class_id, user_id FROM students WHERE id = $1',
      [resource.studentId]
    );
    if (studentRes.rowCount === 0) {
      return { allowed: false, code: 'STUDENT_NOT_FOUND', reason: 'Student not found.' };
    }
    const student = studentRes.rows[0];

    if (actor.organizationId && student.organization_id !== actor.organizationId) {
      return { allowed: false, code: 'CROSS_TENANT_DENIED', reason: 'Student belongs to another organization.' };
    }

    if (actor.role === UserRole.ADMIN_PERSATUAN) {
      return { allowed: true };
    }

    if (actor.role === UserRole.STUDENT) {
      if (student.user_id === actor.id) return { allowed: true };
      return { allowed: false, code: 'NOT_SELF', reason: 'Students may only access their own records.' };
    }

    if (actor.role === UserRole.PARENT) {
      const linkRes = await dbClient.query(
        `SELECT 1 FROM parent_student_links
         WHERE parent_id = $1 AND student_id = $2 AND status = 'ACTIVE'
           AND student_approved = true AND master_approved = true AND admin_approved = true`,
        [actor.id, resource.studentId]
      );
      if (linkRes.rowCount > 0) return { allowed: true };
      return { allowed: false, code: 'PARENT_NOT_LINKED', reason: 'Parent is not verified or linked to this student.' };
    }

    if (actor.role === UserRole.MASTER) {
      if (student.class_id) {
        return authorize(actor, AuthorityCapability.CLASS_OPERATE, {
          organizationId: student.organization_id,
          classId: student.class_id,
        });
      }
      return { allowed: false, code: 'STUDENT_NO_CLASS', reason: 'Student has no active class.' };
    }
  }

  // 5. Enrollment Approval (Class Master only)
  if (capability === AuthorityCapability.ENROLLMENT_APPROVE) {
    if (actor.role !== UserRole.MASTER) {
      return { allowed: false, code: 'ROLE_UNAUTHORIZED', reason: 'Only the class Master can approve enrollment.' };
    }
    if (!resource?.classId) {
      return { allowed: false, code: 'CLASS_REQUIRED', reason: 'Class ID required for enrollment approval.' };
    }
    return authorize(actor, AuthorityCapability.CLASS_OPERATE, {
      organizationId: actor.organizationId,
      classId: resource.classId,
    });
  }

  return { allowed: false, code: 'CAPABILITY_NOT_HANDLED', reason: 'Requested capability is not permitted.' };
}

/**
 * Creates or updates a Master Affiliation
 */
export async function createMasterAffiliation(params: {
  masterId: string;
  organizationId: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
  effectiveFrom?: Date;
  effectiveTo?: Date;
  verificationProvenance?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}): Promise<MasterAffiliationRecord> {
  const status = params.status || 'PENDING';
  const provenance = params.verificationProvenance || 'DIRECT_REVIEW';

  // Validate Master user exists and belongs to the specified organization
  const userRes = await dbClient.query(
    'SELECT id, organization_id, role, status FROM users WHERE id = $1',
    [params.masterId]
  );
  if (userRes.rowCount === 0) {
    throw new Error('Master user not found.');
  }
  const user = userRes.rows[0];

  // Cross-tenant check on Master
  if (user.organization_id && user.organization_id !== params.organizationId) {
    throw new Error('Cross-tenant affiliation rejected: user does not belong to target organization.');
  }

  // Cross-tenant check on Reviewer
  if (params.reviewedBy) {
    const reviewerRes = await dbClient.query(
      'SELECT id, organization_id, role FROM users WHERE id = $1',
      [params.reviewedBy]
    );
    if (reviewerRes.rowCount === 0 || reviewerRes.rows[0].organization_id !== params.organizationId) {
      throw new Error('Cross-tenant affiliation rejected: reviewer does not belong to target organization.');
    }
  }

  // If status is ACTIVE, ensure no duplicate ACTIVE affiliation exists
  if (status === 'ACTIVE') {
    const existingActive = await dbClient.query(
      `SELECT id FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
      [params.masterId, params.organizationId]
    );
    if (existingActive.rowCount > 0) {
      throw new Error('Master already has an active affiliation with this organization.');
    }
  }

  const id = `maf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const insertRes = await dbClient.query(
    `INSERT INTO master_affiliations (
       id, master_id, organization_id, status, effective_from, effective_to,
       verification_provenance, reviewed_by, reviewed_at, review_notes, version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
     RETURNING *`,
    [
      id,
      params.masterId,
      params.organizationId,
      status,
      params.effectiveFrom || new Date(),
      params.effectiveTo || null,
      provenance,
      params.reviewedBy || null,
      params.reviewedBy ? new Date() : null,
      params.reviewNotes || null,
    ]
  );

  return insertRes.rows[0];
}

/**
 * Assigns class leadership (Primary or Substitute)
 */
export async function assignClassLeadership(params: {
  classId: string;
  masterId: string;
  organizationId: string;
  leadershipType?: 'PRIMARY' | 'SUBSTITUTE' | 'INTERN';
  effectiveFrom?: Date;
  effectiveTo?: Date;
  appointedBy?: string;
  notes?: string;
  provenance?: string;
  client?: { query: (sql: string, params?: any[]) => Promise<any> };
}): Promise<ClassLeadershipRecord> {
  const type = params.leadershipType || 'PRIMARY';
  const provenance = params.provenance || 'DIRECT_ASSIGNMENT';
  const db = params.client || dbClient;

  // 1. Verify class exists and belongs to organization
  const classRes = await db.query(
    'SELECT id, organization_id FROM classes WHERE id = $1',
    [params.classId]
  );
  if (classRes.rowCount === 0 || classRes.rows[0].organization_id !== params.organizationId) {
    throw new Error('Class not found or does not belong to target organization.');
  }

  // 2. Verify Master has ACTIVE affiliation with the organization
  const affilRes = await db.query(
    `SELECT id FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
    [params.masterId, params.organizationId]
  );
  if (affilRes.rowCount === 0) {
    throw new Error('Master does not have an active verified affiliation with this organization.');
  }

  // 3. If PRIMARY, prevent overlapping active primary leaders
  if (type === 'PRIMARY') {
    const existingLeader = await db.query(
      `SELECT master_id FROM class_leaderships
       WHERE class_id = $1 AND is_active = TRUE AND leadership_type = 'PRIMARY'`,
      [params.classId]
    );
    if (existingLeader.rowCount > 0 && existingLeader.rows[0].master_id !== params.masterId) {
      throw new Error('Overlapping primary leadership rejected: class already has an active primary leader.');
    }
  }

  const id = `clead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const insertRes = await db.query(
    `INSERT INTO class_leaderships (
       id, class_id, master_id, organization_id, leadership_type, effective_from, effective_to,
       is_active, appointed_by, notes, provenance
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10)
     RETURNING *`,
    [
      id,
      params.classId,
      params.masterId,
      params.organizationId,
      type,
      params.effectiveFrom || new Date(),
      params.effectiveTo || null,
      params.appointedBy || null,
      params.notes || null,
      provenance,
    ]
  );

  // Backward compatibility: keep classes.main_master_id and coach_class_assignments in sync
  if (type === 'PRIMARY') {
    await db.query(
      'UPDATE classes SET main_master_id = $1, master_id = $1 WHERE id = $2',
      [params.masterId, params.classId]
    );
    await db.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (coach_id, class_id) DO UPDATE SET is_main_master = TRUE`,
      [params.masterId, params.classId]
    );
  } else {
    await db.query(
      `INSERT INTO coach_class_assignments (coach_id, class_id, is_main_master)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (coach_id, class_id) DO NOTHING`,
      [params.masterId, params.classId]
    );
  }

  return insertRes.rows[0];
}

/**
 * Enrolls a canonical student into a class
 */
export async function enrollStudentInClass(params: {
  studentId: string;
  classId: string;
  organizationId: string;
  status?: 'APPLIED' | 'ACTIVE' | 'TRANSFERRED' | 'PAUSED' | 'ENDED';
  isPrimary?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  provenance?: string;
  approvedByMasterId?: string;
}): Promise<ClassEnrollmentRecord> {
  const status = params.status || 'ACTIVE';
  const isPrimary = params.isPrimary !== undefined ? params.isPrimary : true;
  const provenance = params.provenance || 'MASTER_APPROVED';

  // 1. Verify student exists and belongs to organization
  const studentRes = await dbClient.query(
    'SELECT id, organization_id FROM students WHERE id = $1',
    [params.studentId]
  );
  if (studentRes.rowCount === 0 || studentRes.rows[0].organization_id !== params.organizationId) {
    throw new Error('Cross-tenant enrollment rejected: student does not belong to target organization.');
  }

  // 2. Verify class exists and belongs to the same organization
  const classRes = await dbClient.query(
    'SELECT id, organization_id FROM classes WHERE id = $1',
    [params.classId]
  );
  if (classRes.rowCount === 0 || classRes.rows[0].organization_id !== params.organizationId) {
    throw new Error('Cross-tenant enrollment rejected: class does not belong to target organization.');
  }

  // 3. Check for duplicate active enrollment in the same class
  if (status === 'ACTIVE') {
    const existingActive = await dbClient.query(
      `SELECT id FROM class_enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'ACTIVE'`,
      [params.studentId, params.classId]
    );
    if (existingActive.rowCount > 0) {
      throw new Error('Student is already actively enrolled in this class.');
    }
  }

  const id = `enr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const insertRes = await dbClient.query(
    `INSERT INTO class_enrollments (
       id, student_id, class_id, organization_id, status, effective_from, effective_to,
       is_primary, provenance, approved_by_master_id, approved_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      id,
      params.studentId,
      params.classId,
      params.organizationId,
      status,
      params.effectiveFrom || new Date(),
      params.effectiveTo || null,
      isPrimary,
      provenance,
      params.approvedByMasterId || null,
      params.approvedByMasterId ? new Date() : null,
    ]
  );

  // Backward compatibility: keep students.class_id in sync if isPrimary and ACTIVE
  if (isPrimary && status === 'ACTIVE') {
    await dbClient.query('UPDATE students SET class_id = $1 WHERE id = $2', [params.classId, params.studentId]);
  }

  return insertRes.rows[0];
}

/**
 * Runs the non-destructive legacy backfill migration
 */
export async function runLegacyMigration(txClient?: SqlTransactionClient): Promise<{
  mastersBackfilled: number;
  classesBackfilled: number;
  studentsBackfilled: number;
}> {
  const runner = txClient || dbClient;

  // 1. Backfill legacy Masters -> master_affiliations with PENDING status (NEVER silently approved!)
  const mastersRes = await runner.query(
    `SELECT u.id, u.organization_id, u.created_at
     FROM users u
     WHERE u.role = 'MASTER' AND u.organization_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM master_affiliations ma
         WHERE ma.master_id = u.id AND ma.organization_id = u.organization_id
       )`
  );

  let mastersBackfilled = 0;
  for (const m of mastersRes.rows) {
    const affilId = `maf_leg_${m.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await runner.query(
      `INSERT INTO master_affiliations (
         id, master_id, organization_id, status, effective_from, verification_provenance, version
       ) VALUES ($1, $2, $3, 'PENDING', $4, 'LEGACY_MIGRATION', 1)
       ON CONFLICT (id) DO NOTHING`,
      [affilId, m.id, m.organization_id, m.created_at]
    );
    mastersBackfilled++;
  }

  // 2. Backfill legacy Classes -> class_leaderships
  const classesRes = await runner.query(
    `SELECT c.id AS class_id, c.organization_id, c.main_master_id, c.created_at
     FROM classes c
     WHERE c.main_master_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM class_leaderships cl
         WHERE cl.class_id = c.id AND cl.master_id = c.main_master_id
       )`
  );

  let classesBackfilled = 0;
  for (const c of classesRes.rows) {
    const leadId = `clead_leg_${c.class_id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await runner.query(
      `INSERT INTO class_leaderships (
         id, class_id, master_id, organization_id, leadership_type, effective_from,
         is_active, provenance
       ) VALUES ($1, $2, $3, $4, 'PRIMARY', $5, TRUE, 'LEGACY_MIGRATION')
       ON CONFLICT (id) DO NOTHING`,
      [leadId, c.class_id, c.main_master_id, c.organization_id, c.created_at]
    );
    classesBackfilled++;
  }

  // 3. Backfill legacy Students -> class_enrollments
  const studentsRes = await runner.query(
    `SELECT s.id AS student_id, s.class_id, s.organization_id, s.registered_at, s.status
     FROM students s
     WHERE s.class_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM class_enrollments ce
         WHERE ce.student_id = s.id AND ce.class_id = s.class_id
       )`
  );

  let studentsBackfilled = 0;
  for (const s of studentsRes.rows) {
    const enrId = `enr_leg_${s.student_id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const enrStatus = s.status === 'ACTIVE' ? 'ACTIVE' : 'ENDED';
    await runner.query(
      `INSERT INTO class_enrollments (
         id, student_id, class_id, organization_id, status, effective_from,
         is_primary, provenance
       ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'LEGACY_MIGRATION')
       ON CONFLICT (id) DO NOTHING`,
      [enrId, s.student_id, s.class_id, s.organization_id, enrStatus, s.registered_at]
    );
    studentsBackfilled++;
  }

  return { mastersBackfilled, classesBackfilled, studentsBackfilled };
}

/**
 * Generates the Legacy Reconciliation Report
 */
export async function getLegacyReconciliationReport(orgId?: string): Promise<LegacyReconciliationReport> {
  const orgFilter = orgId ? 'AND u.organization_id = $1' : '';
  const orgParams = orgId ? [orgId] : [];

  const masterStats = await dbClient.query(
    `SELECT
       COUNT(DISTINCT u.id)::int AS total,
       COUNT(DISTINCT CASE WHEN ma.status = 'ACTIVE' THEN u.id END)::int AS verified,
       COUNT(DISTINCT CASE WHEN ma.status = 'PENDING' OR ma.status IS NULL THEN u.id END)::int AS pending,
       COUNT(DISTINCT CASE WHEN ma.status = 'SUSPENDED' THEN u.id END)::int AS suspended
     FROM users u
     LEFT JOIN master_affiliations ma ON ma.master_id = u.id AND ma.organization_id = u.organization_id
     WHERE u.role = 'MASTER' ${orgFilter}`,
    orgParams
  );

  const classFilter = orgId ? 'WHERE organization_id = $1' : '';
  const classStats = await dbClient.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN main_master_id IS NOT NULL THEN 1 END)::int AS assigned,
       COUNT(CASE WHEN main_master_id IS NULL THEN 1 END)::int AS unassigned
     FROM classes ${classFilter}`,
    orgParams
  );

  const studentFilter = orgId ? 'WHERE organization_id = $1' : '';
  const studentStats = await dbClient.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN class_id IS NOT NULL THEN 1 END)::int AS enrolled,
       COUNT(CASE WHEN class_id IS NULL THEN 1 END)::int AS unenrolled
     FROM students ${studentFilter}`,
    orgParams
  );

  // Historical needing review: Masters with PENDING affiliations
  const needingReviewRes = await dbClient.query(
    `SELECT u.id AS master_id, u.full_name, u.organization_id,
            COALESCE(ma.verification_provenance, 'LEGACY_UNMIGRATED') AS provenance
     FROM users u
     LEFT JOIN master_affiliations ma ON ma.master_id = u.id AND ma.organization_id = u.organization_id
     WHERE u.role = 'MASTER' AND (ma.status = 'PENDING' OR ma.status IS NULL) ${orgFilter}`,
    orgParams
  );

  // Operational relationships: Classes with recorded sessions
  const opClassesRes = await dbClient.query(
    `SELECT c.id AS class_id, c.name AS class_name, c.main_master_id AS master_id,
            COUNT(ts.id)::int AS session_count
     FROM classes c
     LEFT JOIN training_sessions ts ON ts.class_id = c.id
     ${orgId ? 'WHERE c.organization_id = $1' : ''}
     GROUP BY c.id, c.name, c.main_master_id`,
    orgParams
  );

  // Check for invalid or cross-tenant anomalies
  const invalidRes = await dbClient.query(
    `SELECT s.id, 'Student class organization mismatch' AS description
     FROM students s
     JOIN classes c ON c.id = s.class_id
     WHERE s.organization_id != c.organization_id`
  );

  const mRow = masterStats.rows[0] || {};
  const cRow = classStats.rows[0] || {};
  const sRow = studentStats.rows[0] || {};

  return {
    totalMasters: mRow.total || 0,
    verifiedMasters: mRow.verified || 0,
    pendingMasters: mRow.pending || 0,
    suspendedMasters: mRow.suspended || 0,
    totalClasses: cRow.total || 0,
    assignedClasses: cRow.assigned || 0,
    unassignedClasses: cRow.unassigned || 0,
    totalStudents: sRow.total || 0,
    enrolledStudents: sRow.enrolled || 0,
    unenrolledStudents: sRow.unenrolled || 0,
    verifiedSourceEvidence: [],
    existingOperationalRelationships: opClassesRes.rows.map((r) => ({
      classId: r.class_id,
      className: r.class_name,
      masterId: r.master_id || undefined,
      sessionCount: Number(r.session_count || 0),
    })),
    historicalNeedingReview: needingReviewRes.rows.map((r) => ({
      masterId: r.master_id,
      fullName: r.full_name,
      organizationId: r.organization_id,
      reason: `Legacy instructor record (${r.provenance}) awaiting Persatuan verification`,
    })),
    newApplicationsAwaitingApproval: [],
    invalidOrAmbiguous: invalidRes.rows.map((r) => ({
      id: r.id,
      description: r.description,
    })),
  };
}

/**
 * Atomic Master Approval for Student Class Enrollment (Task H05)
 */
export async function approveEnrollment(params: {
  applicationId: string;
  expectedVersion: number;
  idempotencyKey?: string;
  reviewerMasterId: string;
  notes?: string;
}): Promise<{ application: any; student: any; enrollment: any; idempotentReplay?: boolean }> {
  return await dbClient.transaction(async (txClient) => {
    // 1. Authenticate Master
    const masterRes = await txClient.query(
      'SELECT id, organization_id, email, full_name, role, status FROM users WHERE id = $1',
      [params.reviewerMasterId]
    );
    if (masterRes.rowCount === 0) {
      throw new AuthorityError('Master user not found.', 404, 'MASTER_NOT_FOUND');
    }
    const master = masterRes.rows[0];
    if (master.role !== UserRole.MASTER || master.status !== 'ACTIVE') {
      throw new AuthorityError('Only active Masters can approve student enrollment.', 403, 'ROLE_UNAUTHORIZED');
    }

    // 2. Lock application and inspect status & idempotency
    const appRes = await txClient.query(
      'SELECT * FROM enrollment_applications WHERE id = $1 FOR UPDATE',
      [params.applicationId]
    );
    if (appRes.rowCount === 0) {
      throw new AuthorityError('Enrollment application not found.', 404, 'APPLICATION_NOT_FOUND');
    }
    const app = appRes.rows[0];

    const payloadHash = params.idempotencyKey
      ? crypto.createHash('sha256').update(JSON.stringify({ decision: 'APPROVE', notes: params.notes || null })).digest('hex')
      : null;

    if (params.idempotencyKey && app.idempotency_key === params.idempotencyKey) {
      if (app.idempotency_payload_hash && app.idempotency_payload_hash !== payloadHash) {
        throw new AuthorityError('Payload mismatch for existing idempotency key.', 422, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      if (app.status === 'APPROVED') {
        const stuRes = await txClient.query('SELECT * FROM students WHERE id = $1', [app.student_id]);
        const enrRes = await txClient.query(
          "SELECT * FROM class_enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'ACTIVE' LIMIT 1",
          [app.student_id, app.class_id]
        );
        return {
          application: app,
          student: stuRes.rows[0] || null,
          enrollment: enrRes.rows[0] || null,
          idempotentReplay: true,
        };
      }
    }

    // 3. Validate expectedVersion
    if (Number(app.version) !== Number(params.expectedVersion)) {
      throw new AuthorityError(
        `Stale application version. Expected ${params.expectedVersion}, but current version is ${app.version}.`,
        409,
        'VERSION_CONFLICT'
      );
    }

    // 4. Verify application status
    if (app.status === 'APPROVED') {
      throw new AuthorityError('Application is already approved.', 409, 'ALREADY_APPROVED');
    }
    if (!['SUBMITTED', 'WAITLISTED', 'NEEDS_INFORMATION', 'DRAFT'].includes(app.status)) {
      throw new AuthorityError(`Application cannot be approved from current status: ${app.status}.`, 400, 'INVALID_STATUS');
    }

    // 5. Verify active Master affiliation with this organization
    const affilRes = await txClient.query(
      `SELECT id, status, effective_from, effective_to FROM master_affiliations
       WHERE master_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [master.id, app.organization_id]
    );
    if (affilRes.rowCount === 0 || affilRes.rows[0].status !== 'ACTIVE') {
      // Check legacy fallback
      const legacyCheck = await txClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE coach_id = $1',
        [master.id]
      );
      if (legacyCheck.rowCount === 0) {
        throw new AuthorityError('Master does not have an active verified affiliation with this organization.', 403, 'AFFILIATION_NOT_ACTIVE');
      }
    } else {
      const affil = affilRes.rows[0];
      const now = new Date();
      if (affil.effective_from && new Date(affil.effective_from) > now) {
        throw new AuthorityError('Master affiliation effective date is in the future.', 403, 'AFFILIATION_NOT_EFFECTIVE');
      }
      if (affil.effective_to && new Date(affil.effective_to) < now) {
        throw new AuthorityError('Master affiliation has expired.', 403, 'AFFILIATION_EXPIRED');
      }
    }

    // 6. Lock Class & verify class status, availability and capacity
    const classRes = await txClient.query(
      'SELECT * FROM classes WHERE id = $1 FOR UPDATE',
      [app.class_id]
    );
    if (classRes.rowCount === 0) {
      throw new AuthorityError('Class not found.', 404, 'CLASS_NOT_FOUND');
    }
    const cls = classRes.rows[0];

    if (cls.organization_id !== app.organization_id) {
      throw new AuthorityError('Cross-organization enrollment is strictly prohibited.', 403, 'CROSS_ORGANIZATION');
    }
    if (cls.approval_status !== 'APPROVED') {
      throw new AuthorityError('Class proposal is not approved by Persatuan Admin.', 400, 'CLASS_NOT_APPROVED');
    }
    if (cls.operational_status !== 'ACTIVE') {
      throw new AuthorityError('Class is not in active operational status.', 400, 'CLASS_NOT_ACTIVE');
    }
    if (cls.enrollment_availability === 'CLOSED') {
      throw new AuthorityError('Class is closed for new enrollments.', 409, 'CLASS_CLOSED');
    }

    // 7. Verify current Master authority over this class
    const leadershipRes = await txClient.query(
      `SELECT is_active, leadership_type, effective_from, effective_to
       FROM class_leaderships
       WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE
       LIMIT 1`,
      [cls.id, master.id]
    );
    if (leadershipRes.rowCount === 0) {
      const legAssign = await txClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
        [cls.id, master.id]
      );
      if (legAssign.rowCount === 0) {
        throw new AuthorityError('Master does not hold active leadership for this class.', 403, 'NOT_CLASS_LEADER');
      }
    }

    // 8. Atomically check capacity
    const capRes = await txClient.query(
      "SELECT count(*)::int AS active_count FROM class_enrollments WHERE class_id = $1 AND status = 'ACTIVE'",
      [cls.id]
    );
    const activeCount = Number(capRes.rows[0]?.active_count || 0);
    const capacityLimit = Number(cls.capacity || 30);
    if (activeCount >= capacityLimit) {
      throw new AuthorityError(`Class capacity reached (${activeCount}/${capacityLimit}). Cannot enroll student.`, 409, 'CAPACITY_REACHED');
    }

    // 9. Lock Student and verify tenant isolation
    const stuRes = await txClient.query(
      'SELECT * FROM students WHERE id = $1 FOR UPDATE',
      [app.student_id]
    );
    if (stuRes.rowCount === 0) {
      throw new AuthorityError('Student record not found.', 404, 'STUDENT_NOT_FOUND');
    }
    const stu = stuRes.rows[0];
    if (stu.organization_id !== app.organization_id) {
      throw new AuthorityError('Student does not belong to the same organization as the class.', 403, 'CROSS_ORGANIZATION');
    }

    // 10. Update Student to ACTIVE and link class_id (preserving canonical student ID)
    const classFee = Number(cls.monthly_fee || 120.0);
    const updatedStuRes = await txClient.query(
      `UPDATE students SET
         class_id = $1,
         status = 'ACTIVE',
         monthly_fee = CASE WHEN fee_override = TRUE THEN monthly_fee ELSE $2 END,
         registered_at = COALESCE(registered_at, CURRENT_TIMESTAMP)
       WHERE id = $3
       RETURNING *`,
      [cls.id, classFee, stu.id]
    );
    const updatedStudent = updatedStuRes.rows[0];

    // If student has user_id, activate user account if PENDING_VERIFICATION
    if (stu.user_id) {
      await txClient.query(
        "UPDATE users SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'PENDING_VERIFICATION'",
        [stu.user_id]
      );
    }

    // 11. Create or activate class_enrollments record
    const existingEnr = await txClient.query(
      'SELECT id, status FROM class_enrollments WHERE student_id = $1 AND class_id = $2',
      [stu.id, cls.id]
    );
    let enrollment: any;
    if (existingEnr.rowCount > 0) {
      const enrUpd = await txClient.query(
        `UPDATE class_enrollments SET
           status = 'ACTIVE',
           effective_from = CURRENT_TIMESTAMP,
           effective_to = NULL,
           approved_by_master_id = $1,
           approved_at = CURRENT_TIMESTAMP,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $2 AND class_id = $3
         RETURNING *`,
        [master.id, stu.id, cls.id]
      );
      enrollment = enrUpd.rows[0];
    } else {
      const enrId = `enr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const enrIns = await txClient.query(
        `INSERT INTO class_enrollments (
           id, student_id, class_id, organization_id, status, effective_from,
           is_primary, provenance, approved_by_master_id, approved_at, version
         ) VALUES ($1, $2, $3, $4, 'ACTIVE', CURRENT_TIMESTAMP, TRUE, 'MASTER_APPROVED', $5, CURRENT_TIMESTAMP, 1)
         RETURNING *`,
        [enrId, stu.id, cls.id, cls.organization_id, master.id]
      );
      enrollment = enrIns.rows[0];
    }

    // 12. Update application to APPROVED with version increment & idempotency hash
    const updAppRes = await txClient.query(
      `UPDATE enrollment_applications SET
         status = 'APPROVED',
         reviewed_by_master_id = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         review_notes = $2,
         version = version + 1,
         idempotency_key = COALESCE($3, idempotency_key),
         idempotency_payload_hash = COALESCE($4, idempotency_payload_hash),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [master.id, params.notes || null, params.idempotencyKey || null, payloadHash, app.id]
    );
    const updatedApplication = updAppRes.rows[0];

    // 13. Audit Log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Student Enrollment Approved', $2, 'MASTER', $3)`,
      [auditId, `Enrollment approved for application ${app.id}, student ${stu.id} into class ${cls.id} (${cls.name})`, master.email]
    );

    // 14. Notification Outbox
    const outboxId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ($1, $2, 'StudentEnrollmentApproved', 'enrollment_application', $3, $4, 'PENDING')`,
      [
        outboxId,
        cls.organization_id,
        app.id,
        JSON.stringify({
          applicationId: app.id,
          studentId: stu.id,
          studentName: stu.full_name,
          classId: cls.id,
          className: cls.name,
          approvedByMasterId: master.id,
          approvedAt: new Date().toISOString(),
        }),
      ]
    );

    return {
      application: updatedApplication,
      student: updatedStudent,
      enrollment,
      idempotentReplay: false,
    };
  });
}

/**
 * Master requests further information for student enrollment application
 */
export async function requestInformationEnrollment(params: {
  applicationId: string;
  expectedVersion: number;
  idempotencyKey?: string;
  reviewerMasterId: string;
  requestedInformation?: string;
}): Promise<any> {
  return await dbClient.transaction(async (txClient) => {
    const masterRes = await txClient.query(
      'SELECT id, organization_id, email, role, status FROM users WHERE id = $1',
      [params.reviewerMasterId]
    );
    if (masterRes.rowCount === 0 || masterRes.rows[0].role !== UserRole.MASTER || masterRes.rows[0].status !== 'ACTIVE') {
      throw new AuthorityError('Only active Masters can review enrollment.', 403, 'ROLE_UNAUTHORIZED');
    }
    const master = masterRes.rows[0];

    const appRes = await txClient.query(
      'SELECT * FROM enrollment_applications WHERE id = $1 FOR UPDATE',
      [params.applicationId]
    );
    if (appRes.rowCount === 0) {
      throw new AuthorityError('Enrollment application not found.', 404, 'APPLICATION_NOT_FOUND');
    }
    const app = appRes.rows[0];

    const payloadHash = params.idempotencyKey
      ? crypto.createHash('sha256').update(JSON.stringify({ decision: 'REQUEST_INFORMATION', info: params.requestedInformation?.trim() || null })).digest('hex')
      : null;

    if (params.idempotencyKey && app.idempotency_key === params.idempotencyKey) {
      if (app.idempotency_payload_hash && app.idempotency_payload_hash !== payloadHash) {
        throw new AuthorityError('Payload mismatch for existing idempotency key.', 422, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return app;
    }

    if (!params.requestedInformation || !params.requestedInformation.trim()) {
      throw new AuthorityError('requestedInformation is required.', 400, 'REQUESTED_INFO_REQUIRED');
    }

    if (Number(app.version) !== Number(params.expectedVersion)) {
      throw new AuthorityError(
        `Stale application version. Expected ${params.expectedVersion}, but current version is ${app.version}.`,
        409,
        'VERSION_CONFLICT'
      );
    }

    // Verify master authority over class
    const leadershipRes = await txClient.query(
      'SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE',
      [app.class_id, master.id]
    );
    if (leadershipRes.rowCount === 0) {
      const legAssign = await txClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
        [app.class_id, master.id]
      );
      if (legAssign.rowCount === 0) {
        throw new AuthorityError('Master does not hold active leadership for this class.', 403, 'NOT_CLASS_LEADER');
      }
    }

    const upd = await txClient.query(
      `UPDATE enrollment_applications SET
         status = 'NEEDS_INFORMATION',
         requested_information = $1,
         reviewed_by_master_id = $2,
         reviewed_at = CURRENT_TIMESTAMP,
         version = version + 1,
         idempotency_key = COALESCE($3, idempotency_key),
         idempotency_payload_hash = COALESCE($4, idempotency_payload_hash),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [params.requestedInformation.trim(), master.id, params.idempotencyKey || null, payloadHash, app.id]
    );

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Student Enrollment Information Requested', $2, 'MASTER', $3)`,
      [auditId, `Information requested for application ${app.id}: ${params.requestedInformation.trim()}`, master.email]
    );

    const outboxId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ($1, $2, 'StudentEnrollmentInformationRequested', 'enrollment_application', $3, $4, 'PENDING')`,
      [outboxId, app.organization_id, app.id, JSON.stringify({ applicationId: app.id, studentId: app.student_id, classId: app.class_id, requestedInformation: params.requestedInformation.trim() })]
    );

    return upd.rows[0];
  });
}

/**
 * Master rejects student enrollment application
 */
export async function rejectEnrollment(params: {
  applicationId: string;
  expectedVersion: number;
  idempotencyKey?: string;
  reviewerMasterId: string;
  rejectionReason?: string;
}): Promise<any> {
  return await dbClient.transaction(async (txClient) => {
    const masterRes = await txClient.query(
      'SELECT id, organization_id, email, role, status FROM users WHERE id = $1',
      [params.reviewerMasterId]
    );
    if (masterRes.rowCount === 0 || masterRes.rows[0].role !== UserRole.MASTER || masterRes.rows[0].status !== 'ACTIVE') {
      throw new AuthorityError('Only active Masters can review enrollment.', 403, 'ROLE_UNAUTHORIZED');
    }
    const master = masterRes.rows[0];

    const appRes = await txClient.query(
      'SELECT * FROM enrollment_applications WHERE id = $1 FOR UPDATE',
      [params.applicationId]
    );
    if (appRes.rowCount === 0) {
      throw new AuthorityError('Enrollment application not found.', 404, 'APPLICATION_NOT_FOUND');
    }
    const app = appRes.rows[0];

    const payloadHash = params.idempotencyKey
      ? crypto.createHash('sha256').update(JSON.stringify({ decision: 'REJECT', reason: params.rejectionReason?.trim() || null })).digest('hex')
      : null;

    if (params.idempotencyKey && app.idempotency_key === params.idempotencyKey) {
      if (app.idempotency_payload_hash && app.idempotency_payload_hash !== payloadHash) {
        throw new AuthorityError('Payload mismatch for existing idempotency key.', 422, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return app;
    }

    if (!params.rejectionReason || !params.rejectionReason.trim()) {
      throw new AuthorityError('rejectionReason is required.', 400, 'REJECTION_REASON_REQUIRED');
    }

    if (Number(app.version) !== Number(params.expectedVersion)) {
      throw new AuthorityError(
        `Stale application version. Expected ${params.expectedVersion}, but current version is ${app.version}.`,
        409,
        'VERSION_CONFLICT'
      );
    }

    // Verify master authority over class
    const leadershipRes = await txClient.query(
      'SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE',
      [app.class_id, master.id]
    );
    if (leadershipRes.rowCount === 0) {
      const legAssign = await txClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
        [app.class_id, master.id]
      );
      if (legAssign.rowCount === 0) {
        throw new AuthorityError('Master does not hold active leadership for this class.', 403, 'NOT_CLASS_LEADER');
      }
    }

    const upd = await txClient.query(
      `UPDATE enrollment_applications SET
         status = 'REJECTED',
         rejection_reason = $1,
         reviewed_by_master_id = $2,
         reviewed_at = CURRENT_TIMESTAMP,
         version = version + 1,
         idempotency_key = COALESCE($3, idempotency_key),
         idempotency_payload_hash = COALESCE($4, idempotency_payload_hash),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [params.rejectionReason.trim(), master.id, params.idempotencyKey || null, payloadHash, app.id]
    );

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Student Enrollment Rejected', $2, 'MASTER', $3)`,
      [auditId, `Enrollment rejected for application ${app.id}: ${params.rejectionReason.trim()}`, master.email]
    );

    const outboxId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ($1, $2, 'StudentEnrollmentRejected', 'enrollment_application', $3, $4, 'PENDING')`,
      [outboxId, app.organization_id, app.id, JSON.stringify({ applicationId: app.id, studentId: app.student_id, classId: app.class_id, rejectionReason: params.rejectionReason.trim() })]
    );

    return upd.rows[0];
  });
}

/**
 * Master waitlists student enrollment application
 */
export async function waitlistEnrollment(params: {
  applicationId: string;
  expectedVersion: number;
  idempotencyKey?: string;
  reviewerMasterId: string;
  notes?: string;
}): Promise<any> {
  return await dbClient.transaction(async (txClient) => {
    const masterRes = await txClient.query(
      'SELECT id, organization_id, email, role, status FROM users WHERE id = $1',
      [params.reviewerMasterId]
    );
    if (masterRes.rowCount === 0 || masterRes.rows[0].role !== UserRole.MASTER || masterRes.rows[0].status !== 'ACTIVE') {
      throw new AuthorityError('Only active Masters can review enrollment.', 403, 'ROLE_UNAUTHORIZED');
    }
    const master = masterRes.rows[0];

    const appRes = await txClient.query(
      'SELECT * FROM enrollment_applications WHERE id = $1 FOR UPDATE',
      [params.applicationId]
    );
    if (appRes.rowCount === 0) {
      throw new AuthorityError('Enrollment application not found.', 404, 'APPLICATION_NOT_FOUND');
    }
    const app = appRes.rows[0];

    if (Number(app.version) !== Number(params.expectedVersion)) {
      throw new AuthorityError(
        `Stale application version. Expected ${params.expectedVersion}, but current version is ${app.version}.`,
        409,
        'VERSION_CONFLICT'
      );
    }

    const payloadHash = params.idempotencyKey
      ? crypto.createHash('sha256').update(JSON.stringify({ decision: 'WAITLIST', notes: params.notes || null })).digest('hex')
      : null;

    if (params.idempotencyKey && app.idempotency_key === params.idempotencyKey) {
      if (app.idempotency_payload_hash && app.idempotency_payload_hash !== payloadHash) {
        throw new AuthorityError('Payload mismatch for existing idempotency key.', 422, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return app;
    }

    // Verify master authority over class
    const leadershipRes = await txClient.query(
      'SELECT 1 FROM class_leaderships WHERE class_id = $1 AND master_id = $2 AND is_active = TRUE',
      [app.class_id, master.id]
    );
    if (leadershipRes.rowCount === 0) {
      const legAssign = await txClient.query(
        'SELECT 1 FROM coach_class_assignments WHERE class_id = $1 AND coach_id = $2',
        [app.class_id, master.id]
      );
      if (legAssign.rowCount === 0) {
        throw new AuthorityError('Master does not hold active leadership for this class.', 403, 'NOT_CLASS_LEADER');
      }
    }

    const upd = await txClient.query(
      `UPDATE enrollment_applications SET
         status = 'WAITLISTED',
         review_notes = $1,
         reviewed_by_master_id = $2,
         reviewed_at = CURRENT_TIMESTAMP,
         version = version + 1,
         idempotency_key = COALESCE($3, idempotency_key),
         idempotency_payload_hash = COALESCE($4, idempotency_payload_hash),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [params.notes || 'Waitlisted by Master', master.id, params.idempotencyKey || null, payloadHash, app.id]
    );

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, 'Student Enrollment Waitlisted', $2, 'MASTER', $3)`,
      [auditId, `Enrollment waitlisted for application ${app.id}`, master.email]
    );

    const outboxId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await txClient.query(
      `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ($1, $2, 'StudentEnrollmentWaitlisted', 'enrollment_application', $3, $4, 'PENDING')`,
      [outboxId, app.organization_id, app.id, JSON.stringify({ applicationId: app.id, studentId: app.student_id, classId: app.class_id })]
    );

    return upd.rows[0];
  });
}

