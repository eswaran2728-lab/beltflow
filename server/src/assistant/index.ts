/**
 * H26 Role-Aware Grounded AI — public module surface.
 * Read-only by design: nothing exported here can change operational records.
 */
export { answerAuthorizedQuestion } from './service';
export { ASSISTANT_POLICY, isActionRequest, isMedicalAdviceRequest } from './policy';
export { ExtractiveProvider, createProviderFromEnv, getAssistantProvider, setAssistantProvider, resetAssistantProvider } from './providers';
export { GeminiProvider, DEFAULT_GEMINI_MODEL } from './gemini';
export { configureAssistantLimits, resetAssistantState, isAssistantEnabled } from './limits';
export * from './types';
