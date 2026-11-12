import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { uploadImageMiddleware } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { expensesController } from './controller';
import {
  accountingQuerySchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  expenseQuerySchema,
  idParamSchema,
  updateExpenseCategorySchema,
  updateExpenseSchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Accounting Statements
router.get(
  '/accounting/pnl',
  requirePermission(PERMISSIONS.ACCOUNTING_VIEW),
  validate({ query: accountingQuerySchema }),
  asyncHandler((req, res) => expensesController.getPnLReport(req, res))
);

router.get(
  '/accounting/daily-closing',
  requirePermission(PERMISSIONS.ACCOUNTING_VIEW),
  validate({ query: accountingQuerySchema }),
  asyncHandler((req, res) => expensesController.getDailyClosingReport(req, res))
);

router.get(
  '/accounting/cash-flow',
  requirePermission(PERMISSIONS.ACCOUNTING_VIEW),
  validate({ query: accountingQuerySchema }),
  asyncHandler((req, res) => expensesController.getCashFlowReport(req, res))
);

router.get(
  '/accounting/tax-report',
  requirePermission(PERMISSIONS.ACCOUNTING_VIEW),
  validate({ query: accountingQuerySchema }),
  asyncHandler((req, res) => expensesController.getTaxReport(req, res))
);

// Receipt Upload
router.post(
  '/upload-receipt',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  uploadImageMiddleware.single('file'),
  asyncHandler((req, res) => expensesController.uploadReceipt(req, res))
);

// Expense Categories
router.get(
  '/categories',
  requirePermission(PERMISSIONS.EXPENSES_VIEW),
  asyncHandler((req, res) => expensesController.listCategories(req, res))
);

router.post(
  '/categories',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  validate({ body: createExpenseCategorySchema }),
  asyncHandler((req, res) => expensesController.createCategory(req, res))
);

router.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  validate({ params: idParamSchema, body: updateExpenseCategorySchema }),
  asyncHandler((req, res) => expensesController.updateCategory(req, res))
);

router.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => expensesController.deleteCategory(req, res))
);

// Expenses CRUD
router.get(
  '/',
  requirePermission(PERMISSIONS.EXPENSES_VIEW),
  validate({ query: expenseQuerySchema }),
  asyncHandler((req, res) => expensesController.listExpenses(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.EXPENSES_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => expensesController.getExpenseById(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  validate({ body: createExpenseSchema }),
  asyncHandler((req, res) => expensesController.createExpense(req, res))
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  validate({ params: idParamSchema, body: updateExpenseSchema }),
  asyncHandler((req, res) => expensesController.updateExpense(req, res))
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.EXPENSES_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => expensesController.deleteExpense(req, res))
);

export const expensesRoutes = router;

