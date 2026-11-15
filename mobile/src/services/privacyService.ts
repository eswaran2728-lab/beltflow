import { apiClient } from './apiClient';

/**
 * A person's rights over their own data (server: /api/v1/privacy).
 * The server decides what each person may see and who handles a request.
 */
export type PrivacyRequestType = 'DELETE' | 'CORRECT' | 'WITHDRAW_CONSENT';
export type PrivacyRequestStatus = 'OPEN' | 'COMPLETED' | 'REJECTED';

export interface PrivacyRequest {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  details?: string | null;
  studentId?: string | null;
  createdAt: string;
  dueAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

export interface MyData {
  generatedAt: string;
  account: { id: string; fullName: string; email: string; role: string; [key: string]: unknown };
  consents: { type: string; documentVersion: string; acceptedAt: string }[];
  /** Present for a parent or guardian: their actively linked children. */
  children?: { id: string; fullName: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export const privacyService = {
  getMyData(): Promise<MyData> {
    return apiClient.get<MyData>('/privacy/my-data');
  },

  async listMyRequests(): Promise<PrivacyRequest[]> {
    const res = await apiClient.get<{ requests: PrivacyRequest[] }>('/privacy/requests/mine');
    return res?.requests || [];
  },

  createRequest(input: { type: PrivacyRequestType; details?: string; studentId?: string }): Promise<{ request: PrivacyRequest }> {
    // Only send what was actually chosen.
    const body: Record<string, string> = { type: input.type };
    if (input.studentId) body.studentId = input.studentId;
    if (input.details && input.details.trim()) body.details = input.details.trim();
    return apiClient.post<{ request: PrivacyRequest }>('/privacy/requests', body);
  },
};
