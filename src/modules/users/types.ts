export interface CreateUserInput {
  branchId?: string | null;
  roleId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  pinCode?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export interface UpdateUserInput {
  branchId?: string | null;
  roleId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  pinCode?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export interface CreateRoleInput {
  name: string;
  slug: string;
  description?: string;
  permissionKeys?: string[];
  actorUserId?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionKeys?: string[];
  actorUserId?: string;
}

