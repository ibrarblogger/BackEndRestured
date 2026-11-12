import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../errors';
import {
  hashToken,
  parseDurationToMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import { comparePassword, hashPassword } from '../../utils/password';
import { auditService } from '../audit/service';
import { authRepository } from './repository';
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshSessionInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from './types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  private sanitizeUser(user: any) {
    const permissions: string[] =
      user.role?.permissions?.map((rp: any) => rp.permission.key) || [];
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      branchId: user.branchId,
      branch: user.branch || null,
      role: {
        id: user.role.id,
        name: user.role.name,
        slug: user.role.slug,
      },
      permissions,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private async issueTokenPair(
    user: any,
    familyId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const permissions: string[] =
      user.role?.permissions?.map((rp: any) => rp.permission.key) || [];

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roleId: user.role.id,
      roleSlug: user.role.slug,
      branchId: user.branchId ?? null,
      permissions,
    });

    const jti = uuidv4();
    const refreshToken = signRefreshToken({
      sub: user.id,
      familyId,
      jti,
    });

    const expiresAt = new Date(Date.now() + parseDurationToMs(env.REFRESH_TOKEN_TTL));
    await authRepository.createRefreshToken({
      id: jti,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      ipAddress,
      userAgent,
      expiresAt,
    });

    return { accessToken, refreshToken, expiresAt };
  }

  async login(input: LoginInput) {
    const user = await authRepository.findUserByEmail(input.email);

    if (!user) {
      await auditService.log({
        action: 'AUTH_LOGIN_FAILED',
        entity: 'User',
        newValues: { email: input.email, reason: 'USER_NOT_FOUND' },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Your account has been deactivated. Contact your administrator.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
      );
      throw new ForbiddenError(
        `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minute(s).`
      );
    }

    const passwordValid = await comparePassword(input.password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
      await authRepository.incrementFailedAttempts(user.id, attempts, lockedUntil);

      await auditService.log({
        branchId: user.branchId,
        userId: user.id,
        action: lockedUntil ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        newValues: { attempts, lockedUntil },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    await authRepository.resetFailedAttemptsOnLogin(user.id);
    const familyId = uuidv4();
    const { accessToken, refreshToken, expiresAt } = await this.issueTokenPair(
      user,
      familyId,
      input.ipAddress,
      input.userAgent
    );

    await auditService.log({
      branchId: user.branchId,
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  }

  async refreshSession(input: RefreshSessionInput) {
    if (!input.refreshToken) {
      throw new UnauthorizedError('Refresh token is missing');
    }

    const decoded = verifyRefreshToken(input.refreshToken);
    const tokenHash = hashToken(input.refreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedError('Refresh token not recognized');
    }

    // Reuse detection: if token was already revoked, revoke the entire token family immediately!
    if (storedToken.revokedAt) {
      await authRepository.revokeTokenFamily(storedToken.familyId);
      await auditService.log({
        userId: storedToken.userId,
        action: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        entity: 'RefreshToken',
        entityId: storedToken.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new UnauthorizedError('Security alert: refresh token reuse detected. Session revoked.');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const user = await authRepository.findUserById(decoded.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account is inactive or no longer exists');
    }

    const { accessToken, refreshToken, expiresAt } = await this.issueTokenPair(
      user,
      storedToken.familyId,
      input.ipAddress,
      input.userAgent
    );

    await authRepository.revokeRefreshToken(storedToken.id, hashToken(refreshToken));

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  }

  async logout(refreshToken?: string, userId?: string, ipAddress?: string) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const stored = await authRepository.findRefreshTokenByHash(tokenHash);
      if (stored && !stored.revokedAt) {
        await authRepository.revokeRefreshToken(stored.id);
      }
    }
    if (userId) {
      await auditService.log({
        userId,
        action: 'AUTH_LOGOUT',
        entity: 'User',
        entityId: userId,
        ipAddress,
      });
    }
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      // Do not leak whether email exists
      return {
        message: 'If that email address is in our system, we have sent a password reset link.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await authRepository.savePasswordResetToken(user.id, tokenHash, expiresAt);

    await auditService.log({
      branchId: user.branchId,
      userId: user.id,
      action: 'AUTH_FORGOT_PASSWORD_REQUEST',
      entity: 'User',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      message: 'If that email address is in our system, we have sent a password reset link.',
      // Expose token only in non-production for easy testing/dev verification
      ...(env.NODE_ENV !== 'production' ? { debugResetToken: rawToken } : {}),
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = hashToken(input.token);
    const user = await authRepository.findUserByResetToken(tokenHash);

    if (!user) {
      throw new ValidationError('Invalid or expired password reset token');
    }

    const newHash = await hashPassword(input.newPassword);
    await authRepository.updateUserPassword(user.id, newHash);
    await authRepository.revokeAllUserTokens(user.id);

    await auditService.log({
      branchId: user.branchId,
      userId: user.id,
      action: 'AUTH_PASSWORD_RESET',
      entity: 'User',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  async changePassword(input: ChangePasswordInput) {
    const user = await authRepository.findUserById(input.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const matches = await comparePassword(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw new ValidationError('Current password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);
    await authRepository.updateUserPassword(user.id, newHash);
    await authRepository.revokeAllUserTokens(user.id);

    await auditService.log({
      branchId: user.branchId,
      userId: user.id,
      action: 'AUTH_PASSWORD_CHANGED',
      entity: 'User',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    });
  }

  async getMe(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.sanitizeUser(user);
  }

  async updateMe(userId: string, data: UpdateProfileInput) {
    return authRepository.updateProfile(userId, data);
  }

  async listSessions(userId: string) {
    return authRepository.listActiveSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string) {
    await authRepository.revokeSessionById(sessionId, userId);
  }

  async revokeAllSessions(userId: string) {
    await authRepository.revokeAllUserTokens(userId);
  }
}

export const authService = new AuthService();

