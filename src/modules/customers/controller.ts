import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { customersService } from './service';

export class CustomersController {
  // Customers CRUD
  async listCustomers(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await customersService.listCustomers({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Customers retrieved successfully', 200, meta);
  }

  async getCustomerById(req: Request, res: Response) {
    const customer = await customersService.getCustomerById(String(req.params.id));
    return sendSuccess(res, customer, 'Customer retrieved successfully');
  }

  async createCustomer(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const customer = await customersService.createCustomer({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, customer, 'Customer created successfully', 201);
  }

  async updateCustomer(req: Request, res: Response) {
    const customer = await customersService.updateCustomer(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, customer, 'Customer updated successfully');
  }

  async deleteCustomer(req: Request, res: Response) {
    await customersService.deleteCustomer(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Customer deleted successfully');
  }

  // Loyalty Points
  async earnPoints(req: Request, res: Response) {
    const result = await customersService.earnPoints({
      customerId: String(req.params.id),
      orderId: req.body.orderId,
      points: req.body.points,
      description: req.body.description,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Loyalty points earned successfully', 201);
  }

  async redeemPoints(req: Request, res: Response) {
    const result = await customersService.redeemPoints({
      customerId: String(req.params.id),
      orderId: req.body.orderId,
      points: req.body.points,
      description: req.body.description,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Loyalty points redeemed successfully', 201);
  }

  async getLoyaltyHistory(req: Request, res: Response) {
    const history = await customersService.getLoyaltyHistory(String(req.params.id));
    return sendSuccess(res, history, 'Customer loyalty history retrieved');
  }

  // Coupons
  async listCoupons(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const coupons = await customersService.listCoupons(branchId);
    return sendSuccess(res, coupons, 'Coupons retrieved successfully');
  }

  async createCoupon(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const coupon = await customersService.createCoupon({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, coupon, 'Coupon created successfully', 201);
  }

  async updateCoupon(req: Request, res: Response) {
    const coupon = await customersService.updateCoupon(
      String(req.params.id),
      req.body
    );
    return sendSuccess(res, coupon, 'Coupon updated successfully');
  }

  async deleteCoupon(req: Request, res: Response) {
    await customersService.deleteCoupon(String(req.params.id));
    return sendSuccess(res, null, 'Coupon deleted successfully');
  }

  async validateCoupon(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await customersService.validateCoupon({
      branchId,
      code: req.body.code,
      orderSubtotal: req.body.orderSubtotal,
    });
    return sendSuccess(res, result, 'Coupon validated successfully');
  }

  // Feedbacks
  async listFeedbacks(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await customersService.listFeedbacks({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Feedbacks retrieved successfully', 200, meta);
  }

  async createFeedback(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const feedback = await customersService.createFeedback({
      ...req.body,
      branchId,
    });
    return sendSuccess(res, feedback, 'Feedback submitted successfully', 201);
  }

  async resolveFeedback(req: Request, res: Response) {
    const feedback = await customersService.resolveFeedback(String(req.params.id));
    return sendSuccess(res, feedback, 'Feedback marked as resolved');
  }

  // Segments & Campaigns
  async getSegmentsSummary(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const summary = await customersService.getSegmentsSummary(branchId);
    return sendSuccess(res, summary, 'Customer segments summary retrieved');
  }

  async triggerCampaign(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await customersService.triggerCampaign({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'CRM campaign triggered successfully', 201);
  }
}

export const customersController = new CustomersController();

