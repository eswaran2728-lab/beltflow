import app from './app';
import { dbClient } from './db/client';
import { startBackgroundWorkers } from './workers/scheduler';

const PORT = process.env.PORT || 4000;

// Connect and apply the schema at startup instead of on the first request.
// Liveness (/api/health) does not wait for this; readiness
// (/api/health/ready) and every query do, through the same shared promise.
dbClient.init().catch(err => {
  console.error('[Startup] Database initialisation failed; it will be retried on the next query.', err instanceof Error ? err.message : err);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 BeltFlow TypeScript + PostgreSQL Backend API running on port ${PORT}`);
});

// Scheduled transfers, waitlist offer expiry and payment link expiry.
const stopWorkers = startBackgroundWorkers();

// A process-level restart (container redeploy, systemd stop, orchestrator
// reschedule) sends SIGTERM/SIGINT, not a graceful in-process shutdown.
// Without closing the DB client first, the embedded PostgreSQL engine can
// lose writes that were not yet checkpointed to disk.
async function shutdown(signal: string) {
  console.log(`\n${signal} received: closing server and flushing database...`);
  stopWorkers();
  server.close(async () => {
    await dbClient.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
