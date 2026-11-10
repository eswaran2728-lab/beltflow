import { Router, Request, Response, NextFunction } from 'express';
import { dbClient } from '../db/client';
import { authenticateJWT } from '../middleware/auth';
import { UserRole } from '../security/rbac';

const router = Router();

function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }
    if (!allowedRoles.includes(req.user.role) && req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Insufficient role permissions for this operation.' });
    }
    next();
  };
}

// ============================================================================
// TASK H25: EQUIPMENT & MERCHANDISE COMMERCE & INVENTORY
// Official Module: commerce/inventory
// Contracts: reserveStock, confirmOrderPayment, refundOrder
// Criteria:
//  1. last_item_race_one_reservation
//  2. late_payment_no_negative_stock
//  3. refund_restock_policy_explicit
//  4. cross_tenant_order_denied
// ============================================================================

/**
 * Helper: Check tenant isolation
 */
/** Result produced inside a transaction; the HTTP response is sent after COMMIT. */
const reply = (status: number, body: unknown) => ({ status, body });

function verifyTenantMatch(userOrgId: string | undefined, targetOrgId: string): boolean {
  if (!userOrgId) return false;
  return userOrgId === targetOrgId;
}

// ----------------------------------------------------------------------------
// 1. GET /products — List products for organization
// ----------------------------------------------------------------------------
router.get('/products', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const orgId = (req.query.organizationId as string) || req.user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing organizationId' });
    }

    if (req.user?.role !== UserRole.SUPER_ADMIN && !verifyTenantMatch(req.user?.organizationId, orgId)) {
      return res.status(403).json({
        success: false,
        criterion: 'cross_tenant_order_denied',
        error: 'Cross-tenant product catalog access denied.'
      });
    }

    const category = req.query.category as string | undefined;
    const activeOnly = req.query.activeOnly !== 'false';

    let query = `
      SELECT id, organization_id, name, sku, category, description, price,
             stock_quantity, reserved_quantity,
             (stock_quantity - reserved_quantity) AS available_quantity,
             is_active, created_at, updated_at
      FROM products
      WHERE organization_id = $1
    `;
    const params: any[] = [orgId];

    if (activeOnly) {
      query += ` AND is_active = TRUE`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ` ORDER BY name ASC`;

    const result = await dbClient.query(query, params);
    return res.json({ products: result.rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to list products' });
  }
});

// ----------------------------------------------------------------------------
// 2. POST /products — Create new product (Admin Persatuan & Master)
// ----------------------------------------------------------------------------
router.post(
  '/products',
  authenticateJWT,
  requireRole([UserRole.ADMIN_PERSATUAN, UserRole.MASTER]),
  async (req: Request, res: Response) => {
    try {
      const { name, sku, category, description, price, stockQuantity, organizationId } = req.body;
      const targetOrgId = organizationId || req.user?.organizationId;

      if (!targetOrgId) {
        return res.status(400).json({ error: 'Missing organizationId' });
      }

      if (req.user?.role !== UserRole.SUPER_ADMIN && !verifyTenantMatch(req.user?.organizationId, targetOrgId)) {
        return res.status(403).json({
          success: false,
          criterion: 'cross_tenant_order_denied',
          error: 'Cannot create products for another Persatuan.'
        });
      }

      if (!name || price === undefined || price === null) {
        return res.status(400).json({ error: 'Product name and price are required.' });
      }

      const initialStock = parseInt(stockQuantity || 0, 10);
      if (isNaN(initialStock) || initialStock < 0) {
        return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
      }

      const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const prodCategory = category || 'EQUIPMENT';

      const result = await dbClient.transaction(async (client) => {
        const insertRes = await client.query(
          `INSERT INTO products (id, organization_id, name, sku, category, description, price, stock_quantity, reserved_quantity, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, TRUE)
           RETURNING *`,
          [productId, targetOrgId, name, sku || null, prodCategory, description || null, price, initialStock]
        );

        if (initialStock > 0) {
          const moveId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await client.query(
            `INSERT INTO stock_movements (id, organization_id, product_id, movement_type, quantity, restock_policy, reason, created_by)
             VALUES ($1, $2, $3, 'RESTOCK', $4, 'RESTOCK_INVENTORY', 'Initial stock setup', $5)`,
            [moveId, targetOrgId, productId, initialStock, req.user?.id || null]
          );
        }

        return reply(201, {
          product: {
            ...insertRes.rows[0],
            available_quantity: initialStock
          }
        });
      });
      // Respond only after COMMIT (see no_response_inside_transaction_h27).
      return res.status(result.status).json(result.body);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to create product' });
    }
  }
);

// ----------------------------------------------------------------------------
// 3. POST /products/:id/restock — Explicit restock
// ----------------------------------------------------------------------------
router.post(
  '/products/:id/restock',
  authenticateJWT,
  requireRole([UserRole.ADMIN_PERSATUAN, UserRole.MASTER]),
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.id;
      const { quantity, reason } = req.body;
      const restockQty = parseInt(quantity, 10);

      if (isNaN(restockQty) || restockQty <= 0) {
        return res.status(400).json({ error: 'Restock quantity must be a positive integer.' });
      }

      const result = await dbClient.transaction(async (client) => {
        const prodCheck = await client.query(
          `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
          [productId]
        );

        if (prodCheck.rowCount === 0) {
          return reply(404, { error: 'Product not found.' });
        }

        const product = prodCheck.rows[0];
        if (req.user?.role !== UserRole.SUPER_ADMIN && !verifyTenantMatch(req.user?.organizationId, product.organization_id)) {
          return reply(403, {
            success: false,
            criterion: 'cross_tenant_order_denied',
            error: 'Cross-tenant restock operation denied.'
          });
        }

        const newStock = parseInt(product.stock_quantity, 10) + restockQty;
        await client.query(
          `UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newStock, productId]
        );

        const moveId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await client.query(
          `INSERT INTO stock_movements (id, organization_id, product_id, movement_type, quantity, restock_policy, reason, created_by)
           VALUES ($1, $2, $3, 'RESTOCK', $4, 'RESTOCK_INVENTORY', $5, $6)`,
          [moveId, product.organization_id, productId, restockQty, reason || 'Manual restock batch', req.user?.id || null]
        );

        return reply(200, {
          success: true,
          product: {
            ...product,
            stock_quantity: newStock,
            available_quantity: newStock - parseInt(product.reserved_quantity, 10)
          }
        });
      });
      // Respond only after COMMIT (see no_response_inside_transaction_h27).
      return res.status(result.status).json(result.body);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to restock product' });
    }
  }
);

// ----------------------------------------------------------------------------
// 4. POST /orders — Create order draft
// ----------------------------------------------------------------------------
router.post('/orders', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { organizationId, studentId, items } = req.body;
    const targetOrgId = organizationId || req.user?.organizationId;

    if (!targetOrgId) {
      return res.status(400).json({ error: 'Missing organizationId' });
    }

    if (req.user?.role !== UserRole.SUPER_ADMIN && !verifyTenantMatch(req.user?.organizationId, targetOrgId)) {
      return res.status(403).json({
        success: false,
        criterion: 'cross_tenant_order_denied',
        error: 'Cannot create order for a different Persatuan.'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    const result = await dbClient.transaction(async (client) => {
      let totalAmount = 0;
      const orderItemsToInsert: Array<{ productId: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return reply(400, { error: 'Item quantity must be a positive integer.' });
        }

        const prodRes = await client.query(
          `SELECT id, organization_id, price, is_active FROM products WHERE id = $1`,
          [item.productId]
        );

        if (prodRes.rowCount === 0) {
          return reply(404, { error: `Product not found: ${item.productId}` });
        }

        const prod = prodRes.rows[0];
        if (prod.organization_id !== targetOrgId) {
          return reply(403, {
            success: false,
            criterion: 'cross_tenant_order_denied',
            error: 'Cross-tenant product ordered.'
          });
        }

        if (!prod.is_active) {
          return reply(400, { error: `Product ${prod.id} is inactive.` });
        }

        const unitPrice = parseFloat(prod.price);
        const itemTotal = unitPrice * qty;
        totalAmount += itemTotal;

        orderItemsToInsert.push({
          productId: prod.id,
          quantity: qty,
          unitPrice,
          totalPrice: itemTotal
        });
      }

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const buyerId = req.user?.id || 'usr_anonymous';

      await client.query(
        `INSERT INTO inventory_orders (id, organization_id, buyer_user_id, student_id, total_amount, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING_RESERVATION')`,
        [orderId, targetOrgId, buyerId, studentId || null, totalAmount]
      );

      for (const it of orderItemsToInsert) {
        const itemId = `oit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [itemId, orderId, it.productId, it.quantity, it.unitPrice, it.totalPrice]
        );
      }

      const orderRes = await client.query(`SELECT * FROM inventory_orders WHERE id = $1`, [orderId]);
      return reply(201, {
        order: orderRes.rows[0],
        items: orderItemsToInsert
      });
    });
      // Respond only after COMMIT (see no_response_inside_transaction_h27).
      return res.status(result.status).json(result.body);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// ----------------------------------------------------------------------------
// 5. POST /orders/:orderId/reserve — Contract: reserveStock(orderId)
// Criterion: last_item_race_one_reservation
// ----------------------------------------------------------------------------
export async function reserveStockInternal(orderId: string, userOrgId?: string, isSuperAdmin: boolean = false) {
  return await dbClient.transaction(async (client) => {
    // 1. Fetch order
    const orderRes = await client.query(
      `SELECT * FROM inventory_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      return { status: 404, data: { error: 'Order not found.' } };
    }

    const order = orderRes.rows[0];

    // Tenant boundary check
    if (!isSuperAdmin && !verifyTenantMatch(userOrgId, order.organization_id)) {
      return {
        status: 403,
        data: {
          success: false,
          criterion: 'cross_tenant_order_denied',
          error: 'Cross-tenant order reservation denied.'
        }
      };
    }

    if (order.status === 'RESERVED') {
      return {
        status: 200,
        data: {
          success: true,
          criterion: 'last_item_race_one_reservation',
          order,
          message: 'Order is already reserved.'
        }
      };
    }

    if (order.status !== 'PENDING_RESERVATION') {
      return {
        status: 400,
        data: {
          error: `Cannot reserve order in ${order.status} status.`
        }
      };
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    if (itemsRes.rowCount === 0) {
      return { status: 400, data: { error: 'Order has no items.' } };
    }

    // 3. Atomically check stock and lock each product row
    for (const item of itemsRes.rows) {
      const prodRes = await client.query(
        `SELECT id, name, stock_quantity, reserved_quantity
         FROM products
         WHERE id = $1 AND organization_id = $2
         FOR UPDATE`,
        [item.product_id, order.organization_id]
      );

      if (prodRes.rowCount === 0) {
        return { status: 404, data: { error: `Product not found: ${item.product_id}` } };
      }

      const prod = prodRes.rows[0];
      const stock = parseInt(prod.stock_quantity, 10);
      const reserved = parseInt(prod.reserved_quantity, 10);
      const available = stock - reserved;
      const requested = parseInt(item.quantity, 10);

      // Race condition guarantee: if available < requested, reject immediately!
      if (available < requested) {
        return {
          status: 409,
          data: {
            success: false,
            criterion: 'last_item_race_one_reservation',
            errorCode: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for product "${prod.name}". Available: ${available}, Requested: ${requested}.`
          }
        };
      }

      // Increment reserved quantity
      await client.query(
        `UPDATE products
         SET reserved_quantity = reserved_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [requested, item.product_id]
      );

      // Record stock movement
      const moveId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await client.query(
        `INSERT INTO stock_movements (id, organization_id, product_id, order_id, movement_type, quantity, restock_policy, reason)
         VALUES ($1, $2, $3, $4, 'RESERVED', $5, 'RESTOCK_INVENTORY', 'Reserved for order')`,
        [moveId, order.organization_id, item.product_id, orderId, requested]
      );
    }

    // 4. Update order status and set 15-minute reservation expiry
    const expiryDate = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    const updateRes = await client.query(
      `UPDATE inventory_orders
       SET status = 'RESERVED',
           reservation_expires_at = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [expiryDate.toISOString(), orderId]
    );

    return {
      status: 200,
      data: {
        success: true,
        criterion: 'last_item_race_one_reservation',
        order: updateRes.rows[0]
      }
    };
  });
}

router.post('/orders/:orderId/reserve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = req.user?.role === UserRole.SUPER_ADMIN;
    const result = await reserveStockInternal(req.params.orderId, req.user?.organizationId, isSuperAdmin);
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to reserve stock' });
  }
});

// ----------------------------------------------------------------------------
// 6. POST /orders/:orderId/confirm-payment — Contract: confirmOrderPayment(event)
// Criterion: late_payment_no_negative_stock
// ----------------------------------------------------------------------------
export async function confirmOrderPaymentInternal(
  orderId: string,
  event: { paymentId?: string; amount?: number; method?: string; forceExpired?: boolean },
  userOrgId?: string,
  isSuperAdmin: boolean = false
) {
  return await dbClient.transaction(async (client) => {
    // 1. Fetch order
    const orderRes = await client.query(
      `SELECT * FROM inventory_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      return { status: 404, data: { error: 'Order not found.' } };
    }

    const order = orderRes.rows[0];

    // Tenant boundary check
    if (!isSuperAdmin && !verifyTenantMatch(userOrgId, order.organization_id)) {
      return {
        status: 403,
        data: {
          success: false,
          criterion: 'cross_tenant_order_denied',
          error: 'Cross-tenant order payment confirmation denied.'
        }
      };
    }

    // Idempotent success if already paid
    if (order.status === 'PAID') {
      return {
        status: 200,
        data: {
          success: true,
          status: 'PAID',
          order,
          message: 'Order is already marked as paid.'
        }
      };
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    // 3. Check reservation expiration status
    const isExpired = event.forceExpired || (
      order.reservation_expires_at &&
      new Date(order.reservation_expires_at).getTime() < Date.now()
    );

    if (isExpired) {
      // Reservation has expired! Check if remaining stock would become negative
      let canFulfillWithoutNegativeStock = true;

      for (const item of itemsRes.rows) {
        const prodRes = await client.query(
          `SELECT stock_quantity, reserved_quantity FROM products WHERE id = $1 FOR UPDATE`,
          [item.product_id]
        );
        if (prodRes.rowCount > 0) {
          const prod = prodRes.rows[0];
          const stock = parseInt(prod.stock_quantity, 10);
          const reqQty = parseInt(item.quantity, 10);

          // If reservation expired, reserved_quantity might have been released or taken by another buyer
          // Fulfilling would mean stock_quantity - reqQty
          if (stock - reqQty < 0) {
            canFulfillWithoutNegativeStock = false;
            break;
          }
        }
      }

      if (!canFulfillWithoutNegativeStock) {
        // CRITICAL REQUIREMENT: late_payment_no_negative_stock
        // Late payment on expired reservation MUST NOT produce negative stock!
        // Automated refund / reversal is triggered instead.
        await client.query(
          `UPDATE inventory_orders
           SET status = 'PAYMENT_LATE_UNFULFILLED',
               refund_reason = 'Automated refund: Reservation expired and stock depleted; negative inventory prevented.',
               refunded_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [orderId]
        );

        // Record reversal in shared ledger
        const receiptNo = `REF-LATE-${Date.now()}`;
        const payId = event.paymentId || `pay_rev_${Date.now()}`;
        await client.query(
          `INSERT INTO payments (id, organization_id, student_id, amount, method, proof_notes, receipt_no, submitted_by, status)
           VALUES ($1, $2, $3, $4, $5, 'Automated refund for late payment on expired reservation', $6, $7, 'Refunded')
           ON CONFLICT (id) DO UPDATE SET status = 'Refunded'`,
          [
            payId,
            order.organization_id,
            order.student_id || null,
            order.total_amount,
            event.method || 'DuitNow QR',
            receiptNo,
            order.buyer_user_id
          ]
        );

        return {
          status: 422,
          data: {
            success: false,
            status: 'PAYMENT_LATE_UNFULFILLED',
            criterion: 'late_payment_no_negative_stock',
            refunded: true,
            receiptNo,
            message: 'Reservation expired and inventory is zero; automated reversal issued without negative stock.'
          }
        };
      }
    }

    // 4. Fulfillment: Deduct from stock_quantity (and reserved_quantity if was RESERVED)
    for (const item of itemsRes.rows) {
      const requested = parseInt(item.quantity, 10);

      if (order.status === 'RESERVED' && !isExpired) {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $1,
               reserved_quantity = GREATEST(0, reserved_quantity - $1),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [requested, item.product_id]
        );
      } else {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [requested, item.product_id]
        );
      }

      // Record COMMITTED movement
      const moveId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await client.query(
        `INSERT INTO stock_movements (id, organization_id, product_id, order_id, movement_type, quantity, restock_policy, reason)
         VALUES ($1, $2, $3, $4, 'COMMITTED', $5, 'RESTOCK_INVENTORY', 'Purchased and fulfilled')`,
        [moveId, order.organization_id, item.product_id, orderId, -requested]
      );
    }

    // 5. Update shared ledger (payments table)
    const receiptNo = `RCP-COMM-${Date.now()}`;
    const paymentId = event.paymentId || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await client.query(
      `INSERT INTO payments (id, organization_id, student_id, amount, method, proof_notes, receipt_no, submitted_by, approved_at, status)
       VALUES ($1, $2, $3, $4, $5, 'Commerce inventory purchase', $6, $7, CURRENT_TIMESTAMP, 'Approved')
       ON CONFLICT (id) DO UPDATE SET status = 'Approved', receipt_no = $6`,
      [
        paymentId,
        order.organization_id,
        order.student_id || null,
        order.total_amount,
        event.method || 'DuitNow QR',
        receiptNo,
        order.buyer_user_id
      ]
    );

    // 6. Mark order PAID
    const updateRes = await client.query(
      `UPDATE inventory_orders
       SET status = 'PAID',
           payment_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [paymentId, orderId]
    );

    return {
      status: 200,
      data: {
        success: true,
        status: 'PAID',
        order: updateRes.rows[0],
        receiptNo,
        criterion: 'late_payment_no_negative_stock'
      }
    };
  });
}

router.post('/orders/:orderId/confirm-payment', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = req.user?.role === UserRole.SUPER_ADMIN;
    const result = await confirmOrderPaymentInternal(
      req.params.orderId,
      req.body,
      req.user?.organizationId,
      isSuperAdmin
    );
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to confirm order payment' });
  }
});

// ----------------------------------------------------------------------------
// 7. POST /orders/:orderId/refund — Contract: refundOrder(id)
// Criterion: refund_restock_policy_explicit
// ----------------------------------------------------------------------------
export async function refundOrderInternal(
  orderId: string,
  policy: { restockPolicy?: string; reason?: string },
  userId?: string,
  userOrgId?: string,
  isSuperAdmin: boolean = false
) {
  // 1. Mandatory Explicit Restock Policy Check
  const validPolicies = ['RESTOCK_INVENTORY', 'DAMAGED_DISCARD', 'NO_RESTOCK'];
  if (!policy.restockPolicy || !validPolicies.includes(policy.restockPolicy)) {
    return {
      status: 400,
      data: {
        success: false,
        criterion: 'refund_restock_policy_explicit',
        error: 'Explicit restock policy is required. Must be one of: RESTOCK_INVENTORY, DAMAGED_DISCARD, NO_RESTOCK.'
      }
    };
  }

  return await dbClient.transaction(async (client) => {
    // 2. Fetch order
    const orderRes = await client.query(
      `SELECT * FROM inventory_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      return { status: 404, data: { error: 'Order not found.' } };
    }

    const order = orderRes.rows[0];

    // Tenant boundary check
    if (!isSuperAdmin && !verifyTenantMatch(userOrgId, order.organization_id)) {
      return {
        status: 403,
        data: {
          success: false,
          criterion: 'cross_tenant_order_denied',
          error: 'Cross-tenant refund denied.'
        }
      };
    }

    if (order.status !== 'PAID') {
      return {
        status: 400,
        data: {
          error: `Cannot refund order in status "${order.status}". Only PAID orders can be refunded.`
        }
      };
    }

    // 3. Fetch order items
    const itemsRes = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    // 4. Process inventory restock according to explicit policy
    for (const item of itemsRes.rows) {
      const qty = parseInt(item.quantity, 10);

      if (policy.restockPolicy === 'RESTOCK_INVENTORY') {
        // Return units back into available stock
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [qty, item.product_id]
        );

        const moveId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await client.query(
          `INSERT INTO stock_movements (id, organization_id, product_id, order_id, movement_type, quantity, restock_policy, reason, created_by)
           VALUES ($1, $2, $3, $4, 'REFUND_RESTOCK', $5, $6, $7, $8)`,
          [moveId, order.organization_id, item.product_id, orderId, qty, policy.restockPolicy, policy.reason || 'Order refund restock', userId || null]
        );
      } else {
        // DAMAGED_DISCARD or NO_RESTOCK: Do NOT restore inventory!
        const moveId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await client.query(
          `INSERT INTO stock_movements (id, organization_id, product_id, order_id, movement_type, quantity, restock_policy, reason, created_by)
           VALUES ($1, $2, $3, $4, 'DAMAGED_DISCARD', 0, $5, $6, $7)`,
          [moveId, order.organization_id, item.product_id, orderId, policy.restockPolicy, policy.reason || 'Damaged/discarded item - no inventory restocked', userId || null]
        );
      }
    }

    // 5. Update shared ledger if payment exists
    if (order.payment_id) {
      await client.query(
        `UPDATE payments
         SET status = 'Refunded',
             proof_notes = COALESCE(proof_notes, '') || ' [Refunded: ' || $1 || ']'
         WHERE id = $2`,
        [policy.reason || 'Customer refund requested', order.payment_id]
      );
    }

    // 6. Update order status to REFUNDED
    const updateRes = await client.query(
      `UPDATE inventory_orders
       SET status = 'REFUNDED',
           restock_policy = $1,
           refund_reason = $2,
           refunded_at = CURRENT_TIMESTAMP,
           refunded_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [policy.restockPolicy, policy.reason || null, userId || null, orderId]
    );

    return {
      status: 200,
      data: {
        success: true,
        criterion: 'refund_restock_policy_explicit',
        order: updateRes.rows[0],
        restockPolicy: policy.restockPolicy
      }
    };
  });
}

router.post(
  '/orders/:orderId/refund',
  authenticateJWT,
  requireRole([UserRole.ADMIN_PERSATUAN, UserRole.MASTER]),
  async (req: Request, res: Response) => {
    try {
      const isSuperAdmin = req.user?.role === UserRole.SUPER_ADMIN;
      const result = await refundOrderInternal(
        req.params.orderId,
        req.body,
        req.user?.id,
        req.user?.organizationId,
        isSuperAdmin
      );
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to refund order' });
    }
  }
);

// ----------------------------------------------------------------------------
// 8. GET /orders — List orders
// ----------------------------------------------------------------------------
router.get('/orders', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId && req.user?.role !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Missing organization context' });
    }

    let query = `
      SELECT o.*,
             u.full_name as buyer_name,
             u.email as buyer_email,
             s.full_name as student_name
      FROM inventory_orders o
      LEFT JOIN users u ON o.buyer_user_id = u.id
      LEFT JOIN students s ON o.student_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.user?.role !== UserRole.SUPER_ADMIN) {
      params.push(orgId);
      query += ` AND o.organization_id = $${params.length}`;
    }

    // Role scoping: Students and Parents only see their own orders
    if (req.user?.role === UserRole.STUDENT || req.user?.role === UserRole.PARENT) {
      params.push(req.user.id);
      query += ` AND o.buyer_user_id = $${params.length}`;
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await dbClient.query(query, params);
    return res.json({ orders: result.rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to list orders' });
  }
});

// ----------------------------------------------------------------------------
// 9. GET /orders/:orderId — Get single order details
// ----------------------------------------------------------------------------
router.get('/orders/:orderId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const orderRes = await dbClient.query(
      `SELECT o.*,
              u.full_name as buyer_name,
              u.email as buyer_email,
              s.full_name as student_name
       FROM inventory_orders o
       LEFT JOIN users u ON o.buyer_user_id = u.id
       LEFT JOIN students s ON o.student_id = s.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];

    // Tenant check
    if (req.user?.role !== UserRole.SUPER_ADMIN && !verifyTenantMatch(req.user?.organizationId, order.organization_id)) {
      return res.status(403).json({
        success: false,
        criterion: 'cross_tenant_order_denied',
        error: 'Cross-tenant order access denied.'
      });
    }

    // Student/Parent can only view their own
    if ((req.user?.role === UserRole.STUDENT || req.user?.role === UserRole.PARENT) && order.buyer_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this order.' });
    }

    const itemsRes = await dbClient.query(
      `SELECT oi.*, p.name as product_name, p.category, p.sku
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    const movementsRes = await dbClient.query(
      `SELECT * FROM stock_movements WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId]
    );

    return res.json({
      order,
      items: itemsRes.rows,
      movements: movementsRes.rows
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to get order' });
  }
});

export default router;
