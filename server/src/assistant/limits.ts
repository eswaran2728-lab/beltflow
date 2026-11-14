/**
 * Rate limits, cost budget and minimal audit logging for the assistant.
 *
 * - Per-actor sliding-window rate limit (in-memory, per process, like the
 *   existing auth limiter; a multi-instance deployment also needs a gateway
 *   limiter).
 * - Daily token budget per Persatuan (platform budget for Super Admin),
 *   computed from ai_audit_events so it survives restarts.
 * - Audit rows store a keyed hash and the length of the question, the
 *   outcome, the cited source ids and token estimates. Never the question
 *   or answer text.
 */
import crypto from 'crypto';
import { dbClient } from '../db/client';
import { AuthUserContext } from '../security/rbac';
import { AssistantError } from './types';

interface Limits {
  requestsPerMinute: number;
  dailyTokenBudgetPerOrg: number;
  dailyTokenBudgetPerActor: number;
  maxQueryChars: number;
  maxEvidenceItems: number;
  maxEvidenceCharsPerItem: number;
  maxOutputTokens: number;
  maxAnswerChars: number;
  providerTimeoutMs: number;
}

const envInt = (name: string, fallback: number) => {
  const v = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const defaults = (): Limits => ({
  requestsPerMinute: envInt('AI_RATE_LIMIT_PER_MINUTE', 20),
  dailyTokenBudgetPerOrg: envInt('AI_DAILY_TOKEN_BUDGET_PER_ORG', 200_000),
  dailyTokenBudgetPerActor: envInt('AI_DAILY_TOKEN_BUDGET_PER_ACTOR', 20_000),
  maxQueryChars: envInt('AI_MAX_QUERY_CHARS', 500),
  maxEvidenceItems: 6,
  maxEvidenceCharsPerItem: 1200,
  maxOutputTokens: envInt('AI_MAX_OUTPUT_TOKENS', 600),
  maxAnswerChars: 2000,
  providerTimeoutMs: envInt('AI_PROVIDER_TIMEOUT_MS', 15_000),
});

let overrides: Partial<Limits> = {};
const hits = new Map<string, number[]>();

export function getLimits(): Limits {
  return { ...defaults(), ...overrides };
}

/** Test/ops hook to tune limits without restarting. */
export function configureAssistantLimits(next: Partial<Pick<Limits, 'requestsPerMinute' | 'dailyTokenBudgetPerOrg' | 'dailyTokenBudgetPerActor'>>): void {
  overrides = { ...overrides, ...next };
}

export function resetAssistantState(): void {
  hits.clear();
  overrides = {};
}

export function isAssistantEnabled(): boolean {
  return process.env.AI_ASSISTANT_ENABLED !== 'false';
}

export function enforceRateLimit(actor: AuthUserContext): void {
  const now = Date.now();
  const recent = (hits.get(actor.id) || []).filter(t => now - t < 60_000);
  if (recent.length >= getLimits().requestsPerMinute) {
    hits.set(actor.id, recent);
    throw new AssistantError(429, 'RATE_LIMITED', 'Too many assistant questions. Please wait a minute and try again.');
  }
  recent.push(now);
  hits.set(actor.id, recent);
}

export async function enforceDailyBudget(actor: AuthUserContext): Promise<void> {
  const limits = getLimits();
  const orgId = actor.organizationId || null;
  const usage = await dbClient.query(
    `SELECT
       COALESCE(SUM(estimated_input_tokens + estimated_output_tokens), 0)::int AS org_used,
       COALESCE(SUM(CASE WHEN actor_id = $2 THEN estimated_input_tokens + estimated_output_tokens ELSE 0 END), 0)::int AS actor_used
     FROM ai_audit_events
     WHERE organization_id IS NOT DISTINCT FROM $1 AND created_at >= date_trunc('day', CURRENT_TIMESTAMP)`,
    [orgId, actor.id]);
  const row = usage.rows[0] || {};
  // A per-user cap stops one account from using up the whole Persatuan's daily budget.
  if (Number(row.actor_used || 0) >= limits.dailyTokenBudgetPerActor || Number(row.org_used || 0) >= limits.dailyTokenBudgetPerOrg) {
    throw new AssistantError(429, 'BUDGET_EXCEEDED', 'The assistant has reached today\'s usage limit. Please try again tomorrow.');
  }
}

export const estimateTokens = (chars: number) => Math.ceil(chars / 4);

// A per-process random key when none is configured: hashes still allow
// spotting repeated questions within a run, but cannot be reversed with a
// dictionary of common questions.
const hashKey = process.env.AI_AUDIT_HASH_KEY || crypto.randomBytes(32).toString('hex');

export function hashQuery(query: string): string {
  return crypto.createHmac('sha256', hashKey).update(query.trim().toLowerCase()).digest('hex');
}

export interface AuditRecord {
  actor: AuthUserContext;
  query: string;
  outcome: string;
  sourceIds: string[];
  provider: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function recordAssistantAudit(rec: AuditRecord): Promise<void> {
  try {
    await dbClient.query(
      `INSERT INTO ai_audit_events
         (id, organization_id, actor_id, actor_role, query_hash, query_chars, outcome, source_ids, provider,
          estimated_input_tokens, estimated_output_tokens, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        `aiev_${crypto.randomUUID()}`, rec.actor.organizationId || null, rec.actor.id, rec.actor.role,
        hashQuery(rec.query), rec.query.length, rec.outcome, rec.sourceIds, rec.provider,
        Math.max(0, Math.round(rec.inputTokens)), Math.max(0, Math.round(rec.outputTokens)), Math.round(rec.latencyMs),
      ]);
  } catch (err) {
    // Audit failure must never expose details to the user; it is logged for operators.
    console.error('[Assistant] audit write failed', err instanceof Error ? err.message : err);
  }
}
