import { analyticsService, AcademyMetricsData, ReportExportParams } from '../services/analyticsService';
import { apiClient } from '../services/apiClient';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

describe('Task H23: Mobile Analytics Service Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockMetrics: AcademyMetricsData = {
    metadata: {
      metricVersion: 'v2.0-h23',
      calculatedAt: '2026-10-21T06:00:00.000Z',
      scope: 'organization',
      period: 'current_month',
      organizationId: 'org_test_1',
      organizationName: 'Selangor Silambam Federation',
    },
    enrollment: {
      activeEnrolledStudents: 42,
      pendingApplicants: 5,
      totalClassCapacity: 60,
      capacityUtilizationPercent: 70.0,
      activeClassesCount: 3,
    },
    trialConversion: {
      totalTrialsBooked: 12,
      trialsAttended: 10,
      trialsConverted: 6,
      conversionRatePercent: 50.0,
    },
    retention: {
      activeStudents: 42,
      pausedMemberships: 2,
      transfersCount: 1,
      retentionRatePercent: 95.45,
    },
    ledgerTotals: {
      currency: 'MYR',
      totalCollected: 5040.0,
      totalOutstanding: 480.0,
      siblingDiscountSavings: 360.0,
    },
  };

  test('getAcademyMetrics calls /analytics/metrics with correct query parameters', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce(mockMetrics);

    const result = await analyticsService.getAcademyMetrics({
      scope: 'organization',
      organizationId: 'org_test_1',
      period: 'current_month',
    });

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/analytics/metrics?scope=organization&organizationId=org_test_1&period=current_month'
    );
    expect(result).toEqual(mockMetrics);
    expect(result.metadata.metricVersion).toBe('v2.0-h23');
    expect(result.enrollment.activeEnrolledStudents).toBe(42);
    expect(result.enrollment.pendingApplicants).toBe(5);
    expect(result.ledgerTotals.totalCollected).toBe(5040.0);
  });

  test('getAcademyMetrics with class scope includes classId', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      ...mockMetrics,
      metadata: { ...mockMetrics.metadata, scope: 'class', classId: 'cls_123' },
    });

    const result = await analyticsService.getAcademyMetrics({
      scope: 'class',
      classId: 'cls_123',
    });

    expect(apiClient.get).toHaveBeenCalledWith('/analytics/metrics?scope=class&classId=cls_123');
    expect(result.metadata.classId).toBe('cls_123');
  });

  test('exportAuthorizedReport sends POST request with correct payload', async () => {
    const exportResponse = {
      reportType: 'ACADEMY_GROWTH_METRICS',
      format: 'json',
      scope: 'organization',
      organizationId: 'org_test_1',
      period: 'current_month',
      exportedAt: '2026-10-21T06:00:00.000Z',
      exportedBy: 'admin@selangor.silambam.test',
      metrics: mockMetrics,
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(exportResponse);

    const exportParams: ReportExportParams = {
      reportType: 'ACADEMY_GROWTH_METRICS',
      format: 'json',
      scope: 'organization',
      organizationId: 'org_test_1',
      period: 'current_month',
    };

    const res = await analyticsService.exportAuthorizedReport(exportParams);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/analytics/export', exportParams);
    expect(res).toEqual(exportResponse);
  });

  test('propagates API error when scope expansion is rejected', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(
      new Error('Access denied. Cross-tenant organization analytics access is forbidden.')
    );

    await expect(
      analyticsService.exportAuthorizedReport({
        reportType: 'ACADEMY_GROWTH_METRICS',
        organizationId: 'unauthorized_org',
      })
    ).rejects.toThrow('Cross-tenant organization analytics access is forbidden.');
  });
});
