import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { tablesService } from './service';

export class TablesController {
  // Floors
  async listFloors(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const floors = await tablesService.listFloors(branchId);
    return sendSuccess(res, floors, 'Floors retrieved successfully');
  }

  async createFloor(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const floor = await tablesService.createFloor({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, floor, 'Floor created successfully', 201);
  }

  async updateFloor(req: Request, res: Response) {
    const floor = await tablesService.updateFloor(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, floor, 'Floor updated successfully');
  }

  async deleteFloor(req: Request, res: Response) {
    await tablesService.deleteFloor(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Floor deleted successfully');
  }

  // Tables
  async listTables(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await tablesService.listTables({ ...req.query, branchId });
    return sendSuccess(res, items, 'Tables retrieved successfully', 200, meta);
  }

  async getTableById(req: Request, res: Response) {
    const table = await tablesService.getTableById(String(req.params.id));
    return sendSuccess(res, table, 'Table retrieved successfully');
  }

  async createTable(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const table = await tablesService.createTable({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, table, 'Table created successfully', 201);
  }

  async updateTable(req: Request, res: Response) {
    const table = await tablesService.updateTable(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, table, 'Table updated successfully');
  }

  async updateTableStatus(req: Request, res: Response) {
    const table = await tablesService.updateTableStatus(
      String(req.params.id),
      req.body.status,
      req.user?.sub
    );
    return sendSuccess(res, table, 'Table status updated successfully');
  }

  async updateLayout(req: Request, res: Response) {
    const updated = await tablesService.updateFloorLayout(req.body.tables, req.user?.sub);
    return sendSuccess(res, updated, 'Floor layout positions updated successfully');
  }

  async deleteTable(req: Request, res: Response) {
    await tablesService.deleteTable(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Table deleted successfully');
  }

  // Reservations
  async listReservations(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await tablesService.listReservations({ ...req.query, branchId });
    return sendSuccess(res, items, 'Reservations retrieved successfully', 200, meta);
  }

  async getReservationById(req: Request, res: Response) {
    const reservation = await tablesService.getReservationById(String(req.params.id));
    return sendSuccess(res, reservation, 'Reservation retrieved successfully');
  }

  async createReservation(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const reservation = await tablesService.createReservation({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, reservation, 'Reservation created successfully', 201);
  }

  async updateReservation(req: Request, res: Response) {
    const reservation = await tablesService.updateReservation(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, reservation, 'Reservation updated successfully');
  }

  async updateReservationStatus(req: Request, res: Response) {
    const reservation = await tablesService.updateReservationStatus(
      String(req.params.id),
      req.body.status,
      req.user?.sub
    );
    return sendSuccess(res, reservation, 'Reservation status updated successfully');
  }

  async markNoShows(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const result = await tablesService.processNoShows(branchId);
    return sendSuccess(res, result, `Marked ${result.markedCount} overdue reservation(s) as NO_SHOW`);
  }

  // Waitlist
  async listWaitlist(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await tablesService.listWaitlist({ ...req.query, branchId });
    return sendSuccess(res, items, 'Waitlist retrieved successfully', 200, meta);
  }

  async createWaitlist(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const entry = await tablesService.createWaitlistEntry({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, entry, 'Added to waitlist successfully', 201);
  }

  async updateWaitlistStatus(req: Request, res: Response) {
    const entry = await tablesService.updateWaitlistStatus(
      String(req.params.id),
      req.body.status,
      req.user?.sub
    );
    return sendSuccess(res, entry, 'Waitlist status updated successfully');
  }

  async deleteWaitlist(req: Request, res: Response) {
    await tablesService.deleteWaitlistEntry(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Waitlist entry removed');
  }
}

export const tablesController = new TablesController();

