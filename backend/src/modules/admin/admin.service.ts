import prisma from "../../shared/database/db"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { PermissionCacheManager } from "../../shared/utils/permissionCache"
import { CompanyStatus, JobStatus, ApplicationStatus, UserStatus, JobVisibility, PerkStatus } from "@prisma/client"
import crypto from "crypto"
import redis from "../../shared/utils/redis"
import { verifyEmailTransport, EmailService } from "../../shared/utils/email"
import env from "../../shared/config/env"
import { verifyCloudinaryConnection, runOrphanAssetCleanup, deleteFromCloudinary } from "../../shared/utils/cloudinary"
import { normalizeDocuments } from "../../shared/utils/documents"
import { io as socketIo } from "../../shared/socket/socket"
import { createAuditLog } from "../../shared/utils/audit"
import { invalidateFeatureFlagCache } from "../../shared/utils/featureFlags"
import { queueMetrics, getDeadLetterQueueStats } from "../../shared/queue/queue"
import { socketMetrics } from "../../shared/socket/socket"
import { cloudinaryMetrics } from "../../shared/utils/cloudinary"
import { emailMetrics } from "../../shared/utils/email"

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

    // Real email-transport check (Resend HTTPS API -- see verifyEmailTransport()
    // in shared/utils/email.ts; env var names RESEND_API_KEY/SMTP_PASS/SMTP_FROM
    // are kept from the pre-migration SMTP config for backward compatibility,
    // but no SMTP protocol connection is made anywhere in this codebase)
    let emailStatus = "DOWN"
    try {
      emailStatus = (await verifyEmailTransport()) ? "UP" : "DOWN"
    } catch (err) {
      emailStatus = "DOWN"
    }

    // Real Cloudinary check
    let storageStatus = "DOWN"
    try {
      storageStatus = (await verifyCloudinaryConnection()) ? "UP" : "DOWN"
    } catch (err) {
      storageStatus = "DOWN"
    }

    // Socket.IO is in-process: "UP" means the server actually initialized the
    // io instance (initSocket() ran during boot), not just an assumption.
    const socketStatus = socketIo ? "UP" : "DOWN"

    // Final Implementation Pass, Part 7: real dead-letter queue depth.
    // Previously there was no DLQ at all (see queue.ts) -- this reads the
    // actual pending count off the real BullMQ dead-letter queue.
    const deadLetterStats = await getDeadLetterQueueStats()

    // CONFIRMED GAP (fixed here): the raw top-level GET /health endpoint
    // (app.ts) already exposed real BullMQ queue counts, real connected
    // Socket.IO counts, and real Cloudinary/email delivery metrics -- but
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
        messagesSec: socketMetrics.messagesSec,
        notificationsSec: socketMetrics.notificationsSec,
      },
      emailDelivery: {
        sent: emailMetrics.sent,
        failed: emailMetrics.failed,
      },
      storageMetrics: {
        uploadCount: cloudinaryMetrics.uploadCount,
        deleteCount: cloudinaryMetrics.deleteCount,
        averageLatencyMs: Math.round(cloudinaryMetrics.averageLatencyMs),
        retryCount: cloudinaryMetrics.retryCount,
      },
      // Final Implementation Pass, Part 8: metric semantics.
      //
      // CONFIRMED GAP (fixed here): every numeric field above was presented
      // to the frontend with no indication of what kind of number it is.
      // That matters because most of them (queueMetrics, emailMetrics,
      // cloudinaryMetrics -- all plain in-memory objects, see their
      // respective modules) silently reset to zero on every server
      // restart/redeploy. An admin glancing at "Failed Jobs: 0" right after
      // a deploy could easily read that as "nothing has ever failed" when
      // it actually means "nothing has failed *since this process booted a
      // minute ago*". Explicitly classifying each field lets the frontend
      // label them honestly instead of presenting all numbers as equally
      // durable.
      //
      //   CURRENT_STATE            -- reflects live, queryable truth right
      //                                now (a fresh check/read on every
      //                                call); either isn't a counter at all,
      //                                or (deadLetterPendingCount) is a real
      //                                count against Redis-durable BullMQ
      //                                state that survives a restart.
      //   PROCESS_LIFETIME_COUNTER -- an in-memory counter that resets to 0
      //                                on every server restart/redeploy; a
      //                                real accumulation, but only since
      //                                this process last started (see
      //                                processStartedAt below), not an
      //                                all-time total.
      //   PERSISTENT_HISTORICAL_METRIC -- would be a running total backed by
      //                                a database/persistent store that
      //                                survives restarts. None of the
      //                                current System Health numbers are
      //                                backed this way -- this category
      //                                exists in the classification so that
      //                                gap is explicit rather than silently
      //                                implied to already be covered.
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
          "sockets.messagesSec",
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

  // Read-only orphan storage asset dry run (Cloudinary vs DB cross-reference).
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

    // NOTE: this used to call `await this.getSystemHealth()` here and embed
    // the result as `systemHealthSummary` below. That method makes real,
    // uncached network calls on every invocation (verifyEmailTransport()'s
    // Resend config check, a live Cloudinary ping) with no timeout. If either of those hosts is
    // slow or unreachable, the awaited call never settles, so this entire
    // getDashboard() promise never resolves -- the Express response is never
    // sent, and the frontend's Promise.all() for the dashboard hangs forever
    // (its `finally` never runs because the awaited promise never settles).
    // The frontend Dashboard page has never actually read
    // `systemHealthSummary` from this response (confirmed: no reference to
    // it anywhere in Dashboard.tsx), and there is now a dedicated real
    // GET /api/v1/admins/health endpoint + admin System Health page for this
    // data, so it's removed from the dashboard's critical path entirely.

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

  // Permanent user deletion (User Moderation page). Relies on the same
  // cascade-delete design already used by auth.service.ts's self-service
  // deleteOwnAccount(): every relation a User owns in schema.prisma
  // (CandidateProfile/RecruiterProfile and everything hanging off them --
  // applications, saved jobs, notifications, sessions, refresh tokens,
  // conversations) is declared `onDelete: Cascade`, so a single
  // `prisma.user.delete()` genuinely removes all of it, not just the User
  // row. The one thing Prisma's cascade can't reach is the actual resume
  // file sitting in Cloudinary (only the DB pointer to it), so that's
  // cleaned up explicitly first, best-effort, the same way
  // deleteCompanyLogo() already does for company logos.
  async deleteUser(adminId: string, targetUserId: string, context?: ServiceContext) {
    if (adminId === targetUserId) {
      throw new Error("You cannot delete your own account from this screen.")
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        roles: { include: { role: true } },
        candidateProfile: true,
      },
    })

    if (!target) {
      throw new Error("Target user account not found")
    }

    const targetRoleNames: string[] = (target.roles || []).map((r: any) => r.role?.name).filter(Boolean)
    if (targetRoleNames.includes("Super Admin")) {
      throw new Error("Super Admin accounts cannot be deleted from this screen.")
    }

    const resumePublicId = target.candidateProfile?.resumePublicId
    if (resumePublicId) {
      try {
        await deleteFromCloudinary(resumePublicId, true)
      } catch (err: any) {
        logger.warn(`[Cloudinary] Failed to delete resume asset for deleted user ${targetUserId}: ${err.message}`)
      }
    }

    await prisma.user.delete({ where: { id: targetUserId } })

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
      oldValue: { email: target.email, roles: targetRoleNames, status: target.status },
    })

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
    invalidateFeatureFlagCache(flag.key)

    // Previously this reused the same "FeatureFlagUpdated" event name that
    // candidate.service.ts publishes for candidate settings changes. Both
    // publishers used the same {userId, settings} shape, so the shared
    // listener (which is hardcoded to log candidate settings updates) never
    // errored -- it just silently mislabeled every admin feature-flag
    // create/update as category "CANDIDATE" / action "UPDATE_SETTINGS" /
    // entity "User" in the audit log. That's also why the admin Activity
    // Logs page's "Feature Flags" filter tab always came back empty: no
    // audit row was ever actually tagged as a feature-flag change.
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
  // CONFIRMED BUG (fixed here): the CSV export always produced the exact
  // same 4-column summary row (candidate/recruiter/job totals) no matter
  // which of the 4 report cards was clicked on the Reports & Analytics
  // page -- "Candidates Directory", "Employers & Recruiters", and "Job
  // Listings Audit" all promise a real per-record directory in their UI
  // description, but `type` was only ever used to label the filename. This
  // now generates a real row-per-record CSV for candidates/recruiters/jobs,
  // and keeps the aggregate summary only for the "analytics" card.
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
      const rows = await prisma.candidateProfile.findMany({
        include: { user: true, skills: { include: { skill: true } } },
      })
      csvContent = this.toCsv(
        ["Full Name", "Email", "Location", "Total Experience", "Account Status", "Skills", "Joined On"],
        rows.map((c) => [
          c.fullName,
          c.user.email,
          c.location || "",
          c.totalExperience || "",
          c.user.status,
          c.skills.map((s) => s.skill.name).join("; "),
          c.user.createdAt.toISOString().slice(0, 10),
        ])
      )
      filename = "Candidates_Directory_Report.csv"
    } else if (type === "recruiters") {
      const rows = await prisma.recruiterProfile.findMany({
        include: { user: true, company: true },
      })
      csvContent = this.toCsv(
        ["Full Name", "Email", "Company", "Company Status", "Verified", "Account Status"],
        rows.map((r) => [r.fullName, r.user.email, r.company.name, r.company.status, r.verified ? "Yes" : "No", r.user.status])
      )
      filename = "Recruiters_Partner_Report.csv"
    } else if (type === "jobs") {
      const rows = await prisma.job.findMany({
        include: { company: true, _count: { select: { applications: true } } },
      })
      csvContent = this.toCsv(
        ["Title", "Company", "Location", "Status", "Visibility", "Reported", "Applications", "Posted On"],
        rows.map((j) => [
          j.title,
          j.company.name,
          j.location,
          j.status,
          j.visibility,
          j.reported ? "Yes" : "No",
          j._count.applications,
          j.postedOn.toISOString().slice(0, 10),
        ])
      )
      filename = "JobListings_Platform_Report.csv"
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
  // CONFIRMED BUG (fixed here, Final Implementation Pass Part 2): this
  // already had real Prisma pagination (skip/take/count), which the prior
  // audit pass didn't need to touch -- but it only supported exact-match
  // `category`/`action`/`operatorEmail`/`entity` filters. The Activity Logs
  // UI's five category tabs (User Management / Job Moderation / Corporate
  // Perks / Feature Flags / Security Settings) were being re-derived from
  // `entity`/`category` in the browser AFTER fetching a fixed page of up to
  // 500 rows, and there was no free-text search or date-range filter at all
  // server-side -- so every filter the UI offered only ever operated on
  // whatever happened to be in that one fetched page, not the real table.
  // `uiCategory` now performs that same tab-to-filter mapping once, here, so
  // the frontend can ask for a tab directly and get a real, fully paginated
  // Prisma query back for it.
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
          and.push({ OR: [{ entity: "Role" }, { category: "RBAC" }] })
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

  // Roles the platform's own authorization model depends on -- deleting any
  // of these would break RBAC checks or the invitation/onboarding flows that
  // assume they exist. Never deletable through the admin UI.
  private static readonly SYSTEM_ROLES = ["Candidate", "Recruiter", "Moderator", "Admin", "Super Admin", "Support Executive"]

  async deleteRole(adminId: string, roleId: string, context?: ServiceContext) {
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      throw new Error("Role not found")
    }

    if (AdminService.SYSTEM_ROLES.includes(role.name)) {
      throw new Error(`Cannot delete built-in system role "${role.name}". It is required for the platform's core authorization model.`)
    }

    // Guard against accidental lockout: refuse to delete a role that is
    // still actively assigned to users -- force an explicit reassignment first.
    const assignedCount = await prisma.userRole.count({ where: { roleId } })
    if (assignedCount > 0) {
      throw new Error(`Cannot delete role "${role.name}": it is currently assigned to ${assignedCount} user(s). Reassign or remove those role assignments first.`)
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } })

    await prisma.role.delete({ where: { id: roleId } })
    await PermissionCacheManager.invalidateAll()

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      operatorEmail: admin?.email,
      category: "ADMIN",
      action: "DELETE_ROLE",
      entity: "Role",
      entityId: roleId,
      oldValue: { name: role.name },
    })

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

  async updateAdminSettings(adminId: string, preferences: any, context?: ServiceContext) {
    const updated = await prisma.user.update({
      where: { id: adminId },
      data: { preferences },
      select: { preferences: true }
    })

    // Part 14 audit-completeness fix: the recruiter and candidate
    // equivalents of "save my own settings" are both audited
    // (UPDATE_SETTINGS / UPDATE_FEATURE_FLAG respectively) -- this admin
    // one previously wasn't, despite admin preferences including things
    // like notification routing that are worth being able to trace.
    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: adminId,
      category: "ADMIN",
      action: "UPDATE_SETTINGS",
      entity: "User",
      entityId: adminId,
      newValue: preferences,
    })

    return updated.preferences
  }

  async getAdminNotifications(adminId: string) {
    return prisma.notification.findMany({
      where: { recipientId: adminId },
      orderBy: { createdAt: "desc" }
    })
  }

  // ==========================================
  // SUPPORT TICKET SUBMISSION
  // ==========================================
  // Sends a real email to the support inbox via the existing Resend-backed
  // EmailService, and logs a real audit entry. Previously the frontend's
  // "Contact Support" form was a pure setTimeout that always claimed
  // "Your issue ticket has been filed successfully!" with no backend call
  // at all -- nothing was ever sent or recorded anywhere.
  async submitSupportTicket(
    adminId: string,
    subject: string,
    category: string,
    message: string,
    context?: ServiceContext
  ) {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      include: { adminProfile: true },
    })
    if (!admin) {
      throw new Error("Admin user not found")
    }

    const supportInbox = env.SUPPORT_EMAIL || env.SMTP_USER
    const fromName = admin.adminProfile?.fullName || admin.email
    const html = `
      <h2>New Admin Support Ticket</h2>
      <p><strong>From:</strong> ${fromName} (${admin.email})</p>
      <p><strong>Category:</strong> ${category}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, "<br/>")}</p>
    `
    const sent = await EmailService.sendMail(supportInbox, `[Support Ticket] ${category}: ${subject}`, html)

    await createAuditLog({
      operatorId: adminId,
      operatorEmail: admin.email,
      category: "SUPPORT",
      action: "SUPPORT_TICKET_SUBMITTED",
      entity: "SupportTicket",
      newValue: { subject, category, delivered: sent },
      ipAddress: context?.ipAddress,
      browser: context?.browser,
      device: context?.device,
    })

    if (!sent) {
      throw new Error("Failed to send support ticket email. Please try again or email support directly.")
    }

    return { delivered: true }
  }
}

export default AdminService
