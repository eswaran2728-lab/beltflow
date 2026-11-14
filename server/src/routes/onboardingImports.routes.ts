import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { Permission, UserRole } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';

const router = Router();

// ============================================================================
// Types
// ============================================================================

export interface LegacyImportRowInput {
  fullName?: string;
  icNumber?: string;
  email?: string;
  phone?: string;
  beltRank?: string;
  className?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  organizationId?: string;
}

export type ImportRowStatus = 'VALID' | 'DUPLICATE' | 'MALFORMED' | 'WRONG_TENANT' | 'UNVERIFIED_PARENT';

export interface ValidatedPreviewItem {
  rowIndex: number;
  status: ImportRowStatus;
  errorMessage?: string;
  data: LegacyImportRowInput;
}

// ============================================================================
// Helper Validators
// ============================================================================

function cleanIcNumber(ic: string): string {
  return ic.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function validateRow(
  row: LegacyImportRowInput,
  rowIndex: number,
  expectedTenantId: string,
  existingIcs: Set<string>,
  batchIcs: Set<string>
): ValidatedPreviewItem {
  // 1. Wrong tenant check (Cross-tenant injection defense)
  if (row.organizationId && row.organizationId.trim() !== '' && row.organizationId !== expectedTenantId) {
    return {
      rowIndex,
      status: 'WRONG_TENANT',
      errorMessage: `Row specifies organization "${row.organizationId}" which does not match authorized tenant "${expectedTenantId}".`,
      data: row
    };
  }

  // 2. Malformed row check
  if (!row.fullName || typeof row.fullName !== 'string' || row.fullName.trim() === '') {
    return {
      rowIndex,
      status: 'MALFORMED',
      errorMessage: 'Missing mandatory student full name.',
      data: row
    };
  }

  if (!row.icNumber || typeof row.icNumber !== 'string' || row.icNumber.trim() === '') {
    return {
      rowIndex,
      status: 'MALFORMED',
      errorMessage: 'Missing mandatory student IC / MyKid identification.',
      data: row
    };
  }

  const cleanIc = cleanIcNumber(row.icNumber);
  if (cleanIc.length < 6) {
    return {
      rowIndex,
      status: 'MALFORMED',
      errorMessage: 'Invalid student IC / MyKid format (minimum 6 alphanumeric characters).',
      data: row
    };
  }

  // 3. Unverified parent link check
  // If parent name is provided, contact info (phone or email) must be present for guardian authorization
  const hasParentName = Boolean(row.parentName && row.parentName.trim() !== '');
  const hasParentPhone = Boolean(row.parentPhone && row.parentPhone.trim() !== '');
  const hasParentEmail = Boolean(row.parentEmail && row.parentEmail.trim() !== '');

  if (hasParentName && !hasParentPhone && !hasParentEmail) {
    return {
      rowIndex,
      status: 'UNVERIFIED_PARENT',
      errorMessage: 'Parent/Guardian details incomplete: Guardian name requires a contact phone number or email for identity verification.',
      data: row
    };
  }

  // 4. Duplicate check against existing roster and within current batch
  if (existingIcs.has(cleanIc)) {
    return {
      rowIndex,
      status: 'DUPLICATE',
      errorMessage: `Student with IC/MyKid "${row.icNumber}" is already registered in this Persatuan's active roster.`,
      data: row
    };
  }

  if (batchIcs.has(cleanIc)) {
    return {
      rowIndex,
      status: 'DUPLICATE',
      errorMessage: `Duplicate IC/MyKid "${row.icNumber}" found within the same import file at row ${rowIndex}.`,
      data: row
    };
  }

  batchIcs.add(cleanIc);

  return {
    rowIndex,
    status: 'VALID',
    data: row
  };
}

// ============================================================================
// 1. Academy Setup Readiness Checklist Endpoint
// ============================================================================

router.get('/academy-readiness', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let targetOrgId = user.organizationId;

    if (user.role === UserRole.SUPER_ADMIN) {
      targetOrgId = (req.query.organizationId as string) || targetOrgId;
      if (!targetOrgId) {
        const firstOrg = await dbClient.query('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1');
        targetOrgId = firstOrg.rows[0]?.id;
      }
    }

    if (!targetOrgId) {
      return res.status(400).json({ error: 'Organization ID is required to evaluate setup readiness.' });
    }

    // 1. Organization profile
    const orgRes = await dbClient.query('SELECT * FROM organizations WHERE id = $1', [targetOrgId]);
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    const org = orgRes.rows[0];

    // 2. Curriculums and belt ranks
    const currRes = await dbClient.query(
      `SELECT pc.id, pc.system_name, pc.status, COUNT(cbr.id) AS rank_count
       FROM persatuan_curriculums pc
       LEFT JOIN curriculum_belt_ranks cbr ON pc.id = cbr.curriculum_id
       WHERE pc.organization_id = $1 AND pc.status = 'PUBLISHED'
       GROUP BY pc.id, pc.system_name, pc.status`,
      [targetOrgId]
    );
    const activeCurriculum = currRes.rows[0];
    const curriculumRanksCount = parseInt(activeCurriculum?.rank_count || '0', 10);
    const curriculumReady = curriculumRanksCount >= 1;

    // 3. Merchant configuration
    const merchRes = await dbClient.query('SELECT * FROM persatuan_merchants WHERE organization_id = $1', [targetOrgId]);
    const merchant = merchRes.rows[0];
    const merchantReady = Boolean(merchant && merchant.status === 'ACTIVE');
    const merchantMode = merchant ? merchant.provider : 'UNCONFIGURED';

    // 4. Approved classes
    const classesRes = await dbClient.query(
      "SELECT id, name, schedule, location, status FROM classes WHERE organization_id = $1 AND status = 'ACTIVE'",
      [targetOrgId]
    );
    const classesCount = classesRes.rowCount;
    const classesReady = classesCount >= 1;

    // 5. Verified masters
    const mastersRes = await dbClient.query(
      `SELECT u.id, u.full_name, u.email, ma.status AS affiliation_status
       FROM users u
       JOIN master_affiliations ma ON u.id = ma.master_id
       WHERE ma.organization_id = $1 AND ma.status = 'ACTIVE'`,
      [targetOrgId]
    );
    const mastersCount = mastersRes.rowCount;
    const mastersReady = mastersCount >= 1;

    // 6. Student count
    const studentsRes = await dbClient.query(
      'SELECT COUNT(*) AS count FROM students WHERE organization_id = $1',
      [targetOrgId]
    );
    const studentsCount = parseInt(studentsRes.rows[0]?.count || '0', 10);

    // 7. Recent imports
    const importsRes = await dbClient.query(
      'SELECT id, idempotency_key, total_rows, imported_students_count, created_at FROM import_batches WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 5',
      [targetOrgId]
    );

    const checklist = [
      {
        key: 'PROFILE',
        title: 'Academy Identity & Registration',
        status: 'COMPLETE',
        description: `Registered as ${org.name} (${org.martial_art_style}, ${org.state}).`
      },
      {
        key: 'CURRICULUM',
        title: 'Rank Curriculum & Syllabi',
        status: curriculumReady ? 'COMPLETE' : 'PENDING',
        description: curriculumReady
          ? `Active syllabus "${activeCurriculum.system_name}" with ${curriculumRanksCount} belt ranks.`
          : 'No published active belt syllabus. Define curriculum before student grading.'
      },
      {
        key: 'MASTERS',
        title: 'Master Verification & Credentials',
        status: mastersReady ? 'COMPLETE' : 'PENDING',
        description: mastersReady
          ? `${mastersCount} verified Master(s) affiliated and authorized.`
          : 'Awaiting Master verification by Persatuan leadership.'
      },
      {
        key: 'CLASSES',
        title: 'Class Schedules & Training Venues',
        status: classesReady ? 'COMPLETE' : 'PENDING',
        description: classesReady
          ? `${classesCount} operational training class(es) approved.`
          : 'No active classes configured. Create and approve classes for enrollment.'
      },
      {
        key: 'MERCHANT',
        title: 'Persatuan Payments & Merchant Account',
        status: merchantReady ? 'COMPLETE' : 'OPTIONAL',
        description: merchantReady
          ? `Direct settlement configured (${merchant.provider} account ${merchant.merchant_account_id || ''}).`
          : 'Merchant credentials not yet configured. Offline/cash receipts remain available.'
      },
      {
        key: 'STUDENTS',
        title: 'Student Roster & Legacy Migration',
        status: studentsCount > 0 ? 'COMPLETE' : 'PENDING',
        description: studentsCount > 0
          ? `${studentsCount} student(s) currently registered in academy roster.`
          : 'Roster is empty. Import legacy records or enroll students.'
      }
    ];

    const completedCount = checklist.filter((item) => item.status === 'COMPLETE').length;
    const readinessScorePercent = Math.round((completedCount / checklist.length) * 100);
    const isReadyForOperations = curriculumReady && classesReady && mastersReady;

    return res.json({
      organizationId: targetOrgId,
      organizationName: org.name,
      martialArtStyle: org.martial_art_style,
      state: org.state,
      isReadyForOperations,
      readinessScorePercent,
      checklist,
      metrics: {
        curriculumReady,
        curriculumRanksCount,
        classesReady,
        classesCount,
        mastersReady,
        mastersCount,
        merchantReady,
        merchantMode,
        studentsCount,
        importBatchesCount: importsRes.rowCount
      },
      recentImports: importsRes.rows
    });
  } catch (err: any) {
    console.error('[Onboarding readiness error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Failed to fetch setup readiness.') });
  }
});

// ============================================================================
// 2. Dry-Run Import Preview Endpoint (Zero Database Mutation Guarantee)
// ============================================================================

router.post('/preview-import', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_STUDENTS), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'Operational imports require an authorized Persatuan organization context.' });
    }

    const { rows, sourceFilename } = req.body;

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Import data must provide an array of student rows.' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Import batch cannot be empty.' });
    }

    if (rows.length > 500) {
      return res.status(400).json({ error: 'Import batch exceeds maximum limit of 500 records per preview.' });
    }

    // Fetch existing ICs in this organization for duplicate detection
    const existingIcsRes = await dbClient.query(
      'SELECT ic_number FROM students WHERE organization_id = $1',
      [organizationId]
    );

    const existingIcs = new Set<string>(
      existingIcsRes.rows.map((r: { ic_number: string }) => cleanIcNumber(r.ic_number))
    );

    const batchIcs = new Set<string>();
    const previewItems: ValidatedPreviewItem[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowItem = rows[i] || {};
      const validated = validateRow(rowItem, i + 1, organizationId, existingIcs, batchIcs);
      previewItems.push(validated);
    }

    const validRowsCount = previewItems.filter((i) => i.status === 'VALID').length;
    const duplicateRowsCount = previewItems.filter((i) => i.status === 'DUPLICATE').length;
    const malformedRowsCount = previewItems.filter((i) => i.status === 'MALFORMED').length;
    const wrongTenantRowsCount = previewItems.filter((i) => i.status === 'WRONG_TENANT').length;
    const unverifiedParentRowsCount = previewItems.filter((i) => i.status === 'UNVERIFIED_PARENT').length;

    const previewId = `prev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Store preview records in the temporary preview table for audit and commit
    // Note: No mutations occur on students, users, or classes tables (Dry-Run Guarantee)
    for (const item of previewItems) {
      await dbClient.query(
        `INSERT INTO import_preview_records (id, preview_id, organization_id, created_by, row_index, raw_data, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `ipr_${previewId}_${item.rowIndex}`,
          previewId,
          organizationId,
          user.id,
          item.rowIndex,
          JSON.stringify(item.data),
          item.status,
          item.errorMessage || null
        ]
      );
    }

    const errors = previewItems
      .filter((i) => i.status !== 'VALID')
      .map((i) => ({
        rowIndex: i.rowIndex,
        status: i.status,
        error: i.errorMessage,
        data: i.data
      }));

    const canCommit = validRowsCount > 0 && wrongTenantRowsCount === 0;

    return res.status(200).json({
      previewId,
      organizationId,
      sourceFilename: sourceFilename || 'legacy_import.csv',
      totalRows: rows.length,
      validRowsCount,
      duplicateRowsCount,
      malformedRowsCount,
      wrongTenantRowsCount,
      unverifiedParentRowsCount,
      canCommit,
      previewRows: previewItems,
      errors
    });
  } catch (err: any) {
    console.error('[Import preview error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Failed to generate import preview.') });
  }
});

// ============================================================================
// 3. Authorized Commit Import Endpoint (Idempotent, Transactional, Audited)
// ============================================================================

router.post('/commit-import', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_STUDENTS), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'Operational imports require an authorized Persatuan organization context.' });
    }

    const { previewId, idempotencyKey } = req.body;

    if (!previewId || typeof previewId !== 'string') {
      return res.status(400).json({ error: 'previewId is required to commit an import.' });
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({ error: 'idempotencyKey is required for concurrency safety and idempotent retries.' });
    }

    // 1. Idempotency Check: if this key has already been committed, return existing batch without duplicating
    const existingBatch = await dbClient.query(
      'SELECT * FROM import_batches WHERE idempotency_key = $1',
      [idempotencyKey.trim()]
    );

    if (existingBatch.rowCount > 0) {
      const batch = existingBatch.rows[0];
      return res.status(200).json({
        success: true,
        alreadyCommitted: true,
        batchId: batch.id,
        idempotencyKey: batch.idempotency_key,
        status: batch.status,
        importedStudentsCount: batch.imported_students_count,
        importedGuardiansCount: batch.imported_guardians_count,
        skippedDuplicatesCount: batch.skipped_duplicates_count,
        createdAt: batch.created_at,
        message: 'Import batch was previously committed. Idempotent response returned without duplicate mutation.'
      });
    }

    // 2. Fetch the preview records
    const previewRes = await dbClient.query(
      `SELECT * FROM import_preview_records
       WHERE preview_id = $1 AND organization_id = $2
       ORDER BY row_index ASC`,
      [previewId, organizationId]
    );

    if (previewRes.rowCount === 0) {
      return res.status(404).json({ error: 'No import preview records found matching the provided previewId for this organization.' });
    }

    const validRows = previewRes.rows.filter((r: { status: string }) => r.status === 'VALID');
    if (validRows.length === 0) {
      return res.status(400).json({ error: 'No valid rows found in preview to commit.' });
    }

    // 3. Execute atomic transaction in PostgreSQL
    const batchId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let importedStudentsCount = 0;
    let importedGuardiansCount = 0;
    let importedRanksCount = 0;

    await dbClient.transaction(async (tx) => {
      // Fetch classes in this organization to link matching class names
      const classesRes = await tx.query(
        'SELECT id, name FROM classes WHERE organization_id = $1',
        [organizationId]
      );
      const classMap = new Map<string, string>();
      for (const c of classesRes.rows) {
        classMap.set(c.name.trim().toLowerCase(), c.id);
      }

      for (const item of validRows) {
        const row: LegacyImportRowInput = typeof item.raw_data === 'string' ? JSON.parse(item.raw_data) : item.raw_data;

        // Duplicate check within transaction to prevent race conditions
        const cleanIc = cleanIcNumber(row.icNumber!);
        const dupCheck = await tx.query(
          "SELECT id FROM students WHERE organization_id = $1 AND UPPER(REPLACE(ic_number, '-', '')) = $2",
          [organizationId, cleanIc]
        );

        if (dupCheck.rowCount > 0) {
          continue; // skip duplicate in atomic run
        }

        const studentId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        let classId: string | null = null;
        if (row.className && classMap.has(row.className.trim().toLowerCase())) {
          classId = classMap.get(row.className.trim().toLowerCase())!;
        }

        const beltRank = row.beltRank?.trim() || 'White Belt';
        const fullName = row.fullName!.trim();
        const icNumber = row.icNumber!.trim();
        const phone = row.phone?.trim() || null;
        const email = row.email?.trim() || null;

        // Insert student with REVIEW_REQUIRED status to preserve identity without silently granting active class participation (Fix IMPORT-AUTH-001)
        await tx.query(
          `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, status, billing_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 120.00, 'REVIEW_REQUIRED', 'Unpaid')`,
          [studentId, organizationId, classId, fullName, icNumber, phone, email, beltRank]
        );
        importedStudentsCount++;

        // If class was mapped from import, create official enrollment application requiring Master review
        if (classId) {
          const appId = `app_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await tx.query(
            `INSERT INTO enrollment_applications (
               id, student_id, class_id, organization_id, applicant_type, student_name, ic_number, phone,
               status, notes, version, consent_accepted, submitted_at
             ) VALUES ($1, $2, $3, $4, 'STUDENT', $5, $6, $7, 'SUBMITTED', 'Legacy import onboarding application requiring Master review.', 1, true, CURRENT_TIMESTAMP)`,
            [appId, studentId, classId, organizationId, fullName, icNumber, phone]
          );
        }

        // Record historical belt rank provenance
        await tx.query(
          `INSERT INTO student_rank_history (id, student_id, rank_name, notes, awarded_at)
           VALUES ($1, $2, $3, 'Imported historical rank from onboarding legacy records', CURRENT_TIMESTAMP)`,
          [`srh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, studentId, beltRank]
        );
        importedRanksCount++;

        // Handle verified parent/guardian
        if (row.parentName && row.parentName.trim() !== '' && (row.parentPhone || row.parentEmail)) {
          const parentName = row.parentName.trim();
          const parentEmail = row.parentEmail?.trim() || `guardian_${cleanIc.slice(0, 6)}@beltflow.local`;
          const parentPhone = row.parentPhone?.trim() || null;

          // Check if parent user already exists
          let parentUserId: string;
          const existingParent = await tx.query(
            "SELECT id FROM users WHERE email = $1 AND role = 'PARENT'",
            [parentEmail.toLowerCase()]
          );

          if (existingParent.rowCount > 0) {
            parentUserId = existingParent.rows[0].id;
          } else {
            parentUserId = `usr_p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await tx.query(
              `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
               VALUES ($1, $2, $3, 'IMPORT_PLACEHOLDER_HASH', $4, $5, 'PARENT', 'PENDING_VERIFICATION')`,
              [parentUserId, organizationId, parentEmail.toLowerCase(), parentName, parentPhone]
            );
          }

          // Link parent to student requiring admin verification before full access (Fix IMPORT-AUTH-001)
          const linkId = `plink_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await tx.query(
            `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
             VALUES ($1, $2, $3, 'PENDING_ADMIN', FALSE, FALSE, FALSE)
             ON CONFLICT (parent_id, student_id) DO NOTHING`,
            [linkId, parentUserId, studentId]
          );
          importedGuardiansCount++;
        }
      }

      // Record committed import batch
      await tx.query(
        `INSERT INTO import_batches (id, organization_id, initiated_by, idempotency_key, status, total_rows, imported_students_count, imported_guardians_count, imported_ranks_count, skipped_duplicates_count)
         VALUES ($1, $2, $3, $4, 'COMMITTED', $5, $6, $7, $8, $9)`,
        [
          batchId,
          organizationId,
          user.id,
          idempotencyKey.trim(),
          previewRes.rowCount,
          importedStudentsCount,
          importedGuardiansCount,
          importedRanksCount,
          previewRes.rowCount - importedStudentsCount
        ]
      );

      // Append immutable audit log entry
      await tx.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email, timestamp)
         VALUES ($1, 'LEGACY_IMPORT_COMMITTED', $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          JSON.stringify({
            organizationId,
            batchId,
            previewId,
            idempotencyKey: idempotencyKey.trim(),
            importedStudentsCount,
            importedGuardiansCount,
            importedRanksCount
          }),
          user.role,
          user.email
        ]
      );
    });

    return res.status(200).json({
      success: true,
      batchId,
      idempotencyKey: idempotencyKey.trim(),
      status: 'COMMITTED',
      importedStudentsCount,
      importedGuardiansCount,
      importedRanksCount,
      skippedDuplicatesCount: previewRes.rowCount - importedStudentsCount,
      message: `Successfully committed legacy import: ${importedStudentsCount} student(s) imported (pending Master review before active enrollment).`
    });
  } catch (err: any) {
    console.error('[Commit import error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Failed to commit import batch.') });
  }
});

// ============================================================================
// 4. Essential Family Summary Endpoint with Merchant Separation
// ============================================================================

router.get('/family-summary', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (user.role !== UserRole.PARENT) {
      return res.status(403).json({ error: 'Access denied: Family summary is exclusive to registered parents and guardians.' });
    }

    // 1. Fetch parent user details
    const userRes = await dbClient.query('SELECT full_name FROM users WHERE id = $1', [user.id]);
    const parentFullName = userRes.rows[0]?.full_name || user.email;

    // 2. Fetch children linked to this parent
    const childrenRes = await dbClient.query(
      `SELECT s.id, s.full_name, s.ic_number, s.belt_rank, s.monthly_fee, s.billing_status, s.status,
              s.organization_id, o.name AS organization_name, o.martial_art_style,
              c.id AS class_id, c.name AS class_name, c.schedule, c.location
       FROM parent_student_links psl
       JOIN students s ON psl.student_id = s.id
       JOIN organizations o ON s.organization_id = o.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE psl.parent_id = $1`,
      [user.id]
    );

    const children = childrenRes.rows;
    if (children.length === 0) {
      return res.json({
        parent: { id: user.id, fullName: parentFullName, email: user.email },
        children: [],
        separatedCheckouts: [],
        hasCrossMerchantChildren: false,
        crossMerchantWarning: null,
        nextSessions: [],
        notices: []
      });
    }

    const studentIds = children.map((c: { id: string }) => c.id);
    const orgIds = Array.from(new Set(children.map((c: { organization_id: string }) => c.organization_id)));

    // 2. Fetch outstanding monthly dues for all linked children
    const duesRes = await dbClient.query(
      `SELECT md.id, md.organization_id, md.student_id, md.billing_month, md.fee_amount, md.amount_paid,
              (md.fee_amount - md.amount_paid) AS balance, md.status,
              s.full_name AS student_name, o.name AS organization_name
       FROM monthly_dues md
       JOIN students s ON md.student_id = s.id
       JOIN organizations o ON md.organization_id = o.id
       WHERE md.student_id = ANY($1) AND md.status != 'Paid'
       ORDER BY md.billing_month ASC`,
      [studentIds]
    );

    // 3. Fetch merchants for each organization
    const merchantsRes = await dbClient.query(
      `SELECT organization_id, id AS merchant_id, provider, status
       FROM persatuan_merchants
       WHERE organization_id = ANY($1)`,
      [orgIds]
    );

    const merchantByOrg = new Map<string, any>();
    for (const m of merchantsRes.rows) {
      merchantByOrg.set(m.organization_id, m);
    }

    // 4. Group dues and checkouts strictly by organization merchant (family_checkout_separates_merchants)
    const checkoutsByOrg = new Map<string, any>();

    for (const orgId of orgIds) {
      const orgChildren = children.filter((c: { organization_id: string }) => c.organization_id === orgId);
      const orgDues = duesRes.rows.filter((d: { organization_id: string }) => d.organization_id === orgId);
      const merchant = merchantByOrg.get(orgId);

      const totalAmountDue = orgDues.reduce((sum: number, d: { balance: string | number }) => sum + parseFloat(String(d.balance || 0)), 0);

      checkoutsByOrg.set(orgId, {
        organizationId: orgId,
        organizationName: orgChildren[0]?.organization_name || 'Academy',
        merchantId: merchant ? merchant.merchant_id : null,
        merchantProvider: merchant ? merchant.provider : 'OFFLINE_MANUAL',
        merchantStatus: merchant ? merchant.status : 'UNCONFIGURED',
        isOnlinePaymentSupported: Boolean(merchant && merchant.status === 'ACTIVE'),
        children: orgChildren.map((c: { id: string; full_name: string; belt_rank: string }) => ({
          studentId: c.id,
          fullName: c.full_name,
          beltRank: c.belt_rank
        })),
        dues: orgDues.map((d: any) => ({
          id: d.id,
          studentId: d.student_id,
          studentName: d.student_name,
          billingMonth: d.billing_month,
          amount: parseFloat(String(d.fee_amount)),
          balance: parseFloat(String(d.balance)),
          status: d.status
        })),
        totalAmountDue: Math.round(totalAmountDue * 100) / 100,
        currency: 'MYR'
      });
    }

    const separatedCheckouts = Array.from(checkoutsByOrg.values());
    const hasCrossMerchantChildren = separatedCheckouts.length > 1;

    // 5. Fetch upcoming training sessions for classes where children are enrolled
    const classIds = children
      .map((c: { class_id: string | null }) => c.class_id)
      .filter((cid: string | null): cid is string => Boolean(cid));

    let nextSessions: any[] = [];
    if (classIds.length > 0) {
      const sessionsRes = await dbClient.query(
        `SELECT ts.id, ts.class_id, ts.session_date, ts.start_time, ts.end_time, ts.location, ts.status,
                c.name AS class_name
         FROM training_sessions ts
         JOIN classes c ON ts.class_id = c.id
         WHERE ts.class_id = ANY($1) AND ts.session_date >= TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AND ts.status != 'CANCELLED'
         ORDER BY ts.session_date ASC, ts.start_time ASC LIMIT 6`,
        [classIds]
      );
      nextSessions = sessionsRes.rows;
    }

    // 6. Fetch notices for the children's organizations
    const noticesRes = await dbClient.query(
      `SELECT n.id, n.organization_id, n.type, n.message, n.sender_name, n.created_at,
              o.name AS organization_name
       FROM notices n
       JOIN organizations o ON n.organization_id = o.id
       WHERE n.organization_id = ANY($1)
       ORDER BY n.created_at DESC LIMIT 5`,
      [orgIds]
    );

    return res.json({
      parent: {
        id: user.id,
        fullName: parentFullName,
        email: user.email
      },
      children: children.map((c: any) => ({
        id: c.id,
        fullName: c.full_name,
        icNumber: c.ic_number,
        beltRank: c.belt_rank,
        monthlyFee: parseFloat(String(c.monthly_fee)),
        billingStatus: c.billing_status,
        status: c.status,
        organizationId: c.organization_id,
        organizationName: c.organization_name,
        martialArtStyle: c.martial_art_style,
        classId: c.class_id,
        className: c.class_name,
        schedule: c.schedule,
        location: c.location
      })),
      separatedCheckouts,
      hasCrossMerchantChildren,
      crossMerchantWarning: hasCrossMerchantChildren
        ? 'Independent Persatuan Settlement: Your children are enrolled in different academies. Payments must be checked out separately per Persatuan to ensure direct funds settlement to the authorized academy.'
        : null,
      nextSessions,
      notices: noticesRes.rows
    });
  } catch (err: any) {
    console.error('[Family summary error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Failed to fetch family summary.') });
  }
});

export default router;
