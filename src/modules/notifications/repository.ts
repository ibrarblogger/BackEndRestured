import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import { CreateNotificationInput, NotificationPreferences } from './types';

export class NotificationsRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  async findMany(query: {
    branchId?: string;
    userId?: string;
    unreadOnly?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip, take } = getPrismaPagination(query);

    const where: Prisma.NotificationWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.userId
        ? { OR: [{ userId: query.userId }, { userId: null }] }
        : {}),
      ...(query.unreadOnly ? { isRead: false } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          ...where,
          isRead: false,
        },
      }),
    ]);

    return {
      items,
      unreadCount,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  async create(data: CreateNotificationInput & { branchId: string }) {
    return prisma.notification.create({
      data: {
        branchId: data.branchId,
        userId: data.userId ?? null,
        type: data.type,
        title: data.title,
        message: data.message,
        data: (data.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(branchId: string, userId?: string) {
    return prisma.notification.updateMany({
      where: {
        branchId,
        isRead: false,
        ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUserPreferences(branchId: string, userId: string) {
    return prisma.setting.findUnique({
      where: {
        branchId_key: {
          branchId,
          key: `notification_prefs_${userId}`,
        },
      },
    });
  }

  async saveUserPreferences(
    branchId: string,
    userId: string,
    prefs: NotificationPreferences
  ) {
    const key = `notification_prefs_${userId}`;
    return prisma.setting.upsert({
      where: {
        branchId_key: { branchId, key },
      },
      create: {
        branchId,
        key,
        group: 'NOTIFICATIONS',
        value: prefs as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        value: prefs as unknown as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    });
  }
}

export const notificationsRepository = new NotificationsRepository();

