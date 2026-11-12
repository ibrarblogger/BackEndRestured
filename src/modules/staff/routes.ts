import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { staffController } from './controller';
import {
  attendanceQuerySchema,
  clockInSchema,
  clockOutSchema,
  createEmployeeSchema,
  createLeaveSchema,
  createShiftSchema,
  distributeTipsSchema,
  employeeQuerySchema,
  generatePayrollSchema,
  idParamSchema,
  leaveQuerySchema,
  payrollQuerySchema,
  shiftQuerySchema,
  updateEmployeeSchema,
  updateLeaveStatusSchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Shifts
router.get(
  '/shifts',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ query: shiftQuerySchema }),
  asyncHandler((req, res) => staffController.listShifts(req, res))
);

router.post(
  '/shifts',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ body: createShiftSchema }),
  asyncHandler((req, res) => staffController.createShift(req, res))
);

router.delete(
  '/shifts/:id',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => staffController.deleteShift(req, res))
);

// Attendance
router.get(
  '/attendance',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ query: attendanceQuerySchema }),
  asyncHandler((req, res) => staffController.listAttendance(req, res))
);

router.post(
  '/attendance/clock-in',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ body: clockInSchema }),
  asyncHandler((req, res) => staffController.clockIn(req, res))
);

router.post(
  '/attendance/clock-out',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ body: clockOutSchema }),
  asyncHandler((req, res) => staffController.clockOut(req, res))
);

// Leaves
router.get(
  '/leaves',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ query: leaveQuerySchema }),
  asyncHandler((req, res) => staffController.listLeaveRequests(req, res))
);

router.post(
  '/leaves',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ body: createLeaveSchema }),
  asyncHandler((req, res) => staffController.createLeaveRequest(req, res))
);

router.patch(
  '/leaves/:id/status',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ params: idParamSchema, body: updateLeaveStatusSchema }),
  asyncHandler((req, res) => staffController.updateLeaveStatus(req, res))
);

// Payroll & Tips Distribution
router.get(
  '/payroll',
  requirePermission(PERMISSIONS.PAYROLL_MANAGE),
  validate({ query: payrollQuerySchema }),
  asyncHandler((req, res) => staffController.listPayrolls(req, res))
);

router.post(
  '/payroll/generate',
  requirePermission(PERMISSIONS.PAYROLL_MANAGE),
  validate({ body: generatePayrollSchema }),
  asyncHandler((req, res) => staffController.generatePayroll(req, res))
);

router.patch(
  '/payroll/:id/pay',
  requirePermission(PERMISSIONS.PAYROLL_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => staffController.markPayrollPaid(req, res))
);

router.post(
  '/payroll/distribute-tips',
  requirePermission(PERMISSIONS.PAYROLL_MANAGE),
  validate({ body: distributeTipsSchema }),
  asyncHandler((req, res) => staffController.distributeTips(req, res))
);

// Employees CRUD
router.get(
  '/employees',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ query: employeeQuerySchema }),
  asyncHandler((req, res) => staffController.listEmployees(req, res))
);

router.get(
  '/employees/:id',
  requirePermission(PERMISSIONS.STAFF_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => staffController.getEmployeeById(req, res))
);

router.post(
  '/employees',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ body: createEmployeeSchema }),
  asyncHandler((req, res) => staffController.createEmployee(req, res))
);

router.patch(
  '/employees/:id',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ params: idParamSchema, body: updateEmployeeSchema }),
  asyncHandler((req, res) => staffController.updateEmployee(req, res))
);

router.delete(
  '/employees/:id',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => staffController.deleteEmployee(req, res))
);

export const staffRoutes = router;

