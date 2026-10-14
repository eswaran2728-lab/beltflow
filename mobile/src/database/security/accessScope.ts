import { AuthUser } from '../../types/auth';

/**
 * Base Security Error for local storage access violations
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

export class SessionRequiredError extends SecurityError {
  constructor(message = 'Active authenticated session is required to access protected local data.') {
    super(message);
    this.name = 'SessionRequiredError';
    Object.setPrototypeOf(this, SessionRequiredError.prototype);
  }
}

export class TenantMismatchError extends SecurityError {
  constructor(message = 'Access denied: Target record belongs to a different Persatuan/Organization.') {
    super(message);
    this.name = 'TenantMismatchError';
    Object.setPrototypeOf(this, TenantMismatchError.prototype);
  }
}

export class UnauthorizedClassError extends SecurityError {
  constructor(message = 'Access denied: You are not assigned to this training class.') {
    super(message);
    this.name = 'UnauthorizedClassError';
    Object.setPrototypeOf(this, UnauthorizedClassError.prototype);
  }
}

/**
 * Validates that an active, approved identity is present before allowing repository access.
 */
export function assertAuthenticated(user: AuthUser | null | undefined): asserts user is AuthUser & { organizationId: string } {
  if (!user || !user.id || !user.organizationId) {
    throw new SessionRequiredError();
  }
}

/**
 * Validates that the requested operation belongs to the user's assigned Persatuan.
 */
export function assertTenantAccess(
  user: AuthUser | null | undefined,
  targetOrganizationId: string
): asserts user is AuthUser & { organizationId: string } {
  assertAuthenticated(user);

  if (user.role === 'SUPER_ADMIN') {
    // Super Admin does not operate academy-level offline check-in rosters
    throw new SecurityError('Super Admin accounts do not access academy operational check-in data.');
  }

  if (!targetOrganizationId || user.organizationId !== targetOrganizationId) {
    throw new TenantMismatchError(
      `Cross-tenant access rejected: user (${user.organizationId}) attempted operation on (${targetOrganizationId}).`
    );
  }
}

/**
 * Validates that a Master is authorized for the target class.
 * Admins are permitted to view all classes within their organization.
 */
export function assertClassAccess(
  user: AuthUser | null | undefined,
  targetOrganizationId: string,
  targetClassId: string
): asserts user is AuthUser & { organizationId: string } {
  assertTenantAccess(user, targetOrganizationId);

  if (user.role === 'MASTER') {
    const assigned = user.assignedClassIds || [];
    if (!targetClassId || !assigned.includes(targetClassId)) {
      throw new UnauthorizedClassError(
        `Master ${user.id} is not assigned to class ${targetClassId}.`
      );
    }
  }
}
