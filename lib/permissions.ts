import { AuthUser } from './auth';

export function canViewAllStudents(user: AuthUser): boolean {
  return user.role === 'admin';
}

export function canAccessStudent(user: AuthUser, studentId: string): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'coach') return true; // coach sees students in their classes
  if (user.role === 'parent') return user.childStudentIds?.includes(studentId) ?? false;
  if (user.role === 'student') return user.studentId === studentId;
  return false;
}

export function canAccessClass(user: AuthUser, classId: string): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'coach') return user.assignedClassIds?.includes(classId) ?? false;
  return false;
}

export function canApproveCashPayment(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'coach';
}

export function canViewDaerahIncome(user: AuthUser): boolean {
  return user.role === 'admin';
}

export function canManageSettings(user: AuthUser): boolean {
  return user.role === 'admin';
}

export function canViewAllMessages(user: AuthUser): boolean {
  return user.role === 'admin';
}

export function canManageSubscription(user: AuthUser): boolean {
  return user.role === 'admin';
}

export function requireAuth(user: AuthUser | null): boolean {
  return !!user;
}

export function requireRole(user: AuthUser | null, role: AuthUser['role']): boolean {
  return user?.role === role;
}
