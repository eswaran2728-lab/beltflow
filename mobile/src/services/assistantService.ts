import { apiClient } from './apiClient';
import { AnswerStatus, AssistantLocale } from '../i18n/assistantStrings';

/**
 * H26 assistant API client. Read-only: the only call is a question.
 * No provider credentials exist in the mobile app; the server picks the provider.
 */
export interface AssistantSource {
  id: string;
  type: string;
  title: string;
  excerpt: string;
}

export interface AssistantAnswer {
  status: AnswerStatus;
  answer: string;
  sources: AssistantSource[];
  readOnly: true;
  provider: string;
  locale: AssistantLocale;
  generatedAt: string;
}

export interface AssistantAskContext {
  studentId?: string;
  classId?: string;
  locale?: AssistantLocale;
}

export const assistantService = {
  ask(query: string, context: AssistantAskContext = {}): Promise<AssistantAnswer> {
    return apiClient.post<AssistantAnswer>('/assistant/ask', { query, context });
  },
};
