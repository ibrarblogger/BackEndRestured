import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { paymentsController } from './controller';
import {
  cashDrawerQuerySchema,
  closeCashDrawerSchema,
  createDiscountSchema,
  createRefundSchema,
  createTaxRateSchema,
  idParamSchema,
  openCashDrawerSchema,
  paymentQuerySchema,
  paymentWebhookSchema,
  processPaymentSchema,
  updateDiscountSchema,
  updateTaxRateSchema,
} from './schema';

const router = Router();

// Public webhook endpoint for payment gateway callbacks (idempotent)
router.post(
  '/webhook',
  validate({ body: paymentWebhookSchema }),
  asyncHandler((req, res) => paymentsController.handleWebhook(req, res))
);

router.use(authenticate);

// Cash Drawer Sessions
router.get(
  '/cash-drawer/current',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  asyncHandler((req, res) => paymentsController.getCurrentCashDrawer(req, res))
);

router.get(
  '/cash-drawer',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  validate({ query: cashDrawerQuerySchema }),
  asyncHandler((req, res) => paymentsController.listCashDrawers(req, res))
);

router.get(
  '/cash-drawer/:id',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => paymentsController.getCashDrawerById(req, res))
);

router.post(
  '/cash-drawer/open',
  requirePermission(PERMISSIONS.CASH_DRAWER_MANAGE),
  validate({ body: openCashDrawerSchema }),
  asyncHandler((req, res) => paymentsController.openCashDrawer(req, res))
);

router.post(
  '/cash-drawer/:id/close',
  requirePermission(PERMISSIONS.CASH_DRAWER_MANAGE),
  validate({ params: idParamSchema, body: closeCashDrawerSchema }),
  asyncHandler((req, res) => paymentsController.closeCashDrawer(req, res))
);

// Tax Rates
router.get(
  '/tax-rates',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  asyncHandler((req, res) => paymentsController.listTaxRates(req, res))
);

router.post(
  '/tax-rates',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ body: createTaxRateSchema }),
  asyncHandler((req, res) => paymentsController.createTaxRate(req, res))
);

router.patch(
  '/tax-rates/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ params: idParamSchema, body: updateTaxRateSchema }),
  asyncHandler((req, res) => paymentsController.updateTaxRate(req, res))
);

router.delete(
  '/tax-rates/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => paymentsController.deleteTaxRate(req, res))
);

// Discounts
router.get(
  '/discounts',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  asyncHandler((req, res) => paymentsController.listDiscounts(req, res))
);

router.post(
  '/discounts',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ body: createDiscountSchema }),
  asyncHandler((req, res) => paymentsController.createDiscount(req, res))
);

router.patch(
  '/discounts/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ params: idParamSchema, body: updateDiscountSchema }),
  asyncHandler((req, res) => paymentsController.updateDiscount(req, res))
);

router.delete(
  '/discounts/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => paymentsController.deleteDiscount(req, res))
);

// Refunds
router.get(
  '/refunds',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  asyncHandler((req, res) => paymentsController.listRefunds(req, res))
);

// Payments
router.get(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  validate({ query: paymentQuerySchema }),
  asyncHandler((req, res) => paymentsController.listPayments(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => paymentsController.getPaymentById(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS_PROCESS),
  validate({ body: processPaymentSchema }),
  asyncHandler((req, res) => paymentsController.processPayment(req, res))
);

router.post(
  '/:id/refund',
  requirePermission(PERMISSIONS.ORDERS_REFUND),
  validate({ params: idParamSchema, body: createRefundSchema }),
  asyncHandler((req, res) => paymentsController.refundPayment(req, res))
);

export const paymentsRoutes = router;

