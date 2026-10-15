import { AuthUserContext, UserRole } from './rbac';
import { dbClient } from '../db/client';

export async function studentAccess(user: AuthUserContext, studentId: string): Promise<{ allowed: boolean; student: any | null }> {
  const result = await dbClient.query(
    'SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = $1',
    [studentId]);
  const student = result.rows[0] || null;
  if (!student || !user.organizationId || student.organization_id !== user.organizationId) {
    return { allowed: false, student };
  }
  if (user.role === UserRole.SUPER_ADMIN) {
    return { allowed: false, student };
  }
  const allowed = (user.role === UserRole.ADMIN_PERSATUAN) ||
    (user.role === UserRole.MASTER && !!student.class_id && !!user.assignedClassIds?.includes(student.class_id)) ||
    (user.role === UserRole.STUDENT && student.user_id === user.id) ||
    (user.role === UserRole.PARENT && !!user.linkedStudentIds?.includes(student.id));
  return { allowed, student };
}

export async function classAccess(user: AuthUserContext, classId: string): Promise<boolean> {
  const result = await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [classId]);
  const row = result.rows[0];
  if (!row || !user.organizationId || row.organization_id !== user.organizationId) {
    return false;
  }
  if (user.role === UserRole.ADMIN_PERSATUAN) {
    return true;
  }
  if (user.role === UserRole.MASTER) {
    // Check active class leadership
    const leadRes = await dbClient.query(
      `SELECT 1 FROM class_leaderships cl
       LEFT JOIN master_affiliations ma ON ma.master_id = cl.master_id AND ma.organization_id = cl.organization_id
       WHERE cl.class_id = $1 AND cl.master_id = $2 AND cl.is_active = TRUE
         AND (ma.status IS NULL OR ma.status = 'ACTIVE')`,
      [classId, user.id]
    );
    if (leadRes.rowCount > 0) return true;
    return !!user.assignedClassIds?.includes(classId);
  }
  return false;
}

// Strictly the Master currently holding active leadership for this class — never the
// Persatuan Admin. Re-checked dynamically with active verified affiliation.
export async function assignedMasterAccess(user: AuthUserContext, classId: string): Promise<boolean> {
  const result = await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [classId]);
  const row = result.rows[0];
  if (!row || !user.organizationId || row.organization_id !== user.organizationId) {
    return false;
  }
  if (user.role !== UserRole.MASTER) {
    return false;
  }

  // Check if Master has been suspended/ended in master_affiliations
  const statusCheck = await dbClient.query(
    `SELECT status FROM master_affiliations WHERE master_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [user.id, user.organizationId]
  );
  if (statusCheck.rowCount > 0 && statusCheck.rows[0].status !== 'ACTIVE') {
    return false; // Suspended or ended masters strictly lose operational access
  }

  // Check active verified leadership in class_leaderships
  const leadRes = await dbClient.query(
    `SELECT 1 FROM class_leaderships cl
     WHERE cl.class_id = $1 AND cl.master_id = $2 AND cl.is_active = TRUE`,
    [classId, user.id]
  );
  if (leadRes.rowCount > 0) {
    return true;
  }

  // Legacy transition fallback to assignedClassIds
  return !!user.assignedClassIds?.includes(classId);
}
