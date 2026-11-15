/**
 * Production configuration check, in one place.
 *
 * Returns a list of problems (empty = fine). Outside production it returns
 * nothing: development and tests run with generated secrets and an embedded
 * database. Values are never included in the messages.
 *
 * index.ts refuses to start when this list is not empty, so a deployment
 * cannot go live with a missing or weak secret.
 */
const MIN_SECRET_LENGTH = 32;

export function validateProductionEnv(env: Record<string, string | undefined> = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  const has = (name: string) => typeof env[name] === 'string' && env[name]!.trim().length > 0;

  // Secrets: present, long enough, and not shared between purposes.
  const secrets = ['JWT_SECRET', 'MEDIA_STORAGE_SECRET', 'QR_ED25519_PRIVATE_KEY_SEED', 'QR_ED25519_PREVIOUS_SEED'];
  for (const name of secrets) {
    if (!has(name)) problems.push(`${name} is not set.`);
    else if (env[name]!.length < MIN_SECRET_LENGTH) problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  const seen = new Map<string, string>();
  for (const name of secrets) {
    if (!has(name)) continue;
    const other = seen.get(env[name]!);
    if (other) problems.push(`${name} has the same value as ${other}; every secret must be different.`);
    else seen.set(env[name]!, name);
  }
  if (has('BELTFLOW_WORKER_TOKEN') && env.BELTFLOW_WORKER_TOKEN!.length < 16) {
    problems.push('BELTFLOW_WORKER_TOKEN must be at least 16 characters.');
  }

  // Browser origins: required, explicit, HTTPS.
  if (!has('CORS_ALLOWED_ORIGINS')) {
    problems.push('CORS_ALLOWED_ORIGINS is not set.');
  } else {
    for (const origin of env.CORS_ALLOWED_ORIGINS!.split(',').map(o => o.trim()).filter(Boolean)) {
      if (origin === '*' || origin.includes('*')) problems.push('CORS_ALLOWED_ORIGINS must list exact origins, not a wildcard.');
      else if (!origin.startsWith('https://')) problems.push('CORS_ALLOWED_ORIGINS must only contain https:// origins.');
    }
  }

  // Database: a real server, with TLS.
  if (!has('DATABASE_URL')) problems.push('DATABASE_URL is not set (the embedded development database must not be used in production).');
  if ((env.DATABASE_SSL || '').toLowerCase() === 'disable') problems.push('DATABASE_SSL must not be "disable" in production.');

  // Switches that are only for development or testing.
  if (env.ALLOW_INSECURE_HTTP === 'true') problems.push('ALLOW_INSECURE_HTTP is on; HTTPS would not be enforced.');
  if (has('DEBUG')) problems.push('DEBUG is set; turn debug output off in production.');

  return problems;
}
