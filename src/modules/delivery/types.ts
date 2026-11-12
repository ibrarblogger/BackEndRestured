import { DeliveryStatus } from '@prisma/client';

export interface CreateDeliveryZoneInput {
  branchId?: string;
  name: string;
  deliveryFee: number;
  minOrderAmount?: number;
  estimatedTimeMin?: number;
  isActive?: boolean;
}

export interface UpdateDeliveryZoneInput {
  name?: string;
  deliveryFee?: number;
  minOrderAmount?: number;
  estimatedTimeMin?: number;
  isActive?: boolean;
}

export interface CreateRiderInput {
  branchId?: string;
  name: string;
  phone: string;
  vehicleNo?: string;
  status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  isActive?: boolean;
}

export interface UpdateRiderInput {
  name?: string;
  phone?: string;
  vehicleNo?: string;
  status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  isActive?: boolean;
}

export interface DispatchDeliveryInput {
  branchId?: string;
  orderId: string;
  zoneId?: string;
  riderId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryFee?: number;
  notes?: string;
  actorUserId?: string;
}

export interface AssignRiderInput {
  riderId: string;
  actorUserId?: string;
}

export interface UpdateDeliveryStatusInput {
  status: DeliveryStatus;
  notes?: string;
  actorUserId?: string;
}

