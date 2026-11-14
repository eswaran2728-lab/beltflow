import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import { dbClient } from '../db/client';
import { generateAuthToken } from '../security/crypto';
import { UserRole } from '../security/rbac';

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; rawBody: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: resData, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🥋 Starting Task H25: Equipment and Merchandise (commerce/inventory) Acceptance Tests...');
  await dbClient.init();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const timestamp = Date.now();
    const org1Id = `org_h25_a_${timestamp}`;
    const org2Id = `org_h25_b_${timestamp}`;

    // 1. Seed Organizations
    await dbClient.query(`
      INSERT INTO organizations (id, name, state, martial_art_style, master_name, phone, email, status)
      VALUES 
        ('${org1Id}', 'Selangor Silambam Academy A', 'Selangor', 'Silambam', 'Master Pandian', '0123456789', 'org_a_${timestamp}@h25.test', 'ACTIVE'),
        ('${org2Id}', 'Perak Martial Arts Academy B', 'Perak', 'Silambam', 'Master Kumar', '0198765432', 'org_b_${timestamp}@h25.test', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Seed Users
    const adminOrg1Id = `usr_adm1_${timestamp}`;
    const adminOrg2Id = `usr_adm2_${timestamp}`;
    const buyer1Org1Id = `usr_buy1_${timestamp}`;
    const buyer2Org1Id = `usr_buy2_${timestamp}`;
    const buyerOrg2Id = `usr_buy_b_${timestamp}`;

    const usersToInsert = [
      { id: adminOrg1Id, email: `adm1_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, orgId: org1Id },
      { id: adminOrg2Id, email: `adm2_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, orgId: org2Id },
      { id: buyer1Org1Id, email: `buy1_${timestamp}@test.com`, role: UserRole.STUDENT, orgId: org1Id },
      { id: buyer2Org1Id, email: `buy2_${timestamp}@test.com`, role: UserRole.PARENT, orgId: org1Id },
      { id: buyerOrg2Id, email: `buy_b_${timestamp}@test.com`, role: UserRole.STUDENT, orgId: org2Id },
    ];

    for (const u of usersToInsert) {
      await dbClient.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, organization_id, status)
         VALUES ($1, $2, 'hash', $2, $3, $4, 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
        [u.id, u.email, u.role, u.orgId]
      );
    }

    const tokenAdminOrg1 = generateAuthToken({ id: adminOrg1Id, email: `adm1_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: org1Id });
    const tokenAdminOrg2 = generateAuthToken({ id: adminOrg2Id, email: `adm2_${timestamp}@test.com`, role: UserRole.ADMIN_PERSATUAN, organizationId: org2Id });
    const tokenBuyer1 = generateAuthToken({ id: buyer1Org1Id, email: `buy1_${timestamp}@test.com`, role: UserRole.STUDENT, organizationId: org1Id });
    const tokenBuyer2 = generateAuthToken({ id: buyer2Org1Id, email: `buy2_${timestamp}@test.com`, role: UserRole.PARENT, organizationId: org1Id });
    const tokenBuyerOrg2 = generateAuthToken({ id: buyerOrg2Id, email: `buy_b_${timestamp}@test.com`, role: UserRole.STUDENT, organizationId: org2Id });

    // 3. Admin creates products:
    // Product 1: Silambam Rattan Cane Staff (Limited: exactly 1 in stock for race test)
    const staffRes = await makeRequest(server, 'POST', '/commerce/products', {
      organizationId: org1Id,
      name: 'Competition Silambam Rattan Staff',
      sku: 'SIL-STF-001',
      category: 'WEAPON',
      description: 'Standard seasoned rattan staff for tournament combat',
      price: 65.00,
      stockQuantity: 1
    }, tokenAdminOrg1);
    assert.strictEqual(staffRes.status, 201);
    const productStaffId = staffRes.data.product.id;
    assert.strictEqual(staffRes.data.product.stock_quantity, 1);
    assert.strictEqual(staffRes.data.product.available_quantity, 1);

    // Product 2: Persatuan Uniform Dobok (Stock: 10)
    const uniformRes = await makeRequest(server, 'POST', '/commerce/products', {
      organizationId: org1Id,
      name: 'Traditional Silambam Uniform',
      sku: 'SIL-UNI-002',
      category: 'UNIFORM',
      description: 'Durable breathable martial arts uniform',
      price: 120.00,
      stockQuantity: 10
    }, tokenAdminOrg1);
    assert.strictEqual(uniformRes.status, 201);
    const productUniformId = uniformRes.data.product.id;

    // =========================================================================
    // Test 1: Official Criterion: last_item_race_one_reservation
    // Atomic stock reservation ensures only one buyer reserves the last item
    // under concurrent race conditions.
    // =========================================================================
    console.log('\n--- Test 1: last_item_race_one_reservation ---');

    // Create Order A by Buyer 1 for the 1 remaining staff
    const orderARes = await makeRequest(server, 'POST', '/commerce/orders', {
      organizationId: org1Id,
      items: [{ productId: productStaffId, quantity: 1 }]
    }, tokenBuyer1);
    assert.strictEqual(orderARes.status, 201);
    const orderAId = orderARes.data.order.id;

    // Create Order B by Buyer 2 for the same 1 remaining staff
    const orderBRes = await makeRequest(server, 'POST', '/commerce/orders', {
      organizationId: org1Id,
      items: [{ productId: productStaffId, quantity: 1 }]
    }, tokenBuyer2);
    assert.strictEqual(orderBRes.status, 201);
    const orderBId = orderBRes.data.order.id;

    // Execute concurrent reservations
    const [reserveA, reserveB] = await Promise.all([
      makeRequest(server, 'POST', `/commerce/orders/${orderAId}/reserve`, {}, tokenBuyer1),
      makeRequest(server, 'POST', `/commerce/orders/${orderBId}/reserve`, {}, tokenBuyer2)
    ]);

    const statuses = [reserveA.status, reserveB.status].sort();
    assert.deepStrictEqual(statuses, [200, 409], 'Exactly one reservation must succeed (200) and one must conflict (409)');

    const winnerRes = reserveA.status === 200 ? reserveA : reserveB;
    const loserRes = reserveA.status === 409 ? reserveA : reserveB;
    const winningOrderId = reserveA.status === 200 ? orderAId : orderBId;

    assert.strictEqual(winnerRes.data.criterion, 'last_item_race_one_reservation');
    assert.strictEqual(winnerRes.data.order.status, 'RESERVED');
    assert.strictEqual(loserRes.data.criterion, 'last_item_race_one_reservation');
    assert.strictEqual(loserRes.data.errorCode, 'INSUFFICIENT_STOCK');

    // Verify database row values
    const staffCheck = await dbClient.query('SELECT stock_quantity, reserved_quantity FROM products WHERE id = $1', [productStaffId]);
    assert.strictEqual(parseInt(staffCheck.rows[0].stock_quantity, 10), 1);
    assert.strictEqual(parseInt(staffCheck.rows[0].reserved_quantity, 10), 1, 'Reserved quantity must be exactly 1');

    console.log('✅ Criterion 1 (last_item_race_one_reservation) PASSED.');

    // =========================================================================
    // Test 2: Official Criterion: late_payment_no_negative_stock
    // Late payment on expired reservation must NOT produce negative stock;
    // triggers automated refund/reversal instead.
    // =========================================================================
    console.log('\n--- Test 2: late_payment_no_negative_stock ---');

    // Create Order C for Uniform with quantity 1
    const orderCRes = await makeRequest(server, 'POST', '/commerce/orders', {
      organizationId: org1Id,
      items: [{ productId: productUniformId, quantity: 1 }]
    }, tokenBuyer1);
    assert.strictEqual(orderCRes.status, 201);
    const orderCId = orderCRes.data.order.id;

    // Reserve Order C
    const reserveC = await makeRequest(server, 'POST', `/commerce/orders/${orderCId}/reserve`, {}, tokenBuyer1);
    assert.strictEqual(reserveC.status, 200);

    // Simulate scenario: reservation expired and remaining inventory is exhausted (0 available)
    // Reduce uniform stock to 0 to simulate total stock depletion during expired window
    await dbClient.query('UPDATE products SET stock_quantity = 0, reserved_quantity = 0 WHERE id = $1', [productUniformId]);

    // Late payment event arrives for Order C
    const latePayRes = await makeRequest(server, 'POST', `/commerce/orders/${orderCId}/confirm-payment`, {
      paymentId: `pay_late_${timestamp}`,
      amount: 120.00,
      method: 'FPX',
      forceExpired: true
    }, tokenBuyer1);

    // Must return 422 with late_payment_no_negative_stock and automated refund
    assert.strictEqual(latePayRes.status, 422);
    assert.strictEqual(latePayRes.data.criterion, 'late_payment_no_negative_stock');
    assert.strictEqual(latePayRes.data.status, 'PAYMENT_LATE_UNFULFILLED');
    assert.strictEqual(latePayRes.data.refunded, true);

    // Verify stock did NOT become negative in database
    const uniformCheck = await dbClient.query('SELECT stock_quantity FROM products WHERE id = $1', [productUniformId]);
    const finalStock = parseInt(uniformCheck.rows[0].stock_quantity, 10);
    assert.ok(finalStock >= 0, `Stock must never be negative, was: ${finalStock}`);
    assert.strictEqual(finalStock, 0);

    // Verify automated refund recorded in shared ledger
    const payCheck = await dbClient.query('SELECT status, receipt_no FROM payments WHERE id = $1', [`pay_late_${timestamp}`]);
    assert.strictEqual(payCheck.rows[0].status, 'Refunded');
    assert.ok(payCheck.rows[0].receipt_no.startsWith('REF-LATE-'));

    console.log('✅ Criterion 2 (late_payment_no_negative_stock) PASSED.');

    // =========================================================================
    // Test 3: Official Criterion: refund_restock_policy_explicit
    // Refunds require an explicit restock policy (RESTOCK_INVENTORY vs
    // DAMAGED_DISCARD / NO_RESTOCK) and audit movements accordingly.
    // =========================================================================
    console.log('\n--- Test 3: refund_restock_policy_explicit ---');

    // Restock uniform to 5 for test
    await makeRequest(server, 'POST', `/commerce/products/${productUniformId}/restock`, {
      quantity: 5,
      reason: 'Replenish stock for refund test'
    }, tokenAdminOrg1);

    // Create and pay for Order D (quantity 2)
    const orderDRes = await makeRequest(server, 'POST', '/commerce/orders', {
      organizationId: org1Id,
      items: [{ productId: productUniformId, quantity: 2 }]
    }, tokenBuyer1);
    const orderDId = orderDRes.data.order.id;

    await makeRequest(server, 'POST', `/commerce/orders/${orderDId}/reserve`, {}, tokenBuyer1);
    const payDRes = await makeRequest(server, 'POST', `/commerce/orders/${orderDId}/confirm-payment`, {
      paymentId: `pay_d_${timestamp}`,
      amount: 240.00,
      method: 'DuitNow QR'
    }, tokenBuyer1);
    assert.strictEqual(payDRes.status, 200);

    // Stock should now be 5 - 2 = 3
    const stockAfterPurchase = await dbClient.query('SELECT stock_quantity FROM products WHERE id = $1', [productUniformId]);
    assert.strictEqual(parseInt(stockAfterPurchase.rows[0].stock_quantity, 10), 3);

    // 3A: Attempt refund WITHOUT explicit restock policy -> Must be rejected with 400
    const invalidRefund = await makeRequest(server, 'POST', `/commerce/orders/${orderDId}/refund`, {
      reason: 'Missing policy test'
    }, tokenAdminOrg1);
    assert.strictEqual(invalidRefund.status, 400);
    assert.strictEqual(invalidRefund.data.criterion, 'refund_restock_policy_explicit');
    assert.ok(invalidRefund.data.error.includes('Explicit restock policy is required'));

    // 3B: Process refund with RESTOCK_INVENTORY -> Stock increments back to 5
    const restockRefund = await makeRequest(server, 'POST', `/commerce/orders/${orderDId}/refund`, {
      restockPolicy: 'RESTOCK_INVENTORY',
      reason: 'Wrong size; item returned in original condition'
    }, tokenAdminOrg1);
    assert.strictEqual(restockRefund.status, 200);
    assert.strictEqual(restockRefund.data.criterion, 'refund_restock_policy_explicit');
    assert.strictEqual(restockRefund.data.order.status, 'REFUNDED');
    assert.strictEqual(restockRefund.data.restockPolicy, 'RESTOCK_INVENTORY');

    const stockAfterRestock = await dbClient.query('SELECT stock_quantity FROM products WHERE id = $1', [productUniformId]);
    assert.strictEqual(parseInt(stockAfterRestock.rows[0].stock_quantity, 10), 5, 'Inventory must be restored on RESTOCK_INVENTORY');

    // Verify stock movement record
    const restockMove = await dbClient.query(
      "SELECT movement_type, quantity, restock_policy FROM stock_movements WHERE order_id = $1 AND movement_type = 'REFUND_RESTOCK'",
      [orderDId]
    );
    assert.strictEqual(restockMove.rowCount, 1);
    assert.strictEqual(restockMove.rows[0].movement_type, 'REFUND_RESTOCK');
    assert.strictEqual(restockMove.rows[0].quantity, 2);

    // 3C: Process another order and refund with DAMAGED_DISCARD -> Stock NOT restored
    const orderERes = await makeRequest(server, 'POST', '/commerce/orders', {
      organizationId: org1Id,
      items: [{ productId: productUniformId, quantity: 1 }]
    }, tokenBuyer1);
    const orderEId = orderERes.data.order.id;
    await makeRequest(server, 'POST', `/commerce/orders/${orderEId}/reserve`, {}, tokenBuyer1);
    await makeRequest(server, 'POST', `/commerce/orders/${orderEId}/confirm-payment`, {
      paymentId: `pay_e_${timestamp}`,
      amount: 120.00
    }, tokenBuyer1);

    // Stock is now 5 - 1 = 4
    const stockPreDiscard = await dbClient.query('SELECT stock_quantity FROM products WHERE id = $1', [productUniformId]);
    assert.strictEqual(parseInt(stockPreDiscard.rows[0].stock_quantity, 10), 4);

    const discardRefund = await makeRequest(server, 'POST', `/commerce/orders/${orderEId}/refund`, {
      restockPolicy: 'DAMAGED_DISCARD',
      reason: 'Torn collar during shipping; discarded'
    }, tokenAdminOrg1);
    assert.strictEqual(discardRefund.status, 200);
    assert.strictEqual(discardRefund.data.criterion, 'refund_restock_policy_explicit');

    // Stock must STILL be 4 (not restored)
    const stockPostDiscard = await dbClient.query('SELECT stock_quantity FROM products WHERE id = $1', [productUniformId]);
    assert.strictEqual(parseInt(stockPostDiscard.rows[0].stock_quantity, 10), 4, 'DAMAGED_DISCARD must not restore inventory');

    const discardMove = await dbClient.query(
      "SELECT movement_type, quantity, restock_policy FROM stock_movements WHERE order_id = $1 AND movement_type = 'DAMAGED_DISCARD'",
      [orderEId]
    );
    assert.strictEqual(discardMove.rowCount, 1);
    assert.strictEqual(discardMove.rows[0].movement_type, 'DAMAGED_DISCARD');

    console.log('✅ Criterion 3 (refund_restock_policy_explicit) PASSED.');

    // =========================================================================
    // Test 4: Official Criterion: cross_tenant_order_denied
    // Strict tenant isolation; cross-tenant orders, inventory views, and
    // mutations are rejected (403 Forbidden).
    // =========================================================================
    console.log('\n--- Test 4: cross_tenant_order_denied ---');

    // Buyer from Org 2 attempts to view Org 1 catalog
    const crossCatalog = await makeRequest(server, 'GET', `/commerce/products?organizationId=${org1Id}`, null, tokenBuyerOrg2);
    assert.strictEqual(crossCatalog.status, 403);
    assert.strictEqual(crossCatalog.data.criterion, 'cross_tenant_order_denied');

    // Buyer from Org 2 attempts to create an order targeting Org 1
    const crossOrder = await makeRequest(server, 'POST', '/commerce/orders', {
      organizationId: org1Id,
      items: [{ productId: productUniformId, quantity: 1 }]
    }, tokenBuyerOrg2);
    assert.strictEqual(crossOrder.status, 403);
    assert.strictEqual(crossOrder.data.criterion, 'cross_tenant_order_denied');

    // Buyer from Org 2 attempts to reserve winning Order A in Org 1
    const crossReserve = await makeRequest(server, 'POST', `/commerce/orders/${winningOrderId}/reserve`, {}, tokenBuyerOrg2);
    assert.strictEqual(crossReserve.status, 403);
    assert.strictEqual(crossReserve.data.criterion, 'cross_tenant_order_denied');

    // Buyer from Org 2 attempts to confirm payment on Org 1 order
    const crossConfirm = await makeRequest(server, 'POST', `/commerce/orders/${winningOrderId}/confirm-payment`, {
      paymentId: 'cross_pay'
    }, tokenBuyerOrg2);
    assert.strictEqual(crossConfirm.status, 403);
    assert.strictEqual(crossConfirm.data.criterion, 'cross_tenant_order_denied');

    // Admin from Org 2 attempts to refund Org 1 order -> strictly 403 cross_tenant_order_denied
    const crossRefund = await makeRequest(server, 'POST', `/commerce/orders/${orderDId}/refund`, {
      restockPolicy: 'RESTOCK_INVENTORY'
    }, tokenAdminOrg2);
    assert.strictEqual(crossRefund.status, 403);
    assert.strictEqual(crossRefund.data.criterion, 'cross_tenant_order_denied');

    console.log('✅ Criterion 4 (cross_tenant_order_denied) PASSED.');

    console.log('\n🎉 ALL 4 OFFICIAL H25 COMMERCE & INVENTORY ACCEPTANCE CRITERIA PASSED WITHOUT REGRESSION!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ H25 Acceptance Tests Failed:', err);
      process.exit(1);
    });
}

export { runTests as runH25Tests };
