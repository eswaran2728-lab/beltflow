import { Router, Request, Response } from 'express';
import { dbClient } from '../db/client';
import { UserRole } from '../security/rbac';
import crypto from 'crypto';
import { hashPasswordServer, verifyPasswordServer, generateAuthToken, passwordNeedsRehash, DUMMY_PASSWORD_HASH } from '../security/crypto';
import { recordSecurityEvent } from '../services/securityEvents';
import { agreed, recordConsents } from '../services/consent';
import { validatePassword } from '../security/passwordPolicy';
import { authenticateJWT } from '../middleware/auth';
import { safeErrorMessage } from '../security/errors';
import { rateLimit } from '../middleware/rateLimit';

// Ten wrong passwords in a row lock the account for 15 minutes.
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;

const authAttemptLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many attempts. Please try again in a few minutes.' });

const router = Router();

router.get('/setup-status', async (_req: Request, res: Response) => {
  try {
    const result = await dbClient.query("SELECT 1 FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
    // setupCodeRequired tells the setup form to ask for the code (never the code itself).
    return res.json({ setupRequired: result.rowCount === 0, setupCodeRequired: !!process.env.BELTFLOW_SETUP_TOKEN });
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

    // A fresh public server must not hand the first Super Admin account to
    // whoever finds it first. When BELTFLOW_SETUP_TOKEN is set (required in
    // production), the person setting up must give that code.
    const expected = process.env.BELTFLOW_SETUP_TOKEN;
    if (expected) {
      const supplied = typeof req.body?.setupToken === 'string' ? req.body.setupToken : '';
      const a = crypto.createHash('sha256').update(supplied).digest();
      const b = crypto.createHash('sha256').update(expected).digest();
      if (!supplied || !crypto.timingSafeEqual(a, b)) {
        res.locals.securityEventRecorded = true;
        void recordSecurityEvent({ type: 'SUSPICIOUS_ACTIVITY', severity: 'ALERT', req, status: 403, detail: 'first Super Admin setup attempted without the correct setup code' });
        return res.status(403).json({ error: 'The setup code is missing or wrong.', code: 'SETUP_TOKEN_REQUIRED' });
      }
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
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Super Admin Setup', `Initial setup of Super Admin: ${newUser.full_name}`, newUser.role, newUser.email]
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
    const { email, password } = req.body || {};
    // Text only: an object or array here is an injection attempt or a bug.
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password ||
        email.length > 320 || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await dbClient.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userRes.rowCount === 0) {
      // Spend the same time as a real check, so an unknown address is not faster.
      verifyPasswordServer(password.trim(), DUMMY_PASSWORD_HASH);
      res.locals.securityEventRecorded = true;
      void recordSecurityEvent({ type: 'LOGIN_FAILED', req, status: 401, detail: 'unknown account' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    // Locked after repeated wrong passwords: refuse before checking, so the
    // lock cannot be used to keep guessing.
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      res.locals.securityEventRecorded = true;
      void recordSecurityEvent({ type: 'LOGIN_FAILED', req, userId: user.id, status: 429, detail: 'attempt while locked' });
      return res.status(429).json({ code: 'ACCOUNT_LOCKED', error: 'Too many failed sign-in attempts. Please try again later.' });
    }

    const isValid = verifyPasswordServer(password.trim(), user.password_hash);
    if (!isValid) {
      const failed = await dbClient.query(
        `UPDATE users
         SET failed_login_count = failed_login_count + 1,
             locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN CURRENT_TIMESTAMP + ($3 || ' minutes')::interval ELSE locked_until END
         WHERE id = $1
         RETURNING failed_login_count`,
        [user.id, MAX_FAILED_LOGINS, String(LOCKOUT_MINUTES)]
      );
      const count = Number(failed.rows[0]?.failed_login_count || 0);
      res.locals.securityEventRecorded = true;
      void recordSecurityEvent({ type: 'LOGIN_FAILED', req, userId: user.id, status: 401, detail: `wrong password (${count} in a row)` });
      if (count >= MAX_FAILED_LOGINS) {
        void recordSecurityEvent({ type: 'ACCOUNT_LOCKED', severity: 'ALERT', req, userId: user.id, detail: `locked for ${LOCKOUT_MINUTES} minutes after ${count} failed sign-ins` });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Correct password: clear the failure counter and upgrade an old hash.
    if (Number(user.failed_login_count) > 0 || user.locked_until || passwordNeedsRehash(user.password_hash)) {
      await dbClient.query(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL, password_hash = $2 WHERE id = $1`,
        [user.id, passwordNeedsRehash(user.password_hash) ? hashPasswordServer(password.trim()) : user.password_hash]
      );
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
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'User Login', `User logged in: ${user.full_name}`, user.role, user.email]
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
    // password_changed_at ends every session issued before now (see authenticateJWT).
    await dbClient.query(
      'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashed, req.user!.id]);
    void recordSecurityEvent({ type: 'PASSWORD_CHANGED', severity: 'INFO', req, userId: req.user!.id });

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Password Changed', `User updated their account password`, req.user!.role, req.user!.email]
    );

    // The caller keeps working with a new session; all older ones are now invalid.
    return res.json({ message: 'Password updated. Other devices have been signed out.', token: generateAuthToken(req.user!) });
  } catch (err: any) {
    console.error('[Database error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'An internal error occurred.') });
  }
});

// ---------------------------------------------------------------------------
// Password reset with one-time codes.
//
// There is no e-mail service, so a reset is issued by a person who can
// verify the account holder: the Persatuan's Admin for Masters, parents and
// students of that Persatuan; the Super Admin for Persatuan Admins. The code
// is shown once, stored only as a hash, expires after 30 minutes, works once,
// and is cancelled after 5 wrong tries. Using it ends all older sessions.
// ---------------------------------------------------------------------------
const RESET_CODE_MINUTES = 30;
const RESET_MAX_ATTEMPTS = 5;
const RESET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const hashResetCode = (code: string) => crypto.createHash('sha256').update(code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()).digest('hex');

router.post('/password-reset/issue', authAttemptLimit, authenticateJWT, async (req: Request, res: Response) => {
  try {
    const actor = req.user!;
    const { userId } = req.body || {};
    if (typeof userId !== 'string' || !userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    const targetRes = await dbClient.query('SELECT id, role, organization_id, status FROM users WHERE id = $1', [userId]);
    const target = targetRes.rows[0];
    const allowed = !!target && target.id !== actor.id && (
      (actor.role === UserRole.ADMIN_PERSATUAN && !!actor.organizationId && target.organization_id === actor.organizationId &&
        [UserRole.MASTER, UserRole.PARENT, UserRole.STUDENT].includes(target.role)) ||
      (actor.role === UserRole.SUPER_ADMIN && target.role === UserRole.ADMIN_PERSATUAN)
    );
    if (!allowed) {
      // Same answer whether the account exists or not.
      return res.status(403).json({ error: 'You cannot reset the password for this account.' });
    }

    const bytes = crypto.randomBytes(12);
    const chars = Array.from(bytes, b => RESET_ALPHABET[b % RESET_ALPHABET.length]).join('');
    const code = `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
    const expiresAt = new Date(Date.now() + RESET_CODE_MINUTES * 60_000);

    // Only the newest code for an account is valid.
    await dbClient.query(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL`, [target.id]);
    await dbClient.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, issued_by, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [`prt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`, target.id, hashResetCode(code), actor.id, expiresAt]
    );
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, 'Password Reset Issued', `Reset code issued for user ${target.id}`, actor.role, actor.email]
    );
    void recordSecurityEvent({ type: 'PASSWORD_RESET_ISSUED', severity: 'INFO', req, userId: target.id });

    return res.status(201).json({
      message: `Give this code to the account holder. It works once and expires in ${RESET_CODE_MINUTES} minutes.`,
      code,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error('[Password reset issue error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not issue a reset code.') });
  }
});

router.post('/password-reset/complete', authAttemptLimit, async (req: Request, res: Response) => {
  const refuse = () => res.status(400).json({ error: 'The reset code is wrong or has expired.' });
  try {
    const { email, code, newPassword } = req.body || {};
    if (typeof email !== 'string' || typeof code !== 'string' || !email.trim() || !code.trim() || email.length > 320 || code.length > 64) {
      return res.status(400).json({ error: 'Email, reset code and new password are required.' });
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }

    const userRes = await dbClient.query('SELECT id, role, email FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    const user = userRes.rows[0];
    if (!user) {
      void recordSecurityEvent({ type: 'PASSWORD_RESET_FAILED', req, status: 400, detail: 'unknown account' });
      return refuse();
    }
    const tokenRes = await dbClient.query(
      `SELECT id, token_hash, expires_at, failed_attempts FROM password_reset_tokens
       WHERE user_id = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    const token = tokenRes.rows[0];
    const supplied = Buffer.from(hashResetCode(code), 'hex');
    const matches = !!token && crypto.timingSafeEqual(supplied, Buffer.from(token.token_hash, 'hex'));
    const live = !!token && new Date(token.expires_at).getTime() > Date.now() && Number(token.failed_attempts) < RESET_MAX_ATTEMPTS;
    if (!matches || !live) {
      if (token && !matches) {
        // Count the wrong try; too many cancels the code.
        await dbClient.query(
          `UPDATE password_reset_tokens
           SET failed_attempts = failed_attempts + 1,
               used_at = CASE WHEN failed_attempts + 1 >= $2 THEN CURRENT_TIMESTAMP ELSE used_at END
           WHERE id = $1`,
          [token.id, RESET_MAX_ATTEMPTS]
        );
      }
      void recordSecurityEvent({ type: 'PASSWORD_RESET_FAILED', req, userId: user.id, status: 400, detail: !token ? 'no active code' : !matches ? 'wrong code' : 'expired code' });
      return refuse();
    }

    // Single use: only one request can claim the code.
    const claimed = await dbClient.query(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1 AND used_at IS NULL RETURNING id`,
      [token.id]
    );
    if (claimed.rows.length === 0) return refuse();

    await dbClient.query(
      `UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [hashPasswordServer(String(newPassword).trim()), user.id]
    );
    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, 'Password Reset Completed', 'Password reset with a one-time code', user.role, user.email]
    );
    void recordSecurityEvent({ type: 'PASSWORD_RESET_COMPLETED', severity: 'INFO', req, userId: user.id });
    return res.json({ message: 'Password updated. You can sign in with the new password.' });
  } catch (err: any) {
    console.error('[Password reset complete error]', err);
    return res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'Could not reset the password.') });
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
    // Explicit agreement is required before anything is stored (PDPA). A
    // person under 18 needs a parent's or guardian's agreement.
    if (!agreed(req.body.acceptedPrivacyNotice) || !agreed(req.body.acceptedTerms) || !agreed(req.body.ageOrGuardianConfirmed)) {
      return res.status(400).json({
        code: 'CONSENT_REQUIRED',
        error: 'Please confirm that you have read the Privacy Notice, agree to the Terms, and are 18 or older or have your parent\'s or guardian\'s agreement.',
      });
    }
    const studentPasswordCheck = validatePassword(password);
    if (!studentPasswordCheck.valid) {
      return res.status(400).json({ error: studentPasswordCheck.error });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Confirm the organization exists — students may not self-assign to a fabricated org.
    const orgRes = await dbClient.query(
      "SELECT id FROM organizations WHERE id = $1 AND status = 'ACTIVE'",
      [organizationId]
    );
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }

    const existing = await dbClient.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Validate classId belongs to this org if supplied, and use that class's
    // own monthly fee as the student's tuition (not the org's legacy base fee).
    const classRes = await dbClient.query(
      "SELECT id, monthly_fee FROM classes WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'",
      [classId, organizationId]
    );
    if (classRes.rowCount === 0) {
      return res.status(400).json({ error: 'The requested class is unavailable in this organization.' });
    }
    const baseFee = Number(classRes.rows[0].monthly_fee);

    const userId   = `usr_stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const studentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passHash = hashPasswordServer(password.trim());

    // 1. Create the user account with role=STUDENT, status=PENDING_VERIFICATION
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, organizationId, cleanEmail, passHash, fullName.trim(), phone?.trim() || null, UserRole.STUDENT, 'PENDING_VERIFICATION']
    );
    await recordConsents(userId, ['PRIVACY_NOTICE', 'TERMS', 'AGE_OR_GUARDIAN'], req);

    // 2. Create the student profile row (status PENDING until approved)
    await dbClient.query(
      `INSERT INTO students (id, organization_id, class_id, user_id, full_name, ic_number, phone, email,
                             belt_rank, monthly_fee, has_sibling_discount, billing_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [studentId, organizationId, classId || null, userId,
       fullName.trim(), icNumber?.trim() || '', phone?.trim() || null, cleanEmail,
       'White Belt', baseFee, false, 'Unpaid', 'PENDING']
    );

    // Create official enrollment application record if classId provided
    if (classId) {
      const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await dbClient.query(
        `INSERT INTO enrollment_applications (
           id, student_id, class_id, organization_id, submitted_by_user_id,
           applicant_type, student_name, ic_number, phone, consent_accepted, status, version, submitted_at
         ) VALUES ($1, $2, $3, $4, $5, 'STUDENT', $6, $7, $8, true, 'SUBMITTED', 1, CURRENT_TIMESTAMP)`,
        [appId, studentId, classId, organizationId, userId, fullName.trim(), icNumber?.trim() || null, phone?.trim() || null]
      );
    }

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email) VALUES ($1, $2, $3, $4, $5)`,
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Student Self-Registration', `Student ${fullName.trim()} registered — awaiting Master approval`, UserRole.STUDENT, cleanEmail]
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
    // Explicit agreement is required before anything is stored (PDPA), and a
    // child's data needs the parent's or guardian's consent.
    if (!agreed(req.body.acceptedPrivacyNotice) || !agreed(req.body.acceptedTerms) || !agreed(req.body.guardianConsent)) {
      return res.status(400).json({
        code: 'CONSENT_REQUIRED',
        error: 'Please confirm that you have read the Privacy Notice, agree to the Terms, and consent as the child\'s parent or guardian.',
      });
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
    let selectedClassFee: number | null = null;
    if (classId) {
      const selectedClass = await dbClient.query('SELECT id, monthly_fee FROM classes WHERE id = $1 AND organization_id = $2', [classId, targetOrgId]);
      if (!selectedClass.rowCount) return res.status(400).json({ error: 'Class must belong to this organization.' });
      selectedClassFee = parseFloat(selectedClass.rows[0].monthly_fee);
    }

    const parentId = `usr_parent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passHash = hashPasswordServer(password.trim());

    // Insert Parent User
    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, password_hash, full_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [parentId, targetOrgId, cleanEmail, passHash, parentFullName.trim(), phone?.trim() || null, UserRole.PARENT, 'ACTIVE']
    );
    await recordConsents(parentId, ['PRIVACY_NOTICE', 'TERMS', 'GUARDIAN'], req);

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
        [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Parent Link Request', `Parent ${parentFullName.trim()} requested link to existing student ${reqStudentId}`, UserRole.PARENT, cleanEmail]
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
      // Fix AUTH-REG-001: Creating a NEW child student creates a PROVISIONAL identity.
      // Master approval is strictly required before active enrollment or attendance eligibility.
      const newStudentId = `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const baseFee = selectedClassFee ?? 120.0;

      // Child record has class_id = NULL and status = 'PROVISIONAL'
      await dbClient.query(
        `INSERT INTO students (id, organization_id, class_id, full_name, ic_number, phone, email, belt_rank, monthly_fee, has_sibling_discount, billing_status, status)
         VALUES ($1, $2, NULL, $3, $4, $5, NULL, 'White Belt', $6, false, 'Unpaid', 'PROVISIONAL')`,
        [newStudentId, targetOrgId, childName.trim(), '', phone?.trim() || null, baseFee]
      );

      // ACTIVE link — parent registered their own child, establishing guardianship
      const linkId = `plink_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await dbClient.query(
        `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved, created_at)
         VALUES ($1, $2, $3, 'ACTIVE', true, true, true, CURRENT_TIMESTAMP)
         ON CONFLICT (parent_id, student_id) DO NOTHING`,
        [linkId, parentId, newStudentId]
      );

      // Create official enrollment application awaiting Master review
      let appId: string | null = null;
      if (classId) {
        appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await dbClient.query(
          `INSERT INTO enrollment_applications (
             id, student_id, class_id, organization_id, guardian_id, submitted_by_user_id,
             applicant_type, student_name, consent_accepted, status, version, submitted_at
           ) VALUES ($1, $2, $3, $4, $5, $5, 'PARENT', $6, true, 'SUBMITTED', 1, CURRENT_TIMESTAMP)`,
          [appId, newStudentId, classId, targetOrgId, parentId, childName.trim()]
        );
      }

      const token = generateAuthToken({ id: parentId, email: cleanEmail, role: UserRole.PARENT, organizationId: targetOrgId, assignedClassIds: [], linkedStudentIds: [newStudentId] });

      await dbClient.query(
        `INSERT INTO audit_logs (id, action, details, user_role, user_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Parent Registration', `Registered parent: ${parentFullName.trim()} with provisional child student ${newStudentId} (Application: ${appId || 'None'})`, UserRole.PARENT, cleanEmail]
      );

      return res.status(201).json({
        message: 'Parent and new child student successfully registered. Enrollment application submitted awaiting Master approval.',
        token,
        user: { id: parentId, fullName: parentFullName.trim(), email: cleanEmail, role: UserRole.PARENT, organizationId: targetOrgId, linkedStudentIds: [newStudentId] },
        parentId,
        studentId: newStudentId,
        applicationId: appId
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
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Parent Link Approved', `${user.role} approved link ${linkId}. New status: ${newStatus}`, user.role, user.email]
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
      [`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'Parent Link Rejected', `${user.role} rejected link ${linkId} (student ${link.student_id})`, user.role, user.email]
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
