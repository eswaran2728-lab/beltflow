/**
 * Single source of truth for password strength requirements. Any endpoint
 * that accepts a new or changed password should call validatePassword()
 * rather than inlining its own length check, so the rule can't silently
 * drift between endpoints (setup-admin previously had no length check at
 * all while change-password enforced a different one).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return { valid: false, error: 'Password is required.' };
  }
  const trimmed = password.trim();
  if (trimmed.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (trimmed.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  return { valid: true };
}
