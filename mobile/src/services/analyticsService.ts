import { apiClient } from './apiClient';

export interface AcademyMetricsData {
  metadata: {
    metricVersion: string;
    calculatedAt: string;
    scope: 'global' | 'organization' | 'class';
    period: string;
    organizationId?: string;
    organizationName?: string;
    classId?: string;
    className?: string;
  };
  enrollment: {
    activeEnrolledStudents: number;
    pendingApplicants: number;
    totalClassCapacity: number;
    capacityUtilizationPercent: number;
    activeClassesCount: number;
  };
  trialConversion: {
    totalTrialsBooked: number;
    trialsAttended: number;
    trialsConverted: number;
    conversionRatePercent: number;
  };
  retention: {
    activeStudents: number;
    pausedMemberships: number;
    transfersCount: number;
    retentionRatePercent: number;
  };
  ledgerTotals: {
    currency: string;
    totalCollected: number;
    totalOutstanding: number;
    siblingDiscountSavings: number;
  };
}

export interface MetricsQueryParams {
  scope?: 'global' | 'organization' | 'class';
  organizationId?: string;
  classId?: string;
  period?: 'current_month' | 'last_30_days' | 'last_90_days' | 'year_to_date' | 'all_time';
}

export interface ReportExportParams extends MetricsQueryParams {
  reportType?: 'ACADEMY_GROWTH_METRICS' | 'ENROLLMENT_ROSTER' | 'FINANCIAL_LEDGER_SUMMARY' | 'TRIAL_CONVERSION_LOG';
  format?: 'json' | 'csv';
}

export const analyticsService = {
  /**
   * Fetches official growth analytics and metrics for the authorized actor.
   */
  async getAcademyMetrics(params?: MetricsQueryParams): Promise<AcademyMetricsData> {
    const queryParts: string[] = [];
    if (params?.scope) queryParts.push(`scope=${encodeURIComponent(params.scope)}`);
    if (params?.organizationId) queryParts.push(`organizationId=${encodeURIComponent(params.organizationId)}`);
    if (params?.classId) queryParts.push(`classId=${encodeURIComponent(params.classId)}`);
    if (params?.period) queryParts.push(`period=${encodeURIComponent(params.period)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return apiClient.get<AcademyMetricsData>(`/analytics/metrics${queryString}`);
  },

  /**
   * Requests an authorized report export (JSON or CSV).
   * Enforces server-side scope validation and logs audit event.
   */
  async exportAuthorizedReport(params: ReportExportParams): Promise<any> {
    return apiClient.post('/analytics/export', params);
  },
};
