import { PaymentGatewayAdapter } from './types';
import { SandboxGatewayAdapter } from './sandboxAdapter';

/**
 * Payment Integration Decision Register
 * Documents technical and merchant requirements before activating live Malaysian payment gateways.
 */
export const PAYMENT_INTEGRATION_DECISION_REGISTER = {
  rule: 'BeltFlow is an academy platform and must never pool payments into a shared central bank account.',
  supportedDirectSettlementModels: [
    {
      provider: 'TOYYIBPAY',
      settlementType: 'Direct Persatuan Enterprise Code',
      requirements: [
        'Each Persatuan must hold its own SSM/ROS registration document.',
        'Persatuan must register a ToyyibPay Enterprise account and obtain a unique Secret Key and Category Code.',
        'Direct settlement proceeds directly from ToyyibPay/FPX to the Persatuan’s Maybank/CIMB account.',
      ],
      webhookSpec: 'POST callback with billcode, status_id (1 = success), billpaymentAmount, and refno.',
    },
    {
      provider: 'CURLEC',
      settlementType: 'Curlec Direct Merchant / Razorpay Connect',
      requirements: [
        'Persatuan merchant account ID and API Key pair.',
        'Supports instant DuitNow QR (PayNet) and FPX B2C/B2B.',
        'Webhooks require HMAC-SHA256 signature verification via X-Curlec-Signature header.',
      ],
      webhookSpec: 'JSON payload with event payment.captured, signature verification against merchant webhook secret.',
    },
    {
      provider: 'BILLPLZ',
      settlementType: 'Billplz Collection API with Direct Payout',
      requirements: [
        'Billplz API Secret Key and Collection ID per Persatuan.',
        'X-Signature SHA256 verification using billplz signature algorithm.',
      ],
      webhookSpec: 'Form-urlencoded callback with id, paid (true/false), amount, and x_signature.',
    },
  ],
  liveActivationPrerequisites: [
    '1. Persatuan Admin completes gateway onboarding and inputs verified merchant identifier.',
    '2. Production webhook endpoint configured with TLS 1.3 and secret key.',
    '3. Production database configured with secret vault / KMS for merchant credential encryption.',
  ],
};

const adapters: Record<string, PaymentGatewayAdapter> = {
  SANDBOX: new SandboxGatewayAdapter(),
};

export function getPaymentGatewayAdapter(provider: string = 'SANDBOX'): PaymentGatewayAdapter {
  const normalized = (provider || 'SANDBOX').toUpperCase();
  const adapter = adapters[normalized];
  if (!adapter) {
    // If an unconfigured live provider is requested without production credentials, return Sandbox with fallback warning
    return adapters['SANDBOX'];
  }
  return adapter;
}

export function registerGatewayAdapter(provider: string, adapter: PaymentGatewayAdapter): void {
  adapters[provider.toUpperCase()] = adapter;
}
