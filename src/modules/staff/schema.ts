import { LeaveStatus } from '@prisma/client';
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export const createEmployeeSchema = z.object({
  branchId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  employeeCode: z.string().min(2).max(40).transform((v) => v.trim().toUpperCase()),
  designation: z.string().min(2).max(100),
  department: z.string().min(2).max(80).default('OPERATIONS'),
  baseSalary: z.coerce.number().min(0),
  hourlyRate: z.coerce.number().min(0).default(0),
  joinDate: z.string().datetime().optional(),
  emergencyPhone: z.string().max(40).optional(),
  bankAccountNo: z.string().max(80).optional(),
  isActive: z.boolean().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ userId: true, employeeCode: true })
  .partial();

export const shiftQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createShiftSchema = z.object({
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  name: z.string().min(2).max(80),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().max(300).optional(),
});

export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const clockInSchema = z.object({
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  status: z.enum(['PRESENT', 'LATE', 'HALF_DAY']).default('PRESENT'),
  notes: z.string().max(300).optional(),
});

export const clockOutSchema = z.object({
  employeeId: z.string().uuid(),
  notes: z.string().max(300).optional(),
});

export const leaveQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.nativeEnum(LeaveStatus).optional(),
});

export const createLeaveSchema = z.object({
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  leaveType: z.enum(['SICK', 'CASUAL', 'ANNUAL', 'UNPAID']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(3).max(500),
});

export const updateLeaveStatusSchema = z.object({
  status: z.nativeEnum(LeaveStatus),
});

export const payrollQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  branchId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const generatePayrollSchema = z.object({
  branchId: z.string().uuid().optional(),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  bonusesByEmployee: z.record(z.coerce.number().min(0)).optional(),
  deductionsByEmployee: z.record(z.coerce.number().min(0)).optional(),
  includeTipsPool: z.boolean().default(true),
});

export const distributeTipsSchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  departmentFilter: z.string().optional(),
});

