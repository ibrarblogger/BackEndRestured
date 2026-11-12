import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { notificationsController } from './controller';
import {
  createNotificationSchema,
  idParamSchema,
  notificationQuerySchema,
  updatePreferencesSchema,
} from './schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate({ query: notificationQuerySchema }),
  asyncHandler((req, res) => notificationsController.list(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ body: createNotificationSchema }),
  asyncHandler((req, res) => notificationsController.create(req, res))
);

router.patch(
  '/read-all',
  asyncHandler((req, res) => notificationsController.markAllAsRead(req, res))
);

router.get(
  '/preferences',
  asyncHandler((req, res) => notificationsController.getPreferences(req, res))
);

router.put(
  '/preferences',
  validate({ body: updatePreferencesSchema }),
  asyncHandler((req, res) => notificationsController.updatePreferences(req, res))
);

router.patch(
  '/:id/read',
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => notificationsController.markAsRead(req, res))
);

export { router as notificationsRoutes };

