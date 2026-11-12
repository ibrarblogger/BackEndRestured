import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { branchesService } from './service';

export class BranchesController {
  async list(req: Request, res: Response) {
    const { items, meta } = await branchesService.listBranches(req.query);
    return sendSuccess(res, items, 'Branches retrieved successfully', 200, meta);
  }

  async getById(req: Request, res: Response) {
    const branch = await branchesService.getBranchById(String(req.params.id));
    return sendSuccess(res, branch, 'Branch retrieved successfully');
  }

  async getCurrencies(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const config = await branchesService.getCurrenciesConfig(branchId);
    return sendSuccess(
      res,
      config,
      'Active currency and supported currencies retrieved successfully'
    );
  }

  async updateCurrency(req: Request, res: Response) {
    const branchId = (req.params.id as string | undefined) || req.body.branchId;
    const result = await branchesService.updateCurrencyByAdmin({
      currency: req.body.currency,
      branchId,
      applyToAllBranches: req.params.id ? false : (req.body.applyToAllBranches ?? true),
      actorUserId: req.user?.sub,
    });
    return sendSuccess(
      res,
      result,
      `System currency updated to ${result.activeCurrency.code} (${result.activeCurrency.symbol}) by Admin`
    );
  }

  async getLanguages(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const requestedLang =
      (req.query.lang as string | undefined) ||
      req.headers['accept-language']?.split(',')[0];
    const config = await branchesService.getLanguagesConfig(branchId, requestedLang);
    return sendSuccess(
      res,
      config,
      'Active language, translations, and supported languages retrieved successfully'
    );
  }

  async updateLanguage(req: Request, res: Response) {
    const branchId = (req.params.id as string | undefined) || req.body.branchId;
    const result = await branchesService.updateLanguageByAdmin({
      language: req.body.language,
      branchId,
      applyToAllBranches: req.params.id ? false : (req.body.applyToAllBranches ?? true),
      actorUserId: req.user?.sub,
    });
    return sendSuccess(
      res,
      result,
      `System language updated to ${result.activeLanguage.name} (${result.activeLanguage.nativeName}) by Admin`
    );
  }

  async getLocalization(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const requestedLang = req.query.lang as string | undefined;
    const config = await branchesService.getLocalizationConfig(branchId, requestedLang);
    return sendSuccess(
      res,
      config,
      'Multi-currency and multi-language localization retrieved successfully'
    );
  }

  async create(req: Request, res: Response) {
    const branch = await branchesService.createBranch({
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, branch, 'Branch created successfully', 201);
  }

  async update(req: Request, res: Response) {
    const branch = await branchesService.updateBranch(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, branch, 'Branch updated successfully');
  }

  async delete(req: Request, res: Response) {
    await branchesService.deleteBranch(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Branch deleted successfully');
  }

  async getSettings(req: Request, res: Response) {
    const settings = await branchesService.getBranchSettings(String(req.params.id));
    return sendSuccess(res, settings, 'Branch settings retrieved successfully');
  }

  async upsertSetting(req: Request, res: Response) {
    const setting = await branchesService.upsertBranchSetting(
      String(req.params.id),
      req.body.key,
      req.body.value,
      req.body.group,
      req.user?.sub
    );
    return sendSuccess(res, setting, 'Branch setting saved successfully');
  }
}

export const branchesController = new BranchesController();
