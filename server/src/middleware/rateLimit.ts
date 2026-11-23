import { Request, Response, NextFunction } from 'express';

/**
 * In-memory sliding-window rate limiter.
 *
 * Used for sensitive endpoints (sign-in, registration, password reset) and,
 * with a generous limit, for the whole API.
 *
 * This is per-process state: it protects one instance from brute-force and
 * flooding, but does not coordinate across several instances behind a load
 * balancer. A multi-instance deployment should also rate-limit at the
 * reverse proxy / gateway; this middleware is defence in depth.
 *
 * Memory is bounded: expired entries are dropped, and the table never holds
 * more than MAX_ENTRIES clients.
 */
const MAX_ENTRIES = 10_000;

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  /** Count per client and path (default) or per client across all paths. */
  perPath?: boolean;
  /** Label used in logs. */
  name?: string;
}

export type RateLimiter = ((req: Request, res: Response, next: NextFunction) => void) & { size(): number };

export function rateLimit(options: RateLimitOptions): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const perPath = options.perPath !== false;

  const prune = (now: number) => {
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    // Still too many live entries: drop the oldest (Map keeps insertion order).
    if (hits.size >= MAX_ENTRIES) {
      let remove = hits.size - MAX_ENTRIES + Math.floor(MAX_ENTRIES / 10);
      for (const k of hits.keys()) {
        if (remove-- <= 0) break;
        hits.delete(k);
      }
    }
  };

  const limiter = ((req: Request, res: Response, next: NextFunction) => {
    const key = perPath ? `${req.ip}:${req.path}` : String(req.ip);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      if (hits.size >= MAX_ENTRIES) prune(now);
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ error: options.message || 'Too many requests. Please try again later.' });
    }
    next();
  }) as RateLimiter;
  limiter.size = () => hits.size;
  return limiter;
}
