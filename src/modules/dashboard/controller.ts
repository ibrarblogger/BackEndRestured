import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { dashboardService } from './service';

export class DashboardController {
  async getKpis(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const kpis = await dashboardService.getKpis({
      branchId,
      days: req.query.days ? Number(req.query.days) : 7,
      lang: req.query.lang ? String(req.query.lang) : undefined,
      refresh: req.query.refresh === 'true',
    });
    return sendSuccess(res, kpis, 'Dashboard KPIs retrieved successfully');
  }
}

export const dashboardController = new DashboardController();

