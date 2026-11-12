import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { paymentsService } from './service';

export class PaymentsController {
  async listPayments(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await paymentsService.listPayments({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Payments retrieved successfully', 200, meta);
  }

  async getPaymentById(req: Request, res: Response) {
    const payment = await paymentsService.getPaymentById(String(req.params.id));
    return sendSuccess(res, payment, 'Payment retrieved successfully');
  }

  async processPayment(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const headerIdempotencyKey = req.headers['idempotency-key'];
    const idempotencyKey =
      (Array.isArray(headerIdempotencyKey)
        ? headerIdempotencyKey[0]
        : headerIdempotencyKey) || req.body.idempotencyKey;

    const result = await paymentsService.processPayment({
      ...req.body,
      branchId,
      idempotencyKey,
      actorUserId: req.user?.sub,
    });

    const statusCode = result.idempotentReplay ? 200 : 201;
    const message = result.idempotentReplay
      ? 'Idempotent replay: returning existing payment record'
      : 'Payment processed successfully';

    return sendSuccess(res, result.payment, message, statusCode);
  }

  async refundPayment(req: Request, res: Response) {
    const result = await paymentsService.refundPayment({
      paymentId: String(req.params.id),
      amount: req.body.amount,
      reason: req.body.reason,
      approvedBy: req.body.approvedBy,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Payment refunded successfully', 201);
  }

  async listRefunds(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, meta } = await paymentsService.listRefunds(branchId, page, limit);
    return sendSuccess(res, items, 'Refunds retrieved successfully', 200, meta);
  }

  async handleWebhook(req: Request, res: Response) {
    const result = await paymentsService.handleGatewayWebhook(req.body);
    return sendSuccess(res, result, 'Webhook processed successfully');
  }

  // Cash Drawer
  async getCurrentCashDrawer(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const session = await paymentsService.getCurrentCashDrawer(branchId);
    return sendSuccess(res, session, 'Current cash drawer session retrieved');
  }

  async listCashDrawers(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await paymentsService.listCashDrawers({
      ...req.query,
      branchId,
    });
    return sendSuccess(
      res,
      items,
      'Cash drawer sessions retrieved successfully',
      200,
      meta
    );
  }

  async getCashDrawerById(req: Request, res: Response) {
    const session = await paymentsService.getCashDrawerById(String(req.params.id));
    return sendSuccess(res, session, 'Cash drawer session retrieved successfully');
  }

  async openCashDrawer(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const session = await paymentsService.openCashDrawer({
      ...req.body,
      branchId,
      actorUserId: req.user!.sub,
    });
    return sendSuccess(res, session, 'Cash drawer opened successfully', 201);
  }

  async closeCashDrawer(req: Request, res: Response) {
    const session = await paymentsService.closeCashDrawer(String(req.params.id), {
      ...req.body,
      actorUserId: req.user!.sub,
    });
    return sendSuccess(res, session, 'Cash drawer closed and reconciled');
  }

  // Tax Rates
  async listTaxRates(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const items = await paymentsService.listTaxRates(branchId);
    return sendSuccess(res, items, 'Tax rates retrieved successfully');
  }

  async createTaxRate(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const item = await paymentsService.createTaxRate({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, item, 'Tax rate created successfully', 201);
  }

  async updateTaxRate(req: Request, res: Response) {
    const item = await paymentsService.updateTaxRate(
      String(req.params.id),
      req.body
    );
    return sendSuccess(res, item, 'Tax rate updated successfully');
  }

  async deleteTaxRate(req: Request, res: Response) {
    await paymentsService.deleteTaxRate(String(req.params.id));
    return sendSuccess(res, null, 'Tax rate deleted successfully');
  }

  // Discounts
  async listDiscounts(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const items = await paymentsService.listDiscounts(branchId);
    return sendSuccess(res, items, 'Discounts retrieved successfully');
  }

  async createDiscount(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const item = await paymentsService.createDiscount({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, item, 'Discount created successfully', 201);
  }

  async updateDiscount(req: Request, res: Response) {
    const item = await paymentsService.updateDiscount(
      String(req.params.id),
      req.body
    );
    return sendSuccess(res, item, 'Discount updated successfully');
  }

  async deleteDiscount(req: Request, res: Response) {
    await paymentsService.deleteDiscount(String(req.params.id));
    return sendSuccess(res, null, 'Discount deleted successfully');
  }
}

export const paymentsController = new PaymentsController();

