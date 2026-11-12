import { LoyaltyTxType, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CreateCouponInput,
  CreateCustomerInput,
  CreateFeedbackInput,
  LoyaltyPointsTxInput,
  UpdateCouponInput,
  UpdateCustomerInput,
} from './types';

export function determineTier(points: number): string {
  if (points >= 1000) return 'PLATINUM';
  if (points >= 500) return 'GOLD';
  if (points >= 200) return 'SILVER';
  return 'BRONZE';
}

export class CustomersRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  // Customers CRUD
  async findManyCustomers(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    search?: string;
    segment?: string;
    tier?: string;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.segment ? { segment: query.segment } : {}),
      ...(query.tier ? { tier: query.tier } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { orders: true, loyaltyTxs: true, feedbacks: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findCustomerById(id: string) {
    return prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        orders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            createdAt: true,
          },
        },
        loyaltyTxs: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async createCustomer(input: CreateCustomerInput & { branchId: string }) {
    return prisma.customer.create({
      data: {
        branchId: input.branchId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        segment: input.segment ?? 'NEW',
        notes: input.notes,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      },
    });
  }

  async updateCustomer(id: string, input: UpdateCustomerInput) {
    return prisma.customer.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.segment !== undefined ? { segment: input.segment } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedBy: input.actorUserId,
      },
    });
  }

  async softDeleteCustomer(id: string, actorUserId?: string) {
    return prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  // Loyalty Points Earn / Redeem
  async executeLoyaltyTransaction(
    input: LoyaltyPointsTxInput & {
      newBalance: number;
      newTier: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id: input.customerId },
        data: {
          loyaltyPoints: input.newBalance,
          tier: input.newTier,
          updatedBy: input.actorUserId,
        },
      });

      const signedPoints =
        input.type === LoyaltyTxType.REDEEM || input.type === LoyaltyTxType.EXPIRE
          ? -Math.abs(input.points)
          : Math.abs(input.points);

      const loyaltyTx = await tx.loyaltyTransaction.create({
        data: {
          customerId: input.customerId,
          orderId: input.orderId ?? null,
          type: input.type,
          points: signedPoints,
          balanceAfter: input.newBalance,
          description: input.description,
          createdBy: input.actorUserId,
        },
      });

      return { customer: updatedCustomer, transaction: loyaltyTx };
    });
  }

  async findLoyaltyHistory(customerId: string) {
    return prisma.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Coupons CRUD & Validation
  async findCoupons(branchId?: string) {
    return prisma.coupon.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCouponById(id: string) {
    return prisma.coupon.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findCouponByCode(code: string, branchId?: string) {
    return prisma.coupon.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });
  }

  async createCoupon(input: CreateCouponInput & { branchId: string }) {
    return prisma.coupon.create({
      data: {
        branchId: input.branchId,
        code: input.code.trim().toUpperCase(),
        description: input.description,
        type: input.type,
        value: input.value,
        minOrderAmount: input.minOrderAmount ?? 0,
        maxDiscount: input.maxDiscount ?? null,
        usageLimit: input.usageLimit ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateCoupon(id: string, input: UpdateCouponInput) {
    return prisma.coupon.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.minOrderAmount !== undefined
          ? { minOrderAmount: input.minOrderAmount }
          : {}),
        ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount } : {}),
        ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async softDeleteCoupon(id: string) {
    return prisma.coupon.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // Feedbacks
  async findManyFeedbacks(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    rating?: number;
    isResolved?: boolean;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);
    const where: Prisma.FeedbackWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.rating !== undefined ? { rating: query.rating } : {}),
      ...(query.isResolved !== undefined ? { isResolved: query.isResolved } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          order: {
            select: { id: true, orderNumber: true, totalAmount: true },
          },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findFeedbackById(id: string) {
    return prisma.feedback.findUnique({ where: { id } });
  }

  async createFeedback(input: CreateFeedbackInput & { branchId: string }) {
    return prisma.feedback.create({
      data: {
        branchId: input.branchId,
        orderId: input.orderId ?? null,
        customerId: input.customerId ?? null,
        rating: input.rating,
        foodRating: input.foodRating ?? null,
        serviceRating: input.serviceRating ?? null,
        comment: input.comment ?? null,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        order: {
          select: { id: true, orderNumber: true },
        },
      },
    });
  }

  async resolveFeedback(id: string) {
    return prisma.feedback.update({
      where: { id },
      data: { isResolved: true },
    });
  }

  // Segments & Campaign Targets
  async getSegmentsSummary(branchId?: string) {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };

    const [bySegment, byTier, totalCustomers] = await Promise.all([
      prisma.customer.groupBy({
        by: ['segment'],
        where,
        _count: { id: true },
        _sum: { totalSpent: true, loyaltyPoints: true },
      }),
      prisma.customer.groupBy({
        by: ['tier'],
        where,
        _count: { id: true },
        _sum: { totalSpent: true, loyaltyPoints: true },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      totalCustomers,
      segments: bySegment.map((s) => ({
        segment: s.segment,
        count: s._count.id,
        totalSpent: Number(s._sum.totalSpent ?? 0),
        totalLoyaltyPoints: s._sum.loyaltyPoints ?? 0,
      })),
      tiers: byTier.map((t) => ({
        tier: t.tier,
        count: t._count.id,
        totalSpent: Number(t._sum.totalSpent ?? 0),
        totalLoyaltyPoints: t._sum.loyaltyPoints ?? 0,
      })),
    };
  }

  async findCampaignRecipients(params: {
    branchId?: string;
    segment?: string;
    tier?: string;
  }) {
    return prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.segment ? { segment: params.segment } : {}),
        ...(params.tier ? { tier: params.tier } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        segment: true,
        tier: true,
        loyaltyPoints: true,
      },
    });
  }
}

export const customersRepository = new CustomersRepository();

