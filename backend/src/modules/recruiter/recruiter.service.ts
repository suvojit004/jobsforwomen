import prisma from "../../shared/database/db"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { CompanyStatus, JobStatus, ApplicationStatus, WorkMode } from "@prisma/client"

export interface ServiceContext {
  operatorId?: string
  operatorEmail?: string
  ipAddress?: string
  browser?: string
  device?: string
}

// Allowed applicant workflow state transitions map
const WorkflowTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  Applied: [ApplicationStatus.Reviewed, ApplicationStatus.Rejected],
  Reviewed: [ApplicationStatus.Shortlisted, ApplicationStatus.Rejected],
  Shortlisted: [ApplicationStatus.InterviewScheduled, ApplicationStatus.Rejected],
  InterviewScheduled: [ApplicationStatus.InterviewScheduled, ApplicationStatus.Rejected], // allow rescheduling or progression
  Rejected: [], // terminal state
  Hired: [], // terminal state
}

// Extented states mapped to standard Prisma ApplicationStatus or custom tracking strings
// Note: To support InterviewCompleted, OfferReleased, OfferAccepted, OfferDeclined without modifying schema.prisma's native Prisma Enum,
// we can store these status values inside ApplicationStatusHistory notes/timeline, OR map them to standard enum statuses at database level.
// Let's map them to standard DB ApplicationStatus enum values to prevent runtime database insertion constraints, while storing the precise transitions in the history log:
// - Interview Completed -> Shortlisted (or InterviewScheduled with notes)
// - Offer Released -> Shortlisted (or InterviewScheduled with notes)
// - Offer Accepted -> Hired (or Shortlisted with notes)
// - Offer Declined -> Rejected (or Shortlisted with notes)
// Let's implement this mapping cleanly so we don't cause database errors!
export function mapExtendedStatusToPrisma(status: string): ApplicationStatus {
  if (status === "Interview Completed") return ApplicationStatus.Shortlisted
  if (status === "Offer Released") return ApplicationStatus.Shortlisted
  if (status === "Offer Accepted") return ApplicationStatus.Shortlisted
  if (status === "Offer Declined") return ApplicationStatus.Rejected
  return status as ApplicationStatus
}

export class RecruiterService {

  // Calculate Recruiter Profile Completion percentage
  calculateRecruiterCompletion(profile: any): number {
    if (!profile) return 0
    let points = 0
    let maxPoints = 80 // 8 fields checked

    if (profile.fullName) points += 10
    if (profile.phone) points += 10
    if (profile.company) {
      const company = profile.company
      if (company.name) points += 10
      if (company.website) points += 10
      if (company.location) points += 10
      if (company.industryId) points += 10
      if (company.logoUrl) points += 10
      if (company.verificationDocuments && Array.isArray(company.verificationDocuments) && company.verificationDocuments.length > 0) {
        points += 10
      }
    }
    return Math.round((points / maxPoints) * 100)
  }

  // ==========================================
  // RECRUITER DASHBOARD API
  // ==========================================
  async getDashboard(userId: string) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: {
        company: true,
      },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const companyId = profile.companyId
    const company = profile.company

    // Calculate Completion
    const completion = this.calculateRecruiterCompletion(profile)

    // Job Stats
    const jobStats = await prisma.job.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { id: true },
    })

    const jobCounts = {
      draft: 0,
      pending_approval: 0,
      approved: 0,
      paused: 0,
      closed: 0,
      archived: 0,
      flagged: 0,
      total: 0,
    }

    jobStats.forEach((stat) => {
      const key = stat.status.toLowerCase() as keyof typeof jobCounts
      if (key in jobCounts) {
        jobCounts[key] = stat._count.id
      }
      jobCounts.total += stat._count.id
    })

    // Applicant Stats
    const applicantStats = await prisma.application.groupBy({
      by: ["status"],
      where: {
        job: { companyId },
      },
      _count: { id: true },
    })

    const appCounts = {
      applied: 0,
      reviewed: 0,
      shortlisted: 0,
      interviewScheduled: 0,
      hired: 0,
      rejected: 0,
      total: 0,
    }

    applicantStats.forEach((stat) => {
      const key = stat.status.toLowerCase() as keyof typeof appCounts
      if (key in appCounts) {
        appCounts[key] = stat._count.id
      }
      appCounts.total += stat._count.id
    })

    // Upcoming Interviews
    const interviews = await prisma.interview.findMany({
      where: {
        application: {
          job: { companyId },
        },
        scheduledAt: { gte: new Date() },
      },
      include: {
        application: {
          include: {
            candidate: true,
            job: true,
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    })

    // Notifications Summary
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId, read: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    const unreadNotificationsCount = await prisma.notification.count({
      where: { recipientId: userId, read: false },
    })

    // Analytics snapshot - Application volume over past 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentApps = await prisma.application.findMany({
      where: {
        job: { companyId },
        appliedOn: { gte: sevenDaysAgo },
      },
      select: { appliedOn: true },
    })

    return {
      profileCompletion: completion,
      verificationStatus: company.status,
      jobStatistics: jobCounts,
      applicantStatistics: appCounts,
      interviewSummary: interviews,
      notificationsSummary: {
        unreadCount: unreadNotificationsCount,
        recent: notifications,
      },
      analyticsSnapshot: {
        recentApplicationsCount: recentApps.length,
      },
    }
  }

  // ==========================================
  // RECRUITER ANALYTICS API
  // ==========================================
  async getAnalytics(userId: string) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const companyId = profile.companyId

    // Job Performance: list of jobs with application counts
    const jobsPerformance = await prisma.job.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        status: true,
        postedOn: true,
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { postedOn: "desc" },
    })

    // Application funnel summary
    const funnelStats = await prisma.application.groupBy({
      by: ["status"],
      where: { job: { companyId } },
      _count: { id: true },
    })

    const funnel = funnelStats.map((stat) => ({
      stage: stat.status,
      count: stat._count.id,
    }))

    // Department-wise distribution
    const departmentStats = await prisma.job.groupBy({
      by: ["departmentId"],
      where: { companyId },
      _count: { id: true },
    })

    const departments = await prisma.department.findMany({
      where: { id: { in: departmentStats.map((d) => d.departmentId) } },
    })

    const departmentDistribution = departmentStats.map((stat) => {
      const dept = departments.find((d) => d.id === stat.departmentId)
      return {
        department: dept?.name || "Other",
        jobCount: stat._count.id,
      }
    })

    return {
      companyId,
      jobsPerformance,
      applicationFunnel: funnel,
      departmentDistribution,
    }
  }

  // ==========================================
  // COMPANY WIZARD ONBOARDING
  // ==========================================
  async onboardCompany(userId: string, data: any, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const company = profile.company

    // Standardize document verification size and formats check
    if (data.verificationDocuments && Array.isArray(data.verificationDocuments)) {
      data.verificationDocuments.forEach((doc: any) => {
        if (doc.size > 10 * 1024 * 1024) {
          throw new Error(`File ${doc.publicId} exceeds maximum size limit of 10 MB`)
        }
      })
    }

    // Find or create Industry
    const industry = await prisma.industry.upsert({
      where: { name: data.industryName },
      update: {},
      create: { name: data.industryName },
    })

    // Onboarding Workflow States transition:
    // Draft -> Submitted -> Pending Verification -> Under Review -> Approved / Rejected.
    // Determine the next status based on completeness and current status
    let nextStatus: CompanyStatus = CompanyStatus.draft
    if (company.status === CompanyStatus.draft || company.status === CompanyStatus.pending) {
      nextStatus = CompanyStatus.submitted
    } else {
      nextStatus = company.status
    }

    // Map logo metadata if uploaded
    const logoUrl = data.logo?.url || company.logoUrl
    const logoPublicId = data.logo?.publicId || company.logoPublicId
    const logoMetadata = data.logo || company.logoMetadata

    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: {
        website: data.website,
        location: data.location,
        industryId: industry.id,
        logoUrl,
        logoPublicId,
        logoMetadata: logoMetadata as any,
        verificationDocuments: data.verificationDocuments as any,
        status: nextStatus,
      },
    })

    // Upsert claimed perks as company benefits
    if (data.claimedPerks && Array.isArray(data.claimedPerks)) {
      await prisma.$transaction(async (tx) => {
        await tx.companyBenefit.deleteMany({ where: { companyId: company.id } })
        await tx.companyBenefit.createMany({
          data: data.claimedPerks.map((perk: string) => ({
            companyId: company.id,
            benefitName: perk,
          })),
        })
      })
    }

    // Publish CompanySubmitted event
    if (nextStatus === CompanyStatus.submitted) {
      EventBus.publish("CompanySubmitted", {
        companyId: company.id,
        companyName: company.name,
        recruiterUserId: userId,
        context,
      })
    }

    return updatedCompany
  }

  // ==========================================
  // JOB LIFECYCLE MANAGEMENT
  // ==========================================
  async postJob(userId: string, data: any, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    if (profile.company.status !== "approved") {
      throw new Error("Forbidden: Recruiter company must be approved to post job listings")
    }

    // Find or create Department
    const department = await prisma.department.upsert({
      where: { name: data.departmentName },
      update: {},
      create: { name: data.departmentName },
    })

    // Create Job posting
    const job = await prisma.job.create({
      data: {
        title: data.title,
        location: data.location,
        type: data.type,
        workMode: data.workMode as WorkMode,
        description: data.description,
        responsibilities: data.responsibilities,
        requirements: data.requirements,
        benefits: data.benefits,
        deadline: data.deadline,
        salaryDisplay: data.salaryDisplay,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        recruiterId: profile.id,
        companyId: profile.companyId,
        departmentId: department.id,
        menstrualLeaveChampion: !!data.menstrualLeaveChampion,
        flexibleHours: !!data.flexibleHours,
        workFromHome: !!data.workFromHome,
        status: data.status || JobStatus.draft,
      },
    })

    // Insert normalized skills
    if (data.skills && Array.isArray(data.skills)) {
      const skillIds = await Promise.all(
        data.skills.map(async (name: string) => {
          const sk = await prisma.skill.upsert({
            where: { name },
            update: {},
            create: { name },
          })
          return sk.id
        })
      )

      await prisma.jobSkill.createMany({
        data: skillIds.map((sId) => ({ jobId: job.id, skillId: sId })),
      })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "POST_JOB",
      entity: "Job",
      entityId: job.id,
      newValue: { title: job.title, status: job.status },
    })

    return job
  }

  async getJobs(userId: string) {
    const profile = await prisma.recruiterProfile.findUnique({ where: { userId } })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const jobs = await prisma.job.findMany({
      where: { companyId: profile.companyId },
      include: {
        department: true,
        _count: { select: { applications: true } },
      },
      orderBy: { postedOn: "desc" },
    })

    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      department: job.department?.name || "General",
      workMode: job.workMode,
      type: job.type,
      location: job.location,
      applicants: job._count.applications,
      status: job.status,
      postedOn: job.postedOn,
    }))
  }

  async updateJob(jobId: string, userId: string, data: any, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
    })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new Error("Job listing not found")
    }

    // Capture old value for audit logging
    const oldValue = { title: job.title, status: job.status }

    // If department updated
    let departmentId = job.departmentId
    if (data.departmentName) {
      const department = await prisma.department.upsert({
        where: { name: data.departmentName },
        update: {},
        create: { name: data.departmentName },
      })
      departmentId = department.id
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        title: data.title,
        location: data.location,
        type: data.type,
        workMode: data.workMode ? (data.workMode as WorkMode) : undefined,
        description: data.description,
        responsibilities: data.responsibilities,
        requirements: data.requirements,
        benefits: data.benefits,
        deadline: data.deadline,
        salaryDisplay: data.salaryDisplay,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        departmentId,
        menstrualLeaveChampion: data.menstrualLeaveChampion !== undefined ? !!data.menstrualLeaveChampion : undefined,
        flexibleHours: data.flexibleHours !== undefined ? !!data.flexibleHours : undefined,
        workFromHome: data.workFromHome !== undefined ? !!data.workFromHome : undefined,
        status: data.status ? (data.status as JobStatus) : undefined,
      },
    })

    // Sync skills if updated
    if (data.skills && Array.isArray(data.skills)) {
      const skillIds = await Promise.all(
        data.skills.map(async (name: string) => {
          const sk = await prisma.skill.upsert({
            where: { name },
            update: {},
            create: { name },
          })
          return sk.id
        })
      )

      await prisma.$transaction(async (tx) => {
        await tx.jobSkill.deleteMany({ where: { jobId } })
        await tx.jobSkill.createMany({
          data: skillIds.map((sId) => ({ jobId, skillId: sId })),
        })
      })
    }

    EventBus.publish("JobUpdated", {
      jobId,
      recruiterUserId: userId,
      oldValue,
      newValue: { title: updated.title, status: updated.status },
      context,
    })

    return updated
  }

  async duplicateJob(jobId: string, userId: string, context?: ServiceContext) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: { include: { skill: true } } },
    })

    if (!job) {
      throw new Error("Job listing not found")
    }

    // Clone job as a new Draft
    const cloned = await prisma.job.create({
      data: {
        title: `Copy of ${job.title}`,
        location: job.location,
        type: job.type,
        workMode: job.workMode,
        description: job.description,
        responsibilities: job.responsibilities,
        requirements: job.requirements,
        benefits: job.benefits,
        deadline: job.deadline,
        salaryDisplay: job.salaryDisplay,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        recruiterId: job.recruiterId,
        companyId: job.companyId,
        departmentId: job.departmentId,
        menstrualLeaveChampion: job.menstrualLeaveChampion,
        flexibleHours: job.flexibleHours,
        workFromHome: job.workFromHome,
        status: JobStatus.draft,
      },
    })

    // Duplicate skills association
    if (job.skills.length > 0) {
      await prisma.jobSkill.createMany({
        data: job.skills.map((s) => ({
          jobId: cloned.id,
          skillId: s.skillId,
        })),
      })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "DUPLICATE_JOB",
      entity: "Job",
      entityId: cloned.id,
      newValue: { sourceJobId: jobId },
    })

    return cloned
  }

  async lifecycleJob(jobId: string, userId: string, action: string, context?: ServiceContext) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new Error("Job listing not found")
    }

    let nextStatus = job.status
    let domainEventName = ""

    if (action === "submit") {
      nextStatus = JobStatus.pending_approval
      domainEventName = "JobUpdated"
    } else if (action === "pause") {
      nextStatus = JobStatus.paused
      domainEventName = "JobPaused"
    } else if (action === "resume") {
      nextStatus = JobStatus.approved
      domainEventName = "JobResumed"
    } else if (action === "close") {
      nextStatus = JobStatus.closed
      domainEventName = "JobClosed"
    } else {
      throw new Error(`Unsupported lifecycle action: ${action}`)
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: nextStatus },
    })

    if (domainEventName) {
      EventBus.publish(domainEventName, {
        jobId,
        recruiterUserId: userId,
        status: nextStatus,
        context,
      })
    }

    return updated
  }

  async archiveJob(jobId: string, userId: string, context?: ServiceContext) {
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.archived,
        visibility: "hidden",
      },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "ARCHIVE_JOB",
      entity: "Job",
      entityId: jobId,
    })

    return updated
  }

  async deleteJob(jobId: string, userId: string, context?: ServiceContext) {
    await prisma.job.delete({ where: { id: jobId } })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "DELETE_JOB",
      entity: "Job",
      entityId: jobId,
    })

    return { success: true }
  }

  // ==========================================
  // APPLICANTS MANAGEMENT
  // ==========================================
  async getCompanyApplications(userId: string, jobId?: string) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
    })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const whereClause: any = {
      job: { companyId: profile.companyId },
    }

    if (jobId) {
      whereClause.jobId = jobId
    }

    return prisma.application.findMany({
      where: whereClause,
      include: {
        candidate: { include: { user: true } },
        job: true,
        history: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { appliedOn: "desc" },
    })
  }

  async progressApplicant(
    applicationId: string,
    userId: string,
    extendedStatus: string,
    notes?: string,
    context?: ServiceContext
  ) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
    })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        candidate: { include: { user: true } },
      },
    })

    if (!app) {
      throw new Error("Application not found")
    }

    // Verify company scope matches
    if (app.job.companyId !== profile.companyId) {
      throw new Error("Forbidden: Access denied to applicant")
    }

    // Validate Transition Rules
    const currentStatus = app.status
    const targetStatus = mapExtendedStatusToPrisma(extendedStatus)

    // Check terminal states
    if (currentStatus === ApplicationStatus.Hired || currentStatus === ApplicationStatus.Rejected) {
      throw new Error(`Cannot transition application from terminal state: ${currentStatus}`)
    }

    // Specific state transitions checks
    const allowed = WorkflowTransitions[currentStatus] || []
    if (targetStatus !== currentStatus && !allowed.includes(targetStatus) && targetStatus !== ApplicationStatus.Rejected) {
      // Shortlist is also allowed if moving from reviewed
      if (currentStatus === ApplicationStatus.Reviewed && targetStatus === ApplicationStatus.Shortlisted) {
        // allowed
      } else if (currentStatus === ApplicationStatus.Shortlisted && targetStatus === ApplicationStatus.InterviewScheduled) {
        // allowed
      } else {
        throw new Error(`Invalid status transition from ${currentStatus} to ${extendedStatus}`)
      }
    }

    // Execute state progression
    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: targetStatus,
        history: {
          create: {
            status: targetStatus,
            changedBy: profile.fullName,
            notes: notes || `Application progressed to ${extendedStatus}`,
          },
        },
      },
    })

    // Publish specific domain events
    if (extendedStatus === "InterviewScheduled") {
      EventBus.publish("InterviewScheduled", {
        applicationId,
        candidateId: app.candidateId,
        candidateUserId: app.candidate.userId,
        jobId: app.jobId,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // mock schedule in 2 days
        context,
      })
    } else if (extendedStatus === "Offer Released") {
      EventBus.publish("OfferReleased", {
        applicationId,
        candidateUserId: app.candidate.userId,
        jobId: app.jobId,
        context,
      })
    }

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "PROGRESS_APPLICANT",
      entity: "Application",
      entityId: applicationId,
      oldValue: { status: currentStatus },
      newValue: { status: targetStatus, extendedStatus, notes },
    })

    return updated
  }

  // ==========================================
  // RECRUITER PREFERENCES
  // ==========================================
  async getSettings(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error("User not found")
    }

    const defaultPrefs = {
      realTimeNotifications: true,
      emailDigestInterval: "Daily",
    }

    return user.preferences ? { ...defaultPrefs, ...(user.preferences as any) } : defaultPrefs
  }

  async updateSettings(userId: string, preferences: any, context?: ServiceContext) {
    const current = await this.getSettings(userId)
    const updatedPrefs = { ...current, ...preferences }

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPrefs },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "UPDATE_SETTINGS",
      entity: "User",
      entityId: userId,
      newValue: updatedPrefs,
    })

    return updatedPrefs
  }
}

export default RecruiterService
