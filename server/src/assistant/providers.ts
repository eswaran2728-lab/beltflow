/**
 * Provider-neutral generation layer.
 *
 * The default provider is "extractive": it builds the answer directly from
 * the highest-ranked authorised evidence and needs no network, API key or
 * model. It cannot follow injected instructions because it never interprets
 * evidence text as instructions.
 *
 * Gemini (AI-LIVE-001) is enabled with AI_PROVIDER=gemini and
 * GEMINI_API_KEY on the server; see gemini.ts. Any other provider can be
 * added by implementing AssistantProvider. Credentials stay server-side.
 */
import { GeminiProvider, DEFAULT_GEMINI_MODEL } from './gemini';
import { MESSAGES } from './policy';
import { AssistantProvider, ProviderRequest, ProviderResponse } from './types';

function firstSentences(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxChars) return flat;
  const cut = flat.slice(0, maxChars);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${stop > 60 ? cut.slice(0, stop + 1) : cut}…`;
}

export class ExtractiveProvider implements AssistantProvider {
  name = 'extractive';
  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const top = req.evidence.slice(0, 3);
    const lines = top.map(e => `• ${e.title}: ${firstSentences(e.text, 260)}`);
    const text = [MESSAGES[req.locale].foundPrefix, ...lines].join('\n');
    return {
      text,
      citedSourceIds: top.map(e => e.id),
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

/**
 * Chooses the provider from environment settings.
 * AI_PROVIDER=gemini plus GEMINI_API_KEY enables Gemini; anything else keeps
 * the offline extractive provider. A missing key never breaks the assistant.
 */
export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): AssistantProvider {
  if ((env.AI_PROVIDER || '').toLowerCase() !== 'gemini') return new ExtractiveProvider();
  if (!env.GEMINI_API_KEY) {
    console.warn('[Assistant] AI_PROVIDER=gemini but GEMINI_API_KEY is not set; using the offline extractive provider.');
    return new ExtractiveProvider();
  }
  return new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL });
}

// Chosen on first use, so it reflects the environment the server runs with.
let activeProvider: AssistantProvider | null = null;

export function getAssistantProvider(): AssistantProvider {
  if (!activeProvider) activeProvider = createProviderFromEnv();
  return activeProvider;
}

export function setAssistantProvider(provider: AssistantProvider): void {
  activeProvider = provider;
}

/** Back to the environment-selected provider. */
export function resetAssistantProvider(): void {
  activeProvider = createProviderFromEnv();
}
