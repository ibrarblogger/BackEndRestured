import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';

const userSelect = {
  id: true,
  branchId: true,
  roleId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

export class UsersRepository {
  async findManyUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    roleId?: string;
    isActive?: boolean;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination(query);

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.roleId) where.roleId = query.roleId;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        select: userSelect,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findUserById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...userSelect,
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            permissions: {
              select: {
                permission: {
                  select: { id: true, key: true, module: true, description: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true },
    });
  }

  async createUser(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({
      data,
      select: userSelect,
    });
  }

  async updateUser(id: string, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  async softDeleteUser(id: string, actorUserId?: string) {
    return prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
      select: { id: true },
    });
  }

  // Roles & Permissions
  async findAllRoles() {
    return prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findRoleById(id: string) {
    return prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
  }

  async findRoleBySlugOrName(slug: string, name: string) {
    return prisma.role.findFirst({
      where: {
        OR: [{ slug }, { name }],
        deletedAt: null,
      },
    });
  }

  async findAllPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });
  }

  async findPermissionsByKeys(keys: string[]) {
    return prisma.permission.findMany({
      where: { key: { in: keys } },
    });
  }

  async createRoleWithPermissions(
    data: { name: string; slug: string; description?: string; createdBy?: string },
    permissionIds: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          createdBy: data.createdBy,
        },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: { include: { permission: true } },
        },
      });
    });
  }

  async updateRoleAndPermissions(
    roleId: string,
    data: { name?: string; description?: string; updatedBy?: string },
    permissionIds?: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data,
      });

      if (permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: { include: { permission: true } },
        },
      });
    });
  }

  async softDeleteRole(id: string, actorUserId?: string) {
    return prisma.role.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorUserId },
    });
  }
}

export const usersRepository = new UsersRepository();
