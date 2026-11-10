/**
 * H27 release modules and feature flags.
 *
 * The governing PDF splits BeltFlow into releases:
 *   R1 core academy (always on: approvals, attendance, scheduling, belts,
 *      grading, payments, receipts, notices, onboarding)
 *   R2 teaching and retention
 *   R3 events and commerce
 *   R4 assisted operations (AI)
 *
 * Settings (server environment):
 *   BELTFLOW_RELEASE=R1|R2|R3|R4   highest release enabled. Unset = R4 (all
 *                                   modules, the current behaviour). An
 *                                   unknown value fails closed to R1.
 *   BELTFLOW_DISABLED_MODULES=a,b  kill switches for single optional modules
 *                                   (rollback by feature disablement). Core
 *                                   R1 routes cannot be disabled this way.
 *   AI_ASSISTANT_ENABLED=false      legacy switch for the assistant (H26).
 *
 * A disabled module answers 404 {code: "MODULE_DISABLED"} for every caller,
 * before authentication, so it behaves as if it did not exist.
 */
import { NextFunction, Request, Response } from 'express';

export type ReleaseLevel = 'R1' | 'R2' | 'R3' | 'R4';

export interface ReleaseModule {
  key: string;
  release: Exclude<ReleaseLevel, 'R1'>;
  title: string;
  task: string;
  /** Exact app.use() mount paths. */
  mounts: string[];
}

export const RELEASE_MODULES: ReleaseModule[] = [
  { key: 'trials', release: 'R2', title: 'Trials and follow-up', task: 'H16', mounts: ['/api/v1/trials'] },
  { key: 'bookings', release: 'R2', title: 'Make-up classes and waitlists', task: 'H17', mounts: ['/api/v1/bookings'] },
  { key: 'transfers', release: 'R2', title: 'Pauses, returns and transfers', task: 'H18', mounts: ['/api/v1/transfers', '/api/v1/memberships'] },
  { key: 'teaching', release: 'R2', title: 'Lesson plans', task: 'H19', mounts: ['/api/v1/teaching'] },
  { key: 'family', release: 'R2', title: 'Family hub', task: 'H19', mounts: ['/api/v1/family'] },
  { key: 'learning', release: 'R2', title: 'Learning library, performance and rewards', task: 'H20', mounts: ['/api/v1/learning'] },
  { key: 'media', release: 'R2', title: 'Private video feedback', task: 'H21', mounts: ['/api/v1/media'] },
  { key: 'messaging', release: 'R3', title: 'Parent-Master messaging', task: 'H22', mounts: ['/api/v1/messaging'] },
  { key: 'analytics', release: 'R3', title: 'Growth analytics and exports', task: 'H23', mounts: ['/api/v1/analytics'] },
  { key: 'tournaments', release: 'R3', title: 'Tournaments and judging', task: 'H24', mounts: ['/api/v1/tournaments'] },
  { key: 'commerce', release: 'R3', title: 'Equipment and merchandise', task: 'H25', mounts: ['/api/v1/commerce'] },
  { key: 'assistant', release: 'R4', title: 'Role-aware AI assistant', task: 'H26', mounts: ['/api/v1/assistant'] },
];

const LEVELS: ReleaseLevel[] = ['R1', 'R2', 'R3', 'R4'];
const rank = (level: ReleaseLevel) => LEVELS.indexOf(level) + 1;
const warned = new Set<string>();

export function resolveReleaseLevel(raw: string | undefined): ReleaseLevel {
  if (raw === undefined || raw.trim() === '') return 'R4';
  const value = raw.trim().toUpperCase() as ReleaseLevel;
  if (LEVELS.includes(value)) return value;
  if (!warned.has(raw)) {
    warned.add(raw);
    console.error(`[Release] Unknown BELTFLOW_RELEASE "${raw}"; failing closed to R1 (core only).`);
  }
  return 'R1';
}

function disabledKeys(env: NodeJS.ProcessEnv): Set<string> {
  const keys = new Set((env.BELTFLOW_DISABLED_MODULES || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean));
  if (env.AI_ASSISTANT_ENABLED === 'false') keys.add('assistant');
  return keys;
}

export function isModuleEnabled(key: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const mod = RELEASE_MODULES.find(m => m.key === key);
  if (!mod) return true; // core (R1) modules are not in the registry and are always on
  if (rank(mod.release) > rank(resolveReleaseLevel(env.BELTFLOW_RELEASE))) return false;
  return !disabledKeys(env).has(key);
}

export function enabledModuleKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  return RELEASE_MODULES.filter(m => isModuleEnabled(m.key, env)).map(m => m.key);
}

/** Express middleware placed in front of an optional module's router. */
export function moduleGate(key: string) {
  if (!RELEASE_MODULES.some(m => m.key === key)) throw new Error(`moduleGate: unknown module "${key}"`);
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!isModuleEnabled(key)) {
      return res.status(404).json({ error: 'This feature is not enabled.', code: 'MODULE_DISABLED', module: key });
    }
    next();
  };
}

/** Public, tenant-free description of what this deployment enables (for the mobile app). */
export function releaseInfo() {
  return {
    release: resolveReleaseLevel(process.env.BELTFLOW_RELEASE),
    enabledModules: enabledModuleKeys(),
    modules: RELEASE_MODULES.map(m => ({ key: m.key, release: m.release, title: m.title, enabled: isModuleEnabled(m.key) })),
  };
}
