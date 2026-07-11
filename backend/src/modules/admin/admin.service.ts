import prisma from "../../shared/database/db"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { PermissionCacheManager } from "../../shared/utils/permissionCache"
import { CompanyStatus, JobStatus, ApplicationStatus, UserStatus, JobVisibility } from "@prisma/client"
import crypto from "crypto"

export interface ServiceContext {
  operatorId?: string
  operatorEmail?: string
  ipAddress?: string
  browser?: string
  device?: string
}

export class AdminService {

  // ==========================================
  // SYSTEM HEALTH ENGINE
  // ==========================================
  async getSystemHealth() {
    let dbStatus = "UP"
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (err) {
      dbStatus = "DOWN"
    }

    return {
      database: dbStatus,
      redis: "UP", // Mocked Redis connectivity
      email: "UP", // Mocked SMTP connection status
      storage: "UP", // Cloudinary connection mock
      socketio: "UP", // Real-time notification socket gateway status
      apiUptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    }
  }

  // ==========================================
  // ADMIN DASHBOARD & platform stats
  // ==========================================
  async getDashboard(adminId: string) {
    const totalCandidates = await prisma.candidateProfile.count()
    const totalRecruiters = await prisma.recruiterProfile.count()
    const totalCompanies = await prisma.company.count()
    const totalJobs = await prisma.job.count()

    const pendingCompanies = await prisma.company.count({
      where: {
        status: {
          in: [
            CompanyStatus.pending,
            CompanyStatus.pending_verification,
            CompanyStatus.submitted,
            CompanyStatus.under_review,
          ],
        },
      },
    })

    const reportedJobsCount = await prisma.jobReport.count()
    const applicationVolume = await prisma.application.count()

    const systemHealth = await this.getSystemHealth()

    const recentAudits = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 10,
    })

    const recentNotifications = await prisma.notification.findMany({
      where: { recipientId: adminId, read: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    const unreadNotificationsCount = await prisma.notification.count({
      where: { recipientId: adminId, read: false },
    })

    return {
      analytics: {
        totalCandidates,
        totalRecruiters,
        totalCompanies,
        totalJobs,
        applicationVolume,
      },
      operationalMetrics: {
        pendingCompanyVerifications: pendingCompanies,
        reportedJobsCount,
        verificationBacklogCount: pendingCompanies,
      },
      systemHealthSummary: systemHealth,
      notificationsSummary: {
        unreadCount: unreadNotificationsCount,
        recent: recentNotifications,
      },
      recentAuditLogs: recentAudits,
    }
  }

  // ==========================================
  // RECRUITER / COMPANY VERIFICATION WORKFLOW
  // ==========================================
  async listCompanies(status?: string) {
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    return prisma.company.findMany({
      where,
      include: {
        industry: true,
        recruiters: { include: { user: true } },
        benefits: true,
      },
      orderBy: { name: "asc" },
    })
  }

  async listJobs(status?: string) {
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    return prisma.job.findMany({
      where,
      include: {
        company: true,
        department: true,
        _count: { select: { applications: true, reports: true } },
      },
      orderBy: { postedOn: "desc" },
    })
  }

  async verifyCompany(
    adminId: string,
    companyId: string,
    status: CompanyStatus,
    notes?: string,
    context?: ServiceContext
  ) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      throw new Error("Company profile not found")
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const adminName = admin?.email || "Admin"

    // Save Verification History audit trail
    await prisma.companyVerificationHistory.create({
      data: {
        companyId,
        status,
        notes: notes || `Verification status updated to ${status}`,
        adminId,
      },
    })

    // Update Company status
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        status,
        feedback: notes,
      },
    })

    // Auto-approve recruiter profiles when company gets approved
    if (status === CompanyStatus.approved) {
      await prisma.recruiterProfile.updateMany({
        where: { companyId },
        data: { verified: true },
      })

      // Verify claimed perks
      await prisma.companyBenefit.updateMany({
        where: { companyId },
        data: {
          verified: true,
          verifiedBy: adminName,
          verifiedAt: new Date(),
        },
      })

      EventBus.publish("CompanyApproved", { companyId, context })
    } else if (status === CompanyStatus.rejected) {
      await prisma.recruiterProfile.updateMany({
        where: { companyId },
        data: { verified: false },
      })
      EventBus.publish("CompanyRejected", { companyId, context })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "VERIFY_COMPANY",
      entity: "Company",
      entityId: companyId,
      newValue: { status, notes },
    })

    return updatedCompany
  }

  // ==========================================
  // JOB MODERATION SYSTEM
  // ==========================================
  async moderateJob(
    adminId: string,
    jobId: string,
    action: string,
    notes?: string,
    context?: ServiceContext
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new Error("Job listing not found")
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const adminName = admin?.email || "Admin"

    let status = job.status
    let visibility = job.visibility
    let featured = job.featured
    let domainEvent = ""

    if (action === "approve") {
      status = JobStatus.approved
      visibility = JobVisibility.visible
      domainEvent = "JobApproved"
    } else if (action === "reject") {
      status = JobStatus.flagged
      visibility = JobVisibility.hidden
      domainEvent = "JobUpdated"
    } else if (action === "hide") {
      visibility = JobVisibility.hidden
    } else if (action === "unhide") {
      visibility = JobVisibility.visible
    } else if (action === "pause") {
      status = JobStatus.paused
      domainEvent = "JobPaused"
    } else if (action === "resume") {
      status = JobStatus.approved
      domainEvent = "JobResumed"
    } else if (action === "archive") {
      status = JobStatus.archived
      visibility = JobVisibility.hidden
      domainEvent = "JobClosed"
    } else if (action === "delete") {
      await prisma.job.delete({ where: { id: jobId } })
      EventBus.publish("AuditCreated", {
        ...context,
        operatorId: adminId,
        operatorEmail: admin?.email,
        category: "ADMIN",
        action: "DELETE_JOB",
        entity: "Job",
        entityId: jobId,
      })
      return { deleted: true }
    } else if (action === "feature") {
      featured = true
    } else if (action === "unfeature") {
      featured = false
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        visibility,
        featured,
      },
    })

    // Log moderation history
    await prisma.jobStatusHistory.create({
      data: {
        jobId,
        status,
        changedBy: adminName,
        notes: notes || `Job moderated via action: ${action}`,
      },
    })

    if (domainEvent) {
      EventBus.publish(domainEvent, {
        jobId,
        recruiterId: job.recruiterId,
        status,
        context,
      })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "MODERATE_JOB",
      entity: "Job",
      entityId: jobId,
      newValue: { action, status, visibility, featured, notes },
    })

    return updatedJob
  }

  // ==========================================
  // USER MANAGEMENT ACTIONS
  // ==========================================
  async updateUserStatus(
    adminId: string,
    targetUserId: string,
    status: UserStatus,
    context?: ServiceContext
  ) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const target = await prisma.user.findUnique({ where: { id: targetUserId } })

    if (!target) {
      throw new Error("Target user account not found")
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { status },
    })

    // Invalidate cached user permissions from Redis cache
    await PermissionCacheManager.invalidateUser(targetUserId)

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "UPDATE_USER_STATUS",
      entity: "User",
      entityId: targetUserId,
      oldValue: { status: target.status },
      newValue: { status },
    })

    return updatedUser
  }

  async userAdministrativeAction(
    adminId: string,
    targetUserId: string,
    action: string,
    context?: ServiceContext
  ) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const target = await prisma.user.findUnique({ where: { id: targetUserId } })

    if (!target) {
      throw new Error("Target user account not found")
    }

    if (action === "password-reset") {
      const resetToken = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.passwordReset.updateMany({
        where: { email: target.email, usedAt: null },
        data: { usedAt: new Date() },
      })
      await prisma.passwordReset.create({
        data: { email: target.email, token: resetToken, expiresAt },
      })

      EventBus.publish("PasswordResetRequested", {
        email: target.email,
        token: resetToken,
        context,
      })

      EventBus.publish("AuditCreated", {
        ...context,
        operatorId: adminId,
        operatorEmail: admin?.email,
        category: "ADMIN",
        action: "FORCE_PASSWORD_RESET",
        entity: "User",
        entityId: targetUserId,
      })

      return { resetRequested: true }
    } else if (action === "account-unlock") {
      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { status: UserStatus.Active },
      })

      EventBus.publish("AuditCreated", {
        ...context,
        operatorId: adminId,
        operatorEmail: admin?.email,
        category: "ADMIN",
        action: "UNLOCK_ACCOUNT",
        entity: "User",
        entityId: targetUserId,
      })

      return updated
    } else if (action === "force-logout") {
      // Deletes all refresh tokens for this user
      await prisma.refreshToken.deleteMany({
        where: { userId: targetUserId },
      })

      // Invalidate cached permissions
      await PermissionCacheManager.invalidateUser(targetUserId)

      EventBus.publish("AuditCreated", {
        ...context,
        operatorId: adminId,
        operatorEmail: admin?.email,
        category: "ADMIN",
        action: "FORCE_LOGOUT",
        entity: "User",
        entityId: targetUserId,
      })

      return { success: true }
    } else if (action === "verify-email") {
      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { status: UserStatus.Active },
      })

      EventBus.publish("EmailVerified", {
        userId: targetUserId,
        email: target.email,
        status: "Active",
      })

      return updated
    } else {
      throw new Error(`Unsupported administrative action: ${action}`)
    }
  }

  // ==========================================
  // EMPLOYEE INVITATION SYSTEM
  // ==========================================
  async listInvitations() {
    const raw = await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      include: { role: true },
    })

    return raw.map((inv) => {
      let status = "Pending"
      if (inv.acceptedAt) {
        status = "Accepted"
      } else if (inv.expiresAt <= new Date()) {
        status = "Expired"
      }
      return {
        ...inv,
        status,
      }
    })
  }

  async inviteEmployee(
    adminId: string,
    email: string,
    roleName: string,
    context?: ServiceContext
  ) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    
    // Check if role exists
    const role = await prisma.role.findFirst({ where: { name: roleName } })
    if (!role) {
      throw new Error(`Role name '${roleName}' not found in matrix`)
    }

    // Generate signed invitation link token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours validity

    const invitation = await prisma.invitation.create({
      data: {
        email,
        token,
        roleId: role.id,
        invitedById: adminId,
        expiresAt,
      },
    })

    // Publish EmployeeInvited email trigger
    EventBus.publish("EmployeeInvited", {
      email,
      token,
      roleId: role.id,
      context,
    })

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "INVITE_EMPLOYEE",
      entity: "Invitation",
      entityId: invitation.id,
      newValue: { email, roleName, expiresAt },
    })

    // Map status dynamically for return
    return {
      ...invitation,
      status: "Pending",
    }
  }

  async resendInvitation(adminId: string, invitationId: string, context?: ServiceContext) {
    const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } })
    if (!invitation) {
      throw new Error("Invitation not found")
    }

    // Regenerate token & validity expiration
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token,
        expiresAt,
      },
    })

    EventBus.publish("EmployeeInvited", {
      email: invitation.email,
      token,
      roleId: invitation.roleId,
      context,
    })

    return {
      ...updated,
      status: "Pending",
    }
  }

  async cancelInvitation(adminId: string, invitationId: string, context?: ServiceContext) {
    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt: new Date(0) },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: (await prisma.user.findUnique({ where: { id: adminId } }))?.email,
      category: "ADMIN",
      action: "CANCEL_INVITATION",
      entity: "Invitation",
      entityId: invitationId,
    })

    return {
      ...updated,
      status: "Expired",
    }
  }

  async expireInvitation(adminId: string, invitationId: string, context?: ServiceContext) {
    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt: new Date(0) },
    })

    return {
      ...updated,
      status: "Expired",
    }
  }

  // ==========================================
  // FEATURE FLAGS
  // ==========================================
  async getFeatureFlags() {
    return prisma.featureFlag.findMany()
  }

  async createFeatureFlag(adminId: string, data: any, context?: ServiceContext) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const flag = await prisma.featureFlag.create({
      data: {
        key: data.key,
        value: data.value,
        category: data.category,
        description: data.description,
        updatedById: adminId,
      },
    })

    await PermissionCacheManager.invalidateAll()

    EventBus.publish("FeatureFlagUpdated", {
      userId: adminId,
      settings: { [flag.key]: flag.value },
      context,
    })

    return flag
  }

  async updateFeatureFlag(adminId: string, flagId: string, data: any, context?: ServiceContext) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const flag = await prisma.featureFlag.findUnique({ where: { id: flagId } })
    if (!flag) {
      throw new Error("Feature flag not found")
    }

    const updated = await prisma.featureFlag.update({
      where: { id: flagId },
      data: {
        value: data.value !== undefined ? data.value : undefined,
        category: data.category || undefined,
        description: data.description || undefined,
        updatedById: adminId,
      },
    })

    await PermissionCacheManager.invalidateAll()

    EventBus.publish("FeatureFlagUpdated", {
      userId: adminId,
      settings: { [updated.key]: updated.value },
      context,
    })

    return updated
  }

  async deleteFeatureFlag(adminId: string, flagId: string, context?: ServiceContext) {
    await prisma.featureFlag.delete({ where: { id: flagId } })
    await PermissionCacheManager.invalidateAll()
    return { success: true }
  }

  // ==========================================
  // REPORTS GENERATION
  // ==========================================
  async getReports(type: string) {
    const candidatesCount = await prisma.candidateProfile.count()
    const recruitersCount = await prisma.recruiterProfile.count()
    const totalJobs = await prisma.job.count()

    const reportData = {
      reportType: type,
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: candidatesCount + recruitersCount,
        candidatesCount,
        recruitersCount,
        totalJobs,
      },
    }

    const mockCsvContent = `Report Type,Generated At,Total Candidates,Total Recruiters,Total Jobs\n${type},${reportData.generatedAt},${candidatesCount},${recruitersCount},${totalJobs}`
    const base64Buffer = Buffer.from(mockCsvContent).toString("base64")

    return {
      reportData,
      exportFile: {
        mimetype: "text/csv",
        filename: `platform_report_${type}.csv`,
        content: base64Buffer,
      },
    }
  }

  // ==========================================
  // AUDIT LOG INSPECTOR
  // ==========================================
  async getAuditLogs(filters: any) {
    const page = parseInt(filters.page) || 1
    const limit = parseInt(filters.limit) || 20
    const skip = (page - 1) * limit

    const where: any = {}
    if (filters.category) where.category = filters.category
    if (filters.action) where.action = filters.action
    if (filters.operatorEmail) where.operatorEmail = filters.operatorEmail
    if (filters.entity) where.entity = filters.entity

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    })

    const totalCount = await prisma.auditLog.count({ where })

    return {
      auditLogs: logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
      },
    }
  }

  // ==========================================
  // ROLE AND PERMISSION CRUD OPERATIONS
  // ==========================================
  async getRBACData() {
    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
    })
    const permissions = await prisma.permission.findMany()

    return { roles, permissions }
  }

  async createRole(adminId: string, data: any, context?: ServiceContext) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    
    // Create Role and its Permission mapping
    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
      },
    })

    if (data.permissions && Array.isArray(data.permissions)) {
      const permissionRecords = await prisma.permission.findMany({
        where: { name: { in: data.permissions } },
      })

      await prisma.rolePermission.createMany({
        data: permissionRecords.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
      })
    }

    await PermissionCacheManager.invalidateAll()

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "CREATE_ROLE",
      entity: "Role",
      entityId: role.id,
      newValue: { name: role.name, permissions: data.permissions },
    })

    return role
  }

  async updateRole(adminId: string, roleId: string, data: any, context?: ServiceContext) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      throw new Error("Role profile not found")
    }

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        description: data.description || undefined,
      },
    })

    if (data.permissions && Array.isArray(data.permissions)) {
      const permissionRecords = await prisma.permission.findMany({
        where: { name: { in: data.permissions } },
      })

      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId } })
        await tx.rolePermission.createMany({
          data: permissionRecords.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        })
      })
    }

    await PermissionCacheManager.invalidateAll()

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "UPDATE_ROLE",
      entity: "Role",
      entityId: roleId,
      newValue: { permissions: data.permissions },
    })

    return updated
  }

  async deleteRole(adminId: string, roleId: string, context?: ServiceContext) {
    await prisma.role.delete({ where: { id: roleId } })
    await PermissionCacheManager.invalidateAll()
    return { success: true }
  }

  async assignUserRoles(adminId: string, targetUserId: string, roleIds: string[], context?: ServiceContext) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: targetUserId } })
      await tx.userRole.createMany({
        data: roleIds.map((rId) => ({
          userId: targetUserId,
          roleId: rId,
        })),
      })
    })

    await PermissionCacheManager.invalidateUser(targetUserId)

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "ASSIGN_USER_ROLES",
      entity: "User",
      entityId: targetUserId,
      newValue: { roleIds },
    })

    return { success: true }
  }

  // ==========================================
  // GLOBAL ADMIN SEARCH
  // ==========================================
  async globalSearch(query: string) {
    const users = await prisma.user.findMany({
      where: { email: { contains: query, mode: "insensitive" } },
      take: 10,
    })

    const companies = await prisma.company.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: 10,
    })

    const jobs = await prisma.job.findMany({
      where: { title: { contains: query, mode: "insensitive" } },
      take: 10,
    })

    const recruiters = await prisma.recruiterProfile.findMany({
      where: { fullName: { contains: query, mode: "insensitive" } },
      take: 10,
    })

    const applications = await prisma.application.findMany({
      where: {
        job: { title: { contains: query, mode: "insensitive" } },
      },
      include: { candidate: true, job: true },
      take: 10,
    })

    return {
      query,
      results: {
        users,
        companies,
        jobs,
        recruiters,
        applications,
      },
    }
  }

  // ==========================================
  // ADDED OPERATIONS FOR FRONTEND WIRING
  // ==========================================
  async listUsers(role?: string) {
    const whereClause: any = {}
    if (role) {
      whereClause.roles = {
        some: {
          role: {
            name: { equals: role, mode: "insensitive" }
          }
        }
      }
    }

    return prisma.user.findMany({
      where: whereClause,
      include: {
        roles: {
          include: {
            role: true
          }
        },
        candidateProfile: true,
        recruiterProfile: {
          include: {
            company: true
          }
        },
        adminProfile: true
      },
      orderBy: { createdAt: "desc" }
    })
  }

  async verifyRecruiter(adminId: string, recruiterProfileId: string, verified: boolean, context?: ServiceContext) {
    const updated = await prisma.recruiterProfile.update({
      where: { id: recruiterProfileId },
      data: { verified },
      include: { user: true }
    })

    await prisma.auditLog.create({
      data: {
        action: "VERIFY_RECRUITER",
        category: "RECRUITER",
        entity: "RecruiterProfile",
        entityId: recruiterProfileId,
        newValue: { verified },
        operatorId: adminId,
        ipAddress: context?.ipAddress || "127.0.0.1",
        browser: context?.browser || "Unknown",
        device: context?.device || "Desktop",
      }
    })

    return updated
  }

  async getAdminSettings(adminId: string) {
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { preferences: true }
    })
    return user?.preferences || {}
  }

  async updateAdminSettings(adminId: string, preferences: any) {
    const updated = await prisma.user.update({
      where: { id: adminId },
      data: { preferences },
      select: { preferences: true }
    })
    return updated.preferences
  }

  async getAdminNotifications(adminId: string) {
    return prisma.notification.findMany({
      where: { recipientId: adminId },
      orderBy: { createdAt: "desc" }
    })
  }
}

export default AdminService
