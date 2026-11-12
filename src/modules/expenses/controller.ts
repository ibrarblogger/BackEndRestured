import { Request, Response } from 'express';
import { uploadFile } from '../../config/supabase';
import { ValidationError } from '../../errors';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { expensesService } from './service';

export class ExpensesController {
  // Categories
  async listCategories(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const items = await expensesService.listCategories(branchId);
    return sendSuccess(res, items, 'Expense categories retrieved successfully');
  }

  async createCategory(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const category = await expensesService.createCategory({
      ...req.body,
      branchId,
    });
    return sendSuccess(res, category, 'Expense category created successfully', 201);
  }

  async updateCategory(req: Request, res: Response) {
    const category = await expensesService.updateCategory(
      String(req.params.id),
      req.body
    );
    return sendSuccess(res, category, 'Expense category updated successfully');
  }

  async deleteCategory(req: Request, res: Response) {
    await expensesService.deleteCategory(String(req.params.id));
    return sendSuccess(res, null, 'Expense category deleted successfully');
  }

  // Receipt Upload (Supabase Storage `receipts` bucket)
  async uploadReceipt(req: Request, res: Response) {
    if (!req.file) {
      throw new ValidationError('Receipt file is required under field name "file"');
    }

    const uploaded = await uploadFile({
      bucket: 'receipts',
      fileName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      isPublic: false,
    });
    return sendSuccess(res, uploaded, 'Receipt uploaded successfully', 201);
  }

  // Expenses CRUD
  async listExpenses(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await expensesService.listExpenses({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Expenses retrieved successfully', 200, meta);
  }

  async getExpenseById(req: Request, res: Response) {
    const expense = await expensesService.getExpenseById(String(req.params.id));
    return sendSuccess(res, expense, 'Expense retrieved successfully');
  }

  async createExpense(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const expense = await expensesService.createExpense({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, expense, 'Expense recorded successfully', 201);
  }

  async updateExpense(req: Request, res: Response) {
    const expense = await expensesService.updateExpense(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, expense, 'Expense updated successfully');
  }

  async deleteExpense(req: Request, res: Response) {
    await expensesService.deleteExpense(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Expense deleted successfully');
  }

  // Accounting Reports
  async getPnLReport(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const report = await expensesService.getPnLReport({
      branchId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    return sendSuccess(res, report, 'Profit & Loss report generated successfully');
  }

  async getDailyClosingReport(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const report = await expensesService.getDailyClosingReport({
      branchId,
      date: req.query.date as string | undefined,
    });
    return sendSuccess(res, report, 'Daily closing (Z-Report) generated successfully');
  }

  async getCashFlowReport(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const report = await expensesService.getCashFlowReport({
      branchId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    return sendSuccess(res, report, 'Cash flow report generated successfully');
  }

  async getTaxReport(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const report = await expensesService.getTaxReport({
      branchId,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    return sendSuccess(res, report, 'Tax report generated successfully');
  }
}

export const expensesController = new ExpensesController();

