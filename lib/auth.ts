export type UserRole = 'admin' | 'coach' | 'parent' | 'student';
export type Language = 'en' | 'ms' | 'ta';

export interface AuthUser {
  id: string;           // profiles.id
  authUserId: string;   // auth.users.id
  academyId: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  preferredLanguage: Language;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  coach: 'Coach / Master',
  parent: 'Parent',
  student: 'Student',
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/dashboard',
  coach: '/dashboard/coach',
  parent: '/dashboard/parent',
  student: '/dashboard/student',
};
