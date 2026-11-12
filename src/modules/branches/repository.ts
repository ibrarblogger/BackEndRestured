import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';

export class BranchesRepository {
  async findMany(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: boolean;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination(query);

    const where: Prisma.BranchWhereInput = { deletedAt: null };
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.branch.findMany({ where, skip, take, orderBy }),
      prisma.branch.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findFirstActive() {
    return prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      include: {
        settings: { where: { deletedAt: null } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAllActive() {
    return prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: { where: { deletedAt: null } },
        taxRates: { where: { deletedAt: null } },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.branch.findFirst({
      where: { code, deletedAt: null },
    });
  }

  async create(data: Prisma.BranchCreateInput) {
    return prisma.branch.create({ data });
  }

  async update(id: string, data: Prisma.BranchUpdateInput) {
    return prisma.branch.update({
      where: { id },
      data,
    });
  }

  async updateAllBranchesCurrency(currency: string, actorUserId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { deletedAt: null },
        data: {
          currency,
          updatedBy: actorUserId,
        },
      });
      return tx.branch.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  async softDelete(id: string, actorUserId?: string) {
    return prisma.branch.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  async getSettings(branchId: string) {
    return prisma.setting.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async upsertSetting(
    branchId: string,
    key: string,
    value: any,
    group = 'GENERAL',
    actorId?: string
  ) {
    return prisma.setting.upsert({
      where: {
        branchId_key: { branchId, key },
      },
      update: {
        value: value as Prisma.InputJsonValue,
        group,
        updatedBy: actorId,
        deletedAt: null,
      },
      create: {
        branchId,
        key,
        value: value as Prisma.InputJsonValue,
        group,
        createdBy: actorId,
      },
    });
  }
}

export const branchesRepository = new BranchesRepository();
