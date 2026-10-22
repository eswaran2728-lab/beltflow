import { commerceService } from '../services/commerceService';
import { apiClient } from '../services/apiClient';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

describe('Task H25: Equipment and Merchandise (commerce/inventory) Mobile Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Product Catalog & Inventory
  // =========================================================================
  describe('Product Catalog & Inventory Operations', () => {
    test('getProducts fetches product catalog with available_quantity computed', async () => {
      const mockProductsResponse = {
        products: [
          {
            id: 'prod_cane_01',
            organization_id: 'org_selangor',
            name: 'Silambam Rattan Cane',
            category: 'WEAPON',
            price: 65.0,
            stock_quantity: 10,
            reserved_quantity: 2,
            available_quantity: 8,
            is_active: true,
            created_at: '2026-10-21T00:00:00.000Z',
          },
        ],
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockProductsResponse);

      const res = await commerceService.getProducts({ organizationId: 'org_selangor', activeOnly: true });
      expect(apiClient.get).toHaveBeenCalledWith('/commerce/products?organizationId=org_selangor&activeOnly=true');
      expect(res.products).toHaveLength(1);
      expect(res.products[0].available_quantity).toBe(8);
    });

    test('createProduct allows staff to register new merchandise', async () => {
      const mockCreated = {
        product: {
          id: 'prod_uniform_02',
          organization_id: 'org_selangor',
          name: 'Silambam Traditional Uniform',
          category: 'UNIFORM',
          price: 120.0,
          stock_quantity: 25,
          reserved_quantity: 0,
          available_quantity: 25,
          is_active: true,
          created_at: '2026-10-21T00:00:00.000Z',
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockCreated);

      const res = await commerceService.createProduct({
        organizationId: 'org_selangor',
        name: 'Silambam Traditional Uniform',
        category: 'UNIFORM',
        price: 120.0,
        stockQuantity: 25,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/commerce/products', {
        organizationId: 'org_selangor',
        name: 'Silambam Traditional Uniform',
        category: 'UNIFORM',
        price: 120.0,
        stockQuantity: 25,
      });
      expect(res.product.id).toBe('prod_uniform_02');
    });

    test('restockProduct records audit batch and replenishes inventory', async () => {
      const mockRestockRes = {
        success: true,
        product: {
          id: 'prod_cane_01',
          stock_quantity: 20,
          available_quantity: 18,
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockRestockRes);

      const res = await commerceService.restockProduct('prod_cane_01', 10, 'Seasonal bulk restock');
      expect(apiClient.post).toHaveBeenCalledWith('/commerce/products/prod_cane_01/restock', {
        quantity: 10,
        reason: 'Seasonal bulk restock',
      });
      expect(res.success).toBe(true);
      expect(res.product.stock_quantity).toBe(20);
    });
  });

  // =========================================================================
  // Criterion 1: last_item_race_one_reservation
  // =========================================================================
  describe('Criterion 1: last_item_race_one_reservation', () => {
    test('reserveStock atomically reserves last item and returns 200 with criterion', async () => {
      const mockReserveSuccess = {
        success: true,
        criterion: 'last_item_race_one_reservation',
        order: {
          id: 'ord_race_winner',
          organization_id: 'org_selangor',
          status: 'RESERVED',
          reservation_expires_at: '2026-10-21T00:15:00.000Z',
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockReserveSuccess);

      const res = await commerceService.reserveStock('ord_race_winner');
      expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/ord_race_winner/reserve', {});
      expect(res.success).toBe(true);
      expect(res.criterion).toBe('last_item_race_one_reservation');
      expect(res.order.status).toBe('RESERVED');
    });

    test('reserveStock propagates 409 conflict when competing buyer already reserved the last item', async () => {
      const conflictError = {
        response: {
          status: 409,
          data: {
            success: false,
            criterion: 'last_item_race_one_reservation',
            errorCode: 'INSUFFICIENT_STOCK',
            message: 'Insufficient stock available to fulfill reservation request.',
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(conflictError);

      await expect(commerceService.reserveStock('ord_race_loser')).rejects.toEqual(conflictError);
    });
  });

  // =========================================================================
  // Criterion 2: late_payment_no_negative_stock
  // =========================================================================
  describe('Criterion 2: late_payment_no_negative_stock', () => {
    test('confirmOrderPayment commits fulfillment when reservation is unexpired', async () => {
      const mockPaidSuccess = {
        success: true,
        status: 'PAID',
        criterion: 'late_payment_no_negative_stock',
        receiptNo: 'RCP-COMM-98765',
        order: {
          id: 'ord_valid_pay',
          status: 'PAID',
          payment_id: 'pay_123',
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockPaidSuccess);

      const res = await commerceService.confirmOrderPayment('ord_valid_pay', {
        paymentId: 'pay_123',
        amount: 65.0,
        method: 'DuitNow QR',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/ord_valid_pay/confirm-payment', {
        paymentId: 'pay_123',
        amount: 65.0,
        method: 'DuitNow QR',
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe('PAID');
      expect(res.receiptNo).toBe('RCP-COMM-98765');
    });

    test('confirmOrderPayment handles expired reservation with depleted stock by issuing automated refund without negative stock', async () => {
      const mockLateRefund = {
        success: false,
        status: 'PAYMENT_LATE_UNFULFILLED',
        criterion: 'late_payment_no_negative_stock',
        refunded: true,
        receiptNo: 'REF-LATE-12345',
        message: 'Reservation expired and inventory is zero; automated reversal issued without negative stock.',
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockLateRefund);

      const res = await commerceService.confirmOrderPayment('ord_expired_pay', {
        paymentId: 'pay_late_evt',
        amount: 120.0,
        forceExpired: true,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('PAYMENT_LATE_UNFULFILLED');
      expect(res.criterion).toBe('late_payment_no_negative_stock');
      expect(res.refunded).toBe(true);
      expect(res.receiptNo).toBe('REF-LATE-12345');
    });
  });

  // =========================================================================
  // Criterion 3: refund_restock_policy_explicit
  // =========================================================================
  describe('Criterion 3: refund_restock_policy_explicit', () => {
    test('refundOrder succeeds with explicit RESTOCK_INVENTORY policy', async () => {
      const mockRestockRefund = {
        success: true,
        criterion: 'refund_restock_policy_explicit',
        restockPolicy: 'RESTOCK_INVENTORY',
        order: {
          id: 'ord_refund_01',
          status: 'REFUNDED',
          restock_policy: 'RESTOCK_INVENTORY',
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockRestockRefund);

      const res = await commerceService.refundOrder('ord_refund_01', {
        restockPolicy: 'RESTOCK_INVENTORY',
        reason: 'Customer requested size exchange',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/ord_refund_01/refund', {
        restockPolicy: 'RESTOCK_INVENTORY',
        reason: 'Customer requested size exchange',
      });
      expect(res.success).toBe(true);
      expect(res.restockPolicy).toBe('RESTOCK_INVENTORY');
      expect(res.order.status).toBe('REFUNDED');
    });

    test('refundOrder succeeds with explicit DAMAGED_DISCARD policy without restoring stock', async () => {
      const mockDiscardRefund = {
        success: true,
        criterion: 'refund_restock_policy_explicit',
        restockPolicy: 'DAMAGED_DISCARD',
        order: {
          id: 'ord_refund_02',
          status: 'REFUNDED',
          restock_policy: 'DAMAGED_DISCARD',
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockDiscardRefund);

      const res = await commerceService.refundOrder('ord_refund_02', {
        restockPolicy: 'DAMAGED_DISCARD',
        reason: 'Item arrived broken; written off as damaged',
      });

      expect(res.success).toBe(true);
      expect(res.restockPolicy).toBe('DAMAGED_DISCARD');
    });

    test('refundOrder rejects request with missing or invalid restock policy', async () => {
      const missingPolicyError = {
        response: {
          status: 400,
          data: {
            success: false,
            criterion: 'refund_restock_policy_explicit',
            error: 'Explicit restock policy is required. Must be one of: RESTOCK_INVENTORY, DAMAGED_DISCARD, NO_RESTOCK.',
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(missingPolicyError);

      await expect(
        commerceService.refundOrder('ord_refund_03', {
          restockPolicy: '' as any,
          reason: 'No policy specified',
        })
      ).rejects.toEqual(missingPolicyError);
    });
  });

  // =========================================================================
  // Criterion 4: cross_tenant_order_denied
  // =========================================================================
  describe('Criterion 4: cross_tenant_order_denied', () => {
    test('cross-tenant catalog query is rejected with 403 Forbidden', async () => {
      const crossTenantError = {
        response: {
          status: 403,
          data: {
            success: false,
            criterion: 'cross_tenant_order_denied',
            error: 'Cross-tenant product catalog access denied.',
          },
        },
      };

      (apiClient.get as jest.Mock).mockRejectedValueOnce(crossTenantError);

      await expect(
        commerceService.getProducts({ organizationId: 'org_other_tenant' })
      ).rejects.toEqual(crossTenantError);
    });

    test('cross-tenant order creation is rejected with 403 Forbidden', async () => {
      const crossOrderError = {
        response: {
          status: 403,
          data: {
            success: false,
            criterion: 'cross_tenant_order_denied',
            error: 'Cannot create order for a different Persatuan.',
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(crossOrderError);

      await expect(
        commerceService.createOrder({
          organizationId: 'org_other_tenant',
          items: [{ productId: 'prod_01', quantity: 1 }],
        })
      ).rejects.toEqual(crossOrderError);
    });

    test('cross-tenant reservation is rejected with 403 Forbidden', async () => {
      const crossReserveError = {
        response: {
          status: 403,
          data: {
            success: false,
            criterion: 'cross_tenant_order_denied',
            error: 'Cross-tenant order reservation denied.',
          },
        },
      };

      (apiClient.post as jest.Mock).mockRejectedValueOnce(crossReserveError);

      await expect(commerceService.reserveStock('ord_other_tenant')).rejects.toEqual(crossReserveError);
    });
  });

  // =========================================================================
  // Orders lifecycle & Details
  // =========================================================================
  describe('Orders Lifecycle & Details', () => {
    test('getOrders returns list of orders scoped to user organization', async () => {
      const mockOrdersList = {
        orders: [
          {
            id: 'ord_1',
            organization_id: 'org_selangor',
            total_amount: 185.0,
            status: 'PAID',
            buyer_user_id: 'usr_student_01',
            created_at: '2026-10-21T00:00:00.000Z',
          },
        ],
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockOrdersList);

      const res = await commerceService.getOrders({ organizationId: 'org_selangor' });
      expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders?organizationId=org_selangor');
      expect(res.orders).toHaveLength(1);
    });

    test('getOrderDetails retrieves full order with items and audit stock movements', async () => {
      const mockOrderDetails = {
        order: {
          id: 'ord_detail_01',
          organization_id: 'org_selangor',
          status: 'PAID',
          total_amount: 65.0,
        },
        items: [
          {
            id: 'item_1',
            product_id: 'prod_cane_01',
            product_name: 'Silambam Rattan Cane',
            quantity: 1,
            unit_price: 65.0,
            total_price: 65.0,
          },
        ],
        movements: [
          {
            id: 'mov_1',
            movement_type: 'COMMITTED',
            quantity: -1,
            reason: 'Purchased and fulfilled',
          },
        ],
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockOrderDetails);

      const res = await commerceService.getOrderDetails('ord_detail_01');
      expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders/ord_detail_01');
      expect(res.items).toHaveLength(1);
      expect(res.movements).toHaveLength(1);
    });
  });
});
