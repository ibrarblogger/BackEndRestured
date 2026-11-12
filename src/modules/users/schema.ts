import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';
import { passwordPolicySchema } from '../auth/schema';

export const userListQuerySchema = paginationQuerySchema.extend({
  roleId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Valid UUID is required'),
});

export const createUserSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  roleId: z.string().uuid('Valid roleId is required'),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: passwordPolicySchema,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(5).max(30).optional(),
  pinCode: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits').optional(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  roleId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().min(5).max(30).optional(),
  pinCode: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits').optional(),
  isActive: z.boolean().optional(),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(255).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(255).optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export const assignPermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1)).min(0),
});

