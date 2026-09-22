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
  const allowed = (user.role === UserRole.ADMIN_PERSATUAN) ||
    (user.role === UserRole.MASTER && !!student.class_id && !!user.assignedClassIds?.includes(student.class_id)) ||
    (user.role === UserRole.STUDENT && student.user_id === user.id) ||
    (user.role === UserRole.PARENT && !!user.linkedStudentIds?.includes(student.id));
  return { allowed, student };
}

export async function classAccess(user: AuthUserContext, classId: string): Promise<boolean> {
  const result = await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [classId]);
  const row = result.rows[0];
  return !!row && !!user.organizationId && row.organization_id === user.organizationId &&
    (user.role === UserRole.ADMIN_PERSATUAN ||
      (user.role === UserRole.MASTER && !!user.assignedClassIds?.includes(classId)));
}

// Strictly the Master currently assigned to this class/location — never the
// Persatuan Admin. Use this (not classAccess) for every write operation the
// Persatuan is explicitly not allowed to perform: groups, schedules,
// sessions, attendance, notices, fees, dues, and payments. `assignedClassIds`
// is re-derived fresh from coach_class_assignments on every authenticated
// request (see middleware/auth.ts), so a Master whose assignment was just
// revoked loses this access on their very next request — no stale token
// can grant continued access.
export async function assignedMasterAccess(user: AuthUserContext, classId: string): Promise<boolean> {
  const result = await dbClient.query('SELECT organization_id FROM classes WHERE id = $1', [classId]);
  const row = result.rows[0];
  return !!row && !!user.organizationId && row.organization_id === user.organizationId &&
    user.role === UserRole.MASTER && !!user.assignedClassIds?.includes(classId);
}
