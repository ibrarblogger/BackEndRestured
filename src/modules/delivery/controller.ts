import { DeliveryStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { deliveryService } from './service';

export class DeliveryController {
  // Zones
  async listZones(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const isActive =
      req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const zones = await deliveryService.listZones(branchId, isActive);
    return sendSuccess(res, zones, 'Delivery zones retrieved successfully');
  }

  async createZone(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const zone = await deliveryService.createZone({ ...req.body, branchId });
    return sendSuccess(res, zone, 'Delivery zone created successfully', 201);
  }

  async updateZone(req: Request, res: Response) {
    const zone = await deliveryService.updateZone(String(req.params.id), req.body);
    return sendSuccess(res, zone, 'Delivery zone updated successfully');
  }

  async deleteZone(req: Request, res: Response) {
    await deliveryService.deleteZone(String(req.params.id));
    return sendSuccess(res, null, 'Delivery zone deleted successfully');
  }

  // Riders
  async listRiders(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const status = req.query.status ? String(req.query.status) : undefined;
    const isActive =
      req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const riders = await deliveryService.listRiders(branchId, status, isActive);
    return sendSuccess(res, riders, 'Delivery riders retrieved successfully');
  }

  async createRider(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const rider = await deliveryService.createRider({ ...req.body, branchId });
    return sendSuccess(res, rider, 'Delivery rider created successfully', 201);
  }

  async updateRider(req: Request, res: Response) {
    const rider = await deliveryService.updateRider(String(req.params.id), req.body);
    return sendSuccess(res, rider, 'Delivery rider updated successfully');
  }

  async deleteRider(req: Request, res: Response) {
    await deliveryService.deleteRider(String(req.params.id));
    return sendSuccess(res, null, 'Delivery rider deleted successfully');
  }

  // Deliveries
  async listDeliveries(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await deliveryService.listDeliveries({
      branchId,
      status: req.query.status as DeliveryStatus | undefined,
      riderId: req.query.riderId ? String(req.query.riderId) : undefined,
      zoneId: req.query.zoneId ? String(req.query.zoneId) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return sendSuccess(res, items, 'Deliveries retrieved successfully', 200, meta);
  }

  async getDeliveryById(req: Request, res: Response) {
    const delivery = await deliveryService.getDeliveryById(String(req.params.id));
    return sendSuccess(res, delivery, 'Delivery retrieved successfully');
  }

  async dispatchDelivery(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const created = await deliveryService.dispatchDelivery({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, created, 'Delivery dispatched successfully', 201);
  }

  async assignRider(req: Request, res: Response) {
    const updated = await deliveryService.assignRider(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, updated, 'Rider assigned successfully');
  }

  async updateStatus(req: Request, res: Response) {
    const updated = await deliveryService.updateDeliveryStatus(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, updated, 'Delivery status updated successfully');
  }
}

export const deliveryController = new DeliveryController();

