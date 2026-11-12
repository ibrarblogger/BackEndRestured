import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { auditService } from './service';

export class AuditController {
  async list(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await auditService.listLogs({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Audit logs retrieved successfully', 200, meta);
  }

  async getById(req: Request, res: Response) {
    const log = await auditService.getLogById(String(req.params.id));
    return sendSuccess(res, log, 'Audit log retrieved successfully');
  }
}

export const auditController = new AuditController();
