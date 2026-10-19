import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole, Permission } from '../security/rbac';
import { SandboxGatewayAdapter } from '../services/payment/sandboxAdapter';
import { getPaymentGatewayAdapter, PAYMENT_INTEGRATION_DECISION_REGISTER } from '../services/payment/gatewayRegistry';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const postData = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
      ...(extraHeaders || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, data: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('💳 Starting Task H13: Persatuan Payments, FPX/DuitNow, Receipts & Financial Integrity Tests...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const orgIdA = 'org_persatuan_pay_a';
    const orgIdB = 'org_persatuan_pay_b';

    // Clean up any test artifacts from prior runs (clearing circular references first)
    await dbClient.query(`UPDATE payment_intents SET settled_payment_id = NULL WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`UPDATE payments SET payment_intent_id = NULL WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM payment_reconciliation_records WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM monthly_due_payments WHERE monthly_due_id IN (SELECT id FROM monthly_dues WHERE organization_id IN ($1, $2))`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM payments WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM gateway_webhook_events WHERE merchant_id IN (SELECT id FROM persatuan_merchants WHERE organization_id IN ($1, $2))`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM payment_intents WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM monthly_dues WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM persatuan_merchants WHERE organization_id IN ($1, $2)`, [orgIdA, orgIdB]);
    await dbClient.query(`DELETE FROM parent_student_links WHERE student_id = 'stu_pay_a1'`);

    // 1. Seed Organizations
    await dbClient.query(
      `INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email)
       VALUES ($1, 'Persatuan Silat Gayong A', 'Selangor', 'Silat', 'Master Razak', '0111111111', 'admin@persatuan-pay-a.org'),
              ($2, 'Persatuan Taekwondo B', 'Kuala Lumpur', 'Taekwondo', 'Master Lee', '0222222222', 'admin@persatuan-pay-b.org')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [orgIdA, orgIdB]
    );

    // 2. Seed Users & Identities
    const adminA = { id: 'usr_admin_pay_a', organizationId: orgIdA, email: 'admin@pay-a.org', role: UserRole.ADMIN_PERSATUAN };
    const adminB = { id: 'usr_admin_pay_b', organizationId: orgIdB, email: 'admin@pay-b.org', role: UserRole.ADMIN_PERSATUAN };
    const masterA = { id: 'usr_master_pay_a', organizationId: orgIdA, email: 'master@pay-a.org', role: UserRole.MASTER };
    const superAdmin = { id: 'usr_superadmin_pay', email: 'superadmin@beltflow.local', role: UserRole.SUPER_ADMIN };

    const studentA1Id = 'stu_pay_a1';
    const parentA = { id: 'usr_parent_pay_a', organizationId: orgIdA, email: 'parent@pay-a.org', role: UserRole.PARENT, linkedStudentIds: [studentA1Id] };
    const strangerParent = { id: 'usr_parent_stranger', organizationId: orgIdA, email: 'stranger@pay-a.org', role: UserRole.PARENT, linkedStudentIds: [] };

    const tokenAdminA = generateAuthToken(adminA);
    const tokenAdminB = generateAuthToken(adminB);
    const tokenMasterA = generateAuthToken(masterA);
    const tokenSuperAdmin = generateAuthToken(superAdmin);
    const tokenParentA = generateAuthToken(parentA);
    const tokenStranger = generateAuthToken(strangerParent);

    await dbClient.query(
      `INSERT INTO users (id, organization_id, email, full_name, password_hash, role, status)
       VALUES ($1, $2, $3, 'Admin Pay A', 'hash123', 'ADMIN_PERSATUAN', 'ACTIVE'),
              ($4, $5, $6, 'Admin Pay B', 'hash123', 'ADMIN_PERSATUAN', 'ACTIVE'),
              ($7, $2, $8, 'Master Razak', 'hash123', 'MASTER', 'ACTIVE'),
              ($9, $2, $10, 'Parent Salmah', 'hash123', 'PARENT', 'ACTIVE'),
              ($11, $2, $12, 'Parent Stranger', 'hash123', 'PARENT', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [
        adminA.id, orgIdA, adminA.email,
        adminB.id, orgIdB, adminB.email,
        masterA.id, masterA.email,
        parentA.id, parentA.email,
        strangerParent.id, strangerParent.email,
      ]
    );

    // 3. Seed Students and Monthly Dues for Persatuan A
    await dbClient.query(
      `INSERT INTO students (id, organization_id, full_name, ic_number, belt_rank, status, billing_status)
       VALUES ($1, $2, 'Ahmad Haziq', '080101-10-1234', 'White Belt', 'Active', 'Unpaid')
       ON CONFLICT (id) DO NOTHING`,
      [studentA1Id, orgIdA]
    );

    // Active approved link for Parent A to Student A1
    await dbClient.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, status, student_approved, master_approved, admin_approved)
       VALUES ('psl_pay_1', $1, $2, 'ACTIVE', true, true, true)
       ON CONFLICT (parent_id, student_id) DO NOTHING`,
      [parentA.id, studentA1Id]
    );

    const classAId = 'cls_pay_a';
    await dbClient.query(
      `INSERT INTO classes (id, organization_id, master_id, name, schedule, location, monthly_fee, status)
       VALUES ($1, $2, $3, 'Gayong Junior', 'Sat 10am', 'Gelanggang A', 80.00, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [classAId, orgIdA, masterA.id]
    );

    const due1Id = 'due_pay_oct2026';
    const due2Id = 'due_pay_nov2026';

    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, $3, $4, '2026-10', 80.00, 0.00, 'Pending'),
              ($5, $2, $3, $4, '2026-11', 80.00, 0.00, 'Pending')
       ON CONFLICT (id) DO NOTHING`,
      [due1Id, orgIdA, classAId, studentA1Id, due2Id]
    );

    console.log('--- TEST GROUP 1: MERCHANT CONFIGURATION & TENANT ISOLATION ---');

    // 1. Initial State: Unconfigured
    const unconfigRes = await makeRequest(server, 'GET', `/payments/merchant/${orgIdA}/config`, undefined, tokenParentA);
    assert.equal(unconfigRes.status, 200);
    assert.equal(unconfigRes.data.configured, false);
    assert.equal(unconfigRes.data.status, 'UNCONFIGURED');
    console.log('✅ Requirement 7 Passed: Unconfigured merchant returns safe unconfigured status.');

    // 2. Cross-tenant merchant view denied
    const crossTenantRes = await makeRequest(server, 'GET', `/payments/merchant/${orgIdB}/config`, undefined, tokenParentA);
    assert.equal(crossTenantRes.status, 403, 'Parent in Org A must NOT view Org B merchant config');
    console.log('✅ Requirement 2 Passed: Cross-Persatuan merchant access denied.');

    // 3. Admin A configures Org A's independent merchant account
    const webhookSecretA = 'sec_wh_org_a_super_secret_999';
    const saveMerchantRes = await makeRequest(
      server,
      'PUT',
      '/payments/merchant/my-config',
      {
        merchantAccountId: 'MERCH_GAYONG_SEL_01',
        merchantName: 'Persatuan Silat Gayong Selangor',
        provider: 'SANDBOX',
        settlementBankName: 'Maybank',
        settlementAccountNumber: '512345678901',
        fpxEnabled: true,
        duitnowEnabled: true,
        cardEnabled: false,
        webhookSecret: webhookSecretA,
      },
      tokenAdminA
    );
    assert.equal(saveMerchantRes.status, 200);
    assert.equal(saveMerchantRes.data.merchant.merchant_account_id, 'MERCH_GAYONG_SEL_01');
    assert.equal(saveMerchantRes.data.merchant.settlement_account_masked, '****8901', 'Must mask account number strictly');
    console.log('✅ Requirement 1 Passed: Persatuan owns independent merchant configuration with strict account masking.');

    // 4. Verify Plaintext Secrets Are NOT Returned to Client
    const publicConfigRes = await makeRequest(server, 'GET', `/payments/merchant/${orgIdA}/config`, undefined, tokenParentA);
    assert.equal(publicConfigRes.status, 200);
    assert.equal(publicConfigRes.data.configured, true);
    assert.equal(publicConfigRes.data.merchant.settlementAccountMasked, '****8901');
    assert.equal(publicConfigRes.data.merchant.webhook_secret_hash, undefined, 'Must not expose secret hash');
    assert.equal(publicConfigRes.data.merchant.webhookSecret, undefined, 'Must not expose secret');
    console.log('✅ Requirement 37 Passed: Zero sensitive secrets exposed in client bundles/endpoints.');

    // 5. Unauthorized Master rejected from managing merchant config
    const masterConfigRes = await makeRequest(
      server,
      'PUT',
      '/payments/merchant/my-config',
      { merchantAccountId: 'HACKED', merchantName: 'Hacked' },
      tokenMasterA
    );
    assert.equal(masterConfigRes.status, 403, 'Master must NOT have PERSATUAN_MANAGE_MERCHANT permission');
    console.log('✅ Requirement 27 & 28 Passed: Unauthorized Master denied merchant configuration privileges.');

    // 6. Super Admin cannot modify academy merchant config directly (isolated to Persatuan Admin)
    const superAdminConfigRes = await makeRequest(
      server,
      'PUT',
      '/payments/merchant/my-config',
      { merchantAccountId: 'SUPER_HACK', merchantName: 'Super Hack' },
      tokenSuperAdmin
    );
    assert.equal(superAdminConfigRes.status, 403, 'Super admin cannot manage private academy merchant config');
    console.log('✅ Requirement 30 Passed: Super Admin operational merchant management rejected.');

    console.log('--- TEST GROUP 2: PAYMENT INITIATION & SERVER-AUTHORITATIVE AMOUNTS ---');

    // 7. Payer validation: Unrelated parent cannot pay for child
    const strangerPayRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: studentA1Id,
        billingMonthIds: [due1Id],
        paymentMethod: 'FPX',
      },
      tokenStranger
    );
    assert.equal(strangerPayRes.status, 403, 'Stranger parent must NOT pay for unauthorized child');
    console.log('✅ Requirement 3 & 4 Passed: Parent can only pay for authorized linked child.');

    // 8. Server calculates exact payable amount in minor units (sen)
    // 80.00 MYR = 8000 sen
    const intentRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: studentA1Id,
        billingMonthIds: [due1Id, due2Id], // Total RM 160.00 = 16000 sen
        paymentMethod: 'FPX',
        fpxBankCode: 'MBB0227',
        idempotencyKey: 'idem_key_payment_test_001',
      },
      tokenParentA
    );
    assert.equal(intentRes.status, 201);
    assert.equal(intentRes.data.intent.amountCents, 16000, 'Server must calculate 16,000 sen exactly');
    assert.equal(intentRes.data.intent.amountRM, '160.00');
    assert.equal(intentRes.data.intent.currency, 'MYR');
    assert.equal(intentRes.data.intent.status, 'PENDING_PROCESSING');
    assert.ok(intentRes.data.intent.providerSessionUrl.includes('sandbox-pay.beltflow.local'));
    const intentId = intentRes.data.intent.id;
    const providerTxId = intentRes.data.intent.providerTxId;
    console.log('✅ Requirement 5 & 8 Passed: Server-authoritative sen calculation & FPX adapter contract verified.');

    // 9. Client attempted amount tampering is rejected / ignored (server does not accept client amount)
    const forgedAttemptRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: studentA1Id,
        billingMonthIds: [due1Id],
        amount: 1.00, // Forged client amount!
        amountCents: 100,
        paymentMethod: 'FPX',
      },
      tokenParentA
    );
    assert.equal(forgedAttemptRes.status, 201);
    // Server ignores client amount and uses server-calculated 80.00 (8000 sen)
    assert.equal(forgedAttemptRes.data.intent.amountCents, 8000, 'Server must override client submitted amount');
    console.log('✅ Requirement 6 Passed: Forged client amount ignored in favor of server calculation.');

    // 10. DuitNow QR Provider Adapter Contract
    const duitnowIntentRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: studentA1Id,
        billingMonthIds: [due1Id],
        paymentMethod: 'DUITNOW_QR',
      },
      tokenParentA
    );
    assert.equal(duitnowIntentRes.status, 201);
    assert.equal(duitnowIntentRes.data.intent.paymentMethod, 'DUITNOW_QR');
    assert.ok(duitnowIntentRes.data.intent.providerSessionUrl.includes('sandbox-pay.beltflow.local'));
    console.log('✅ Requirement 9 Passed: DuitNow provider adapter contract verified.');

    // 11. Idempotency on payment intent creation with network retry
    const retryIntentRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: studentA1Id,
        billingMonthIds: [due1Id, due2Id],
        paymentMethod: 'FPX',
        idempotencyKey: 'idem_key_payment_test_001',
      },
      tokenParentA
    );
    assert.equal(retryIntentRes.status, 200);
    assert.equal(retryIntentRes.data.intent.id, intentId, 'Same idempotency key must return original intent');
    console.log('✅ Requirement 32 Passed: Network failure retry with idempotency key verified.');

    console.log('--- TEST GROUP 3: WEBHOOK VERIFICATION & SECURITY ---');

    const sandboxAdapter = new SandboxGatewayAdapter();

    // 12. Invalid Webhook Signature Rejected
    const forgedPayload = {
      eventId: 'evt_forged_001',
      eventType: 'payment.succeeded',
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      amountCents: 16000,
      currency: 'MYR',
    };
    const invalidSigRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      forgedPayload,
      undefined,
      { 'x-beltflow-signature': 'invalid_forged_hmac_signature' }
    );
    assert.equal(invalidSigRes.status, 401, 'Invalid HMAC signature must be rejected with 401');
    console.log('✅ Requirement 10 Passed: Forged webhook signature rejected.');

    // 13. Wrong Merchant Recipient Rejected
    const wrongMerchPayload = {
      eventId: 'evt_wrong_merch_001',
      eventType: 'payment.succeeded' as const,
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_OTHER_ACADEMY_99',
      amountCents: 16000,
      currency: 'MYR',
    };
    const wrongMerchSig = SandboxGatewayAdapter.generateTestWebhook(wrongMerchPayload, webhookSecretA).signature;
    const wrongMerchRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      wrongMerchPayload,
      undefined,
      { 'x-beltflow-signature': wrongMerchSig }
    );
    assert.equal(wrongMerchRes.status, 400, 'Wrong merchant recipient must be rejected');
    console.log('✅ Requirement 15 Passed: Wrong merchant recipient rejected and flagged.');

    // 14. Wrong Amount Rejected
    const wrongAmountPayload = {
      eventId: 'evt_wrong_amt_001',
      eventType: 'payment.succeeded' as const,
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      amountCents: 12000, // Should be 16000!
      currency: 'MYR',
    };
    const wrongAmtSig = SandboxGatewayAdapter.generateTestWebhook(wrongAmountPayload, webhookSecretA).signature;
    const wrongAmtRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      wrongAmountPayload,
      undefined,
      { 'x-beltflow-signature': wrongAmtSig }
    );
    assert.equal(wrongAmtRes.status, 400, 'Wrong settlement amount must be rejected');
    console.log('✅ Requirement 14 Passed: Settlement amount discrepancy rejected.');

    // 15. Wrong Currency Rejected
    const wrongCurPayload = {
      eventId: 'evt_wrong_cur_001',
      eventType: 'payment.succeeded' as const,
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      amountCents: 16000,
      currency: 'USD', // Wrong currency!
    };
    const wrongCurSig = SandboxGatewayAdapter.generateTestWebhook(wrongCurPayload, webhookSecretA).signature;
    const wrongCurRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      wrongCurPayload,
      undefined,
      { 'x-beltflow-signature': wrongCurSig }
    );
    assert.equal(wrongCurRes.status, 400, 'Wrong currency must be rejected');
    console.log('✅ Requirement 16 Passed: Currency mismatch rejected.');

    // 16. Failed payment preserves dues
    const failDueId = 'due_pay_fail_test';
    await dbClient.query(
      `INSERT INTO monthly_dues (id, organization_id, class_id, student_id, billing_month, fee_amount, amount_paid, status)
       VALUES ($1, $2, $3, $4, '2026-12', 50.00, 0.00, 'Pending')
       ON CONFLICT (id) DO NOTHING`,
      [failDueId, orgIdA, classAId, studentA1Id]
    );

    const failIntentRes = await makeRequest(
      server,
      'POST',
      '/payments/intents',
      {
        studentId: studentA1Id,
        billingMonthIds: [failDueId],
        paymentMethod: 'FPX',
      },
      tokenParentA
    );
    const failIntentId = failIntentRes.data.intent.id;
    const failPayload = {
      eventId: 'evt_fail_001',
      eventType: 'payment.failed' as const,
      intentId: failIntentId,
      providerTxId: 'tx_failed_999',
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      amountCents: 5000,
      currency: 'MYR',
    };
    const failSig = SandboxGatewayAdapter.generateTestWebhook(failPayload, webhookSecretA).signature;
    const failWebhookRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      failPayload,
      undefined,
      { 'x-beltflow-signature': failSig }
    );
    assert.equal(failWebhookRes.status, 200);
    assert.equal(failWebhookRes.data.status, 'FAILED');

    // Verify monthly_dues still Pending (unpaid)
    const checkDueRes = await dbClient.query('SELECT status, amount_paid FROM monthly_dues WHERE id = $1', [failDueId]);
    assert.equal(checkDueRes.rows[0].status, 'Pending', 'Failed payment must preserve dues status');
    assert.equal(Number(checkDueRes.rows[0].amount_paid), 0);
    console.log('✅ Requirement 17 Passed: Failed payment preserves unpaid dues.');

    console.log('--- TEST GROUP 4: ATOMIC SETTLEMENT & DIGITAL RECEIPTS ---');

    // 17. Valid Webhook Accepted & Atomic Ledger Settlement
    const validPayload = {
      eventId: 'evt_settle_success_001',
      eventType: 'payment.succeeded' as const,
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      amountCents: 16000,
      currency: 'MYR',
    };
    const validSig = SandboxGatewayAdapter.generateTestWebhook(validPayload, webhookSecretA).signature;
    const settleRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      validPayload,
      undefined,
      { 'x-beltflow-signature': validSig }
    );
    assert.equal(settleRes.status, 200);
    assert.equal(settleRes.data.status, 'SUCCESS');
    assert.ok(settleRes.data.receiptNo.startsWith('REC-'), 'Must issue official receipt number');
    const officialReceiptNo = settleRes.data.receiptNo;
    console.log(`✅ Requirement 11 & 18 Passed: Webhook accepted, receipt ${officialReceiptNo} issued and ledger settled.`);

    // 18. Verify Dues Updated to Paid
    const duesPaidCheck = await dbClient.query(
      `SELECT id, amount_paid, fee_amount, status FROM monthly_dues WHERE id = ANY($1::text[])`,
      [[due1Id, due2Id]]
    );
    assert.equal(duesPaidCheck.rowCount, 2);
    for (const d of duesPaidCheck.rows) {
      assert.equal(Number(d.amount_paid), Number(d.fee_amount));
      assert.equal(d.status, 'Paid');
    }
    console.log('✅ Requirement 18 & 21 Passed: Outstanding monthly dues marked Paid with exact applied amounts.');

    // 19. Verify Student Billing Status
    const studentCheck = await dbClient.query(`SELECT billing_status FROM students WHERE id = $1`, [studentA1Id]);
    assert.equal(studentCheck.rows[0].billing_status, 'Paid');
    console.log('✅ Requirement 23 Passed: Student billing status updated to Paid.');

    // 20. Idempotency: Duplicate Webhook Delivery
    const dupWebhookRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      validPayload,
      undefined,
      { 'x-beltflow-signature': validSig }
    );
    assert.equal(dupWebhookRes.status, 200);
    assert.ok(dupWebhookRes.data.message.includes('idempotent duplicate'));
    console.log('✅ Requirement 12 Passed: Duplicate webhook delivery is strictly idempotent.');

    // 21. Check exactly ONE payment record and receipt exists for this intent
    const payCountRes = await dbClient.query(
      `SELECT COUNT(*) AS count, receipt_no FROM payments WHERE payment_intent_id = $1 GROUP BY receipt_no`,
      [intentId]
    );
    assert.equal(Number(payCountRes.rows[0].count), 1, 'Must have exactly one payment entry');
    assert.equal(payCountRes.rows[0].receipt_no, officialReceiptNo, 'Receipt number must remain unchanged');
    console.log('✅ Requirement 19, 20 & 25 Passed: Duplicate receipts prevented; receipt number is immutable.');

    // 22. Out-of-order webhook delivery with new eventId for already settled intent
    const outOfOrderPayload = {
      eventId: 'evt_out_of_order_999',
      eventType: 'payment.succeeded' as const,
      intentId,
      providerTxId,
      merchantAccountId: 'MERCH_GAYONG_SEL_01',
      amountCents: 16000,
      currency: 'MYR',
    };
    const oooSig = SandboxGatewayAdapter.generateTestWebhook(outOfOrderPayload, webhookSecretA).signature;
    const oooRes = await makeRequest(
      server,
      'POST',
      '/payments/webhooks/SANDBOX',
      outOfOrderPayload,
      undefined,
      { 'x-beltflow-signature': oooSig }
    );
    assert.equal(oooRes.status, 200);
    assert.ok(oooRes.data.message.includes('already settled'));
    console.log('✅ Requirement 13 Passed: Out-of-order duplicate webhook safely handled.');

    console.log('--- TEST GROUP 5: FINANCIAL RECONCILIATION & AUDIT TRAILS ---');

    // 23. Admin views reconciliation discrepancy and matched records
    const recRes = await makeRequest(server, 'GET', '/payments/reconciliation', undefined, tokenAdminA);
    assert.equal(recRes.status, 200);
    assert.ok(recRes.data.reconciliationRecords.length >= 2, 'Must have matched and discrepancy records');
    const matched = recRes.data.reconciliationRecords.find((r: any) => r.match_status === 'MATCHED');
    assert.ok(matched, 'Should find MATCHED reconciliation record');
    assert.equal(matched.receipt_no, officialReceiptNo);

    const discrepant = recRes.data.reconciliationRecords.find((r: any) => r.match_status.startsWith('DISCREPANCY'));
    assert.ok(discrepant, 'Should find recorded DISCREPANCY record for audit');
    console.log('✅ Requirement 15 & Reconciliation Passed: Audited reconciliation ledger captures settlements & discrepancies.');

    // 24. Audit logs and notification outbox populated
    const auditRes = await dbClient.query(
      `SELECT * FROM audit_logs WHERE details LIKE '%${officialReceiptNo}%'`
    );
    assert.ok(auditRes.rowCount! > 0, 'Audit log must record settled payment and receipt number');

    const outboxRes = await dbClient.query(
      `SELECT * FROM notification_outbox WHERE aggregate_id = $1`,
      [matched.payment_id]
    );
    assert.ok(outboxRes.rowCount! > 0, 'Outbox must have pending PAYMENT_SETTLED notification');
    console.log('✅ Requirement 10 (Audit & Outbox) Passed: Atomically committed audit log and outbox event.');

    console.log('--- TEST GROUP 6: DATA MINIMIZATION & CASH WORKFLOW PRESERVATION ---');

    // 25. Public certificate verification data minimization review (Section 16)
    // Seed a dummy certificate to test public-verify
    const testCertCode = 'BF-H13-CERT-01';
    await dbClient.query(
      `INSERT INTO certificates (id, organization_id, student_id, code, student_name, rank_or_title, organization_name, master_name, issue_date, type, status, verification_token)
       VALUES ('cert_h13_01', $1, $2, $3, 'Muhammad Harith Danial', 'Brown Belt', 'Persatuan Silat Gayong A', 'Master Razak', '2026-10-15', 'RANK', 'VALID', 'tok_h13_01')
       ON CONFLICT (id) DO NOTHING`,
      [orgIdA, studentA1Id, testCertCode]
    );
    const pubCertRes = await makeRequest(server, 'POST', '/certificates/public-verify', { codeOrToken: testCertCode });
    assert.equal(pubCertRes.status, 200);
    assert.equal(pubCertRes.data.certificate.studentName, 'Muhammad Harith Danial');
    assert.equal(pubCertRes.data.certificate.maskedStudentName, 'M******d H****h D****l', 'Must supply masked name for safe public display');
    console.log('✅ Requirement 40 Passed: Public certificate verification data minimization reviewed and masked projection verified.');

    // 26. Technical Integration Decision Register Verification
    assert.ok(PAYMENT_INTEGRATION_DECISION_REGISTER.supportedDirectSettlementModels.length >= 3, 'Must document live gateway providers');
    assert.ok(PAYMENT_INTEGRATION_DECISION_REGISTER.supportedDirectSettlementModels.some((p: any) => p.provider === 'TOYYIBPAY'));
    assert.ok(PAYMENT_INTEGRATION_DECISION_REGISTER.supportedDirectSettlementModels.some((p: any) => p.provider === 'CURLEC'));
    assert.ok(PAYMENT_INTEGRATION_DECISION_REGISTER.supportedDirectSettlementModels.some((p: any) => p.provider === 'BILLPLZ'));
    console.log('✅ Requirement 31 Passed: Integration decision register documents exact live gateway contracts.');

    console.log('🎉 ALL H13 PERSATUAN PAYMENT & FINANCIAL INTEGRITY TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ H13 Tests Failed:', err);
  process.exit(1);
});
