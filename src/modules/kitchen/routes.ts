import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { kitchenController } from './controller';
import {
  idParamSchema,
  kitchenTicketQuerySchema,
  updateKitchenTicketStatusSchema,
} from './schema';

const router = Router();

router.use(authenticate);

router.get(
  '/stations',
  requirePermission(PERMISSIONS.KITCHEN_VIEW),
  asyncHandler((req, res) => kitchenController.getStationsSummary(req, res))
);

router.get(
  '/tickets',
  requirePermission(PERMISSIONS.KITCHEN_VIEW),
  validate({ query: kitchenTicketQuerySchema }),
  asyncHandler((req, res) => kitchenController.listTickets(req, res))
);

router.get(
  '/tickets/:id',
  requirePermission(PERMISSIONS.KITCHEN_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => kitchenController.getTicketById(req, res))
);

router.patch(
  '/tickets/:id/status',
  requirePermission(PERMISSIONS.KITCHEN_UPDATE),
  validate({ params: idParamSchema, body: updateKitchenTicketStatusSchema }),
  asyncHandler((req, res) => kitchenController.updateTicketStatus(req, res))
);

export const kitchenRoutes = router;

