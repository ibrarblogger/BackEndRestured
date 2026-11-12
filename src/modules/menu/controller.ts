import { Request, Response } from 'express';
import { uploadFile } from '../../config/supabase';
import { ValidationError } from '../../errors';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { menuService } from './service';

export class MenuController {
  // Categories
  async listCategories(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await menuService.listCategories({ ...req.query, branchId });
    return sendSuccess(res, items, 'Categories retrieved successfully', 200, meta);
  }

  async getCategoryById(req: Request, res: Response) {
    const category = await menuService.getCategoryById(String(req.params.id));
    return sendSuccess(res, category, 'Category retrieved successfully');
  }

  async createCategory(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const category = await menuService.createCategory({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, category, 'Category created successfully', 201);
  }

  async updateCategory(req: Request, res: Response) {
    const category = await menuService.updateCategory(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, category, 'Category updated successfully');
  }

  async deleteCategory(req: Request, res: Response) {
    await menuService.deleteCategory(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Category deleted successfully');
  }

  // Menu Items
  async listMenuItems(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await menuService.listMenuItems({ ...req.query, branchId });
    return sendSuccess(res, items, 'Menu items retrieved successfully', 200, meta);
  }

  async getMenuItemById(req: Request, res: Response) {
    const item = await menuService.getMenuItemById(String(req.params.id));
    return sendSuccess(res, item, 'Menu item retrieved successfully');
  }

  async createMenuItem(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const item = await menuService.createMenuItem({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, item, 'Menu item created successfully', 201);
  }

  async updateMenuItem(req: Request, res: Response) {
    const item = await menuService.updateMenuItem(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, item, 'Menu item updated successfully');
  }

  async toggleAvailability(req: Request, res: Response) {
    const item = await menuService.toggleAvailability(
      String(req.params.id),
      req.body.isAvailable,
      req.user?.sub
    );
    return sendSuccess(res, item, 'Menu item availability updated');
  }

  async updateDaypart(req: Request, res: Response) {
    const item = await menuService.updateDaypartSchedule(
      String(req.params.id),
      req.body.daypartSchedule,
      req.user?.sub
    );
    return sendSuccess(res, item, 'Menu item daypart schedule updated');
  }

  async deleteMenuItem(req: Request, res: Response) {
    await menuService.deleteMenuItem(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Menu item deleted successfully');
  }

  async addVariant(req: Request, res: Response) {
    const variant = await menuService.addVariant(String(req.params.id), req.body);
    return sendSuccess(res, variant, 'Variant added successfully', 201);
  }

  async deleteVariant(req: Request, res: Response) {
    await menuService.deleteVariant(String(req.params.id));
    return sendSuccess(res, null, 'Variant deleted successfully');
  }

  async addAddOn(req: Request, res: Response) {
    const addOn = await menuService.addAddOn(String(req.params.id), req.body);
    return sendSuccess(res, addOn, 'Add-on created successfully', 201);
  }

  async deleteAddOn(req: Request, res: Response) {
    await menuService.deleteAddOn(String(req.params.id));
    return sendSuccess(res, null, 'Add-on deleted successfully');
  }

  // Combos
  async listCombos(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await menuService.listCombos({ ...req.query, branchId });
    return sendSuccess(res, items, 'Combos retrieved successfully', 200, meta);
  }

  async getComboById(req: Request, res: Response) {
    const combo = await menuService.getComboById(String(req.params.id));
    return sendSuccess(res, combo, 'Combo retrieved successfully');
  }

  async createCombo(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const combo = await menuService.createCombo({
      ...req.body,
      branchId: branchId!,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, combo, 'Combo created successfully', 201);
  }

  async updateCombo(req: Request, res: Response) {
    const combo = await menuService.updateCombo(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, combo, 'Combo updated successfully');
  }

  async deleteCombo(req: Request, res: Response) {
    await menuService.deleteCombo(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Combo deleted successfully');
  }

  // Supabase Storage Upload
  async uploadImage(req: Request, res: Response) {
    if (!req.file) {
      throw new ValidationError('Image file is required under field name "file"');
    }
    const uploaded = await uploadFile({
      bucket: 'menu-images',
      fileName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      isPublic: true,
    });
    return sendSuccess(res, uploaded, 'Menu image uploaded successfully', 201);
  }

  // CSV Export & Import
  async exportCsv(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const csv = await menuService.exportMenuItemsCsv(branchId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="menu-items.csv"');
    return res.status(200).send(csv);
  }

  async importCsv(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body?.branchId);
    const csvContent = req.file
      ? req.file.buffer.toString('utf-8')
      : typeof req.body?.csv === 'string'
        ? req.body.csv
        : '';

    if (!csvContent) {
      throw new ValidationError('Provide a CSV file upload ("file") or "csv" string in body');
    }

    const result = await menuService.importMenuItemsCsv(csvContent, branchId, req.user?.sub);
    return sendSuccess(res, result, `Imported ${result.importedCount} menu items successfully`);
  }
}

export const menuController = new MenuController();

