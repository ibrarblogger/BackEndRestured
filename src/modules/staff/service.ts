import { getCurrencyDetails } from '../../constants/currencies';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { auditService } from '../audit/service';
import { staffRepository } from './repository';
import {
  ClockInInput,
  ClockOutInput,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  CreateShiftInput,
  GeneratePayrollInput,
  UpdateEmployeeInput,
  UpdateLeaveStatusInput,
} from './types';

export function calculateNetPayroll(params: {
  baseSalary: number;
  hourlyRate: number;
  overtimeHours: number;
  tipsShare: number;
  bonuses: number;
  deductions: number;
}): { overtimePay: number; netPay: number } {
  const overtimePay = Number(
    (Math.max(0, params.overtimeHours) * Math.max(0, params.hourlyRate) * 1.5).toFixed(2)
  );
  const gross =
    Math.max(0, params.baseSalary) +
    overtimePay +
    Math.max(0, params.tipsShare) +
    Math.max(0, params.bonuses);
  const netPay = Number(Math.max(0, gross - Math.max(0, params.deductions)).toFixed(2));
  return { overtimePay, netPay };
}

export class StaffService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await staffRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Employees
  async listEmployees(query: any) {
    return staffRepository.findManyEmployees(query);
  }

  async getEmployeeById(id: string) {
    const employee = await staffRepository.findEmployeeById(id);
    if (!employee) throw new NotFoundError('Employee');
    return employee;
  }

  async createEmployee(input: CreateEmployeeInput) {
    const user = await staffRepository.findUserById(input.userId);
    if (!user) throw new NotFoundError('User');

    const existing = await staffRepository.findEmployeeByUserIdOrCode(
      input.userId,
      input.employeeCode
    );
    if (existing) {
      throw new ConflictError(
        `Employee already exists for this userId or employeeCode "${input.employeeCode}"`
      );
    }

    const branchId = await this.ensureBranchId(
      input.branchId || user.branchId || undefined
    );

    const created = await staffRepository.createEmployee({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: created.id,
      newValues: {
        employeeCode: created.employeeCode,
        designation: created.designation,
        department: created.department,
      },
    });

    return created;
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput) {
    const existing = await this.getEmployeeById(id);
    const updated = await staffRepository.updateEmployee(id, input);

    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: id,
      oldValues: {
        designation: existing.designation,
        baseSalary: Number(existing.baseSalary),
      },
      newValues: input as Record<string, any>,
    });

    return updated;
  }

  async deleteEmployee(id: string, actorUserId?: string) {
    const existing = await this.getEmployeeById(id);
    await staffRepository.softDeleteEmployee(id, actorUserId);

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'EMPLOYEE_DELETED',
      entity: 'Employee',
      entityId: id,
    });
  }

  // Shifts
  async listShifts(query: any) {
    return staffRepository.findManyShifts(query);
  }

  async createShift(input: CreateShiftInput) {
    const employee = await this.getEmployeeById(input.employeeId);
    if (new Date(input.endTime) <= new Date(input.startTime)) {
      throw new ValidationError('Shift endTime must be after startTime');
    }

    const shift = await staffRepository.createShift({
      ...input,
      branchId: input.branchId || employee.branchId,
    });

    return shift;
  }

  async deleteShift(id: string) {
    await staffRepository.deleteShift(id);
  }

  // Attendance (Clock-in / Clock-out)
  async listAttendance(query: any) {
    return staffRepository.findManyAttendance(query);
  }

  async clockIn(input: ClockInInput) {
    const employee = await this.getEmployeeById(input.employeeId);
    const open = await staffRepository.findOpenAttendance(input.employeeId);
    if (open) {
      throw new ConflictError(
        `Employee ${employee.employeeCode} is already clocked in (since ${open.clockIn.toISOString()})`
      );
    }

    return staffRepository.createClockIn({
      ...input,
      branchId: input.branchId || employee.branchId,
    });
  }

  async clockOut(input: ClockOutInput) {
    const employee = await this.getEmployeeById(input.employeeId);
    const open = await staffRepository.findOpenAttendance(input.employeeId);
    if (!open) {
      throw new ValidationError(
        `Employee ${employee.employeeCode} does not have an active clock-in session`
      );
    }

    const clockOut = new Date();
    const diffMs = Math.max(0, clockOut.getTime() - open.clockIn.getTime());
    const hoursWorked = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    const overtimeHours = Number(Math.max(0, hoursWorked - 8).toFixed(2));

    return staffRepository.completeClockOut(open.id, {
      clockOut,
      hoursWorked,
      overtimeHours,
      notes: input.notes,
    });
  }

  // Leave Requests
  async listLeaveRequests(query: any) {
    return staffRepository.findManyLeaveRequests(query);
  }

  async createLeaveRequest(input: CreateLeaveRequestInput) {
    const employee = await this.getEmployeeById(input.employeeId);
    if (new Date(input.endDate) < new Date(input.startDate)) {
      throw new ValidationError('Leave endDate must be on or after startDate');
    }

    return staffRepository.createLeaveRequest({
      ...input,
      branchId: input.branchId || employee.branchId,
    });
  }

  async updateLeaveStatus(id: string, input: UpdateLeaveStatusInput) {
    const existing = await staffRepository.findLeaveRequestById(id);
    if (!existing) throw new NotFoundError('Leave request');

    const updated = await staffRepository.updateLeaveStatus(
      id,
      input.status,
      input.approvedBy
    );

    await auditService.log({
      branchId: existing.branchId,
      userId: input.approvedBy,
      action: 'LEAVE_STATUS_UPDATED',
      entity: 'LeaveRequest',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: updated.status },
    });

    return updated;
  }

  // Payroll & Tips Distribution
  async listPayrolls(query: any) {
    return staffRepository.findManyPayrolls(query);
  }

  async generatePayroll(input: GeneratePayrollInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const currencyCode = await staffRepository.findBranchCurrency(branchId);
    const currency = getCurrencyDetails(currencyCode);

    const periodStart = new Date(Date.UTC(input.periodYear, input.periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(input.periodYear, input.periodMonth, 1));

    const employees = await staffRepository.findActiveEmployeesWithAttendanceForPeriod(
      branchId,
      periodStart,
      periodEnd
    );

    if (employees.length === 0) {
      throw new ValidationError('No active employees found for this branch');
    }

    const totalTipsPool = input.includeTipsPool
      ? await staffRepository.sumTipsForPeriod(branchId, periodStart, periodEnd)
      : 0;
    const tipSharePerEmployee = Number(
      (totalTipsPool / Math.max(1, employees.length)).toFixed(2)
    );

    const generated = [];
    for (const emp of employees) {
      const totalOvertimeHours = emp.attendances.reduce(
        (sum, att) => sum + Number(att.overtimeHours ?? 0),
        0
      );
      const bonuses = Number(input.bonusesByEmployee?.[emp.id] ?? 0);
      const deductions = Number(input.deductionsByEmployee?.[emp.id] ?? 0);

      const { overtimePay, netPay } = calculateNetPayroll({
        baseSalary: Number(emp.baseSalary),
        hourlyRate: Number(emp.hourlyRate),
        overtimeHours: totalOvertimeHours,
        tipsShare: tipSharePerEmployee,
        bonuses,
        deductions,
      });

      const payroll = await staffRepository.upsertPayrollRecord({
        branchId,
        employeeId: emp.id,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        baseSalary: Number(emp.baseSalary),
        overtimePay,
        tipsShare: tipSharePerEmployee,
        bonuses,
        deductions,
        netPay,
        createdBy: input.actorUserId,
      });

      generated.push(payroll);
    }

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'PAYROLL_GENERATED',
      entity: 'Payroll',
      newValues: {
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        employeeCount: generated.length,
        totalTipsPool,
        currency: currency.code,
      },
    });

    return {
      currency,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      totalTipsPool,
      employeeCount: generated.length,
      totalNetPayroll: Number(
        generated.reduce((sum, p) => sum + Number(p.netPay), 0).toFixed(2)
      ),
      payrolls: generated,
    };
  }

  async markPayrollPaid(id: string, actorUserId?: string) {
    const existing = await staffRepository.findPayrollById(id);
    if (!existing) throw new NotFoundError('Payroll record');
    if (existing.status === 'PAID') {
      throw new ConflictError('Payroll has already been marked as PAID');
    }

    const updated = await staffRepository.markPayrollPaid(id);
    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'PAYROLL_PAID',
      entity: 'Payroll',
      entityId: id,
      newValues: { netPay: Number(updated.netPay), paidAt: updated.paidAt },
    });

    return updated;
  }

  async distributeTips(params: {
    branchId?: string;
    startDate: string;
    endDate: string;
    departmentFilter?: string;
  }) {
    const branchId = await this.ensureBranchId(params.branchId);
    const currencyCode = await staffRepository.findBranchCurrency(branchId);
    const currency = getCurrencyDetails(currencyCode);

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const totalTipsPool = await staffRepository.sumTipsForPeriod(branchId, start, end);

    const { items: employees } = await staffRepository.findManyEmployees({
      branchId,
      department: params.departmentFilter,
      isActive: true,
      limit: 200,
    });

    const eligibleCount = Math.max(1, employees.length);
    const perEmployeeShare = Number((totalTipsPool / eligibleCount).toFixed(2));

    return {
      currency,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalTipsPool,
      eligibleEmployeesCount: employees.length,
      sharePerEmployee: employees.length > 0 ? perEmployeeShare : 0,
      breakdown: employees.map((emp) => ({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        name: `${emp.user.firstName} ${emp.user.lastName}`,
        designation: emp.designation,
        department: emp.department,
        tipShare: perEmployeeShare,
      })),
    };
  }
}

export const staffService = new StaffService();
