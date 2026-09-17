import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
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
// If CORS_ALLOWED_ORIGINS isn't set, we fall back to reflecting the request
// origin (previous behavior) rather than breaking an unconfigured deployment,
// but that fallback is intentionally logged so it's visible in production.
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : null;

if (!allowedOrigins && process.env.NODE_ENV === 'production') {
  console.warn('[SECURITY] CORS_ALLOWED_ORIGINS is not set in production - allowing all browser origins.');
}

app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json());

// Serve Static Web Client Assets
//
// webRoot is the repository root (this backend also hosts the PWA), which
// also contains files that must never be reachable over HTTP even when
// gitignored - a signing keystore, build artifacts, local SDK config, etc.
// express.static already denies dotfiles by default; this blocks the
// remaining sensitive extensions/paths before they reach the static handler.
const webRoot = path.resolve(__dirname, '../../');
const BLOCKED_STATIC_PATTERN = /\.(keystore|jks|p12|pem|key|base64|apk|aab|properties|env)$|(^|\/)(node_modules|\.git|\.gradle|\.kotlin|server|scratch)(\/|$)/i;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (BLOCKED_STATIC_PATTERN.test(req.path)) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(webRoot));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'BeltFlow SaaS Backend API', timestamp: new Date().toISOString() });
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
