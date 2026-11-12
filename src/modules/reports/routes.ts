import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportsController } from './controller';
import { reportQuerySchema } from './schema';

const router = Router();

router.use(authenticate);
router.use(requirePermission(PERMISSIONS.REPORTS_VIEW));

router.get(
  '/sales-by-item',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.salesByItem(req, res))
);

router.get(
  '/sales-by-category',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.salesByCategory(req, res))
);

router.get(
  '/sales-by-staff',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.salesByStaff(req, res))
);

router.get(
  '/sales-by-payment',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.salesByPayment(req, res))
);

router.get(
  '/sales-by-time',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.salesByTime(req, res))
);

router.get(
  '/inventory-valuation',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.inventoryValuation(req, res))
);

router.get(
  '/wastage',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.wastage(req, res))
);

router.get(
  '/customer-retention',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.customerRetention(req, res))
);

router.get(
  '/discount-usage',
  validate({ query: reportQuerySchema }),
  asyncHandler((req, res) => reportsController.discountUsage(req, res))
);

export { router as reportsRoutes };

