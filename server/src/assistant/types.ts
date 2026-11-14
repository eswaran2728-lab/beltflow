/**
 * H26 assistant types.
 *
 * Contract: answerAuthorizedQuestion(actor, query, context) -> AnswerWithSources
 * The actor always comes from the authenticated server session (req.user),
 * never from the request body.
 */

export type AssistantLocale = 'en' | 'ms' | 'ta';

/** Optional narrowing hints from the client. Never widens access. */
export interface AssistantContext {
  studentId?: string;
  classId?: string;
  /** Only used to detect forged tenant parameters; the actor's own tenant is always used. */
  organizationId?: string;
  locale?: AssistantLocale;
}

export type AnswerStatus =
  | 'ANSWERED'               // grounded answer with at least one valid citation
  | 'INSUFFICIENT_EVIDENCE'  // nothing authorised matched; the assistant admits the gap
  | 'ACTION_REFUSED'         // the user asked the assistant to do something (read-only)
  | 'OUT_OF_SCOPE'           // e.g. medical advice
  | 'BLOCKED';               // provider output failed the safety checks and was withheld

export interface SourceCitation {
  id: string;
  type: string;
  title: string;
  excerpt: string;
}

export interface AnswerWithSources {
  status: AnswerStatus;
  answer: string;
  sources: SourceCitation[];
  readOnly: true;
  provider: string;
  locale: AssistantLocale;
  generatedAt: string;
}

/** One authorised piece of evidence. Built only by server-side retrieval. */
export interface EvidenceItem {
  id: string;
  type: string;
  title: string;
  text: string;
  /** null = platform-level document or aggregate. */
  organizationId: string | null;
}

/** Internal retrieval candidate with ranking-only keywords. */
export interface CandidateSource extends EvidenceItem {
  keywords?: string;
}

export interface ProviderRequest {
  /** Fixed server policy text (ASSISTANT_POLICY). Documents can never change it. */
  policy: string;
  question: string;
  role: string;
  locale: AssistantLocale;
  /** Untrusted data: sanitised, size-capped, already authorised. */
  evidence: EvidenceItem[];
  maxOutputTokens: number;
  /** Aborted when the server stops waiting (timeout); live providers must cancel the request. */
  signal?: AbortSignal;
}

export interface ProviderResponse {
  text: string;
  citedSourceIds: string[];
  usage?: { inputTokens: number; outputTokens: number };
}

/** Provider-neutral interface. Live providers (Gemini, Claude, ...) plug in here. */
export interface AssistantProvider {
  name: string;
  generate(req: ProviderRequest): Promise<ProviderResponse>;
}

export class AssistantError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'AssistantError';
  }
}
