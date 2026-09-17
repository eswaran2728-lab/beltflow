import app from './app';
import { dbClient } from './db/client';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`🚀 BeltFlow TypeScript + PostgreSQL Backend API running on port ${PORT}`);
});

// A process-level restart (container redeploy, systemd stop, orchestrator
// reschedule) sends SIGTERM/SIGINT, not a graceful in-process shutdown.
// Without closing the DB client first, the embedded PostgreSQL engine can
// lose writes that were not yet checkpointed to disk.
async function shutdown(signal: string) {
  console.log(`\n${signal} received: closing server and flushing database...`);
  server.close(async () => {
    await dbClient.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
