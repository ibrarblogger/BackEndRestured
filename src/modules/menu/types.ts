export interface CreateCategoryInput {
  branchId: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  actorUserId?: string;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export interface VariantInput {
  name: string;
  sku: string;
  priceDelta?: number;
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface AddOnInput {
  name: string;
  price: number;
  isAvailable?: boolean;
}

export interface CreateMenuItemInput {
  branchId: string;
  categoryId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  imageUrl?: string;
  station?: string;
  prepTimeMinutes?: number;
  calories?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isAvailable?: boolean;
  daypartSchedule?: Record<string, any>;
  variants?: VariantInput[];
  addOns?: AddOnInput[];
  actorUserId?: string;
}

export type UpdateMenuItemInput = Partial<CreateMenuItemInput>;

export interface ComboItemInput {
  menuItemId: string;
  quantity: number;
}

export interface CreateComboInput {
  branchId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable?: boolean;
  startDate?: string;
  endDate?: string;
  items: ComboItemInput[];
  actorUserId?: string;
}

export type UpdateComboInput = Partial<CreateComboInput>;

