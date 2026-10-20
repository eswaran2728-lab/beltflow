import { apiClient } from './apiClient';

export interface MembershipPauseInput {
  studentId: string;
  startDate: string;
  expectedEndDate?: string;
  reason: string;
}

export interface MembershipPause {
  id: string;
  organization_id: string;
  student_id: string;
  class_id: string;
  requested_by_user_id: string;
  reason: string;
  start_date: string;
  expected_end_date?: string;
  actual_return_date?: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RESUMED' | 'CANCELLED';
  approved_by_master_id?: string;
  approved_at?: string;
  notes?: string;
  version: number;
  created_at: string;
  updated_at: string;
  student_name?: string;
  belt_rank?: string;
  class_name?: string;
}

export interface ClassTransferInput {
  studentId: string;
  targetClassId: string;
  reason?: string;
  effectiveDate?: string;
  consentAccepted?: boolean;
}

export interface ClassTransferRequest {
  id: string;
  student_id: string;
  organization_id: string;
  target_organization_id?: string;
  old_class_id: string;
  new_class_id: string;
  effective_date: string;
  reason?: string;
  consent_accepted: boolean;
  requested_by_user_id?: string;
  receiving_master_id?: string;
  old_master_approved: boolean;
  new_master_approved: boolean;
  status: 'REQUESTED' | 'PENDING_RECEIVING' | 'PENDING_OLD_MASTER' | 'PENDING_NEW_MASTER' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejection_reason?: string;
  approved_at?: string;
  version: number;
  created_at: string;
  updated_at: string;
  student_name?: string;
  belt_rank?: string;
  old_class_name?: string;
  new_class_name?: string;
}

export interface StudentEnrollmentHistoryItem {
  id: string;
  class_id: string;
  class_name: string;
  status: string;
  is_primary: boolean;
  provenance: string;
  effective_from: string;
  effective_to?: string;
  created_at: string;
}

export interface StudentHistoryRecord {
  enrollments: StudentEnrollmentHistoryItem[];
  pauses: MembershipPause[];
  transfers: ClassTransferRequest[];
  attendanceCount: number;
  paymentsCount: number;
}

export const membershipService = {
  // --- Membership Pauses ---
  async requestPause(input: MembershipPauseInput): Promise<MembershipPause> {
    const res = await apiClient.post<{ message: string; pause: MembershipPause }>('/memberships/pause/request', input);
    return res.pause;
  },

  async approvePause(pauseId: string, expectedVersion?: number): Promise<MembershipPause> {
    const res = await apiClient.post<{ message: string; pause: MembershipPause }>(`/memberships/pause/${pauseId}/approve`, {
      expectedVersion,
    });
    return res.pause;
  },

  async resumeMembership(pauseId: string): Promise<{ pause: MembershipPause }> {
    const res = await apiClient.post<{ message: string; pause: MembershipPause }>(`/memberships/resume/${pauseId}`, {});
    return { pause: res.pause };
  },

  async getPendingPauses(): Promise<MembershipPause[]> {
    const res = await apiClient.get<{ pauses: MembershipPause[] }>('/transfers/pauses/pending');
    return res.pauses || [];
  },

  // --- Class Transfers ---
  async requestTransfer(input: ClassTransferInput): Promise<ClassTransferRequest> {
    const res = await apiClient.post<{ message: string; transfer: ClassTransferRequest }>('/transfers/request', input);
    return res.transfer;
  },

  async approveTransfer(transferId: string, expectedVersion?: number): Promise<ClassTransferRequest> {
    const res = await apiClient.post<{ message: string; transfer: ClassTransferRequest }>(`/transfers/${transferId}/approve`, {
      expectedVersion,
    });
    return res.transfer;
  },

  async getPendingTransfers(): Promise<ClassTransferRequest[]> {
    const res = await apiClient.get<{ transfers: ClassTransferRequest[] }>('/transfers/pending');
    return res.transfers || [];
  },

  // --- Student Lifecycle History ---
  async getStudentHistory(studentId: string): Promise<StudentHistoryRecord> {
    const res = await apiClient.get<StudentHistoryRecord>(`/transfers/students/${studentId}/history`);
    return res;
  },
};
