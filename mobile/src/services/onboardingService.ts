import { apiClient } from './apiClient';

export interface AcademyReadinessChecklistItem {
  key: string;
  title: string;
  status: 'COMPLETE' | 'PENDING' | 'OPTIONAL';
  description: string;
}

export interface AcademyReadinessResponse {
  organizationId: string;
  organizationName: string;
  martialArtStyle: string;
  state: string;
  isReadyForOperations: boolean;
  readinessScorePercent: number;
  checklist: AcademyReadinessChecklistItem[];
  metrics: {
    curriculumReady: boolean;
    curriculumRanksCount: number;
    classesReady: boolean;
    classesCount: number;
    mastersReady: boolean;
    mastersCount: number;
    merchantReady: boolean;
    merchantMode: string;
    studentsCount: number;
    importBatchesCount: number;
  };
  recentImports: {
    id: string;
    idempotency_key: string;
    total_rows: number;
    imported_students_count: number;
    created_at: string;
  }[];
}

export interface ImportPreviewRow {
  rowIndex: number;
  status: 'VALID' | 'DUPLICATE' | 'MALFORMED' | 'WRONG_TENANT' | 'UNVERIFIED_PARENT';
  errorMessage?: string;
  data: {
    fullName?: string;
    icNumber?: string;
    email?: string;
    phone?: string;
    beltRank?: string;
    className?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    organizationId?: string;
  };
}

export interface ImportPreviewResponse {
  previewId: string;
  organizationId: string;
  sourceFilename: string;
  totalRows: number;
  validRowsCount: number;
  duplicateRowsCount: number;
  malformedRowsCount: number;
  wrongTenantRowsCount: number;
  unverifiedParentRowsCount: number;
  canCommit: boolean;
  previewRows: ImportPreviewRow[];
  errors: {
    rowIndex: number;
    status: string;
    error: string;
    data: any;
  }[];
}

export interface CommitImportResponse {
  success: boolean;
  alreadyCommitted?: boolean;
  batchId: string;
  idempotencyKey: string;
  status: string;
  importedStudentsCount: number;
  importedGuardiansCount: number;
  importedRanksCount: number;
  skippedDuplicatesCount: number;
  message: string;
}

export interface FamilySeparatedCheckout {
  organizationId: string;
  organizationName: string;
  merchantId?: string;
  merchantProvider: string;
  merchantStatus: string;
  isOnlinePaymentSupported: boolean;
  children: { studentId: string; fullName: string; beltRank: string }[];
  dues: {
    id: string;
    studentId: string;
    studentName: string;
    billingMonth: string;
    amount: number;
    balance: number;
    status: string;
  }[];
  totalAmountDue: number;
  currency: string;
}

export interface FamilySummaryResponse {
  parent: {
    id: string;
    fullName: string;
    email: string;
  };
  children: {
    id: string;
    fullName: string;
    icNumber: string;
    beltRank: string;
    monthlyFee: number;
    billingStatus: string;
    status: string;
    organizationId: string;
    organizationName: string;
    martialArtStyle: string;
    classId?: string;
    className?: string;
    schedule?: string;
    location?: string;
  }[];
  separatedCheckouts: FamilySeparatedCheckout[];
  hasCrossMerchantChildren: boolean;
  crossMerchantWarning: string | null;
  nextSessions: {
    id: string;
    classId: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    location: string;
    className: string;
  }[];
  notices: {
    id: string;
    organizationId: string;
    type: string;
    message: string;
    senderName?: string;
    createdAt: string;
    organizationName: string;
  }[];
  checkoutBundles?: any[];
}

class OnboardingService {
  async getAcademyReadiness(organizationId?: string): Promise<AcademyReadinessResponse> {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    return apiClient.get<AcademyReadinessResponse>(`/onboarding-imports/academy-readiness${query}`);
  }

  async previewImport(rows: any[], sourceFilename = 'legacy_roster.csv'): Promise<ImportPreviewResponse> {
    return apiClient.post<ImportPreviewResponse>('/onboarding-imports/preview-import', {
      rows,
      sourceFilename,
    });
  }

  async commitImport(previewId: string, idempotencyKey: string): Promise<CommitImportResponse> {
    return apiClient.post<CommitImportResponse>('/onboarding-imports/commit-import', {
      previewId,
      idempotencyKey,
    });
  }

  async getFamilySummary(): Promise<FamilySummaryResponse> {
    return apiClient.get<FamilySummaryResponse>('/onboarding-imports/family-summary');
  }
}

export const onboardingService = new OnboardingService();

export type AcademyReadinessReport = AcademyReadinessResponse;
export type ImportPreviewResult = ImportPreviewResponse;
export type FamilySummary = FamilySummaryResponse;
