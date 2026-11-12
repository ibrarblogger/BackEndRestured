import { Request, Response } from 'express';
import { UnauthorizedError } from '../../errors';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { notificationsService } from './service';

export class NotificationsController {
  async list(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, unreadCount, meta } = await notificationsService.list({
      branchId,
      userId: req.user?.sub,
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type ? String(req.query.type) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return sendSuccess(
      res,
      { notifications: items, unreadCount },
      'Notifications retrieved successfully',
      200,
      meta
    );
  }

  async create(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const notification = await notificationsService.createAndEmit({
      ...req.body,
      branchId,
    });
    return sendSuccess(
      res,
      notification,
      'Notification created and emitted successfully',
      201
    );
  }

  async markAsRead(req: Request, res: Response) {
    const updated = await notificationsService.markAsRead(
      String(req.params.id),
      req.user?.sub
    );
    return sendSuccess(res, updated, 'Notification marked as read');
  }

  async markAllAsRead(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const result = await notificationsService.markAllAsRead(
      branchId,
      req.user?.sub
    );
    return sendSuccess(res, result, 'All notifications marked as read');
  }

  async getPreferences(req: Request, res: Response) {
    if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
    const branchId = resolveBranchScope(req);
    const prefs = await notificationsService.getPreferences(
      branchId,
      req.user.sub
    );
    return sendSuccess(
      res,
      prefs,
      'Notification preferences retrieved successfully'
    );
  }

  async updatePreferences(req: Request, res: Response) {
    if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
    const branchId = resolveBranchScope(req, req.body.branchId);
    const prefs = await notificationsService.updatePreferences(
      branchId,
      req.user.sub,
      req.body
    );
    return sendSuccess(
      res,
      prefs,
      'Notification preferences updated successfully'
    );
  }
}

export const notificationsController = new NotificationsController();

