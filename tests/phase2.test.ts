import { KitchenTicketStatus, OrderStatus, OrderType, ReservationStatus, TableStatus } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { PERMISSIONS } from '../src/constants/permissions';
import { ROLES } from '../src/constants/roles';
import { auditRepository } from '../src/modules/audit/repository';
import { kitchenRepository } from '../src/modules/kitchen/repository';
import { menuRepository } from '../src/modules/menu/repository';
import { ordersRepository } from '../src/modules/orders/repository';
import { calculateOrderTotals } from '../src/modules/orders/service';
import { tablesRepository } from '../src/modules/tables/repository';
import { signAccessToken } from '../src/utils/jwt';

const BRANCH_ID = '2a6afa14-7e63-48a5-9291-3d52bba2c3be';
const ADMIN_TOKEN = signAccessToken({
  sub: 'aa7d2114-106c-4d55-9c57-77d3f55032da',
  email: 'admin@rms-enterprise.local',
  roleId: '5aa8d3d9-2dce-4056-b712-e7cf1564df62',
  roleSlug: ROLES.SUPER_ADMIN,
  branchId: BRANCH_ID,
  permissions: Object.values(PERMISSIONS),
});

describe('Phase 2 — Menu, Tables, Reservations, Orders, Kitchen (KDS) & Billing Math', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unit Tests: Billing, Tax, Service Charge & Discount Calculation', () => {
    it('calculates DINE_IN totals with percentage discount, tax, and service charge', () => {
      const result = calculateOrderTotals({
        subtotal: 100,
        orderType: OrderType.DINE_IN,
        taxRatePercent: 10,
        serviceChargePercent: 5,
        discountType: 'PERCENTAGE',
        discountValue: 20, // $20 off -> taxable = $80
        minOrderAmount: 50,
        tipAmount: 10,
      });

      expect(result.subtotal).toBe(100);
      expect(result.discountAmount).toBe(20);
      expect(result.taxableAmount).toBe(80);
      expect(result.taxAmount).toBe(8); // 10% of 80
      expect(result.serviceCharge).toBe(4); // 5% of 80
      expect(result.deliveryFee).toBe(0);
      expect(result.tipAmount).toBe(10);
      expect(result.totalAmount).toBe(102); // 80 + 8 + 4 + 10
    });

    it('caps percentage discount at maxDiscount and omits serviceCharge on DELIVERY', () => {
      const result = calculateOrderTotals({
        subtotal: 200,
        orderType: OrderType.DELIVERY,
        taxRatePercent: 8,
        serviceChargePercent: 5,
        discountType: 'PERCENTAGE',
        discountValue: 50, // 50% of 200 = 100, but capped at 30
        maxDiscount: 30,
        deliveryFee: 5.5,
      });

      expect(result.discountAmount).toBe(30);
      expect(result.taxableAmount).toBe(170);
      expect(result.serviceCharge).toBe(0); // DELIVERY has 0 serviceCharge
      expect(result.taxAmount).toBe(13.6); // 8% of 170
      expect(result.deliveryFee).toBe(5.5);
      expect(result.totalAmount).toBe(189.1);
    });
  });

  describe('Menu Endpoints & Price Change Audit Logging', () => {
    it('PATCH /api/v1/menu/items/:id logs PRICE_CHANGE audit event when price changes', async () => {
      const itemId = '77777777-7777-4777-8777-777777777777';
      vi.spyOn(menuRepository, 'findMenuItemById').mockResolvedValue({
        id: itemId,
        branchId: BRANCH_ID,
        sku: 'PIZ-MARG-01',
        name: 'Margherita Classica',
        price: 16.0,
      } as any);

      vi.spyOn(menuRepository, 'updateMenuItem').mockResolvedValue({
        id: itemId,
        branchId: BRANCH_ID,
        sku: 'PIZ-MARG-01',
        name: 'Margherita Classica',
        price: 19.5,
      } as any);

      const auditSpy = vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/menu/items/${itemId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ price: 19.5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRICE_CHANGE',
          entity: 'MenuItem',
          entityId: itemId,
          oldValues: { sku: 'PIZ-MARG-01', price: 16 },
          newValues: { sku: 'PIZ-MARG-01', price: 19.5 },
        })
      );
    });
  });

  describe('Reservations Time-Conflict Detection', () => {
    it('POST /api/v1/tables/reservations rejects overlapping reservation on the same table with 409', async () => {
      const tableId = '88888888-8888-4888-8888-888888888888';
      vi.spyOn(tablesRepository, 'findTableById').mockResolvedValue({
        id: tableId,
        branchId: BRANCH_ID,
        tableNumber: 'T-01',
        capacity: 6,
        status: TableStatus.AVAILABLE,
      } as any);

      // Existing reservation from 19:00 to 20:30
      vi.spyOn(tablesRepository, 'findCandidateReservationsForTable').mockResolvedValue([
        {
          id: '99999999-9999-4999-8999-999999999999',
          tableId,
          guestName: 'Existing Guest',
          reservationTime: new Date('2026-11-12T19:00:00.000Z'),
          durationMinutes: 90,
          status: ReservationStatus.CONFIRMED,
        } as any,
      ]);

      // Request overlapping slot at 19:30
      const res = await request(app)
        .post('/api/v1/tables/reservations')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          tableId,
          guestName: 'New Guest',
          guestPhone: '+1-212-555-0199',
          partySize: 4,
          reservationTime: '2026-11-12T19:30:00.000Z',
          durationMinutes: 90,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Time conflict');
    });
  });

  describe('Orders Workflow & Kitchen KDS Ticket Updates', () => {
    it('PATCH /api/v1/orders/:id/status enforces valid workflow transitions and rejects PAID -> NEW', async () => {
      const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      vi.spyOn(ordersRepository, 'findOrderById').mockResolvedValue({
        id: orderId,
        branchId: BRANCH_ID,
        orderNumber: 'ORD-20261111-100001',
        status: OrderStatus.PAID,
      } as any);

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: OrderStatus.NEW });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid order status transition from PAID to NEW');
    });

    it('PATCH /api/v1/kitchen/tickets/:id/status updates ticket status and computes prep timer metrics', async () => {
      const ticketId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      vi.spyOn(kitchenRepository, 'findTicketById').mockResolvedValue({
        id: ticketId,
        branchId: BRANCH_ID,
        orderId,
        ticketNumber: 'ORD-100001-K1',
        station: 'MAIN_KITCHEN',
        status: KitchenTicketStatus.PREPARING,
        prepTimeTargetMin: 15,
        startedAt: new Date(Date.now() - 10 * 60 * 1000),
        createdAt: new Date(Date.now() - 12 * 60 * 1000),
      } as any);

      vi.spyOn(kitchenRepository, 'updateTicketStatusTransaction').mockResolvedValue({
        ticket: {
          id: ticketId,
          branchId: BRANCH_ID,
          orderId,
          ticketNumber: 'ORD-100001-K1',
          station: 'MAIN_KITCHEN',
          status: KitchenTicketStatus.READY,
          prepTimeTargetMin: 15,
          startedAt: new Date(Date.now() - 10 * 60 * 1000),
          readyAt: new Date(),
          createdAt: new Date(Date.now() - 12 * 60 * 1000),
          order: {
            id: orderId,
            branchId: BRANCH_ID,
            orderNumber: 'ORD-100001',
            status: OrderStatus.READY,
          },
        } as any,
        newOrderStatus: OrderStatus.READY,
        previousOrderStatus: OrderStatus.PREPARING,
      });

      const res = await request(app)
        .patch(`/api/v1/kitchen/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: KitchenTicketStatus.READY });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(KitchenTicketStatus.READY);
      expect(res.body.data.elapsedMinutes).toBeDefined();
      expect(res.body.data.isOverdue).toBe(false);
    });
  });
});

