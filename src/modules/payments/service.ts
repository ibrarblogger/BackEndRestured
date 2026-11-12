import {
  CashDrawerStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { auditService } from '../audit/service';
import { paymentsRepository } from './repository';
import {
  CloseCashDrawerInput,
  CreateDiscountInput,
  CreateRefundInput,
  CreateTaxRateInput,
  OpenCashDrawerInput,
  PaymentGatewayWebhookInput,
  ProcessPaymentInput,
  UpdateDiscountInput,
  UpdateTaxRateInput,
} from './types';

export class PaymentsService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await paymentsRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}${String(now.getUTCDate()).padStart(2, '0')}`;
    const randPart = Math.floor(100000 + Math.random() * 900000);
    return `INV-${datePart}-${randPart}`;
  }

  async listPayments(query: any) {
    return paymentsRepository.findManyPayments(query);
  }

  async getPaymentById(id: string) {
    const payment = await paymentsRepository.findPaymentById(id);
    if (!payment) throw new NotFoundError('Payment');
    return payment;
  }

  async processPayment(input: ProcessPaymentInput) {
    if (!input.idempotencyKey) {
      throw new ValidationError(
        'Idempotency-Key header or idempotencyKey body field is required to process payments safely'
      );
    }

    // 1. Idempotency check against live Supabase database
    const existingPayment = await paymentsRepository.findPaymentByIdempotencyKey(
      input.idempotencyKey
    );
    if (existingPayment) {
      return {
        payment: existingPayment,
        idempotentReplay: true,
      };
    }

    // 2. Verify order exists and is payable
    const order = await paymentsRepository.findOrderForPayment(input.orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new ValidationError('Cannot process payment for a cancelled order');
    }

    const remainingDue = Number(
      Math.max(0, Number(order.totalAmount) - Number(order.paidAmount)).toFixed(2)
    );
    if (remainingDue <= 0 && order.status === OrderStatus.PAID) {
      throw new ConflictError(`Order ${order.orderNumber} is already paid in full`);
    }

    // 3. Calculate change for CASH payments
    let changeAmount = 0;
    if (input.method === PaymentMethod.CASH && input.tenderedAmount !== undefined) {
      if (input.tenderedAmount < input.amount) {
        throw new ValidationError(
          `Tendered cash amount (${input.tenderedAmount}) cannot be less than payment amount (${input.amount})`
        );
      }
      changeAmount = Number((input.tenderedAmount - input.amount).toFixed(2));
    }

    const invoiceNumber = this.generateInvoiceNumber();

    const payment = await paymentsRepository.executePaymentTransaction({
      ...input,
      branchId: order.branchId,
      changeAmount,
      invoiceNumber,
    });

    await auditService.log({
      branchId: order.branchId,
      userId: input.actorUserId,
      action: 'PAYMENT_PROCESSED',
      entity: 'Payment',
      entityId: payment.id,
      newValues: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        method: payment.method,
        amount: Number(payment.amount),
        tipAmount: Number(payment.tipAmount),
        idempotencyKey: payment.idempotencyKey,
      },
    });

    if (payment.order.status === OrderStatus.PAID) {
      emitSocketEvent(
        SOCKET_EVENTS.ORDER_STATUS_CHANGED,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          status: OrderStatus.PAID,
        },
        { branchId: order.branchId }
      );
    }

    return {
      payment,
      idempotentReplay: false,
    };
  }

  async refundPayment(input: CreateRefundInput) {
    const payment = await paymentsRepository.findPaymentById(input.paymentId);
    if (!payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new ConflictError('This payment has already been fully refunded');
    }

    const alreadyRefunded = payment.refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    );
    const maxRefundable = Number(
      (Number(payment.amount) - alreadyRefunded).toFixed(2)
    );

    if (input.amount > maxRefundable) {
      throw new ValidationError(
        `Refund amount (${input.amount}) exceeds remaining refundable amount (${maxRefundable})`
      );
    }

    const newTotalRefunded = Number((alreadyRefunded + input.amount).toFixed(2));
    const newPaymentStatus =
      newTotalRefunded >= Number(payment.amount)
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    const result = await paymentsRepository.executeRefundTransaction({
      ...input,
      orderId: payment.orderId,
      newPaymentStatus,
      cashDrawerSessionId: payment.cashDrawerSessionId,
      isCashPayment: payment.method === PaymentMethod.CASH,
    });

    // Mandatory ORDER_REFUND audit log
    await auditService.log({
      branchId: payment.branchId,
      userId: input.actorUserId,
      action: 'ORDER_REFUND',
      entity: 'Refund',
      entityId: result.refund.id,
      oldValues: {
        paymentId: payment.id,
        previousStatus: payment.status,
        previouslyRefunded: alreadyRefunded,
      },
      newValues: {
        paymentId: payment.id,
        orderId: payment.orderId,
        refundAmount: input.amount,
        reason: input.reason,
        newPaymentStatus,
      },
    });

    return result;
  }

  async listRefunds(branchId?: string, page = 1, limit = 20) {
    return paymentsRepository.findManyRefunds(branchId, page, limit);
  }

  // Payment Gateway Adapter Webhook Handler (Stripe / Local Gateway)
  async handleGatewayWebhook(input: PaymentGatewayWebhookInput) {
    if (input.status !== PaymentStatus.COMPLETED) {
      return {
        acknowledged: true,
        processed: false,
        reason: `Ignored non-completed webhook status: ${input.status}`,
      };
    }

    const result = await this.processPayment({
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      method: PaymentMethod.GATEWAY,
      amount: input.amount,
      transactionRef: input.transactionRef,
      gatewayProvider: input.provider,
      gatewayResponse: input.rawPayload ?? { eventType: input.eventType },
    });

    return {
      acknowledged: true,
      processed: true,
      idempotentReplay: result.idempotentReplay,
      paymentId: result.payment.id,
    };
  }

  // Cash Drawer Management
  async getCurrentCashDrawer(branchId?: string) {
    const resolvedBranchId = await this.ensureBranchId(branchId);
    return paymentsRepository.findOpenCashDrawer(resolvedBranchId);
  }

  async listCashDrawers(query: any) {
    return paymentsRepository.findManyCashDrawers(query);
  }

  async getCashDrawerById(id: string) {
    const session = await paymentsRepository.findCashDrawerById(id);
    if (!session) throw new NotFoundError('Cash drawer session');
    return session;
  }

  async openCashDrawer(input: OpenCashDrawerInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const existingOpen = await paymentsRepository.findOpenCashDrawer(branchId);
    if (existingOpen) {
      throw new ConflictError(
        `An open cash drawer session already exists for this branch (id: ${existingOpen.id})`
      );
    }

    const session = await paymentsRepository.openCashDrawer({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'CASH_DRAWER_OPENED',
      entity: 'CashDrawerSession',
      entityId: session.id,
      newValues: {
        openingBalance: Number(session.openingBalance),
      },
    });

    return session;
  }

  async closeCashDrawer(id: string, input: CloseCashDrawerInput) {
    const session = await paymentsRepository.findCashDrawerById(id);
    if (!session) throw new NotFoundError('Cash drawer session');

    if (session.status !== CashDrawerStatus.OPEN) {
      throw new ConflictError('Cash drawer session is already closed');
    }

    const discrepancy = Number(
      (input.closingBalance - Number(session.expectedBalance)).toFixed(2)
    );

    const closed = await paymentsRepository.closeCashDrawer(id, {
      ...input,
      discrepancy,
    });

    await auditService.log({
      branchId: session.branchId,
      userId: input.actorUserId,
      action: 'CASH_DRAWER_CLOSED',
      entity: 'CashDrawerSession',
      entityId: session.id,
      oldValues: {
        openingBalance: Number(session.openingBalance),
        expectedBalance: Number(session.expectedBalance),
      },
      newValues: {
        closingBalance: input.closingBalance,
        discrepancy,
        status: closed.status,
      },
    });

    return closed;
  }

  // Tax Rates
  async listTaxRates(branchId?: string) {
    return paymentsRepository.findTaxRates(branchId);
  }

  async createTaxRate(input: CreateTaxRateInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const taxRate = await paymentsRepository.createTaxRate({ ...input, branchId });
    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'TAX_RATE_CREATED',
      entity: 'TaxRate',
      entityId: taxRate.id,
      newValues: { name: taxRate.name, ratePercent: Number(taxRate.ratePercent) },
    });
    return taxRate;
  }

  async updateTaxRate(id: string, input: UpdateTaxRateInput) {
    const existing = await paymentsRepository.findTaxRateById(id);
    if (!existing) throw new NotFoundError('Tax rate');
    return paymentsRepository.updateTaxRate(id, input);
  }

  async deleteTaxRate(id: string) {
    const existing = await paymentsRepository.findTaxRateById(id);
    if (!existing) throw new NotFoundError('Tax rate');
    await paymentsRepository.softDeleteTaxRate(id);
  }

  // Discounts
  async listDiscounts(branchId?: string) {
    return paymentsRepository.findDiscounts(branchId);
  }

  async createDiscount(input: CreateDiscountInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const discount = await paymentsRepository.createDiscount({ ...input, branchId });
    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'DISCOUNT_CREATED',
      entity: 'Discount',
      entityId: discount.id,
      newValues: {
        name: discount.name,
        type: discount.type,
        value: Number(discount.value),
      },
    });
    return discount;
  }

  async updateDiscount(id: string, input: UpdateDiscountInput) {
    const existing = await paymentsRepository.findDiscountById(id);
    if (!existing) throw new NotFoundError('Discount');
    return paymentsRepository.updateDiscount(id, input);
  }

  async deleteDiscount(id: string) {
    const existing = await paymentsRepository.findDiscountById(id);
    if (!existing) throw new NotFoundError('Discount');
    await paymentsRepository.softDeleteDiscount(id);
  }
}

export const paymentsService = new PaymentsService();

