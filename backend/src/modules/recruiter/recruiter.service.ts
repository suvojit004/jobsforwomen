import prisma from "../../shared/database/db"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { CompanyStatus, JobStatus, ApplicationStatus, WorkMode, PerkStatus } from "@prisma/client"
import { deleteFile, replaceFile } from "../../shared/utils/fileStorage"
import { normalizeDocuments } from "../../shared/utils/documents"
import crypto from "crypto"

export interface ServiceContext {
  operatorId?: string
  operatorEmail?: string
  ipAddress?: string
  browser?: string
  device?: string
}

// Pipeline is an ordered sequence, not a strict single-step chain: a
// recruiter can jump forward to any later stage (the UI doesn't force
// visiting every intermediate status one at a time, e.g. "Shortlisted"
// before scheduling an interview). Moving backward, or moving at all once
// terminal (Hired/Rejected), is blocked.
const PIPELINE_ORDER: ApplicationStatus[] = [
  ApplicationStatus.Applied,
  ApplicationStatus.Reviewed,
  ApplicationStatus.Shortlisted,
  ApplicationStatus.InterviewScheduled,
  ApplicationStatus.OfferReleased,
  ApplicationStatus.Hired,
]

function getAllowedTransitions(current: ApplicationStatus): ApplicationStatus[] {
  if (
    current === ApplicationStatus.Hired ||
    current === ApplicationStatus.Rejected ||
    // Withdrawn is candidate-initiated and terminal from the recruiter's
    // side too -- there's nothing left to progress once they've pulled out.
    current === ApplicationStatus.Withdrawn
  ) {
    return [] // terminal states
  }
  const idx = PIPELINE_ORDER.indexOf(current)
  const forward = idx >= 0 ? PIPELINE_ORDER.slice(idx + 1) : []
  // Every later stage is reachable directly EXCEPT Hired: marking an
  // application Hired is a meaningful commitment that should still require
  // at least an interview having been scheduled (matches
  // recruiter.test.ts's existing "prevent invalid status jumps (e.g. from
  // Applied directly to Hired)" regression test) -- unlike the other
  // stages, it's never a bare skip-ahead straight from Applied/Reviewed/
  // Shortlisted.
  const allowed = forward.filter(
    (stage) =>
      stage !== ApplicationStatus.Hired ||
      current === ApplicationStatus.InterviewScheduled ||
      current === ApplicationStatus.OfferReleased
  )
  if (current === ApplicationStatus.InterviewScheduled) {
    allowed.push(ApplicationStatus.InterviewScheduled) // allow rescheduling an existing interview
  }
  allowed.push(ApplicationStatus.Rejected)
  return allowed
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
        company: { include: { benefits: true, perkRequests: true } },
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

    // Perk claim summary for the recruiter Dashboard status card --
    // counts derived from the real, independently-reviewed CompanyPerkRequest
    // rows rather than the old CompanyBenefit boolean list.
    const perkRequestsList = (company as any).perkRequests || []
    const perkSummary = {
      total: perkRequestsList.length,
      approved: perkRequestsList.filter((p: any) => p.status === "approved").length,
      pending: perkRequestsList.filter((p: any) => p.status === "pending" || p.status === "info_requested").length,
      rejected: perkRequestsList.filter((p: any) => p.status === "rejected").length,
    }

    return {
      profileCompletion: completion,
      verificationStatus: company.status,
      perkSummary,
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
  // COMPANY PERK REQUESTS (Parts 6/7 -- independent from company
  // registration approval; see CompanyPerkRequest in schema.prisma)
  // ==========================================

  private async getOwnCompanyId(userId: string): Promise<string> {
    const profile = await prisma.recruiterProfile.findUnique({ where: { userId } })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }
    return profile.companyId
  }

  // Single entry point for both first submission (no comment) and
  // resubmission after rejected/info_requested (comment describing what
  // changed) -- keeps "select perk, attach proof, click Submit for
  // Verification" and "Resubmit" as the same underlying action
  // instead of two parallel code paths that could drift apart.
  async submitOrResubmitPerk(userId: string, perkName: string, comment: string | undefined, context?: ServiceContext) {
    const companyId = await this.getOwnCompanyId(userId)

    const existing = await prisma.companyPerkRequest.findFirst({ where: { companyId, perkName } })

    if (existing?.status === PerkStatus.pending) {
      throw new Error("This perk is already pending review.")
    }
    if (existing?.status === PerkStatus.approved) {
      throw new Error("This perk has already been approved.")
    }

    let request
    if (existing) {
      request = await prisma.companyPerkRequest.update({
        where: { id: existing.id },
        data: {
          status: PerkStatus.pending,
          recruiterComment: comment ?? existing.recruiterComment,
          submittedAt: new Date(),
          reviewedAt: null,
        },
      })
    } else {
      request = await prisma.companyPerkRequest.create({
        // `documents` is a nullable Json column with no DB-level default
        // (see schema.prisma) -- initializing it to `[]` here, at the one
        // place a CompanyPerkRequest row is actually born, is the real fix
        // for the "Cannot read properties of null (reading 'length')" crash
        // on the recruiter Perks page: every row this creates now reads back
        // an empty array instead of `null`, matching what every consumer
        // (frontend `.length`/`.map`, addPerkDocument's append logic) always
        // assumed. listPerkRequests/getApprovalTracker below still normalize
        // defensively for the legacy rows created before this fix existed.
        data: { companyId, perkName, recruiterComment: comment, documents: [] },
      })
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } })

    EventBus.publish("PerkSubmitted", {
      perkRequestId: request.id,
      companyId,
      companyName: company?.name,
      perkName,
      isResubmission: !!existing,
      context,
    })

    return { ...request, documents: normalizeDocuments(request.documents) }
  }

  async listPerkRequests(userId: string) {
    const companyId = await this.getOwnCompanyId(userId)
    const requests = await prisma.companyPerkRequest.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } })
    // Defensive normalization for legacy rows (created before
    // submitOrResubmitPerk started initializing `documents: []` above) --
    // this is the boundary every recruiter-facing read of perk requests
    // passes through, so fixing it here covers Perks.tsx's `.length`/`.map`
    // crash for old data too, not just newly-created requests.
    return requests.map((r) => ({ ...r, documents: normalizeDocuments(r.documents) }))
  }

  async addPerkDocument(
    userId: string,
    perkRequestId: string,
    doc: {
      url: string
      publicId: string
      size: number
      mimetype: string
      category: string
      originalFilename?: string
      format?: string
    }
  ) {
    const companyId = await this.getOwnCompanyId(userId)
    const request = await prisma.companyPerkRequest.findUnique({ where: { id: perkRequestId } })

    if (!request || request.companyId !== companyId) {
      throw new Error("Perk request not found")
    }

    const existingDocs: any[] = normalizeDocuments(request.documents)
    const version = existingDocs.filter((d) => d.category === doc.category).length + 1
    const newDoc = { ...doc, uploadedAt: new Date().toISOString(), version }

    // Append, never replace -- Part 13 requires upload history to be
    // maintained across resubmissions.
    await prisma.companyPerkRequest.update({
      where: { id: perkRequestId },
      data: { documents: [...existingDocs, newDoc] },
    })

    // this previously fired no event at all -- Part 11
    // explicitly lists "Recruiter Uploaded Additional Documents" as its own
    // realtime admin-notification trigger, distinct from submitting/
    // resubmitting the perk claim itself (PerkSubmitted).
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    EventBus.publish("PerkDocumentUploaded", {
      companyId,
      companyName: company?.name,
      perkRequestId,
      perkName: request.perkName,
      category: doc.category,
      uploadedAt: newDoc.uploadedAt,
    })

    return newDoc
  }

  // ==========================================
  // APPROVAL TRACKER -- consolidated read view of the recruiter's
  // Company Registration status/history plus their Perk Requests, so they
  // don't have to piece it together from Company Profile and Perks
  // separately. Interactive actions (resubmitting a perk, uploading
  // documents) still live solely on Perks.tsx to avoid a second, duplicate
  // perk-editing UI -- this page is deliberately read + navigate only.
  // ==========================================
  async getApprovalTracker(userId: string) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: {
        company: {
          include: {
            perkRequests: { orderBy: { createdAt: "desc" } },
            history: { orderBy: { createdAt: "desc" }, include: { admin: true } },
          },
        },
      },
    })

    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const company = profile.company

    return {
      company: {
        name: company.name,
        status: company.status,
        feedback: company.feedback,
        createdAt: company.createdAt,
        recruiterResubmissionComment: company.recruiterResubmissionComment,
        resubmittedAt: company.resubmittedAt,
      },
      history: company.history.map((h) => ({
        status: h.status,
        notes: h.notes,
        adminEmail: h.admin?.email || "Admin",
        createdAt: h.createdAt,
      })),
      perkRequests: company.perkRequests.map((r) => ({ ...r, documents: normalizeDocuments(r.documents) })),
    }
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

    // "resume" must only re-activate a job admin already approved and the
    // recruiter themselves paused -- it can't be used to bypass moderation
    // on a job still `pending_approval` or `flagged`. Approval itself is an
    // admin-only transition owned by admin.service.ts's moderateJob().
    if (action === "submit") {
      if (job.status !== JobStatus.draft && job.status !== JobStatus.flagged) {
        throw new Error(`Invalid status transition: cannot submit a job for approval from state: ${job.status}`)
      }
      nextStatus = JobStatus.pending_approval
      domainEventName = "JobUpdated"
    } else if (action === "pause") {
      if (job.status !== JobStatus.approved) {
        throw new Error(`Invalid status transition: only an approved, active job can be paused (current state: ${job.status})`)
      }
      nextStatus = JobStatus.paused
      domainEventName = "JobPaused"
    } else if (action === "resume") {
      if (job.status !== JobStatus.paused) {
        throw new Error(
          `Invalid status transition: cannot activate a job that has not been approved by an admin (current state: ${job.status}). Pending or rejected jobs must complete admin moderation first.`
        )
      }
      nextStatus = JobStatus.approved
      domainEventName = "JobResumed"
    } else if (action === "close") {
      if (job.status !== JobStatus.approved && job.status !== JobStatus.paused) {
        throw new Error(`Invalid status transition: cannot close a job from state: ${job.status}`)
      }
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

    const applications = await prisma.application.findMany({
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

    // Once a candidate withdraws, the recruiter loses access to everything
    // about them except their name -- no email, phone, bio, resume, skills,
    // experience, education, salary expectations, etc. They chose to pull
    // out of this specific pipeline; there's no ongoing legitimate reason
    // for the recruiter to keep viewing their profile through it.
    return applications.map((app) => {
      if (app.status !== ApplicationStatus.Withdrawn) {
        return app
      }
      return {
        ...app,
        candidate: {
          id: app.candidate.id,
          fullName: app.candidate.fullName,
        } as unknown as typeof app.candidate,
      }
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
    if (
      currentStatus === ApplicationStatus.Hired ||
      currentStatus === ApplicationStatus.Rejected ||
      currentStatus === ApplicationStatus.Withdrawn
    ) {
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
    const allowed = getAllowedTransitions(currentStatus)
    if (targetStatus !== currentStatus && !allowed.includes(targetStatus)) {
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

    // this method previously only ever published
    // "AuditCreated" -- there was no EventBus event a notification/email
    // listener could subscribe to, so every Reviewed/Shortlisted/Hired/
    // Rejected transition (every status this generic endpoint handles) was
    // completely silent to the candidate: no DB notification, no socket
    // push, no email, regardless of the real notification architecture
    // already working correctly for InterviewScheduled/OfferReleased below.
    EventBus.publish("ApplicationStatusChanged", {
      applicationId,
      candidateId: app.candidateId,
      candidateUserId: app.candidate.userId,
      candidateName: app.candidate.fullName,
      jobId: app.jobId,
      jobTitle: app.job.title,
      recruiterUserId: userId,
      previousStatus: currentStatus,
      status: targetStatus,
      notes,
      context,
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
    data: {
      title: string
      description?: string
      scheduledAt: string
      timezone?: string
      durationMins?: number
      mode?: "Online" | "Offline"
      meetingLink?: string
      venue?: string
      notes?: string
      location?: string
    },
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
    if (
      currentStatus === ApplicationStatus.Hired ||
      currentStatus === ApplicationStatus.Rejected ||
      currentStatus === ApplicationStatus.Withdrawn
    ) {
      throw new Error(`Cannot schedule an interview on a terminal application state: ${currentStatus}`)
    }
    const allowed = getAllowedTransitions(currentStatus)
    if (currentStatus !== ApplicationStatus.InterviewScheduled && !allowed.includes(ApplicationStatus.InterviewScheduled)) {
      throw new Error(`Cannot schedule an interview from state: ${currentStatus}`)
    }

    const scheduledAt = new Date(data.scheduledAt)
    const mode = data.mode || "Online"
    // `location` is kept in sync for any older read path that only knows
    // about that flat field -- it mirrors whichever of meetingLink/venue is
    // actually relevant for this interview's mode.
    const derivedLocation = data.location || (mode === "Offline" ? data.venue : data.meetingLink)

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        title: data.title,
        description: data.description,
        scheduledAt,
        timezone: data.timezone,
        durationMins: data.durationMins || 60,
        mode,
        meetingLink: mode === "Online" ? data.meetingLink : undefined,
        venue: mode === "Offline" ? data.venue : undefined,
        notes: data.notes,
        location: derivedLocation,
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
      candidateName: app.candidate.fullName,
      jobId: app.jobId,
      jobTitle: app.job.title,
      recruiterUserId: userId,
      scheduledAt: scheduledAt.toISOString(),
      timezone: data.timezone,
      mode,
      meetingLink: interview.meetingLink,
      venue: interview.venue,
      notes: data.notes,
      location: derivedLocation,
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
    context?: ServiceContext,
    offerLetterFile?: { buffer: Buffer; mimetype: string; originalname?: string }
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
    if (
      currentStatus === ApplicationStatus.Hired ||
      currentStatus === ApplicationStatus.Rejected ||
      currentStatus === ApplicationStatus.Withdrawn
    ) {
      throw new Error(`Cannot release an offer on a terminal application state: ${currentStatus}`)
    }
    const allowed = getAllowedTransitions(currentStatus)
    if (!allowed.includes(ApplicationStatus.OfferReleased)) {
      throw new Error(`Cannot release an offer from state: ${currentStatus}.`)
    }

    // Attaching an offer letter is optional -- a recruiter can still
    // release an offer with just the free-text details, same as before this
    // was added. Old letter (if replacing one on a re-release) is deleted
    // first via replaceFile, same pattern as resume replacement.
    let offerLetterUrl = app.offerLetterUrl
    let offerLetterPublicId = app.offerLetterPublicId
    if (offerLetterFile) {
      const uploadResult = await replaceFile(
        app.offerLetterPublicId,
        offerLetterFile.buffer,
        "jfw/offer-letters",
        `${applicationId}_offer_${Date.now()}`,
        true,
        offerLetterFile.originalname
      )
      offerLetterUrl = uploadResult.secureUrl
      offerLetterPublicId = uploadResult.publicId
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.OfferReleased,
        offerDetails: data.offerDetails,
        offerReleasedAt: new Date(),
        offerLetterUrl,
        offerLetterPublicId,
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
      // Needed so the admin-facing notification (notification.listener.ts)
      // can name the candidate, same as the InterviewScheduled event already
      // does -- without this it falls back to a generic "A candidate" string.
      candidateName: app.candidate.fullName || app.candidate.user.email,
      jobId: app.jobId,
      // jobTitle was never included in this
      // payload, so the candidate notification below fell back to literally
      // printing the job's raw UUID ("...offer for job ID 3f9a1c2e-...").
      jobTitle: app.job.title,
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
    // disk by the caller (controller) before this method runs. We must
    // point the database at the new asset FIRST, and only delete the old
    // asset AFTER that succeeds -- never before. This also guards against the
    // logo uploader's deterministic filename (`${userId}_logo`): when a user
    // re-uploads, the new upload overwrites the SAME path as the old one, so
    // oldLogoPublicId === logoDetails.publicId in that case. Deleting "the
    // old asset" then would delete the brand-new image we just pointed the
    // database at. Only delete when the public IDs actually differ.
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
        await deleteFile(oldLogoPublicId, false)
      } catch (err: any) {
        logger.warn(`[FileStorage] Failed to delete old logo asset: ${err.message}`)
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
        await deleteFile(logoPublicId, false)
      } catch (err: any) {
        logger.warn(`[FileStorage] Failed to delete logo asset: ${err.message}`)
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

  // ==========================================
  // COMPANY PROFILE: OFFICE PHOTO GALLERY -- appended-only Json
  // array, same versioned/never-overwritten shape used for verification and
  // perk documents , so re-uploads never silently destroy history.
  // Deletion is still supported (a recruiter may want to remove an outdated
  // photo), but it's an explicit action distinct from the upload-always-appends
  // behavior.
  // ==========================================
  async addGalleryPhoto(
    userId: string,
    photo: { url: string; publicId: string; size: number; mimetype: string; caption?: string },
    context?: ServiceContext
  ) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const companyId = profile.companyId
    const existing: any[] = Array.isArray(profile.company.galleryImages) ? (profile.company.galleryImages as any[]) : []

    if (existing.length >= 20) {
      throw new Error("Maximum of 20 gallery photos allowed. Remove an existing photo before adding a new one.")
    }

    const newPhoto = { ...photo, uploadedAt: new Date().toISOString() }
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { galleryImages: [...existing, newPhoto] as any },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "ADD_GALLERY_PHOTO",
      entity: "Company",
      entityId: companyId,
      newValue: { url: photo.url, caption: photo.caption },
    })

    return updated
  }

  async deleteGalleryPhoto(userId: string, publicId: string, context?: ServiceContext) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    })
    if (!profile) {
      throw new Error("Recruiter profile not found")
    }

    const companyId = profile.companyId
    const existing: any[] = Array.isArray(profile.company.galleryImages) ? (profile.company.galleryImages as any[]) : []
    const target = existing.find((p) => p.publicId === publicId)
    if (!target) {
      throw new Error("Gallery photo not found")
    }

    const remaining = existing.filter((p) => p.publicId !== publicId)

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { galleryImages: remaining as any },
    })

    try {
      await deleteFile(publicId, false)
    } catch (err: any) {
      logger.warn(`[FileStorage] Failed to delete gallery photo asset: ${err.message}`)
    }

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "DELETE_GALLERY_PHOTO",
      entity: "Company",
      entityId: companyId,
      oldValue: { url: target.url },
    })

    return updated
  }

  // ==========================================
  // COMPANY PROFILE: WORKPLACE POLICIES -- full-array replace
  // (unlike the gallery, which appends). Policies are short text statements
  // the recruiter authors and edits freely, so there's no "history" to lose
  // by overwriting -- an edit here is a genuine edit, not a resubmission.
  // ==========================================
  async updatePolicies(userId: string, policies: { title: string; description: string }[], context?: ServiceContext) {
    const companyId = await this.getOwnCompanyId(userId)

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { policies: policies as any },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "RECRUITER",
      action: "UPDATE_COMPANY_POLICIES",
      entity: "Company",
      entityId: companyId,
      newValue: { policyCount: policies.length },
    })

    return updated
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
