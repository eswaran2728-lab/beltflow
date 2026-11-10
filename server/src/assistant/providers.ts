/**
 * Provider-neutral generation layer.
 *
 * The default provider is "extractive": it builds the answer directly from
 * the highest-ranked authorised evidence and needs no network, API key or
 * model. It cannot follow injected instructions because it never interprets
 * evidence text as instructions.
 *
 * A live LLM provider (for example Gemini or Claude) can be added by
 * implementing AssistantProvider and registering it with
 * setAssistantProvider() at startup. Its credentials must stay server-side.
 * No live provider is wired in yet, so live AI behaviour is unverified.
 */
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

let activeProvider: AssistantProvider = new ExtractiveProvider();

export function getAssistantProvider(): AssistantProvider {
  return activeProvider;
}

export function setAssistantProvider(provider: AssistantProvider): void {
  activeProvider = provider;
}

export function resetAssistantProvider(): void {
  activeProvider = new ExtractiveProvider();
}
