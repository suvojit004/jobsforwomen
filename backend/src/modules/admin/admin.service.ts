import prisma from "../../shared/database/db"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { PermissionCacheManager } from "../../shared/utils/permissionCache"
import { CompanyStatus, JobStatus, ApplicationStatus, UserStatus, JobVisibility, PerkStatus } from "@prisma/client"
import crypto from "crypto"
import redis from "../../shared/utils/redis"
import { verifyEmailTransport } from "../../shared/utils/email"
import { verifyStorageConnection, runOrphanAssetCleanup, deleteFile, signFileUrl } from "../../shared/utils/fileStorage"
import { normalizeDocuments } from "../../shared/utils/documents"
import { RECRUITER_SUMMARY_SELECT, shapeRecruiterSummary } from "../../shared/utils/recruiterSummary"
import { io as socketIo } from "../../shared/socket/socket"
import { invalidateFeatureFlagCache } from "../../shared/utils/featureFlags"
import { queueMetrics, getDeadLetterQueueStats } from "../../shared/queue/queue"
import { socketMetrics } from "../../shared/socket/socket"
import { storageMetrics } from "../../shared/utils/fileStorage"
import { emailMetrics } from "../../shared/utils/email"
import { AppError } from "../../shared/middleware/errorHandler"
import { hashPassword } from "../../shared/utils/password"
import { invalidateSecurityPolicyCache } from "../../shared/middleware/securityPolicy.middleware"
import env from "../../shared/config/env"
import {
  recordAuditExportReceipt,
  hasRecentAuditExportReceipt,
  clearAuditExportReceipt,
} from "../../shared/utils/auditExportReceipt"

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

    // Real Redis check: ioredis exposes .status, and ping() confirms the
    // connection actually round-trips rather than just "was constructed."
    let redisStatus = "DOWN"
    try {
      if (redis && redis.status === "ready") {
        const pong = await redis.ping()
        redisStatus = pong === "PONG" ? "UP" : "DOWN"
      }
    } catch (err) {
      redisStatus = "DOWN"
    }

    // Real email-transport check (AWS SES v2 -- see verifyEmailTransport() in
    // shared/utils/email.ts). Calls SES GetAccount, which validates the
    // credentials/region and reports sandbox status without sending mail or
    // consuming sending quota.
    let emailStatus = "DOWN"
    try {
      emailStatus = (await verifyEmailTransport()) ? "UP" : "DOWN"
    } catch (err) {
      emailStatus = "DOWN"
    }

    // Real disk-storage connectivity check
    let storageStatus = "DOWN"
    try {
      storageStatus = (await verifyStorageConnection()) ? "UP" : "DOWN"
    } catch (err) {
      storageStatus = "DOWN"
    }

    // Socket.IO is in-process: "UP" means the server actually initialized the
    // io instance (initSocket() ran during boot), not just an assumption.
    const socketStatus = socketIo ? "UP" : "DOWN"

    // real dead-letter queue depth.
    // Previously there was no DLQ at all (see queue.ts) -- this reads the
    // actual pending count off the real BullMQ dead-letter queue.
    const deadLetterStats = await getDeadLetterQueueStats()

    // the raw top-level GET /health endpoint
    // (app.ts) already exposed real BullMQ queue counts, real connected
    // Socket.IO counts, and real storage/email delivery metrics -- but
    // the Admin-facing System Health page (this endpoint) never surfaced
    // any of it, so the UI's "queue depth / failed jobs / active socket
    // connections" story was simply missing rather than fake. This reuses
    // the exact same in-memory metrics objects the /health endpoint reads,
    // no new tracking is introduced.
    return {
      database: dbStatus,
      redis: redisStatus,
      email: emailStatus,
      storage: storageStatus,
      socketio: socketStatus,
      apiUptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      queues: {
        activeJobs: queueMetrics.activeJobs,
        completedJobs: queueMetrics.completedJobs,
        failedJobs: queueMetrics.failedJobs,
        deadLetterPendingCount: deadLetterStats.pendingCount,
      },
      sockets: {
        connectedCandidates: socketMetrics.connectedCandidates,
        connectedRecruiters: socketMetrics.connectedRecruiters,
        connectedAdmins: socketMetrics.connectedAdmins,
        notificationsSec: socketMetrics.notificationsSec,
      },
      emailDelivery: {
        sent: emailMetrics.sent,
        failed: emailMetrics.failed,
      },
      storageMetrics: {
        uploadCount: storageMetrics.uploadCount,
        deleteCount: storageMetrics.deleteCount,
        averageLatencyMs: Math.round(storageMetrics.averageLatencyMs),
        retryCount: storageMetrics.retryCount,
      },
      // Metric semantics: queueMetrics/emailMetrics/storageMetrics are
      // in-memory and reset to 0 on every restart/redeploy, so the frontend
      // needs to know which category each field falls into rather than
      // presenting all numbers as equally durable.
      //   CURRENT_STATE            -- live, queryable truth (fresh read on
      //                                every call), or a Redis-durable count
      //                                that survives a restart.
      //   PROCESS_LIFETIME_COUNTER -- in-memory counter that resets to 0 on
      //                                restart; accumulates only since this
      //                                process last started.
      //   PERSISTENT_HISTORICAL_METRIC -- a running total backed by a
      //                                database/persistent store. Nothing
      //                                currently uses this category.
      metricSemantics: {
        currentState: [
          "database",
          "redis",
          "email",
          "storage",
          "socketio",
          "apiUptime",
          "memoryUsage",
          "queues.activeJobs",
          "queues.deadLetterPendingCount",
          "sockets.connectedCandidates",
          "sockets.connectedRecruiters",
          "sockets.connectedAdmins",
          "sockets.notificationsSec",
        ],
        processLifetimeCounter: [
          "cpuUsage",
          "queues.completedJobs",
          "queues.failedJobs",
          "emailDelivery.sent",
          "emailDelivery.failed",
          "storageMetrics.uploadCount",
          "storageMetrics.deleteCount",
          "storageMetrics.averageLatencyMs",
          "storageMetrics.retryCount",
        ],
        persistentHistoricalMetric: [],
        note:
          "PROCESS_LIFETIME_COUNTER fields reset to 0 on every server restart or redeploy -- they count events since processStartedAt, not all-time totals. No field currently qualifies as PERSISTENT_HISTORICAL_METRIC (a database-backed running total that survives restarts); adding one would require a new persisted counter, not just relabeling an existing in-memory value.",
      },
      // The wall-clock moment this process actually booted, so the frontend
      // can show "counters reset when the server last restarted at <time>"
      // context next to the process-lifetime numbers above instead of just
      // a bare uptime duration.
      processStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    }
  }

  // Read-only orphan storage asset dry run (disk vs DB cross-reference).
  // Never deletes anything -- see runOrphanAssetCleanup() for details.
  async getOrphanAssetReport() {
    return runOrphanAssetCleanup()
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

    // Real platform-wide application status funnel -- the admin dashboard
    // widget for this used to be a hardcoded constant array (fixed numbers
    // like "Applied: 7452") that never reflected any real data at all.
    const applicationStatusGroups = await prisma.application.groupBy({
      by: ["status"],
      _count: { id: true },
    })
    const funnelCounts: Record<string, number> = {}
    applicationStatusGroups.forEach((g) => {
      funnelCounts[g.status] = g._count.id
    })
    const funnelStages = [
      { name: "Applied", statuses: [ApplicationStatus.Applied] },
      { name: "Shortlisted", statuses: [ApplicationStatus.Reviewed, ApplicationStatus.Shortlisted] },
      { name: "Interviewing", statuses: [ApplicationStatus.InterviewScheduled] },
      { name: "Offered", statuses: [ApplicationStatus.OfferReleased, ApplicationStatus.Hired] },
    ]
    const applicationFunnel = funnelStages.map((stage) => {
      const value = stage.statuses.reduce((sum, s) => sum + (funnelCounts[s] || 0), 0)
      const percent = applicationVolume > 0 ? `${((value / applicationVolume) * 100).toFixed(1)}%` : "0%"
      return { name: stage.name, value, percent }
    })

    // Real department-wise job distribution -- previously a hardcoded
    // constant array unrelated to any actual job postings.
    const departmentGroups = await prisma.job.groupBy({
      by: ["departmentId"],
      _count: { id: true },
    })
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentGroups.map((g) => g.departmentId) } },
    })
    const departmentNameById: Record<string, string> = {}
    departments.forEach((d) => { departmentNameById[d.id] = d.name })
    const maxDeptCount = Math.max(1, ...departmentGroups.map((g) => g._count.id))
    const departmentColors = ["bg-[#6B2C91]", "bg-blue-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-slate-500"]
    const departmentDistribution = departmentGroups
      .map((g, idx) => ({
        name: departmentNameById[g.departmentId] || "Unknown",
        value: g._count.id,
        color: departmentColors[idx % departmentColors.length],
        max: maxDeptCount,
      }))
      .sort((a, b) => b.value - a.value)

    // Real 7-day user growth (cumulative signups), replacing a hardcoded
    // constant line-chart dataset that was never derived from real users.
    const sevenDaysAgoUsers = new Date()
    sevenDaysAgoUsers.setHours(0, 0, 0, 0)
    sevenDaysAgoUsers.setDate(sevenDaysAgoUsers.getDate() - 6)
    const [usersBeforeWindow, usersInWindow] = await Promise.all([
      prisma.user.count({ where: { createdAt: { lt: sevenDaysAgoUsers } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgoUsers } },
        select: { createdAt: true },
      }),
    ])
    const growthDays: { key: string; date: Date }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgoUsers)
      d.setDate(d.getDate() + i)
      growthDays.push({ key: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), date: d })
    }
    const newUsersByDay: Record<string, number> = {}
    growthDays.forEach(({ key }) => { newUsersByDay[key] = 0 })
    usersInWindow.forEach((u) => {
      const d = new Date(u.createdAt)
      d.setHours(0, 0, 0, 0)
      const key = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      if (newUsersByDay[key] !== undefined) newUsersByDay[key] += 1
    })
    let runningTotal = usersBeforeWindow
    const userGrowth = growthDays.map(({ key }) => {
      runningTotal += newUsersByDay[key]
      return { day: key, Users: runningTotal }
    })

    // Deliberately not calling getSystemHealth() here: it makes an uncached,
    // untimed network call (SES) that can hang this whole response if
    // it's slow. The dashboard never reads that data anyway -- System
    // Health has its own dedicated endpoint/page.

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
        applicationFunnel,
        departmentDistribution,
        userGrowth,
      },
      operationalMetrics: {
        pendingCompanyVerifications: pendingCompanies,
        reportedJobsCount,
        verificationBacklogCount: pendingCompanies,
      },
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

    const companies = await prisma.company.findMany({
      where,
      include: {
        industry: true,
        recruiters: { include: { user: true } },
        benefits: true,
        perkRequests: true,
      },
      orderBy: { name: "asc" },
    })

    // Real "total hires" per company (previously a hardcoded "14" on the
    // admin Company Details screen regardless of which company was selected).
    const hiredApps = await prisma.application.findMany({
      where: {
        status: ApplicationStatus.Hired,
        job: { companyId: { in: companies.map((c) => c.id) } },
      },
      select: { job: { select: { companyId: true } } },
    })
    const hiredCountByCompany: Record<string, number> = {}
    hiredApps.forEach((a) => {
      const cid = a.job.companyId
      hiredCountByCompany[cid] = (hiredCountByCompany[cid] || 0) + 1
    })

    return companies.map((c) => ({
      ...c,
      hiredCount: hiredCountByCompany[c.id] || 0,
      verificationDocuments: normalizeDocuments(c.verificationDocuments),
      perkRequests: c.perkRequests.map((p) => ({ ...p, documents: normalizeDocuments(p.documents) })),
    }))
  }

  async listJobs(status?: string) {
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    // Includes recruiter/skills/history so Job Approval can show who posted
    // a job, its tags, and moderation trail. Uses the same safe recruiter
    // select (no passwordHash) as candidate.service.ts so the shape matches
    // what the shared JobDetailContent.tsx expects.
    const jobs = await prisma.job.findMany({
      where,
      include: {
        company: true,
        department: true,
        recruiter: { select: RECRUITER_SUMMARY_SELECT },
        skills: { include: { skill: true } },
        history: { orderBy: { createdAt: "desc" } },
        _count: { select: { applications: true, reports: true } },
      },
      orderBy: { postedOn: "desc" },
    })

    return jobs.map((job) => ({
      ...job,
      recruiter: shapeRecruiterSummary(job.recruiter),
      skills: job.skills.map((s) => s.skill.name),
    }))
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

    let verificationToken: string | undefined
    if (status === CompanyStatus.info_requested) {
      verificationToken = crypto.randomBytes(32).toString("hex")
    }

    const updatedCompany = await prisma.$transaction(async (tx) => {
      // 1. Save Verification History audit trail
      await tx.companyVerificationHistory.create({
        data: {
          companyId,
          status,
          notes: notes || `Verification status updated to ${status}`,
          adminId,
        },
      })

      // 2. Update Company status
      const updateData: any = {
        status,
        feedback: notes,
      }
      if (status === CompanyStatus.info_requested && verificationToken) {
        updateData.verificationToken = verificationToken
        updateData.verificationTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }

      const updated = await tx.company.update({
        where: { id: companyId },
        data: updateData,
      })

      // 3. Auto-approve recruiter profiles & update user status
      if (status === CompanyStatus.approved) {
        await tx.recruiterProfile.updateMany({
          where: { companyId },
          data: { verified: true },
        })

        const recruiters = await tx.recruiterProfile.findMany({
          where: { companyId },
          select: { userId: true },
        })
        const userIds = recruiters.map((r) => r.userId)

        if (userIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: userIds } },
            data: { status: UserStatus.Active },
          })
        }
      } else if (status === CompanyStatus.rejected) {
        await tx.recruiterProfile.updateMany({
          where: { companyId },
          data: { verified: false },
        })

        const recruiters = await tx.recruiterProfile.findMany({
          where: { companyId },
          select: { userId: true },
        })
        const userIds = recruiters.map((r) => r.userId)

        if (userIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: userIds } },
            data: { status: UserStatus.Rejected },
          })
        }
      }

      return updated
    })

    // Invalidate recruiter permission cache in Redis after transactional DB commit succeeds
    if (status === CompanyStatus.approved || status === CompanyStatus.rejected) {
      const recruiters = await prisma.recruiterProfile.findMany({
        where: { companyId },
        select: { userId: true },
      })
      const userIds = recruiters.map((r) => r.userId)

      for (const userId of userIds) {
        await PermissionCacheManager.invalidateUser(userId)
      }
    }

    // Publish event bus updates after commit
    if (status === CompanyStatus.approved) {
      EventBus.publish("CompanyApproved", { companyId, context })
    } else if (status === CompanyStatus.rejected) {
      EventBus.publish("CompanyRejected", { companyId, context })
    } else if (status === CompanyStatus.info_requested && verificationToken) {
      EventBus.publish("CompanyInfoRequested", { companyId, notes, verificationToken, context })
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

  // Suspends a company: the company itself, every recruiter under it (only
  // ones currently Active -- an independently Blocked recruiter is left
  // alone rather than silently downgraded), and every one of its `approved`
  // jobs is hidden from candidates (visibility flips to hidden; jobs in any
  // other status are already invisible to candidates regardless of this
  // field, per candidate.service.ts's status===approved filter, so they're
  // left untouched). Fully reversible via unsuspendCompany below.
  async suspendCompany(adminId: string, companyId: string, context?: ServiceContext) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { recruiters: { include: { user: true } } },
    })
    if (!company) {
      throw new Error("Company profile not found")
    }
    if (company.status === CompanyStatus.suspended) {
      throw new AppError("This company is already suspended.", 400)
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const recruitersToSuspend = company.recruiters.filter((r) => r.user.status === UserStatus.Active)

    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data: { status: CompanyStatus.suspended } })

      if (recruitersToSuspend.length > 0) {
        const userIds = recruitersToSuspend.map((r) => r.userId)
        await tx.user.updateMany({ where: { id: { in: userIds } }, data: { status: UserStatus.Suspended } })
        // Same forced-logout treatment updateUserStatus gives an ordinary
        // suspended user -- otherwise a currently-logged-in recruiter would
        // keep a live session/refresh token despite the account no longer
        // being Active.
        await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } })
        await tx.session.updateMany({ where: { userId: { in: userIds }, revoked: false }, data: { revoked: true } })
      }

      await tx.job.updateMany({
        where: { companyId, status: JobStatus.approved },
        data: { visibility: JobVisibility.hidden },
      })
    })

    for (const r of recruitersToSuspend) {
      await PermissionCacheManager.invalidateUser(r.userId)
      EventBus.publish("UserAccountStatusChanged", {
        userId: r.userId,
        email: r.user.email,
        fullName: r.fullName,
        status: "Suspended",
        operatorEmail: admin?.email,
        context,
      })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "SUSPEND_COMPANY",
      entity: "Company",
      entityId: companyId,
      oldValue: { status: company.status },
      newValue: { status: CompanyStatus.suspended, recruitersSuspended: recruitersToSuspend.length },
    })

    return { success: true }
  }

  // Mirror of suspendCompany -- always restores `approved` (this method can
  // only ever be called on a currently-suspended company, and a company
  // only reaches `suspended` from `approved` in the first place; see
  // suspendCompany's guard). Only recruiters left Suspended by
  // suspendCompany are reactivated -- one independently Blocked before the
  // company was ever suspended stays Blocked, not silently reactivated as a
  // side effect of this company-level action.
  async unsuspendCompany(adminId: string, companyId: string, context?: ServiceContext) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { recruiters: { include: { user: true } } },
    })
    if (!company) {
      throw new Error("Company profile not found")
    }
    if (company.status !== CompanyStatus.suspended) {
      throw new AppError("This company is not currently suspended.", 400)
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const recruitersToReactivate = company.recruiters.filter((r) => r.user.status === UserStatus.Suspended)

    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data: { status: CompanyStatus.approved } })

      if (recruitersToReactivate.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: recruitersToReactivate.map((r) => r.userId) } },
          data: { status: UserStatus.Active },
        })
      }

      await tx.job.updateMany({
        where: { companyId, status: JobStatus.approved },
        data: { visibility: JobVisibility.visible },
      })
    })

    for (const r of recruitersToReactivate) {
      await PermissionCacheManager.invalidateUser(r.userId)
      EventBus.publish("UserAccountReactivated", {
        userId: r.userId,
        email: r.user.email,
        fullName: r.fullName,
        operatorEmail: admin?.email,
        context,
      })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "UNSUSPEND_COMPANY",
      entity: "Company",
      entityId: companyId,
      oldValue: { status: CompanyStatus.suspended },
      newValue: { status: CompanyStatus.approved, recruitersReactivated: recruitersToReactivate.length },
    })

    return { success: true }
  }

  // Permanent company deletion -- the company, every recruiter account under
  // it, and every job those recruiters posted (with everything Job/User
  // cascade normally reach: applications, interviews, saved-job entries,
  // notifications, etc). Order matters: Job.recruiterId and
  // RecruiterProfile.companyId are both plain restricted FKs (no onDelete:
  // Cascade), so jobs must go first, then the recruiter Users (which cascade
  // -delete their RecruiterProfile rows), and only then the Company row
  // itself -- attempting any other order hits a foreign key violation.
  async deleteCompany(adminId: string, companyId: string, context?: ServiceContext) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { recruiters: { include: { user: true } } },
    })
    if (!company) {
      throw new Error("Company profile not found")
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const jobCount = await prisma.job.count({ where: { companyId } })

    // Best-effort cleanup of files cascade can't reach (only the DB pointers
    // get removed by the deletes below) -- same non-fatal try/catch pattern
    // deleteUser already uses for a candidate's resume file.
    const filesToClean: string[] = []
    if (company.logoPublicId) filesToClean.push(company.logoPublicId)
    if (Array.isArray(company.verificationDocuments)) {
      for (const doc of company.verificationDocuments as any[]) {
        if (doc?.publicId) filesToClean.push(doc.publicId)
      }
    }
    for (const publicId of filesToClean) {
      try {
        await deleteFile(publicId, true)
      } catch (err: any) {
        logger.warn(`[FileStorage] Failed to delete asset for deleted company ${companyId}: ${err.message}`)
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.job.deleteMany({ where: { companyId } })
        if (company.recruiters.length > 0) {
          await tx.user.deleteMany({ where: { id: { in: company.recruiters.map((r) => r.userId) } } })
        }
        await tx.company.delete({ where: { id: companyId } })
      })
    } catch (err: any) {
      if (err?.code === "P2003" || /foreign key|violates.*constraint/i.test(err?.message || "")) {
        throw new AppError(
          "This company can't be deleted because other records still reference it.",
          409
        )
      }
      throw err
    }

    for (const r of company.recruiters) {
      await PermissionCacheManager.invalidateUser(r.userId)
    }

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "DELETE_COMPANY",
      entity: "Company",
      entityId: companyId,
      oldValue: {
        name: company.name,
        status: company.status,
        recruitersDeleted: company.recruiters.length,
        jobsDeleted: jobCount,
      },
    })

    // Best-effort notification to each recruiter whose account just got
    // deleted as a side effect -- reuses the same UserAccountDeleted email
    // an ordinary recruiter delete already sends, so there's no separate
    // "your company was deleted" template to maintain.
    for (const r of company.recruiters) {
      EventBus.publish("UserAccountDeleted", {
        userId: r.userId,
        email: r.user.email,
        fullName: r.fullName,
        operatorEmail: admin?.email,
        context,
      })
    }

    return { success: true, recruitersDeleted: company.recruiters.length, jobsDeleted: jobCount }
  }

  // ==========================================
  // COMPANY PERK REQUESTS (Parts 6/7 -- deliberately independent from
  // verifyCompany() above; a company's registration approval must never
  // auto-approve or auto-reject its perk claims)
  // ==========================================

  async listPerkRequests(status?: string) {
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    const requests = await prisma.companyPerkRequest.findMany({
      where,
      include: {
        company: {
          include: {
            recruiters: { include: { user: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    })

    return requests.map((r) => ({ ...r, documents: normalizeDocuments(r.documents) }))
  }

  async reviewPerkRequest(adminId: string, perkRequestId: string, status: PerkStatus, comment?: string, context?: ServiceContext) {
    const request = await prisma.companyPerkRequest.findUnique({
      where: { id: perkRequestId },
      include: { company: true },
    })

    if (!request) {
      throw new Error("Perk request not found")
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })

    const updated = await prisma.companyPerkRequest.update({
      where: { id: perkRequestId },
      data: {
        status,
        adminComment: comment,
        reviewedAt: new Date(),
      },
    })

    // Unlike company registration (email-only), perk communication is BOTH
    // a dashboard notification AND an email per Part 7 -- both, plus the
    // audit log entry, are handled by notification.listener.ts's
    // PerkReviewed subscription (and email.listener.ts's, for the email) so
    // there's a single place logging this action, not a duplicate here.
    EventBus.publish("PerkReviewed", {
      perkRequestId,
      companyId: request.companyId,
      companyName: request.company.name,
      perkName: request.perkName,
      status,
      comment,
      operatorId: adminId,
      operatorEmail: admin?.email,
      context,
    })

    return updated
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
    // Includes recruiter+user and company so the JobApproved/JobRejected
    // domain events below can carry everything notification.listener.ts
    // needs (recruiter's real User id, job title, company name) without a
    // second round-trip query in the listener.
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { recruiter: { include: { user: true } }, company: true },
    })
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
      domainEvent = "JobRejected"
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
        jobTitle: job.title,
        jobLocation: job.location,
        recruiterId: job.recruiterId,
        // The real recipient for a Notification row must be a User id, not
        // the RecruiterProfile id -- job.recruiterId (kept above, unchanged,
        // for the existing audit-log consumers of this event) is the
        // latter.
        recruiterUserId: job.recruiter.userId,
        companyId: job.companyId,
        status,
        reason: notes,
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
    context?: ServiceContext,
    operatorRoles: string[] = []
  ) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      // candidateProfile/recruiterProfile added so a suspension/block email
      // (below) can address the recipient by name -- previously only `roles`
      // was fetched here since nothing past this point needed a display name.
      include: {
        roles: { include: { role: true } },
        candidateProfile: true,
        recruiterProfile: true,
      },
    })

    if (!target) {
      throw new Error("Target user account not found")
    }

    const targetRoleNames: string[] = (target.roles || []).map((r: any) => r.role?.name).filter(Boolean)
    const ADMIN_TIER = ["Admin", "Super Admin", "Moderator", "Support Executive"]
    const targetIsAdminTier = targetRoleNames.some((r) => ADMIN_TIER.includes(r))
    const targetFullName =
      target.candidateProfile?.fullName || target.recruiterProfile?.fullName || target.email.split("@")[0]

    // Admin Management spec: only a Super Admin may suspend/activate another
    // administrator account -- a plain Admin/Moderator suspending a peer (or
    // a Super Admin) is a privilege-escalation-adjacent action this screen
    // must not allow, even though the underlying endpoint is also used for
    // ordinary candidate/recruiter moderation by any Admin-tier user.
    if (targetIsAdminTier && !operatorRoles.includes("Super Admin")) {
      throw new Error("Only a Super Admin can change another administrator's account status.")
    }

    // Last-Super-Admin guard: suspending/blocking/rejecting the platform's
    // only remaining Super Admin would lock everyone out of every
    // Super-Admin-only action (including undoing this) with no recovery
    // path short of a direct DB edit.
    if (targetRoleNames.includes("Super Admin") && status !== UserStatus.Active) {
      const otherActiveSuperAdmins = await prisma.user.count({
        where: {
          id: { not: targetUserId },
          status: UserStatus.Active,
          roles: { some: { role: { name: "Super Admin" } } },
        },
      })
      if (otherActiveSuperAdmins === 0) {
        throw new Error("Cannot suspend the last active Super Admin.")
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { status },
    })

    // Invalidate cached user permissions from Redis cache
    await PermissionCacheManager.invalidateUser(targetUserId)

    // moving a user to any non-Active status ("soft delete" in
    // the ticket's terminology -- Suspended/Blocked/Rejected) previously only
    // flipped the `status` column. Their existing refresh token and any
    // active sessions stayed live, so a currently-logged-in user wasn't
    // actually logged out -- requireActiveUser would reject their next *API*
    // call, but they could still silently sit on a valid refresh token. This
    // mirrors what userAdministrativeAction's "force-logout" action already
    // does, just triggered automatically whenever the new status isn't Active.
    if (status !== UserStatus.Active) {
      await prisma.refreshToken.deleteMany({ where: { userId: targetUserId } })
      await prisma.session.updateMany({
        where: { userId: targetUserId, revoked: false },
        data: { revoked: true },
      })
    }

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

    // Admin Management spec: "Notifications ... on account suspended /
    // account activated" -- scoped to admin-tier targets only, so ordinary
    // candidate/recruiter moderation (which this same method also handles)
    // doesn't change behavior.
    if (targetIsAdminTier) {
      EventBus.publish("AdminAccountStatusChanged", {
        userId: targetUserId,
        email: target.email,
        status,
        operatorEmail: admin?.email,
        context,
      })
    } else if (status === UserStatus.Suspended || status === UserStatus.Blocked) {
      // Ordinary candidate/recruiter counterpart -- previously this branch
      // didn't exist at all, so a suspended/blocked candidate or recruiter
      // got no email and no in-app notification telling them why they
      // suddenly couldn't log in anymore.
      EventBus.publish("UserAccountStatusChanged", {
        userId: targetUserId,
        email: target.email,
        fullName: targetFullName,
        status: status === UserStatus.Blocked ? "Blocked" : "Suspended",
        operatorEmail: admin?.email,
        context,
      })
    } else if (status === UserStatus.Active && (target.status === UserStatus.Suspended || target.status === UserStatus.Blocked)) {
      // Reactivation -- the mirror image of the branch above. Only fires on
      // an actual Suspended/Blocked -> Active transition, not e.g. a
      // Rejected -> Active move (that's a different flow -- recruiter
      // approval -- with its own email already).
      EventBus.publish("UserAccountReactivated", {
        userId: targetUserId,
        email: target.email,
        fullName: targetFullName,
        operatorEmail: admin?.email,
        context,
      })
    }

    return updatedUser
  }

  // Permanent user deletion. Every relation a User owns is `onDelete:
  // Cascade` in schema.prisma, so `prisma.user.delete()` removes all of it.
  // The one thing cascade can't reach is the resume file on disk (only the
  // DB pointer), so that's cleaned up explicitly first.
  async deleteUser(
    adminId: string,
    targetUserId: string,
    context?: ServiceContext,
    // Job.recruiterId has no onDelete: Cascade (Postgres RESTRICT by
    // default), so deleting a recruiter who still owns jobs must resolve
    // that ownership conflict first via one of these options.
    options?: { archiveJobs?: boolean; transferToRecruiterId?: string },
    operatorRoles: string[] = []
  ) {
    if (adminId === targetUserId) {
      throw new Error("You cannot delete your own account from this screen.")
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        roles: { include: { role: true } },
        candidateProfile: true,
        recruiterProfile: true,
      },
    })

    if (!target) {
      throw new Error("Target user account not found")
    }

    const targetRoleNames: string[] = (target.roles || []).map((r: any) => r.role?.name).filter(Boolean)
    if (targetRoleNames.includes("Super Admin")) {
      throw new Error("Super Admin accounts cannot be deleted from this screen.")
    }

    // Deleting any administrator account (not just Super Admin, blocked
    // above) requires the operator to be a Super Admin. Candidate/recruiter
    // deletes via this same shared endpoint are unaffected.
    const ADMIN_TIER = ["Admin", "Super Admin", "Moderator", "Support Executive"]
    if (targetRoleNames.some((r) => ADMIN_TIER.includes(r)) && !operatorRoles.includes("Super Admin")) {
      throw new Error("Only a Super Admin can delete another administrator's account.")
    }

    let transferTarget: { id: string; companyId: string } | null = null
    if (target.recruiterProfile) {
      const jobCount = await prisma.job.count({ where: { recruiterId: target.recruiterProfile.id } })
      if (jobCount > 0) {
        if (options?.transferToRecruiterId) {
          const candidate = await prisma.recruiterProfile.findUnique({
            where: { id: options.transferToRecruiterId },
          })
          if (!candidate) {
            throw new AppError("The recruiter you're transferring jobs to could not be found.", 404)
          }
          if (candidate.id === target.recruiterProfile.id) {
            throw new AppError("Cannot transfer jobs to the recruiter being deleted.", 400)
          }
          if (candidate.companyId !== target.recruiterProfile.companyId) {
            throw new AppError("Jobs can only be transferred to another recruiter at the same company.", 400)
          }
          transferTarget = candidate
        } else if (!options?.archiveJobs) {
          throw new AppError(
            `This recruiter owns ${jobCount} job posting${jobCount === 1 ? "" : "s"}. Archive them or transfer them to another recruiter before deleting this account.`,
            409
          )
        }
      }
    }

    const resumePublicId = target.candidateProfile?.resumePublicId
    if (resumePublicId) {
      try {
        await deleteFile(resumePublicId, true)
      } catch (err: any) {
        logger.warn(`[FileStorage] Failed to delete resume asset for deleted user ${targetUserId}: ${err.message}`)
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (target.recruiterProfile) {
          if (transferTarget) {
            await tx.job.updateMany({
              where: { recruiterId: target.recruiterProfile.id },
              data: { recruiterId: transferTarget.id },
            })
          } else if (options?.archiveJobs) {
            const jobsToArchive = await tx.job.findMany({
              where: { recruiterId: target.recruiterProfile.id, status: { not: JobStatus.archived } },
              select: { id: true },
            })
            if (jobsToArchive.length > 0) {
              await tx.job.updateMany({
                where: { id: { in: jobsToArchive.map((j) => j.id) } },
                data: { status: JobStatus.archived },
              })
              await tx.jobStatusHistory.createMany({
                data: jobsToArchive.map((j) => ({
                  jobId: j.id,
                  status: JobStatus.archived,
                  changedBy: admin?.email || "System",
                  notes: "Auto-archived: the owning recruiter's account was deleted.",
                })),
              })
            }
          }
        }

        await tx.user.delete({ where: { id: targetUserId } })
      })
    } catch (err: any) {
      // Defense in depth: any remaining FK-constraint failure on this path
      // (or any other RESTRICT relation on User we haven't enumerated) gets
      // translated into a clean 409 instead of reaching the client as a raw,
      // unhandled 500. PrismaClientUnknownRequestError has no `.code`, so we
      // fall back to matching the underlying Postgres error text.
      if (err?.code === "P2003" || /foreign key|violates.*constraint/i.test(err?.message || "")) {
        throw new AppError(
          "This account can't be deleted because other records still reference it. Try archiving or transferring its data first.",
          409
        )
      }
      throw err
    }

    await PermissionCacheManager.invalidateUser(targetUserId)

    // The row is now gone, so this audit entry (with a snapshot of who/what
    // was deleted) is the only remaining record that this account ever
    // existed -- entityId is retained for traceability even though it no
    // longer resolves to a live row.
    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "DELETE_USER",
      entity: "User",
      entityId: targetUserId,
      oldValue: {
        email: target.email,
        roles: targetRoleNames,
        status: target.status,
        jobsArchived: options?.archiveJobs || undefined,
        jobsTransferredTo: transferTarget?.id || undefined,
      },
    })

    // Candidate/recruiter counterpart of the email above -- previously this
    // method sent nothing at all on deletion, admin-tier or otherwise; the
    // account just vanished with only the audit entry above as any record it
    // ever existed. Scoped to non-admin-tier targets to match exactly what
    // was asked for; an admin-tier equivalent would be a separate, deliberate
    // addition since deleting a fellow admin account carries different
    // implications than moderating an ordinary user.
    if (!targetRoleNames.some((r) => ADMIN_TIER.includes(r))) {
      const targetFullName =
        target.candidateProfile?.fullName || target.recruiterProfile?.fullName || target.email.split("@")[0]
      EventBus.publish("UserAccountDeleted", {
        userId: targetUserId,
        email: target.email,
        fullName: targetFullName,
        operatorEmail: admin?.email,
        context,
      })
    }

    return { success: true }
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
      // Unlike the self-service /forgot-password endpoint (gated by
      // forgotPasswordSchema's z.string().email() at the API boundary),
      // this admin-triggered path reads target.email straight from the DB
      // with no re-validation. A malformed stored address (e.g. a stray
      // duplicate '@') would otherwise sail through to the email queue,
      // get permanently rejected by SES minutes later, and land in the
      // dead-letter queue with no feedback to the admin who triggered it.
      // Fail fast here instead, with a message that names the actual problem.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)) {
        throw new AppError(
          `Cannot send a password reset: this account's stored email address is not a valid, deliverable address. Correct the user's email before retrying.`,
          400
        )
      }

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
    } else if (action === "clear-login-lockout") {
      // Distinct from "account-unlock" above -- that clears a
      // Suspended/Blocked *status*. This clears the separate
      // User.lockedUntil set by AuthService.recordAdminLoginFailure after
      // too many failed password attempts (see shared/utils/loginSecurity.ts).
      // A locked-out admin otherwise just has to wait out
      // ADMIN_LOGIN_LOCKOUT_DURATION_MINUTES; this lets a Super Admin lift
      // it early once they've confirmed it was a legitimate lockout.
      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { lockedUntil: null },
      })

      EventBus.publish("AuditCreated", {
        ...context,
        operatorId: adminId,
        operatorEmail: admin?.email,
        category: "SECURITY",
        action: "CLEAR_LOGIN_LOCKOUT",
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

    // Part 14 audit-completeness fix: this regenerates a fresh, live
    // invitation token (a real security-sensitive action -- it extends who
    // can still redeem staff access) but previously left no audit trail at
    // all, unlike its sibling inviteEmployee/cancelInvitation actions below.
    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      category: "ADMIN",
      action: "RESEND_INVITATION",
      entity: "Invitation",
      entityId: invitationId,
      newValue: { email: invitation.email },
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

    // Part 14 audit-completeness fix: this performs the exact same
    // destructive mutation as cancelInvitation() above (immediately expires
    // a pending invitation), but previously had no audit trail at all.
    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      category: "ADMIN",
      action: "EXPIRE_INVITATION",
      entity: "Invitation",
      entityId: invitationId,
    })

    return {
      ...updated,
      status: "Expired",
    }
  }

  // ==========================================
  // FEATURE FLAGS
  // ==========================================
  // push_notifications, advanced_analytics, experimental_sockets, and
  // mfa_enforced are no longer seeded (see seed.ts) since nothing in the
  // codebase ever branched on them -- they only ever rendered as permanently
  // disabled "Not Implemented" rows on the Feature Configs page. Filtered
  // out here too so a database seeded before this change (which still has
  // those 4 rows sitting in the table) stops surfacing them immediately on
  // redeploy, with no migration required -- the rows are just left dormant
  // rather than destructively deleted.
  private static readonly RETIRED_UNIMPLEMENTED_FLAG_KEYS = new Set([
    "push_notifications",
    "advanced_analytics",
    "experimental_sockets",
    // Real-time chat was isolated and removed from the app -- see
    // seed.ts's Feature Flags section. The row is left dormant in the DB
    // (no destructive migration) rather than deleted, same treatment as
    // the flags above.
    "chat_enabled",
    "mfa_enforced",
  ])

  async getFeatureFlags() {
    const flags = await prisma.featureFlag.findMany()
    return flags.filter((f) => !AdminService.RETIRED_UNIMPLEMENTED_FLAG_KEYS.has(f.key))
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
    invalidateFeatureFlagCache(flag.key)

    // Distinct event name from candidate.service.ts's "FeatureFlagUpdated"
    // -- reusing that one silently mislabeled admin flag changes as
    // candidate settings updates in the audit log.
    EventBus.publish("AdminFeatureFlagUpdated", {
      adminId,
      flagId: flag.id,
      flagKey: flag.key,
      flagValue: flag.value,
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
    invalidateFeatureFlagCache(updated.key)

    EventBus.publish("AdminFeatureFlagUpdated", {
      adminId,
      flagId: updated.id,
      flagKey: updated.key,
      flagValue: updated.value,
      context,
    })

    return updated
  }

  async deleteFeatureFlag(adminId: string, flagId: string, context?: ServiceContext) {
    const deleted = await prisma.featureFlag.delete({ where: { id: flagId } })
    await PermissionCacheManager.invalidateAll()
    invalidateFeatureFlagCache(deleted.key)

    // Part 14 audit-completeness fix: deleting a feature flag is a
    // permanent, platform-wide configuration change -- its sibling
    // create/update actions above are both audited via
    // "AdminFeatureFlagUpdated", but delete previously published no event
    // at all.
    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      category: "ADMIN",
      action: "DELETE_FEATURE_FLAG",
      entity: "FeatureFlag",
      entityId: flagId,
      oldValue: { key: deleted.key },
    })

    return { success: true }
  }

  // ==========================================
  // REPORTS GENERATION
  // ==========================================
  // Generates a real row-per-record CSV for candidates/recruiters/jobs based
  // on `type`; the aggregate summary is only used for the "analytics" card.
  private csvEscape(value: any): string {
    const str = value === null || value === undefined ? "" : String(value)
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  private toCsv(headers: string[], rows: any[][]): string {
    const lines = [headers.join(",")]
    for (const row of rows) {
      lines.push(row.map((cell) => this.csvEscape(cell)).join(","))
    }
    return lines.join("\n")
  }

  // Used only by the "all" combined export -- stacks a labeled section
  // (title line + its own header row + its own data rows) so one CSV can
  // hold multiple tables with different column shapes side by side. Not
  // strictly tidy data, but it's the standard way admins hand-export mixed
  // entity dumps for a human to open in Excel/Sheets, and it lets every
  // section keep its own column set instead of forcing everything into one
  // wide, mostly-empty table.
  private toCsvSection(title: string, headers: string[], rows: any[][]): string {
    return `${this.csvEscape(title)}\n${this.toCsv(headers, rows)}`
  }

  // Resume/verification-document links embedded in an export need a much
  // longer signature window than the default (see FILE_URL_TTL_SECONDS,
  // 1 hour) -- an admin generating a CSV today may not open a link in it
  // until days later. 7 days balances that against not signing a URL
  // "forever". Every export link is a point-in-time snapshot: if it's
  // opened after this window, it'll need a fresh export instead.
  private static readonly EXPORT_LINK_TTL_SECONDS = 60 * 60 * 24 * 7

  private signExportUrl(url: string | null | undefined): string {
    if (!url) return ""
    return signFileUrl(url, AdminService.EXPORT_LINK_TTL_SECONDS)
  }

  // Flattening helpers for the Json[]/Json fields on CandidateProfile and
  // Company -- same "join with '; '" approach the original candidates
  // export already used for skills, just extended to the other array/object
  // fields so the CSV stays one row per record instead of exploding into a
  // separate row per sub-item.
  private flattenExperience(experience: any[] | null | undefined): string {
    if (!Array.isArray(experience) || experience.length === 0) return ""
    return experience
      .map((e) => `${e?.jobTitle || "Untitled Role"} @ ${e?.company || "Unknown Company"} (${e?.duration || "duration not specified"})`)
      .join("; ")
  }

  private flattenEducation(education: any[] | null | undefined): string {
    if (!Array.isArray(education) || education.length === 0) return ""
    return education
      .map((e) => `${e?.degree || "Degree"}, ${e?.institution || "Unknown Institution"} (${e?.duration || "duration not specified"})${e?.grade ? ` - ${e.grade}` : ""}`)
      .join("; ")
  }

  private flattenSocialLinks(links: any[] | null | undefined): string {
    if (!Array.isArray(links) || links.length === 0) return ""
    return links.map((l) => `${l?.platform || "Link"}: ${l?.url || ""}`).join("; ")
  }

  private flattenCareerBreak(careerBreak: any | null | undefined): string {
    if (!careerBreak?.hasBreak) return "None"
    const parts = [careerBreak.reason, careerBreak.duration].filter(Boolean).join(", ")
    return careerBreak.summary ? `${parts} - ${careerBreak.summary}` : parts || "Yes"
  }

  // Every field on CandidateProfile that has a real counterpart shown
  // somewhere in the candidate's own profile UI or the admin Candidate
  // Details page -- previously this export only had 7 thin columns
  // (name/email/location/experience/status/skills/joined), nothing like a
  // "complete" record. resumeUrl is explicitly signed here since this CSV
  // is built by hand (bypasses sendSuccess()'s automatic signFileUrlsDeep).
  private async getCandidatesCsvData(): Promise<{ headers: string[]; rows: any[][] }> {
    const rows = await prisma.candidateProfile.findMany({
      include: { user: true, skills: { include: { skill: true } } },
    })
    return {
      headers: [
        "Full Name", "Email", "Phone", "Location", "Title", "Bio",
        "Total Experience", "Notice Period", "Expected Salary", "Availability",
        "Preferred Locations", "Languages", "Skills", "Career Break",
        "Work Experience", "Education", "Social Links", "Resume Link",
        "Account Status", "Joined On",
      ],
      rows: rows.map((c) => [
        c.fullName,
        c.user.email,
        c.phone || "",
        c.location || "",
        c.title || "",
        c.bio || "",
        c.totalExperience || "",
        c.noticePeriod || "",
        c.expectedSalary || "",
        c.availability || "",
        (c.preferredLocations || []).join("; "),
        (c.languages || []).join("; "),
        c.skills.map((s) => s.skill.name).join("; "),
        this.flattenCareerBreak(c.careerBreak),
        this.flattenExperience(c.experience as any[]),
        this.flattenEducation(c.education as any[]),
        this.flattenSocialLinks(c.socialLinks as any[]),
        this.signExportUrl(c.resumeUrl),
        c.user.status,
        c.user.createdAt.toISOString().slice(0, 10),
      ]),
    }
  }

  // Adds phone and the recruiter's company context (website/industry/
  // location) that the old 6-column version left out entirely.
  private async getRecruitersCsvData(): Promise<{ headers: string[]; rows: any[][] }> {
    const rows = await prisma.recruiterProfile.findMany({
      include: { user: true, company: { include: { industry: true } } },
    })
    return {
      headers: [
        "Full Name", "Email", "Phone", "Company", "Company Website",
        "Company Industry", "Company Location", "Company Status", "Verified",
        "Account Status", "Joined On",
      ],
      rows: rows.map((r) => [
        r.fullName,
        r.user.email,
        r.phone || "",
        r.company.name,
        r.company.website || "",
        r.company.industry?.name || "",
        r.company.location || "",
        r.company.status,
        r.verified ? "Yes" : "No",
        r.user.status,
        r.user.createdAt.toISOString().slice(0, 10),
      ]),
    }
  }

  // New export -- there was no per-company CSV at all before this. Signs
  // every verification-document URL the same way the resume link above is
  // signed, so an admin can actually open them from the downloaded file.
  private async getCompaniesCsvData(): Promise<{ headers: string[]; rows: any[][] }> {
    const rows = await prisma.company.findMany({
      include: {
        industry: true,
        recruiters: { include: { user: true } },
        perkRequests: true,
      },
    })

    // Real "total hires" per company -- same computation getCompanies() uses
    // for the admin Company Details screen (Application.status === Hired,
    // grouped by the job's companyId), reused here for consistency rather
    // than reimplementing it slightly differently.
    const hiredApps = await prisma.application.findMany({
      where: { status: ApplicationStatus.Hired, job: { companyId: { in: rows.map((c) => c.id) } } },
      select: { job: { select: { companyId: true } } },
    })
    const hiredCountByCompany: Record<string, number> = {}
    hiredApps.forEach((a) => {
      const cid = a.job.companyId
      hiredCountByCompany[cid] = (hiredCountByCompany[cid] || 0) + 1
    })

    return {
      headers: [
        "Company Name", "Website", "Industry", "Location", "Status",
        "Recruiters", "Hired Count", "Perk Requests", "Verification Documents",
        "Registered On",
      ],
      rows: rows.map((c) => {
        const verificationDocs = Array.isArray(c.verificationDocuments) ? (c.verificationDocuments as any[]) : []
        return [
          c.name,
          c.website || "",
          c.industry?.name || "",
          c.location || "",
          c.status,
          c.recruiters.map((r) => `${r.fullName} <${r.user.email}>`).join("; "),
          hiredCountByCompany[c.id] || 0,
          c.perkRequests.map((p) => `${p.perkName}: ${p.status}`).join("; "),
          verificationDocs.map((d) => `${d.category || "Document"}: ${this.signExportUrl(d.url)}`).join("; "),
          c.createdAt.toISOString().slice(0, 10),
        ]
      }),
    }
  }

  private async getJobsCsvData(): Promise<{ headers: string[]; rows: any[][] }> {
    const rows = await prisma.job.findMany({
      include: { company: true, _count: { select: { applications: true } } },
    })
    return {
      headers: ["Title", "Company", "Location", "Status", "Visibility", "Reported", "Applications", "Posted On"],
      rows: rows.map((j) => [
        j.title,
        j.company.name,
        j.location,
        j.status,
        j.visibility,
        j.reported ? "Yes" : "No",
        j._count.applications,
        j.postedOn.toISOString().slice(0, 10),
      ]),
    }
  }

  async getReports(type: string) {
    const candidatesCount = await prisma.candidateProfile.count()
    const recruitersCount = await prisma.recruiterProfile.count()
    const totalJobs = await prisma.job.count()

    // Real last-6-month Applications vs Hired (Selected) trend, computed
    // from actual Application rows -- previously the "Sourcing & Hires
    // Trends" chart on the frontend rendered a hardcoded 6-entry array
    // (Jan-Jun with fixed numbers) regardless of real platform activity.
    const now = new Date()
    const monthlyTrend: { month: string; applications: number; hired: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const [applications, hired] = await Promise.all([
        prisma.application.count({ where: { appliedOn: { gte: start, lt: end } } }),
        prisma.application.count({
          where: { appliedOn: { gte: start, lt: end }, status: ApplicationStatus.Hired },
        }),
      ])
      monthlyTrend.push({
        month: start.toLocaleString("en-US", { month: "short" }),
        applications,
        hired,
      })
    }

    // Real application-to-interview conversion rate, computed from actual
    // ApplicationStatus counts (previously a hardcoded "24.5%" constant).
    const totalApplications = await prisma.application.count()
    const interviewedOrBeyond = await prisma.application.count({
      where: {
        status: {
          in: [ApplicationStatus.InterviewScheduled, ApplicationStatus.OfferReleased, ApplicationStatus.Hired],
        },
      },
    })
    const applicationToInterviewRate =
      totalApplications > 0 ? Math.round((interviewedOrBeyond / totalApplications) * 1000) / 10 : 0

    const reportData = {
      reportType: type,
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: candidatesCount + recruitersCount,
        candidatesCount,
        recruitersCount,
        totalJobs,
      },
      monthlyTrend,
      applicationToInterviewRate,
    }

    let csvContent: string
    let filename: string

    if (type === "candidates") {
      const { headers, rows } = await this.getCandidatesCsvData()
      csvContent = this.toCsv(headers, rows)
      filename = "Candidates_Directory_Report.csv"
    } else if (type === "recruiters") {
      const { headers, rows } = await this.getRecruitersCsvData()
      csvContent = this.toCsv(headers, rows)
      filename = "Recruiters_Partner_Report.csv"
    } else if (type === "companies") {
      const { headers, rows } = await this.getCompaniesCsvData()
      csvContent = this.toCsv(headers, rows)
      filename = "Companies_Directory_Report.csv"
    } else if (type === "jobs") {
      const { headers, rows } = await this.getJobsCsvData()
      csvContent = this.toCsv(headers, rows)
      filename = "JobListings_Platform_Report.csv"
    } else if (type === "all") {
      // One combined export bundling every entity type into a single file,
      // each as its own labeled section (see toCsvSection) since the
      // column shapes are all different. Point-in-time snapshot, same as
      // the individual exports -- resume/document links inside carry the
      // same 7-day signature window as the standalone candidate/company
      // exports.
      const [candidatesData, recruitersData, companiesData, jobsData] = await Promise.all([
        this.getCandidatesCsvData(),
        this.getRecruitersCsvData(),
        this.getCompaniesCsvData(),
        this.getJobsCsvData(),
      ])
      csvContent = [
        this.toCsvSection("=== CANDIDATES ===", candidatesData.headers, candidatesData.rows),
        this.toCsvSection("=== RECRUITERS ===", recruitersData.headers, recruitersData.rows),
        this.toCsvSection("=== COMPANIES ===", companiesData.headers, companiesData.rows),
        this.toCsvSection("=== JOBS ===", jobsData.headers, jobsData.rows),
      ].join("\n\n")
      filename = "JobsForWomen_Complete_Data_Export.csv"
    } else {
      csvContent = this.toCsv(
        ["Report Type", "Generated At", "Total Candidates", "Total Recruiters", "Total Jobs", "Application-to-Interview Rate %"],
        [[type, reportData.generatedAt, candidatesCount, recruitersCount, totalJobs, applicationToInterviewRate]]
      )
      filename = "JobsForWomen_System_Analytics.csv"
    }

    const base64Buffer = Buffer.from(csvContent).toString("base64")

    return {
      reportData,
      exportFile: {
        mimetype: "text/csv",
        filename,
        content: base64Buffer,
      },
    }
  }

  // ==========================================
  // AUDIT LOG INSPECTOR
  // ==========================================
  // Real Prisma pagination plus free-text search and a date-range filter.
  // `uiCategory` maps the Activity Logs page's five tabs (User Management /
  // Job Moderation / Corporate Perks / Feature Flags / Security Settings)
  // to real filters here, so the frontend gets a fully paginated query per
  // tab instead of filtering a fixed fetched page client-side.
  async getAuditLogs(filters: {
    page: number
    limit: number
    search?: string
    action?: string
    category?: string
    entity?: string
    uiCategory?: string
    operatorId?: string
    startDate?: Date
    endDate?: Date
  }) {
    const page = filters.page || 1
    const limit = filters.limit || 50
    const skip = (page - 1) * limit

    const and: any[] = []

    if (filters.category) and.push({ category: filters.category })
    if (filters.action) and.push({ action: { contains: filters.action, mode: "insensitive" } })
    if (filters.entity) and.push({ entity: filters.entity })
    if (filters.operatorId) and.push({ operatorId: filters.operatorId })

    if (filters.startDate || filters.endDate) {
      const timestampRange: any = {}
      if (filters.startDate) timestampRange.gte = filters.startDate
      if (filters.endDate) timestampRange.lte = filters.endDate
      and.push({ timestamp: timestampRange })
    }

    // Mirrors the tab labels the Activity Logs page has always shown. Kept
    // in one place (here) instead of duplicated in the frontend so the tab
    // an admin clicks and the rows the backend returns can never disagree.
    if (filters.uiCategory) {
      switch (filters.uiCategory) {
        case "Job Moderation":
          and.push({ entity: "Job" })
          break
        case "Corporate Perks":
          and.push({ entity: "Company" })
          break
        case "Feature Flags":
          and.push({ entity: "FeatureFlag" })
          break
        case "Security Settings":
          // Extended to also capture SecurityPolicy changes (e.g. the
          // Inactivity Session Timeout) alongside RBAC role/permission
          // changes -- both are "Security Settings" in the sense this tab
          // has always meant.
          and.push({ OR: [{ entity: "Role" }, { category: "RBAC" }, { entity: "SecurityPolicy" }, { category: "SECURITY" }] })
          break
        case "User Management":
          and.push({
            AND: [
              { entity: { notIn: ["Job", "Company", "FeatureFlag", "Role"] } },
              { category: { not: "RBAC" } },
            ],
          })
          break
      }
    }

    if (filters.search) {
      and.push({
        OR: [
          { action: { contains: filters.search, mode: "insensitive" } },
          { operatorEmail: { contains: filters.search, mode: "insensitive" } },
          { ipAddress: { contains: filters.search, mode: "insensitive" } },
          { entity: { contains: filters.search, mode: "insensitive" } },
        ],
      })
    }

    const where = and.length > 0 ? { AND: and } : {}

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      auditLogs: logs,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        totalItems: totalCount,
        limit,
      },
    }
  }

  // Full, unfiltered CSV export of the ENTIRE audit trail (every AuditLog
  // row, no pagination/date-range/category filtering) -- the "Export" button
  // on Platform Activity Logs. Reuses the same toCsv/csvEscape helpers as
  // the Reports & Analytics exports above. Records an export receipt for
  // this admin (see shared/utils/auditExportReceipt.ts) -- deleteAllAuditLogs
  // below refuses to run without one, so a purge can never happen without a
  // real export having just occurred, enforced server-side rather than just
  // trusted from the frontend's own export-then-delete sequencing.
  async exportAuditLogsCsv(adminId: string) {
    const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" } })

    const headers = [
      "Timestamp",
      "Operator Email",
      "Operator ID",
      "Category",
      "Action",
      "Entity",
      "Entity ID",
      "IP Address",
      "Browser",
      "Device",
      "Old Value",
      "New Value",
    ]
    const rows = logs.map((l) => [
      l.timestamp.toISOString(),
      l.operatorEmail || "",
      l.operatorId || "",
      l.category,
      l.action,
      l.entity || "",
      l.entityId || "",
      l.ipAddress || "",
      l.browser || "",
      l.device || "",
      l.oldValue ? JSON.stringify(l.oldValue) : "",
      l.newValue ? JSON.stringify(l.newValue) : "",
    ])
    const csvContent = this.toCsv(headers, rows)
    const filename = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`

    await recordAuditExportReceipt(adminId)

    return {
      mimetype: "text/csv",
      filename,
      content: Buffer.from(csvContent, "utf-8").toString("base64"),
    }
  }

  // Destructive -- wipes the ENTIRE audit trail. Super-Admin-only (see
  // admin.routes.ts). Refuses to run unless this exact admin holds a recent
  // export receipt (see shared/utils/auditExportReceipt.ts) -- previously
  // this was only guaranteed by ActivityLogs.tsx's own client-side sequencing
  // (auto-export before calling delete if the admin hadn't already), which a
  // request crafted directly against this endpoint could simply skip. The
  // receipt is single-use (cleared on success below), so a second delete
  // right after can't ride the same export. One new AuditLog row is written
  // immediately after the purge, recording who did it and how many rows
  // were removed -- otherwise a purge would be the one action in this
  // entire audit system that leaves no trace of itself.
  async deleteAllAuditLogs(adminId: string, context?: ServiceContext) {
    const hasReceipt = await hasRecentAuditExportReceipt(adminId)
    if (!hasReceipt) {
      throw new AppError(
        "Export the activity log before deleting it -- no recent export was found for your account. Click \"Export CSV\", then try again.",
        409
      )
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const result = await prisma.auditLog.deleteMany({})
    await clearAuditExportReceipt(adminId)

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "PURGE_AUDIT_LOGS",
      entity: "AuditLog",
      newValue: { deletedCount: result.count },
    })

    return { deletedCount: result.count }
  }

  // ==========================================
  // ROLE AND PERMISSION CRUD OPERATIONS
  // ==========================================
  // getRBACData/createRole/updateRole/deleteRole used to live here,
  // duplicating rbac.service.ts's RbacService with weaker guards in
  // deleteRole's case (no protection against deleting a built-in system
  // role or one still assigned to users). RolesPermissions.tsx and
  // AdminManagement.tsx now call /api/v1/rbac/* (RbacService) directly for
  // all of this, so this copy is removed rather than kept as unused dead
  // code that could silently regain the weaker guards if ever re-wired.
  //
  // NOTE: role assignment for POST /users/:id/roles is, for the same
  // reason, also handled by RbacService.assignRolesToUser exclusively now
  // (see rbac.routes.ts) rather than a second AdminService implementation.

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
      // "admin" is used as a UI category covering every administrative-tier
      // role, not a literal role name. An exact case-insensitive match on
      // "Admin" alone would silently exclude "Super Admin", "Moderator", and
      // "Support Executive" accounts -- including the seeded default admin
      // account, which is created with the "Super Admin" role. That made the
      // Admin Moderation tab return zero rows out of the box.
      const roleNameFilter =
        role.toLowerCase() === "admin"
          ? { in: ["Admin", "Super Admin", "Moderator", "Support Executive"] }
          : { equals: role, mode: "insensitive" as const }

      whereClause.roles = {
        some: {
          role: {
            name: roleNameFilter
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
    // A bare .update() on a recruiterProfileId that no longer exists -- e.g. the
    // admin's recruiter list was stale and that recruiter's account was
    // deleted in another tab/session in the meantime -- throws Prisma's
    // P2025, which errorHandler.ts already maps to a clean 404. This
    // existence check isn't fixing a broken response code; it's just
    // producing a clearer, domain-specific message than the generic
    // "requested record was not found" for this specific action.
    const existing = await prisma.recruiterProfile.findUnique({ where: { id: recruiterProfileId } })
    if (!existing) {
      throw new AppError("This recruiter account no longer exists (it may have already been deleted).", 404)
    }

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

  // ==========================================
  // SUPER ADMIN: ADMIN MANAGEMENT MODULE
  // ==========================================
  // Every method below is reached only through routes gated by
  // requireSuperAdmin (admin.routes.ts) -- operatorRoles is still threaded
  // through and re-checked here anyway as defense in depth, mirroring the
  // same pattern already used in updateUserStatus/deleteUser above, so a
  // future route-wiring mistake can't silently turn into a privilege
  // escalation path.
  private static readonly ADMIN_TIER_ROLES = ["Admin", "Super Admin", "Moderator", "Support Executive"]

  async createAdmin(
    operatorId: string,
    data: { email: string; fullName: string; password: string; roleNames: string[] },
    context?: ServiceContext,
    operatorRoles: string[] = []
  ) {
    if (!operatorRoles.includes("Super Admin")) {
      throw new Error("Only a Super Admin can create administrator accounts.")
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      throw new AppError("An account with this email address already exists.", 409)
    }

    const uniqueRoleNames = Array.from(new Set(data.roleNames))
    const roles = await prisma.role.findMany({ where: { name: { in: uniqueRoleNames } } })
    if (roles.length !== uniqueRoleNames.length) {
      const found = new Set(roles.map((r) => r.name))
      const missing = uniqueRoleNames.filter((r) => !found.has(r))
      throw new AppError(`Unknown role(s): ${missing.join(", ")}`, 400)
    }

    // A new admin is always granted at least one admin-tier role by
    // definition of this endpoint -- reject attempts to create an "admin"
    // whose roles are actually just Candidate/Recruiter (that's what
    // registration is for).
    if (!roles.some((r) => AdminService.ADMIN_TIER_ROLES.includes(r.name))) {
      throw new AppError("An administrator account must be granted at least one admin-tier role.", 400)
    }

    const passwordHash = await hashPassword(data.password)
    const operator = await prisma.user.findUnique({ where: { id: operatorId } })

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          // Admin-created accounts skip the email-verification / company
          // -approval gates that candidate/recruiter self-registration goes
          // through -- a Super Admin vouching for the account IS the
          // approval step.
          status: UserStatus.Active,
          adminProfile: { create: { fullName: data.fullName } },
          roles: { createMany: { data: roles.map((r) => ({ roleId: r.id })) } },
        },
        include: { roles: { include: { role: true } }, adminProfile: true },
      })
      return user
    })

    const roleNames = created.roles.map((r) => r.role.name)

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId,
      operatorEmail: operator?.email,
      category: "ADMIN",
      action: "CREATE_ADMIN",
      entity: "User",
      entityId: created.id,
      newValue: { email: created.email, fullName: data.fullName, roleNames },
    })

    // Notification.listener.ts subscribes to this to welcome the new admin
    // in-app (Admin Management spec's "Notifications: on account created").
    // email.listener.ts also subscribes to this same event to send the new
    // admin their login credentials -- this account has no self-serve
    // "set your own password" step (unlike inviteEmployee's token flow), so
    // the plaintext password is included here deliberately: it's the only
    // way this admin ever learns it. It exists only transiently in the
    // in-process EventBus payload and the resulting BullMQ job until the
    // email send completes, never written to the database or logged.
    EventBus.publish("AdminAccountCreated", {
      userId: created.id,
      email: created.email,
      fullName: data.fullName,
      password: data.password,
      roleNames,
      context,
    })

    return {
      id: created.id,
      email: created.email,
      fullName: data.fullName,
      status: created.status,
      roles: roleNames,
      createdAt: created.createdAt,
    }
  }

  async listAdmins(filters: { search?: string; status?: UserStatus; role?: string }) {
    const roleFilter =
      filters.role && filters.role !== "all"
        ? { in: [filters.role] }
        : { in: AdminService.ADMIN_TIER_ROLES }

    const where: any = {
      roles: { some: { role: { name: roleFilter } } },
    }
    if (filters.status) {
      where.status = filters.status
    }
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: "insensitive" } },
        { adminProfile: { fullName: { contains: filters.search, mode: "insensitive" } } },
      ]
    }

    const admins = await prisma.user.findMany({
      where,
      include: {
        adminProfile: true,
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    if (admins.length === 0) {
      return []
    }

    const adminIds = admins.map((a) => a.id)

    // Derive "Last Login" from the existing AUTH/USER_LOGIN audit trail
    // (see notification.listener.ts's UserLoggedIn subscription) instead of
    // adding a new lastLoginAt column -- avoids a schema migration for a
    // value the audit log already durably tracks.
    const lastLogins = await prisma.auditLog.groupBy({
      by: ["operatorId"],
      where: { operatorId: { in: adminIds }, action: "USER_LOGIN" },
      _max: { timestamp: true },
    })
    const lastLoginById: Record<string, Date | null> = {}
    lastLogins.forEach((l) => {
      if (l.operatorId) lastLoginById[l.operatorId] = l._max.timestamp
    })

    // Derive "Created By" the same way -- the CREATE_ADMIN audit entry this
    // service's createAdmin() writes above carries the operator's email
    // directly. Accounts that predate this module (seeded, or onboarded via
    // the older Employee Invitation flow) won't have one; fall back to the
    // Invitation record's inviter, then finally "System".
    const createLogs = await prisma.auditLog.findMany({
      where: { action: "CREATE_ADMIN", entityId: { in: adminIds } },
      select: { entityId: true, operatorEmail: true },
    })
    const createdByById: Record<string, string> = {}
    createLogs.forEach((l) => {
      if (l.entityId) createdByById[l.entityId] = l.operatorEmail || "System"
    })

    const missingCreatedByEmails = admins.filter((a) => !createdByById[a.id]).map((a) => a.email)
    if (missingCreatedByEmails.length > 0) {
      const invitations = await prisma.invitation.findMany({
        where: { email: { in: missingCreatedByEmails }, acceptedAt: { not: null } },
        include: { invitedBy: { select: { email: true } } },
      })
      invitations.forEach((inv) => {
        const admin = admins.find((a) => a.email === inv.email)
        if (admin && !createdByById[admin.id]) {
          createdByById[admin.id] = inv.invitedBy?.email || "System"
        }
      })
    }

    return admins.map((a) => ({
      id: a.id,
      email: a.email,
      fullName: a.adminProfile?.fullName || "",
      roles: a.roles.map((r) => r.role.name),
      status: a.status,
      lastLoginAt: lastLoginById[a.id] || null,
      createdBy: createdByById[a.id] || "System",
      createdAt: a.createdAt,
    }))
  }

  async removeAdminRole(
    operatorId: string,
    targetUserId: string,
    roleName: string,
    operatorRoles: string[] = [],
    context?: ServiceContext
  ) {
    if (!operatorRoles.includes("Super Admin")) {
      throw new Error("Only a Super Admin can remove a role from an administrator account.")
    }

    const operator = await prisma.user.findUnique({ where: { id: operatorId } })
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roles: { include: { role: true } } },
    })
    if (!target) {
      throw new AppError("Target admin account not found.", 404)
    }

    const currentRoleNames = target.roles.map((r) => r.role.name)
    if (!currentRoleNames.includes(roleName)) {
      throw new AppError(`This account does not have the "${roleName}" role.`, 400)
    }

    if (currentRoleNames.length === 1) {
      throw new AppError(
        "Cannot remove the only role this account has. Assign a replacement role first.",
        400
      )
    }

    if (roleName === "Super Admin") {
      const otherSuperAdmins = await prisma.userRole.count({
        where: { userId: { not: targetUserId }, role: { name: "Super Admin" } },
      })
      if (otherSuperAdmins === 0) {
        // 409, not 400 -- this is a genuine conflict with current platform
        // state (would leave zero Super Admins), not a malformed request,
        // matching the same guard's status code in rbac.service.ts's
        // assignRolesToUser and the errorHandler.ts text-based mapping for
        // the equivalent plain-Error guards elsewhere in this file.
        throw new AppError("Cannot remove the Super Admin role from the last remaining Super Admin.", 409)
      }
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } })
    if (!role) {
      throw new AppError(`Role "${roleName}" does not exist.`, 404)
    }

    await prisma.userRole.deleteMany({ where: { userId: targetUserId, roleId: role.id } })
    await PermissionCacheManager.invalidateUser(targetUserId)

    const nextRoleNames = currentRoleNames.filter((r) => r !== roleName)

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId,
      operatorEmail: operator?.email,
      category: "ADMIN",
      action: "REMOVE_USER_ROLE",
      entity: "User",
      entityId: targetUserId,
      oldValue: { roleNames: currentRoleNames },
      newValue: { roleNames: nextRoleNames },
    })

    EventBus.publish("RoleAssigned", {
      userId: targetUserId,
      userEmail: target.email,
      roleNames: nextRoleNames,
      previousRoleNames: currentRoleNames,
      context,
    })

    return { success: true, roles: nextRoleNames }
  }

  // Real profile fields, not the generic preferences blob -- name comes
  // from AdminProfile.fullName (what Navbar, audit logs, and every email
  // template actually display), email from the real User.email (read-only
  // here; see updateAdminSettings for why). preferences is still returned
  // for forward-compatibility with any future appearance/notification
  // settings, but nothing in the current UI reads or writes it.
  async getAdminSettings(adminId: string) {
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      include: { adminProfile: true },
    })
    if (!user) {
      throw new Error("Admin account not found")
    }
    return {
      name: user.adminProfile?.fullName || "",
      email: user.email,
      preferences: user.preferences || {},
    }
  }

  async updateAdminSettings(adminId: string, data: { name?: string }, context?: ServiceContext) {
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      include: { adminProfile: true },
    })
    if (!user) {
      throw new Error("Admin account not found")
    }

    const oldName = user.adminProfile?.fullName || ""

    // Previously this wrote whatever the frontend sent into User.preferences
    // (a generic JSON blob meant for appearance/privacy/notification
    // settings, per the schema comment) -- so "Save Admin Profile" appeared
    // to succeed but never actually renamed the admin anywhere real. This
    // now updates the actual AdminProfile.fullName column, the same one
    // Navbar's greeting, audit log entries, and every admin-tier email
    // template already read from.
    if (typeof data.name === "string" && data.name.trim().length > 0 && data.name.trim() !== oldName) {
      await prisma.adminProfile.upsert({
        where: { userId: adminId },
        update: { fullName: data.name.trim() },
        // Defensive fallback -- every admin creation path (seed, Admin
        // Management, invitation acceptance) already creates an
        // AdminProfile row alongside the User, so this create branch should
        // never actually run in practice.
        create: { userId: adminId, fullName: data.name.trim() },
      })

      EventBus.publish("AuditCreated", {
        ...context,
        operatorId: adminId,
        category: "ADMIN",
        action: "UPDATE_SETTINGS",
        entity: "User",
        entityId: adminId,
        oldValue: { name: oldName },
        newValue: { name: data.name.trim() },
      })
    }

    return this.getAdminSettings(adminId)
  }

  // Platform-wide "Inactivity Session Timeout" policy (SecurityPolicy
  // singleton row) -- readable by any admin-tier role, only writable by a
  // Super Admin (see admin.routes.ts). Actually enforced in
  // sessionTimeout.middleware.ts, not just displayed for visibility like the
  // old disabled dropdown was.
  async getSecuritySettings() {
    const policy = await prisma.securityPolicy.findUnique({ where: { id: "singleton" } })
    return {
      adminSessionTimeoutMinutes: policy?.adminSessionTimeoutMinutes ?? null,
      forceTwoFactorForAdmins: policy?.forceTwoFactorForAdmins ?? false,
    }
  }

  async updateSecuritySettings(
    adminId: string,
    data: { adminSessionTimeoutMinutes?: number | null; forceTwoFactorForAdmins?: boolean },
    context?: ServiceContext
  ) {
    const previous = await this.getSecuritySettings()

    const updateData: { adminSessionTimeoutMinutes?: number | null; forceTwoFactorForAdmins?: boolean; updatedById: string } = {
      updatedById: adminId,
    }
    if (data.adminSessionTimeoutMinutes !== undefined) {
      updateData.adminSessionTimeoutMinutes = data.adminSessionTimeoutMinutes
    }
    if (data.forceTwoFactorForAdmins !== undefined) {
      updateData.forceTwoFactorForAdmins = data.forceTwoFactorForAdmins
    }

    await prisma.securityPolicy.upsert({
      where: { id: "singleton" },
      update: updateData,
      create: {
        id: "singleton",
        adminSessionTimeoutMinutes: data.adminSessionTimeoutMinutes ?? null,
        forceTwoFactorForAdmins: data.forceTwoFactorForAdmins ?? false,
        updatedById: adminId,
      },
    })

    // Middleware caches the configured values in Redis for up to a minute --
    // invalidate immediately so a Super Admin's change is felt right away
    // rather than on the next cache expiry.
    await invalidateSecurityPolicyCache()

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      category: "SECURITY",
      action: "UPDATE_SECURITY_SETTINGS",
      entity: "SecurityPolicy",
      entityId: "singleton",
      oldValue: previous,
      newValue: { ...previous, ...data },
    })

    return this.getSecuritySettings()
  }

  // General, non-security platform settings (PlatformSettings singleton row).
  // Currently just the "Operations Support Contacts" technical helpdesk
  // email on the admin Help & Support page -- previously hardcoded straight
  // into HelpSupport.tsx's JSX with no way to change it without a code
  // deploy. Readable by any admin-tier role, writable by Admin/Super Admin
  // (see admin.routes.ts) -- deliberately not Super-Admin-only like
  // SecurityPolicy, since this isn't a security control.
  async getPlatformSettings() {
    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } })
    return {
      // Falls back to the same address transactional emails already use
      // (env.SUPPORT_EMAIL, then SES_FROM) so the card never renders empty
      // before any admin has touched this setting.
      supportContactEmail: settings?.supportContactEmail || env.SUPPORT_EMAIL || env.SES_FROM || "",
    }
  }

  async updatePlatformSettings(
    adminId: string,
    data: { supportContactEmail: string },
    context?: ServiceContext
  ) {
    const previous = await this.getPlatformSettings()

    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: { supportContactEmail: data.supportContactEmail, updatedById: adminId },
      create: { id: "singleton", supportContactEmail: data.supportContactEmail, updatedById: adminId },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      category: "ADMIN",
      action: "UPDATE_PLATFORM_SETTINGS",
      entity: "PlatformSettings",
      entityId: "singleton",
      oldValue: previous,
      newValue: data,
    })

    return this.getPlatformSettings()
  }

  async getAdminNotifications(adminId: string) {
    return prisma.notification.findMany({
      where: { recipientId: adminId },
      orderBy: { createdAt: "desc" }
    })
  }

  // NOTE: "Report Platform Issue" ticket submission moved to its own module
  // (see support.service.ts / /api/v1/support-tickets) so Candidate and
  // Recruiter portals can file tickets too, not just admin-tier users. The
  // old admin-only, DB-less, email-fire-and-forget version that used to live
  // here has been removed -- every submitted ticket is now a real,
  // queryable SupportTicket row.
}

export default AdminService
