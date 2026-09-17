import { Request, Response, NextFunction } from 'express';

/**
 * Minimal in-memory sliding-window rate limiter for sensitive,
 * often-unauthenticated endpoints (login, setup, registration).
 *
 * This is per-process, in-memory state: it protects a single instance
 * from brute-force/credential-stuffing bursts, but does NOT coordinate
 * across multiple instances behind a load balancer. A multi-instance
 * production deployment should also apply an infrastructure-level
 * limiter (reverse proxy / API gateway / WAF) in front of this - this
 * middleware is defense-in-depth, not a substitute for that.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      return res.status(429).json({ error: options.message || 'Too many requests. Please try again later.' });
    }
    next();
  };
}
