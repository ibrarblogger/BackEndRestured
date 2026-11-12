import { ReservationStatus, TableStatus, WaitlistStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const idParamSchema = z.object({
  id: z.string().uuid('Valid UUID is required'),
});

export const createFloorSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  floorNumber: z.coerce.number().int().default(1),
  isActive: z.boolean().default(true),
});

export const updateFloorSchema = createFloorSchema.partial();

export const tableQuerySchema = paginationQuerySchema.extend({
  floorId: z.string().uuid().optional(),
  status: z.nativeEnum(TableStatus).optional(),
});

export const createTableSchema = z.object({
  branchId: z.string().uuid().optional(),
  floorId: z.string().uuid('Valid floorId is required'),
  tableNumber: z.string().min(1).max(30).transform((v) => v.toUpperCase().trim()),
  capacity: z.coerce.number().int().min(1).max(50).default(4),
  status: z.nativeEnum(TableStatus).default(TableStatus.AVAILABLE),
  shape: z.enum(['RECTANGLE', 'CIRCLE', 'SQUARE']).default('RECTANGLE'),
  posX: z.coerce.number().default(0),
  posY: z.coerce.number().default(0),
  width: z.coerce.number().default(100),
  height: z.coerce.number().default(100),
  qrCodeUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export const updateTableSchema = createTableSchema.partial();

export const updateTableStatusSchema = z.object({
  status: z.nativeEnum(TableStatus),
});

export const updateLayoutSchema = z.object({
  tables: z
    .array(
      z.object({
        id: z.string().uuid(),
        posX: z.coerce.number(),
        posY: z.coerce.number(),
        width: z.coerce.number().optional(),
        height: z.coerce.number().optional(),
        shape: z.enum(['RECTANGLE', 'CIRCLE', 'SQUARE']).optional(),
      })
    )
    .min(1),
});

export const reservationQuerySchema = paginationQuerySchema.extend({
  tableId: z.string().uuid().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
  date: z.string().optional(),
});

export const createReservationSchema = z.object({
  branchId: z.string().uuid().optional(),
  tableId: z.string().uuid('Valid tableId is required'),
  customerId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(120),
  guestPhone: z.string().min(5).max(30),
  guestEmail: z.string().email().optional(),
  partySize: z.coerce.number().int().min(1).max(50),
  reservationTime: z.string().datetime('Valid ISO 8601 reservationTime is required'),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(90),
  specialRequests: z.string().max(500).optional(),
});

export const updateReservationSchema = createReservationSchema.partial().extend({
  status: z.nativeEnum(ReservationStatus).optional(),
});

export const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
});

export const waitlistQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(WaitlistStatus).optional(),
});

export const createWaitlistSchema = z.object({
  branchId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(120),
  guestPhone: z.string().min(5).max(30),
  partySize: z.coerce.number().int().min(1).max(50),
  estimatedWaitMinutes: z.coerce.number().int().min(1).max(240).default(15),
  notes: z.string().max(500).optional(),
});

export const updateWaitlistStatusSchema = z.object({
  status: z.nativeEnum(WaitlistStatus),
});

