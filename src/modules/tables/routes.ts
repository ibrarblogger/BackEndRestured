import { Router } from 'express';
import { PERMISSIONS } from '../../constants/permissions';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { tablesController } from './controller';
import {
  createFloorSchema,
  createReservationSchema,
  createTableSchema,
  createWaitlistSchema,
  idParamSchema,
  reservationQuerySchema,
  tableQuerySchema,
  updateFloorSchema,
  updateLayoutSchema,
  updateReservationSchema,
  updateReservationStatusSchema,
  updateTableSchema,
  updateTableStatusSchema,
  updateWaitlistStatusSchema,
  waitlistQuerySchema,
} from './schema';

const router = Router();

router.use(authenticate);

// Floors
router.get(
  '/floors',
  requirePermission(PERMISSIONS.TABLES_VIEW),
  asyncHandler((req, res) => tablesController.listFloors(req, res))
);

router.post(
  '/floors',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ body: createFloorSchema }),
  asyncHandler((req, res) => tablesController.createFloor(req, res))
);

router.patch(
  '/floors/:id',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ params: idParamSchema, body: updateFloorSchema }),
  asyncHandler((req, res) => tablesController.updateFloor(req, res))
);

router.delete(
  '/floors/:id',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => tablesController.deleteFloor(req, res))
);

// Floor Layout Batch Update
router.put(
  '/layout',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ body: updateLayoutSchema }),
  asyncHandler((req, res) => tablesController.updateLayout(req, res))
);

// Reservations
router.get(
  '/reservations',
  requirePermission(PERMISSIONS.RESERVATIONS_VIEW),
  validate({ query: reservationQuerySchema }),
  asyncHandler((req, res) => tablesController.listReservations(req, res))
);

router.get(
  '/reservations/:id',
  requirePermission(PERMISSIONS.RESERVATIONS_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => tablesController.getReservationById(req, res))
);

router.post(
  '/reservations',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  validate({ body: createReservationSchema }),
  asyncHandler((req, res) => tablesController.createReservation(req, res))
);

router.patch(
  '/reservations/:id',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  validate({ params: idParamSchema, body: updateReservationSchema }),
  asyncHandler((req, res) => tablesController.updateReservation(req, res))
);

router.patch(
  '/reservations/:id/status',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  validate({ params: idParamSchema, body: updateReservationStatusSchema }),
  asyncHandler((req, res) => tablesController.updateReservationStatus(req, res))
);

router.post(
  '/reservations/no-shows',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  asyncHandler((req, res) => tablesController.markNoShows(req, res))
);

// Waitlist
router.get(
  '/waitlist',
  requirePermission(PERMISSIONS.RESERVATIONS_VIEW),
  validate({ query: waitlistQuerySchema }),
  asyncHandler((req, res) => tablesController.listWaitlist(req, res))
);

router.post(
  '/waitlist',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  validate({ body: createWaitlistSchema }),
  asyncHandler((req, res) => tablesController.createWaitlist(req, res))
);

router.patch(
  '/waitlist/:id/status',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  validate({ params: idParamSchema, body: updateWaitlistStatusSchema }),
  asyncHandler((req, res) => tablesController.updateWaitlistStatus(req, res))
);

router.delete(
  '/waitlist/:id',
  requirePermission(PERMISSIONS.RESERVATIONS_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => tablesController.deleteWaitlist(req, res))
);

// Tables CRUD
router.get(
  '/',
  requirePermission(PERMISSIONS.TABLES_VIEW),
  validate({ query: tableQuerySchema }),
  asyncHandler((req, res) => tablesController.listTables(req, res))
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.TABLES_VIEW),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => tablesController.getTableById(req, res))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ body: createTableSchema }),
  asyncHandler((req, res) => tablesController.createTable(req, res))
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ params: idParamSchema, body: updateTableSchema }),
  asyncHandler((req, res) => tablesController.updateTable(req, res))
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ params: idParamSchema, body: updateTableStatusSchema }),
  asyncHandler((req, res) => tablesController.updateTableStatus(req, res))
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.TABLES_MANAGE),
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => tablesController.deleteTable(req, res))
);

export const tablesRoutes = router;

