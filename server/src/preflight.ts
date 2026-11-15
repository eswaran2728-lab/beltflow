// Imported first by index.ts, so it runs before any other module reads the
// environment: loads server/.env (if present; it is git-ignored, and real
// deployments set variables on the host), then refuses to start in
// production with a missing or weak configuration, listing every problem.
import 'dotenv/config';
import { validateProductionEnv } from './config/validateEnv';

const configProblems = validateProductionEnv();
if (configProblems.length > 0) {
  console.error('FATAL: production configuration problems:\n - ' + configProblems.join('\n - '));
  process.exit(1);
}
