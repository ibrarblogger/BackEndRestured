import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { dashboardController } from './controller';
import { dashboardQuerySchema } from './schema';

const router = Router();

router.use(authenticate);

router.get(
  '/kpis',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validate({ query: dashboardQuerySchema }),
  asyncHandler((req, res) => dashboardController.getKpis(req, res))
);

export { router as dashboardRoutes };

