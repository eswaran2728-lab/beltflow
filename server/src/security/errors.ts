/**
 * In production, raw driver/exception messages (SQL fragments, column
 * names, file paths) must never reach API clients. In development/test
 * they're kept as-is because they're the primary debugging signal and
 * nothing production-sensitive is at stake.
 */
export function safeErrorMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV === 'production') {
    return fallback;
  }
  return err instanceof Error ? err.message : String(err);
}
