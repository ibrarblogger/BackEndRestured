import { LeaveStatus, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  ClockInInput,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  CreateShiftInput,
  UpdateEmployeeInput,
} from './types';

export class StaffRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  async findUserById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, branchId: true, firstName: true, lastName: true, email: true },
    });
  }

  // Employees
  async findManyEmployees(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    department?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
              { designation: { contains: query.search, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { firstName: { contains: query.search, mode: 'insensitive' } },
                    { lastName: { contains: query.search, mode: 'insensitive' } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: { select: { id: true, name: true, slug: true } },
            },
          },
          branch: { select: { id: true, name: true, currency: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findEmployeeById(id: string) {
    return prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: { select: { id: true, name: true, slug: true } },
          },
        },
        branch: { select: { id: true, name: true, currency: true } },
        shifts: { orderBy: { startTime: 'desc' }, take: 15 },
        attendances: { orderBy: { clockIn: 'desc' }, take: 15 },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        payrolls: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }], take: 12 },
      },
    });
  }

  async findEmployeeByUserIdOrCode(userId: string, employeeCode: string) {
    return prisma.employee.findFirst({
      where: {
        OR: [{ userId }, { employeeCode }],
      },
    });
  }

  async createEmployee(input: CreateEmployeeInput & { branchId: string }) {
    return prisma.employee.create({
      data: {
        branchId: input.branchId,
        userId: input.userId,
        employeeCode: input.employeeCode,
        designation: input.designation,
        department: input.department ?? 'OPERATIONS',
        baseSalary: input.baseSalary,
        hourlyRate: input.hourlyRate ?? 0,
        joinDate: input.joinDate ? new Date(input.joinDate) : new Date(),
        emergencyPhone: input.emergencyPhone,
        bankAccountNo: input.bankAccountNo,
        isActive: input.isActive ?? true,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput) {
    return prisma.employee.update({
      where: { id },
      data: {
        ...(input.designation !== undefined ? { designation: input.designation } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.baseSalary !== undefined ? { baseSalary: input.baseSalary } : {}),
        ...(input.hourlyRate !== undefined ? { hourlyRate: input.hourlyRate } : {}),
        ...(input.joinDate !== undefined ? { joinDate: new Date(input.joinDate) } : {}),
        ...(input.emergencyPhone !== undefined
          ? { emergencyPhone: input.emergencyPhone }
          : {}),
        ...(input.bankAccountNo !== undefined
          ? { bankAccountNo: input.bankAccountNo }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: input.actorUserId,
      },
    });
  }

  async softDeleteEmployee(id: string, actorUserId?: string) {
    return prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedBy: actorUserId,
      },
    });
  }

  // Shifts
  async findManyShifts(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.ShiftWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.startDate || query.endDate
        ? {
            startTime: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              designation: true,
              department: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.shift.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async createShift(input: CreateShiftInput & { branchId: string }) {
    return prisma.shift.create({
      data: {
        branchId: input.branchId,
        employeeId: input.employeeId,
        name: input.name,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        notes: input.notes,
        createdBy: input.actorUserId,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async deleteShift(id: string) {
    return prisma.shift.delete({ where: { id } });
  }

  // Attendance
  async findOpenAttendance(employeeId: string) {
    return prisma.attendance.findFirst({
      where: { employeeId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
  }

  async createClockIn(input: ClockInInput & { branchId: string }) {
    return prisma.attendance.create({
      data: {
        branchId: input.branchId,
        employeeId: input.employeeId,
        clockIn: new Date(),
        status: input.status ?? 'PRESENT',
        notes: input.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async completeClockOut(
    attendanceId: string,
    params: {
      clockOut: Date;
      hoursWorked: number;
      overtimeHours: number;
      notes?: string;
    }
  ) {
    return prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        clockOut: params.clockOut,
        hoursWorked: params.hoursWorked,
        overtimeHours: params.overtimeHours,
        ...(params.notes ? { notes: params.notes } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async findManyAttendance(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.AttendanceWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.startDate || query.endDate
        ? {
            clockIn: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { clockIn: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              designation: true,
              department: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Leave Requests
  async findManyLeaveRequests(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    employeeId?: string;
    status?: LeaveStatus;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);
    const where: Prisma.LeaveRequestWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              designation: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findLeaveRequestById(id: string) {
    return prisma.leaveRequest.findUnique({ where: { id } });
  }

  async createLeaveRequest(input: CreateLeaveRequestInput & { branchId: string }) {
    return prisma.leaveRequest.create({
      data: {
        branchId: input.branchId,
        employeeId: input.employeeId,
        leaveType: input.leaveType,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        reason: input.reason,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async updateLeaveStatus(id: string, status: LeaveStatus, approvedBy?: string) {
    return prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedBy,
      },
    });
  }

  // Payroll & Tips
  async findActiveEmployeesWithAttendanceForPeriod(
    branchId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    return prisma.employee.findMany({
      where: {
        branchId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        attendances: {
          where: {
            clockIn: { gte: periodStart, lt: periodEnd },
          },
        },
      },
    });
  }

  async sumTipsForPeriod(branchId: string, start: Date, end: Date): Promise<number> {
    const result = await prisma.order.aggregate({
      where: {
        branchId,
        deletedAt: null,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: start, lt: end },
      },
      _sum: { tipAmount: true },
    });
    return Number(result._sum.tipAmount ?? 0);
  }

  async upsertPayrollRecord(params: {
    branchId: string;
    employeeId: string;
    periodMonth: number;
    periodYear: number;
    baseSalary: number;
    overtimePay: number;
    tipsShare: number;
    bonuses: number;
    deductions: number;
    netPay: number;
    createdBy?: string;
  }) {
    return prisma.payroll.upsert({
      where: {
        employeeId_periodMonth_periodYear: {
          employeeId: params.employeeId,
          periodMonth: params.periodMonth,
          periodYear: params.periodYear,
        },
      },
      update: {
        baseSalary: params.baseSalary,
        overtimePay: params.overtimePay,
        tipsShare: params.tipsShare,
        bonuses: params.bonuses,
        deductions: params.deductions,
        netPay: params.netPay,
      },
      create: {
        branchId: params.branchId,
        employeeId: params.employeeId,
        periodMonth: params.periodMonth,
        periodYear: params.periodYear,
        baseSalary: params.baseSalary,
        overtimePay: params.overtimePay,
        tipsShare: params.tipsShare,
        bonuses: params.bonuses,
        deductions: params.deductions,
        netPay: params.netPay,
        status: 'GENERATED',
        createdBy: params.createdBy,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            designation: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async findManyPayrolls(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    employeeId?: string;
    periodMonth?: number;
    periodYear?: number;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);
    const where: Prisma.PayrollWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.periodMonth ? { periodMonth: query.periodMonth } : {}),
      ...(query.periodYear ? { periodYear: query.periodYear } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        skip,
        take,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              designation: true,
              department: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.payroll.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findPayrollById(id: string) {
    return prisma.payroll.findUnique({ where: { id } });
  }

  async markPayrollPaid(id: string) {
    return prisma.payroll.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });
  }

  async findBranchCurrency(branchId: string): Promise<string> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { currency: true },
    });
    return branch?.currency ?? 'PKR';
  }
}

export const staffRepository = new StaffRepository();

