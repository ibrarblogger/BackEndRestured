import { DeliveryStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { auditService } from '../audit/service';
import { deliveryRepository } from './repository';
import {
  AssignRiderInput,
  CreateDeliveryZoneInput,
  CreateRiderInput,
  DispatchDeliveryInput,
  UpdateDeliveryStatusInput,
  UpdateDeliveryZoneInput,
  UpdateRiderInput,
} from './types';

export class DeliveryService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await deliveryRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Zones
  async listZones(branchId?: string, isActive?: boolean) {
    return deliveryRepository.findZones(branchId, isActive);
  }

  async createZone(input: CreateDeliveryZoneInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    return deliveryRepository.createZone({ ...input, branchId });
  }

  async updateZone(id: string, input: UpdateDeliveryZoneInput) {
    const existing = await deliveryRepository.findZoneById(id);
    if (!existing) throw new NotFoundError('Delivery zone');
    return deliveryRepository.updateZone(id, input);
  }

  async deleteZone(id: string) {
    const existing = await deliveryRepository.findZoneById(id);
    if (!existing) throw new NotFoundError('Delivery zone');
    await deliveryRepository.softDeleteZone(id);
  }

  // Riders
  async listRiders(branchId?: string, status?: string, isActive?: boolean) {
    return deliveryRepository.findRiders(branchId, status, isActive);
  }

  async createRider(input: CreateRiderInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    return deliveryRepository.createRider({ ...input, branchId });
  }

  async updateRider(id: string, input: UpdateRiderInput) {
    const existing = await deliveryRepository.findRiderById(id);
    if (!existing) throw new NotFoundError('Rider');
    return deliveryRepository.updateRider(id, input);
  }

  async deleteRider(id: string) {
    const existing = await deliveryRepository.findRiderById(id);
    if (!existing) throw new NotFoundError('Rider');
    await deliveryRepository.softDeleteRider(id);
  }

  // Deliveries
  async listDeliveries(query: {
    branchId?: string;
    status?: DeliveryStatus;
    riderId?: string;
    zoneId?: string;
    page?: number;
    limit?: number;
  }) {
    return deliveryRepository.findManyDeliveries(query);
  }

  async getDeliveryById(id: string) {
    const delivery = await deliveryRepository.findDeliveryById(id);
    if (!delivery) throw new NotFoundError('Delivery');
    return delivery;
  }

  async dispatchDelivery(input: DispatchDeliveryInput) {
    const order = await deliveryRepository.findOrderById(input.orderId);
    if (!order) throw new NotFoundError('Order');

    const existingDelivery = await deliveryRepository.findDeliveryByOrderId(input.orderId);
    if (existingDelivery) {
      throw new ConflictError('A delivery record already exists for this order');
    }

    let deliveryFee = input.deliveryFee;
    if (input.zoneId) {
      const zone = await deliveryRepository.findZoneById(input.zoneId);
      if (!zone) throw new NotFoundError('Delivery zone');
      if (deliveryFee === undefined) {
        deliveryFee = Number(zone.deliveryFee);
      }
    }

    if (input.riderId) {
      const rider = await deliveryRepository.findRiderById(input.riderId);
      if (!rider || !rider.isActive) {
        throw new ValidationError('Selected rider is not available or inactive');
      }
    }

    const branchId = input.branchId || order.branchId;
    const created = await deliveryRepository.createDelivery({
      ...input,
      branchId,
      deliveryFee: deliveryFee ?? Number(order.deliveryFee ?? 0),
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'DELIVERY_DISPATCHED',
      entity: 'Delivery',
      entityId: created.id,
      newValues: {
        orderId: created.orderId,
        riderId: created.riderId,
        zoneId: created.zoneId,
        status: created.status,
      },
    });

    emitSocketEvent(
      SOCKET_EVENTS.ORDER_STATUS_CHANGED,
      {
        orderId: created.orderId,
        deliveryId: created.id,
        deliveryStatus: created.status,
        riderId: created.riderId,
      },
      { branchId }
    );

    return created;
  }

  async assignRider(deliveryId: string, input: AssignRiderInput) {
    const delivery = await deliveryRepository.findDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery');

    if (
      delivery.status === DeliveryStatus.DELIVERED ||
      delivery.status === DeliveryStatus.CANCELLED
    ) {
      throw new ValidationError('Cannot assign rider to a completed or cancelled delivery');
    }

    const rider = await deliveryRepository.findRiderById(input.riderId);
    if (!rider || !rider.isActive) {
      throw new NotFoundError('Active rider');
    }

    const updated = await deliveryRepository.assignRider(
      deliveryId,
      input.riderId,
      delivery.riderId
    );

    await auditService.log({
      branchId: delivery.branchId,
      userId: input.actorUserId,
      action: 'DELIVERY_RIDER_ASSIGNED',
      entity: 'Delivery',
      entityId: deliveryId,
      newValues: {
        riderId: rider.id,
        riderName: rider.name,
        status: updated.status,
      },
    });

    emitSocketEvent(
      SOCKET_EVENTS.ORDER_STATUS_CHANGED,
      {
        orderId: updated.orderId,
        deliveryId: updated.id,
        deliveryStatus: updated.status,
        riderId: updated.riderId,
      },
      { branchId: delivery.branchId }
    );

    return updated;
  }

  async updateDeliveryStatus(deliveryId: string, input: UpdateDeliveryStatusInput) {
    const delivery = await deliveryRepository.findDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery');

    if (
      delivery.status === DeliveryStatus.DELIVERED &&
      input.status !== DeliveryStatus.DELIVERED
    ) {
      throw new ValidationError('Delivered order cannot revert to an earlier status');
    }

    const updated = await deliveryRepository.updateDeliveryStatus(
      deliveryId,
      input.status,
      delivery.riderId,
      delivery.orderId,
      delivery.order?.status,
      input.notes
    );

    await auditService.log({
      branchId: delivery.branchId,
      userId: input.actorUserId,
      action: 'DELIVERY_STATUS_UPDATED',
      entity: 'Delivery',
      entityId: deliveryId,
      oldValues: { status: delivery.status },
      newValues: { status: updated.status },
    });

    emitSocketEvent(
      SOCKET_EVENTS.ORDER_STATUS_CHANGED,
      {
        orderId: updated.orderId,
        deliveryId: updated.id,
        deliveryStatus: updated.status,
      },
      { branchId: delivery.branchId }
    );

    return updated;
  }
}

export const deliveryService = new DeliveryService();

