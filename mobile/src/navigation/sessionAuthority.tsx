import React, { createContext, useContext } from 'react';
import { AuthUser, RoleType, UserRole } from '../types/auth';

/**
 * How the current authenticated identity was established.
 *
 * - 'verified_online': confirmed by GET /api/v1/auth/me during this app session
 *   (or returned by a fresh /api/v1/auth/login).
 * - 'cached_offline': restored from secure storage while the server was unreachable.
 * - 'unverified': restored from storage, server reachable but verification failed
 *   for a non-auth reason (e.g. 5xx).
 */
export type SessionVerification = 'verified_online' | 'cached_offline' | 'unverified';

export interface SessionAuthority {
  verification: SessionVerification;
  isVerifiedOnline: boolean;
  isOffline: boolean;
}

const KNOWN_ROLES: ReadonlySet<string> = new Set<string>(Object.values(UserRole));

/**
 * Resolves a role coming from the backend into a known RoleType.
 * Returns null for anything unrecognised (wrong case, unknown value, missing).
 * Never coerces or "best-guesses" a role.
 */
export function resolveVerifiedRole(user: Pick<AuthUser, 'role'> | null | undefined): RoleType | null {
  const role = user?.role as unknown;
  if (typeof role !== 'string') return null;
  return KNOWN_ROLES.has(role) ? (role as RoleType) : null;
}

/**
 * Sensitive online operations (fee edits, grading submissions, approvals,
 * account changes, etc.) require a server-verified session AND connectivity.
 *
 * A locally cached identity is never sufficient. This is a UX safeguard only —
 * the backend must still authorize every request.
 */
export function canPerformSensitiveOnlineOperation(authority: SessionAuthority | null | undefined): boolean {
  if (!authority) return false;
  return authority.verification === 'verified_online' && authority.isVerifiedOnline && !authority.isOffline;
}

export const UNVERIFIED_SESSION_AUTHORITY: SessionAuthority = {
  verification: 'unverified',
  isVerifiedOnline: false,
  isOffline: false,
};

const SessionAuthorityContext = createContext<SessionAuthority>(UNVERIFIED_SESSION_AUTHORITY);

export const SessionAuthorityProvider: React.FC<{
  value: SessionAuthority;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <SessionAuthorityContext.Provider value={value}>{children}</SessionAuthorityContext.Provider>
);

/**
 * Defaults to an UNVERIFIED authority when no provider is mounted, so screens
 * rendered outside AppNavigator fail closed.
 */
export function useSessionAuthority(): SessionAuthority {
  return useContext(SessionAuthorityContext);
}
