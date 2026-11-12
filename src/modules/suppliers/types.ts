import { PaymentMethod, PurchaseOrderStatus } from '@prisma/client';

export interface CreateSupplierInput {
  branchId?: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export interface PurchaseOrderItemInput {
  ingredientId: string;
  orderedQty: number;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  branchId?: string;
  supplierId: string;
  expectedDate?: string | Date;
  notes?: string;
  status?: PurchaseOrderStatus;
  items: PurchaseOrderItemInput[];
  actorUserId?: string;
}

export interface ReceiveGoodsItemInput {
  ingredientId: string;
  receivedQty: number;
  unitCost?: number;
  expiryDate?: string;
  batchNo?: string;
}

export interface ReceiveGoodsInput {
  purchaseOrderId: string;
  items: ReceiveGoodsItemInput[];
  notes?: string;
  actorUserId?: string;
}

export interface CreateSupplierPaymentInput {
  branchId?: string;
  supplierId: string;
  purchaseOrderId?: string;
  amount: number;
  method: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  actorUserId?: string;
}

