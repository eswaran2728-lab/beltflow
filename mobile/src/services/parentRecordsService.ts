/**
 * Parent records: link requests for another child and the parent's notices.
 *
 * Field names and statuses are the server's own:
 *  - server/src/routes/auth.routes.ts     POST/GET /auth/parent-link-requests
 *    (rows of parent_student_links; status PENDING_STUDENT -> PENDING_MASTER
 *    -> PENDING_ADMIN -> ACTIVE, or REJECTED; REVOKED after a revoke)
 *  - server/src/routes/notices.routes.ts  GET /notices/mine,
 *    POST /notices/:noticeId/acknowledge (a parent must send studentId)
 */
import { apiClient } from './apiClient';

export type ParentLinkStatus =
  | 'PENDING_STUDENT'
  | 'PENDING_MASTER'
  | 'PENDING_ADMIN'
  | 'ACTIVE'
  | 'REJECTED'
  | 'REVOKED';

export interface ParentLinkRequest {
  id: string;
  parent_id: string;
  student_id: string;
  status: ParentLinkStatus | string;
  student_approved: boolean;
  master_approved: boolean;
  admin_approved: boolean;
  created_at?: string;
  /** Present on GET (joined from students); absent on the POST response. */
  student_name?: string;
}

export interface LinkRequestList {
  /**
   * False when the server refuses to list requests for this account (an
   * older server answered 403 for the PARENT role; current servers list them).
   */
  available: boolean;
  requests: ParentLinkRequest[];
}

export type NoticeType = 'NEW_SCHEDULE' | 'SCHEDULE_CHANGE' | 'CANCELLED' | 'EXTRA_SESSION' | 'GENERAL';

export interface ParentNotice {
  id: string;
  organization_id: string;
  class_id: string;
  group_id: string | null;
  session_id?: string | null;
  type: NoticeType | string;
  message: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
  requires_acknowledgement?: boolean;
  acknowledgement_deadline?: string | null;
  /** True when this account has already acknowledged the notice. */
  acknowledged_by_me?: boolean;
  /** Which of this parent's children it was acknowledged for. */
  acknowledged_student_ids?: string[];
}

function time(value?: string | null): number {
  const n = value ? new Date(value).getTime() : NaN;
  return isNaN(n) ? 0 : n;
}

export const parentRecordsService = {
  async requestChildLink(icNumber: string): Promise<ParentLinkRequest> {
    const res = await apiClient.post<{ linkRequest: ParentLinkRequest }>('/auth/parent-link-requests', {
      icNumber: icNumber.trim(),
    });
    return res.linkRequest;
  },

  async listLinkRequests(): Promise<LinkRequestList> {
    try {
      const res = await apiClient.get<{ linkRequests?: ParentLinkRequest[] }>('/auth/parent-link-requests');
      const requests = Array.isArray(res?.linkRequests) ? res.linkRequests : [];
      return { available: true, requests: [...requests].sort((a, b) => time(b.created_at) - time(a.created_at)) };
    } catch (err) {
      // ApiError carries the HTTP status; checked by shape so mocks work too.
      if ((err as { status?: number } | null)?.status === 403) return { available: false, requests: [] };
      throw err;
    }
  },

  /** The parent's notices, newest first. */
  async listNotices(): Promise<ParentNotice[]> {
    const res = await apiClient.get<{ notices?: ParentNotice[] }>('/notices/mine');
    const notices = Array.isArray(res?.notices) ? res.notices : [];
    return [...notices].sort((a, b) => time(b.created_at) - time(a.created_at));
  },

  async acknowledgeNotice(noticeId: string, studentId: string): Promise<{ acknowledged: boolean }> {
    return apiClient.post<{ acknowledged: boolean }>(
      `/notices/${encodeURIComponent(noticeId)}/acknowledge`,
      { studentId }
    );
  },
};
