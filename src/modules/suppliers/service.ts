import { PurchaseOrderStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { auditService } from '../audit/service';
import { suppliersRepository } from './repository';
import {
  CreatePurchaseOrderInput,
  CreateSupplierInput,
  CreateSupplierPaymentInput,
  ReceiveGoodsInput,
  UpdateSupplierInput,
} from './types';

export class SuppliersService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await suppliersRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  private generateCode(prefix: string): string {
    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}${String(now.getUTCDate()).padStart(2, '0')}`;
    const randPart = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${datePart}-${randPart}`;
  }

  // Suppliers
  async listSuppliers(query: any) {
    return suppliersRepository.findManySuppliers(query);
  }

  async getSupplierById(id: string) {
    const supplier = await suppliersRepository.findSupplierById(id);
    if (!supplier) throw new NotFoundError('Supplier');
    return supplier;
  }

  async createSupplier(input: CreateSupplierInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const created = await suppliersRepository.createSupplier({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'SUPPLIER_CREATED',
      entity: 'Supplier',
      entityId: created.id,
      newValues: { name: created.name, phone: created.phone },
    });

    return created;
  }

  async updateSupplier(id: string, input: UpdateSupplierInput) {
    const existing = await this.getSupplierById(id);
    const updated = await suppliersRepository.updateSupplier(id, input);

    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'SUPPLIER_UPDATED',
      entity: 'Supplier',
      entityId: id,
      oldValues: { name: existing.name },
      newValues: input as Record<string, any>,
    });

    return updated;
  }

  async deleteSupplier(id: string, actorUserId?: string) {
    const existing = await this.getSupplierById(id);
    await suppliersRepository.softDeleteSupplier(id, actorUserId);

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'SUPPLIER_DELETED',
      entity: 'Supplier',
      entityId: id,
    });
  }

  // Purchase Orders
  async listPurchaseOrders(query: any) {
    return suppliersRepository.findManyPurchaseOrders(query);
  }

  async getPurchaseOrderById(id: string) {
    const po = await suppliersRepository.findPurchaseOrderById(id);
    if (!po) throw new NotFoundError('Purchase order');
    return po;
  }

  async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    const supplier = await this.getSupplierById(input.supplierId);
    const branchId = input.branchId || supplier.branchId;
    const poNumber = this.generateCode('PO');

    const totalAmount = Number(
      input.items
        .reduce((sum, item) => sum + item.orderedQty * item.unitCost, 0)
        .toFixed(2)
    );

    const created = await suppliersRepository.createPurchaseOrder({
      ...input,
      branchId,
      poNumber,
      totalAmount,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'PURCHASE_ORDER_CREATED',
      entity: 'PurchaseOrder',
      entityId: created.id,
      newValues: {
        poNumber: created.poNumber,
        supplierId: created.supplierId,
        totalAmount,
        itemCount: input.items.length,
      },
    });

    return created;
  }

  async updatePurchaseOrderStatus(
    id: string,
    status: PurchaseOrderStatus,
    actorUserId?: string
  ) {
    const existing = await this.getPurchaseOrderById(id);
    if (existing.status === PurchaseOrderStatus.RECEIVED) {
      throw new ConflictError('Cannot change status of an already received purchase order');
    }

    const updated = await suppliersRepository.updatePurchaseOrderStatus(
      id,
      status,
      actorUserId
    );

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'PURCHASE_ORDER_STATUS_UPDATED',
      entity: 'PurchaseOrder',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status },
    });

    return updated;
  }

  // Goods Receipt Note (GRN)
  async receiveGoods(input: ReceiveGoodsInput) {
    const po = await this.getPurchaseOrderById(input.purchaseOrderId);
    if (po.status === PurchaseOrderStatus.CANCELLED) {
      throw new ValidationError('Cannot receive goods for a cancelled purchase order');
    }
    if (po.status === PurchaseOrderStatus.RECEIVED) {
      throw new ConflictError('Purchase order has already been fully received');
    }

    const grnNumber = this.generateCode('GRN');
    const result = await suppliersRepository.executeGoodsReceiptTransaction({
      ...input,
      grnNumber,
    });

    await auditService.log({
      branchId: po.branchId,
      userId: input.actorUserId,
      action: 'INVENTORY_ADJUST',
      entity: 'GoodsReceipt',
      entityId: result.goodsReceipt.id,
      newValues: {
        grnNumber,
        poNumber: po.poNumber,
        newPoStatus: result.purchaseOrder.status,
        totalReceivedValue: result.totalReceivedValue,
        itemsReceived: input.items,
      },
    });

    return result;
  }

  async listGoodsReceipts(branchId?: string, page = 1, limit = 20) {
    return suppliersRepository.findManyGoodsReceipts(branchId, page, limit);
  }

  // Supplier Payments & Ledger
  async createSupplierPayment(input: CreateSupplierPaymentInput) {
    const supplier = await this.getSupplierById(input.supplierId);
    const branchId = input.branchId || supplier.branchId;

    const result = await suppliersRepository.executeSupplierPaymentTransaction({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'SUPPLIER_PAYMENT_CREATED',
      entity: 'SupplierPayment',
      entityId: result.payment.id,
      oldValues: { previousBalanceDue: Number(supplier.balanceDue) },
      newValues: {
        amount: input.amount,
        method: input.method,
        newBalanceDue: Number(result.supplier.balanceDue),
      },
    });

    return result;
  }

  async getSupplierLedger(supplierId: string) {
    const supplier = await suppliersRepository.getSupplierLedger(supplierId);
    if (!supplier) throw new NotFoundError('Supplier');

    const totalPurchased = supplier.purchaseOrders.reduce(
      (sum, po) => sum + Number(po.totalAmount),
      0
    );
    const totalPaid = supplier.payments.reduce(
      (sum, pay) => sum + Number(pay.amount),
      0
    );

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        balanceDue: Number(supplier.balanceDue),
      },
      summary: {
        totalPurchaseOrders: supplier.purchaseOrders.length,
        totalPurchased: Number(totalPurchased.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        currentBalanceDue: Number(supplier.balanceDue),
      },
      purchaseOrders: supplier.purchaseOrders,
      payments: supplier.payments,
    };
  }
}

export const suppliersService = new SuppliersService();

