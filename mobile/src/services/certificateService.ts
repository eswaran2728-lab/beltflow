import { apiClient } from './apiClient';

export interface VerifiedCertificate {
  code: string;
  studentName: string;
  rankOrTitle: string;
  organizationName: string;
  masterName: string;
  issueDate: string;
  type: string;
}

export interface CertificateVerificationResponse {
  verified: boolean;
  certificate: VerifiedCertificate;
}

export const certificateService = {
  /**
   * Verifies an official belt grading / martial arts certificate code
   * against POST /api/v1/certificates/verify
   */
  async verifyCertificate(code: string): Promise<CertificateVerificationResponse> {
    if (!code || !code.trim()) {
      throw new Error('Certificate code is required for verification.');
    }

    return await apiClient.post<CertificateVerificationResponse>(
      '/api/v1/certificates/verify',
      { code: code.trim().toUpperCase() },
      { requiresAuth: false } // Attempt verification call
    );
  },
};
