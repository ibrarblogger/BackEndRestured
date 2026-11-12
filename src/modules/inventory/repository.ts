import { Prisma, StockMovementType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CreateIngredientInput,
  CreateWastageInput,
  StockAdjustmentInput,
  StockTakeItemInput,
  UpdateIngredientInput,
  UpsertRecipeInput,
} from './types';

export class InventoryRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  // Ingredients
  async findManyIngredients(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    search?: string;
    lowStockOnly?: boolean;
    isActive?: boolean;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.IngredientWhereInput = {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const allMatches = await prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const filtered = query.lowStockOnly
      ? allMatches.filter((ing) => Number(ing.currentStock) <= Number(ing.reorderLevel))
      : allMatches;

    const total = filtered.length;
    const items = filtered.slice(skip, skip + take).map((ing) => ({
      ...ing,
      isLowStock: Number(ing.currentStock) <= Number(ing.reorderLevel),
      stockValuation: Number(
        (Number(ing.currentStock) * Number(ing.costPerUnit)).toFixed(2)
      ),
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findIngredientById(id: string) {
    return prisma.ingredient.findFirst({
      where: { id, deletedAt: null },
      include: {
        recipeIngredients: {
          include: {
            recipe: {
              include: {
                menuItem: {
                  select: { id: true, sku: true, name: true, price: true },
                },
              },
            },
          },
        },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    });
  }

  async createIngredient(input: CreateIngredientInput & { branchId: string }) {
    return prisma.$transaction(async (tx) => {
      const initialStock = input.currentStock ?? 0;
      const ingredient = await tx.ingredient.create({
        data: {
          branchId: input.branchId,
          sku: input.sku,
          name: input.name,
          unit: input.unit,
          currentStock: initialStock,
          reorderLevel: input.reorderLevel ?? 10,
          costPerUnit: input.costPerUnit,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          isActive: input.isActive ?? true,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        },
      });

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            branchId: input.branchId,
            ingredientId: ingredient.id,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: initialStock,
            previousStock: 0,
            newStock: initialStock,
            unitCost: input.costPerUnit,
            notes: 'Initial opening stock balance',
            createdBy: input.actorUserId,
          },
        });
      }

      return ingredient;
    });
  }

  async updateIngredient(id: string, input: UpdateIngredientInput) {
    return prisma.ingredient.update({
      where: { id },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.reorderLevel !== undefined ? { reorderLevel: input.reorderLevel } : {}),
        ...(input.costPerUnit !== undefined ? { costPerUnit: input.costPerUnit } : {}),
        ...(input.expiryDate !== undefined
          ? { expiryDate: input.expiryDate ? new Date(input.expiryDate) : null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: input.actorUserId,
      },
    });
  }

  async softDeleteIngredient(id: string, actorUserId?: string) {
    return prisma.ingredient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedBy: actorUserId,
      },
    });
  }

  // Recipes (Bill of Materials)
  async findRecipes(branchId?: string) {
    return prisma.recipe.findMany({
      where: branchId
        ? {
            menuItem: {
              branchId,
              deletedAt: null,
            },
          }
        : {
            menuItem: { deletedAt: null },
          },
      include: {
        menuItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            price: true,
            costPrice: true,
          },
        },
        ingredients: {
          include: {
            ingredient: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                costPerUnit: true,
                currentStock: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecipeByMenuItemId(menuItemId: string) {
    return prisma.recipe.findUnique({
      where: { menuItemId },
      include: {
        menuItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            price: true,
            costPrice: true,
          },
        },
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });
  }

  async findMenuItemById(id: string) {
    return prisma.menuItem.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async upsertRecipeTransaction(input: UpsertRecipeInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({
        where: { menuItemId: input.menuItemId },
      });

      const yieldQty = Math.max(1, input.yieldQty ?? 1);

      let recipeId: string;
      if (existing) {
        await tx.recipeIngredient.deleteMany({
          where: { recipeId: existing.id },
        });
        const updated = await tx.recipe.update({
          where: { id: existing.id },
          data: {
            instructions: input.instructions,
            yieldQty,
            updatedBy: input.actorUserId,
            ingredients: {
              create: input.ingredients.map((item) => ({
                ingredientId: item.ingredientId,
                quantity: item.quantity,
              })),
            },
          },
        });
        recipeId = updated.id;
      } else {
        const created = await tx.recipe.create({
          data: {
            menuItemId: input.menuItemId,
            instructions: input.instructions,
            yieldQty,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
            ingredients: {
              create: input.ingredients.map((item) => ({
                ingredientId: item.ingredientId,
                quantity: item.quantity,
              })),
            },
          },
        });
        recipeId = created.id;
      }

      const fullRecipe = await tx.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: {
          menuItem: true,
          ingredients: {
            include: { ingredient: true },
          },
        },
      });

      // Automatically compute food cost per yield unit and update MenuItem.costPrice
      const totalBatchCost = fullRecipe.ingredients.reduce(
        (sum, ri) => sum + Number(ri.quantity) * Number(ri.ingredient.costPerUnit),
        0
      );
      const unitFoodCost = Number((totalBatchCost / yieldQty).toFixed(2));

      await tx.menuItem.update({
        where: { id: input.menuItemId },
        data: {
          costPrice: unitFoodCost,
          updatedBy: input.actorUserId,
        },
      });

      return {
        ...fullRecipe,
        computedFoodCost: unitFoodCost,
      };
    });
  }

  async deleteRecipe(menuItemId: string) {
    return prisma.recipe.delete({
      where: { menuItemId },
    });
  }

  // Stock Adjustments
  async executeStockAdjustment(
    input: StockAdjustmentInput & {
      branchId: string;
      previousStock: number;
      newStock: number;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const updatedIngredient = await tx.ingredient.update({
        where: { id: input.ingredientId },
        data: {
          currentStock: input.newStock,
          ...(input.unitCost !== undefined ? { costPerUnit: input.unitCost } : {}),
          updatedBy: input.actorUserId,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId: input.branchId,
          ingredientId: input.ingredientId,
          type: input.type,
          quantity: input.quantityDelta,
          previousStock: input.previousStock,
          newStock: input.newStock,
          unitCost: input.unitCost ?? Number(updatedIngredient.costPerUnit),
          referenceId: input.referenceId,
          notes: input.notes,
          createdBy: input.actorUserId,
        },
        include: {
          ingredient: true,
        },
      });

      if (Number(updatedIngredient.currentStock) <= Number(updatedIngredient.reorderLevel)) {
        await tx.notification.create({
          data: {
            branchId: input.branchId,
            type: 'STOCK_LOW',
            title: `Low Stock Alert: ${updatedIngredient.name}`,
            message: `${updatedIngredient.name} (${updatedIngredient.sku}) is at ${Number(
              updatedIngredient.currentStock
            )} ${updatedIngredient.unit} (reorder level: ${Number(
              updatedIngredient.reorderLevel
            )} ${updatedIngredient.unit}).`,
            data: {
              ingredientId: updatedIngredient.id,
              sku: updatedIngredient.sku,
              currentStock: Number(updatedIngredient.currentStock),
              reorderLevel: Number(updatedIngredient.reorderLevel),
            },
          },
        });
      }

      return { ingredient: updatedIngredient, movement };
    });
  }

  async findManyStockMovements(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    ingredientId?: string;
    type?: StockMovementType;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);
    const where: Prisma.StockMovementWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          ingredient: {
            select: { id: true, sku: true, name: true, unit: true },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Wastage Logging
  async executeWastageTransaction(
    input: CreateWastageInput & {
      branchId: string;
      previousStock: number;
      newStock: number;
      costLoss: number;
      unitCost: number;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const updatedIngredient = await tx.ingredient.update({
        where: { id: input.ingredientId },
        data: {
          currentStock: input.newStock,
          updatedBy: input.actorUserId,
        },
      });

      const wastageLog = await tx.wastageLog.create({
        data: {
          branchId: input.branchId,
          ingredientId: input.ingredientId,
          quantity: input.quantity,
          costLoss: input.costLoss,
          reason: input.reason,
          reportedBy: input.actorUserId,
        },
        include: {
          ingredient: {
            select: { id: true, sku: true, name: true, unit: true },
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          branchId: input.branchId,
          ingredientId: input.ingredientId,
          type: StockMovementType.WASTAGE,
          quantity: -Math.abs(input.quantity),
          previousStock: input.previousStock,
          newStock: input.newStock,
          unitCost: input.unitCost,
          referenceId: wastageLog.id,
          notes: `Wastage: ${input.reason}`,
          createdBy: input.actorUserId,
        },
      });

      return { wastageLog, ingredient: updatedIngredient };
    });
  }

  async findManyWastageLogs(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    ingredientId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);
    const where: Prisma.WastageLogWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.wastageLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          ingredient: {
            select: { id: true, sku: true, name: true, unit: true, costPerUnit: true },
          },
        },
      }),
      prisma.wastageLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Stock-Take / Physical Audit Reconciliation
  async executeStockTakeReconciliation(params: {
    branchId: string;
    items: StockTakeItemInput[];
    notes?: string;
    actorUserId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const reconciliations = [];

      for (const item of params.items) {
        const ingredient = await tx.ingredient.findFirst({
          where: { id: item.ingredientId, deletedAt: null },
        });
        if (!ingredient) continue;

        const previousStock = Number(ingredient.currentStock);
        const physicalCount = Number(item.physicalCount.toFixed(3));
        const variance = Number((physicalCount - previousStock).toFixed(3));

        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: {
            currentStock: physicalCount,
            updatedBy: params.actorUserId,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            branchId: ingredient.branchId,
            ingredientId: ingredient.id,
            type: StockMovementType.STOCK_TAKE,
            quantity: variance,
            previousStock,
            newStock: physicalCount,
            unitCost: Number(ingredient.costPerUnit),
            notes: item.notes || params.notes || 'Physical stock-take reconciliation',
            createdBy: params.actorUserId,
          },
        });

        reconciliations.push({
          ingredientId: ingredient.id,
          sku: ingredient.sku,
          name: ingredient.name,
          unit: ingredient.unit,
          previousStock,
          physicalCount,
          variance,
          varianceValue: Number((variance * Number(ingredient.costPerUnit)).toFixed(2)),
          movementId: movement.id,
        });
      }

      return reconciliations;
    });
  }

  // Alerts: Low Stock & Expiring Soon
  async findLowStockAlerts(branchId?: string) {
    const ingredients = await prisma.ingredient.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { currentStock: 'asc' },
    });

    return ingredients
      .filter((ing) => Number(ing.currentStock) <= Number(ing.reorderLevel))
      .map((ing) => ({
        ...ing,
        shortfall: Number(
          Math.max(0, Number(ing.reorderLevel) - Number(ing.currentStock)).toFixed(3)
        ),
      }));
  }

  async findExpiringAlerts(branchId?: string, withinDays = 14) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + withinDays);

    return prisma.ingredient.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        expiryDate: {
          not: null,
          lte: thresholdDate,
        },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }
}

export const inventoryRepository = new InventoryRepository();

