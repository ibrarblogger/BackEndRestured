import { LeaveStatus } from '@prisma/client';

export interface CreateEmployeeInput {
  branchId?: string;
  userId: string;
  employeeCode: string;
  designation: string;
  department?: string;
  baseSalary: number;
  hourlyRate?: number;
  joinDate?: string | Date;
  emergencyPhone?: string;
  bankAccountNo?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateEmployeeInput {
  designation?: string;
  department?: string;
  baseSalary?: number;
  hourlyRate?: number;
  joinDate?: string | Date;
  emergencyPhone?: string;
  bankAccountNo?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export interface CreateShiftInput {
  branchId?: string;
  employeeId: string;
  name: string;
  startTime: string | Date;
  endTime: string | Date;
  notes?: string;
  actorUserId?: string;
}

export interface ClockInInput {
  branchId?: string;
  employeeId: string;
  status?: string;
  notes?: string;
}

export interface ClockOutInput {
  employeeId: string;
  notes?: string;
}

export interface CreateLeaveRequestInput {
  branchId?: string;
  employeeId: string;
  leaveType: string;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
}

export interface UpdateLeaveStatusInput {
  status: LeaveStatus;
  approvedBy?: string;
}

export interface GeneratePayrollInput {
  branchId?: string;
  periodMonth: number;
  periodYear: number;
  bonusesByEmployee?: Record<string, number>;
  deductionsByEmployee?: Record<string, number>;
  includeTipsPool?: boolean;
  actorUserId?: string;
}

