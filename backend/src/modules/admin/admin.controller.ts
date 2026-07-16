import type { Request, Response } from "express"
import { AdminService, ServiceContext } from "./admin.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { NotificationService } from "../../shared/services/notification.service"
import {
  verifyCompanySchema,
  moderateJobSchema,
  updateUserStatusSchema,
  inviteEmployeeSchema,
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  roleSchema,
  updateRoleSchema,
  supportTicketSchema,
  auditLogsQuerySchema,
} from "./admin.validator"
import { CompanyStatus, UserStatus } from "@prisma/client"

export class AdminController {
  private service = new AdminService()

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
        context
      )
      return sendSuccess(res, result, `User account status updated to ${validated.status} successfully.`)
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

  submitSupportTicket = async (req: Request, res: Response, next: any) => {
    try {
      const adminId = req.user?.userId || ""
      const validated = supportTicketSchema.parse(req.body)
      const context = this.getContext(req)
      await this.service.submitSupportTicket(adminId, validated.subject, validated.category, validated.message, context)
      return sendSuccess(res, null, "Your issue ticket has been filed successfully. Support will update you soon.")
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
      // CONFIRMED BUG (fixed here): this used to hand req.query straight to
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

  assignUserRoles = async (req: Request, res: Response, next: any) => {
    try {
      const { roleIds } = req.body
      if (!roleIds || !Array.isArray(roleIds)) {
        return sendError(res, "roleIds array is required", null, 400)
      }
      const adminId = req.user?.userId || ""
      const context = this.getContext(req)
      await this.service.assignUserRoles(adminId, req.params.id as string, roleIds, context)
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
      const adminId = req.user?.userId || ""
      const settings = await this.service.updateAdminSettings(adminId, req.body.preferences)
      return sendSuccess(res, { settings }, "Admin settings updated successfully.")
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
