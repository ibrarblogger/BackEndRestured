import { NotFoundError, ValidationError } from '../../errors';
import { auditService } from '../audit/service';
import { menuRepository } from './repository';
import {
  AddOnInput,
  CreateCategoryInput,
  CreateComboInput,
  CreateMenuItemInput,
  UpdateCategoryInput,
  UpdateComboInput,
  UpdateMenuItemInput,
  VariantInput,
} from './types';

export class MenuService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await menuRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Categories
  async listCategories(query: any) {
    return menuRepository.findManyCategories(query);
  }

  async getCategoryById(id: string) {
    const category = await menuRepository.findCategoryById(id);
    if (!category) throw new NotFoundError('Category');
    return category;
  }

  async createCategory(input: CreateCategoryInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const created = await menuRepository.createCategory({ ...input, branchId });
    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'CATEGORY_CREATED',
      entity: 'Category',
      entityId: created.id,
      newValues: { name: created.name, slug: created.slug },
    });
    return created;
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    const existing = await this.getCategoryById(id);
    const updated = await menuRepository.updateCategory(id, input);
    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      entityId: id,
      oldValues: { name: existing.name },
      newValues: input as Record<string, any>,
    });
    return updated;
  }

  async deleteCategory(id: string, actorUserId?: string) {
    const existing = await this.getCategoryById(id);
    await menuRepository.softDeleteCategory(id, actorUserId);
    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'CATEGORY_DELETED',
      entity: 'Category',
      entityId: id,
    });
  }

  // Menu Items
  async listMenuItems(query: any) {
    return menuRepository.findManyMenuItems(query);
  }

  async getMenuItemById(id: string) {
    const item = await menuRepository.findMenuItemById(id);
    if (!item) throw new NotFoundError('Menu item');
    return item;
  }

  async createMenuItem(input: CreateMenuItemInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const category = await menuRepository.findCategoryById(input.categoryId);
    if (!category) throw new NotFoundError('Category');

    const created = await menuRepository.createMenuItem({ ...input, branchId });
    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'MENU_ITEM_CREATED',
      entity: 'MenuItem',
      entityId: created.id,
      newValues: { sku: created.sku, name: created.name, price: Number(created.price) },
    });
    return created;
  }

  async updateMenuItem(id: string, input: UpdateMenuItemInput) {
    const existing = await this.getMenuItemById(id);
    const updated = await menuRepository.updateMenuItem(id, input);

    if (input.price !== undefined && Number(input.price) !== Number(existing.price)) {
      await auditService.log({
        branchId: existing.branchId,
        userId: input.actorUserId,
        action: 'PRICE_CHANGE',
        entity: 'MenuItem',
        entityId: id,
        oldValues: { sku: existing.sku, price: Number(existing.price) },
        newValues: { sku: updated.sku, price: Number(updated.price) },
      });
    } else {
      await auditService.log({
        branchId: existing.branchId,
        userId: input.actorUserId,
        action: 'MENU_ITEM_UPDATED',
        entity: 'MenuItem',
        entityId: id,
        newValues: input as Record<string, any>,
      });
    }

    return updated;
  }

  async toggleAvailability(id: string, isAvailable: boolean, actorUserId?: string) {
    await this.getMenuItemById(id);
    return menuRepository.updateMenuItem(id, { isAvailable, actorUserId });
  }

  async updateDaypartSchedule(
    id: string,
    daypartSchedule: Record<string, any>,
    actorUserId?: string
  ) {
    await this.getMenuItemById(id);
    return menuRepository.updateMenuItem(id, { daypartSchedule, actorUserId });
  }

  async deleteMenuItem(id: string, actorUserId?: string) {
    const existing = await this.getMenuItemById(id);
    await menuRepository.softDeleteMenuItem(id, actorUserId);
    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'MENU_ITEM_DELETED',
      entity: 'MenuItem',
      entityId: id,
    });
  }

  async addVariant(menuItemId: string, input: VariantInput) {
    await this.getMenuItemById(menuItemId);
    return menuRepository.addVariant(menuItemId, input);
  }

  async deleteVariant(variantId: string) {
    return menuRepository.deleteVariant(variantId);
  }

  async addAddOn(menuItemId: string, input: AddOnInput) {
    await this.getMenuItemById(menuItemId);
    return menuRepository.addAddOn(menuItemId, input);
  }

  async deleteAddOn(addOnId: string) {
    return menuRepository.deleteAddOn(addOnId);
  }

  // Combos
  async listCombos(query: any) {
    return menuRepository.findManyCombos(query);
  }

  async getComboById(id: string) {
    const combo = await menuRepository.findComboById(id);
    if (!combo) throw new NotFoundError('Combo');
    return combo;
  }

  async createCombo(input: CreateComboInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    const created = await menuRepository.createCombo({ ...input, branchId });
    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'COMBO_CREATED',
      entity: 'Combo',
      entityId: created.id,
      newValues: { sku: created.sku, name: created.name, price: Number(created.price) },
    });
    return created;
  }

  async updateCombo(id: string, input: UpdateComboInput) {
    const existing = await this.getComboById(id);
    const updated = await menuRepository.updateCombo(id, input);
    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'COMBO_UPDATED',
      entity: 'Combo',
      entityId: id,
      newValues: input as Record<string, any>,
    });
    return updated;
  }

  async deleteCombo(id: string, actorUserId?: string) {
    const existing = await this.getComboById(id);
    await menuRepository.softDeleteCombo(id, actorUserId);
    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'COMBO_DELETED',
      entity: 'Combo',
      entityId: id,
    });
  }

  // CSV Export & Import
  async exportMenuItemsCsv(branchId?: string): Promise<string> {
    const items = await menuRepository.findAllItemsForCsvExport(branchId);
    const headers = [
      'sku',
      'name',
      'categoryName',
      'categorySlug',
      'price',
      'costPrice',
      'station',
      'prepTimeMinutes',
      'isVegetarian',
      'isAvailable',
      'description',
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = items.map((item) =>
      [
        item.sku,
        item.name,
        item.category.name,
        item.category.slug,
        Number(item.price).toFixed(2),
        Number(item.costPrice).toFixed(2),
        item.station,
        item.prepTimeMinutes,
        item.isVegetarian,
        item.isAvailable,
        item.description || '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  async importMenuItemsCsv(csvContent: string, branchId?: string, actorUserId?: string) {
    const resolvedBranchId = await this.ensureBranchId(branchId);
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new ValidationError('CSV file must contain a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const idx = (col: string) => headers.findIndex((h) => h.toLowerCase() === col.toLowerCase());

    const skuIdx = idx('sku');
    const nameIdx = idx('name');
    const catNameIdx = idx('categoryName');
    const catSlugIdx = idx('categorySlug');
    const priceIdx = idx('price');

    if (skuIdx === -1 || nameIdx === -1 || priceIdx === -1) {
      throw new ValidationError('CSV must include at least sku, name, and price columns');
    }

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const sku = (cols[skuIdx] || '').toUpperCase();
      const name = cols[nameIdx] || '';
      const price = parseFloat(cols[priceIdx] || '0');
      if (!sku || !name || Number.isNaN(price)) continue;

      const categoryName = (catNameIdx !== -1 && cols[catNameIdx]) || 'General';
      const categorySlug =
        (catSlugIdx !== -1 && cols[catSlugIdx]) ||
        categoryName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

      const category = await menuRepository.findOrCreateCategoryBySlug(
        resolvedBranchId,
        categoryName,
        categorySlug
      );

      const costPrice = parseFloat(cols[idx('costPrice')] || '0') || 0;
      const station = cols[idx('station')] || 'MAIN_KITCHEN';
      const prepTimeMinutes = parseInt(cols[idx('prepTimeMinutes')] || '15', 10) || 15;
      const isVegetarian = (cols[idx('isVegetarian')] || '').toLowerCase() === 'true';
      const isAvailable = (cols[idx('isAvailable')] || 'true').toLowerCase() !== 'false';
      const description = cols[idx('description')] || undefined;

      await menuRepository.upsertMenuItemFromCsv({
        branchId: resolvedBranchId,
        categoryId: category.id,
        sku,
        name,
        description,
        price,
        costPrice,
        station,
        prepTimeMinutes,
        isVegetarian,
        isAvailable,
        actorUserId,
      });
      importedCount++;
    }

    await auditService.log({
      branchId: resolvedBranchId,
      userId: actorUserId,
      action: 'MENU_CSV_IMPORT',
      entity: 'MenuItem',
      newValues: { importedCount },
    });

    return { importedCount };
  }
}

export const menuService = new MenuService();

