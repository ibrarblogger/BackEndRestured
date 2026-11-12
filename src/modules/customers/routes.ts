import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { customersController } from './controller';
import {
  createCouponSchema,
  createCustomerSchema,
  createFeedbackSchema,
  customerQuerySchema,
  earnRedeemPointsSchema,
  feedbackQuerySchema,
  idParamSchema,
  triggerCampaignSchema,
  updateCouponSchema,
  updateCustomerSchema,
  validateCouponSchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Segments & Campaigns
router.get(
  '/segments',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  asyncHandler((req, res) => customersController.getSegmentsSummary(req, res))
);

router.post(
  '/campaigns/trigger',
  requirePermission(PERMISSIONS.LOYALTY_MANAGE),
  validate({ body: triggerCampaignSchema }),
  asyncHandler((req, res) => customersController.triggerCampaign(req, res))
);

// Coupons
router.get(
  '/coupons',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  asyncHandler((req, res) => customersController.listCoupons(req, res))
);

router.post(
  '/coupons',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ body: createCouponSchema }),
  asyncHandler((req, res) => customersController.createCoupon(req, res))
);

router.post(
  '/coupons/validate',
  requirePermission(PERMISSIONS.ORDERS_CREATE),
  validate({ body: validateCouponSchema }),
  asyncHandler((req, res) => customersController.validateCoupon(req, res))
);

router.patch(
  '/coupons/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ params: idParamSchema, body: updateCouponSchema }),
  asyncHandler((req, res) => customersController.updateCoupon(req, res))
);

router.delete(
  '/coupons/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => customersController.deleteCoupon(req, res))
);

// Feedbacks
router.get(
  '/feedbacks',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ query: feedbackQuerySchema }),
  asyncHandler((req, res) => customersController.listFeedbacks(req, res))
);

router.post(
  '/feedbacks',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ body: createFeedbackSchema }),
  asyncHandler((req, res) => customersController.createFeedback(req, res))
);

router.patch(
  '/feedbacks/:id/resolve',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => customersController.resolveFeedback(req, res))
);

// Customers CRUD & Loyalty
router.get(
  '/',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ query: customerQuerySchema }),
  asyncHandler((req, res) => customersController.listCustomers(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => customersController.getCustomerById(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ body: createCustomerSchema }),
  asyncHandler((req, res) => customersController.createCustomer(req, res))
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  asyncHandler((req, res) => customersController.updateCustomer(req, res))
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => customersController.deleteCustomer(req, res))
);

router.get(
  '/:id/loyalty',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => customersController.getLoyaltyHistory(req, res))
);

router.post(
  '/:id/loyalty/earn',
  requirePermission(PERMISSIONS.LOYALTY_MANAGE),
  validate({ params: idParamSchema, body: earnRedeemPointsSchema }),
  asyncHandler((req, res) => customersController.earnPoints(req, res))
);

router.post(
  '/:id/loyalty/redeem',
  requirePermission(PERMISSIONS.LOYALTY_MANAGE),
  validate({ params: idParamSchema, body: earnRedeemPointsSchema }),
  asyncHandler((req, res) => customersController.redeemPoints(req, res))
);

export const customersRoutes = router;

