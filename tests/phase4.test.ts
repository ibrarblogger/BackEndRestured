import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { calculateNetPayroll } from '../src/modules/staff/service';
import { signAccessToken } from '../src/utils/jwt';

describe('Phase 4: Staff, Payroll, Expenses, Delivery, Reports & Dashboard KPIs', () => {
  const adminToken = signAccessToken({
    sub: 'aa7d2114-106c-4d55-9291-77d3f55032da',
    email: 'admin@rms-enterprise.local',
    roleId: 'role-super-admin-id',
    roleSlug: 'super-admin',
    branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
    permissions: [],
  });

  const cashierToken = signAccessToken({
    sub: '22222222-2222-4222-8222-222222222222',
    email: 'cashier@rms-enterprise.local',
    roleId: 'role-cashier-id',
    roleSlug: 'cashier',
    branchId: '2a6afa14-7e63-48a5-9291-3d52bba2c3be',
    permissions: ['orders.view', 'orders.create', 'reports.view'],
  });

  describe('Payroll Net Pay & Overtime Calculation (Unit Tests)', () => {
    it('computes 1.5x overtime pay, tips pool, bonuses and deductions accurately', () => {
      const result = calculateNetPayroll({
        baseSalary: 50000,
        hourlyRate: 500,
        overtimeHours: 10, // 10 * 500 * 1.5 = 7500
        tipsShare: 2500,
        bonuses: 3000,
        deductions: 1500,
      });

      expect(result.overtimePay).toBe(7500);
      expect(result.netPay).toBe(61500);
    });

    it('never produces negative netPay when deductions exceed gross', () => {
      const result = calculateNetPayroll({
        baseSalary: 1000,
        hourlyRate: 100,
        overtimeHours: 0,
        tipsShare: 0,
        bonuses: 0,
        deductions: 5000,
      });

      expect(result.netPay).toBe(0);
    });
  });

  describe('Phase 4 Authentication & RBAC Guards', () => {
    it('rejects unauthenticated requests across Phase 4 endpoints', async () => {
      const resStaff = await request(app).get('/api/v1/staff/employees');
      const resExpenses = await request(app).get('/api/v1/expenses/accounting/pnl');
      const resDelivery = await request(app).get('/api/v1/delivery/zones');
      const resReports = await request(app).get('/api/v1/reports/sales-by-item');
      const resDashboard = await request(app).get('/api/v1/dashboard/kpis');

      expect(resStaff.status).toBe(401);
      expect(resExpenses.status).toBe(401);
      expect(resDelivery.status).toBe(401);
      expect(resReports.status).toBe(401);
      expect(resDashboard.status).toBe(401);
    });

    it('forbids cashier from payroll management and report exports without permission', async () => {
      const payrollRes = await request(app)
        .get('/api/v1/staff/payroll')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(payrollRes.status).toBe(403);

      const exportRes = await request(app)
        .get('/api/v1/reports/sales-by-item?format=csv')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(exportRes.status).toBe(403);
    });
  });

  describe('Live Supabase Phase 4 Endpoints', () => {
    it('queries staff, expense categories, and P&L report cleanly', async () => {
      const empRes = await request(app)
        .get('/api/v1/staff/employees')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(empRes.status).toBe(200);
      expect(Array.isArray(empRes.body.data)).toBe(true);

      const catRes = await request(app)
        .get('/api/v1/expenses/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(catRes.status).toBe(200);
      expect(catRes.body.data.length).toBeGreaterThanOrEqual(1);

      const pnlRes = await request(app)
        .get('/api/v1/expenses/accounting/pnl')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pnlRes.status).toBe(200);
      expect(pnlRes.body.data).toHaveProperty('currency');
      expect(pnlRes.body.data).toHaveProperty('netProfit');
    });

    it('queries seeded delivery zones and riders', async () => {
      const zonesRes = await request(app)
        .get('/api/v1/delivery/zones')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(zonesRes.status).toBe(200);
      expect(zonesRes.body.data.length).toBeGreaterThanOrEqual(3);

      const ridersRes = await request(app)
        .get('/api/v1/delivery/riders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ridersRes.status).toBe(200);
      expect(ridersRes.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('generates JSON reports and exports CSV, Excel, and PDF', async () => {
      const jsonRes = await request(app)
        .get('/api/v1/reports/sales-by-item')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.data).toHaveProperty('currency');
      expect(Array.isArray(jsonRes.body.data.rows)).toBe(true);

      const csvRes = await request(app)
        .get('/api/v1/reports/sales-by-time?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');

      const excelRes = await request(app)
        .get('/api/v1/reports/inventory-valuation?format=excel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(excelRes.status).toBe(200);
      expect(excelRes.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const pdfRes = await request(app)
        .get('/api/v1/reports/wastage?format=pdf')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
    });

    it('returns live Dashboard KPIs with branch localization metadata', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/kpis?days=7&lang=ur&refresh=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.localization.language.code).toBe('ur');
      expect(res.body.data.localization.language.direction).toBe('rtl');
      expect(res.body.data).toHaveProperty('today');
      expect(res.body.data).toHaveProperty('period');
      expect(res.body.data).toHaveProperty('operations');
      expect(Array.isArray(res.body.data.dailyTrend)).toBe(true);
      expect(res.body.data.hourlySalesToday.length).toBe(24);
    });
  });
});

