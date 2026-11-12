import { CashDrawerStatus, DiscountType, PaymentMethod, PaymentStatus } from '@prisma/client';

export interface ProcessPaymentInput {
  branchId?: string;
  orderId: string;
  idempotencyKey: string;
  method: PaymentMethod;
  amount: number;
  tipAmount?: number;
  tenderedAmount?: number;
  cashDrawerSessionId?: string;
  transactionRef?: string;
  gatewayProvider?: string;
  gatewayResponse?: Record<string, any>;
  actorUserId?: string;
}

export interface CreateRefundInput {
  paymentId: string;
  amount: number;
  reason: string;
  approvedBy?: string;
  actorUserId?: string;
}

export interface OpenCashDrawerInput {
  branchId?: string;
  openingBalance: number;
  notes?: string;
  actorUserId: string;
}

export interface CloseCashDrawerInput {
  closingBalance: number;
  notes?: string;
  actorUserId: string;
}

export interface CreateTaxRateInput {
  branchId?: string;
  name: string;
  ratePercent: number;
  isInclusive?: boolean;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateTaxRateInput {
  name?: string;
  ratePercent?: number;
  isInclusive?: boolean;
  isActive?: boolean;
  actorUserId?: string;
}

export interface CreateDiscountInput {
  branchId?: string;
  name: string;
  type: DiscountType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateDiscountInput {
  name?: string;
  type?: DiscountType;
  value?: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  isActive?: boolean;
  actorUserId?: string;
}

export interface PaymentGatewayWebhookInput {
  provider: string;
  eventType: string;
  idempotencyKey: string;
  orderId: string;
  amount: number;
  transactionRef: string;
  status: PaymentStatus;
  rawPayload?: Record<string, any>;
}

export interface CashDrawerQueryInput {
  branchId?: string;
  status?: CashDrawerStatus;
  page?: number;
  limit?: number;
}

