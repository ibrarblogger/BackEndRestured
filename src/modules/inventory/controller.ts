import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { inventoryService } from './service';

export class InventoryController {
  // Ingredients
  async listIngredients(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await inventoryService.listIngredients({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Ingredients retrieved successfully', 200, meta);
  }

  async getIngredientById(req: Request, res: Response) {
    const ingredient = await inventoryService.getIngredientById(String(req.params.id));
    return sendSuccess(res, ingredient, 'Ingredient retrieved successfully');
  }

  async createIngredient(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const ingredient = await inventoryService.createIngredient({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, ingredient, 'Ingredient created successfully', 201);
  }

  async updateIngredient(req: Request, res: Response) {
    const ingredient = await inventoryService.updateIngredient(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, ingredient, 'Ingredient updated successfully');
  }

  async deleteIngredient(req: Request, res: Response) {
    await inventoryService.deleteIngredient(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Ingredient deleted successfully');
  }

  // Recipes
  async listRecipes(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const recipes = await inventoryService.listRecipes(branchId);
    return sendSuccess(res, recipes, 'Recipes retrieved successfully');
  }

  async getRecipeByMenuItemId(req: Request, res: Response) {
    const recipe = await inventoryService.getRecipeByMenuItemId(
      String(req.params.menuItemId)
    );
    return sendSuccess(res, recipe, 'Recipe retrieved successfully');
  }

  async upsertRecipe(req: Request, res: Response) {
    const recipe = await inventoryService.upsertRecipe({
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(
      res,
      recipe,
      'Recipe saved and menu item cost price updated',
      201
    );
  }

  async deleteRecipe(req: Request, res: Response) {
    await inventoryService.deleteRecipe(String(req.params.menuItemId), req.user?.sub);
    return sendSuccess(res, null, 'Recipe deleted successfully');
  }

  // Stock Adjustments & Movements
  async adjustStock(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await inventoryService.adjustStock({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Stock adjusted successfully', 201);
  }

  async listStockMovements(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await inventoryService.listStockMovements({
      ...req.query,
      branchId,
    });
    return sendSuccess(
      res,
      items,
      'Stock movements retrieved successfully',
      200,
      meta
    );
  }

  // Wastage
  async recordWastage(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await inventoryService.recordWastage({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, result, 'Wastage logged and stock deducted', 201);
  }

  async listWastageLogs(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await inventoryService.listWastageLogs({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Wastage logs retrieved successfully', 200, meta);
  }

  // Stock-Take Reconciliation
  async reconcileStockTake(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const result = await inventoryService.reconcileStockTake({
      ...req.body,
      branchId,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(
      res,
      result,
      `Reconciled ${result.reconciledCount} ingredient stock count(s)`
    );
  }

  // Alerts
  async getLowStockAlerts(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const items = await inventoryService.getLowStockAlerts(branchId);
    return sendSuccess(res, items, 'Low-stock alerts retrieved successfully');
  }

  async getExpiringAlerts(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const days = Number(req.query.days) || 14;
    const items = await inventoryService.getExpiringAlerts(branchId, days);
    return sendSuccess(res, items, 'Expiring ingredient alerts retrieved');
  }
}

export const inventoryController = new InventoryController();

