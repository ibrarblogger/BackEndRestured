import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { jobQueue } from '../src/jobs/queue';
import { signAccessToken } from '../src/utils/jwt';

describe('Phase 5: Notifications, Background Jobs & Rich Supabase Seed Verification', () => {
  const adminToken = signAccessToken({
    sub: 'aa7d2114-106c-4d55-9291-77d3f55032da',
    email: 'admin@rms-enterprise.local',
    roleId: 'role-super-admin-id',
    roleSlug: 'super-admin',
    branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
    permissions: [],
  });

  const waiterToken = signAccessToken({
    sub: '33333333-3333-4333-8333-333333333333',
    email: 'waiter@rms-enterprise.local',
    roleId: 'role-waiter-id',
    roleSlug: 'waiter',
    branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
    permissions: ['orders.view', 'orders.create'],
  });

  describe('Notifications & Preferences API', () => {
    it('requires authentication on notification endpoints', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('creates a notification, lists unread count, marks it read, and persists preferences in Supabase', async () => {
      const createRes = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'SYSTEM',
          title: 'Phase 5 Notification Check',
          message: 'Automated verification of live Supabase notification storage.',
        });

      expect(createRes.status).toBe(201);
      const createdId = createRes.body.data.id;
      expect(createdId).toBeTruthy();

      const listRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data.notifications)).toBe(true);
      expect(typeof listRes.body.data.unreadCount).toBe('number');

      const readRes = await request(app)
        .patch(`/api/v1/notifications/${createdId}/read`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(readRes.status).toBe(200);
      expect(readRes.body.data.isRead).toBe(true);

      const updatePrefsRes = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ soundEnabled: false, emailEnabled: true });
      expect(updatePrefsRes.status).toBe(200);
      expect(updatePrefsRes.body.data.soundEnabled).toBe(false);

      const getPrefsRes = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getPrefsRes.status).toBe(200);
      expect(getPrefsRes.body.data.soundEnabled).toBe(false);
    });

    it('restricts system notification broadcast to users with settings.manage permission', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'SYSTEM',
          title: 'Unauthorized broadcast',
          message: 'Should be rejected with 403',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Background Jobs & Rich Analytics Verification', () => {
    it('executes registered background job handlers in fallback/BullMQ mode', async () => {
      const job = await jobQueue.runNow('LOW_STOCK_SCAN', {
        branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
      });

      expect(job.status).toBe('COMPLETED');
      expect(job.result).toHaveProperty('scanned');

      const statusRes = await request(app)
        .get('/api/v1/jobs/status')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.registeredHandlers).toContain('CRM_CAMPAIGN');
      expect(statusRes.body.data.registeredHandlers).toContain('LOW_STOCK_SCAN');
    });

    it('verifies seeded historical orders populate live dashboard & reports from Supabase', async () => {
      const kpiRes = await request(app)
        .get('/api/v1/dashboard/kpis?days=30&refresh=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(kpiRes.status).toBe(200);
      expect(kpiRes.body.data.period.ordersCount).toBeGreaterThanOrEqual(200);
      expect(kpiRes.body.data.period.revenue).toBeGreaterThan(0);
      expect(kpiRes.body.data.topItems.length).toBeGreaterThan(0);

      const empRes = await request(app)
        .get('/api/v1/staff/employees')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(empRes.status).toBe(200);
      expect(empRes.body.data.length).toBeGreaterThanOrEqual(10);
    });
  });
});

