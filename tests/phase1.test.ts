import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { app } from '../src/app';
import { PERMISSIONS } from '../src/constants/permissions';
import { ROLES } from '../src/constants/roles';
import { signAccessToken, signRefreshToken, verifyAccessToken, hashToken } from '../src/utils/jwt';
import { comparePassword, hashPassword } from '../src/utils/password';
import { authRepository } from '../src/modules/auth/repository';
import { usersRepository } from '../src/modules/users/repository';
import { auditRepository } from '../src/modules/audit/repository';

describe('Phase 1 — Foundation, Auth, RBAC, Error Handling & Audit Logs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/health returns consistent response format with 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toMatchObject({
      success: true,
      message: 'Restaurant Management System API is healthy',
      data: {
        status: 'ok',
      },
    });
  });

  it('Unknown route returns 404 with consistent error format', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0].code).toBe('ROUTE_NOT_FOUND');
  });

  it('Password hashing and verification works with bcrypt', async () => {
    const hash = await hashPassword('SecurePass@123');
    expect(hash).not.toBe('SecurePass@123');
    expect(await comparePassword('SecurePass@123', hash)).toBe(true);
    expect(await comparePassword('WrongPass@123', hash)).toBe(false);
  });

  it('JWT access token signing and verification preserves RBAC claims', () => {
    const token = signAccessToken({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'manager@rms.local',
      roleId: '22222222-2222-2222-2222-222222222222',
      roleSlug: ROLES.MANAGER,
      branchId: '33333333-3333-3333-3333-333333333333',
      permissions: [PERMISSIONS.ORDERS_CREATE, PERMISSIONS.USERS_VIEW],
    });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(decoded.roleSlug).toBe(ROLES.MANAGER);
    expect(decoded.permissions).toContain(PERMISSIONS.ORDERS_CREATE);
  });

  it('POST /api/v1/auth/login validates input with Zod and rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Request validation failed');
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/auth/login authenticates valid user, sets httpOnly refresh_token cookie, and logs audit event', async () => {
    const passwordHash = await hashPassword('Admin@123456!');
    vi.spyOn(authRepository, 'findUserByEmail').mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'admin@rms-enterprise.local',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+15550001',
      avatarUrl: null,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      branchId: '33333333-3333-3333-3333-333333333333',
      branch: {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Downtown Flagship',
        code: 'DT-01',
        currency: 'USD',
        timezone: 'UTC',
      },
      roleId: '22222222-2222-2222-2222-222222222222',
      role: {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Super Admin',
        slug: ROLES.SUPER_ADMIN,
        permissions: [{ permission: { key: PERMISSIONS.USERS_VIEW } }],
      },
      lastLoginAt: null,
      createdAt: new Date(),
    } as any);
    vi.spyOn(authRepository, 'resetFailedAttemptsOnLogin').mockResolvedValue({} as any);
    vi.spyOn(authRepository, 'createRefreshToken').mockResolvedValue({} as any);
    vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@rms-enterprise.local', password: 'Admin@123456!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('refresh_token=');
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('POST /api/v1/auth/refresh detects revoked refresh token reuse and revokes token family', async () => {
    const refreshToken = signRefreshToken({
      sub: '11111111-1111-1111-1111-111111111111',
      familyId: 'fam-123',
      jti: 'jti-123',
    });

    vi.spyOn(authRepository, 'findRefreshTokenByHash').mockResolvedValue({
      id: 'jti-123',
      userId: '11111111-1111-1111-1111-111111111111',
      tokenHash: hashToken(refreshToken),
      familyId: 'fam-123',
      revokedAt: new Date(Date.now() - 60000), // already revoked!
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      ipAddress: null,
      userAgent: null,
      replacedBy: 'new-hash',
    });

    const revokeFamilySpy = vi
      .spyOn(authRepository, 'revokeTokenFamily')
      .mockResolvedValue({ count: 1 });
    vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${refreshToken}`])
      .send({});

    expect(res.status).toBe(401);
    expect(revokeFamilySpy).toHaveBeenCalledWith('fam-123');
    expect(res.body.message).toContain('reuse detected');
  });

  it('RBAC middleware blocks user lacking required permission with 403 Forbidden', async () => {
    const waiterToken = signAccessToken({
      sub: '44444444-4444-4444-4444-444444444444',
      email: 'waiter@rms.local',
      roleId: '55555555-5555-5555-5555-555555555555',
      roleSlug: ROLES.WAITER,
      branchId: '33333333-3333-3333-3333-333333333333',
      permissions: [PERMISSIONS.ORDERS_CREATE], // Does NOT have USERS_VIEW
    });

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('users.view');
  });

  it('RBAC middleware allows user with required permission and returns paginated list', async () => {
    const managerToken = signAccessToken({
      sub: '44444444-4444-4444-4444-444444444444',
      email: 'manager@rms.local',
      roleId: '55555555-5555-5555-5555-555555555555',
      roleSlug: ROLES.MANAGER,
      branchId: '33333333-3333-3333-3333-333333333333',
      permissions: [PERMISSIONS.USERS_VIEW],
    });

    vi.spyOn(usersRepository, 'findManyUsers').mockResolvedValue({
      items: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          email: 'manager@rms.local',
          firstName: 'Jane',
          lastName: 'Manager',
        } as any,
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const res = await request(app)
      .get('/api/v1/users?page=1&limit=20')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });
});

