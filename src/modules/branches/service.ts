import { Prisma } from '@prisma/client';
import {
  getCurrencyDetails,
  SUPPORTED_CURRENCIES,
} from '../../constants/currencies';
import {
  getLanguageDetails,
  getTranslationsForLanguage,
  SUPPORTED_LANGUAGES,
} from '../../constants/languages';
import { ConflictError, NotFoundError } from '../../errors';
import { auditService } from '../audit/service';
import { branchesRepository } from './repository';
import { CreateBranchInput, UpdateBranchInput } from './types';

function enrichBranchWithCurrency<T extends { currency: string }>(branch: T) {
  const currencyDetails = getCurrencyDetails(branch.currency);
  return {
    ...branch,
    currencySymbol: currencyDetails.symbol,
    currencyName: currencyDetails.name,
    currencyDetails,
  };
}

export class BranchesService {
  async listBranches(query: any) {
    const { items, meta } = await branchesRepository.findMany(query);
    return {
      items: items.map((b) => enrichBranchWithCurrency(b)),
      meta,
    };
  }

  async getBranchById(id: string) {
    const branch = await branchesRepository.findById(id);
    if (!branch) {
      throw new NotFoundError('Branch');
    }
    return enrichBranchWithCurrency(branch);
  }

  async getCurrenciesConfig(branchId?: string) {
    const branch = branchId
      ? await branchesRepository.findById(branchId)
      : await branchesRepository.findFirstActive();

    const activeCode = branch?.currency ?? 'PKR';
    const activeCurrency = getCurrencyDetails(activeCode);

    return {
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      activeCurrency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    };
  }

  async getLanguagesConfig(branchId?: string, requestedLang?: string) {
    const branch = branchId
      ? await branchesRepository.findById(branchId)
      : await branchesRepository.findFirstActive();

    const langSetting = branch?.settings?.find((s) => s.key === 'language');
    const savedCode =
      typeof langSetting?.value === 'object' &&
      langSetting?.value !== null &&
      'code' in langSetting.value
        ? String((langSetting.value as Record<string, any>).code)
        : typeof langSetting?.value === 'string'
          ? langSetting.value
          : 'en';

    const effectiveCode = requestedLang || savedCode;
    const activeLanguage = getLanguageDetails(effectiveCode);
    const translations = getTranslationsForLanguage(activeLanguage.code);

    return {
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      activeLanguage,
      translations,
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }

  async getLocalizationConfig(branchId?: string, requestedLang?: string) {
    const [currencyConfig, languageConfig] = await Promise.all([
      this.getCurrenciesConfig(branchId),
      this.getLanguagesConfig(branchId, requestedLang),
    ]);

    return {
      branchId: currencyConfig.branchId,
      branchName: currencyConfig.branchName,
      activeCurrency: currencyConfig.activeCurrency,
      activeLanguage: languageConfig.activeLanguage,
      translations: languageConfig.translations,
      supportedCurrencies: currencyConfig.supportedCurrencies,
      supportedLanguages: languageConfig.supportedLanguages,
    };
  }

  async updateLanguageByAdmin(params: {
    language: string;
    branchId?: string;
    applyToAllBranches?: boolean;
    actorUserId?: string;
  }) {
    const languageDetails = getLanguageDetails(params.language);
    const translations = getTranslationsForLanguage(languageDetails.code);

    const targetBranches =
      params.branchId && !params.applyToAllBranches
        ? [await this.getBranchById(params.branchId)]
        : await branchesRepository.findAllActive();

    for (const b of targetBranches) {
      await branchesRepository.upsertSetting(
        b.id,
        'language',
        {
          code: languageDetails.code,
          name: languageDetails.name,
          nativeName: languageDetails.nativeName,
          direction: languageDetails.direction,
          locale: languageDetails.locale,
        },
        'LOCALIZATION',
        params.actorUserId
      );

      await auditService.log({
        branchId: b.id,
        userId: params.actorUserId,
        action: 'LANGUAGE_CHANGED',
        entity: 'Setting',
        entityId: b.id,
        newValues: {
          language: languageDetails.code,
          name: languageDetails.name,
          nativeName: languageDetails.nativeName,
          direction: languageDetails.direction,
        },
      });
    }

    return {
      activeLanguage: languageDetails,
      translations,
      updatedBranchIds: targetBranches.map((b) => b.id),
    };
  }

  async updateCurrencyByAdmin(params: {
    currency: string;
    branchId?: string;
    applyToAllBranches?: boolean;
    actorUserId?: string;
  }) {
    const normalizedCurrency = params.currency.trim().toUpperCase();
    const currencyDetails = getCurrencyDetails(normalizedCurrency);

    if (params.branchId && !params.applyToAllBranches) {
      const existing = await branchesRepository.findById(params.branchId);
      if (!existing) {
        throw new NotFoundError('Branch');
      }

      const updated = await branchesRepository.update(params.branchId, {
        currency: normalizedCurrency,
        updatedBy: params.actorUserId,
      });

      await branchesRepository.upsertSetting(
        params.branchId,
        'currency',
        {
          code: currencyDetails.code,
          symbol: currencyDetails.symbol,
          name: currencyDetails.name,
          decimals: currencyDetails.decimals,
        },
        'CURRENCY',
        params.actorUserId
      );

      await auditService.log({
        branchId: params.branchId,
        userId: params.actorUserId,
        action: 'CURRENCY_CHANGED',
        entity: 'Branch',
        entityId: params.branchId,
        oldValues: { currency: existing.currency },
        newValues: {
          currency: normalizedCurrency,
          symbol: currencyDetails.symbol,
          name: currencyDetails.name,
        },
      });

      return {
        activeCurrency: currencyDetails,
        updatedBranches: [enrichBranchWithCurrency(updated)],
      };
    }

    // Apply currency across all active branches
    const branches = await branchesRepository.updateAllBranchesCurrency(
      normalizedCurrency,
      params.actorUserId
    );

    for (const b of branches) {
      await branchesRepository.upsertSetting(
        b.id,
        'currency',
        {
          code: currencyDetails.code,
          symbol: currencyDetails.symbol,
          name: currencyDetails.name,
          decimals: currencyDetails.decimals,
        },
        'CURRENCY',
        params.actorUserId
      );

      await auditService.log({
        branchId: b.id,
        userId: params.actorUserId,
        action: 'CURRENCY_CHANGED',
        entity: 'Branch',
        entityId: b.id,
        newValues: {
          currency: normalizedCurrency,
          symbol: currencyDetails.symbol,
          name: currencyDetails.name,
        },
      });
    }

    return {
      activeCurrency: currencyDetails,
      updatedBranches: branches.map((b) => enrichBranchWithCurrency(b)),
    };
  }

  async createBranch(input: CreateBranchInput) {
    const existing = await branchesRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictError(`Branch with code ${input.code} already exists`);
    }

    const branch = await branchesRepository.create({
      name: input.name,
      code: input.code,
      address: input.address,
      phone: input.phone,
      email: input.email,
      currency: (input.currency ?? 'PKR').toUpperCase(),
      timezone: input.timezone ?? 'Asia/Karachi',
      taxRatePercent: input.taxRatePercent ?? 10,
      serviceChargePercent: input.serviceChargePercent ?? 5,
      orderNumberPrefix: input.orderNumberPrefix ?? 'ORD',
      receiptHeader: input.receiptHeader,
      receiptFooter: input.receiptFooter,
      businessHours: input.businessHours
        ? (input.businessHours as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      isActive: input.isActive ?? true,
      createdBy: input.actorUserId,
    });

    await auditService.log({
      branchId: branch.id,
      userId: input.actorUserId,
      action: 'BRANCH_CREATED',
      entity: 'Branch',
      entityId: branch.id,
      newValues: { name: branch.name, code: branch.code, currency: branch.currency },
    });

    return enrichBranchWithCurrency(branch);
  }

  async updateBranch(id: string, input: UpdateBranchInput) {
    const existing = await branchesRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Branch');
    }

    const updated = await branchesRepository.update(id, {
      name: input.name,
      code: input.code,
      address: input.address,
      phone: input.phone,
      email: input.email,
      currency: input.currency ? input.currency.toUpperCase() : undefined,
      timezone: input.timezone,
      taxRatePercent: input.taxRatePercent,
      serviceChargePercent: input.serviceChargePercent,
      orderNumberPrefix: input.orderNumberPrefix,
      receiptHeader: input.receiptHeader,
      receiptFooter: input.receiptFooter,
      businessHours:
        input.businessHours !== undefined
          ? (input.businessHours as Prisma.InputJsonValue)
          : undefined,
      isActive: input.isActive,
      updatedBy: input.actorUserId,
    });

    await auditService.log({
      branchId: id,
      userId: input.actorUserId,
      action: 'BRANCH_UPDATED',
      entity: 'Branch',
      entityId: id,
      oldValues: {
        currency: existing.currency,
        taxRatePercent: existing.taxRatePercent,
        serviceChargePercent: existing.serviceChargePercent,
      },
      newValues: input as Record<string, any>,
    });

    return enrichBranchWithCurrency(updated);
  }

  async deleteBranch(id: string, actorUserId?: string) {
    const existing = await branchesRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Branch');
    }
    await branchesRepository.softDelete(id, actorUserId);
    await auditService.log({
      branchId: id,
      userId: actorUserId,
      action: 'BRANCH_DELETED',
      entity: 'Branch',
      entityId: id,
    });
  }

  async getBranchSettings(branchId: string) {
    await this.getBranchById(branchId);
    return branchesRepository.getSettings(branchId);
  }

  async upsertBranchSetting(
    branchId: string,
    key: string,
    value: any,
    group = 'GENERAL',
    actorUserId?: string
  ) {
    await this.getBranchById(branchId);
    const setting = await branchesRepository.upsertSetting(
      branchId,
      key,
      value,
      group,
      actorUserId
    );
    await auditService.log({
      branchId,
      userId: actorUserId,
      action: 'SETTING_UPDATED',
      entity: 'Setting',
      entityId: setting.id,
      newValues: { key, value, group },
    });
    return setting;
  }
}

export const branchesService = new BranchesService();
