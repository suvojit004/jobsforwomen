import prisma from "../../shared/database/db"
import { PermissionCacheManager } from "../../shared/utils/permissionCache"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"

export interface RequestContext {
  operatorId?: string
  operatorEmail?: string
  ipAddress?: string
  browser?: string
  device?: string
}

export class RbacService {
  // ==========================================
  // ROLES CRUD
  // ==========================================
  async createRole(name: string, context?: RequestContext) {
    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing) {
      throw new Error(`Role name '${name}' already exists`)
    }

    const role = await prisma.role.create({ data: { name } })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "CREATE_ROLE",
      entity: "Role",
      entityId: role.id,
      newValue: { name },
    })

    return role
  }

  async getRoles() {
    return prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })
  }

  async getRoleById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })
    if (!role) {
      throw new Error("Role not found")
    }
    return role
  }

  async updateRole(id: string, name: string, context?: RequestContext) {
    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) {
      throw new Error("Role not found")
    }

    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing && existing.id !== id) {
      throw new Error(`Role name '${name}' already exists`)
    }

    const updated = await prisma.role.update({
      where: { id },
      data: { name },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "UPDATE_ROLE",
      entity: "Role",
      entityId: id,
      oldValue: { name: role.name },
      newValue: { name },
    })

    // Invalidate cached permissions for any user holding this role
    await PermissionCacheManager.invalidateAll()

    return updated
  }

  async deleteRole(id: string, context?: RequestContext) {
    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) {
      throw new Error("Role not found")
    }

    await prisma.role.delete({ where: { id } })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "DELETE_ROLE",
      entity: "Role",
      entityId: id,
      oldValue: { name: role.name },
    })

    await PermissionCacheManager.invalidateAll()
    return { success: true }
  }

  // ==========================================
  // PERMISSIONS CRUD
  // ==========================================
  async createPermission(name: string, context?: RequestContext) {
    const existing = await prisma.permission.findUnique({ where: { name } })
    if (existing) {
      throw new Error(`Permission name '${name}' already exists`)
    }

    const permission = await prisma.permission.create({ data: { name } })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "CREATE_PERMISSION",
      entity: "Permission",
      entityId: permission.id,
      newValue: { name },
    })

    return permission
  }

  async getPermissions() {
    return prisma.permission.findMany({ orderBy: { name: "asc" } })
  }

  async getPermissionById(id: string) {
    const perm = await prisma.permission.findUnique({ where: { id } })
    if (!perm) {
      throw new Error("Permission not found")
    }
    return perm
  }

  async updatePermission(id: string, name: string, context?: RequestContext) {
    const perm = await prisma.permission.findUnique({ where: { id } })
    if (!perm) {
      throw new Error("Permission not found")
    }

    const existing = await prisma.permission.findUnique({ where: { name } })
    if (existing && existing.id !== id) {
      throw new Error(`Permission name '${name}' already exists`)
    }

    const updated = await prisma.permission.update({
      where: { id },
      data: { name },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "UPDATE_PERMISSION",
      entity: "Permission",
      entityId: id,
      oldValue: { name: perm.name },
      newValue: { name },
    })

    await PermissionCacheManager.invalidateAll()
    return updated
  }

  async deletePermission(id: string, context?: RequestContext) {
    const perm = await prisma.permission.findUnique({ where: { id } })
    if (!perm) {
      throw new Error("Permission not found")
    }

    await prisma.permission.delete({ where: { id } })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "DELETE_PERMISSION",
      entity: "Permission",
      entityId: id,
      oldValue: { name: perm.name },
    })

    await PermissionCacheManager.invalidateAll()
    return { success: true }
  }

  // ==========================================
  // ROLE PERMISSIONS ASSIGNMENT
  // ==========================================
  async assignPermissionsToRole(roleId: string, permissionIds: string[], context?: RequestContext) {
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      throw new Error("Role not found")
    }

    // Get current mapping to log diff
    const current = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    })
    const currentIds = current.map((p) => p.permissionId)

    // Clear old permissions and assign new ones in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } })
      await tx.rolePermission.createMany({
        data: permissionIds.map((pId) => ({ roleId, permissionId: pId })),
      })
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "ASSIGN_ROLE_PERMISSIONS",
      entity: "Role",
      entityId: roleId,
      oldValue: { permissionIds: currentIds },
      newValue: { permissionIds },
    })

    // Also trigger RoleAssigned event for potential notifications
    EventBus.publish("RoleAssigned", { roleId, permissionIds })

    // Invalidate all permission caches due to matrix update
    await PermissionCacheManager.invalidateAll()

    return { success: true }
  }

  // ==========================================
  // USER ROLES ASSIGNMENT
  // ==========================================
  // Only a Super Admin may grant/revoke the Super Admin role, and the last
  // remaining Super Admin can't be stripped of it -- both guarded below via
  // `operatorRoles` (the caller's own JWT roles).
  async assignRolesToUser(
    userId: string,
    roleIds: string[],
    context?: RequestContext,
    operatorRoles: string[] = []
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error("User not found")
    }

    const current = await prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true, role: { select: { name: true } } },
    })
    const currentRoleIds = current.map((ur) => ur.roleId)
    const currentRoleNames = current.map((ur) => ur.role.name)

    const targetRoles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    })
    if (targetRoles.length !== new Set(roleIds).size) {
      throw new Error("One or more of the given role IDs do not exist.")
    }
    const nextRoleNames = targetRoles.map((r) => r.name)

    const hadSuperAdmin = currentRoleNames.includes("Super Admin")
    const willHaveSuperAdmin = nextRoleNames.includes("Super Admin")
    const isOperatorSuperAdmin = operatorRoles.includes("Super Admin")

    // Privilege escalation guard: only a Super Admin may grant or revoke the
    // Super Admin role on anyone (including themselves).
    if (hadSuperAdmin !== willHaveSuperAdmin && !isOperatorSuperAdmin) {
      throw new Error("Only a Super Admin can grant or remove the Super Admin role.")
    }

    // Last-Super-Admin guard: block a change that would leave zero Super
    // Admins platform-wide.
    if (hadSuperAdmin && !willHaveSuperAdmin) {
      const otherSuperAdmins = await prisma.userRole.count({
        where: {
          userId: { not: userId },
          role: { name: "Super Admin" },
        },
      })
      if (otherSuperAdmins === 0) {
        throw new Error("Cannot remove the Super Admin role from the last remaining Super Admin.")
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } })
      await tx.userRole.createMany({
        data: roleIds.map((rId) => ({ userId, roleId: rId })),
      })
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RBAC",
      action: "ASSIGN_USER_ROLES",
      entity: "User",
      entityId: userId,
      oldValue: { roleIds: currentRoleIds, roleNames: currentRoleNames },
      newValue: { roleIds, roleNames: nextRoleNames },
    })

    // Publish event for role assignment -- notification.listener.ts /
    // email.listener.ts subscribe to this to let the affected admin know
    // their access changed (Admin Management spec's notification requirement).
    EventBus.publish("RoleAssigned", {
      userId,
      userEmail: user.email,
      roleIds,
      roleNames: nextRoleNames,
      previousRoleNames: currentRoleNames,
      context,
    })

    // Invalidate cache for the specific user
    await PermissionCacheManager.invalidateUser(userId)

    return { success: true }
  }

  // ==========================================
  // USER EFFECTIVE PERMISSIONS AND ROLES
  // ==========================================
  async getUserEffectivePermissionsAndRoles(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!user) {
      throw new Error("User not found")
    }

    const roles = user.roles.map((ur) => ur.role.name)
    const permissions = await PermissionCacheManager.getUserPermissions(userId)

    return {
      userId,
      email: user.email,
      roles,
      permissions,
    }
  }
}

export default RbacService
