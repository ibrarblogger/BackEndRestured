import { Prisma, ReservationStatus, TableStatus, WaitlistStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CreateFloorInput,
  CreateReservationInput,
  CreateTableInput,
  CreateWaitlistInput,
  TablePositionItem,
  UpdateFloorInput,
  UpdateReservationInput,
  UpdateTableInput,
} from './types';

export class TablesRepository {
  async findDefaultBranchId(): Promise<string | null> {
    const b = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return b?.id ?? null;
  }

  // Floors
  async findFloors(branchId?: string) {
    return prisma.floor.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { floorNumber: 'asc' },
      include: {
        tables: {
          where: { deletedAt: null },
          orderBy: { tableNumber: 'asc' },
        },
      },
    });
  }

  async findFloorById(id: string) {
    return prisma.floor.findFirst({
      where: { id, deletedAt: null },
      include: {
        tables: { where: { deletedAt: null } },
      },
    });
  }

  async createFloor(data: CreateFloorInput) {
    return prisma.floor.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        floorNumber: data.floorNumber ?? 1,
        isActive: data.isActive ?? true,
        createdBy: data.actorUserId,
      },
    });
  }

  async updateFloor(id: string, data: UpdateFloorInput) {
    return prisma.floor.update({
      where: { id },
      data: {
        name: data.name,
        floorNumber: data.floorNumber,
        isActive: data.isActive,
        updatedBy: data.actorUserId,
      },
    });
  }

  async softDeleteFloor(id: string, actorUserId?: string) {
    return prisma.floor.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  // Tables
  async findManyTables(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    floorId?: string;
    status?: TableStatus;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination({
      ...query,
      sortBy: query.sortBy || 'tableNumber',
      sortOrder: query.sortOrder || 'asc',
    });

    const where: Prisma.TableWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.floorId) where.floorId = query.floorId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.tableNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.table.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          floor: { select: { id: true, name: true, floorNumber: true } },
        },
      }),
      prisma.table.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findTableById(id: string) {
    return prisma.table.findFirst({
      where: { id, deletedAt: null },
      include: {
        floor: { select: { id: true, name: true, floorNumber: true } },
        reservations: {
          where: {
            deletedAt: null,
            status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
            reservationTime: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          },
          orderBy: { reservationTime: 'asc' },
        },
      },
    });
  }

  async createTable(data: CreateTableInput) {
    return prisma.table.create({
      data: {
        branchId: data.branchId,
        floorId: data.floorId,
        tableNumber: data.tableNumber,
        capacity: data.capacity ?? 4,
        status: data.status ?? TableStatus.AVAILABLE,
        shape: data.shape ?? 'RECTANGLE',
        posX: data.posX ?? 0,
        posY: data.posY ?? 0,
        width: data.width ?? 100,
        height: data.height ?? 100,
        qrCodeUrl: data.qrCodeUrl,
        isActive: data.isActive ?? true,
        createdBy: data.actorUserId,
      },
      include: {
        floor: { select: { id: true, name: true, floorNumber: true } },
      },
    });
  }

  async updateTable(id: string, data: UpdateTableInput) {
    return prisma.table.update({
      where: { id },
      data: {
        floorId: data.floorId,
        tableNumber: data.tableNumber,
        capacity: data.capacity,
        status: data.status,
        shape: data.shape,
        posX: data.posX,
        posY: data.posY,
        width: data.width,
        height: data.height,
        qrCodeUrl: data.qrCodeUrl,
        isActive: data.isActive,
        updatedBy: data.actorUserId,
      },
      include: {
        floor: { select: { id: true, name: true, floorNumber: true } },
      },
    });
  }

  async updateBatchLayout(tables: TablePositionItem[], actorUserId?: string) {
    return prisma.$transaction(
      tables.map((t) =>
        prisma.table.update({
          where: { id: t.id },
          data: {
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            shape: t.shape,
            updatedBy: actorUserId,
          },
        })
      )
    );
  }

  async softDeleteTable(id: string, actorUserId?: string) {
    return prisma.table.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  // Reservations
  async findCandidateReservationsForTable(
    tableId: string,
    windowStart: Date,
    windowEnd: Date,
    excludeId?: string
  ) {
    return prisma.reservation.findMany({
      where: {
        tableId,
        deletedAt: null,
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.SEATED,
          ],
        },
        reservationTime: {
          gte: new Date(windowStart.getTime() - 8 * 60 * 60 * 1000),
          lte: windowEnd,
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findManyReservations(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    tableId?: string;
    status?: ReservationStatus;
    date?: string;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination({
      ...query,
      sortBy: query.sortBy || 'reservationTime',
      sortOrder: query.sortOrder || 'asc',
    });

    const where: Prisma.ReservationWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.tableId) where.tableId = query.tableId;
    if (query.status) where.status = query.status;
    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      const end = new Date(`${query.date}T23:59:59.999Z`);
      if (!Number.isNaN(start.getTime())) {
        where.reservationTime = { gte: start, lte: end };
      }
    }
    if (query.search) {
      where.OR = [
        { guestName: { contains: query.search, mode: 'insensitive' } },
        { guestPhone: { contains: query.search, mode: 'insensitive' } },
        { guestEmail: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          table: { select: { id: true, tableNumber: true, capacity: true } },
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findReservationById(id: string) {
    return prisma.reservation.findFirst({
      where: { id, deletedAt: null },
      include: {
        table: { select: { id: true, tableNumber: true, capacity: true, status: true } },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
  }

  async createReservation(data: CreateReservationInput) {
    return prisma.reservation.create({
      data: {
        branchId: data.branchId,
        tableId: data.tableId,
        customerId: data.customerId ?? null,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestEmail: data.guestEmail,
        partySize: data.partySize,
        reservationTime: new Date(data.reservationTime),
        durationMinutes: data.durationMinutes ?? 90,
        status: ReservationStatus.CONFIRMED,
        specialRequests: data.specialRequests,
        createdBy: data.actorUserId,
      },
      include: {
        table: { select: { id: true, tableNumber: true, capacity: true } },
      },
    });
  }

  async updateReservation(id: string, data: UpdateReservationInput) {
    return prisma.reservation.update({
      where: { id },
      data: {
        tableId: data.tableId,
        customerId: data.customerId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestEmail: data.guestEmail,
        partySize: data.partySize,
        reservationTime: data.reservationTime ? new Date(data.reservationTime) : undefined,
        durationMinutes: data.durationMinutes,
        status: data.status,
        specialRequests: data.specialRequests,
        updatedBy: data.actorUserId,
      },
      include: {
        table: { select: { id: true, tableNumber: true, capacity: true } },
      },
    });
  }

  async markOverdueReservationsNoShow(branchId?: string, graceMinutes = 30) {
    const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
    const overdue = await prisma.reservation.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        reservationTime: { lte: cutoff },
      },
    });

    if (overdue.length === 0) return { markedCount: 0 };

    await prisma.$transaction([
      prisma.reservation.updateMany({
        where: { id: { in: overdue.map((r) => r.id) } },
        data: { status: ReservationStatus.NO_SHOW },
      }),
      prisma.table.updateMany({
        where: {
          id: { in: overdue.map((r) => r.tableId) },
          status: TableStatus.RESERVED,
        },
        data: { status: TableStatus.AVAILABLE },
      }),
    ]);

    return { markedCount: overdue.length };
  }

  // Waitlist
  async findManyWaitlist(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    status?: WaitlistStatus;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination({
      ...query,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'asc',
    });

    const where: Prisma.WaitlistWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { guestName: { contains: query.search, mode: 'insensitive' } },
        { guestPhone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.waitlist.findMany({ where, skip, take, orderBy }),
      prisma.waitlist.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findWaitlistById(id: string) {
    return prisma.waitlist.findFirst({ where: { id, deletedAt: null } });
  }

  async createWaitlist(data: CreateWaitlistInput) {
    return prisma.waitlist.create({
      data: {
        branchId: data.branchId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        partySize: data.partySize,
        estimatedWaitMinutes: data.estimatedWaitMinutes ?? 15,
        status: WaitlistStatus.WAITING,
        notes: data.notes,
        createdBy: data.actorUserId,
      },
    });
  }

  async updateWaitlistStatus(id: string, status: WaitlistStatus, actorUserId?: string) {
    return prisma.waitlist.update({
      where: { id },
      data: {
        status,
        seatedAt: status === WaitlistStatus.SEATED ? new Date() : undefined,
        updatedBy: actorUserId,
      },
    });
  }

  async softDeleteWaitlist(id: string, actorUserId?: string) {
    return prisma.waitlist.update({
      where: { id },
      data: {
        status: WaitlistStatus.CANCELLED,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }
}

export const tablesRepository = new TablesRepository();

