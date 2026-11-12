import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import { AuditLogFilterQuery, CreateAuditLogInput } from './types';

export class AuditRepository {
  async create(data: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        branchId: data.branchId ?? null,
        userId: data.userId ?? null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ?? null,
        oldValues: data.oldValues ? (data.oldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: data.newValues ? (data.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
      },
    });
  }

  async findMany(query: AuditLogFilterQuery) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination(query);

    const where: Prisma.AuditLogWhereInput = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entity) where.entity = { equals: query.entity, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entity: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findById(id: string) {
    return prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }
}

export const auditRepository = new AuditRepository();
