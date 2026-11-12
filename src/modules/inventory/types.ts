import { StockMovementType } from '@prisma/client';

export interface CreateIngredientInput {
  branchId?: string;
  sku: string;
  name: string;
  unit: string;
  currentStock?: number;
  reorderLevel?: number;
  costPerUnit: number;
  expiryDate?: string | Date | null;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateIngredientInput {
  sku?: string;
  name?: string;
  unit?: string;
  reorderLevel?: number;
  costPerUnit?: number;
  expiryDate?: string | Date | null;
  isActive?: boolean;
  actorUserId?: string;
}

export interface RecipeIngredientItemInput {
  ingredientId: string;
  quantity: number;
}

export interface UpsertRecipeInput {
  menuItemId: string;
  instructions?: string;
  yieldQty?: number;
  ingredients: RecipeIngredientItemInput[];
  actorUserId?: string;
}

export interface StockAdjustmentInput {
  branchId?: string;
  ingredientId: string;
  type: StockMovementType;
  quantityDelta: number; // positive to add stock, negative to deduct stock
  unitCost?: number;
  referenceId?: string;
  notes: string;
  actorUserId?: string;
}

export interface CreateWastageInput {
  branchId?: string;
  ingredientId: string;
  quantity: number;
  reason: string;
  actorUserId?: string;
}

export interface StockTakeItemInput {
  ingredientId: string;
  physicalCount: number;
  notes?: string;
}

export interface StockTakeReconciliationInput {
  branchId?: string;
  items: StockTakeItemInput[];
  notes?: string;
  actorUserId?: string;
}

