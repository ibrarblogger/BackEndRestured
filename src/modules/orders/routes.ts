import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ordersController } from './controller';
import {
  cancelOrderSchema,
  createOrderSchema,
  idParamSchema,
  mergeOrdersSchema,
  orderQuerySchema,
  splitOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from './schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.ORDERS_VIEW),
  validate({ query: orderQuerySchema }),
  asyncHandler((req, res) => ordersController.listOrders(req, res))
);

router.post(
  '/merge',
  requirePermission(PERMISSIONS.ORDERS_UPDATE),
  validate({ body: mergeOrdersSchema }),
  asyncHandler((req, res) => ordersController.mergeOrders(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => ordersController.getOrderById(req, res))
);

router.get(
  '/:id/invoice/pdf',
  requirePermission(PERMISSIONS.ORDERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => ordersController.downloadInvoicePdf(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.ORDERS_CREATE),
  validate({ body: createOrderSchema }),
  asyncHandler((req, res) => ordersController.createOrder(req, res))
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ORDERS_UPDATE),
  validate({ params: idParamSchema, body: updateOrderSchema }),
  asyncHandler((req, res) => ordersController.updateOrder(req, res))
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ORDERS_UPDATE),
  validate({ params: idParamSchema, body: updateOrderStatusSchema }),
  asyncHandler((req, res) => ordersController.updateStatus(req, res))
);

router.post(
  '/:id/hold',
  requirePermission(PERMISSIONS.ORDERS_UPDATE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => ordersController.holdOrder(req, res))
);

router.post(
  '/:id/resume',
  requirePermission(PERMISSIONS.ORDERS_UPDATE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => ordersController.resumeOrder(req, res))
);

router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.ORDERS_CANCEL),
  validate({ params: idParamSchema, body: cancelOrderSchema }),
  asyncHandler((req, res) => ordersController.cancelOrder(req, res))
);

router.post(
  '/:id/split',
  requirePermission(PERMISSIONS.ORDERS_UPDATE),
  validate({ params: idParamSchema, body: splitOrderSchema }),
  asyncHandler((req, res) => ordersController.splitOrder(req, res))
);

export const ordersRoutes = router;

