/**
 * BeltFlow RBAC (Role-Based Access Control) Matrix & Policy Engine
 * Approved Roles: SUPER_ADMIN, ADMIN_PERSATUAN, MASTER, STUDENT, PARENT
 * Note: Main Master is a class assignment, not a distinct role.
 * Super Admin is strictly denied access to academy operational records.
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_PERSATUAN = 'ADMIN_PERSATUAN',
  MASTER = 'MASTER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT'
}

export enum Permission {
  // Super Admin Platform Permissions
  SUPER_ADMIN_MANAGE = 'SUPER_ADMIN_MANAGE',
  ORGANIZATION_CREATE = 'ORGANIZATION_CREATE',
  ORGANIZATION_DELETE = 'ORGANIZATION_DELETE',
  ORGANIZATION_VIEW_ALL = 'ORGANIZATION_VIEW_ALL',
  AUDIT_LOG_VIEW_GLOBAL = 'AUDIT_LOG_VIEW_GLOBAL',

  // Academy Administration (ADMIN_PERSATUAN)
  PERSATUAN_EDIT_PROFILE = 'PERSATUAN_EDIT_PROFILE',
  PERSATUAN_MANAGE_BELTS = 'PERSATUAN_MANAGE_BELTS',
  PERSATUAN_MANAGE_BRANCHES = 'PERSATUAN_MANAGE_BRANCHES',
  PERSATUAN_MANAGE_CLASSES = 'PERSATUAN_MANAGE_CLASSES',
  PERSATUAN_MANAGE_COACHES = 'PERSATUAN_MANAGE_COACHES',
  PERSATUAN_MANAGE_STUDENTS = 'PERSATUAN_MANAGE_STUDENTS',
  PERSATUAN_MANAGE_CURRICULUM = 'PERSATUAN_MANAGE_CURRICULUM',
  PERSATUAN_MANAGE_TOURNAMENTS = 'PERSATUAN_MANAGE_TOURNAMENTS',
  PERSATUAN_MANAGE_GRADING_EVENTS = 'PERSATUAN_MANAGE_GRADING_EVENTS',
  PERSATUAN_VIEW_ROSTER = 'PERSATUAN_VIEW_ROSTER',
  PERSATUAN_VIEW_FINANCES = 'PERSATUAN_VIEW_FINANCES',

  // Mat & Class Operations (ADMIN_PERSATUAN & assigned MASTER)
  CLASS_VIEW = 'CLASS_VIEW',
  CLASS_ASSIGN_COACH = 'CLASS_ASSIGN_COACH',
  CLASS_MARK_ATTENDANCE = 'CLASS_MARK_ATTENDANCE',
  CLASS_VIEW_ATTENDANCE = 'CLASS_VIEW_ATTENDANCE',
  CLASS_MANAGE_SKILL_PROGRESS = 'CLASS_MANAGE_SKILL_PROGRESS',
  CLASS_SCORE_GRADING = 'CLASS_SCORE_GRADING',
  CLASS_SCORE_TOURNAMENT = 'CLASS_SCORE_TOURNAMENT',
  CLASS_MANAGE_FEES = 'CLASS_MANAGE_FEES',
  CLASS_APPROVE_PAYMENT = 'CLASS_APPROVE_PAYMENT',
  CLASS_RECORD_CASH_PAYMENT = 'CLASS_RECORD_CASH_PAYMENT',
  CLASS_APPROVE_STUDENT_REGISTRATION = 'CLASS_APPROVE_STUDENT_REGISTRATION',
  CLASS_REQUEST_JOIN_APPROVE = 'CLASS_REQUEST_JOIN_APPROVE',
  CLASS_TRANSFER_APPROVE = 'CLASS_TRANSFER_APPROVE',
  CLASS_REQUEST_LINK_PARENT_APPROVE = 'CLASS_REQUEST_LINK_PARENT_APPROVE',
  CLASS_REGISTER_GRADING = 'CLASS_REGISTER_GRADING',

  // Parent Operations
  PARENT_VIEW_CHILD = 'PARENT_VIEW_CHILD',
  PARENT_PAY_FEES = 'PARENT_PAY_FEES',
  PARENT_REGISTER_CHILD_GRADING = 'PARENT_REGISTER_CHILD_GRADING',
  PARENT_LINK_CHILD = 'PARENT_LINK_CHILD',

  // Student Operations
  STUDENT_VIEW_SELF = 'STUDENT_VIEW_SELF',
  STUDENT_PAY_FEES = 'STUDENT_PAY_FEES',
  STUDENT_REGISTER_GRADING = 'STUDENT_REGISTER_GRADING',

  // Certificate Operations
  CERTIFICATE_CREATE = 'CERTIFICATE_CREATE',
  CERTIFICATE_REVOKE = 'CERTIFICATE_REVOKE',
  CERTIFICATE_DELETE = 'CERTIFICATE_DELETE',
  CERTIFICATE_VIEW = 'CERTIFICATE_VIEW'
}

export interface AuthUserContext {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  assignedClassIds?: string[];
  linkedStudentIds?: string[];
}

export interface PermissionCheckParams {
  user: AuthUserContext | null;
  permission: Permission;
  targetOrganizationId?: string;
  targetClassId?: string;
  targetStudentId?: string;
  targetParentId?: string;
}

/**
 * Validates permission against user role and resource ownership context.
 */
export function checkUserPermission(params: PermissionCheckParams): boolean {
  const { user, permission, targetOrganizationId, targetClassId, targetStudentId, targetParentId } = params;
  if (!user) return false;

  // 1. SUPER_ADMIN: Global management of tenants and audit logs ONLY.
  // Super Admin is STRICTLY DENIED access to operational academy records.
  if (user.role === UserRole.SUPER_ADMIN) {
    const superAdminAllowed = [
      Permission.SUPER_ADMIN_MANAGE,
      Permission.ORGANIZATION_CREATE,
      Permission.ORGANIZATION_DELETE,
      Permission.ORGANIZATION_VIEW_ALL,
      Permission.AUDIT_LOG_VIEW_GLOBAL
    ];
    return superAdminAllowed.includes(permission);
  }

  // 2. Tenant isolation: Non-super admin cannot access other organization resources
  if (targetOrganizationId && targetOrganizationId !== user.organizationId) {
    return false;
  }

  // 3. ADMIN_PERSATUAN permissions (Full access within own tenant)
  if (user.role === UserRole.ADMIN_PERSATUAN) {
    switch (permission) {
      case Permission.PERSATUAN_EDIT_PROFILE:
      case Permission.PERSATUAN_MANAGE_BELTS:
      case Permission.PERSATUAN_MANAGE_BRANCHES:
      case Permission.PERSATUAN_MANAGE_CLASSES:
      case Permission.PERSATUAN_MANAGE_COACHES:
      case Permission.PERSATUAN_MANAGE_STUDENTS:
      case Permission.PERSATUAN_MANAGE_CURRICULUM:
      case Permission.PERSATUAN_MANAGE_TOURNAMENTS:
      case Permission.PERSATUAN_MANAGE_GRADING_EVENTS:
      case Permission.PERSATUAN_VIEW_ROSTER:
      case Permission.PERSATUAN_VIEW_FINANCES:
      case Permission.CLASS_VIEW:
      case Permission.CLASS_ASSIGN_COACH:
      case Permission.CLASS_MARK_ATTENDANCE:
      case Permission.CLASS_VIEW_ATTENDANCE:
      case Permission.CLASS_MANAGE_SKILL_PROGRESS:
      case Permission.CLASS_SCORE_GRADING:
      case Permission.CLASS_SCORE_TOURNAMENT:
      case Permission.CLASS_MANAGE_FEES:
      case Permission.CLASS_APPROVE_PAYMENT:
      case Permission.CLASS_RECORD_CASH_PAYMENT:
      case Permission.CLASS_APPROVE_STUDENT_REGISTRATION:
      case Permission.CLASS_REQUEST_JOIN_APPROVE:
      case Permission.CLASS_TRANSFER_APPROVE:
      case Permission.CLASS_REQUEST_LINK_PARENT_APPROVE:
      case Permission.CLASS_REGISTER_GRADING:
      case Permission.CERTIFICATE_CREATE:
      case Permission.CERTIFICATE_REVOKE:
      case Permission.CERTIFICATE_DELETE:
      case Permission.CERTIFICATE_VIEW:
        return true;
      default:
        return false;
    }
  }

  // 4. MASTER / INSTRUCTOR permissions (Scoped to assigned classes and students)
  if (user.role === UserRole.MASTER) {
    // If a target class is specified, master must be assigned to it
    if (targetClassId && !user.assignedClassIds?.includes(targetClassId)) {
      return false;
    }

    switch (permission) {
      case Permission.CLASS_VIEW:
      case Permission.CLASS_MARK_ATTENDANCE:
      case Permission.CLASS_VIEW_ATTENDANCE:
      case Permission.CLASS_MANAGE_SKILL_PROGRESS:
      case Permission.CLASS_SCORE_GRADING:
      case Permission.CLASS_SCORE_TOURNAMENT:
      case Permission.CLASS_APPROVE_PAYMENT:
      case Permission.CLASS_RECORD_CASH_PAYMENT:
      case Permission.CERTIFICATE_VIEW:
        return true;
      default:
        return false;
    }
  }

  // 5. PARENT permissions (Scoped strictly to linked children)
  if (user.role === UserRole.PARENT) {
    if (targetStudentId && !user.linkedStudentIds?.includes(targetStudentId)) {
      return false;
    }

    switch (permission) {
      case Permission.PARENT_VIEW_CHILD:
      case Permission.PARENT_PAY_FEES:
      case Permission.PARENT_REGISTER_CHILD_GRADING:
      case Permission.PARENT_LINK_CHILD:
      case Permission.CERTIFICATE_VIEW:
        return true;
      default:
        return false;
    }
  }

  // 6. STUDENT permissions (Scoped strictly to self)
  if (user.role === UserRole.STUDENT) {
    if (targetStudentId && targetStudentId !== user.id) {
      return false;
    }

    switch (permission) {
      case Permission.STUDENT_VIEW_SELF:
      case Permission.STUDENT_PAY_FEES:
      case Permission.STUDENT_REGISTER_GRADING:
      case Permission.CERTIFICATE_VIEW:
        return true;
      default:
        return false;
    }
  }

  return false;
}
