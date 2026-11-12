import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { suppliersService } from './service';

export class SuppliersController {
  // Suppliers
  async listSuppliers(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await suppliersService.listSuppliers({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Suppliers retrieved successfully', 200, meta);
  }

  async getSupplierById(req: Request, res: Response) {
    const supplier = await suppliersService.getSupplierById(String(req.params.id));
    return sendSuccess(res, supplier, 'Supplier retrieved successfully');
  }

  async createSupplier(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const supplier = await suppliersService.createSupplier({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, supplier, 'Supplier created successfully', 201);
  }

  async updateSupplier(req: Request, res: Response) {
    const supplier = await suppliersService.updateSupplier(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, supplier, 'Supplier updated successfully');
  }

  async deleteSupplier(req: Request, res: Response) {
    await suppliersService.deleteSupplier(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Supplier deleted successfully');
  }

  // Purchase Orders
  async listPurchaseOrders(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await suppliersService.listPurchaseOrders({
      ...req.query,
      branchId,
    });
    return sendSuccess(
      res,
      items,
      'Purchase orders retrieved successfully',
      200,
      meta
    );
  }

  async getPurchaseOrderById(req: Request, res: Response) {
    const po = await suppliersService.getPurchaseOrderById(String(req.params.id));
    return sendSuccess(res, po, 'Purchase order retrieved successfully');
  }

  async createPurchaseOrder(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const po = await suppliersService.createPurchaseOrder({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, po, 'Purchase order created successfully', 201);
  }

  async updatePurchaseOrderStatus(req: Request, res: Response) {
    const po = await suppliersService.updatePurchaseOrderStatus(
      String(req.params.id),
      req.body.status,
      req.user?.sub
    );
    return sendSuccess(res, po, 'Purchase order status updated');
  }

  // Goods Receipts (GRN)
  async receiveGoods(req: Request, res: Response) {
    const result = await suppliersService.receiveGoods({
      purchaseOrderId: String(req.params.id),
      items: req.body.items,
      notes: req.body.notes,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(
      res,
      result,
      'Goods received, inventory stock incremented, and supplier balance updated',
      201
    );
  }

  async listGoodsReceipts(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, meta } = await suppliersService.listGoodsReceipts(
      branchId,
      page,
      limit
    );
    return sendSuccess(res, items, 'Goods receipts retrieved successfully', 200, meta);
  }

  // Supplier Payments & Ledger
  async createSupplierPayment(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await suppliersService.createSupplierPayment({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Supplier payment recorded successfully', 201);
  }

  async getSupplierLedger(req: Request, res: Response) {
    const ledger = await suppliersService.getSupplierLedger(String(req.params.id));
    return sendSuccess(res, ledger, 'Supplier ledger retrieved successfully');
  }
}

export const suppliersController = new SuppliersController();

