/**
 * BeltFlow Mobile Authentication & User Types
 * Directly reflects the server-side RBAC schema and /api/v1/auth endpoints.
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_PERSATUAN = 'ADMIN_PERSATUAN',
  MASTER = 'MASTER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
}

export type RoleType = 'SUPER_ADMIN' | 'ADMIN_PERSATUAN' | 'MASTER' | 'PARENT' | 'STUDENT';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleType;
  organizationId?: string | null;
  assignedClassIds?: string[];
  linkedStudentIds?: string[];
  affiliationStatus?: string;
  phone?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ApiErrorDetails {
  status: number;
  message: string;
  details?: unknown;
  isNetworkError: boolean;
  isTimeout: boolean;
  isUnauthorized: boolean;
}
