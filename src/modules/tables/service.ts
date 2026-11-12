import { ReservationStatus, TableStatus, WaitlistStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { auditService } from '../audit/service';
import { tablesRepository } from './repository';
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

export class TablesService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await tablesRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Floors
  async listFloors(branchId?: string) {
    return tablesRepository.findFloors(branchId);
  }

  async createFloor(input: CreateFloorInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    return tablesRepository.createFloor({ ...input, branchId });
  }

  async updateFloor(id: string, input: UpdateFloorInput) {
    const existing = await tablesRepository.findFloorById(id);
    if (!existing) throw new NotFoundError('Floor');
    return tablesRepository.updateFloor(id, input);
  }

  async deleteFloor(id: string, actorUserId?: string) {
    const existing = await tablesRepository.findFloorById(id);
    if (!existing) throw new NotFoundError('Floor');
    await tablesRepository.softDeleteFloor(id, actorUserId);
  }

  // Tables
  async listTables(query: any) {
    return tablesRepository.findManyTables(query);
  }

  async getTableById(id: string) {
    const table = await tablesRepository.findTableById(id);
    if (!table) throw new NotFoundError('Table');
    return table;
  }

  async createTable(input: CreateTableInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const floor = await tablesRepository.findFloorById(input.floorId);
    if (!floor) throw new NotFoundError('Floor');
    return tablesRepository.createTable({ ...input, branchId });
  }

  async updateTable(id: string, input: UpdateTableInput) {
    const existing = await this.getTableById(id);
    const updated = await tablesRepository.updateTable(id, input);
    if (input.status && input.status !== existing.status) {
      emitSocketEvent(
        SOCKET_EVENTS.TABLE_STATUS_CHANGED,
        {
          tableId: updated.id,
          tableNumber: updated.tableNumber,
          previousStatus: existing.status,
          status: updated.status,
        },
        { branchId: existing.branchId }
      );
    }
    return updated;
  }

  async updateTableStatus(id: string, status: TableStatus, actorUserId?: string) {
    return this.updateTable(id, { status, actorUserId });
  }

  async updateFloorLayout(tables: TablePositionItem[], actorUserId?: string) {
    return tablesRepository.updateBatchLayout(tables, actorUserId);
  }

  async deleteTable(id: string, actorUserId?: string) {
    await this.getTableById(id);
    await tablesRepository.softDeleteTable(id, actorUserId);
  }

  // Reservations (with Time-Conflict Detection & No-Show Handling)
  private async checkReservationTimeConflict(
    tableId: string,
    startTime: Date,
    durationMinutes: number,
    excludeReservationId?: string
  ) {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const candidates = await tablesRepository.findCandidateReservationsForTable(
      tableId,
      startTime,
      endTime,
      excludeReservationId
    );

    for (const r of candidates) {
      const existingStart = new Date(r.reservationTime);
      const existingEnd = new Date(existingStart.getTime() + r.durationMinutes * 60 * 1000);
      // Overlap condition: startA < endB && startB < endA
      if (startTime < existingEnd && existingStart < endTime) {
        throw new ConflictError(
          `Time conflict: Table is already reserved for ${r.guestName} between ${existingStart.toISOString()} and ${existingEnd.toISOString()}`
        );
      }
    }
  }

  async listReservations(query: any) {
    return tablesRepository.findManyReservations(query);
  }

  async getReservationById(id: string) {
    const reservation = await tablesRepository.findReservationById(id);
    if (!reservation) throw new NotFoundError('Reservation');
    return reservation;
  }

  async createReservation(input: CreateReservationInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const table = await this.getTableById(input.tableId);

    if (input.partySize > table.capacity) {
      throw new ValidationError(
        `Party size (${input.partySize}) exceeds table ${table.tableNumber} capacity (${table.capacity})`
      );
    }

    const startTime = new Date(input.reservationTime);
    const durationMinutes = input.durationMinutes ?? 90;

    await this.checkReservationTimeConflict(
      input.tableId,
      startTime,
      durationMinutes
    );

    const created = await tablesRepository.createReservation({
      ...input,
      branchId,
      durationMinutes,
    });

    emitSocketEvent(SOCKET_EVENTS.RESERVATION_NEW, created, { branchId });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'RESERVATION_CREATED',
      entity: 'Reservation',
      entityId: created.id,
      newValues: {
        tableId: created.tableId,
        guestName: created.guestName,
        reservationTime: created.reservationTime,
      },
    });

    return created;
  }

  async updateReservation(id: string, input: UpdateReservationInput) {
    const existing = await this.getReservationById(id);

    const targetTableId = input.tableId ?? existing.tableId;
    const targetStartTime = input.reservationTime
      ? new Date(input.reservationTime)
      : new Date(existing.reservationTime);
    const targetDuration = input.durationMinutes ?? existing.durationMinutes;

    if (input.tableId || input.reservationTime || input.durationMinutes) {
      await this.checkReservationTimeConflict(
        targetTableId,
        targetStartTime,
        targetDuration,
        id
      );
    }

    const updated = await tablesRepository.updateReservation(id, input);

    if (input.status === ReservationStatus.SEATED) {
      await this.updateTableStatus(targetTableId, TableStatus.OCCUPIED, input.actorUserId);
    } else if (
      input.status === ReservationStatus.NO_SHOW ||
      input.status === ReservationStatus.CANCELLED ||
      input.status === ReservationStatus.COMPLETED
    ) {
      if (existing.table.status === TableStatus.RESERVED) {
        await this.updateTableStatus(targetTableId, TableStatus.AVAILABLE, input.actorUserId);
      }
    }

    return updated;
  }

  async updateReservationStatus(
    id: string,
    status: ReservationStatus,
    actorUserId?: string
  ) {
    return this.updateReservation(id, { status, actorUserId });
  }

  async processNoShows(branchId?: string) {
    return tablesRepository.markOverdueReservationsNoShow(branchId);
  }

  // Waitlist
  async listWaitlist(query: any) {
    return tablesRepository.findManyWaitlist(query);
  }

  async createWaitlistEntry(input: CreateWaitlistInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    return tablesRepository.createWaitlist({ ...input, branchId });
  }

  async updateWaitlistStatus(id: string, status: WaitlistStatus, actorUserId?: string) {
    const existing = await tablesRepository.findWaitlistById(id);
    if (!existing) throw new NotFoundError('Waitlist entry');
    return tablesRepository.updateWaitlistStatus(id, status, actorUserId);
  }

  async deleteWaitlistEntry(id: string, actorUserId?: string) {
    const existing = await tablesRepository.findWaitlistById(id);
    if (!existing) throw new NotFoundError('Waitlist entry');
    await tablesRepository.softDeleteWaitlist(id, actorUserId);
  }
}

export const tablesService = new TablesService();

