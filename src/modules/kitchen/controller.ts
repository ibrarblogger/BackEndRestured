import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { kitchenService } from './service';

export class KitchenController {
  async listTickets(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await kitchenService.listTickets({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Kitchen tickets retrieved successfully', 200, meta);
  }

  async getStationsSummary(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const summary = await kitchenService.getStationsSummary(branchId);
    return sendSuccess(res, summary, 'Kitchen stations summary retrieved successfully');
  }

  async getTicketById(req: Request, res: Response) {
    const ticket = await kitchenService.getTicketById(String(req.params.id));
    return sendSuccess(res, ticket, 'Kitchen ticket retrieved successfully');
  }

  async updateTicketStatus(req: Request, res: Response) {
    const ticket = await kitchenService.updateTicketStatus(
      String(req.params.id),
      req.body.status,
      req.user?.sub
    );
    return sendSuccess(
      res,
      ticket,
      `Kitchen ticket status updated to ${req.body.status}`
    );
  }
}

export const kitchenController = new KitchenController();

