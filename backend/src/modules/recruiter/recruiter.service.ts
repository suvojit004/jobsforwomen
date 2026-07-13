import prisma from "../../shared/database/db"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { CompanyStatus, JobStatus, ApplicationStatus, WorkMode } from "@prisma/client"
import { deleteFromCloudinary } from "../../shared/utils/cloudinary"
import crypto from "crypto"

export interface ServiceContext {
  operatorId?: string
  operatorEmail?: string
  ipAddress?: string
  browser?: string
  device?: string
}

// Allowed applicant workflow state transitions map.
// InterviewScheduled and OfferReleased are reached only through the dedicated
// scheduleInterview()/releaseOffer() methods below (they need real structured
// data -- an actual interview date, actual offer details -- not just a label),
// but they're still listed here so those methods can reuse this same gate.
const WorkflowTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  Applied: [ApplicationStatus.Reviewed, ApplicationStatus.Rejected],
  Reviewed: [ApplicationStatus.Shortlisted, ApplicationStatus.Rejected],
  Shortlisted: [ApplicationStatus.InterviewScheduled, ApplicationStatus.Rejected],
  InterviewScheduled: [ApplicationStatus.InterviewScheduled, ApplicationStatus.OfferReleased, ApplicationStatus.Rejected], // allow rescheduling, moving to an offer, or rejecting post-interview
  OfferReleased: [ApplicationStatus.Hired, ApplicationStatus.Rejected], // candidate accepted (Hired) or declined/rejected
  Rejected: [], // terminal state
  Hired: [], // terminal state
}

// Statuses that require structured data captured through a dedicated endpoint
// rather than the generic status PUT below.
const STRUCTURED_STATUSES: ApplicationStatus[] = [ApplicationStatus.InterviewScheduled, ApplicationStatus.OfferReleased]

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
        company: { include: { benefits: true } },
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
      select: { appliedOn: true, status: true },
    })

    // Real 7-day application trend for the dashboard's line chart (previously
    // a hardcoded fake dataset unrelated to any actual company/applicant --
    // built here from the same recentApps rows fetched above, so no extra query).
    const trendDays: { key: string; date: Date }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      trendDays.push({ key: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), date: d })
    }
    const trendMap: Record<string, { Applied: number; Shortlisted: number; Interviewing: number; Offered: number }> = {}
    trendDays.forEach(({ key }) => {
      trendMap[key] = { Applied: 0, Shortlisted: 0, Interviewing: 0, Offered: 0 }
    })
    recentApps.forEach((app) => {
      const appliedDate = new Date(app.appliedOn)
      appliedDate.setHours(0, 0, 0, 0)
      const key = appliedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      if (!trendMap[key]) return
      trendMap[key].Applied += 1
      const shortlistedPlus: ApplicationStatus[] = [ApplicationStatus.Shortlisted, ApplicationStatus.InterviewScheduled, ApplicationStatus.OfferReleased, ApplicationStatus.Hired]
      const interviewingPlus: ApplicationStatus[] = [ApplicationStatus.InterviewScheduled, ApplicationStatus.OfferReleased, ApplicationStatus.Hired]
      const offeredPlus: ApplicationStatus[] = [ApplicationStatus.OfferReleased, ApplicationStatus.Hired]
      if (shortlistedPlus.includes(app.status)) {
        trendMap[key].Shortlisted += 1
      }
      if (interviewingPlus.includes(app.status)) {
        trendMap[key].Interviewing += 1
      }
      if (offeredPlus.includes(app.status)) {
        trendMap[key].Offered += 1
      }
    })
    const applicationTrend = trendDays.map(({ key }) => ({ name: key, ...trendMap[key] }))

    return {
      profileCompletion: completion,
      verificationStatus: company.status,
      // The full company object was previously never included in this
      // response at all -- the frontend's `dash?.company` lookup was always
      // undefined, so every recruiter dashboard load silently fell back to
      // fabricated placeholder company data ("TechNova Solutions", etc.)
      // regardless of which real company the recruiter actually belonged to.
      company,
      jobStatistics: jobCounts,
      applicantStatistics: appCounts,
      interviewSummary: interviews,
      applicationTrend,
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
        workMode: true,
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { postedOn: "desc" },
    })

    // Work mode split across this company's job postings. The frontend
    // Analytics page previously rendered a hardcoded Remote/Hybrid/On-site
    // pie chart (24/16/8) for every recruiter regardless of their actual
    // postings -- computed here from the same jobsPerformance rows above so
    // it costs no extra query.
    const workModeCounts: Record<string, number> = {}
    jobsPerformance.forEach((job) => {
      workModeCounts[job.workMode] = (workModeCounts[job.workMode] || 0) + 1
    })
    const workModeDistribution = Object.entries(workModeCounts).map(([workMode, count]) => ({
      workMode,
      count,
    }))

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
      workModeDistribution,
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
        name: data.name ?? company.name,
        description: data.description ?? company.description,
        website: data.website,
        location: data.location,
        industryId: industry.id,
        logoUrl,
        logoPublicId,
        logoMetadata: logoMetadata as any,
        // Only overwrite stored verification documents when new ones are
        // actually submitted -- this field is now optional (see validator),
        // so falling back to `undefined` here would previously have wiped
        // out the company's already-submitted documents on every ordinary
        // profile edit.
        verificationDocuments: (data.verificationDocuments as any) ?? (company.verificationDocuments as any),
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

    if (job.status === "pending_approval") {
      EventBus.publish("JobSubmittedForApproval", {
        jobId: job.id,
        jobTitle: job.title,
        companyId: profile.companyId,
        companyName: profile.company.name,
        context,
      })
    }

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

  // Full single-job detail fetch -- the list endpoint above only returns
  // summary columns for the manage-jobs table (no description, requirements,
  // benefits, skills, deadline, salary, or equality-perk flags), so the job
  // detail/edit page needs its own real lookup instead of guessing at fields.
  async getJobById(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        department: true,
        skills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
    })
    if (!job) {
      throw new Error("Job listing not found")
    }

    return {
      id: job.id,
      title: job.title,
      department: job.department?.name || "General",
      workMode: job.workMode,
      type: job.type,
      location: job.location,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      benefits: job.benefits,
      deadline: job.deadline,
      salaryDisplay: job.salaryDisplay,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      skills: job.skills.map((js) => js.skill.name),
      menstrualLeaveChampion: job.menstrualLeaveChampion,
      flexibleHours: job.flexibleHours,
      workFromHome: job.workFromHome,
      applicants: job._count.applications,
      status: job.status,
      postedOn: job.postedOn,
    }
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
        candidate: {
          include: {
            user: true,
            skills: { include: { skill: true } },
          },
        },
        job: true,
        history: {
          orderBy: { createdAt: "desc" },
        },
        interviews: {
          orderBy: { scheduledAt: "desc" },
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
    const targetStatus = extendedStatus as ApplicationStatus

    // Check terminal states
    if (currentStatus === ApplicationStatus.Hired || currentStatus === ApplicationStatus.Rejected) {
      throw new Error(`Cannot transition application from terminal state: ${currentStatus}`)
    }

    // InterviewScheduled and OfferReleased need real structured data (an actual
    // date, actual offer details) and are set exclusively by scheduleInterview()
    // and releaseOffer() below -- reject attempts to set them through this
    // generic endpoint rather than silently faking the missing data.
    if (STRUCTURED_STATUSES.includes(targetStatus)) {
      throw new Error(
        `"${targetStatus}" requires additional details. Use the schedule-interview or release-offer action instead.`
      )
    }

    // Specific state transitions checks
    const allowed = WorkflowTransitions[currentStatus] || []
    if (targetStatus !== currentStatus && !allowed.includes(targetStatus) && targetStatus !== ApplicationStatus.Rejected) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${extendedStatus}`)
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
  // INTERVIEW SCHEDULING (real Interview record, real date/location)
  // ==========================================
  async scheduleInterview(
    applicationId: string,
    userId: string,
    data: { title: string; description?: string; scheduledAt: string; durationMins?: number; location?: string },
    context?: ServiceContext
  ) {
    const profile = await prisma.recruiterProfile.findUnique({ where: { userId } })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true, candidate: { include: { user: true } } },
    })
    if (!app) {
      throw new Error("Application not found")
    }
    if (app.job.companyId !== profile.companyId) {
      throw new Error("Forbidden: Access denied to applicant")
    }

    const currentStatus = app.status
    if (currentStatus === ApplicationStatus.Hired || currentStatus === ApplicationStatus.Rejected) {
      throw new Error(`Cannot schedule an interview on a terminal application state: ${currentStatus}`)
    }
    const allowed = WorkflowTransitions[currentStatus] || []
    if (currentStatus !== ApplicationStatus.InterviewScheduled && !allowed.includes(ApplicationStatus.InterviewScheduled)) {
      throw new Error(`Cannot schedule an interview from state: ${currentStatus}`)
    }

    const scheduledAt = new Date(data.scheduledAt)

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        title: data.title,
        description: data.description,
        scheduledAt,
        durationMins: data.durationMins || 60,
        location: data.location,
      },
    })

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.InterviewScheduled,
        history: {
          create: {
            status: ApplicationStatus.InterviewScheduled,
            changedBy: profile.fullName,
            notes: `Interview "${data.title}" scheduled for ${scheduledAt.toISOString()}`,
          },
        },
      },
    })

    EventBus.publish("InterviewScheduled", {
      applicationId,
      candidateId: app.candidateId,
      candidateUserId: app.candidate.userId,
      jobId: app.jobId,
      scheduledAt: scheduledAt.toISOString(),
      location: data.location,
      context,
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "SCHEDULE_INTERVIEW",
      entity: "Application",
      entityId: applicationId,
      newValue: { interviewId: interview.id, scheduledAt: scheduledAt.toISOString(), title: data.title },
    })

    return { application: updated, interview }
  }

  // ==========================================
  // OFFER RELEASE (real offer details persisted on the Application)
  // ==========================================
  async releaseOffer(
    applicationId: string,
    userId: string,
    data: { offerDetails: string },
    context?: ServiceContext
  ) {
    const profile = await prisma.recruiterProfile.findUnique({ where: { userId } })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true, candidate: { include: { user: true } } },
    })
    if (!app) {
      throw new Error("Application not found")
    }
    if (app.job.companyId !== profile.companyId) {
      throw new Error("Forbidden: Access denied to applicant")
    }

    const currentStatus = app.status
    if (currentStatus === ApplicationStatus.Hired || currentStatus === ApplicationStatus.Rejected) {
      throw new Error(`Cannot release an offer on a terminal application state: ${currentStatus}`)
    }
    const allowed = WorkflowTransitions[currentStatus] || []
    if (!allowed.includes(ApplicationStatus.OfferReleased)) {
      throw new Error(`Cannot release an offer from state: ${currentStatus}. Schedule and complete an interview first.`)
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.OfferReleased,
        offerDetails: data.offerDetails,
        offerReleasedAt: new Date(),
        history: {
          create: {
            status: ApplicationStatus.OfferReleased,
            changedBy: profile.fullName,
            notes: data.offerDetails,
          },
        },
      },
    })

    EventBus.publish("OfferReleased", {
      applicationId,
      candidateId: app.candidateId,
      candidateUserId: app.candidate.userId,
      jobId: app.jobId,
      offerDetails: data.offerDetails,
      context,
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "RELEASE_OFFER",
      entity: "Application",
      entityId: applicationId,
      newValue: { offerDetails: data.offerDetails },
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
      jobTitle: "Recruiter Manager",
    }

    return user.preferences ? { ...defaultPrefs, ...(user.preferences as any) } : defaultPrefs
  }

  async updateSettings(userId: string, data: any, context?: ServiceContext) {
    // fullName/phone live on RecruiterProfile, not the preferences JSON blob
    // -- split them out before merging the rest into preferences.
    const { fullName, phone, ...preferences } = data || {}

    const current = await this.getSettings(userId)
    const updatedPrefs = { ...current, ...preferences }

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPrefs },
    })

    if (fullName !== undefined || phone !== undefined) {
      await prisma.recruiterProfile.updateMany({
        where: { userId },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
      })
    }

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

  async updateCompanyLogo(userId: string, logoDetails: { url: string; publicId: string; metadata?: any }, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const companyId = profile.companyId
    const oldLogoPublicId = profile.company?.logoPublicId

    // SAFE REPLACEMENT ORDER: the new asset has already been uploaded to
    // Cloudinary by the caller (controller) before this method runs. We must
    // point the database at the new asset FIRST, and only delete the old
    // asset AFTER that succeeds -- never before. This also guards against the
    // logo uploader's deterministic public_id (`${userId}_logo`): when a user
    // re-uploads, the new upload overwrites the SAME Cloudinary public_id as
    // the old one, so oldLogoPublicId === logoDetails.publicId in that case.
    // Deleting "the old asset" then would delete the brand-new image we just
    // pointed the database at. Only delete when the public IDs actually differ.
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        logoUrl: logoDetails.url,
        logoPublicId: logoDetails.publicId,
        logoMetadata: (logoDetails.metadata || null) as any,
      },
    })

    if (oldLogoPublicId && oldLogoPublicId !== logoDetails.publicId) {
      try {
        await deleteFromCloudinary(oldLogoPublicId, false)
      } catch (err: any) {
        logger.warn(`[Cloudinary] Failed to delete old logo asset: ${err.message}`)
      }
    }

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "UPDATE_COMPANY_LOGO",
      entity: "Company",
      entityId: companyId,
      newValue: { logoUrl: logoDetails.url },
    })

    return updatedCompany
  }

  async deleteCompanyLogo(userId: string, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const companyId = profile.companyId
    const logoPublicId = profile.company?.logoPublicId

    if (logoPublicId) {
      try {
        await deleteFromCloudinary(logoPublicId, false)
      } catch (err: any) {
        logger.warn(`[Cloudinary] Failed to delete logo asset: ${err.message}`)
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        logoUrl: null,
        logoPublicId: null,
        logoMetadata: null as any,
      },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "DELETE_COMPANY_LOGO",
      entity: "Company",
      entityId: companyId,
    })

    return updatedCompany
  }

  async getTeam(userId: string) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: {
        company: {
          include: {
            recruiters: {
              include: {
                user: true
              }
            },
            invitations: {
              where: {
                acceptedAt: null,
                expiresAt: { gt: new Date() }
              },
              include: {
                role: true
              }
            }
          }
        }
      }
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const members = profile.company?.recruiters.map((rec) => ({
      id: rec.id,
      userId: rec.userId,
      fullName: rec.fullName,
      email: rec.user.email,
      phone: rec.phone,
      verified: rec.verified,
      status: rec.user.status,
    })) || []

    const invitations = profile.company?.invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      status: "Pending",
    })) || []

    return {
      members,
      invitations,
      companyName: profile.company?.name || ""
    }
  }

  async inviteColleague(userId: string, email: string, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true }
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    if (profile.company.status !== CompanyStatus.approved) {
      throw new Error("Your company must be approved before you can invite team members")
    }

    const role = await prisma.role.findUnique({ where: { name: "Recruiter" } })
    if (!role) {
      throw new Error("Recruiter role not found in system matrix")
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      throw new Error("A user with this email address already exists on the platform.")
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      }
    })
    if (existingInvitation) {
      throw new Error("An active invitation for this email address already exists.")
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const invitation = await prisma.invitation.create({
      data: {
        email,
        token,
        roleId: role.id,
        invitedById: userId,
        companyId: profile.companyId,
        expiresAt,
      },
      include: { role: true }
    })

    EventBus.publish("EmployeeInvited", {
      email,
      token,
      roleId: role.id,
      roleName: role.name,
      context,
    })

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: userId,
      category: "RECRUITER",
      action: "INVITE_COLLEAGUE",
      entity: "Invitation",
      entityId: invitation.id,
      newValue: { email, companyId: profile.companyId, expiresAt },
    })

    return {
      ...invitation,
      status: "Pending",
    }
  }

  async cancelColleagueInvitation(userId: string, invitationId: string, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId }
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    })

    if (!invitation) {
      throw new Error("Invitation not found")
    }

    if (invitation.companyId !== profile.companyId) {
      throw new Error("Unauthorized: Invitation does not belong to your company")
    }

    await prisma.invitation.delete({
      where: { id: invitationId }
    })

    EventBus.publish("AuditCreated", {
      ...context,
      operatorId: userId,
      category: "RECRUITER",
      action: "CANCEL_INVITATION",
      entity: "Invitation",
      entityId: invitationId,
    })

    return { success: true }
  }
}

export default RecruiterService
