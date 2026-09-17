import { Request, Response, NextFunction } from 'express';
import { AuthUserContext, Permission, checkUserPermission } from '../security/rbac';
import { verifyAuthToken } from '../security/crypto';
import { dbClient } from '../db/client';

// Extend Express Request interface to carry authenticated user context
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserContext;
    }
  }
}

/**
 * Middleware: Verifies Bearer JWT Token in Authorization header.
 */
export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const claim = verifyAuthToken(token);
    const result = await dbClient.query(
      `SELECT u.id, u.email, u.role, u.organization_id, u.status, o.status AS organization_status
       FROM users u LEFT JOIN organizations o ON o.id = u.organization_id WHERE u.id = $1`,
      [claim.id]
    );
    const account = result.rows[0];
    if (!account || account.status !== 'ACTIVE' ||
        (account.organization_id && account.organization_status !== 'ACTIVE')) {
      return res.status(403).json({ error: 'Account or organization is not active.' });
    }
    const classes = account.role === 'MASTER'
      ? await dbClient.query('SELECT class_id FROM coach_class_assignments WHERE coach_id = $1', [account.id])
      : { rows: [] };
    const links = account.role === 'PARENT'
      ? await dbClient.query(
        `SELECT p.student_id FROM parent_student_links p JOIN students s ON s.id = p.student_id
         WHERE p.parent_id = $1 AND p.status = 'ACTIVE' AND p.student_approved = true
           AND p.master_approved = true AND p.admin_approved = true
           AND s.organization_id = $2`, [account.id, account.organization_id])
      : { rows: [] };
    req.user = {
      id: account.id, email: account.email, role: account.role,
      organizationId: account.organization_id || undefined,
      assignedClassIds: classes.rows.map(row => row.class_id),
      linkedStudentIds: links.rows.map(row => row.student_id)
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session token.' });
  }
}

/**
 * Middleware: Enforces that the user has the required permission for the target resource.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }

    const targetOrganizationId = (req.params.orgId || req.body.organizationId || req.query.organizationId) as string | undefined;
    const targetClassId = (req.params.classId || req.body.classId || req.query.classId) as string | undefined;
    const targetStudentId = (req.params.studentId || req.body.studentId || req.query.studentId) as string | undefined;
    const targetParentId = (req.params.parentId || req.body.parentId || req.query.parentId) as string | undefined;

    const isAuthorized = checkUserPermission({
      user,
      permission,
      targetOrganizationId,
      targetClassId,
      targetStudentId,
      targetParentId
    });

    if (!isAuthorized) {
      return res.status(403).json({
        error: `Access Denied: Missing required permission [${permission}] for target resource.`,
        details: {
          role: user.role,
          targetOrganizationId,
          targetClassId,
          targetStudentId
        }
      });
    }

    next();
  };
}
