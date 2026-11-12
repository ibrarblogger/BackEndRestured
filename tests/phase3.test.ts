import { LoyaltyTxType } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { computeLoyaltyPointsBalance } from '../src/modules/customers/service';
import { signAccessToken } from '../src/utils/jwt';

describe('Phase 3: Payments, Inventory, Suppliers & Customers (CRM)', () => {
  const adminToken = signAccessToken({
    sub: 'aa7d2114-106c-4d55-9291-77d3f55032da',
    email: 'admin@rms-enterprise.local',
    roleId: 'role-super-admin-id',
    roleSlug: 'super_admin',
    branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
    permissions: [
      'payments.view',
      'payments.process',
      'cash_drawer.manage',
      'orders.refund',
      'orders.create',
      'inventory.view',
      'inventory.adjust',
      'inventory.manage',
      'suppliers.view',
      'suppliers.manage',
      'purchasing.manage',
      'customers.view',
      'customers.manage',
      'loyalty.manage',
    ],
  });

  describe('Loyalty Points Earn & Redeem Calculation (Unit Tests)', () => {
    it('calculates earned points and upgrades customer tier from BRONZE to SILVER and GOLD', () => {
      const silverRes = computeLoyaltyPointsBalance({
        currentPoints: 150,
        points: 80,
        type: LoyaltyTxType.EARN,
      });
      expect(silverRes.newBalance).toBe(230);
      expect(silverRes.newTier).toBe('SILVER');

      const goldRes = computeLoyaltyPointsBalance({
        currentPoints: 450,
        points: 100,
        type: LoyaltyTxType.EARN,
      });
      expect(goldRes.newBalance).toBe(550);
      expect(goldRes.newTier).toBe('GOLD');

      const platinumRes = computeLoyaltyPointsBalance({
        currentPoints: 900,
        points: 150,
        type: LoyaltyTxType.EARN,
      });
      expect(platinumRes.newBalance).toBe(1050);
      expect(platinumRes.newTier).toBe('PLATINUM');
    });

    it('calculates redeemed points and monetary value ($0.05/pt) and rejects over-redemption', () => {
      const redeemRes = computeLoyaltyPointsBalance({
        currentPoints: 500,
        points: 200,
        type: LoyaltyTxType.REDEEM,
      });
      expect(redeemRes.newBalance).toBe(300);
      expect(redeemRes.newTier).toBe('SILVER');
      expect(redeemRes.monetaryValueUsd).toBe(10.0);

      expect(() =>
        computeLoyaltyPointsBalance({
          currentPoints: 50,
          points: 100,
          type: LoyaltyTxType.REDEEM,
        })
      ).toThrow(/Insufficient loyalty points/);
    });
  });

  describe('Phase 3 API Endpoints & Auth Guards', () => {
    it('exposes Phase 3 module links on GET /api/v1', async () => {
      const res = await request(app).get('/api/v1');
      expect(res.status).toBe(200);
      expect(res.body.data.endpoints).toMatchObject({
        payments: '/api/v1/payments',
        inventory: '/api/v1/inventory',
        suppliers: '/api/v1/suppliers',
        customers: '/api/v1/customers',
      });
    });

    it('blocks unauthenticated requests to Phase 3 endpoints with 401', async () => {
      const [payRes, invRes, supRes, custRes] = await Promise.all([
        request(app).get('/api/v1/payments'),
        request(app).get('/api/v1/inventory/ingredients'),
        request(app).get('/api/v1/suppliers'),
        request(app).get('/api/v1/customers'),
      ]);
      expect(payRes.status).toBe(401);
      expect(invRes.status).toBe(401);
      expect(supRes.status).toBe(401);
      expect(custRes.status).toBe(401);
    });

    it('validates Idempotency-Key and body fields on POST /api/v1/payments', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderId: 'not-a-uuid',
          method: 'CASH',
          amount: -10,
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('queries live Supabase Inventory, Suppliers, and Customers when authenticated', async () => {
      const [ingRes, supRes, custRes] = await Promise.all([
        request(app)
          .get('/api/v1/inventory/ingredients')
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .get('/api/v1/suppliers')
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .get('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`),
      ]);

      expect(ingRes.status).toBe(200);
      expect(Array.isArray(ingRes.body.data)).toBe(true);

      expect(supRes.status).toBe(200);
      expect(Array.isArray(supRes.body.data)).toBe(true);

      expect(custRes.status).toBe(200);
      expect(Array.isArray(custRes.body.data)).toBe(true);
    }, 30000);

    it('restricts currency changes strictly to Admin (403 for non-admin) and allows Admin to switch between PKR, USD, and more', async () => {
      const cashierToken = signAccessToken({
        sub: 'cashier-user-id',
        email: 'cashier@rms-enterprise.local',
        roleId: 'role-cashier-id',
        roleSlug: 'cashier',
        branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
        permissions: ['orders.view', 'orders.create', 'payments.process'],
      });

      // 1. Non-admin (Cashier) must be blocked with 403 Forbidden
      const forbiddenRes = await request(app)
        .patch('/api/v1/branches/currency')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ currency: 'PKR' });
      expect(forbiddenRes.status).toBe(403);

      // 2. Admin can switch active currency to PKR in Supabase
      const pkrRes = await request(app)
        .patch('/api/v1/branches/currency')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currency: 'PKR', applyToAllBranches: true });
      expect(pkrRes.status).toBe(200);
      expect(pkrRes.body.data.activeCurrency).toMatchObject({
        code: 'PKR',
        symbol: 'Rs.',
        name: 'Pakistani Rupee',
      });

      // 3. GET /api/v1/branches/currencies returns activeCurrency = PKR and full supported list
      const listCurrRes = await request(app)
        .get('/api/v1/branches/currencies')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listCurrRes.status).toBe(200);
      expect(listCurrRes.body.data.activeCurrency.code).toBe('PKR');
      expect(
        listCurrRes.body.data.supportedCurrencies.some(
          (c: any) => c.code === 'PKR' && c.symbol === 'Rs.'
        )
      ).toBe(true);
      expect(
        listCurrRes.body.data.supportedCurrencies.some(
          (c: any) => c.code === 'USD' && c.symbol === '$'
        )
      ).toBe(true);

      // 4. Non-admin (Cashier) must be blocked from changing language with 403 Forbidden
      const forbiddenLangRes = await request(app)
        .patch('/api/v1/branches/language')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ language: 'ur' });
      expect(forbiddenLangRes.status).toBe(403);

      // 5. Admin can switch active language to Urdu (ur, RTL) and English (en, LTR) in Supabase
      const urRes = await request(app)
        .patch('/api/v1/branches/language')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ language: 'ur', applyToAllBranches: true });
      expect(urRes.status).toBe(200);
      expect(urRes.body.data.activeLanguage).toMatchObject({
        code: 'ur',
        name: 'Urdu',
        direction: 'rtl',
      });

      const locRes = await request(app)
        .get('/api/v1/branches/localization')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(locRes.status).toBe(200);
      expect(locRes.body.data.activeCurrency.code).toBe('PKR');
      expect(locRes.body.data.activeLanguage.code).toBe('ur');
      expect(locRes.body.data.supportedCurrencies.length).toBeGreaterThanOrEqual(30);
      expect(locRes.body.data.supportedLanguages.length).toBeGreaterThanOrEqual(14);
    }, 30000);
  });
});

