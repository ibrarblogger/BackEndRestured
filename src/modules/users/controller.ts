import { Request, Response } from 'express';
import { resolveBranchScope } from '../../middlewares/rbac.middleware';
import { sendSuccess } from '../../utils/response';
import { usersService } from './service';

export class UsersController {
  async listUsers(req: Request, res: Response) {
    const branchId = resolveBranchScope(req);
    const { items, meta } = await usersService.listUsers({
      ...req.query,
      branchId,
    });
    return sendSuccess(res, items, 'Users retrieved successfully', 200, meta);
  }

  async getUserById(req: Request, res: Response) {
    const user = await usersService.getUserById(String(req.params.id));
    return sendSuccess(res, user, 'User retrieved successfully');
  }

  async createUser(req: Request, res: Response) {
    const branchId = resolveBranchScope(req, req.body.branchId);
    const user = await usersService.createUser(
      {
        ...req.body,
        branchId,
        actorUserId: req.user?.sub,
      },
      { ip: req.ip, requestId: req.requestId }
    );
    return sendSuccess(res, user, 'User created successfully', 201);
  }

  async updateUser(req: Request, res: Response) {
    const user = await usersService.updateUser(
      String(req.params.id),
      {
        ...req.body,
        actorUserId: req.user?.sub,
      },
      { ip: req.ip, requestId: req.requestId }
    );
    return sendSuccess(res, user, 'User updated successfully');
  }

  async setUserStatus(req: Request, res: Response) {
    const user = await usersService.setUserStatus(
      String(req.params.id),
      req.body.isActive,
      req.user?.sub,
      { ip: req.ip, requestId: req.requestId }
    );
    return sendSuccess(
      res,
      user,
      `User ${req.body.isActive ? 'activated' : 'deactivated'} successfully`
    );
  }

  async deleteUser(req: Request, res: Response) {
    await usersService.deleteUser(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'User deleted successfully');
  }

  // Roles & Permissions
  async listRoles(_req: Request, res: Response) {
    const roles = await usersService.listRoles();
    return sendSuccess(res, roles, 'Roles retrieved successfully');
  }

  async listPermissions(_req: Request, res: Response) {
    const permissions = await usersService.listPermissions();
    return sendSuccess(res, permissions, 'Permissions retrieved successfully');
  }

  async createRole(req: Request, res: Response) {
    const role = await usersService.createRole({
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, role, 'Role created successfully', 201);
  }

  async updateRole(req: Request, res: Response) {
    const role = await usersService.updateRole(String(req.params.id), {
      ...req.body,
      actorUserId: req.user?.sub,
    });
    return sendSuccess(res, role, 'Role updated successfully');
  }

  async assignPermissions(req: Request, res: Response) {
    const role = await usersService.assignRolePermissions(
      String(req.params.id),
      req.body.permissionKeys,
      req.user?.sub
    );
    return sendSuccess(res, role, 'Role permissions updated successfully');
  }

  async deleteRole(req: Request, res: Response) {
    await usersService.deleteRole(String(req.params.id), req.user?.sub);
    return sendSuccess(res, null, 'Role deleted successfully');
  }
}

export const usersController = new UsersController();
