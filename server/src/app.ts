import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { dbClient } from './db/client';
import { safeErrorMessage } from './security/errors';
import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organizations.routes';
import classRoutes from './routes/classes.routes';
import studentRoutes from './routes/students.routes';
import attendanceRoutes from './routes/attendance.routes';
import billingRoutes from './routes/billing.routes';
import gradingRoutes from './routes/grading.routes';
import certificateRoutes from './routes/certificates.routes';
import auditRoutes from './routes/audit.routes';
import coachesRoutes from './routes/coaches.routes';
import tournamentsRoutes from './routes/tournaments.routes';
import skillsRoutes from './routes/skills.routes';

const app = express();

// Middleware
//
// Native Android clients don't send a browser Origin header, so restricting
// CORS never blocks them - this only affects browser-based (web) callers.
//
// In production, CORS_ALLOWED_ORIGINS is REQUIRED and startup fails closed
// if it's missing - silently reflecting any browser origin in production
// is a real cross-origin exposure, not a convenience worth keeping. In
// dev/test, it's optional and falls back to permissive (unset = reflect
// any origin), which is fine for a local/CI environment.
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : null;

if (!allowedOrigins && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL SECURITY ERROR: CORS_ALLOWED_ORIGINS environment variable is not defined. ' +
    'Refusing to start in production with unrestricted cross-origin access.'
  );
}

app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json());

// Security headers.
//
// Hand-written rather than pulling in a new dependency (helmet) for a
// handful of static header values - BeltFlow's static assets are its own
// PWA (self-hosted, not framing/being framed by third parties), so a
// permissive CSP that only restricts cross-site framing/sniffing is safe
// without risking breaking the app; a strict script-src CSP is not added
// here because the PWA loads inline scripts and an external font/icon CDN
// (see index.html) and has not been audited/tested against a strict policy.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    // Only meaningful when actually served over HTTPS (production
    // deployments sit behind a TLS-terminating reverse proxy/CDN).
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

// Serve Static Web Client Assets
//
// webRoot is the repository root (this backend also hosts the PWA), which
// also contains files that must never be reachable over HTTP even when
// gitignored - a signing keystore, build artifacts, local SDK config, etc.
// express.static already denies dotfiles by default; this blocks the
// remaining sensitive extensions/paths before they reach the static handler.
const webRoot = path.resolve(__dirname, '../../');
const BLOCKED_STATIC_PATTERN = /\.(keystore|jks|p12|pem|key|base64|apk|aab|properties|env|kts|gradle)$|^\/(package(-lock)?\.json)$|(^|\/)(node_modules|\.git|\.gradle|\.kotlin|server|scratch)(\/|$)/i;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (BLOCKED_STATIC_PATTERN.test(req.path)) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(webRoot));

// Liveness: process is up and serving HTTP. Deliberately does not touch
// the database, so an orchestrator can use it to decide whether to
// restart the container - restarting won't help a database outage.
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'BeltFlow SaaS Backend API', timestamp: new Date().toISOString() });
});

// Readiness: process is up AND can actually reach the database. An
// orchestrator/load balancer should use this to decide whether to route
// traffic here - a live-but-not-ready instance (e.g. DB temporarily
// unreachable) should be taken out of rotation, not restarted. Never
// exposes the underlying error, credentials, or connection string.
app.get('/api/health/ready', async (req: Request, res: Response) => {
  try {
    await dbClient.query('SELECT 1');
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Readiness check failed]', err);
    res.status(503).json({ status: 'not_ready', timestamp: new Date().toISOString() });
  }
});

// Route Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/grading', gradingRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/coaches', coachesRoutes);
app.use('/api/v1/tournaments', tournamentsRoutes);
app.use('/api/v1/skills', skillsRoutes);

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', err);
  res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'An internal error occurred.') });
});

export default app;
