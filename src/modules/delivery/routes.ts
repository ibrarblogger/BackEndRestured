import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { deliveryController } from './controller';
import {
  assignRiderSchema,
  createRiderSchema,
  createZoneSchema,
  deliveryQuerySchema,
  dispatchDeliverySchema,
  idParamSchema,
  riderQuerySchema,
  updateDeliveryStatusSchema,
  updateRiderSchema,
  updateZoneSchema,
  zoneQuerySchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Zones
router.get(
  '/zones',
  requirePermission(PERMISSIONS.DELIVERY_VIEW),
  validate({ query: zoneQuerySchema }),
  asyncHandler((req, res) => deliveryController.listZones(req, res))
);

router.post(
  '/zones',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ body: createZoneSchema }),
  asyncHandler((req, res) => deliveryController.createZone(req, res))
);

router.patch(
  '/zones/:id',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ params: idParamSchema, body: updateZoneSchema }),
  asyncHandler((req, res) => deliveryController.updateZone(req, res))
);

router.delete(
  '/zones/:id',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => deliveryController.deleteZone(req, res))
);

// Riders
router.get(
  '/riders',
  requirePermission(PERMISSIONS.DELIVERY_VIEW),
  validate({ query: riderQuerySchema }),
  asyncHandler((req, res) => deliveryController.listRiders(req, res))
);

router.post(
  '/riders',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ body: createRiderSchema }),
  asyncHandler((req, res) => deliveryController.createRider(req, res))
);

router.patch(
  '/riders/:id',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ params: idParamSchema, body: updateRiderSchema }),
  asyncHandler((req, res) => deliveryController.updateRider(req, res))
);

router.delete(
  '/riders/:id',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => deliveryController.deleteRider(req, res))
);

// Deliveries
router.get(
  '/',
  requirePermission(PERMISSIONS.DELIVERY_VIEW),
  validate({ query: deliveryQuerySchema }),
  asyncHandler((req, res) => deliveryController.listDeliveries(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ body: dispatchDeliverySchema }),
  asyncHandler((req, res) => deliveryController.dispatchDelivery(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.DELIVERY_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => deliveryController.getDeliveryById(req, res))
);

router.patch(
  '/:id/assign',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ params: idParamSchema, body: assignRiderSchema }),
  asyncHandler((req, res) => deliveryController.assignRider(req, res))
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.DELIVERY_MANAGE),
  validate({ params: idParamSchema, body: updateDeliveryStatusSchema }),
  asyncHandler((req, res) => deliveryController.updateStatus(req, res))
);

export { router as deliveryRoutes };

