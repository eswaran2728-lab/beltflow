import { apiClient } from './apiClient';

export interface MaskedMerchantConfig {
  id: string;
  organizationId: string;
  provider: string;
  merchantName: string;
  settlementBankName: string | null;
  settlementAccountMasked: string | null;
  fpxEnabled: boolean;
  duitnowEnabled: boolean;
  cardEnabled: boolean;
  status: string;
}

export interface PublicMerchantConfigResponse {
  configured: boolean;
  merchant?: MaskedMerchantConfig;
  status?: string;
  message?: string;
}

export interface AdminMerchantConfig {
  id: string;
  organization_id: string;
  provider: string;
  merchant_account_id: string;
  merchant_name: string;
  settlement_bank_name: string | null;
  settlement_account_masked: string | null;
  fpx_enabled: boolean;
  duitnow_enabled: boolean;
  card_enabled: boolean;
  status: string;
}

export interface CreatePaymentIntentParams {
  studentId: string;
  billingMonthIds: string[];
  paymentMethod: 'FPX' | 'DUITNOW_QR';
  fpxBankCode?: string;
  idempotencyKey?: string;
}

export interface PaymentIntentDetails {
  id: string;
  amountCents: number;
  amountRM: string;
  currency: string;
  status: 'REQUIRES_PAYMENT_METHOD' | 'PENDING_PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  providerSessionUrl: string;
  providerTxId: string;
  paymentMethod: string;
  fpxBankCode?: string;
  receiptNo?: string;
  settledPaymentId?: string;
  expiresAt?: string;
}

export interface ReconciliationRecord {
  id: string;
  organization_id: string;
  payment_intent_id: string;
  payment_id?: string;
  provider_tx_id: string;
  expected_amount_cents: number;
  settled_amount_cents: number;
  currency: string;
  match_status: 'MATCHED' | 'DISCREPANCY_AMOUNT' | 'DISCREPANCY_STATUS' | 'MANUAL_REVIEW_REQUIRED';
  notes?: string;
  reconciled_at: string;
  receipt_no?: string;
  student_name: string;
  payment_method: string;
}

export const MALAYSIAN_FPX_BANKS = [
  { code: 'MBB0227', name: 'Maybank2u / Maybank' },
  { code: 'BCBB0235', name: 'CIMB Clicks' },
  { code: 'PBB0233', name: 'Public Bank Online' },
  { code: 'RHB0218', name: 'RHB Now' },
  { code: 'HLB0224', name: 'Hong Leong Connect' },
  { code: 'AMBB0209', name: 'AmOnline' },
  { code: 'BIMB0340', name: 'Bank Islam' },
  { code: 'BMMB0341', name: 'Bank Muamalat' },
  { code: 'BSN0601', name: 'BSN (Bank Simpanan Nasional)' },
  { code: 'ABB0233', name: 'Affin Bank' },
  { code: 'UOB0226', name: 'UOB Bank' },
  { code: 'OCBC0229', name: 'OCBC Bank' },
];

export const paymentGatewayService = {
  /**
   * Fetches public/masked merchant configuration for a Persatuan.
   * Safe to call from mobile client - contains zero API secrets.
   */
  async getMerchantConfig(orgId: string): Promise<PublicMerchantConfigResponse> {
    return apiClient.get<PublicMerchantConfigResponse>(`/payments/merchant/${orgId}/config`);
  },

  /**
   * Persatuan Admin: Fetch private academy merchant settings
   */
  async getAdminMerchantConfig(): Promise<{ configured: boolean; merchant: AdminMerchantConfig | null }> {
    return apiClient.get<{ configured: boolean; merchant: AdminMerchantConfig | null }>('/payments/merchant/my-config');
  },

  /**
   * Persatuan Admin: Upsert merchant credentials
   */
  async saveAdminMerchantConfig(data: {
    merchantAccountId: string;
    merchantName: string;
    provider?: string;
    settlementBankName?: string;
    settlementAccountNumber?: string;
    fpxEnabled?: boolean;
    duitnowEnabled?: boolean;
    webhookSecret?: string;
  }): Promise<{ message: string; merchant: AdminMerchantConfig; webhookSecretGenerated?: string }> {
    return apiClient.put('/payments/merchant/my-config', data);
  },

  /**
   * Payer: Initiates a server-authoritative payment intent
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<{ message: string; intent: PaymentIntentDetails }> {
    return apiClient.post<{ message: string; intent: PaymentIntentDetails }>('/payments/intents', params);
  },

  /**
   * Polls or retrieves current status of a payment intent
   */
  async getPaymentIntent(intentId: string): Promise<{ intent: PaymentIntentDetails }> {
    return apiClient.get<{ intent: PaymentIntentDetails }>(`/payments/intents/${intentId}`);
  },

  /**
   * Persatuan Admin: Fetch financial reconciliation records
   */
  async getReconciliationRecords(): Promise<{ reconciliationRecords: ReconciliationRecord[] }> {
    return apiClient.get<{ reconciliationRecords: ReconciliationRecord[] }>('/payments/reconciliation');
  },
};
