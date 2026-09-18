import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { UserRole } from '../security/rbac';
import { hashPasswordServer, verifyPasswordServer, generateAuthToken } from '../security/crypto';
import { validatePassword } from '../security/passwordPolicy';
import { authenticateJWT } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';
import { rateLimit } from '../middleware/rateLimit';

const authAttemptLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many attempts. Please try again in a few minutes.' });

const router = Router();

router.get('/setup-status', async (_req: Request, res: Response) => {
  try {
    const result = await dbClient.query("SELECT 1 FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
    return res.json({ setupRequired: result.rowCount === 0 });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/registration-organizations', async (_req: Request, res: Response) => {
  try {
    const result = await dbClient.query(
      "SELECT id, name, state, martial_art_style FROM organizations WHERE status = 'ACTIVE' ORDER BY name");
    return res.json({ organizations: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/registration-organizations/:orgId/classes', async (req: Request, res: Response) => {
  try {
    const result = await dbClient.query(
      `SELECT c.id, c.name, c.schedule FROM classes c JOIN organizations o ON o.id = c.organization_id
       WHERE c.organization_id = $1 AND c.status = 'ACTIVE' AND o.status = 'ACTIVE' ORDER BY c.name`,
      [req.params.orgId]);
    return res.json({ classes: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Setup initial Super Admin account (Allowed ONLY when zero super admins exist)
router.post('/setup-admin', authAttemptLimit, async (req: Request, res: Response) => {
  try {
    const existing = await dbClient.query('SELECT id FROM users WHERE role = $1', [UserRole.SUPER_ADMIN]);
    if (existing.rowCount > 0) {
      return res.status(403).json({ error: 'Security Exception: Super Admin setup is permanently locked after initialization.' });
    }

    const { fullName, email, phone, password, confirmPassword } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }
    if (confirmPassword !== undefined && password.trim() !== String(confirmPassword).trim()) {
      return res.status(400).json({ error: 'Password and confirmation do not match.' });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passHash = hashPasswordServer(password.trim());

    const insertResult = await dbClient.query(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, email, phone, role, status, created_at`,
      [userId, fullName.trim(), email.trim().toLowerCase(), phone?.trim() || null, passHash, UserRole.SUPER_ADMIN, 'ACTIVE']
    );

    const newUser = insertResult.rows[0];

    // Log audit action
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Super Admin Setup', `Initial setup of Super Admin: ${newUser.full_name}`, newUser.role, newUser.email]
    );

    const token = generateAuthToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    return res.status(201).json({
      message: 'Super Admin initialized successfully in PostgreSQL database.',
      token,
      user: newUser
    });
  } catch (err: any) {
    console.error('Setup admin error:', err);
    console.error('[Internal database error]', err);
    return res.status(500).json({ error: 'Internal database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Login endpoint
router.post('/login', authAttemptLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await dbClient.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    const isValid = verifyPasswordServer(password.trim(), user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is awaiting approval or is inactive.' });
    }
    if (user.organization_id) {
      const org = await dbClient.query('SELECT status FROM organizations WHERE id = $1', [user.organization_id]);
      if (org.rows[0]?.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Organization is inactive.' });
      }
    }

    // Fetch assigned classes if Master
    let assignedClassIds: string[] = [];
    if (user.role === UserRole.MASTER) {
      const assignRes = await dbClient.query('SELECT class_id FROM coach_class_assignments WHERE coach_id = $1', [user.id]);
      assignedClassIds = assignRes.rows.map(r => r.class_id);
    }

    // Fetch ACTIVE-only linked students if Parent.
    // Pending / rejected link requests are excluded — they grant no access.
    let linkedStudentIds: string[] = [];
    if (user.role === UserRole.PARENT) {
      const linkRes = await dbClient.query(
        `SELECT student_id FROM parent_student_links
         WHERE parent_id = $1 AND status = 'ACTIVE' AND student_approved = true
           AND master_approved = true AND admin_approved = true`,
        [user.id]
      );
      linkedStudentIds = linkRes.rows.map(r => r.student_id);
    }

    const authContext = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id || undefined,
      assignedClassIds,
      linkedStudentIds
    };

    const token = generateAuthToken(authContext);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'User Login', `User logged in: ${user.full_name}`, user.role, user.email]
    );

    return res.json({
      message: 'Authentication successful.',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        assignedClassIds,
        linkedStudentIds
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    console.error('[Internal server error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Current user profile
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userRes = await dbClient.query('SELECT id, organization_id, email, full_name, phone, role, status FROM users WHERE id = $1', [req.user?.id]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    const user = userRes.rows[0];
    return res.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        assignedClassIds: req.user?.assignedClassIds || [],
        linkedStudentIds: req.user?.linkedStudentIds || []
      }
    });
  } catch (err: any) {
    console.error('[Internal database error]', err);
    return res.status(500).json({ error: 'Internal database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Change Password endpoint — currentPassword is MANDATORY. Omitting it is rejected.
router.post('/change-password', authAttemptLimit, authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !currentPassword.trim()) {
      return res.status(400).json({ error: 'Current password is required to change your password.' });
    }
    const newPasswordCheck = validatePassword(newPassword);
    if (!newPasswordCheck.valid) {
      return res.status(400).json({ error: newPasswordCheck.error });
    }

    const userRes = await dbClient.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    const isValid = verifyPasswordServer(currentPassword.trim(), userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hashed = hashPasswordServer(newPassword.trim());
    await dbClient.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, req.user!.id]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Password Changed', `User updated their account password`, req.user!.role, req.user!.email]
    );

    return res.json({ message: 'Password successfully updated in PostgreSQL database.' });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// POST /auth/register-student — student self-registration (creates STUDENT role, not MASTER).
// The student account is created with status PENDING_VERIFICATION.
// An ADMIN_PERSATUAN or MASTER must approve it before it can be used for access.
// Privileged roles (SUPER_ADMIN, ADMIN_PERSATUAN, MASTER, PARENT) cannot use this endpoint.
router.post('/register-student', authAttemptLimit, async (req: Request, res: Response) => {
  try {
    const { organizationId, fullName, email, phone, password, classId, beltRank, icNumber } = req.body;

    if (!fullName || !email || !password || !organizationId || !classId) {
      return res.status(400).json({ error: 'fullName, email, password, organizationId, and requested classId are required.' });
    }
    const studentPasswordCheck = validatePassword(password);
    if (!studentPasswordCheck.valid) {
      return res.status(400).json({ error: studentPasswordCheck.error });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Confirm the organization exists — students may not self-assign to a fabricated org.
    const orgRes = await dbClient.query(
      "SELECT id, base_monthly_fee FROM organizations WHERE id = $1 AND status = 'ACTIVE'",
      [organizationId]
    );
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    const baseFee = Number(orgRes.rows[0].base_monthly_fee);

    const existing = await dbClient.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Validate classId belongs to this org if supplied
    const classRes = await dbClient.query(
      "SELECT id FROM classes WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'",
      [classId, organizationId]
    );
    if (classRes.rowCount === 0) {
      return res.status(400).json({ error: 'The requested class is unavailable in this organization.' });
    }

    const userId   = `usr_stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const studentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passHash = hashPasswordServer(password.trim());

    // 1. Create the user account with role=STUDENT, status=PENDING_VERIFICATION
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, organizationId, cleanEmail, passHash, fullName.trim(), phone?.trim() || null, UserRole.STUDENT, 'PENDING_VERIFICATION']
    );

    // 2. Create the student profile row
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, phone, email,
                             belt_rank, monthly_fee, has_sibling_discount, billing_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [studentId, organizationId, classId || null, userId,
       fullName.trim(), icNumber?.trim() || '', phone?.trim() || null, cleanEmail,
       'White Belt', baseFee, false, 'Unpaid', 'PENDING']
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Student Self-Registration', `Student ${fullName.trim()} registered — awaiting admin approval`, UserRole.STUDENT, cleanEmail]
    );

    return res.status(201).json({
      message: 'Student account registered. An assigned Master must approve it before you can sign in.',
      user: {
        id: userId, fullName: fullName.trim(), email: cleanEmail,
        role: UserRole.STUDENT, organizationId, status: 'PENDING_VERIFICATION',
        studentId
      }
    });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// An assigned Master activates a self-registered student. The proposed class is
// only an approval destination and grants no student access while pending.
router.get('/student-registrations/pending', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.MASTER) return res.status(403).json({ error: 'Master account required.' });
    const result = await dbClient.query(
      `SELECT s.id, s.full_name, s.class_id, s.registered_at FROM students s
       JOIN users u ON u.id = s.user_id WHERE s.organization_id = $1 AND s.class_id = ANY($2::text[])
       AND s.status = 'PENDING' AND u.status = 'PENDING_VERIFICATION'
       ORDER BY s.registered_at DESC`, [req.user.organizationId, req.user.assignedClassIds || []]);
    return res.json({ registrations: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.post('/student-registrations/:studentId/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.MASTER) return res.status(403).json({ error: 'Assigned Master approval is required.' });
    const student = await dbClient.query(
      `SELECT s.id, s.class_id, s.user_id, s.status, s.organization_id, u.status AS account_status
       FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [req.params.studentId]);
    const row = student.rows[0];
    if (!row) return res.status(404).json({ error: 'Student registration not found.' });
    if (row.status !== 'PENDING' || row.account_status !== 'PENDING_VERIFICATION') {
      return res.status(409).json({ error: 'Registration is no longer pending.' });
    }
    if (row.organization_id !== req.user.organizationId || !row.class_id ||
        !req.user.assignedClassIds?.includes(row.class_id)) {
      return res.status(403).json({ error: 'Master is not assigned to the requested class.' });
    }
    await dbClient.query("UPDATE users SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'PENDING_VERIFICATION'", [row.user_id]);
    await dbClient.query("UPDATE students SET status = 'ACTIVE' WHERE id = $1 AND status = 'PENDING'", [row.id]);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Student Registration Approved', `Student ${row.id} activated`, req.user.role, req.user.email]);
    return res.json({ message: 'Student account activated.' });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.post('/student-registrations/:studentId/reject', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.MASTER) return res.status(403).json({ error: 'Assigned Master approval is required.' });
    const student = await dbClient.query(
      `SELECT s.id, s.class_id, s.user_id, s.status, s.organization_id, u.status AS account_status
       FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [req.params.studentId]);
    const row = student.rows[0];
    if (!row) return res.status(404).json({ error: 'Student registration not found.' });
    if (row.organization_id !== req.user.organizationId || !req.user.assignedClassIds?.includes(row.class_id)) {
      return res.status(403).json({ error: 'Master is not assigned to the requested class.' });
    }
    if (row.status !== 'PENDING' || row.account_status !== 'PENDING_VERIFICATION') {
      return res.status(409).json({ error: 'Registration is no longer pending.' });
    }
    await dbClient.query("UPDATE users SET status = 'REJECTED' WHERE id = $1", [row.user_id]);
    await dbClient.query("UPDATE students SET status = 'REJECTED' WHERE id = $1", [row.id]);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Student Registration Rejected', `Student ${row.id} rejected`, req.user.role, req.user.email]);
    return res.json({ message: 'Student registration rejected.' });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// Register Parent — with 3-approval parent-child linking workflow
// If childName is given (no studentId): creates new child student + ACTIVE link (parent owns child).
// If studentId is given: creates parent account + PENDING link request. Access granted only after
// three-step approval: STUDENT → MASTER → ADMIN_PERSATUAN.
router.post('/register-parent', authAttemptLimit, async (req: Request, res: Response) => {
  try {
    const { organizationId, parentName, fullName, email, phone, password, childName, classId, studentId: reqStudentId, beltRank } = req.body;
    const parentFullName = parentName || fullName;
    if (!parentFullName || !email || !password) {
      return res.status(400).json({ error: 'fullName/parentName, email, and password are required.' });
    }
    const parentPasswordCheck = validatePassword(password);
    if (!parentPasswordCheck.valid) {
      return res.status(400).json({ error: parentPasswordCheck.error });
    }
    if (!reqStudentId && (!childName || !classId)) {
      return res.status(400).json({ error: 'Child name and class are required for a new child.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await dbClient.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: 'An account with this email already exists in PostgreSQL.' });
    }

    let targetOrgId = organizationId;
    if (!targetOrgId) {
      if (reqStudentId) {
        const sRes = await dbClient.query('SELECT organization_id FROM students WHERE id = $1', [reqStudentId]);
        if (sRes.rowCount > 0) targetOrgId = sRes.rows[0].organization_id;
      }
      if (!targetOrgId) return res.status(400).json({ error: 'Select an organization.' });
    }
    const parentOrg = await dbClient.query("SELECT id FROM organizations WHERE id = $1 AND status = 'ACTIVE'", [targetOrgId]);
    if (!parentOrg.rowCount) return res.status(400).json({ error: 'Organization is not active or does not exist.' });
    if (classId) {
      const selectedClass = await dbClient.query('SELECT id FROM classes WHERE id = $1 AND organization_id = $2', [classId, targetOrgId]);
      if (!selectedClass.rowCount) return res.status(400).json({ error: 'Class must belong to this organization.' });
    }

    const parentId = `usr_parent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passHash = hashPasswordServer(password.trim());

    // Insert Parent User
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [parentId, targetOrgId, cleanEmail, passHash, parentFullName.trim(), phone?.trim() || null, UserRole.PARENT, 'ACTIVE']
    );

    // --- Branch: new child vs. linking to existing student ---
    if (reqStudentId) {
      // Linking to an EXISTING student requires the 3-approval workflow.
      // Verify the student actually exists in the same organization.
      const studentCheck = await dbClient.query(
        'SELECT id, organization_id, full_name FROM students WHERE id = $1',
        [reqStudentId]
      );
      if (studentCheck.rowCount === 0) {
        await dbClient.query('DELETE FROM users WHERE id = $1', [parentId]);
        return res.status(404).json({ error: 'Student not found. Provide a valid student ID to request a link.' });
      }

      // Gap 4: verify the student actually belongs to the resolved organization.
      // Prevents a parent from fabricating an organizationId that doesn't match the student.
      const studentOrgId = studentCheck.rows[0].organization_id;
      if (studentOrgId !== targetOrgId) {
        await dbClient.query('DELETE FROM users WHERE id = $1', [parentId]);
        return res.status(403).json({
          error: 'Cross-organization link not permitted: the student does not belong to the specified organization.'
        });
      }

      // Create a PENDING link request — NOT an active link.
      const linkId = `plink_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await dbClient.query(
        `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved, created_at)
         VALUES ($1, $2, $3, 'PENDING_STUDENT', false, false, false, CURRENT_TIMESTAMP)
         ON CONFLICT (parent_id, student_id) DO NOTHING`,
        [linkId, parentId, reqStudentId]
      );

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [`audit_${Date.now()}`, 'Parent Link Request', `Parent ${parentFullName.trim()} requested link to existing student ${reqStudentId}`, UserRole.PARENT, cleanEmail]
      );

      // Issue token but linkedStudentIds is empty until the link is fully approved.
      const token = generateAuthToken({ id: parentId, email: cleanEmail, role: UserRole.PARENT, organizationId: targetOrgId, assignedClassIds: [], linkedStudentIds: [] });
      return res.status(201).json({
        message: 'Parent account created. A link request has been sent to the student and must be approved by the student, their Master, and the Persatuan Admin before access is granted.',
        token,
        user: { id: parentId, fullName: parentFullName.trim(), email: cleanEmail, role: UserRole.PARENT, organizationId: targetOrgId, linkedStudentIds: [] },
        linkRequest: { id: linkId, studentId: reqStudentId, status: 'PENDING_STUDENT' }
      });
    } else {
      // Creating a NEW child student — parent is the registering guardian, link is ACTIVE.
      const newStudentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const orgRes = await dbClient.query('SELECT base_monthly_fee FROM organizations WHERE id = $1', [targetOrgId]);
      const baseFee = orgRes.rows[0]?.base_monthly_fee;

      await dbClient.query(
        `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, has_sibling_discount, billing_status, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [newStudentId, targetOrgId, classId, childName.trim(), '', phone?.trim() || null, null, 'White Belt', baseFee, false, 'Unpaid', 'ACTIVE']
      );

      // ACTIVE link — parent created this child, no external approval needed.
      const linkId = `plink_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await dbClient.query(
        `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved, created_at)
         VALUES ($1, $2, $3, 'ACTIVE', true, true, true, CURRENT_TIMESTAMP)
         ON CONFLICT (parent_id, student_id) DO NOTHING`,
        [linkId, parentId, newStudentId]
      );

      const token = generateAuthToken({ id: parentId, email: cleanEmail, role: UserRole.PARENT, organizationId: targetOrgId, assignedClassIds: [], linkedStudentIds: [newStudentId] });

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [`audit_${Date.now()}`, 'Parent Registration', `Registered parent: ${parentFullName.trim()} with new child student ${newStudentId}`, UserRole.PARENT, cleanEmail]
      );

      return res.status(201).json({
        message: 'Parent and new child student successfully registered and linked.',
        token,
        user: { id: parentId, fullName: parentFullName.trim(), email: cleanEmail, role: UserRole.PARENT, organizationId: targetOrgId, linkedStudentIds: [newStudentId] },
        parentId,
        studentId: newStudentId
      });
    }
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// GET pending parent-child link requests (for students, masters, and admins to review)
router.post('/parent-link-requests', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== UserRole.PARENT) return res.status(403).json({ error: 'Parent account required.' });

    let studentId = req.body.studentId;
    if (!studentId && req.body.icNumber) {
      // Lookup is scoped strictly to the parent's own organization — this
      // never exposes a directory of students and never reveals whether a
      // matching IC number exists in a DIFFERENT academy.
      const lookup = await dbClient.query(
        'SELECT id FROM students WHERE organization_id = $1 AND ic_number = $2',
        [user.organizationId, String(req.body.icNumber).trim()]
      );
      if (!lookup.rowCount) {
        return res.status(404).json({ error: 'No student with that IC / Student ID was found in your academy.' });
      }
      studentId = lookup.rows[0].id;
    }
    if (!studentId) return res.status(400).json({ error: 'studentId or icNumber is required.' });

    const student = await dbClient.query('SELECT id, organization_id FROM students WHERE id = $1', [studentId]);
    if (!student.rowCount) return res.status(404).json({ error: 'Student not found.' });
    if (student.rows[0].organization_id !== user.organizationId) {
      return res.status(403).json({ error: 'Parent and student must belong to the same organization.' });
    }
    const existing = await dbClient.query('SELECT id, status FROM parent_student_links WHERE parent_id = $1 AND student_id = $2', [user.id, studentId]);
    if (existing.rowCount) return res.status(409).json({ error: 'A link or request already exists for this child.' });
    const id = `plink_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ($1, $2, $3, 'PENDING_STUDENT', false, false, false) RETURNING *`,
      [id, user.id, studentId]);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Parent Link Request', `Parent ${user.id} requested link to ${studentId}`, user.role, user.email]);
    return res.status(201).json({ linkRequest: result.rows[0] });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.get('/parent-link-requests', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let query: string;
    let params: any[];

    if (user.role === UserRole.SUPER_ADMIN) {
      // Super Admin denied access to operational records
      return res.status(403).json({ error: 'Super Admin does not access academy operational records.' });
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      query = `SELECT psl.*, u.full_name as parent_name, s.full_name as student_name
               FROM parent_student_links psl
               JOIN users u ON u.id = psl.parent_id
               JOIN students s ON s.id = psl.student_id
               WHERE s.organization_id = $1 AND psl.status = 'PENDING_ADMIN'
               ORDER BY psl.created_at DESC`;
      params = [user.organizationId];
    } else if (user.role === UserRole.MASTER) {
      query = `SELECT psl.*, u.full_name as parent_name, s.full_name as student_name
               FROM parent_student_links psl
               JOIN users u ON u.id = psl.parent_id
               JOIN students s ON s.id = psl.student_id
               WHERE s.class_id = ANY($1::text[]) AND psl.status = 'PENDING_MASTER'
               ORDER BY psl.created_at DESC`;
      params = [user.assignedClassIds || []];
    } else if (user.role === UserRole.STUDENT) {
      // Students can see link requests for themselves
      const stuRes = await dbClient.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
      const stuId = stuRes.rows[0]?.id;
      if (!stuId) return res.json({ linkRequests: [] });
      query = `SELECT psl.*, u.full_name as parent_name, s.full_name as student_name
               FROM parent_student_links psl
               JOIN users u ON u.id = psl.parent_id
               JOIN students s ON s.id = psl.student_id
               WHERE psl.student_id = $1 AND psl.status = 'PENDING_STUDENT'`;
      params = [stuId];
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const result = await dbClient.query(query, params);
    return res.json({ linkRequests: result.rows });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// POST approve one step of a parent-child link request
router.post('/parent-link-requests/:linkId/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { linkId } = req.params;

    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin does not approve academy operational records.' });
    }

    const linkRes = await dbClient.query('SELECT * FROM parent_student_links WHERE id = $1', [linkId]);
    if (linkRes.rowCount === 0) return res.status(404).json({ error: 'Link request not found.' });
    const link = linkRes.rows[0];

    if (link.status === 'ACTIVE') return res.status(400).json({ error: 'This link is already fully approved.' });
    if (link.status === 'REJECTED') return res.status(400).json({ error: 'This link has been rejected.' });

    let studentApproved = link.student_approved;
    let masterApproved = link.master_approved;
    let adminApproved = link.admin_approved;

    // Verify the approver is authorized for this specific role-step
    if (user.role === UserRole.STUDENT) {
      // Student must be the actual linked student
      const stuRes = await dbClient.query('SELECT id FROM students WHERE id = $1 AND user_id = $2', [link.student_id, user.id]);
      if (stuRes.rowCount === 0) return res.status(403).json({ error: 'You are not the student on this link request.' });
      if (link.status !== 'PENDING_STUDENT') return res.status(400).json({ error: 'This step is not awaiting student approval.' });
      studentApproved = true;
    } else if (user.role === UserRole.MASTER) {
      // Master must teach the student's class
      const stuRes = await dbClient.query('SELECT class_id FROM students WHERE id = $1', [link.student_id]);
      const classId = stuRes.rows[0]?.class_id;
      if (!classId || !(user.assignedClassIds || []).includes(classId)) {
        return res.status(403).json({ error: 'You do not teach the class of the student on this link request.' });
      }
      if (link.status !== 'PENDING_MASTER') return res.status(400).json({ error: 'This step is not awaiting Master approval.' });
      masterApproved = true;
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      // Admin must belong to the same organization
      const stuRes = await dbClient.query('SELECT organization_id FROM students WHERE id = $1', [link.student_id]);
      if (stuRes.rows[0]?.organization_id !== user.organizationId) {
        return res.status(403).json({ error: 'Cross-organization approval is not permitted.' });
      }
      if (link.status !== 'PENDING_ADMIN') return res.status(400).json({ error: 'This step is not awaiting Admin approval.' });
      adminApproved = true;
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const newStatus = studentApproved && masterApproved && adminApproved
      ? 'ACTIVE'
      : !studentApproved ? 'PENDING_STUDENT'
      : !masterApproved ? 'PENDING_MASTER'
      : 'PENDING_ADMIN';

    await dbClient.query(
      `UPDATE parent_student_links
       SET student_approved = $1, master_approved = $2, admin_approved = $3, status = $4
       WHERE id = $5`,
      [studentApproved, masterApproved, adminApproved, newStatus, linkId]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Parent Link Approved', `${user.role} approved link ${linkId}. New status: ${newStatus}`, user.role, user.email]
    );

    return res.json({ message: `Approval recorded. Link status is now: ${newStatus}`, status: newStatus });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// POST reject a parent-child link request.
// Applies the same relationship scope checks as the approve endpoint:
//   STUDENT  — must be the named student on the request
//   MASTER   — must teach the student's currently assigned class
//   ADMIN    — must belong to the same organization as the student
router.post('/parent-link-requests/:linkId/reject', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { linkId } = req.params;

    if (user.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super Admin does not access academy operational records.' });
    }

    if (![UserRole.STUDENT, UserRole.MASTER, UserRole.ADMIN_PERSATUAN].includes(user.role as UserRole)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const linkRes = await dbClient.query('SELECT * FROM parent_student_links WHERE id = $1', [linkId]);
    if (linkRes.rowCount === 0) return res.status(404).json({ error: 'Link request not found.' });
    const link = linkRes.rows[0];

    if (link.status === 'ACTIVE') return res.status(400).json({ error: 'This link is already active and cannot be rejected.' });
    if (link.status === 'REJECTED') return res.status(400).json({ error: 'This link has already been rejected.' });

    // ── Scope checks (same as approve) ──────────────────────────────────────
    if (user.role === UserRole.STUDENT) {
      // Must be the student named in the link, not any other student.
      const stuRes = await dbClient.query(
        'SELECT id FROM students WHERE id = $1 AND user_id = $2',
        [link.student_id, user.id]
      );
      if (stuRes.rowCount === 0) {
        return res.status(403).json({ error: 'You are not the student on this link request.' });
      }
    } else if (user.role === UserRole.MASTER) {
      // Must teach the specific class the student is enrolled in.
      const stuRes = await dbClient.query('SELECT class_id FROM students WHERE id = $1', [link.student_id]);
      const classId = stuRes.rows[0]?.class_id;
      if (!classId || !(user.assignedClassIds || []).includes(classId)) {
        return res.status(403).json({ error: 'You do not teach the class of the student on this link request.' });
      }
    } else if (user.role === UserRole.ADMIN_PERSATUAN) {
      // Must be an admin of the same organization as the student.
      const stuRes = await dbClient.query('SELECT organization_id FROM students WHERE id = $1', [link.student_id]);
      if (stuRes.rows[0]?.organization_id !== user.organizationId) {
        return res.status(403).json({ error: 'Cross-organization rejection is not permitted.' });
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    await dbClient.query(`UPDATE parent_student_links SET status = 'REJECTED' WHERE id = $1`, [linkId]);

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}`, 'Parent Link Rejected', `${user.role} rejected link ${linkId} (student ${link.student_id})`, user.role, user.email]
    );

    return res.json({ message: 'Link request rejected.' });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

router.post('/parent-links/:linkId/revoke', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await dbClient.query(
      `SELECT p.id, p.parent_id, p.student_id, p.status, s.user_id AS student_user_id, s.organization_id
       FROM parent_student_links p JOIN students s ON s.id = p.student_id WHERE p.id = $1`,
      [req.params.linkId]);
    const link = result.rows[0];
    if (!link) return res.status(404).json({ error: 'Link not found.' });
    const user = req.user!;
    if (!(user.id === link.parent_id || user.id === link.student_user_id ||
          (user.role === UserRole.ADMIN_PERSATUAN && user.organizationId === link.organization_id))) {
      return res.status(403).json({ error: 'Link revocation access denied.' });
    }
    if (link.status !== 'ACTIVE') return res.status(409).json({ error: 'Link is not active.' });
    await dbClient.query("UPDATE parent_student_links SET status = 'REVOKED' WHERE id = $1", [link.id]);
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, 'Parent Link Revoked', `Link ${link.id} revoked`, user.role, user.email]);
    return res.json({ message: 'Link revoked.' });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

export default router;
