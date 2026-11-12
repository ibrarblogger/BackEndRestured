import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { uploadCsvMiddleware, uploadImageMiddleware } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { menuController } from './controller';
import {
  addOnInputSchema,
  categoryQuerySchema,
  createCategorySchema,
  createComboSchema,
  createMenuItemSchema,
  idParamSchema,
  menuItemQuerySchema,
  toggleAvailabilitySchema,
  updateCategorySchema,
  updateComboSchema,
  updateDaypartSchema,
  updateMenuItemSchema,
  variantInputSchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Image Upload (Supabase Storage `menu-images` bucket with local fallback)
router.post(
  '/upload-image',
  requirePermission(PERMISSIONS.MENU_CREATE),
  uploadImageMiddleware.single('file'),
  asyncHandler((req, res) => menuController.uploadImage(req, res))
);

// Categories
router.get(
  '/categories',
  requirePermission(PERMISSIONS.MENU_VIEW),
  validate({ query: categoryQuerySchema }),
  asyncHandler((req, res) => menuController.listCategories(req, res))
);

router.get(
  '/categories/:id',
  requirePermission(PERMISSIONS.MENU_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.getCategoryById(req, res))
);

router.post(
  '/categories',
  requirePermission(PERMISSIONS.MENU_CREATE),
  validate({ body: createCategorySchema }),
  asyncHandler((req, res) => menuController.createCategory(req, res))
);

router.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  asyncHandler((req, res) => menuController.updateCategory(req, res))
);

router.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.MENU_DELETE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.deleteCategory(req, res))
);

// Menu Items CSV Export / Import
router.get(
  '/items/export/csv',
  requirePermission(PERMISSIONS.MENU_VIEW),
  asyncHandler((req, res) => menuController.exportCsv(req, res))
);

router.post(
  '/items/import/csv',
  requirePermission(PERMISSIONS.MENU_CREATE),
  uploadCsvMiddleware.single('file'),
  asyncHandler((req, res) => menuController.importCsv(req, res))
);

// Menu Items CRUD
router.get(
  '/items',
  requirePermission(PERMISSIONS.MENU_VIEW),
  validate({ query: menuItemQuerySchema }),
  asyncHandler((req, res) => menuController.listMenuItems(req, res))
);

router.get(
  '/items/:id',
  requirePermission(PERMISSIONS.MENU_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.getMenuItemById(req, res))
);

router.post(
  '/items',
  requirePermission(PERMISSIONS.MENU_CREATE),
  validate({ body: createMenuItemSchema }),
  asyncHandler((req, res) => menuController.createMenuItem(req, res))
);

router.patch(
  '/items/:id',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: updateMenuItemSchema }),
  asyncHandler((req, res) => menuController.updateMenuItem(req, res))
);

router.patch(
  '/items/:id/availability',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: toggleAvailabilitySchema }),
  asyncHandler((req, res) => menuController.toggleAvailability(req, res))
);

router.patch(
  '/items/:id/daypart',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: updateDaypartSchema }),
  asyncHandler((req, res) => menuController.updateDaypart(req, res))
);

router.delete(
  '/items/:id',
  requirePermission(PERMISSIONS.MENU_DELETE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.deleteMenuItem(req, res))
);

// Variants & Add-ons
router.post(
  '/items/:id/variants',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: variantInputSchema }),
  asyncHandler((req, res) => menuController.addVariant(req, res))
);

router.delete(
  '/variants/:id',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.deleteVariant(req, res))
);

router.post(
  '/items/:id/addons',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: addOnInputSchema }),
  asyncHandler((req, res) => menuController.addAddOn(req, res))
);

router.delete(
  '/addons/:id',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.deleteAddOn(req, res))
);

// Combos
router.get(
  '/combos',
  requirePermission(PERMISSIONS.MENU_VIEW),
  asyncHandler((req, res) => menuController.listCombos(req, res))
);

router.get(
  '/combos/:id',
  requirePermission(PERMISSIONS.MENU_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.getComboById(req, res))
);

router.post(
  '/combos',
  requirePermission(PERMISSIONS.MENU_CREATE),
  validate({ body: createComboSchema }),
  asyncHandler((req, res) => menuController.createCombo(req, res))
);

router.patch(
  '/combos/:id',
  requirePermission(PERMISSIONS.MENU_UPDATE),
  validate({ params: idParamSchema, body: updateComboSchema }),
  asyncHandler((req, res) => menuController.updateCombo(req, res))
);

router.delete(
  '/combos/:id',
  requirePermission(PERMISSIONS.MENU_DELETE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => menuController.deleteCombo(req, res))
);

export const menuRoutes = router;

