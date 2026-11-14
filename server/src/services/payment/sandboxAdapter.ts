import crypto from 'crypto';
import {
  PaymentGatewayAdapter,
  CreateSessionParams,
  PaymentSessionResult,
  ParsedWebhookEvent,
} from './types';

export class SandboxGatewayAdapter implements PaymentGatewayAdapter {
  readonly providerName = 'SANDBOX';

  async createPaymentSession(
    params: CreateSessionParams,
    merchantSecret: string
  ): Promise<PaymentSessionResult> {
    if (params.amountCents <= 0) {
      throw new Error('Payment amount must be greater than zero sen.');
    }
    if (params.currency !== 'MYR') {
      throw new Error(`Unsupported currency: ${params.currency}. Malaysian Ringgit (MYR) required.`);
    }
    if (!params.merchantAccountId) {
      throw new Error('Merchant account reference required for payment routing.');
    }

    const providerTxId = `sbx_tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const checkoutToken = crypto
      .createHmac('sha256', merchantSecret || 'sandbox_secret')
      .update(`${params.intentId}:${params.amountCents}:${providerTxId}`)
      .digest('hex');

    const providerSessionUrl = `https://sandbox-pay.beltflow.local/checkout?tx=${providerTxId}&intent=${params.intentId}&token=${checkoutToken}&merch=${encodeURIComponent(params.merchantAccountId)}`;

    return {
      providerTxId,
      providerSessionUrl,
      rawResponse: {
        status: 'SESSION_CREATED',
        providerTxId,
        checkoutToken,
        merchantAccountId: params.merchantAccountId,
        amountCents: params.amountCents,
        currency: params.currency,
        paymentMethod: params.paymentMethod,
        fpxBankCode: params.fpxBankCode,
      },
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    if (!rawBody || !signature || !secret) {
      return false;
    }
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch {
      return false;
    }
  }

  parseWebhookEvent(body: any): ParsedWebhookEvent {
    if (!body || !body.eventId || !body.intentId || !body.merchantAccountId) {
      throw new Error('Invalid webhook payload structure: missing required event fields.');
    }

    return {
      eventId: String(body.eventId),
      eventType: body.eventType === 'payment.failed' ? 'payment.failed' : 'payment.succeeded',
      intentId: String(body.intentId),
      providerTxId: String(body.providerTxId || body.eventId),
      merchantAccountId: String(body.merchantAccountId),
      amountCents: parseInt(String(body.amountCents), 10),
      currency: String(body.currency || 'MYR').toUpperCase(),
      paidAt: body.paidAt || new Date().toISOString(),
      failureReason: body.failureReason,
      metadata: body.metadata || {},
    };
  }

  async queryTransaction(providerTxId: string, merchantConfig: any): Promise<{
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
    amountCents: number;
    currency: string;
    paidAt?: string;
  }> {
    // In sandbox, deterministic query for testing
    return {
      status: 'SUCCEEDED',
      amountCents: 12000,
      currency: 'MYR',
      paidAt: new Date().toISOString(),
    };
  }

  /**
   * Helper for tests to generate a valid signed webhook payload
   */
  static generateTestWebhook(
    event: Record<string, any>,
    secret: string
  ): { rawBody: string; signature: string; payload: any } {
    const rawBody = JSON.stringify(event);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return { rawBody, signature, payload: event };
  }
}
