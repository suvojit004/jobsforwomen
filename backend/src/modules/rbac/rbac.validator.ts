import { z } from "zod"

export const createRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").max(50),
  // Optional -- lets a caller create a role and set its initial permission
  // set (by name, not ID -- callers like the Roles & Permissions Matrix UI
  // work with permission names, not their internal IDs) in one request
  // instead of a separate follow-up call. Not required: a brand-new role
  // with zero permissions is a perfectly normal starting point.
  permissionNames: z.array(z.string()).optional(),
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

// Accepts either permission IDs or permission names, but not neither --
// permissionNames exists for callers (the Roles & Permissions Matrix UI)
// that only know permissions by name and shouldn't have to resolve IDs
// client-side first.
export const assignRolePermissionsSchema = z
  .object({
    permissionIds: z.array(z.string().uuid("Invalid permission ID format")).optional(),
    permissionNames: z.array(z.string()).optional(),
  })
  .refine((data) => data.permissionIds || data.permissionNames, {
    message: "Either permissionIds or permissionNames is required",
  })

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid("Invalid role ID format")),
})
