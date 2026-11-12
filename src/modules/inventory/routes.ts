import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { inventoryController } from './controller';
import {
  createIngredientSchema,
  createWastageSchema,
  idParamSchema,
  ingredientQuerySchema,
  menuItemIdParamSchema,
  stockAdjustmentSchema,
  stockMovementQuerySchema,
  stockTakeSchema,
  updateIngredientSchema,
  upsertRecipeSchema,
  wastageQuerySchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Alerts
router.get(
  '/alerts/low-stock',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler((req, res) => inventoryController.getLowStockAlerts(req, res))
);

router.get(
  '/alerts/expiring',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler((req, res) => inventoryController.getExpiringAlerts(req, res))
);

// Stock Adjustments & Movements
router.get(
  '/movements',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  validate({ query: stockMovementQuerySchema }),
  asyncHandler((req, res) => inventoryController.listStockMovements(req, res))
);

router.post(
  '/adjustments',
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  validate({ body: stockAdjustmentSchema }),
  asyncHandler((req, res) => inventoryController.adjustStock(req, res))
);

// Wastage
router.get(
  '/wastage',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  validate({ query: wastageQuerySchema }),
  asyncHandler((req, res) => inventoryController.listWastageLogs(req, res))
);

router.post(
  '/wastage',
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  validate({ body: createWastageSchema }),
  asyncHandler((req, res) => inventoryController.recordWastage(req, res))
);

// Stock-Take / Physical Audit Reconciliation
router.post(
  '/stock-take',
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  validate({ body: stockTakeSchema }),
  asyncHandler((req, res) => inventoryController.reconcileStockTake(req, res))
);

// Recipes
router.get(
  '/recipes',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler((req, res) => inventoryController.listRecipes(req, res))
);

router.get(
  '/recipes/:menuItemId',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  validate({ params: menuItemIdParamSchema }),
  asyncHandler((req, res) => inventoryController.getRecipeByMenuItemId(req, res))
);

router.post(
  '/recipes',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validate({ body: upsertRecipeSchema }),
  asyncHandler((req, res) => inventoryController.upsertRecipe(req, res))
);

router.delete(
  '/recipes/:menuItemId',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validate({ params: menuItemIdParamSchema }),
  asyncHandler((req, res) => inventoryController.deleteRecipe(req, res))
);

// Ingredients CRUD
router.get(
  '/ingredients',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  validate({ query: ingredientQuerySchema }),
  asyncHandler((req, res) => inventoryController.listIngredients(req, res))
);

router.get(
  '/ingredients/:id',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => inventoryController.getIngredientById(req, res))
);

router.post(
  '/ingredients',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validate({ body: createIngredientSchema }),
  asyncHandler((req, res) => inventoryController.createIngredient(req, res))
);

router.patch(
  '/ingredients/:id',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validate({ params: idParamSchema, body: updateIngredientSchema }),
  asyncHandler((req, res) => inventoryController.updateIngredient(req, res))
);

router.delete(
  '/ingredients/:id',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => inventoryController.deleteIngredient(req, res))
);

export const inventoryRoutes = router;

