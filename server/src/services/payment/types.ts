/**
 * BeltFlow Payment Gateway & Merchant Integration Types (Task H13)
 * Enforces provider-neutral payment processing with integer minor currency units (sen)
 */

export type SupportedPaymentMethod = 'FPX' | 'DUITNOW_QR' | 'CARD';
export type PaymentIntentStatus =
  | 'REQUIRES_PAYMENT_METHOD'
  | 'PENDING_PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type MerchantStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface CreateSessionParams {
  intentId: string;
  amountCents: number; // Integer sen (e.g. 12000 for RM 120.00)
  currency: string;    // 'MYR'
  merchantAccountId: string;
  merchantName: string;
  paymentMethod: SupportedPaymentMethod;
  fpxBankCode?: string;
  payerEmail: string;
  payerName: string;
  description: string;
  returnUrl?: string;
  callbackUrl?: string;
}

export interface PaymentSessionResult {
  providerTxId: string;
  providerSessionUrl: string;
  rawResponse: any;
}

export interface ParsedWebhookEvent {
  eventId: string;
  eventType: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled';
  intentId: string;
  providerTxId: string;
  merchantAccountId: string;
  amountCents: number;
  currency: string;
  paidAt?: string;
  failureReason?: string;
  metadata?: any;
}

export interface PaymentGatewayAdapter {
  readonly providerName: string;
  createPaymentSession(params: CreateSessionParams, merchantSecret: string): Promise<PaymentSessionResult>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
  parseWebhookEvent(body: any): ParsedWebhookEvent;
  queryTransaction(providerTxId: string, merchantConfig: any): Promise<{
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
    amountCents: number;
    currency: string;
    paidAt?: string;
  }>;
}

export interface PersatuanMerchantPublicInfo {
  organizationId: string;
  merchantName: string;
  provider: string;
  status: MerchantStatus;
  fpxEnabled: boolean;
  duitnowEnabled: boolean;
  cardEnabled: boolean;
  settlementBankName?: string;
  settlementAccountMasked?: string;
}
