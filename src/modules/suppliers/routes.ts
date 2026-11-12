import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { suppliersController } from './controller';
import {
  createPurchaseOrderSchema,
  createSupplierPaymentSchema,
  createSupplierSchema,
  idParamSchema,
  purchaseOrderQuerySchema,
  receiveGoodsSchema,
  supplierQuerySchema,
  updatePurchaseOrderStatusSchema,
  updateSupplierSchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Goods Receipts
router.get(
  '/goods-receipts',
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  asyncHandler((req, res) => suppliersController.listGoodsReceipts(req, res))
);

// Supplier Payments
router.post(
  '/payments',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  validate({ body: createSupplierPaymentSchema }),
  asyncHandler((req, res) => suppliersController.createSupplierPayment(req, res))
);

// Purchase Orders
router.get(
  '/purchase-orders',
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  validate({ query: purchaseOrderQuerySchema }),
  asyncHandler((req, res) => suppliersController.listPurchaseOrders(req, res))
);

router.get(
  '/purchase-orders/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => suppliersController.getPurchaseOrderById(req, res))
);

router.post(
  '/purchase-orders',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  validate({ body: createPurchaseOrderSchema }),
  asyncHandler((req, res) => suppliersController.createPurchaseOrder(req, res))
);

router.patch(
  '/purchase-orders/:id/status',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  validate({ params: idParamSchema, body: updatePurchaseOrderStatusSchema }),
  asyncHandler((req, res) => suppliersController.updatePurchaseOrderStatus(req, res))
);

router.post(
  '/purchase-orders/:id/receive',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  validate({ params: idParamSchema, body: receiveGoodsSchema }),
  asyncHandler((req, res) => suppliersController.receiveGoods(req, res))
);

// Suppliers CRUD & Ledger
router.get(
  '/',
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  validate({ query: supplierQuerySchema }),
  asyncHandler((req, res) => suppliersController.listSuppliers(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => suppliersController.getSupplierById(req, res))
);

router.get(
  '/:id/ledger',
  requirePermission(PERMISSIONS.SUPPLIERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => suppliersController.getSupplierLedger(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  validate({ body: createSupplierSchema }),
  asyncHandler((req, res) => suppliersController.createSupplier(req, res))
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  validate({ params: idParamSchema, body: updateSupplierSchema }),
  asyncHandler((req, res) => suppliersController.updateSupplier(req, res))
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => suppliersController.deleteSupplier(req, res))
);

export const suppliersRoutes = router;

