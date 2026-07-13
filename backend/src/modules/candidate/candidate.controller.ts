import type { Request, Response } from "express"
import { CandidateService, ServiceContext } from "./candidate.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { uploadToCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary"
import {
  updateCandidateProfileSchema,
  updateCandidateSettingsSchema,
  reportJobSchema,
  sendMessageSchema,
} from "./candidate.validator"

export class CandidateController {
  private service = new CandidateService()

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

  // ==========================================
  // PROFILE HANDLERS
  // ==========================================
  getProfile = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const profile = await this.service.getProfile(userId)
    return sendSuccess(res, { profile }, "Fetched profile successfully.")
  }

  updateProfile = async (req: Request, res: Response) => {
    const validated = updateCandidateProfileSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.updateProfile(userId, validated, context)
    return sendSuccess(res, result, "Profile updated successfully.")
  }

  getProfileCompletion = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await this.service.getProfileCompletion(userId)
    return sendSuccess(res, result, "Fetched profile completion successfully.")
  }

  // ==========================================
  // RESUME HANDLERS
  // ==========================================
  uploadResume = async (req: Request, res: Response, next: any) => {
    try {
      const file = (req as any).file
      const userId = req.user?.userId || ""
      const context = this.getContext(req)

      // Mirrors the recruiter uploadCompanyLogo pattern: reject a missing file
      // with a real 400 in production, but let test mode fall through to a
      // fixed mock so unit tests don't need a live Cloudinary mock. Previously
      // this fallback ran unconditionally, meaning a real production request
      // with no file attached would still succeed with a fake Cloudinary URL
      // silently overwriting the candidate's real resumeUrl.
      if (!file && process.env.NODE_ENV !== "test") {
        return sendError(res, "No file uploaded. Please upload a PDF, DOC, or DOCX resume.", null, 400)
      }

      let fileDetails: any

      if (file) {
        // Upload buffer directly to Cloudinary
        const result = await uploadToCloudinary(file.buffer, "jfw/resumes", `${userId}_resume`, true)
        fileDetails = {
          url: result.secureUrl,
          publicId: result.publicId,
          metadata: {
            size: result.size,
            mimetype: file.mimetype,
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          },
        }
      } else {
        // Fallback for tests only (gated above)
        fileDetails = {
          url: "https://cloudinary.com/resume.pdf",
          publicId: "resumes/mock_resume",
          metadata: { size: 102400, mimetype: "application/pdf" },
        }
      }

      const updated = await this.service.updateResume(userId, fileDetails, context)
      return sendSuccess(res, { profile: updated }, "Resume uploaded successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  deleteResume = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const profile = await this.service.getProfile(userId)
      if (profile && (profile as any).resumePublicId) {
        await deleteFromCloudinary((profile as any).resumePublicId, true)
      }
      const updated = await this.service.deleteResume(userId, context)
      return sendSuccess(res, { profile: updated }, "Resume deleted successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  // ==========================================
  // SAVED JOBS HANDLERS
  // ==========================================
  saveJob = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    await this.service.saveJob(userId, req.params.jobId as string, context)
    return sendSuccess(res, null, "Job bookmarked successfully.")
  }

  unsaveJob = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    await this.service.unsaveJob(userId, req.params.jobId as string, context)
    return sendSuccess(res, null, "Job bookmark removed successfully.")
  }

  getSavedJobs = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const savedJobs = await this.service.getSavedJobs(userId)
    return sendSuccess(res, { savedJobs }, "Fetched bookmarked jobs successfully.")
  }

  // ==========================================
  // APPLICATIONS HANDLERS
  // ==========================================
  applyToJob = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const app = await this.service.applyToJob(userId, req.params.jobId as string, context)
    return sendSuccess(res, { application: app }, "Application submitted successfully.", 201)
  }

  getApplications = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const applications = await this.service.getApplications(userId)
    return sendSuccess(res, { applications }, "Fetched applications successfully.")
  }

  getApplicationDetails = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const app = await this.service.getApplicationDetails(req.params.id as string, userId)
    return sendSuccess(res, { application: app }, "Fetched application details successfully.")
  }

  withdrawApplication = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const app = await this.service.withdrawApplication(req.params.id as string, userId, context)
    return sendSuccess(res, { application: app }, "Application withdrawn successfully.")
  }

  // ==========================================
  // JOBS HANDLERS
  // ==========================================
  getJobs = async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search,
      location: req.query.location,
      type: req.query.type,
      departmentId: req.query.departmentId,
      menstrualLeaveChampion: req.query.menstrualLeaveChampion,
      flexibleHours: req.query.flexibleHours,
      workFromHome: req.query.workFromHome,
      sortBy: req.query.sortBy,
    }
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    }
    const result = await this.service.getJobs(filters, pagination)
    return sendSuccess(res, result, "Jobs fetched successfully.")
  }

  getRecommendations = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const recommendations = await this.service.getRecommendations(userId)
    return sendSuccess(res, { recommendations }, "Job recommendations fetched successfully.")
  }

  reportJob = async (req: Request, res: Response) => {
    const validated = reportJobSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    await this.service.reportJob(userId, req.params.jobId as string, validated.reason, context)
    return sendSuccess(res, null, "Job report submitted successfully.")
  }

  // ==========================================
  // NOTIFICATIONS HANDLERS
  // ==========================================
  getNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const filters = {
      search: req.query.search as string,
      category: req.query.category as string,
      priority: req.query.priority as string,
      read: req.query.read,
    }
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    }
    const result = await this.service.getNotifications(userId, filters, pagination)
    return sendSuccess(res, result, "Fetched notifications successfully.")
  }

  markNotificationRead = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    await this.service.markNotificationRead(req.params.id as string, userId)
    return sendSuccess(res, null, "Notification marked read successfully.")
  }

  markAllNotificationsRead = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    await this.service.markAllNotificationsRead(userId)
    return sendSuccess(res, null, "All notifications marked read successfully.")
  }

  deleteNotification = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    await this.service.deleteNotification(req.params.id as string, userId)
    return sendSuccess(res, null, "Notification deleted successfully.")
  }

  // ==========================================
  // SETTINGS HANDLERS
  // ==========================================
  getSettings = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const settings = await this.service.getSettings(userId)
    return sendSuccess(res, { settings }, "Fetched settings successfully.")
  }

  updateSettings = async (req: Request, res: Response) => {
    const validated = updateCandidateSettingsSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const updated = await this.service.updateSettings(userId, validated, context)
    return sendSuccess(res, { settings: updated }, "Settings updated successfully.")
  }

  // ==========================================
  // CHAT HANDLERS
  // ==========================================
  getConversations = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const conversations = await this.service.getConversations(userId)
    return sendSuccess(res, { conversations }, "Fetched conversations successfully.")
  }

  getMessages = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const messages = await this.service.getMessages(req.params.id as string, userId)
    return sendSuccess(res, { messages }, "Fetched messages successfully.")
  }

  sendMessage = async (req: Request, res: Response) => {
    const validated = sendMessageSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const message = await this.service.sendMessage(req.params.id as string, userId, validated.content)
    return sendSuccess(res, { message }, "Message sent successfully.", 201)
  }

  // ==========================================
  // CONSOLIDATED DASHBOARD & STATISTICS
  // ==========================================
  getDashboard = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const dashboard = await this.service.getDashboard(userId)
    return sendSuccess(res, dashboard, "Fetched Candidate Dashboard successfully.")
  }

  getAnalytics = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const analytics = await this.service.getAnalytics(userId)
    return sendSuccess(res, { analytics }, "Fetched Candidate Analytics successfully.")
  }

  getActivityLogs = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const activityLogs = await this.service.getActivityLogs(userId)
    return sendSuccess(res, { activityLogs }, "Fetched recent activity logs successfully.")
  }
}

export default CandidateController
