import { ConflictError, ForbiddenError, NotFoundError } from '../../errors';
import { hashPassword } from '../../utils/password';
import { auditService } from '../audit/service';
import { usersRepository } from './repository';
import {
  CreateRoleInput,
  CreateUserInput,
  UpdateRoleInput,
  UpdateUserInput,
} from './types';

export class UsersService {
  async listUsers(query: any) {
    return usersRepository.findManyUsers(query);
  }

  async getUserById(id: string) {
    const user = await usersRepository.findUserById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async createUser(input: CreateUserInput, requestMeta?: { ip?: string; requestId?: string }) {
    const existing = await usersRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError(`A user with email ${input.email} already exists`);
    }

    const role = await usersRepository.findRoleById(input.roleId);
    if (!role) {
      throw new NotFoundError('Role');
    }

    const passwordHash = await hashPassword(input.password);
    const created = await usersRepository.createUser({
      branchId: input.branchId ?? null,
      roleId: input.roleId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      pinCode: input.pinCode,
      isActive: input.isActive ?? true,
      createdBy: input.actorUserId,
    });

    await auditService.log({
      branchId: created.branchId,
      userId: input.actorUserId,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: created.id,
      newValues: { email: created.email, roleId: created.roleId, branchId: created.branchId },
      ipAddress: requestMeta?.ip,
      requestId: requestMeta?.requestId,
    });

    return created;
  }

  async updateUser(
    id: string,
    input: UpdateUserInput,
    requestMeta?: { ip?: string; requestId?: string }
  ) {
    const existing = await usersRepository.findUserById(id);
    if (!existing) {
      throw new NotFoundError('User');
    }

    if (input.roleId) {
      const role = await usersRepository.findRoleById(input.roleId);
      if (!role) throw new NotFoundError('Role');
    }

    const updated = await usersRepository.updateUser(id, {
      branchId: input.branchId,
      roleId: input.roleId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      pinCode: input.pinCode,
      isActive: input.isActive,
      updatedBy: input.actorUserId,
    });

    if (input.roleId && input.roleId !== existing.roleId) {
      await auditService.log({
        branchId: updated.branchId,
        userId: input.actorUserId,
        action: 'USER_ROLE_CHANGED',
        entity: 'User',
        entityId: id,
        oldValues: { roleId: existing.roleId },
        newValues: { roleId: input.roleId },
        ipAddress: requestMeta?.ip,
        requestId: requestMeta?.requestId,
      });
    }

    return updated;
  }

  async setUserStatus(
    id: string,
    isActive: boolean,
    actorUserId?: string,
    requestMeta?: { ip?: string; requestId?: string }
  ) {
    const existing = await usersRepository.findUserById(id);
    if (!existing) {
      throw new NotFoundError('User');
    }

    const updated = await usersRepository.updateUser(id, {
      isActive,
      updatedBy: actorUserId,
    });

    await auditService.log({
      branchId: updated.branchId,
      userId: actorUserId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity: 'User',
      entityId: id,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive },
      ipAddress: requestMeta?.ip,
      requestId: requestMeta?.requestId,
    });

    return updated;
  }

  async deleteUser(id: string, actorUserId?: string) {
    const existing = await usersRepository.findUserById(id);
    if (!existing) {
      throw new NotFoundError('User');
    }
    if (id === actorUserId) {
      throw new ForbiddenError('You cannot delete your own account');
    }
    await usersRepository.softDeleteUser(id, actorUserId);
    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'USER_DELETED',
      entity: 'User',
      entityId: id,
    });
  }

  // Roles & Permissions
  async listRoles() {
    const roles = await usersRepository.findAllRoles();
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      usersCount: r._count.users,
      permissions: r.permissions.map((rp) => rp.permission),
      createdAt: r.createdAt,
    }));
  }

  async listPermissions() {
    return usersRepository.findAllPermissions();
  }

  async createRole(input: CreateRoleInput) {
    const existing = await usersRepository.findRoleBySlugOrName(input.slug, input.name);
    if (existing) {
      throw new ConflictError('A role with that name or slug already exists');
    }

    const perms = input.permissionKeys?.length
      ? await usersRepository.findPermissionsByKeys(input.permissionKeys)
      : [];

    const role = await usersRepository.createRoleWithPermissions(
      {
        name: input.name,
        slug: input.slug,
        description: input.description,
        createdBy: input.actorUserId,
      },
      perms.map((p) => p.id)
    );

    await auditService.log({
      userId: input.actorUserId,
      action: 'ROLE_CREATED',
      entity: 'Role',
      entityId: role?.id,
      newValues: { name: input.name, slug: input.slug, permissions: input.permissionKeys },
    });

    return role;
  }

  async updateRole(roleId: string, input: UpdateRoleInput) {
    const existing = await usersRepository.findRoleById(roleId);
    if (!existing) {
      throw new NotFoundError('Role');
    }

    let permissionIds: string[] | undefined;
    if (input.permissionKeys !== undefined) {
      const perms = await usersRepository.findPermissionsByKeys(input.permissionKeys);
      permissionIds = perms.map((p) => p.id);
    }

    const updated = await usersRepository.updateRoleAndPermissions(
      roleId,
      {
        name: input.name,
        description: input.description,
        updatedBy: input.actorUserId,
      },
      permissionIds
    );

    await auditService.log({
      userId: input.actorUserId,
      action: 'ROLE_UPDATED',
      entity: 'Role',
      entityId: roleId,
      oldValues: {
        name: existing.name,
        permissions: existing.permissions.map((rp) => rp.permission.key),
      },
      newValues: { name: input.name, permissions: input.permissionKeys },
    });

    return updated;
  }

  async assignRolePermissions(roleId: string, permissionKeys: string[], actorUserId?: string) {
    return this.updateRole(roleId, { permissionKeys, actorUserId });
  }

  async deleteRole(roleId: string, actorUserId?: string) {
    const existing = await usersRepository.findRoleById(roleId);
    if (!existing) {
      throw new NotFoundError('Role');
    }
    if (existing.isSystem) {
      throw new ForbiddenError('System roles cannot be deleted');
    }
    await usersRepository.softDeleteRole(roleId, actorUserId);
    await auditService.log({
      userId: actorUserId,
      action: 'ROLE_DELETED',
      entity: 'Role',
      entityId: roleId,
    });
  }
}

export const usersService = new UsersService();

