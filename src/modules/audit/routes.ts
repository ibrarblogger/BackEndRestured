import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { auditController } from './controller';
import { auditLogIdParamSchema, auditLogQuerySchema } from './schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validate({ query: auditLogQuerySchema }),
  asyncHandler((req, res) => auditController.list(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validate({ params: auditLogIdParamSchema }),
  asyncHandler((req, res) => auditController.getById(req, res))
);

export const auditRoutes = router;

