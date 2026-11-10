/**
 * Official H26 contract:
 *   answerAuthorizedQuestion(actor, query, context) -> answerWithSources
 *
 * Order of operations (each step can end the request):
 *   1. validate input, rate limit, daily budget
 *   2. refuse action requests and medical advice (read-only, no provider call)
 *   3. resolve the actor's real scope server-side (403 on any widening)
 *   4. retrieve only authorised, approved sources; rank them
 *   5. no matching evidence -> admit the gap (no provider call)
 *   6. sanitise evidence, call the provider with the fixed policy
 *   7. validate output: no action claims, only real citations, redact IDs
 *   8. audit minimally and return
 */
import { AuthUserContext } from '../security/rbac';
import { checkProviderOutput, isActionRequest, isMedicalAdviceRequest, MESSAGES, ASSISTANT_POLICY, sanitizeEvidenceText } from './policy';
import { getAssistantProvider } from './providers';
import { enforceDailyBudget, enforceRateLimit, estimateTokens, getLimits, recordAssistantAudit } from './limits';
import { gatherAuthorizedSources, rankSources, resolveScope } from './retrieval';
import {
  AnswerStatus, AnswerWithSources, AssistantContext, AssistantError, AssistantLocale, AssistantProvider, EvidenceItem, SourceCitation,
} from './types';

const LOCALES: AssistantLocale[] = ['en', 'ms', 'ta'];

function normaliseLocale(locale: unknown): AssistantLocale {
  return LOCALES.includes(locale as AssistantLocale) ? (locale as AssistantLocale) : 'en';
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`provider timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function answerAuthorizedQuestion(
  actor: AuthUserContext,
  query: unknown,
  context: AssistantContext = {},
  options: { provider?: AssistantProvider } = {}
): Promise<AnswerWithSources> {
  const started = Date.now();
  const limits = getLimits();
  const locale = normaliseLocale(context.locale);
  const provider = options.provider || getAssistantProvider();

  if (!actor || !actor.id || !actor.role) throw new AssistantError(401, 'UNAUTHENTICATED', 'Authentication required.');
  if (typeof query !== 'string' || !query.trim()) throw new AssistantError(400, 'QUERY_REQUIRED', 'Please type a question.');
  const question = query.trim();
  if (question.length > limits.maxQueryChars) {
    throw new AssistantError(400, 'QUERY_TOO_LONG', `Questions are limited to ${limits.maxQueryChars} characters.`);
  }

  enforceRateLimit(actor);
  await enforceDailyBudget(actor);

  const finish = async (
    status: AnswerStatus, answer: string, sources: SourceCitation[], providerName: string, tokens = { input: 0, output: 0 }, outcome?: string
  ): Promise<AnswerWithSources> => {
    await recordAssistantAudit({
      actor, query: question, outcome: outcome || status, sourceIds: sources.map(s => s.id), provider: providerName,
      inputTokens: tokens.input, outputTokens: tokens.output, latencyMs: Date.now() - started,
    });
    return { status, answer, sources, readOnly: true, provider: providerName, locale, generatedAt: new Date().toISOString() };
  };

  // Read-only guardrails come before any retrieval or provider call.
  if (isActionRequest(question)) return finish('ACTION_REFUSED', MESSAGES[locale].refused, [], 'policy');
  if (isMedicalAdviceRequest(question)) return finish('OUT_OF_SCOPE', MESSAGES[locale].outOfScope, [], 'policy');

  let scope;
  try {
    scope = await resolveScope(actor, context);
  } catch (err) {
    if (err instanceof AssistantError) {
      await recordAssistantAudit({
        actor, query: question, outcome: `DENIED_${err.code}`, sourceIds: [], provider: null, inputTokens: 0, outputTokens: 0,
        latencyMs: Date.now() - started,
      });
    }
    throw err;
  }

  const candidates = await gatherAuthorizedSources(scope, context);
  const ranked = rankSources(question, candidates, limits.maxEvidenceItems);
  if (ranked.length === 0) return finish('INSUFFICIENT_EVIDENCE', MESSAGES[locale].gap, [], 'none');

  const evidence: EvidenceItem[] = ranked.map(src => ({
    id: src.id, type: src.type, organizationId: src.organizationId,
    title: sanitizeEvidenceText(src.title, 200),
    text: sanitizeEvidenceText(src.text, limits.maxEvidenceCharsPerItem),
  }));
  const evidenceChars = evidence.reduce((n, e) => n + e.text.length + e.title.length, 0) + ASSISTANT_POLICY.length + question.length;

  let output;
  try {
    output = await withTimeout(
      signal => provider.generate({
        policy: ASSISTANT_POLICY, question, role: actor.role, locale, evidence, maxOutputTokens: limits.maxOutputTokens, signal,
      }),
      limits.providerTimeoutMs
    );
  } catch (err) {
    console.error('[Assistant] provider failure', provider.name, err instanceof Error ? err.name : 'unknown');
    await recordAssistantAudit({
      actor, query: question, outcome: 'PROVIDER_ERROR', sourceIds: [], provider: provider.name,
      // The prompt was sent, so a failed call still counts towards the budget.
      inputTokens: estimateTokens(evidenceChars), outputTokens: 0, latencyMs: Date.now() - started,
    });
    throw new AssistantError(503, 'PROVIDER_UNAVAILABLE', 'The assistant is temporarily unavailable. Please try again later.');
  }

  const tokens = {
    input: output?.usage?.inputTokens ?? estimateTokens(evidenceChars),
    output: output?.usage?.outputTokens ?? estimateTokens(String(output?.text || '').length),
  };

  const checked = checkProviderOutput(output, evidence, limits.maxAnswerChars);
  if (!checked.ok) {
    if (checked.reason === 'ACTION_CLAIM') return finish('BLOCKED', MESSAGES[locale].blocked, [], provider.name, tokens, 'BLOCKED_ACTION_CLAIM');
    return finish('INSUFFICIENT_EVIDENCE', MESSAGES[locale].gap, [], provider.name, tokens, 'BLOCKED_NO_VALID_CITATION');
  }

  const byId = new Map(evidence.map(e => [e.id, e]));
  const sources: SourceCitation[] = checked.citedIds.map(id => {
    const e = byId.get(id)!;
    return { id: e.id, type: e.type, title: e.title, excerpt: e.text.length > 280 ? `${e.text.slice(0, 280)}…` : e.text };
  });
  return finish('ANSWERED', checked.text, sources, provider.name, tokens);
}
