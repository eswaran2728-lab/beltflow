import { apiClient } from './apiClient';

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  sku?: string;
  category: 'EQUIPMENT' | 'MERCHANDISE' | 'UNIFORM' | 'WEAPON' | string;
  description?: string;
  price: number;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export type OrderStatus =
  | 'PENDING_RESERVATION'
  | 'RESERVED'
  | 'PAID'
  | 'PAYMENT_LATE_UNFULFILLED'
  | 'CANCELLED'
  | 'REFUNDED';

export type RestockPolicy = 'RESTOCK_INVENTORY' | 'DAMAGED_DISCARD' | 'NO_RESTOCK';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name?: string;
  category?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface InventoryOrder {
  id: string;
  organization_id: string;
  buyer_user_id: string;
  buyer_name?: string;
  buyer_email?: string;
  student_id?: string;
  student_name?: string;
  total_amount: number;
  status: OrderStatus;
  payment_id?: string;
  reservation_expires_at?: string;
  restock_policy?: RestockPolicy;
  refund_reason?: string;
  refunded_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  order_id?: string;
  movement_type: 'RESTOCK' | 'RESERVED' | 'COMMITTED' | 'RELEASED_EXPIRED' | 'REFUND_RESTOCK' | 'DAMAGED_DISCARD' | string;
  quantity: number;
  restock_policy?: string;
  reason?: string;
  created_at: string;
}

export const commerceService = {
  /**
   * Fetch product catalog for an organization
   */
  async getProducts(params?: {
    organizationId?: string;
    category?: string;
    activeOnly?: boolean;
  }): Promise<{ products: Product[] }> {
    const query = new URLSearchParams();
    if (params?.organizationId) query.append('organizationId', params.organizationId);
    if (params?.category) query.append('category', params.category);
    if (params?.activeOnly !== undefined) query.append('activeOnly', String(params.activeOnly));

    const qs = query.toString();
    return apiClient.get(`/commerce/products${qs ? `?${qs}` : ''}`);
  },

  /**
   * Create a new product (Admin Persatuan & Master)
   */
  async createProduct(payload: {
    name: string;
    sku?: string;
    category?: string;
    description?: string;
    price: number;
    stockQuantity?: number;
    organizationId?: string;
  }): Promise<{ product: Product }> {
    return apiClient.post('/commerce/products', payload);
  },

  /**
   * Explicit restock for existing product
   */
  async restockProduct(
    id: string,
    quantity: number,
    reason?: string
  ): Promise<{ success: boolean; product: Product }> {
    return apiClient.post(`/commerce/products/${id}/restock`, { quantity, reason });
  },

  /**
   * Create order draft
   */
  async createOrder(payload: {
    organizationId?: string;
    studentId?: string;
    items: Array<{ productId: string; quantity: number }>;
  }): Promise<{ order: InventoryOrder; items: OrderItem[] }> {
    return apiClient.post('/commerce/orders', payload);
  },

  /**
   * Reserve stock atomically with expiration — Contract: reserveStock(orderId)
   */
  async reserveStock(orderId: string): Promise<{
    success: boolean;
    criterion: string;
    order: InventoryOrder;
  }> {
    return apiClient.post(`/commerce/orders/${orderId}/reserve`, {});
  },

  /**
   * Confirm order payment event — Contract: confirmOrderPayment(event)
   */
  async confirmOrderPayment(
    orderId: string,
    event: {
      paymentId?: string;
      amount?: number;
      method?: string;
      forceExpired?: boolean;
    }
  ): Promise<{
    success: boolean;
    status: OrderStatus;
    order?: InventoryOrder;
    receiptNo?: string;
    criterion?: string;
    refunded?: boolean;
  }> {
    return apiClient.post(`/commerce/orders/${orderId}/confirm-payment`, event);
  },

  /**
   * Refund order with explicit restock policy — Contract: refundOrder(id)
   */
  async refundOrder(
    orderId: string,
    payload: {
      restockPolicy: RestockPolicy;
      reason?: string;
    }
  ): Promise<{
    success: boolean;
    criterion: string;
    order: InventoryOrder;
    restockPolicy: RestockPolicy;
  }> {
    return apiClient.post(`/commerce/orders/${orderId}/refund`, payload);
  },

  /**
   * List orders for user / organization
   */
  async getOrders(params?: { organizationId?: string }): Promise<{ orders: InventoryOrder[] }> {
    const query = new URLSearchParams();
    if (params?.organizationId) query.append('organizationId', params.organizationId);
    const qs = query.toString();
    return apiClient.get(`/commerce/orders${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get single order details with items and stock movements
   */
  async getOrderDetails(orderId: string): Promise<{
    order: InventoryOrder;
    items: OrderItem[];
    movements: StockMovement[];
  }> {
    return apiClient.get(`/commerce/orders/${orderId}`);
  },
};
