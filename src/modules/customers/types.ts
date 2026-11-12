import { DiscountType, LoyaltyTxType } from '@prisma/client';

export interface CreateCustomerInput {
  branchId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  segment?: string;
  notes?: string;
  actorUserId?: string;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  segment?: string;
  notes?: string;
  actorUserId?: string;
}

export interface LoyaltyPointsTxInput {
  customerId: string;
  orderId?: string;
  type: LoyaltyTxType;
  points: number;
  description?: string;
  actorUserId?: string;
}

export interface CreateCouponInput {
  branchId?: string;
  code: string;
  description?: string;
  type: DiscountType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  startsAt?: string | Date | null;
  expiresAt?: string | Date | null;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateCouponInput {
  code?: string;
  description?: string;
  type?: DiscountType;
  value?: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  startsAt?: string | Date | null;
  expiresAt?: string | Date | null;
  isActive?: boolean;
  actorUserId?: string;
}

export interface ValidateCouponInput {
  branchId?: string;
  code: string;
  orderSubtotal: number;
}

export interface CreateFeedbackInput {
  branchId?: string;
  orderId?: string;
  customerId?: string;
  rating: number;
  foodRating?: number;
  serviceRating?: number;
  comment?: string;
}

export interface TriggerCampaignInput {
  branchId?: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'BOTH';
  segment?: string;
  tier?: string;
  subject?: string;
  messageTemplate: string;
  couponCode?: string;
  actorUserId?: string;
}

