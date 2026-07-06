import { z } from "zod"

export const createRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").max(50),
})

export const updateRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").max(50),
})

export const createPermissionSchema = z.object({
  name: z.string().min(2, "Permission name must be at least 2 characters").max(50),
})

export const updatePermissionSchema = z.object({
  name: z.string().min(2, "Permission name must be at least 2 characters").max(50),
})

export const assignRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid("Invalid permission ID format")),
})

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid("Invalid role ID format")),
})
