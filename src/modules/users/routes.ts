import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { usersController } from './controller';
import {
  assignPermissionsSchema,
  createRoleSchema,
  createUserSchema,
  idParamSchema,
  toggleUserStatusSchema,
  updateRoleSchema,
  updateUserSchema,
  userListQuerySchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Roles & Permissions endpoints
router.get(
  '/roles',
  requirePermission(PERMISSIONS.ROLES_VIEW),
  asyncHandler((req, res) => usersController.listRoles(req, res))
);

router.get(
  '/permissions',
  requirePermission(PERMISSIONS.ROLES_VIEW),
  asyncHandler((req, res) => usersController.listPermissions(req, res))
);

router.post(
  '/roles',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ body: createRoleSchema }),
  asyncHandler((req, res) => usersController.createRole(req, res))
);

router.patch(
  '/roles/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ params: idParamSchema, body: updateRoleSchema }),
  asyncHandler((req, res) => usersController.updateRole(req, res))
);

router.put(
  '/roles/:id/permissions',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ params: idParamSchema, body: assignPermissionsSchema }),
  asyncHandler((req, res) => usersController.assignPermissions(req, res))
);

router.delete(
  '/roles/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => usersController.deleteRole(req, res))
);

// Users CRUD endpoints
router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_VIEW),
  validate({ query: userListQuerySchema }),
  asyncHandler((req, res) => usersController.listUsers(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => usersController.getUserById(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate({ body: createUserSchema }),
  asyncHandler((req, res) => usersController.createUser(req, res))
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler((req, res) => usersController.updateUser(req, res))
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate({ params: idParamSchema, body: toggleUserStatusSchema }),
  asyncHandler((req, res) => usersController.setUserStatus(req, res))
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => usersController.deleteUser(req, res))
);

export const usersRoutes = router;

