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
import noticesRoutes from './routes/notices.routes';
import notificationsRoutes from './routes/notifications.routes';
import masterApplicationsRoutes from './routes/masterApplications.routes';
import classApplicationsRoutes from './routes/classApplications.routes';
import enrollmentApplicationsRoutes from './routes/enrollmentApplications.routes';
import dashboardRoutes from './routes/dashboard.routes';
import handoverRoutes from './routes/handover.routes';
import curriculumRoutes from './routes/curriculum.routes';
import { paymentGatewayRouter } from './routes/paymentGateway.routes';
import onboardingImportsRoutes from './routes/onboardingImports.routes';
import trialsRoutes from './routes/trials.routes';
import bookingsRoutes from './routes/bookings.routes';
import transfersRoutes from './routes/transfers.routes';
import teachingRoutes from './routes/teaching.routes';
import familyRoutes from './routes/family.routes';
import learningRoutes from './routes/learning.routes';
import mediaFeedbackRoutes from './routes/media_feedback.routes';
import messagingRoutes from './routes/messaging.routes';
import analyticsRoutes from './routes/analytics.routes';
import commerceRoutes from './routes/commerce.routes';
import assistantRoutes from './routes/assistant.routes';
import { moduleGate } from './release/modules';
import releaseRoutes from './routes/release.routes';
import securityRoutes from './routes/security.routes';
import privacyRoutes from './routes/privacy.routes';
import { httpsOnly } from './middleware/httpsOnly';
import { securityAudit } from './middleware/securityAudit';
import { rateLimit } from './middleware/rateLimit';

const app = express();
// Do not advertise the framework.
app.disable('x-powered-by');
// Client IP for rate limits: only trust X-Forwarded-For from the given number
// of reverse-proxy hops (TRUST_PROXY_HOPS). Unset = use the socket address.
{
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : false);
}

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

// HTTPS only in production, before anything reads the request.
app.use(httpsOnly);
// Record refused requests (401/403/429) in the security event log.
app.use(securityAudit);

app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
// Whole-API flood protection, per client address. Sensitive endpoints
// (sign-in, registration, password reset) have their own, stricter limits.
app.use('/api/', rateLimit({
  windowMs: 60_000,
  max: Math.max(60, Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 600),
  perPath: false,
  name: 'api',
}));
app.use(express.json({ limit: '200kb' }));

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
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (req.path.startsWith('/api/')) {
    // API responses are data, never a page: nothing may run or be framed,
    // and private data must not be kept by a browser or shared cache.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
  }
  if (process.env.NODE_ENV === 'production') {
    // Only meaningful when actually served over HTTPS (production
    // deployments sit behind a TLS-terminating reverse proxy/CDN).
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

// Serve the web client (PWA).
//
// The web root is the repository root, which also holds the server and
// mobile source, documentation, CI files, build scripts and screenshots.
// None of that is served: only the files the web client itself needs are,
// by an explicit allow-list. Anything else is a 404.
const webRoot = path.resolve(__dirname, '../../');
const WEB_FILES = new Set(['/index.html', '/manifest.json', '/sw.js', '/support.js', '/.well-known/assetlinks.json']);
const WEB_DIRS = ['/assets/', '/legal/'];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let requested: string;
  try {
    requested = decodeURIComponent(req.path);
  } catch {
    return res.status(404).end();
  }
  if (requested === '/') requested = '/index.html';
  const allowed = !requested.includes('..') && !requested.includes('\\') &&
    (WEB_FILES.has(requested) || WEB_DIRS.some(dir => requested.startsWith(dir)));
  if (!allowed) return res.status(404).end();
  return res.sendFile(requested.slice(1), { root: webRoot, dotfiles: 'allow' }, err => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

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

// H27: enabled release modules (public; per Persatuan for a signed-in caller)
// and Super Admin per-Persatuan rollout settings.
app.use('/api/v1/release', releaseRoutes);

// Route Mounting
// Optional R2-R4 modules sit behind moduleGate() (see release/modules.ts);
// everything else is core R1 and always on.
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/privacy', privacyRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/grading', gradingRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/coaches', coachesRoutes);
app.use('/api/v1/tournaments', moduleGate('tournaments'), tournamentsRoutes);
app.use('/api/v1/skills', skillsRoutes);
app.use('/api/v1/notices', noticesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/master-applications', masterApplicationsRoutes);
app.use('/api/v1/class-applications', classApplicationsRoutes);
app.use('/api/v1/enrollment-applications', enrollmentApplicationsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/persatuans', organizationRoutes);
app.use('/api/v1/curriculums', curriculumRoutes);
app.use('/api/v1/payments', paymentGatewayRouter);
app.use('/api/v1', handoverRoutes);
app.use('/api/v1/onboarding-imports', onboardingImportsRoutes);
app.use('/api/v1', onboardingImportsRoutes);
app.use('/api/v1/trials', moduleGate('trials'), trialsRoutes);
app.use('/api/v1/bookings', moduleGate('bookings'), bookingsRoutes);
app.use('/api/v1/transfers', moduleGate('transfers'), transfersRoutes);
app.use('/api/v1/memberships', moduleGate('transfers'), transfersRoutes);
app.use('/api/v1/teaching', moduleGate('teaching'), teachingRoutes);
app.use('/api/v1/family', moduleGate('family'), familyRoutes);
app.use('/api/v1/learning', moduleGate('learning'), learningRoutes);
app.use('/api/v1/media', moduleGate('media'), mediaFeedbackRoutes);
app.use('/api/v1/messaging', moduleGate('messaging'), messagingRoutes);
app.use('/api/v1/analytics', moduleGate('analytics'), analyticsRoutes);
app.use('/api/v1/commerce', moduleGate('commerce'), commerceRoutes);
app.use('/api/v1/assistant', moduleGate('assistant'), assistantRoutes);

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Bad requests are the caller's fault, not a server error.
  const type = (err as any)?.type;
  if (type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  if (type === 'entity.parse.failed' || type === 'encoding.unsupported' || type === 'charset.unsupported') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  console.error('[API Error]:', err);
  res.status(500).json({ error: 'Internal server error', message: safeErrorMessage(err, 'An internal error occurred.') });
});

export default app;
