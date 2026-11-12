import { Router } from 'express';
import { PERMISSIONS } from '../constants/permissions';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission, resolveBranchScope } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { jobQueue } from './queue';

const router = Router();

router.use(authenticate);

router.get(
  '/status',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  asyncHandler(async (_req, res) => {
    return sendSuccess(
      res,
      jobQueue.getStatusSummary(),
      'Background job queue status retrieved'
    );
  })
);

router.post(
  '/low-stock-scan',
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchScope(req);
    const job = await jobQueue.enqueue('LOW_STOCK_SCAN', { branchId });
    return sendSuccess(res, job, 'Low stock scan job queued', 202);
  })
);

router.post(
  '/daily-closing-digest',
  requirePermission(PERMISSIONS.ACCOUNTING_VIEW),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchScope(req);
    const job = await jobQueue.enqueue('DAILY_CLOSING_DIGEST', { branchId });
    return sendSuccess(res, job, 'Daily closing digest job queued', 202);
  })
);

export { router as jobsRoutes };

