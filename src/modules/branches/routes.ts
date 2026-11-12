import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdminOnly, requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { branchesController } from './controller';
import {
  branchIdParamSchema,
  branchQuerySchema,
  createBranchSchema,
  updateBranchSchema,
  updateCurrencySchema,
  updateLanguageSchema,
  upsertBranchSettingSchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Combined Multi-Currency & Multi-Language Localization
router.get(
  '/localization',
  asyncHandler((req, res) => branchesController.getLocalization(req, res))
);

// Multi-Currency Configuration (35 Currencies: PKR, USD, AED, SAR, GBP, EUR, etc.)
router.get(
  '/currencies',
  asyncHandler((req, res) => branchesController.getCurrencies(req, res))
);

// Strictly Admin-Only Currency Selection
router.patch(
  '/currency',
  requireAdminOnly(),
  validate({ body: updateCurrencySchema }),
  asyncHandler((req, res) => branchesController.updateCurrency(req, res))
);

router.patch(
  '/:id/currency',
  requireAdminOnly(),
  validate({ params: branchIdParamSchema, body: updateCurrencySchema }),
  asyncHandler((req, res) => branchesController.updateCurrency(req, res))
);

// Multi-Language Configuration (14 Languages: English, Urdu RTL, Arabic RTL, Spanish, French, Turkish, etc.)
router.get(
  '/languages',
  asyncHandler((req, res) => branchesController.getLanguages(req, res))
);

// Strictly Admin-Only Language Selection
router.patch(
  '/language',
  requireAdminOnly(),
  validate({ body: updateLanguageSchema }),
  asyncHandler((req, res) => branchesController.updateLanguage(req, res))
);

router.patch(
  '/:id/language',
  requireAdminOnly(),
  validate({ params: branchIdParamSchema, body: updateLanguageSchema }),
  asyncHandler((req, res) => branchesController.updateLanguage(req, res))
);

router.get(
  '/',
  requirePermission(PERMISSIONS.BRANCHES_VIEW),
  validate({ query: branchQuerySchema }),
  asyncHandler((req, res) => branchesController.list(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.BRANCHES_VIEW),
  validate({ params: branchIdParamSchema }),
  asyncHandler((req, res) => branchesController.getById(req, res))
);

router.post(
  '/',
  requireAdminOnly(),
  validate({ body: createBranchSchema }),
  asyncHandler((req, res) => branchesController.create(req, res))
);

router.patch(
  '/:id',
  requireAdminOnly(),
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  asyncHandler((req, res) => branchesController.update(req, res))
);

router.delete(
  '/:id',
  requireAdminOnly(),
  validate({ params: branchIdParamSchema }),
  asyncHandler((req, res) => branchesController.delete(req, res))
);

router.get(
  '/:id/settings',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  validate({ params: branchIdParamSchema }),
  asyncHandler((req, res) => branchesController.getSettings(req, res))
);

router.put(
  '/:id/settings',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ params: branchIdParamSchema, body: upsertBranchSettingSchema }),
  asyncHandler((req, res) => branchesController.upsertSetting(req, res))
);

export const branchesRoutes = router;
