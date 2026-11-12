import { ReservationStatus, TableStatus, WaitlistStatus } from '@prisma/client';

export interface CreateFloorInput {
  branchId: string;
  name: string;
  floorNumber?: number;
  isActive?: boolean;
  actorUserId?: string;
}

export type UpdateFloorInput = Partial<CreateFloorInput>;

export interface CreateTableInput {
  branchId: string;
  floorId: string;
  tableNumber: string;
  capacity?: number;
  status?: TableStatus;
  shape?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  qrCodeUrl?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export type UpdateTableInput = Partial<CreateTableInput>;

export interface TablePositionItem {
  id: string;
  posX: number;
  posY: number;
  width?: number;
  height?: number;
  shape?: string;
}

export interface CreateReservationInput {
  branchId: string;
  tableId: string;
  customerId?: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  partySize: number;
  reservationTime: string;
  durationMinutes?: number;
  specialRequests?: string;
  actorUserId?: string;
}

export interface UpdateReservationInput extends Partial<CreateReservationInput> {
  status?: ReservationStatus;
}

export interface CreateWaitlistInput {
  branchId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  estimatedWaitMinutes?: number;
  notes?: string;
  actorUserId?: string;
}

export interface UpdateWaitlistStatusInput {
  status: WaitlistStatus;
  actorUserId?: string;
}

