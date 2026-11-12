import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { dbClient } from '../db/client';
import { UserRole, Permission } from '../security/rbac';
import { authenticateJWT, requirePermission } from '../middleware/auth';
import { studentAccess } from '../security/access';
import { safeErrorMessage } from '../security/errors';
import { getPaymentGatewayAdapter } from '../services/payment/gatewayRegistry';
import { SupportedPaymentMethod } from '../services/payment/types';

export const paymentGatewayRouter = Router();

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateReceiptNo(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `REC-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const MAX_RECEIPT_ATTEMPTS = 5;
function isUniqueViolation(err: any): boolean {
  return err && (err.code === '23505' || /unique/i.test(String(err.message || '')));
}

// ----------------------------------------------------------------------------
// 1. Merchant Configuration Endpoints (Tenant-Scoped)
// ----------------------------------------------------------------------------

/**
 * Public/Masked Merchant Info for a Persatuan
 * Any authenticated user in the tenant can view if online payments are active
 * Zero sensitive API keys or secrets are exposed!
 */
paymentGatewayRouter.get('/merchant/:orgId/config', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (req.user?.organizationId !== orgId && req.user?.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Tenant finance access denied.' });
    }

    const merchantRes = await dbClient.query(
      `SELECT id, organization_id, provider, merchant_name, settlement_bank_name,
              settlement_account_masked, fpx_enabled, duitnow_enabled, card_enabled, status
       FROM persatuan_merchants
       WHERE organization_id = $1`,
      [orgId]
    );

    if (merchantRes.rowCount === 0) {
      return res.json({
        configured: false,
        status: 'UNCONFIGURED',
        message: 'Online payment gateway is not configured for this Persatuan.',
      });
    }

    const m = merchantRes.rows[0];
    return res.json({
      configured: true,
      merchant: {
        id: m.id,
        organizationId: m.organization_id,
        provider: m.provider,
        merchantName: m.merchant_name,
        settlementBankName: m.settlement_bank_name,
        settlementAccountMasked: m.settlement_account_masked,
        fpxEnabled: m.fpx_enabled,
        duitnowEnabled: m.duitnow_enabled,
        cardEnabled: m.card_enabled,
        status: m.status,
      },
    });
  } catch (err: any) {
    console.error('[Merchant Config GET error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch merchant configuration.') });
  }
});

/**
 * Persatuan Admin: View and Manage own merchant configuration
 */
paymentGatewayRouter.get('/merchant/my-config', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_MERCHANT), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Caller has no affiliated organization.' });
    }

    const merchantRes = await dbClient.query(
      `SELECT id, organization_id, provider, merchant_account_id, merchant_name,
              settlement_bank_name, settlement_account_masked, fpx_enabled,
              duitnow_enabled, card_enabled, status, created_at, updated_at
       FROM persatuan_merchants
       WHERE organization_id = $1`,
      [orgId]
    );

    if (merchantRes.rowCount === 0) {
      return res.json({ configured: false, merchant: null });
    }

    return res.json({ configured: true, merchant: merchantRes.rows[0] });
  } catch (err: any) {
    console.error('[Admin Merchant Config error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch merchant settings.') });
  }
});

/**
 * Persatuan Admin: Upsert own merchant configuration
 */
paymentGatewayRouter.put('/merchant/my-config', authenticateJWT, requirePermission(Permission.PERSATUAN_MANAGE_MERCHANT), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Caller has no affiliated organization.' });
    }

    const {
      merchantAccountId,
      merchantName,
      provider = 'SANDBOX',
      settlementBankName,
      settlementAccountNumber,
      fpxEnabled = true,
      duitnowEnabled = true,
      cardEnabled = false,
      webhookSecret,
    } = req.body;

    if (!merchantAccountId || !merchantName) {
      return res.status(400).json({ error: 'merchantAccountId and merchantName are required.' });
    }

    // Mask the settlement account number strictly (show only last 4 digits)
    let maskedAccount: string | null = null;
    if (settlementAccountNumber) {
      const clean = String(settlementAccountNumber).replace(/\s+/g, '');
      maskedAccount = clean.length > 4 ? `****${clean.slice(-4)}` : '****';
    }

    // Store webhook secret hash securely (for callback signature verification)
    const secretToUse = webhookSecret ? String(webhookSecret).trim() : `sec_${orgId}_${crypto.randomBytes(8).toString('hex')}`;

    const upsertRes = await dbClient.query(
      `INSERT INTO persatuan_merchants (
         id, organization_id, provider, merchant_account_id, merchant_name,
         settlement_bank_name, settlement_account_masked, fpx_enabled, duitnow_enabled,
         card_enabled, status, webhook_secret_hash, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         merchant_account_id = EXCLUDED.merchant_account_id,
         merchant_name = EXCLUDED.merchant_name,
         settlement_bank_name = COALESCE(EXCLUDED.settlement_bank_name, persatuan_merchants.settlement_bank_name),
         settlement_account_masked = COALESCE(EXCLUDED.settlement_account_masked, persatuan_merchants.settlement_account_masked),
         fpx_enabled = EXCLUDED.fpx_enabled,
         duitnow_enabled = EXCLUDED.duitnow_enabled,
         card_enabled = EXCLUDED.card_enabled,
         status = 'ACTIVE',
         webhook_secret_hash = COALESCE(EXCLUDED.webhook_secret_hash, persatuan_merchants.webhook_secret_hash),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, organization_id, provider, merchant_account_id, merchant_name,
                 settlement_bank_name, settlement_account_masked, fpx_enabled, duitnow_enabled,
                 card_enabled, status, updated_at`,
      [
        newId('merch'),
        orgId,
        provider.toUpperCase(),
        merchantAccountId.trim(),
        merchantName.trim(),
        settlementBankName?.trim() || null,
        maskedAccount,
        Boolean(fpxEnabled),
        Boolean(duitnowEnabled),
        Boolean(cardEnabled),
        secretToUse,
      ]
    );

    await dbClient.query(
      `INSERT INTO audit_logs (id, action, details, user_role, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId('audit'),
        'Merchant Configuration Updated',
        `Persatuan ${orgId} merchant ${merchantName} configured for provider ${provider}.`,
        req.user!.role,
        req.user!.email,
      ]
    );

    return res.json({
      message: 'Persatuan merchant configuration saved.',
      merchant: upsertRes.rows[0],
      webhookSecretGenerated: webhookSecret ? undefined : secretToUse,
    });
  } catch (err: any) {
    console.error('[Merchant Config PUT error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to save merchant configuration.') });
  }
});

// ----------------------------------------------------------------------------
// 2. Server-Authoritative Payment Initiation
// ----------------------------------------------------------------------------

/**
 * Initiates an authorized online payment intent (FPX or DuitNow)
 * Server calculates exact payable amount in minor units (sen) from outstanding dues
 * Never trusts client-submitted amounts!
 */
paymentGatewayRouter.post('/intents', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { studentId, billingMonthIds, paymentMethod = 'FPX', fpxBankCode, idempotencyKey } = req.body;

    if (!studentId || !Array.isArray(billingMonthIds) || billingMonthIds.length === 0) {
      return res.status(400).json({ error: 'studentId and an array of billingMonthIds are required.' });
    }

    // 1. Authorize Payer
    const access = await studentAccess(req.user!, studentId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'You are not authorized to initiate payments for this student.' });
    }
    const student = access.student;

    // 2. Verify Persatuan Merchant Configuration
    const merchantRes = await dbClient.query(
      `SELECT * FROM persatuan_merchants WHERE organization_id = $1 AND status = 'ACTIVE'`,
      [student.organization_id]
    );
    if (merchantRes.rowCount === 0) {
      return res.status(400).json({
        error: 'Online payment gateway is not configured or active for this Persatuan. Please pay in person or via direct bank transfer.',
        code: 'GATEWAY_UNCONFIGURED',
      });
    }
    const merchant = merchantRes.rows[0];

    // Method check
    const normalizedMethod = (paymentMethod as SupportedPaymentMethod) || 'FPX';
    if (normalizedMethod === 'FPX' && !merchant.fpx_enabled) {
      return res.status(400).json({ error: 'FPX online banking is disabled by this Persatuan.' });
    }
    if (normalizedMethod === 'DUITNOW_QR' && !merchant.duitnow_enabled) {
      return res.status(400).json({ error: 'DuitNow QR payment is disabled by this Persatuan.' });
    }

    // 3. Server-Authoritative Amount Calculation (Integer Minor Units / Sen)
    const duesRes = await dbClient.query(
      `SELECT id, fee_amount, amount_paid, billing_month
       FROM monthly_dues
       WHERE id = ANY($1::text[]) AND student_id = $2 AND organization_id = $3
       ORDER BY billing_month ASC`,
      [billingMonthIds, studentId, student.organization_id]
    );

    if (duesRes.rowCount !== billingMonthIds.length) {
      return res.status(400).json({ error: 'One or more selected billing months are invalid or already paid.' });
    }

    let totalRemainingSen = 0;
    for (const d of duesRes.rows) {
      const feeSen = Math.round(Number(d.fee_amount) * 100);
      const paidSen = Math.round(Number(d.amount_paid) * 100);
      const remainingSen = Math.max(0, feeSen - paidSen);
      totalRemainingSen += remainingSen;
    }

    if (totalRemainingSen <= 0) {
      return res.status(400).json({ error: 'Selected billing month(s) have zero outstanding balance.' });
    }

    // 4. Idempotency Check
    if (idempotencyKey) {
      const existingIntent = await dbClient.query(
        `SELECT * FROM payment_intents WHERE idempotency_key = $1 AND organization_id = $2`,
        [idempotencyKey, student.organization_id]
      );
      if (existingIntent.rowCount! > 0) {
        const row = existingIntent.rows[0];
        return res.json({
          message: 'Existing payment intent returned (idempotent).',
          intent: {
            id: row.id,
            amountCents: row.amount_cents,
            amountRM: (row.amount_cents / 100).toFixed(2),
            currency: row.currency,
            status: row.status,
            providerSessionUrl: row.provider_session_url,
            providerTxId: row.provider_tx_id,
            paymentMethod: row.payment_method,
            fpxBankCode: row.fpx_bank_code,
          },
        });
      }
    }

    // 5. Create Payment Intent Row
    const intentId = newId('pi');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes window

    await dbClient.query(
      `INSERT INTO payment_intents (
         id, organization_id, merchant_id, student_id, payer_user_id,
         amount_cents, currency, billing_month_ids, payment_method, fpx_bank_code,
         status, idempotency_key, expires_at, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, 'MYR', $7, $8, $9, 'REQUIRES_PAYMENT_METHOD', $10, $11, $12)`,
      [
        intentId,
        student.organization_id,
        merchant.id,
        studentId,
        req.user!.id,
        totalRemainingSen,
        billingMonthIds,
        normalizedMethod,
        fpxBankCode || null,
        idempotencyKey || null,
        expiresAt,
        JSON.stringify({
          studentName: student.full_name,
          payerEmail: req.user!.email,
          duesCount: billingMonthIds.length,
        }),
      ]
    );

    // 6. Invoke Gateway Adapter for Session URL
    const adapter = getPaymentGatewayAdapter(merchant.provider);
    const sessionResult = await adapter.createPaymentSession(
      {
        intentId,
        amountCents: totalRemainingSen,
        currency: 'MYR',
        merchantAccountId: merchant.merchant_account_id,
        merchantName: merchant.merchant_name,
        paymentMethod: normalizedMethod,
        fpxBankCode,
        payerEmail: req.user!.email,
        payerName: (req.user as any)?.fullName || req.user!.email || 'BeltFlow Payer',
        description: `Tuition Dues (${duesRes.rows.map((d: any) => d.billing_month).join(', ')}) - ${student.full_name}`,
      },
      merchant.webhook_secret_hash || 'sandbox_secret'
    );

    // 7. Update Intent with Provider Session
    await dbClient.query(
      `UPDATE payment_intents
       SET provider_tx_id = $1, provider_session_url = $2, status = 'PENDING_PROCESSING', updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [sessionResult.providerTxId, sessionResult.providerSessionUrl, intentId]
    );

    return res.status(201).json({
      message: 'Payment intent created successfully.',
      intent: {
        id: intentId,
        amountCents: totalRemainingSen,
        amountRM: (totalRemainingSen / 100).toFixed(2),
        currency: 'MYR',
        status: 'PENDING_PROCESSING',
        providerSessionUrl: sessionResult.providerSessionUrl,
        providerTxId: sessionResult.providerTxId,
        paymentMethod: normalizedMethod,
        fpxBankCode,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Payment Intent Create error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to initiate payment session.') });
  }
});

/**
 * Get Status of a Payment Intent
 */
paymentGatewayRouter.get('/intents/:intentId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { intentId } = req.params;
    const intentRes = await dbClient.query(
      `SELECT pi.*, p.receipt_no
       FROM payment_intents pi
       LEFT JOIN payments p ON p.id = pi.settled_payment_id
       WHERE pi.id = $1`,
      [intentId]
    );

    if (intentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Payment intent not found.' });
    }

    const intent = intentRes.rows[0];
    const access = await studentAccess(req.user!, intent.student_id);
    const ownPersatuanAdmin =
      req.user!.role === UserRole.ADMIN_PERSATUAN && !!req.user!.organizationId && req.user!.organizationId === intent.organization_id;
    if (!access.allowed && !ownPersatuanAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Lazy expiry: an unpaid intent past its window is shown as EXPIRED even
    // if the background worker has not run yet. A later genuine bank success
    // webhook still settles it.
    if (['REQUIRES_PAYMENT_METHOD', 'PENDING_PROCESSING'].includes(intent.status) && new Date(intent.expires_at).getTime() <= Date.now()) {
      const expired = await dbClient.query(
        `UPDATE payment_intents SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN ('REQUIRES_PAYMENT_METHOD', 'PENDING_PROCESSING')
         RETURNING id`,
        [intent.id]
      );
      if (expired.rows.length > 0) intent.status = 'EXPIRED';
    }

    return res.json({
      intent: {
        id: intent.id,
        status: intent.status,
        amountCents: intent.amount_cents,
        amountRM: (intent.amount_cents / 100).toFixed(2),
        currency: intent.currency,
        paymentMethod: intent.payment_method,
        providerTxId: intent.provider_tx_id,
        receiptNo: intent.receipt_no,
        settledPaymentId: intent.settled_payment_id,
        expiresAt: intent.expires_at,
      },
    });
  } catch (err: any) {
    console.error('[Payment Intent GET error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch payment status.') });
  }
});

// ----------------------------------------------------------------------------
// 3. Webhook Processing (Strict Idempotency, HMAC Verification, Atomic Ledger)
// ----------------------------------------------------------------------------

/**
 * Gateway Webhook Receiver
 * Handles direct merchant notifications, verifies signatures, and executes atomic ledger settlement
 */
paymentGatewayRouter.post('/webhooks/:provider', async (req: Request, res: Response) => {
  const provider = (req.params.provider || 'SANDBOX').toUpperCase();
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const signature = (req.headers['x-beltflow-signature'] || req.headers['x-signature'] || '') as string;

  try {
    const adapter = getPaymentGatewayAdapter(provider);
    const parsedEvent = adapter.parseWebhookEvent(req.body);

    // 1. Look up Payment Intent and Merchant
    const intentRes = await dbClient.query(
      `SELECT pi.*, pm.webhook_secret_hash, pm.merchant_account_id
       FROM payment_intents pi
       JOIN persatuan_merchants pm ON pm.id = pi.merchant_id
       WHERE pi.id = $1`,
      [parsedEvent.intentId]
    );

    if (intentRes.rowCount === 0) {
      return res.status(404).json({ error: 'Referenced payment intent not found.' });
    }
    const intent = intentRes.rows[0];

    // 2. Strict HMAC Signature Verification
    const secret = intent.webhook_secret_hash || 'sandbox_secret';
    const isVerified = adapter.verifyWebhookSignature(rawBody, signature, secret);
    if (!isVerified) {
      await dbClient.query(
        `INSERT INTO gateway_webhook_events (id, provider, merchant_id, event_id, event_type, payment_intent_id, payload, signature_verified, processed, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, false, 'Invalid webhook HMAC signature')
         ON CONFLICT (provider, event_id) DO NOTHING`,
        [newId('gwh'), provider, intent.merchant_id, parsedEvent.eventId, parsedEvent.eventType, intent.id, req.body]
      );
      return res.status(401).json({ error: 'Unauthorized: Webhook signature verification failed.' });
    }

    // 3. Idempotency Check on eventId
    const existingEvent = await dbClient.query(
      `SELECT id, processed FROM gateway_webhook_events WHERE provider = $1 AND event_id = $2`,
      [provider, parsedEvent.eventId]
    );
    if (existingEvent.rowCount! > 0 && existingEvent.rows[0].processed) {
      return res.status(200).json({ message: 'Event already processed (idempotent duplicate).' });
    }

    // 4. Validate Merchant Account & Amount Integrity
    if (parsedEvent.merchantAccountId !== intent.merchant_account_id) {
      await dbClient.query(
        `INSERT INTO payment_reconciliation_records (id, organization_id, payment_intent_id, provider_tx_id, expected_amount_cents, settled_amount_cents, currency, match_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'DISCREPANCY_STATUS', 'Webhook merchant mismatch')`,
        [newId('rec'), intent.organization_id, intent.id, parsedEvent.providerTxId, intent.amount_cents, parsedEvent.amountCents, parsedEvent.currency]
      );
      return res.status(400).json({ error: 'Merchant recipient mismatch.' });
    }

    if (parsedEvent.amountCents !== intent.amount_cents || parsedEvent.currency !== intent.currency) {
      await dbClient.query(
        `INSERT INTO payment_reconciliation_records (id, organization_id, payment_intent_id, provider_tx_id, expected_amount_cents, settled_amount_cents, currency, match_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'DISCREPANCY_AMOUNT', 'Webhook amount or currency mismatch')`,
        [newId('rec'), intent.organization_id, intent.id, parsedEvent.providerTxId, intent.amount_cents, parsedEvent.amountCents, parsedEvent.currency]
      );
      return res.status(400).json({ error: 'Settlement amount mismatch.' });
    }

    // 5. ATOMIC DATABASE SETTLEMENT TRANSACTION
    if (parsedEvent.eventType === 'payment.succeeded') {
      const settlementRes = await dbClient.transaction(async (txClient) => {
        // Check if intent was already settled
        const lockRes = await txClient.query(
          `SELECT status, settled_payment_id FROM payment_intents WHERE id = $1 FOR UPDATE`,
          [intent.id]
        );
        if (lockRes.rows[0].status === 'SUCCEEDED') {
          return { alreadySettled: true, receiptNo: '', paymentId: '' };
        }

        // Generate Unique Receipt Number
        let receiptNo = '';
        let paymentRecord: any = null;
        for (let attempt = 1; attempt <= MAX_RECEIPT_ATTEMPTS; attempt++) {
          receiptNo = generateReceiptNo();
          const payId = newId('pay');
          try {
            const payRes = await txClient.query(
              `INSERT INTO payments (
                 id, organization_id, student_id, parent_id, amount, amount_cents,
                 currency, method, proof_notes, receipt_no, submitted_by, approved_by,
                 approved_at, status, billing_month_ids, is_online_gateway,
                 gateway_provider, gateway_transaction_id, payment_intent_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, 'Approved', $13, true, $14, $15, $16)
               RETURNING *`,
              [
                payId,
                intent.organization_id,
                intent.student_id,
                intent.payer_user_id,
                intent.amount_cents / 100, // Amount in RM
                intent.amount_cents,       // Minor units (sen)
                'MYR',
                intent.payment_method === 'FPX' ? 'FPX Online Banking' : 'DuitNow QR',
                `Online settlement verified via ${provider} (${parsedEvent.providerTxId})`,
                receiptNo,
                intent.payer_user_id,
                null, // Online automated settlement verified by gateway provider
                intent.billing_month_ids,
                provider,
                parsedEvent.providerTxId,
                intent.id,
              ]
            );
            paymentRecord = payRes.rows[0];
            break;
          } catch (err: any) {
            if (isUniqueViolation(err) && attempt < MAX_RECEIPT_ATTEMPTS) continue;
            throw err;
          }
        }

        // Update Payment Intent to SUCCEEDED
        await txClient.query(
          `UPDATE payment_intents
           SET status = 'SUCCEEDED', settled_payment_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [paymentRecord.id, intent.id]
        );

        // Apply Payment to Monthly Dues
        let leftAmount = intent.amount_cents / 100;
        const dues = await txClient.query(
          `SELECT id, fee_amount, amount_paid FROM monthly_dues WHERE id = ANY($1::text[]) ORDER BY billing_month ASC FOR UPDATE`,
          [intent.billing_month_ids]
        );
        for (const d of dues.rows) {
          if (leftAmount <= 0) break;
          const rem = Math.max(0, Number(d.fee_amount) - Number(d.amount_paid));
          if (rem <= 0) continue;
          const applied = Math.round(Math.min(leftAmount, rem) * 100) / 100;
          const newPaid = Math.round((Number(d.amount_paid) + applied) * 100) / 100;
          const newStatus = newPaid >= Number(d.fee_amount) ? 'Paid' : 'Partially Paid';
          await txClient.query('UPDATE monthly_dues SET amount_paid = $1, status = $2 WHERE id = $3', [newPaid, newStatus, d.id]);
          await txClient.query(
            `INSERT INTO monthly_due_payments (id, monthly_due_id, payment_id, amount_applied)
             VALUES ($1, $2, $3, $4)`,
            [newId('mdp'), d.id, paymentRecord.id, applied]
          );
          leftAmount = Math.round((leftAmount - applied) * 100) / 100;
        }

        // Update Student Billing Status
        await txClient.query(`UPDATE students SET billing_status = 'Paid' WHERE id = $1`, [intent.student_id]);

        // Record the reconciliation result. If part of the money could not be
        // applied (the dues were already paid, e.g. by a second payment for the
        // same months), flag it for the admin instead of marking it matched.
        const unappliedSen = Math.round(leftAmount * 100);
        const matchStatus = unappliedSen > 0 ? 'DISCREPANCY_AMOUNT' : 'MATCHED';
        const matchNotes = unappliedSen > 0
          ? `RM ${(unappliedSen / 100).toFixed(2)} received for dues that were already paid. Refund or credit the payer.`
          : 'Automated online settlement verified and reconciled.';
        await txClient.query(
          `INSERT INTO payment_reconciliation_records (
             id, organization_id, payment_intent_id, payment_id, provider_tx_id,
             expected_amount_cents, settled_amount_cents, currency, match_status, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            newId('rec'),
            intent.organization_id,
            intent.id,
            paymentRecord.id,
            parsedEvent.providerTxId,
            intent.amount_cents,
            parsedEvent.amountCents,
            'MYR',
            matchStatus,
            matchNotes,
          ]
        );

        // Record Webhook Event As Processed
        await txClient.query(
          `INSERT INTO gateway_webhook_events (
             id, provider, merchant_id, event_id, event_type, payment_intent_id, payload, signature_verified, processed, processed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, CURRENT_TIMESTAMP)
           ON CONFLICT (provider, event_id) DO UPDATE SET processed = true, processed_at = CURRENT_TIMESTAMP`,
          [newId('gwh'), provider, intent.merchant_id, parsedEvent.eventId, parsedEvent.eventType, intent.id, req.body]
        );

        // Queue Outbox Notification
        await txClient.query(
          `INSERT INTO notification_outbox (id, organization_id, event_type, aggregate_type, aggregate_id, payload, status)
           VALUES ($1, $2, 'PAYMENT_SETTLED', 'PAYMENT', $3, $4, 'PENDING')`,
          [
            newId('notif'),
            intent.organization_id,
            paymentRecord.id,
            JSON.stringify({
              receiptNo,
              amountRM: (intent.amount_cents / 100).toFixed(2),
              studentId: intent.student_id,
              method: intent.payment_method,
            }),
          ]
        );

        // Audit Trail
        await txClient.query(
          `INSERT INTO audit_logs (id, action, details, user_role, user_email)
           VALUES ($1, $2, $3, 'SYSTEM', 'gateway@beltflow.local')`,
          [
            newId('audit'),
            'Online Payment Settled',
            `Receipt ${receiptNo} issued for RM ${(intent.amount_cents / 100).toFixed(2)} via ${provider} (${parsedEvent.providerTxId}) for student ${intent.student_id}.`,
          ]
        );

        return {
          alreadySettled: false,
          receiptNo,
          paymentId: paymentRecord.id,
        };
      });

      if (settlementRes.alreadySettled) {
        return res.status(200).json({ message: 'Payment intent already settled.' });
      }

      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Payment settled and receipt issued.',
        receiptNo: settlementRes.receiptNo,
        paymentId: settlementRes.paymentId,
      });
    } else {
      // Payment Failed or Cancelled
      // A failure (or a late, out-of-order failure event) never overwrites a
      // settled intent: the ledger already holds the payment.
      await dbClient.query(
        `UPDATE payment_intents
         SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status <> 'SUCCEEDED'`,
        [intent.id]
      );

      await dbClient.query(
        `INSERT INTO gateway_webhook_events (
           id, provider, merchant_id, event_id, event_type, payment_intent_id, payload, signature_verified, processed, processed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, CURRENT_TIMESTAMP)
         ON CONFLICT (provider, event_id) DO UPDATE SET processed = true, processed_at = CURRENT_TIMESTAMP`,
        [newId('gwh'), provider, intent.merchant_id, parsedEvent.eventId, parsedEvent.eventType, intent.id, req.body]
      );

      return res.status(200).json({ status: 'FAILED', message: 'Payment marked as failed.' });
    }
  } catch (err: any) {
    console.error('[Webhook Processing error]', err);
    return res.status(500).json({ error: 'Webhook processing error', message: safeErrorMessage(err, 'Internal webhook handling error.') });
  }
});

// ----------------------------------------------------------------------------
// 4. Financial Reconciliation Endpoint
// ----------------------------------------------------------------------------

paymentGatewayRouter.get('/reconciliation', authenticateJWT, requirePermission(Permission.PERSATUAN_VIEW_FINANCES), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Caller has no affiliated organization.' });
    }

    const recRes = await dbClient.query(
      `SELECT r.*, pi.payment_method, p.receipt_no, s.full_name AS student_name
       FROM payment_reconciliation_records r
       JOIN payment_intents pi ON pi.id = r.payment_intent_id
       LEFT JOIN payments p ON p.id = r.payment_id
       JOIN students s ON s.id = pi.student_id
       WHERE r.organization_id = $1
       ORDER BY r.reconciled_at DESC`,
      [orgId]
    );

    return res.json({ reconciliationRecords: recRes.rows });
  } catch (err: any) {
    console.error('[Reconciliation GET error]', err);
    return res.status(500).json({ error: 'Database error', message: safeErrorMessage(err, 'Failed to fetch reconciliation records.') });
  }
});
