import prisma from "../../shared/database/db"
import { calculateProfileCompletion } from "../../shared/utils/profileCompletion"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { ApplicationStatus, JobStatus, UserStatus } from "@prisma/client"
import { NotificationService } from "../../shared/services/notification.service"
import { ConversationService } from "../../shared/services/conversation.service"

export interface ServiceContext {
  operatorId?: string
  operatorEmail?: string
  ipAddress?: string
  browser?: string
  device?: string
}

export class CandidateService {
  // ==========================================
  // CANDIDATE PROFILE SERVICES
  // ==========================================
  async getProfile(userId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        skills: {
          include: {
            skill: true,
          },
        },
      },
    })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    const completion = calculateProfileCompletion(candidate)

    return {
      ...candidate,
      profileCompletePercent: completion,
    }
  }

  async updateProfile(userId: string, data: any, context?: ServiceContext) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId },
    })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    // Capture old value for auditing
    const oldValue = {
      fullName: candidate.fullName,
      title: candidate.title,
      bio: candidate.bio,
      noticePeriod: candidate.noticePeriod,
      expectedSalary: candidate.expectedSalary,
    }

    // Sync skills if provided
    if (data.skills) {
      const skillNames: string[] = data.skills
      const skillIds = await Promise.all(
        skillNames.map(async (name) => {
          const sk = await prisma.skill.upsert({
            where: { name },
            update: {},
            create: { name },
          })
          return sk.id
        })
      )

      await prisma.$transaction(async (tx) => {
        await tx.candidateSkill.deleteMany({ where: { candidateId: candidate.id } })
        await tx.candidateSkill.createMany({
          data: skillIds.map((sId) => ({ candidateId: candidate.id, skillId: sId })),
        })
      })
    }

    const updated = await prisma.candidateProfile.update({
      where: { userId },
      data: {
        fullName: data.fullName,
        title: data.title,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        noticePeriod: data.noticePeriod,
        expectedSalary: data.expectedSalary,
        languages: data.languages,
        experience: data.experience,
        education: data.education,
        socialLinks: data.socialLinks,
      },
    })

    const fullUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { candidateProfile: { include: { skills: true } } },
    })
    const completion = calculateProfileCompletion(fullUser)

    // Publish CandidateProfileUpdated Event
    EventBus.publish("CandidateProfileUpdated", {
      userId,
      candidateId: candidate.id,
      fullName: updated.fullName,
      profileCompletePercent: completion,
      context,
      oldValue,
      newValue: {
        fullName: updated.fullName,
        title: updated.title,
        bio: updated.bio,
        noticePeriod: updated.noticePeriod,
        expectedSalary: updated.expectedSalary,
        profileCompletePercent: completion,
      },
    })

    return {
      profile: updated,
      profileCompletePercent: completion,
    }
  }

  async getProfileCompletion(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { candidateProfile: { include: { skills: true } } },
    })
    if (!user) {
      throw new Error("User not found")
    }

    return {
      userId,
      profileCompletePercent: calculateProfileCompletion(user),
    }
  }

  // ==========================================
  // RESUME MANAGEMENT SERVICES
  // ==========================================
  async updateResume(userId: string, fileDetails: { url: string; publicId: string; metadata?: any }, context?: ServiceContext) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId },
    })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    const updated = await prisma.candidateProfile.update({
      where: { userId },
      data: {
        resumeUrl: fileDetails.url,
        resumePublicId: fileDetails.publicId,
        resumeMetadata: (fileDetails.metadata || null) as any,
      },
    })

    // Publish ResumeUploaded Event
    EventBus.publish("ResumeUploaded", {
      userId,
      candidateId: candidate.id,
      url: fileDetails.url,
      publicId: fileDetails.publicId,
      metadata: fileDetails.metadata,
      context,
    })

    return updated
  }

  async deleteResume(userId: string, context?: ServiceContext) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId },
    })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    const updated = await prisma.candidateProfile.update({
      where: { userId },
      data: {
        resumeUrl: null,
        resumePublicId: null,
        resumeMetadata: null as any,
      },
    })

    // Publish ResumeDeleted Event
    EventBus.publish("ResumeDeleted", {
      userId,
      candidateId: candidate.id,
      context,
    })

    return updated
  }

  // ==========================================
  // SAVED JOBS BOOKMARKS
  // ==========================================
  async saveJob(userId: string, jobId: string, context?: ServiceContext) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new Error("Job posting not found")
    }

    const saved = await prisma.savedJob.upsert({
      where: {
        jobId_candidateId: { jobId, candidateId: candidate.id },
      },
      update: {},
      create: { candidateId: candidate.id, jobId },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "CANDIDATE",
      action: "SAVE_JOB",
      entity: "Job",
      entityId: jobId,
    })

    return saved
  }

  async unsaveJob(userId: string, jobId: string, context?: ServiceContext) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    await prisma.savedJob.delete({
      where: {
        jobId_candidateId: { jobId, candidateId: candidate.id },
      },
    })

    EventBus.publish("AuditCreated", {
      ...context,
      category: "CANDIDATE",
      action: "UNSAVE_JOB",
      entity: "Job",
      entityId: jobId,
    })

    return { success: true }
  }

  async getSavedJobs(userId: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    return prisma.savedJob.findMany({
      where: { candidateId: candidate.id },
      include: {
        job: {
          include: {
            company: true,
            department: true,
          },
        },
      },
      orderBy: { savedAt: "desc" },
    })
  }

  // ==========================================
  // JOB APPLICATIONS
  // ==========================================
  async applyToJob(userId: string, jobId: string, context?: ServiceContext) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { user: true },
    })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { recruiter: { include: { user: true } } },
    })
    if (!job) {
      throw new Error("Job posting not found")
    }

    if (candidate.user.status === UserStatus.PendingVerification) {
      throw new Error("Please verify your email address to submit applications")
    }

    const existing = await prisma.application.findFirst({
      where: { candidateId: candidate.id, jobId },
    })
    if (existing) {
      throw new Error("You have already applied for this job posting")
    }

    const application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId,
        status: ApplicationStatus.Applied,
        history: {
          create: {
            status: ApplicationStatus.Applied,
            changedBy: candidate.fullName,
            notes: "Initial job application submitted",
          },
        },
      },
    })

    // Publish ApplicationSubmitted Event
    EventBus.publish("ApplicationSubmitted", {
      applicationId: application.id,
      candidateId: candidate.id,
      candidateName: candidate.fullName,
      jobId,
      jobTitle: job.title,
      recruiterUserId: job.recruiter.userId,
      context,
    })

    return application
  }

  async getApplications(userId: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    return prisma.application.findMany({
      where: { candidateId: candidate.id },
      include: {
        job: {
          include: {
            company: true,
          },
        },
      },
      orderBy: { appliedOn: "desc" },
    })
  }

  async getApplicationDetails(applicationId: string, userId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: {
          include: {
            company: true,
            recruiter: true,
          },
        },
        history: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!app) {
      throw new Error("Application not found")
    }

    if (app.candidate.userId !== userId) {
      throw new Error("Forbidden: Access denied")
    }

    return app
  }

  async withdrawApplication(applicationId: string, userId: string, context?: ServiceContext) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { candidate: true, job: { include: { recruiter: true } } },
    })

    if (!app) {
      throw new Error("Application not found")
    }

    if (app.candidate.userId !== userId) {
      throw new Error("Forbidden: Access denied")
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.Rejected,
        history: {
          create: {
            status: ApplicationStatus.Rejected,
            changedBy: app.candidate.fullName,
            notes: "Application withdrawn by candidate",
          },
        },
      },
    })

    // Publish ApplicationWithdrawn Event
    EventBus.publish("ApplicationWithdrawn", {
      applicationId,
      candidateId: app.candidateId,
      candidateName: app.candidate.fullName,
      jobId: app.jobId,
      jobTitle: app.job.title,
      recruiterUserId: app.job.recruiter.userId,
      context,
    })

    return updated
  }

  // ==========================================
  // JOBS DIRECTORY & FILTERINGS
  // ==========================================
  async getJobs(filters: any, pagination: any) {
    const page = Number(pagination.page) || 1
    const limit = Number(pagination.limit) || 10
    const skip = (page - 1) * limit

    const whereClause: any = {
      status: JobStatus.approved,
      visibility: "visible",
    }

    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { company: { name: { contains: filters.search, mode: "insensitive" } } },
      ]
    }

    if (filters.location) {
      whereClause.location = { contains: filters.location, mode: "insensitive" }
    }

    if (filters.type) {
      whereClause.type = filters.type
    }

    if (filters.departmentId) {
      whereClause.departmentId = filters.departmentId
    }

    if (filters.menstrualLeaveChampion === "true" || filters.menstrualLeaveChampion === true) {
      whereClause.menstrualLeaveChampion = true
    }

    if (filters.flexibleHours === "true" || filters.flexibleHours === true) {
      whereClause.flexibleHours = true
    }

    if (filters.workFromHome === "true" || filters.workFromHome === true) {
      whereClause.workFromHome = true
    }

    const orderByClause: any = {}
    if (filters.sortBy === "recent") {
      orderByClause.postedOn = "desc"
    } else if (filters.sortBy === "salary_high") {
      orderByClause.salaryMax = "desc"
    } else {
      orderByClause.postedOn = "desc"
    }

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({
        where: whereClause,
        include: {
          company: true,
          department: true,
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      }),
      prisma.job.count({ where: whereClause }),
    ])

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getRecommendations(userId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { skills: { include: { skill: true } } },
    })

    if (!candidate) {
      return []
    }

    const skillNames = candidate.skills.map((s) => s.skill.name)

    return prisma.job.findMany({
      where: {
        status: JobStatus.approved,
        visibility: "visible",
        OR: [
          {
            skills: {
              some: {
                skill: {
                  name: { in: skillNames },
                },
              },
            },
          },
          {
            title: { contains: candidate.title || "Developer", mode: "insensitive" },
          },
        ],
      },
      include: {
        company: true,
        department: true,
      },
      take: 6,
      orderBy: { postedOn: "desc" },
    })
  }

  // ==========================================
  // JOB REPORTING
  // ==========================================
  async reportJob(userId: string, jobId: string, reason: string, context?: ServiceContext) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new Error("Job posting not found")
    }

    const report = await prisma.jobReport.create({
      data: {
        reporterId: userId,
        jobId,
        reason,
      },
    })

    await prisma.job.update({
      where: { id: jobId },
      data: { reported: true },
    })

    // Publish JobReported Event
    EventBus.publish("JobReported", {
      userId,
      jobId,
      reason,
      context,
    })

    return report
  }

  // ==========================================
  // NOTIFICATIONS SERVICES
  // ==========================================
  async getNotifications(userId: string, filters: any = {}, pagination: any = {}) {
    return NotificationService.getNotifications(userId, filters, pagination)
  }

  async markNotificationRead(id: string, userId: string) {
    return NotificationService.markNotificationRead(id, userId)
  }

  async markAllNotificationsRead(userId: string) {
    return NotificationService.markAllNotificationsRead(userId)
  }

  async deleteNotification(id: string, userId: string) {
    return NotificationService.deleteNotification(id, userId)
  }

  // ==========================================
  // CANDIDATE SETTINGS SERVICES
  // ==========================================
  async getSettings(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error("User not found")
    }

    const defaultPrefs = {
      marketingEmails: true,
      applicationUpdates: true,
      newJobAlerts: true,
      chatMessages: true,
      profileVisibility: "Public",
      showSalary: true,
      theme: "System",
      emailFormat: "HTML",
    }

    return user.preferences ? { ...defaultPrefs, ...(user.preferences as any) } : defaultPrefs
  }

  async updateSettings(userId: string, settingsData: any, context?: ServiceContext) {
    const currentSettings = await this.getSettings(userId)
    const newSettings = { ...currentSettings, ...settingsData }

    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: newSettings,
      },
    })

    // Publish FeatureFlagUpdated Event (representing settings adjustments)
    EventBus.publish("FeatureFlagUpdated", {
      userId,
      settings: newSettings,
      context,
    })

    return newSettings
  }

  // ==========================================
  // CONVERSATIONS & CHATS
  // ==========================================
  async getConversations(userId: string) {
    return ConversationService.getConversations(userId)
  }

  async getMessages(conversationId: string, userId: string) {
    return ConversationService.getMessages(conversationId, userId)
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    return ConversationService.sendMessage(conversationId, senderId, content)
  }

  // ==========================================
  // CONSOLIDATED DASHBOARD & ANALYTICS
  // ==========================================
  async getDashboard(userId: string) {
    const profile = await this.getProfile(userId)
    const applications = await this.getApplications(userId)
    const savedJobs = await this.getSavedJobs(userId)
    const recommendations = await this.getRecommendations(userId)

    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId, read: false },
      take: 5,
      orderBy: { createdAt: "desc" },
    })

    const interviews = await prisma.interview.findMany({
      where: {
        application: {
          candidate: { userId },
        },
      },
      include: {
        application: {
          include: {
            job: {
              include: { company: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    })

    const recentActivity = await prisma.auditLog.findMany({
      where: { operatorId: userId },
      take: 10,
      orderBy: { timestamp: "desc" },
    })

    return {
      profileSummary: {
        fullName: profile.fullName,
        title: profile.title,
        avatarUrl: profile.avatarUrl,
        resumeUrl: profile.resumeUrl,
      },
      profileCompletePercent: profile.profileCompletePercent,
      applicationsCount: applications.length,
      savedJobsCount: savedJobs.length,
      recentApplications: applications.slice(0, 5),
      savedJobs: savedJobs.slice(0, 5),
      recommendations,
      notificationsSummary: {
        unreadCount: notifications.length,
        recent: notifications,
      },
      interviews,
      recentActivity,
    }
  }

  async getAnalytics(userId: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!candidate) {
      throw new Error("Candidate profile not found")
    }

    const appCount = await prisma.application.count({ where: { candidateId: candidate.id } })
    const savedCount = await prisma.savedJob.count({ where: { candidateId: candidate.id } })
    
    const interviewCount = await prisma.interview.count({
      where: {
        application: { candidateId: candidate.id },
      },
    })

    return {
      applicationsCount: appCount,
      savedJobsCount: savedCount,
      interviewsCount: interviewCount,
      profileCompletePercent: calculateProfileCompletion(
        await prisma.user.findUnique({
          where: { id: userId },
          include: { candidateProfile: { include: { skills: true } } },
        })
      ),
    }
  }

  async getActivityLogs(userId: string) {
    return prisma.auditLog.findMany({
      where: { operatorId: userId },
      orderBy: { timestamp: "desc" },
      take: 30,
    })
  }
}

export default CandidateService
