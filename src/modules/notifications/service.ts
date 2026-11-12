import { ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { notificationsRepository } from './repository';
import { CreateNotificationInput, NotificationPreferences } from './types';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  orderNew: true,
  kitchenReady: true,
  stockLow: true,
  reservationNew: true,
  systemAlerts: true,
  emailEnabled: true,
  soundEnabled: true,
};

export class NotificationsService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await notificationsRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  async list(query: {
    branchId?: string;
    userId?: string;
    unreadOnly?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const branchId = await this.ensureBranchId(query.branchId);
    return notificationsRepository.findMany({ ...query, branchId });
  }

  async createAndEmit(input: CreateNotificationInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const created = await notificationsRepository.create({
      ...input,
      branchId,
    });

    emitSocketEvent(
      SOCKET_EVENTS.NOTIFICATION_NEW,
      created,
      input.userId ? { userId: input.userId, branchId } : { branchId }
    );

    return created;
  }

  async markAsRead(id: string, userId?: string) {
    const existing = await notificationsRepository.findById(id);
    if (!existing) throw new NotFoundError('Notification');

    if (existing.userId && userId && existing.userId !== userId) {
      throw new ForbiddenError('Cannot mark another user notification as read');
    }

    if (existing.isRead) return existing;
    return notificationsRepository.markAsRead(id);
  }

  async markAllAsRead(branchId?: string, userId?: string) {
    const resolvedBranchId = await this.ensureBranchId(branchId);
    const result = await notificationsRepository.markAllAsRead(
      resolvedBranchId,
      userId
    );
    return { markedCount: result.count };
  }

  async getPreferences(branchId: string | undefined, userId: string) {
    const resolvedBranchId = await this.ensureBranchId(branchId);
    const setting = await notificationsRepository.getUserPreferences(
      resolvedBranchId,
      userId
    );
    const saved =
      setting?.value && typeof setting.value === 'object'
        ? (setting.value as Partial<NotificationPreferences>)
        : {};
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
    };
  }

  async updatePreferences(
    branchId: string | undefined,
    userId: string,
    patch: Partial<NotificationPreferences>
  ) {
    const resolvedBranchId = await this.ensureBranchId(branchId);
    const current = await this.getPreferences(resolvedBranchId, userId);
    const merged: NotificationPreferences = {
      ...current,
      ...patch,
    };
    await notificationsRepository.saveUserPreferences(
      resolvedBranchId,
      userId,
      merged
    );
    return merged;
  }
}

export const notificationsService = new NotificationsService();

