import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CreateDeliveryZoneInput,
  CreateRiderInput,
  DispatchDeliveryInput,
  UpdateDeliveryZoneInput,
  UpdateRiderInput,
} from './types';

const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.IN_TRANSIT,
];

export class DeliveryRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  // Delivery Zones
  async findZones(branchId?: string, isActive?: boolean) {
    return prisma.deliveryZone.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { deliveries: true } },
      },
    });
  }

  async findZoneById(id: string) {
    return prisma.deliveryZone.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async createZone(data: CreateDeliveryZoneInput & { branchId: string }) {
    return prisma.deliveryZone.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        deliveryFee: data.deliveryFee,
        minOrderAmount: data.minOrderAmount ?? 0,
        estimatedTimeMin: data.estimatedTimeMin ?? 30,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateZone(id: string, data: UpdateDeliveryZoneInput) {
    return prisma.deliveryZone.update({
      where: { id },
      data,
    });
  }

  async softDeleteZone(id: string) {
    return prisma.deliveryZone.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // Riders
  async findRiders(branchId?: string, status?: string, isActive?: boolean) {
    return prisma.rider.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { deliveries: true } },
      },
    });
  }

  async findRiderById(id: string) {
    return prisma.rider.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async createRider(data: CreateRiderInput & { branchId: string }) {
    return prisma.rider.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        phone: data.phone,
        vehicleNo: data.vehicleNo,
        status: data.status ?? 'AVAILABLE',
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateRider(id: string, data: UpdateRiderInput) {
    return prisma.rider.update({
      where: { id },
      data,
    });
  }

  async softDeleteRider(id: string) {
    return prisma.rider.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, status: 'OFFLINE' },
    });
  }

  // Orders lookup
  async findOrderById(orderId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });
  }

  // Deliveries
  async findManyDeliveries(query: {
    branchId?: string;
    status?: DeliveryStatus;
    riderId?: string;
    zoneId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip, take } = getPrismaPagination(query);

    const where: Prisma.DeliveryWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.riderId ? { riderId: query.riderId } : {}),
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          zone: { select: { id: true, name: true, deliveryFee: true, estimatedTimeMin: true } },
          rider: { select: { id: true, name: true, phone: true, vehicleNo: true, status: true } },
          order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        },
      }),
      prisma.delivery.count({ where }),
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

  async findDeliveryById(id: string) {
    return prisma.delivery.findUnique({
      where: { id },
      include: {
        zone: true,
        rider: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
          },
        },
      },
    });
  }

  async findDeliveryByOrderId(orderId: string) {
    return prisma.delivery.findUnique({
      where: { orderId },
    });
  }

  async createDelivery(
    data: DispatchDeliveryInput & { branchId: string; deliveryFee: number }
  ) {
    return prisma.$transaction(async (tx) => {
      const hasRider = Boolean(data.riderId);
      const delivery = await tx.delivery.create({
        data: {
          branchId: data.branchId,
          orderId: data.orderId,
          zoneId: data.zoneId,
          riderId: data.riderId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deliveryAddress: data.deliveryAddress,
          deliveryFee: data.deliveryFee,
          status: hasRider ? DeliveryStatus.ASSIGNED : DeliveryStatus.PENDING,
          assignedAt: hasRider ? new Date() : null,
          notes: data.notes,
        },
        include: {
          zone: true,
          rider: true,
          order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        },
      });

      if (data.riderId) {
        await tx.rider.update({
          where: { id: data.riderId },
          data: { status: 'BUSY' },
        });
      }

      return delivery;
    });
  }

  async assignRider(deliveryId: string, riderId: string, previousRiderId?: string | null) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          riderId,
          status: DeliveryStatus.ASSIGNED,
          assignedAt: new Date(),
        },
        include: {
          zone: true,
          rider: true,
          order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        },
      });

      await tx.rider.update({
        where: { id: riderId },
        data: { status: 'BUSY' },
      });

      if (previousRiderId && previousRiderId !== riderId) {
        const activeCount = await tx.delivery.count({
          where: {
            riderId: previousRiderId,
            status: { in: ACTIVE_DELIVERY_STATUSES },
          },
        });
        if (activeCount === 0) {
          await tx.rider.update({
            where: { id: previousRiderId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      return updated;
    });
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    riderId?: string | null,
    orderId?: string,
    currentOrderStatus?: OrderStatus,
    notes?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const data: Prisma.DeliveryUpdateInput = {
        status,
        ...(notes !== undefined ? { notes } : {}),
        ...(status === DeliveryStatus.PICKED_UP ? { pickedUpAt: new Date() } : {}),
        ...(status === DeliveryStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      };

      const updated = await tx.delivery.update({
        where: { id: deliveryId },
        data,
        include: {
          zone: true,
          rider: true,
          order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        },
      });

      if (
        riderId &&
        (status === DeliveryStatus.DELIVERED || status === DeliveryStatus.CANCELLED)
      ) {
        const remainingActive = await tx.delivery.count({
          where: {
            riderId,
            id: { not: deliveryId },
            status: { in: ACTIVE_DELIVERY_STATUSES },
          },
        });

        if (remainingActive === 0) {
          await tx.rider.update({
            where: { id: riderId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      if (
        orderId &&
        status === DeliveryStatus.DELIVERED &&
        currentOrderStatus &&
        currentOrderStatus !== OrderStatus.PAID &&
        currentOrderStatus !== OrderStatus.CANCELLED
      ) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.SERVED },
        });
      }

      return updated;
    });
  }
}

export const deliveryRepository = new DeliveryRepository();

