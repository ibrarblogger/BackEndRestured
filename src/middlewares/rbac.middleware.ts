import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { ROLES } from '../constants/roles';
import { PermissionKey } from '../constants/permissions';

/**
 * RBAC Middleware: verifies that the authenticated user holds AT LEAST ONE (or ALL)
 * of the required permission keys. Super Admin bypasses permission checks automatically.
 */
export function requirePermission(...requiredPermissions: (PermissionKey | string)[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (user.roleSlug === ROLES.SUPER_ADMIN || user.roleSlug === 'super_admin') {
      next();
      return;
    }

    const userPermissions = new Set(user.permissions || []);
    const hasPermission = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasPermission) {
      next(
        new ForbiddenError(
          `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`
        )
      );
      return;
    }

    next();
  };
}

/**
 * Verifies that the authenticated user holds ANY of the provided permissions.
 */
export function requireAnyPermission(...permissions: (PermissionKey | string)[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (user.roleSlug === ROLES.SUPER_ADMIN || user.roleSlug === 'super_admin') {
      next();
      return;
    }

    const userPermissions = new Set(user.permissions || []);
    const hasAny = permissions.some((perm) => userPermissions.has(perm));

    if (!hasAny) {
      next(
        new ForbiddenError(
          `Insufficient permissions. Requires any of: [${permissions.join(', ')}]`
        )
      );
      return;
    }

    next();
  };
}

/**
 * Resolves the effective branchId for multi-branch scoping.
 * Non-Super-Admin users are restricted to their assigned branchId.
 */
export function resolveBranchScope(req: Request, explicitBranchId?: string): string | undefined {
  const user = req.user;
  if (!user) return explicitBranchId;
  if (user.roleSlug === ROLES.SUPER_ADMIN || user.roleSlug === 'super_admin') {
    return (
      explicitBranchId ||
      (req.query.branchId as string | undefined) ||
      (req.body?.branchId as string | undefined) ||
      user.branchId ||
      undefined
    );
  }
  return user.branchId || explicitBranchId;
}

/**
 * Strictly restricts an endpoint to Super Admin only (e.g. changing system/branch currency).
 */
export function requireAdminOnly() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userPermissions = new Set(user.permissions || []);
    const isAdmin =
      user.roleSlug === ROLES.SUPER_ADMIN ||
      user.roleSlug === 'super_admin' ||
      userPermissions.has('branches.manage');

    if (!isAdmin) {
      next(new ForbiddenError('Only Admin is authorized to perform this action'));
      return;
    }

    next();
  };
}

