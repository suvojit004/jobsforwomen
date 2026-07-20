import type { Request, Response } from "express"
import { RbacService, RequestContext } from "./rbac.service"
import { sendSuccess } from "../../shared/utils/response"
import {
  createRoleSchema,
  updateRoleSchema,
  createPermissionSchema,
  updatePermissionSchema,
  assignRolePermissionsSchema,
  assignUserRolesSchema,
} from "./rbac.validator"

export class RbacController {
  private rbacService = new RbacService()

  private getContext(req: Request): RequestContext {
    const user = req.user
    const userAgent = req.headers["user-agent"] || ""
    const deviceType = userAgent.includes("Mobile")
      ? "Mobile"
      : userAgent.includes("Tablet")
      ? "Tablet"
      : "Desktop"

    return {
      operatorId: user?.userId,
      operatorEmail: user?.email,
      ipAddress: req.ip || "127.0.0.1",
      browser: userAgent || "Unknown",
      device: deviceType,
    }
  }

  // ==========================================
  // ROLES HANDLERS
  // ==========================================
  createRole = async (req: Request, res: Response) => {
    const validated = createRoleSchema.parse(req.body)
    const context = this.getContext(req)
    const role = await this.rbacService.createRole(validated.name, context)
    return sendSuccess(res, { role }, "Role created successfully.", 201)
  }

  getRoles = async (req: Request, res: Response) => {
    const roles = await this.rbacService.getRoles()
    return sendSuccess(res, { roles }, "Fetched roles successfully.")
  }

  getRoleById = async (req: Request, res: Response) => {
    const role = await this.rbacService.getRoleById(req.params.id as string)
    return sendSuccess(res, { role }, "Fetched role details successfully.")
  }

  updateRole = async (req: Request, res: Response) => {
    const validated = updateRoleSchema.parse(req.body)
    const context = this.getContext(req)
    const role = await this.rbacService.updateRole(req.params.id as string, validated.name, context)
    return sendSuccess(res, { role }, "Role updated successfully.")
  }

  deleteRole = async (req: Request, res: Response) => {
    const context = this.getContext(req)
    await this.rbacService.deleteRole(req.params.id as string, context)
    return sendSuccess(res, null, "Role deleted successfully.")
  }

  // ==========================================
  // PERMISSIONS HANDLERS
  // ==========================================
  createPermission = async (req: Request, res: Response) => {
    const validated = createPermissionSchema.parse(req.body)
    const context = this.getContext(req)
    const permission = await this.rbacService.createPermission(validated.name, context)
    return sendSuccess(res, { permission }, "Permission created successfully.", 201)
  }

  getPermissions = async (req: Request, res: Response) => {
    const permissions = await this.rbacService.getPermissions()
    return sendSuccess(res, { permissions }, "Fetched permissions successfully.")
  }

  getPermissionById = async (req: Request, res: Response) => {
    const permission = await this.rbacService.getPermissionById(req.params.id as string)
    return sendSuccess(res, { permission }, "Fetched permission details successfully.")
  }

  updatePermission = async (req: Request, res: Response) => {
    const validated = updatePermissionSchema.parse(req.body)
    const context = this.getContext(req)
    const permission = await this.rbacService.updatePermission(req.params.id as string, validated.name, context)
    return sendSuccess(res, { permission }, "Permission updated successfully.")
  }

  deletePermission = async (req: Request, res: Response) => {
    const context = this.getContext(req)
    await this.rbacService.deletePermission(req.params.id as string, context)
    return sendSuccess(res, null, "Permission deleted successfully.")
  }

  // ==========================================
  // MAPPINGS HANDLERS
  // ==========================================
  assignPermissionsToRole = async (req: Request, res: Response) => {
    const validated = assignRolePermissionsSchema.parse(req.body)
    const context = this.getContext(req)
    await this.rbacService.assignPermissionsToRole(req.params.id as string, validated.permissionIds, context)
    return sendSuccess(res, null, "Role permissions updated successfully.")
  }

  assignRolesToUser = async (req: Request, res: Response) => {
    const validated = assignUserRolesSchema.parse(req.body)
    const context = this.getContext(req)
    await this.rbacService.assignRolesToUser(
      req.params.id as string,
      validated.roleIds,
      context,
      req.user?.roles || []
    )
    return sendSuccess(res, null, "User roles updated successfully.")
  }

  // ==========================================
  // EFFECTIVE ROLES & PERMISSIONS
  // ==========================================
  getUserEffectivePermissions = async (req: Request, res: Response) => {
    const data = await this.rbacService.getUserEffectivePermissionsAndRoles(req.params.id as string)
    return sendSuccess(res, data, "Fetched user's effective permissions successfully.")
  }
}

export default RbacController
