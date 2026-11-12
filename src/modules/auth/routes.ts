import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { authController } from './controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  updateProfileSchema,
} from './schema';

const router = Router();

router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler((req, res) => authController.login(req, res))
);

router.post(
  '/refresh',
  authRateLimiter,
  validate({ body: refreshSchema }),
  asyncHandler((req, res) => authController.refresh(req, res))
);

router.post(
  '/logout',
  asyncHandler((req, res) => authController.logout(req, res))
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler((req, res) => authController.forgotPassword(req, res))
);

router.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler((req, res) => authController.resetPassword(req, res))
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler((req, res) => authController.changePassword(req, res))
);

router.get(
  '/me',
  authenticate,
  asyncHandler((req, res) => authController.getMe(req, res))
);

router.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler((req, res) => authController.updateMe(req, res))
);

router.get(
  '/sessions',
  authenticate,
  asyncHandler((req, res) => authController.listSessions(req, res))
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  validate({ params: sessionIdParamSchema }),
  asyncHandler((req, res) => authController.revokeSession(req, res))
);

router.delete(
  '/sessions',
  authenticate,
  asyncHandler((req, res) => authController.revokeAllSessions(req, res))
);

export const authRoutes = router;

