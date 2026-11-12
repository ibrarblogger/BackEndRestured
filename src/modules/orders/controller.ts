import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { ordersService } from './service';

export class OrdersController {
  async listOrders(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await ordersService.listOrders({ ...req.query, branchId });
    return sendSuccess(res, items, 'Orders retrieved successfully', 200, meta);
  }

  async getOrderById(req: Request, res: Response) {
    const order = await ordersService.getOrderById(String(req.params.id));
    return sendSuccess(res, order, 'Order retrieved successfully');
  }

  async createOrder(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const order = await ordersService.createOrder({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, order, 'Order created successfully', 201);
  }

  async updateOrder(req: Request, res: Response) {
    const order = await ordersService.updateOrder(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, order, 'Order updated successfully');
  }

  async updateStatus(req: Request, res: Response) {
    const order = await ordersService.transitionStatus(
      String(req.params.id),
      req.body.status,
      req.user?.sub
    );
    return sendSuccess(res, order, `Order status updated to ${req.body.status}`);
  }

  async holdOrder(req: Request, res: Response) {
    const order = await ordersService.holdOrder(String(req.params.id), req.user?.sub);
    return sendSuccess(res, order, 'Order placed on hold');
  }

  async resumeOrder(req: Request, res: Response) {
    const order = await ordersService.resumeOrder(String(req.params.id), req.user?.sub);
    return sendSuccess(res, order, 'Order resumed from hold');
  }

  async cancelOrder(req: Request, res: Response) {
    const order = await ordersService.cancelOrder(
      String(req.params.id),
      req.body.reason,
      req.user?.sub
    );
    return sendSuccess(res, order, 'Order cancelled successfully');
  }

  async splitOrder(req: Request, res: Response) {
    const result = await ordersService.splitOrder(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Order bill split successfully', 201);
  }

  async mergeOrders(req: Request, res: Response) {
    const result = await ordersService.mergeOrders({
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Orders merged successfully');
  }

  async downloadInvoicePdf(req: Request, res: Response) {
    const { buffer, invoiceNumber } = await ordersService.generateInvoicePdfBuffer(
      String(req.params.id)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${invoiceNumber}.pdf"`
    );
    return res.status(200).send(buffer);
  }
}

export const ordersController = new OrdersController();

