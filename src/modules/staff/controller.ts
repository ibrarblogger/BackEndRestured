import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { staffService } from './service';

export class StaffController {
  // Employees
  async listEmployees(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await staffService.listEmployees({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Employees retrieved successfully', 200, meta);
  }

  async getEmployeeById(req: Request, res: Response) {
    const employee = await staffService.getEmployeeById(String(req.params.id));
    return sendSuccess(res, employee, 'Employee retrieved successfully');
  }

  async createEmployee(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const employee = await staffService.createEmployee({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, employee, 'Employee created successfully', 201);
  }

  async updateEmployee(req: Request, res: Response) {
    const employee = await staffService.updateEmployee(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, employee, 'Employee updated successfully');
  }

  async deleteEmployee(req: Request, res: Response) {
    await staffService.deleteEmployee(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Employee deleted successfully');
  }

  // Shifts
  async listShifts(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await staffService.listShifts({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Shifts retrieved successfully', 200, meta);
  }

  async createShift(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const shift = await staffService.createShift({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, shift, 'Shift scheduled successfully', 201);
  }

  async deleteShift(req: Request, res: Response) {
    await staffService.deleteShift(String(req.params.id));
    return sendSuccess(res, null, 'Shift deleted successfully');
  }

  // Attendance
  async listAttendance(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await staffService.listAttendance({
      ...req.query,
      branchId,
    });
    return sendSuccess(
      res,
      items,
      'Attendance logs retrieved successfully',
      200,
      meta
    );
  }

  async clockIn(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const log = await staffService.clockIn({
      ...req.body,
      branchId,
    });
    return sendSuccess(res, log, 'Employee clocked in successfully', 201);
  }

  async clockOut(req: Request, res: Response) {
    const log = await staffService.clockOut(req.body);
    return sendSuccess(res, log, 'Employee clocked out successfully');
  }

  // Leaves
  async listLeaveRequests(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await staffService.listLeaveRequests({
      ...req.query,
      branchId,
    });
    return sendSuccess(
      res,
      items,
      'Leave requests retrieved successfully',
      200,
      meta
    );
  }

  async createLeaveRequest(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const leave = await staffService.createLeaveRequest({
      ...req.body,
      branchId,
    });
    return sendSuccess(res, leave, 'Leave request submitted successfully', 201);
  }

  async updateLeaveStatus(req: Request, res: Response) {
    const leave = await staffService.updateLeaveStatus(String(req.params.id), {
      status: req.body.status,
      approvedBy: req.user?.sub,
    });
    return sendSuccess(res, leave, `Leave request marked as ${req.body.status}`);
  }

  // Payroll & Tips
  async listPayrolls(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await staffService.listPayrolls({
      ...req.query,
      branchId,
    });
    return sendSuccess(
      res,
      items,
      'Payroll records retrieved successfully',
      200,
      meta
    );
  }

  async generatePayroll(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await staffService.generatePayroll({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Monthly payroll generated successfully', 201);
  }

  async markPayrollPaid(req: Request, res: Response) {
    const payroll = await staffService.markPayrollPaid(
      String(req.params.id),
      req.user?.sub
    );
    return sendSuccess(res, payroll, 'Payroll marked as PAID');
  }

  async distributeTips(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await staffService.distributeTips({
      ...req.body,
      branchId,
    });
    return sendSuccess(res, result, 'Tips pool distribution calculated');
  }
}

export const staffController = new StaffController();

