import { Request, Response } from 'express';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/response';
import { authService } from './service';

const REFRESH_COOKIE_NAME = 'refresh_token';

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    expires: expiresAt,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/v1/auth',
  });
}

export class AuthController {
  async login(req: Request, res: Response) {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    });

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    return sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      'Logged in successfully'
    );
  }

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    const result = await authService.refreshSession({
      refreshToken: token,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    return sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      'Access token refreshed'
    );
  }

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    await authService.logout(token, req.user?.sub, req.ip);
    clearRefreshCookie(res);
    return sendSuccess(res, null, 'Logged out successfully');
  }

  async forgotPassword(req: Request, res: Response) {
    const result = await authService.forgotPassword({
      email: req.body.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, result, result.message);
  }

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword({
      token: req.body.token,
      newPassword: req.body.newPassword,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    clearRefreshCookie(res);
    return sendSuccess(res, null, 'Password has been reset successfully. Please log in.');
  }

  async changePassword(req: Request, res: Response) {
    await authService.changePassword({
      userId: req.user!.sub,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    });
    clearRefreshCookie(res);
    return sendSuccess(res, null, 'Password changed successfully. Please log in again.');
  }

  async getMe(req: Request, res: Response) {
    const profile = await authService.getMe(req.user!.sub);
    return sendSuccess(res, profile, 'Profile retrieved successfully');
  }

  async updateMe(req: Request, res: Response) {
    const updated = await authService.updateMe(req.user!.sub, req.body);
    return sendSuccess(res, updated, 'Profile updated successfully');
  }

  async listSessions(req: Request, res: Response) {
    const sessions = await authService.listSessions(req.user!.sub);
    return sendSuccess(res, sessions, 'Active sessions retrieved successfully');
  }

  async revokeSession(req: Request, res: Response) {
    await authService.revokeSession(req.user!.sub, String(req.params.sessionId));
    return sendSuccess(res, null, 'Session revoked successfully');
  }

  async revokeAllSessions(req: Request, res: Response) {
    await authService.revokeAllSessions(req.user!.sub);
    clearRefreshCookie(res);
    return sendSuccess(res, null, 'All sessions revoked successfully');
  }
}

export const authController = new AuthController();
