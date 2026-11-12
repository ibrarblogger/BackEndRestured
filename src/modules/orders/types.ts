import { OrderType } from '@prisma/client';

export interface OrderItemModifierInput {
  addOnId: string;
  quantity?: number;
}

export interface OrderItemInput {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
  modifiers?: OrderItemModifierInput[];
}

export interface CreateOrderInput {
  branchId: string;
  tableId?: string;
  customerId?: string;
  waiterId?: string;
  orderType: OrderType;
  guestCount?: number;
  items: OrderItemInput[];
  discountId?: string;
  couponCode?: string;
  deliveryFee?: number;
  tipAmount?: number;
  notes?: string;
  holdImmediately?: boolean;
  actorUserId?: string;
}

export interface UpdateOrderInput {
  tableId?: string | null;
  customerId?: string | null;
  guestCount?: number;
  discountId?: string | null;
  couponCode?: string | null;
  deliveryFee?: number;
  tipAmount?: number;
  notes?: string;
  items?: OrderItemInput[];
  actorUserId?: string;
}

export interface SplitOrderInput {
  orderItemIds: string[];
  guestCount?: number;
  actorUserId?: string;
}

export interface MergeOrdersInput {
  targetOrderId: string;
  sourceOrderIds: string[];
  actorUserId?: string;
}

export interface BillingCalculationInput {
  subtotal: number;
  orderType: OrderType;
  taxRatePercent: number;
  serviceChargePercent: number;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  deliveryFee?: number;
  tipAmount?: number;
}

export interface BillingCalculationResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  serviceCharge: number;
  deliveryFee: number;
  tipAmount: number;
  totalAmount: number;
}
