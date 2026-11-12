import { DiscountType, LoyaltyTxType } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { jobQueue } from '../../jobs/queue';
import { auditService } from '../audit/service';
import { customersRepository, determineTier } from './repository';
import {
  CreateCouponInput,
  CreateCustomerInput,
  CreateFeedbackInput,
  LoyaltyPointsTxInput,
  TriggerCampaignInput,
  UpdateCouponInput,
  UpdateCustomerInput,
  ValidateCouponInput,
} from './types';

export function computeLoyaltyPointsBalance(params: {
  currentPoints: number;
  points: number;
  type: LoyaltyTxType;
}): { newBalance: number; newTier: string; monetaryValueUsd: number } {
  const { currentPoints, points, type } = params;
  if (points <= 0) {
    throw new ValidationError('Points must be greater than zero');
  }

  let newBalance = currentPoints;
  if (type === LoyaltyTxType.EARN || type === LoyaltyTxType.ADJUST) {
    newBalance = currentPoints + points;
  } else if (type === LoyaltyTxType.REDEEM || type === LoyaltyTxType.EXPIRE) {
    if (points > currentPoints) {
      throw new ValidationError(
        `Insufficient loyalty points. Current balance: ${currentPoints}, requested redemption: ${points}`
      );
    }
    newBalance = currentPoints - points;
  }

  const newTier = determineTier(newBalance);
  // 100 points = $5.00 redemption value ($0.05 per point)
  const monetaryValueUsd = Number((points * 0.05).toFixed(2));

  return { newBalance, newTier, monetaryValueUsd };
}

export class CustomersService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await customersRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Customers CRUD
  async listCustomers(query: any) {
    return customersRepository.findManyCustomers(query);
  }

  async getCustomerById(id: string) {
    const customer = await customersRepository.findCustomerById(id);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }

  async createCustomer(input: CreateCustomerInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const created = await customersRepository.createCustomer({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'CUSTOMER_CREATED',
      entity: 'Customer',
      entityId: created.id,
      newValues: {
        firstName: created.firstName,
        lastName: created.lastName,
        phone: created.phone,
      },
    });

    return created;
  }

  async updateCustomer(id: string, input: UpdateCustomerInput) {
    const existing = await this.getCustomerById(id);
    const updated = await customersRepository.updateCustomer(id, input);

    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'CUSTOMER_UPDATED',
      entity: 'Customer',
      entityId: id,
      oldValues: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        phone: existing.phone,
      },
      newValues: input as Record<string, any>,
    });

    return updated;
  }

  async deleteCustomer(id: string, actorUserId?: string) {
    const existing = await this.getCustomerById(id);
    await customersRepository.softDeleteCustomer(id, actorUserId);

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'CUSTOMER_DELETED',
      entity: 'Customer',
      entityId: id,
    });
  }

  // Loyalty Points Earn & Redeem
  async earnPoints(input: Omit<LoyaltyPointsTxInput, 'type'>) {
    const customer = await this.getCustomerById(input.customerId);
    const { newBalance, newTier, monetaryValueUsd } = computeLoyaltyPointsBalance({
      currentPoints: customer.loyaltyPoints,
      points: input.points,
      type: LoyaltyTxType.EARN,
    });

    const result = await customersRepository.executeLoyaltyTransaction({
      ...input,
      type: LoyaltyTxType.EARN,
      newBalance,
      newTier,
    });

    await auditService.log({
      branchId: customer.branchId,
      userId: input.actorUserId,
      action: 'LOYALTY_POINTS_EARNED',
      entity: 'Customer',
      entityId: customer.id,
      oldValues: { loyaltyPoints: customer.loyaltyPoints, tier: customer.tier },
      newValues: {
        pointsEarned: input.points,
        newBalance,
        newTier,
      },
    });

    return { ...result, monetaryValueUsd };
  }

  async redeemPoints(input: Omit<LoyaltyPointsTxInput, 'type'>) {
    const customer = await this.getCustomerById(input.customerId);
    const { newBalance, newTier, monetaryValueUsd } = computeLoyaltyPointsBalance({
      currentPoints: customer.loyaltyPoints,
      points: input.points,
      type: LoyaltyTxType.REDEEM,
    });

    const result = await customersRepository.executeLoyaltyTransaction({
      ...input,
      type: LoyaltyTxType.REDEEM,
      newBalance,
      newTier,
    });

    await auditService.log({
      branchId: customer.branchId,
      userId: input.actorUserId,
      action: 'LOYALTY_POINTS_REDEEMED',
      entity: 'Customer',
      entityId: customer.id,
      oldValues: { loyaltyPoints: customer.loyaltyPoints, tier: customer.tier },
      newValues: {
        pointsRedeemed: input.points,
        monetaryDiscountValue: monetaryValueUsd,
        newBalance,
        newTier,
      },
    });

    return { ...result, monetaryDiscountValue: monetaryValueUsd };
  }

  async getLoyaltyHistory(customerId: string) {
    await this.getCustomerById(customerId);
    return customersRepository.findLoyaltyHistory(customerId);
  }

  // Coupons
  async listCoupons(branchId?: string) {
    return customersRepository.findCoupons(branchId);
  }

  async createCoupon(input: CreateCouponInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const existing = await customersRepository.findCouponByCode(
      input.code,
      branchId
    );
    if (existing) {
      throw new ConflictError(`Coupon code "${input.code.toUpperCase()}" already exists`);
    }

    const coupon = await customersRepository.createCoupon({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'COUPON_CREATED',
      entity: 'Coupon',
      entityId: coupon.id,
      newValues: {
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
      },
    });

    return coupon;
  }

  async updateCoupon(id: string, input: UpdateCouponInput) {
    const existing = await customersRepository.findCouponById(id);
    if (!existing) throw new NotFoundError('Coupon');
    return customersRepository.updateCoupon(id, input);
  }

  async deleteCoupon(id: string) {
    const existing = await customersRepository.findCouponById(id);
    if (!existing) throw new NotFoundError('Coupon');
    await customersRepository.softDeleteCoupon(id);
  }

  async validateCoupon(input: ValidateCouponInput) {
    const coupon = await customersRepository.findCouponByCode(
      input.code,
      input.branchId
    );
    if (!coupon || !coupon.isActive) {
      throw new NotFoundError(`Active coupon "${input.code.toUpperCase()}"`);
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new ValidationError(`Coupon "${coupon.code}" is not active yet`);
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new ValidationError(`Coupon "${coupon.code}" has expired`);
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new ValidationError(`Coupon "${coupon.code}" has reached its usage limit`);
    }
    if (input.orderSubtotal < Number(coupon.minOrderAmount)) {
      throw new ValidationError(
        `Minimum order subtotal of ${Number(coupon.minOrderAmount)} is required for coupon "${coupon.code}"`
      );
    }

    let discountAmount = 0;
    if (coupon.type === DiscountType.PERCENTAGE) {
      discountAmount = (input.orderSubtotal * Number(coupon.value)) / 100;
      if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
        discountAmount = Number(coupon.maxDiscount);
      }
    } else {
      discountAmount = Number(coupon.value);
    }
    discountAmount = Number(
      Math.min(input.orderSubtotal, Math.max(0, discountAmount)).toFixed(2)
    );

    return {
      valid: true,
      coupon,
      discountAmount,
      finalSubtotal: Number((input.orderSubtotal - discountAmount).toFixed(2)),
    };
  }

  // Feedbacks
  async listFeedbacks(query: any) {
    return customersRepository.findManyFeedbacks(query);
  }

  async createFeedback(input: CreateFeedbackInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    return customersRepository.createFeedback({
      ...input,
      branchId,
    });
  }

  async resolveFeedback(id: string) {
    const existing = await customersRepository.findFeedbackById(id);
    if (!existing) throw new NotFoundError('Feedback');
    return customersRepository.resolveFeedback(id);
  }

  // Segments & Campaigns
  async getSegmentsSummary(branchId?: string) {
    return customersRepository.getSegmentsSummary(branchId);
  }

  async triggerCampaign(input: TriggerCampaignInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const recipients = await customersRepository.findCampaignRecipients({
      branchId,
      segment: input.segment,
      tier: input.tier,
    });

    const job = await jobQueue.enqueue('CRM_CAMPAIGN', {
      branchId,
      campaignName: input.name,
      channel: input.channel,
      segment: input.segment ?? 'ALL',
      tier: input.tier ?? 'ALL',
      recipientCount: recipients.length,
      couponCode: input.couponCode,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'CRM_CAMPAIGN_TRIGGERED',
      entity: 'Campaign',
      newValues: {
        jobId: job.id,
        name: input.name,
        channel: input.channel,
        segment: input.segment ?? 'ALL',
        tier: input.tier ?? 'ALL',
        recipientCount: recipients.length,
        couponCode: input.couponCode,
      },
    });

    return {
      jobId: job.id,
      jobMode: job.mode,
      campaignName: input.name,
      channel: input.channel,
      targetSegment: input.segment ?? 'ALL',
      targetTier: input.tier ?? 'ALL',
      recipientCount: recipients.length,
      dispatchedAt: new Date().toISOString(),
      sampleRecipients: recipients.slice(0, 10),
    };
  }
}

export const customersService = new CustomersService();

