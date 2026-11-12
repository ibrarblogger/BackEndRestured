import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
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

export class MenuRepository {
  // ==========================================
  // CATEGORIES
  // ==========================================

  async findManyCategories(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    isActive?: boolean;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination({
      ...query,
      sortBy: query.sortBy || 'sortOrder',
      sortOrder: query.sortOrder || 'asc',
    });

    const where: Prisma.CategoryWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: { menuItems: { where: { deletedAt: null } } },
          },
        },
      }),
      prisma.category.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findCategoryById(id: string) {
    return prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        menuItems: {
          where: { deletedAt: null },
          include: {
            variants: { where: { deletedAt: null } },
            addOns: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  async createCategory(data: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        imageUrl: data.imageUrl,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        createdBy: data.actorUserId,
      },
    });
  }

  async updateCategory(id: string, data: UpdateCategoryInput) {
    return prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        imageUrl: data.imageUrl,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        updatedBy: data.actorUserId,
      },
    });
  }

  async softDeleteCategory(id: string, actorUserId?: string) {
    return prisma.category.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  // ==========================================
  // MENU ITEMS, VARIANTS & ADD-ONS
  // ==========================================

  async findManyMenuItems(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    categoryId?: string;
    station?: string;
    isAvailable?: boolean;
    isVegetarian?: boolean;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination(query);

    const where: Prisma.MenuItemWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.station) where.station = query.station;
    if (typeof query.isAvailable === 'boolean') where.isAvailable = query.isAvailable;
    if (typeof query.isVegetarian === 'boolean') where.isVegetarian = query.isVegetarian;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: { where: { deletedAt: null } },
          addOns: { where: { deletedAt: null } },
        },
      }),
      prisma.menuItem.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findMenuItemById(id: string) {
    return prisma.menuItem.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { deletedAt: null } },
        addOns: { where: { deletedAt: null } },
        recipe: {
          include: {
            ingredients: {
              include: { ingredient: true },
            },
          },
        },
      },
    });
  }

  async createMenuItem(data: CreateMenuItemInput) {
    return prisma.menuItem.create({
      data: {
        branchId: data.branchId,
        categoryId: data.categoryId,
        sku: data.sku,
        name: data.name,
        description: data.description,
        price: data.price,
        costPrice: data.costPrice ?? 0,
        imageUrl: data.imageUrl,
        station: data.station ?? 'MAIN_KITCHEN',
        prepTimeMinutes: data.prepTimeMinutes ?? 15,
        calories: data.calories,
        isVegetarian: data.isVegetarian ?? false,
        isVegan: data.isVegan ?? false,
        isGlutenFree: data.isGlutenFree ?? false,
        isAvailable: data.isAvailable ?? true,
        daypartSchedule: data.daypartSchedule
          ? (data.daypartSchedule as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdBy: data.actorUserId,
        variants: data.variants?.length
          ? {
              create: data.variants.map((v) => ({
                name: v.name,
                sku: v.sku,
                priceDelta: v.priceDelta ?? 0,
                isDefault: v.isDefault ?? false,
                isAvailable: v.isAvailable ?? true,
              })),
            }
          : undefined,
        addOns: data.addOns?.length
          ? {
              create: data.addOns.map((a) => ({
                name: a.name,
                price: a.price,
                isAvailable: a.isAvailable ?? true,
              })),
            }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { deletedAt: null } },
        addOns: { where: { deletedAt: null } },
      },
    });
  }

  async updateMenuItem(id: string, data: UpdateMenuItemInput) {
    return prisma.$transaction(async (tx) => {
      if (data.variants !== undefined) {
        await tx.itemVariant.updateMany({
          where: { menuItemId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        if (data.variants.length > 0) {
          await tx.itemVariant.createMany({
            data: data.variants.map((v) => ({
              menuItemId: id,
              name: v.name,
              sku: v.sku,
              priceDelta: v.priceDelta ?? 0,
              isDefault: v.isDefault ?? false,
              isAvailable: v.isAvailable ?? true,
            })),
          });
        }
      }

      if (data.addOns !== undefined) {
        await tx.addOn.updateMany({
          where: { menuItemId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        if (data.addOns.length > 0) {
          await tx.addOn.createMany({
            data: data.addOns.map((a) => ({
              menuItemId: id,
              name: a.name,
              price: a.price,
              isAvailable: a.isAvailable ?? true,
            })),
          });
        }
      }

      return tx.menuItem.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          sku: data.sku,
          name: data.name,
          description: data.description,
          price: data.price,
          costPrice: data.costPrice,
          imageUrl: data.imageUrl,
          station: data.station,
          prepTimeMinutes: data.prepTimeMinutes,
          calories: data.calories,
          isVegetarian: data.isVegetarian,
          isVegan: data.isVegan,
          isGlutenFree: data.isGlutenFree,
          isAvailable: data.isAvailable,
          daypartSchedule:
            data.daypartSchedule !== undefined
              ? (data.daypartSchedule as Prisma.InputJsonValue)
              : undefined,
          updatedBy: data.actorUserId,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: { where: { deletedAt: null } },
          addOns: { where: { deletedAt: null } },
        },
      });
    });
  }

  async softDeleteMenuItem(id: string, actorUserId?: string) {
    return prisma.menuItem.update({
      where: { id },
      data: {
        isAvailable: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  async addVariant(menuItemId: string, data: VariantInput) {
    return prisma.itemVariant.create({
      data: {
        menuItemId,
        name: data.name,
        sku: data.sku,
        priceDelta: data.priceDelta ?? 0,
        isDefault: data.isDefault ?? false,
        isAvailable: data.isAvailable ?? true,
      },
    });
  }

  async deleteVariant(variantId: string) {
    return prisma.itemVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date(), isAvailable: false },
    });
  }

  async addAddOn(menuItemId: string, data: AddOnInput) {
    return prisma.addOn.create({
      data: {
        menuItemId,
        name: data.name,
        price: data.price,
        isAvailable: data.isAvailable ?? true,
      },
    });
  }

  async deleteAddOn(addOnId: string) {
    return prisma.addOn.update({
      where: { id: addOnId },
      data: { deletedAt: new Date(), isAvailable: false },
    });
  }

  // ==========================================
  // COMBOS
  // ==========================================

  async findManyCombos(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination(query);

    const where: Prisma.ComboWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.combo.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          items: {
            include: {
              menuItem: {
                select: { id: true, name: true, sku: true, price: true, imageUrl: true },
              },
            },
          },
        },
      }),
      prisma.combo.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findComboById(id: string) {
    return prisma.combo.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, sku: true, price: true, imageUrl: true },
            },
          },
        },
      },
    });
  }

  async createCombo(data: CreateComboInput) {
    return prisma.combo.create({
      data: {
        branchId: data.branchId,
        sku: data.sku,
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        isAvailable: data.isAvailable ?? true,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        createdBy: data.actorUserId,
        items: {
          create: data.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, name: true, sku: true, price: true } },
          },
        },
      },
    });
  }

  async updateCombo(id: string, data: UpdateComboInput) {
    return prisma.$transaction(async (tx) => {
      if (data.items !== undefined) {
        await tx.comboItem.deleteMany({ where: { comboId: id } });
        await tx.comboItem.createMany({
          data: data.items.map((item) => ({
            comboId: id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
        });
      }

      return tx.combo.update({
        where: { id },
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          isAvailable: data.isAvailable,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          updatedBy: data.actorUserId,
        },
        include: {
          items: {
            include: {
              menuItem: { select: { id: true, name: true, sku: true, price: true } },
            },
          },
        },
      });
    });
  }

  async softDeleteCombo(id: string, actorUserId?: string) {
    return prisma.combo.update({
      where: { id },
      data: {
        isAvailable: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  // ==========================================
  // BULK CSV EXPORT / IMPORT HELPERS
  // ==========================================

  async findAllItemsForCsvExport(branchId?: string) {
    return prisma.menuItem.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        category: { select: { name: true, slug: true } },
      },
      orderBy: { sku: 'asc' },
    });
  }

  async findDefaultBranchId(): Promise<string | null> {
    const b = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return b?.id ?? null;
  }

  async findOrCreateCategoryBySlug(branchId: string, name: string, slug: string) {
    return prisma.category.upsert({
      where: {
        branchId_slug: { branchId, slug },
      },
      update: { deletedAt: null },
      create: {
        branchId,
        name,
        slug,
        isActive: true,
      },
    });
  }

  async upsertMenuItemFromCsv(data: {
    branchId: string;
    categoryId: string;
    sku: string;
    name: string;
    description?: string;
    price: number;
    costPrice: number;
    station: string;
    prepTimeMinutes: number;
    isVegetarian: boolean;
    isAvailable: boolean;
    actorUserId?: string;
  }) {
    return prisma.menuItem.upsert({
      where: {
        branchId_sku: { branchId: data.branchId, sku: data.sku },
      },
      update: {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        costPrice: data.costPrice,
        station: data.station,
        prepTimeMinutes: data.prepTimeMinutes,
        isVegetarian: data.isVegetarian,
        isAvailable: data.isAvailable,
        deletedAt: null,
        updatedBy: data.actorUserId,
      },
      create: {
        branchId: data.branchId,
        categoryId: data.categoryId,
        sku: data.sku,
        name: data.name,
        description: data.description,
        price: data.price,
        costPrice: data.costPrice,
        station: data.station,
        prepTimeMinutes: data.prepTimeMinutes,
        isVegetarian: data.isVegetarian,
        isAvailable: data.isAvailable,
        createdBy: data.actorUserId,
      },
    });
  }
}

export const menuRepository = new MenuRepository();

