import { apiClient } from './apiClient';

export interface FamilyChild {
  id: string;
  full_name: string;
  ic_number: string;
  belt_rank: string;
  monthly_fee: number;
  billing_status: string;
  status: string;
  class_id?: string;
  class_name?: string;
  class_location?: string;
  organization_id: string;
  organization_name: string;
  link_status?: string;
  linked_at?: string;
}

export interface MerchantFinancialPartition {
  organizationId: string;
  merchantName: string;
  currency: string;
  totalFeeAmount: number;
  totalAmountPaid: number;
  totalOutstandingAmount: number;
  dues: {
    id: string;
    billingMonth: string;
    feeAmount: number;
    amountPaid: number;
    status: string;
    className?: string;
  }[];
  invoices?: any[];
  payments?: any[];
}

export interface ChildTimelineData {
  student: {
    id: string;
    fullName: string;
    icNumber: string;
    beltRank: string;
    monthlyFee: number;
    billingStatus: string;
    status: string;
    registeredAt: string;
    classId?: string;
    className?: string;
    classSchedule?: string;
    classLocation?: string;
    organizationId: string;
    organizationName: string;
  };
  attendance: {
    id: string;
    session_date: string;
    status: string;
    marked_at: string;
    class_name: string;
  }[];
  rankHistory: {
    id: string;
    rank_name: string;
    awarded_at: string;
    certificate_code?: string;
    verification_token?: string;
    belt_color_hex?: string;
    notes?: string;
  }[];
  upcomingSessions: {
    id: string;
    session_date: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    location: string;
    class_name: string;
    group_name?: string;
  }[];
  financialPartitions: MerchantFinancialPartition[];
}

export interface MerchantSummaryPartition {
  organizationId: string;
  merchantName: string;
  currency: string;
  totalFeeAmount: number;
  totalAmountPaid: number;
  totalOutstandingAmount: number;
  studentDues: {
    dueId: string;
    studentId: string;
    studentName: string;
    billingMonth: string;
    feeAmount: number;
    amountPaid: number;
    status: string;
  }[];
}

export const familyService = {
  async getChildren(): Promise<FamilyChild[]> {
    const res = await apiClient.get<{ children: FamilyChild[] }>('/family/children');
    return res.children || [];
  },

  async getChildTimeline(studentId: string): Promise<ChildTimelineData> {
    return await apiClient.get<ChildTimelineData>(`/family/students/${studentId}/timeline`);
  },

  async getMerchantDuesSummary(): Promise<{ partitions: MerchantSummaryPartition[] }> {
    return await apiClient.get<{ partitions: MerchantSummaryPartition[] }>('/family/merchant-dues-summary');
  },
};
