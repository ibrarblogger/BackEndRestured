import { NotFoundError, ValidationError } from '../../errors';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { auditService } from '../audit/service';
import { inventoryRepository } from './repository';
import {
  CreateIngredientInput,
  CreateWastageInput,
  StockAdjustmentInput,
  StockTakeReconciliationInput,
  UpdateIngredientInput,
  UpsertRecipeInput,
} from './types';

export class InventoryService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await inventoryRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Ingredients
  async listIngredients(query: any) {
    return inventoryRepository.findManyIngredients(query);
  }

  async getIngredientById(id: string) {
    const ingredient = await inventoryRepository.findIngredientById(id);
    if (!ingredient) throw new NotFoundError('Ingredient');
    return ingredient;
  }

  async createIngredient(input: CreateIngredientInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const created = await inventoryRepository.createIngredient({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'INGREDIENT_CREATED',
      entity: 'Ingredient',
      entityId: created.id,
      newValues: {
        sku: created.sku,
        name: created.name,
        unit: created.unit,
        currentStock: Number(created.currentStock),
        costPerUnit: Number(created.costPerUnit),
      },
    });

    return created;
  }

  async updateIngredient(id: string, input: UpdateIngredientInput) {
    const existing = await this.getIngredientById(id);
    const updated = await inventoryRepository.updateIngredient(id, input);

    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'INGREDIENT_UPDATED',
      entity: 'Ingredient',
      entityId: id,
      oldValues: {
        name: existing.name,
        costPerUnit: Number(existing.costPerUnit),
        reorderLevel: Number(existing.reorderLevel),
      },
      newValues: input as Record<string, any>,
    });

    return updated;
  }

  async deleteIngredient(id: string, actorUserId?: string) {
    const existing = await this.getIngredientById(id);
    await inventoryRepository.softDeleteIngredient(id, actorUserId);

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'INGREDIENT_DELETED',
      entity: 'Ingredient',
      entityId: id,
    });
  }

  // Recipes
  async listRecipes(branchId?: string) {
    return inventoryRepository.findRecipes(branchId);
  }

  async getRecipeByMenuItemId(menuItemId: string) {
    const recipe = await inventoryRepository.findRecipeByMenuItemId(menuItemId);
    if (!recipe) throw new NotFoundError('Recipe for menu item');
    return recipe;
  }

  async upsertRecipe(input: UpsertRecipeInput) {
    const menuItem = await inventoryRepository.findMenuItemById(input.menuItemId);
    if (!menuItem) throw new NotFoundError('Menu item');

    const result = await inventoryRepository.upsertRecipeTransaction(input);

    await auditService.log({
      branchId: menuItem.branchId,
      userId: input.actorUserId,
      action: 'RECIPE_UPSERTED',
      entity: 'Recipe',
      entityId: result.id,
      newValues: {
        menuItemId: input.menuItemId,
        yieldQty: result.yieldQty,
        ingredientCount: result.ingredients.length,
        computedFoodCost: result.computedFoodCost,
      },
    });

    return result;
  }

  async deleteRecipe(menuItemId: string, actorUserId?: string) {
    const existing = await inventoryRepository.findRecipeByMenuItemId(menuItemId);
    if (!existing) throw new NotFoundError('Recipe');
    await inventoryRepository.deleteRecipe(menuItemId);
    await auditService.log({
      userId: actorUserId,
      action: 'RECIPE_DELETED',
      entity: 'Recipe',
      entityId: existing.id,
    });
  }

  // Stock Adjustments
  async adjustStock(input: StockAdjustmentInput) {
    const ingredient = await this.getIngredientById(input.ingredientId);
    const previousStock = Number(ingredient.currentStock);
    const newStock = Number((previousStock + input.quantityDelta).toFixed(3));

    if (newStock < 0) {
      throw new ValidationError(
        `Insufficient stock for "${ingredient.name}". Current stock: ${previousStock} ${ingredient.unit}, requested delta: ${input.quantityDelta}`
      );
    }

    const result = await inventoryRepository.executeStockAdjustment({
      ...input,
      branchId: ingredient.branchId,
      previousStock,
      newStock,
    });

    // Mandatory INVENTORY_ADJUST audit log
    await auditService.log({
      branchId: ingredient.branchId,
      userId: input.actorUserId,
      action: 'INVENTORY_ADJUST',
      entity: 'Ingredient',
      entityId: ingredient.id,
      oldValues: {
        sku: ingredient.sku,
        name: ingredient.name,
        previousStock,
      },
      newValues: {
        type: input.type,
        quantityDelta: input.quantityDelta,
        newStock,
        notes: input.notes,
      },
    });

    // Emit low-stock Socket.io event if at or below reorderLevel
    if (newStock <= Number(ingredient.reorderLevel)) {
      emitSocketEvent(
        SOCKET_EVENTS.STOCK_LOW,
        {
          ingredientId: ingredient.id,
          sku: ingredient.sku,
          name: ingredient.name,
          unit: ingredient.unit,
          currentStock: newStock,
          reorderLevel: Number(ingredient.reorderLevel),
        },
        { branchId: ingredient.branchId }
      );
    }

    return result;
  }

  async listStockMovements(query: any) {
    return inventoryRepository.findManyStockMovements(query);
  }

  // Wastage
  async recordWastage(input: CreateWastageInput) {
    const ingredient = await this.getIngredientById(input.ingredientId);
    const previousStock = Number(ingredient.currentStock);
    const newStock = Number(Math.max(0, previousStock - input.quantity).toFixed(3));
    const unitCost = Number(ingredient.costPerUnit);
    const costLoss = Number((input.quantity * unitCost).toFixed(2));

    const result = await inventoryRepository.executeWastageTransaction({
      ...input,
      branchId: ingredient.branchId,
      previousStock,
      newStock,
      costLoss,
      unitCost,
    });

    await auditService.log({
      branchId: ingredient.branchId,
      userId: input.actorUserId,
      action: 'INVENTORY_ADJUST',
      entity: 'WastageLog',
      entityId: result.wastageLog.id,
      oldValues: { previousStock },
      newValues: {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantityWasted: input.quantity,
        costLoss,
        newStock,
        reason: input.reason,
      },
    });

    if (newStock <= Number(ingredient.reorderLevel)) {
      emitSocketEvent(
        SOCKET_EVENTS.STOCK_LOW,
        {
          ingredientId: ingredient.id,
          sku: ingredient.sku,
          name: ingredient.name,
          unit: ingredient.unit,
          currentStock: newStock,
          reorderLevel: Number(ingredient.reorderLevel),
        },
        { branchId: ingredient.branchId }
      );
    }

    return result;
  }

  async listWastageLogs(query: any) {
    return inventoryRepository.findManyWastageLogs(query);
  }

  // Stock-Take Reconciliation
  async reconcileStockTake(input: StockTakeReconciliationInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const reconciliations = await inventoryRepository.executeStockTakeReconciliation({
      branchId,
      items: input.items,
      notes: input.notes,
      actorUserId: input.actorUserId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'INVENTORY_ADJUST',
      entity: 'StockTake',
      newValues: {
        reconciledCount: reconciliations.length,
        notes: input.notes,
        items: reconciliations,
      },
    });

    return {
      reconciledCount: reconciliations.length,
      items: reconciliations,
    };
  }

  // Alerts
  async getLowStockAlerts(branchId?: string) {
    return inventoryRepository.findLowStockAlerts(branchId);
  }

  async getExpiringAlerts(branchId?: string, withinDays = 14) {
    return inventoryRepository.findExpiringAlerts(branchId, withinDays);
  }
}

export const inventoryService = new InventoryService();

