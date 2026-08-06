import type { Request, Response } from "express"
import { AdminService, ServiceContext } from "./admin.service"
import { RbacService } from "../rbac/rbac.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { NotificationService } from "../../shared/services/notification.service"
import {
  verifyCompanySchema,
  moderateJobSchema,
  updateUserStatusSchema,
  deleteUserSchema,
  inviteEmployeeSchema,
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  roleSchema,
  updateRoleSchema,
  auditLogsQuerySchema,
  reviewPerkRequestSchema,
  createAdminSchema,
  listAdminsQuerySchema,
  updateAdminSettingsSchema,
  updateSecuritySettingsSchema,
  updatePlatformSettingsSchema,
} from "./admin.validator"
import { CompanyStatus, UserStatus, PerkStatus } from "@prisma/client"

export class AdminController {
  private service = new AdminService()
  private rbacService = new RbacService()

  private getContext(req: Request): ServiceContext {
    const user = req.user
    const userAgent = req.headers["user-agent"] || ""
    const deviceType = userAgent.includes("Mobile") ? "Mobile" : "Desktop"

    return {
      operatorId: user?.userId,
      operatorEmail: user?.email,
      ipAddress: req.ip || "127.0.0.1",
      browser: userAgent || "Unknown",
      device: deviceType,
    }
  }

  getDashboard = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const result = await this.service.getDashboard(adminId)
      return sendSuccess(res, result, "Admin Dashboard data fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getSystemHealth = async (req: Request, res: Response, next: any) => {
    try {
      const result = await this.service.getSystemHealth()
      return sendSuccess(res, result, "System Health fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  // Read-only dry run only -- never deletes anything. See runOrphanAssetCleanup().
  getOrphanAssetReport = async (req: Request, res: Response, next: any) => {
    try {
      const result = await this.service.getOrphanAssetReport()
      return sendSuccess(res, result, "Orphan asset scan (read-only dry run) completed.")
    } catch (err: any) {
      next(err)
    }
  }

  listCompanies = async (req: Request, res: Response, next: any) => {
    try {
      const status = req.query.status as string | undefined
      const result = await this.service.listCompanies(status)
      return sendSuccess(res, { companies: result }, "Fetched companies successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  listJobs = async (req: Request, res: Response, next: any) => {
    try {
      const status = req.query.status as string | undefined
      const result = await this.service.listJobs(status)
      return sendSuccess(res, { jobs: result }, "Fetched jobs successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  verifyCompany = async (req: Request, res: Response, next: any) => {
    try {
      const validated = verifyCompanySchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.verifyCompany(
        adminId,
        req.params.id as string,
        validated.status as CompanyStatus,
        validated.notes,
        context
      )
      return sendSuccess(res, result, `Company status updated to ${validated.status} successfully.`)
    } catch (err: any) {
      next(err)
    }
  }

  suspendCompany = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.suspendCompany(adminId, req.params.id as string, context)
      return sendSuccess(res, result, "Company and its recruiters have been suspended.")
    } catch (err: any) {
      next(err)
    }
  }

  unsuspendCompany = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.unsuspendCompany(adminId, req.params.id as string, context)
      return sendSuccess(res, result, "Company and its recruiters have been reactivated.")
    } catch (err: any) {
      next(err)
    }
  }

  deleteCompany = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.deleteCompany(adminId, req.params.id as string, context)
      return sendSuccess(res, result, "Company and all its recruiters and job postings have been permanently deleted.")
    } catch (err: any) {
      next(err)
    }
  }

  // ==========================================
  // COMPANY PERK REQUESTS (Parts 6/7 -- separate module from company
  // verification above; see admin.routes.ts's "/perks" mount)
  // ==========================================

  listPerkRequests = async (req: Request, res: Response, next: any) => {
    try {
      const status = req.query.status as string | undefined
      const result = await this.service.listPerkRequests(status)
      return sendSuccess(res, { perkRequests: result }, "Fetched perk requests successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  reviewPerkRequest = async (req: Request, res: Response, next: any) => {
    try {
      const validated = reviewPerkRequestSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.reviewPerkRequest(
        adminId,
        req.params.id as string,
        validated.status as PerkStatus,
        validated.comment,
        context
      )
      return sendSuccess(res, result, `Perk request updated to ${validated.status} successfully.`)
    } catch (err: any) {
      next(err)
    }
  }

  moderateJob = async (req: Request, res: Response, next: any) => {
    try {
      const validated = moderateJobSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.moderateJob(
        adminId,
        req.params.id as string,
        validated.action,
        validated.notes,
        context
      )
      return sendSuccess(res, result, `Job moderation action '${validated.action}' executed successfully.`)
    } catch (err: any) {
      next(err)
    }
  }

  updateUserStatus = async (req: Request, res: Response, next: any) => {
    try {
      const validated = updateUserStatusSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.updateUserStatus(
        adminId,
        req.params.id as string,
        validated.status as UserStatus,
        context,
        req.user?.roles || []
      )
      return sendSuccess(res, result, `User account status updated to ${validated.status} successfully.`)
    } catch (err: any) {
      next(err)
    }
  }

  deleteUser = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      // Body is optional -- most deletes (candidates, recruiters with no
      // active jobs) don't need it. `.parse` on an empty object is fine
      // since every field on this schema is optional.
      const options = deleteUserSchema.parse(req.body || {})
      const result = await this.service.deleteUser(adminId, req.params.id as string, context, options, req.user?.roles || [])
      return sendSuccess(res, result, "User account permanently deleted successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  userAdministrativeAction = async (req: Request, res: Response, next: any) => {
    try {
      const action = req.params.action as string
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.userAdministrativeAction(
        adminId,
        req.params.id as string,
        action,
        context
      )
      return sendSuccess(res, result, `Administrative action '${action}' completed successfully.`)
    } catch (err: any) {
      next(err)
    }
  }

  listInvitations = async (req: Request, res: Response, next: any) => {
    try {
      const result = await this.service.listInvitations()
      return sendSuccess(res, { invitations: result }, "Fetched invitations list successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  inviteEmployee = async (req: Request, res: Response, next: any) => {
    try {
      const validated = inviteEmployeeSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.inviteEmployee(
        adminId,
        validated.email,
        validated.roleName,
        context
      )
      return sendSuccess(res, result, `Employee invitation sent to ${validated.email} successfully.`, 201)
    } catch (err: any) {
      next(err)
    }
  }

  resendInvitation = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.resendInvitation(adminId, req.params.id as string, context)
      return sendSuccess(res, result, "Invitation resent successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  cancelInvitation = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.cancelInvitation(adminId, req.params.id as string, context)
      return sendSuccess(res, result, "Invitation cancelled successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  expireInvitation = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.expireInvitation(adminId, req.params.id as string, context)
      return sendSuccess(res, result, "Invitation expired successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getFeatureFlags = async (req: Request, res: Response, next: any) => {
    try {
      const result = await this.service.getFeatureFlags()
      return sendSuccess(res, { flags: result }, "Feature flags fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  createFeatureFlag = async (req: Request, res: Response, next: any) => {
    try {
      const validated = createFeatureFlagSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.createFeatureFlag(adminId, validated, context)
      return sendSuccess(res, result, "Feature flag created successfully.", 201)
    } catch (err: any) {
      next(err)
    }
  }

  updateFeatureFlag = async (req: Request, res: Response, next: any) => {
    try {
      const validated = updateFeatureFlagSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.updateFeatureFlag(
        adminId,
        req.params.id as string,
        validated,
        context
      )
      return sendSuccess(res, result, "Feature flag updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  deleteFeatureFlag = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      await this.service.deleteFeatureFlag(adminId, req.params.id as string, context)
      return sendSuccess(res, null, "Feature flag deleted successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getReports = async (req: Request, res: Response, next: any) => {
    try {
      const type = req.query.type as string || "platform"
      const result = await this.service.getReports(type)
      
      // Support export buffers
      if (req.query.export === "csv") {
        res.setHeader("Content-Type", result.exportFile.mimetype)
        res.setHeader("Content-Disposition", `attachment; filename=${result.exportFile.filename}`)
        return res.send(Buffer.from(result.exportFile.content, "base64"))
      }

      return sendSuccess(res, result.reportData, "Report metrics fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getAuditLogs = async (req: Request, res: Response, next: any) => {
    try {
      // this used to hand req.query straight to
      // the service untouched -- page/limit arrived as raw strings (fine,
      // since parseInt() was applied downstream), but there was no
      // validation at all on the free-form fields, and no schema documenting
      // what the endpoint actually accepts. auditLogsQuerySchema now coerces
      // and bounds every param (e.g. limit capped at 200) before it reaches
      // the database layer.
      const validated = auditLogsQuerySchema.parse(req.query)
      const result = await this.service.getAuditLogs(validated)
      return sendSuccess(res, result, "Audit logs fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getRBACData = async (req: Request, res: Response, next: any) => {
    try {
      const result = await this.service.getRBACData()
      return sendSuccess(res, result, "RBAC schema matrix data fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  createRole = async (req: Request, res: Response, next: any) => {
    try {
      const validated = roleSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.createRole(adminId, validated, context)
      return sendSuccess(res, result, "Role profile created successfully.", 201)
    } catch (err: any) {
      next(err)
    }
  }

  updateRole = async (req: Request, res: Response, next: any) => {
    try {
      const validated = updateRoleSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.updateRole(
        adminId,
        req.params.id as string,
        validated,
        context
      )
      return sendSuccess(res, result, "Role permission matrix updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  deleteRole = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      await this.service.deleteRole(adminId, req.params.id as string, context)
      return sendSuccess(res, null, "Role deleted successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  // this used to call AdminService.assignUserRoles,
  // a bare deleteMany+createMany with no privilege-escalation or
  // last-Super-Admin safety checks at all -- even though this specific route
  // is already gated behind requireSuperAdmin, a Super Admin could still
  // accidentally strip their own (or the platform's last) Super Admin role
  // with zero recovery path. RbacService.assignRolesToUser (rbac.service.ts)
  // is the hardened, reusable implementation the Admin Management spec asks
  // for -- delegating to it here instead of keeping two parallel
  // role-assignment code paths.
  assignUserRoles = async (req: Request, res: Response, next: any) => {
    try {
      const { roleIds } = req.body
      if (!roleIds || !Array.isArray(roleIds)) {
        return sendError(res, "roleIds array is required", null, 400)
      }
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      await this.rbacService.assignRolesToUser(req.params.id as string, roleIds, context, req.user?.roles || [])
      return sendSuccess(res, null, "User roles reassigned successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  globalSearch = async (req: Request, res: Response, next: any) => {
    try {
      const query = req.query.q as string || ""
      const result = await this.service.globalSearch(query)
      return sendSuccess(res, result, "Unified search query executed successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  listUsers = async (req: Request, res: Response, next: any) => {
    try {
      const role = req.query.role as string | undefined
      const result = await this.service.listUsers(role)
      return sendSuccess(res, { users: result }, "Fetched users successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  // ==========================================
  // SUPER ADMIN: ADMIN MANAGEMENT MODULE
  // (routes gated by requireSuperAdmin -- see admin.routes.ts)
  // ==========================================
  createAdmin = async (req: Request, res: Response, next: any) => {
    try {
      const validated = createAdminSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.createAdmin(adminId, validated, context, req.user?.roles || [])
      return sendSuccess(res, result, "Admin account created successfully.", 201)
    } catch (err: any) {
      next(err)
    }
  }

  listAdmins = async (req: Request, res: Response, next: any) => {
    try {
      const filters = listAdminsQuerySchema.parse(req.query)
      const result = await this.service.listAdmins(filters)
      return sendSuccess(res, { admins: result }, "Fetched admin accounts successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  removeAdminRole = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.removeAdminRole(
        adminId,
        req.params.id as string,
        req.params.roleName as string,
        req.user?.roles || [],
        context
      )
      return sendSuccess(res, result, "Role removed successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  verifyRecruiter = async (req: Request, res: Response, next: any) => {
    try {
      const { verified } = req.body
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.verifyRecruiter(
        adminId,
        req.params.id as string,
        !!verified,
        context
      )
      return sendSuccess(res, result, "Recruiter verification status updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getAdminSettings = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const settings = await this.service.getAdminSettings(adminId)
      return sendSuccess(res, { settings }, "Fetched admin settings successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  updateAdminSettings = async (req: Request, res: Response, next: any) => {
    try {
      // Previously read req.body.preferences with zero validation and wrote
      // it straight into the generic User.preferences JSON blob -- so
      // "saving" a new name/email here never touched the real
      // AdminProfile.fullName/User.email columns anything else in the app
      // reads (Navbar greeting, audit log operatorEmail, etc). It silently
      // round-tripped into a blob nothing else looks at. Now validated and
      // routed to the real field; see AdminService.updateAdminSettings.
      const validated = updateAdminSettingsSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const settings = await this.service.updateAdminSettings(adminId, validated, context)
      return sendSuccess(res, { settings }, "Admin settings updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getSecuritySettings = async (req: Request, res: Response, next: any) => {
    try {
      const settings = await this.service.getSecuritySettings()
      return sendSuccess(res, { settings }, "Fetched security settings successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  updateSecuritySettings = async (req: Request, res: Response, next: any) => {
    try {
      const validated = updateSecuritySettingsSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const settings = await this.service.updateSecuritySettings(adminId, validated, context)
      return sendSuccess(res, { settings }, "Security settings updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getPlatformSettings = async (req: Request, res: Response, next: any) => {
    try {
      const settings = await this.service.getPlatformSettings()
      return sendSuccess(res, { settings }, "Fetched platform settings successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  updatePlatformSettings = async (req: Request, res: Response, next: any) => {
    try {
      const validated = updatePlatformSettingsSchema.parse(req.body)
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      const settings = await this.service.updatePlatformSettings(adminId, validated, context)
      return sendSuccess(res, { settings }, "Platform settings updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getAdminNotifications = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const notifications = await this.service.getAdminNotifications(adminId)
      return sendSuccess(res, { notifications }, "Fetched admin notifications successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  markAdminNotificationRead = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      await NotificationService.markNotificationRead(req.params.id as string, adminId)
      return sendSuccess(res, null, "Notification marked read successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  markAllAdminNotificationsRead = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      await NotificationService.markAllNotificationsRead(adminId)
      return sendSuccess(res, null, "All notifications marked read successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  deleteAdminNotification = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      await NotificationService.deleteNotification(req.params.id as string, adminId)
      return sendSuccess(res, null, "Notification deleted successfully.")
    } catch (err: any) {
      next(err)
    }
  }
}

export default AdminController
