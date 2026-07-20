import type { Request, Response } from "express"
import { RecruiterService, ServiceContext } from "./recruiter.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { uploadToCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary"
import { logger } from "../../shared/utils/logger"
import { NotificationService } from "../../shared/services/notification.service"
import { ConversationService } from "../../shared/services/conversation.service"
import {
  onboardCompanySchema,
  createJobSchema,
  updateJobSchema,
  progressApplicationSchema,
  scheduleInterviewSchema,
  releaseOfferSchema,
  recruiterSettingsSchema,
  inviteColleagueSchema,
  submitPerkSchema,
  updatePoliciesSchema,
} from "./recruiter.validator"

export class RecruiterController {
  private service = new RecruiterService()

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

  getDashboard = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await this.service.getDashboard(userId)
    return sendSuccess(res, result, "Fetched Recruiter Dashboard successfully.")
  }

  getAnalytics = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await this.service.getAnalytics(userId)
    return sendSuccess(res, result, "Fetched Recruiter Analytics successfully.")
  }

  getJobs = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await this.service.getJobs(userId)
    return sendSuccess(res, { jobs: result }, "Fetched job postings successfully.")
  }

  getJobById = async (req: Request, res: Response, next: any) => {
    try {
      const result = await this.service.getJobById(req.params.id as string)
      return sendSuccess(res, { job: result }, "Fetched job posting successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  onboardCompany = async (req: Request, res: Response) => {
    const validated = onboardCompanySchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.onboardCompany(userId, validated, context)
    return sendSuccess(res, result, "Company onboarded successfully.")
  }

  // ==========================================
  // COMPANY PERK REQUESTS // ==========================================

  submitPerk = async (req: Request, res: Response) => {
    const validated = submitPerkSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.submitOrResubmitPerk(userId, validated.perkName, validated.comment, context)
    return sendSuccess(res, result, "Perk submitted for verification successfully.", 201)
  }

  getPerkRequests = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await this.service.listPerkRequests(userId)
    return sendSuccess(res, { perkRequests: result }, "Fetched perk requests successfully.")
  }

  addPerkDocument = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const perkRequestId = req.params.id as string
    const file = (req as any).file
    if (!file) {
      return sendError(res, "No file uploaded. Please attach a document.", null, 400)
    }
    const category = req.body?.category
    if (!category) {
      return sendError(res, "Document category is required.", null, 400)
    }

    const result = await uploadToCloudinary(
      file.buffer,
      "jfw/perk-documents",
      `${userId}_${category}_${Date.now()}`,
      true,
      file.originalname
    )

    const doc = await this.service.addPerkDocument(userId, perkRequestId, {
      url: result.secureUrl,
      publicId: result.publicId,
      size: result.size,
      mimetype: file.mimetype,
      category,
      originalFilename: file.originalname,
      format: result.format,
    })
    return sendSuccess(res, doc, "Document uploaded successfully.", 201)
  }

  getApprovalTracker = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await this.service.getApprovalTracker(userId)
    return sendSuccess(res, result, "Fetched approval tracker successfully.")
  }

  postJob = async (req: Request, res: Response) => {
    const validated = createJobSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.postJob(userId, validated, context)
    return sendSuccess(res, result, "Job posting created successfully.", 201)
  }

  updateJob = async (req: Request, res: Response) => {
    const validated = updateJobSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.updateJob(req.params.id as string, userId, validated, context)
    return sendSuccess(res, result, "Job posting updated successfully.")
  }

  duplicateJob = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.duplicateJob(req.params.id as string, userId, context)
    return sendSuccess(res, result, "Job duplicated successfully.", 201)
  }

  archiveJob = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.archiveJob(req.params.id as string, userId, context)
    return sendSuccess(res, result, "Job archived successfully.")
  }

  deleteJob = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    await this.service.deleteJob(req.params.id as string, userId, context)
    return sendSuccess(res, null, "Job deleted successfully.")
  }

  lifecycleJob = async (req: Request, res: Response, next: any) => {
    // Previously had no try/catch: Express 4 does not auto-catch rejected
    // promises from async route handlers, so any business error thrown by
    // service.lifecycleJob() (e.g. rejecting Activate on a job that was
    // never admin-approved) became an unhandled promise rejection instead
    // of a JSON error response -- the request would just hang.
    try {
      const action = req.params.action as string
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.lifecycleJob(req.params.id as string, userId, action, context)
      return sendSuccess(res, result, `Job progressed successfully via action: ${action}.`)
    } catch (err: any) {
      next(err)
    }
  }

  getCompanyApplications = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const jobId = req.query.jobId as string
    const result = await this.service.getCompanyApplications(userId, jobId)
    return sendSuccess(res, { applications: result }, "Fetched applicants successfully.")
  }

  progressApplicant = async (req: Request, res: Response, next: any) => {
    try {
      const validated = progressApplicationSchema.parse(req.body)
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.progressApplicant(
        req.params.id as string,
        userId,
        validated.status,
        validated.notes,
        context
      )
      return sendSuccess(res, result, `Applicant status updated to: ${validated.status}`)
    } catch (err: any) {
      if (err.message.includes("transition") || err.message.includes("state") || err.message.includes("requires")) {
        return res.status(400).json({ success: false, message: err.message })
      }
      next(err)
    }
  }

  scheduleInterview = async (req: Request, res: Response, next: any) => {
    try {
      const validated = scheduleInterviewSchema.parse(req.body)
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const result = await this.service.scheduleInterview(req.params.id as string, userId, validated, context)
      return sendSuccess(res, result, "Interview scheduled successfully.", 201)
    } catch (err: any) {
      if (err.message?.includes("state") || err.message?.includes("Cannot")) {
        return res.status(400).json({ success: false, message: err.message })
      }
      next(err)
    }
  }

  releaseOffer = async (req: Request, res: Response, next: any) => {
    try {
      const validated = releaseOfferSchema.parse(req.body)
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      // uploadOfferLetterMiddleware (recruiter.routes.ts) populates req.file
      // only when the recruiter actually attached one -- optional, so
      // releasing a text-only offer still works exactly as before.
      const offerLetterFile = (req as any).file as
        | { buffer: Buffer; mimetype: string; originalname?: string }
        | undefined
      const result = await this.service.releaseOffer(
        req.params.id as string,
        userId,
        validated,
        context,
        offerLetterFile
      )
      return sendSuccess(res, result, "Offer released successfully.")
    } catch (err: any) {
      if (err.message?.includes("state") || err.message?.includes("Cannot")) {
        return res.status(400).json({ success: false, message: err.message })
      }
      next(err)
    }
  }

  getSettings = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const settings = await this.service.getSettings(userId)
    return sendSuccess(res, { settings }, "Fetched preferences successfully.")
  }

  updateSettings = async (req: Request, res: Response) => {
    const validated = recruiterSettingsSchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const settings = await this.service.updateSettings(userId, validated, context)
    return sendSuccess(res, { settings }, "Preferences updated successfully.")
  }

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
    const result = await NotificationService.getNotifications(userId, filters, pagination)
    return sendSuccess(res, result, "Fetched notifications successfully.")
  }

  markNotificationRead = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    await NotificationService.markNotificationRead(req.params.id as string, userId)
    return sendSuccess(res, null, "Notification marked read successfully.")
  }

  markAllNotificationsRead = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    await NotificationService.markAllNotificationsRead(userId)
    return sendSuccess(res, null, "All notifications marked read successfully.")
  }

  deleteNotification = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    await NotificationService.deleteNotification(req.params.id as string, userId)
    return sendSuccess(res, null, "Notification deleted successfully.")
  }

  getConversations = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const conversations = await ConversationService.getConversations(userId)
    return sendSuccess(res, { conversations }, "Fetched conversations successfully.")
  }

  getMessages = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const messages = await ConversationService.getMessages(req.params.id as string, userId)
    return sendSuccess(res, { messages }, "Fetched messages successfully.")
  }

  sendMessage = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const { content } = req.body
    const result = await ConversationService.sendMessage(req.params.id as string, userId, content)
    return sendSuccess(res, result, "Message sent successfully.")
  }

  markConversationAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const result = await ConversationService.markConversationAsRead(req.params.id as string, userId)
    return sendSuccess(res, result, "Conversation marked as read.")
  }

  // mirrors candidate.controller.ts's
  // startConversation -- see ConversationService.getOrCreateForApplication.
  // Lets a recruiter open (or resume) a chat with the candidate who applied
  // to one of their jobs directly from the Applicants pipeline.
  startConversation = async (req: Request, res: Response) => {
    const userId = req.user?.userId || ""
    const conversation = await ConversationService.getOrCreateForApplication(req.params.id as string, userId)
    return sendSuccess(res, { conversation }, "Conversation ready.", 201)
  }

  uploadCompanyLogo = async (req: Request, res: Response, next: any) => {
    try {
      const file = (req as any).file
      const userId = req.user?.userId || ""
      const context = this.getContext(req)

      if (!file && process.env.NODE_ENV !== "test") {
        return sendError(res, "No file uploaded. Please upload a valid company logo image.", null, 400)
      }

      let logoDetails: any

      if (file) {
        // Upload new logo buffer to Cloudinary
        const result = await uploadToCloudinary(file.buffer, "jfw/logos", `${userId}_logo`, false)
        logoDetails = {
          url: result.secureUrl,
          publicId: result.publicId,
          metadata: { size: result.size, mimetype: file.mimetype }
        }
      } else {
        // Fallback for tests
        logoDetails = {
          url: "https://cloudinary.com/logo.png",
          publicId: "logos/mock_logo",
          metadata: { size: 51200, mimetype: "image/png" }
        }
      }

      try {
        const updatedCompany = await this.service.updateCompanyLogo(userId, logoDetails, context)
        return sendSuccess(res, { company: updatedCompany }, "Company logo updated successfully.")
      } catch (dbErr: any) {
        // DB update failed after the new asset was already uploaded to Cloudinary.
        // Clean up the newly uploaded asset (safe: it was never persisted to any
        // company record) instead of leaving it orphaned, and let the old logo
        // (still referenced by the DB) remain untouched.
        if (file && logoDetails?.publicId) {
          try {
            await deleteFromCloudinary(logoDetails.publicId, false)
          } catch (cleanupErr: any) {
            logger.warn(`[Cloudinary] Failed to clean up orphaned logo upload after DB error: ${cleanupErr.message}`)
          }
        }
        throw dbErr
      }
    } catch (err: any) {
      next(err)
    }
  }

  deleteCompanyLogo = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const updatedCompany = await this.service.deleteCompanyLogo(userId, context)
      return sendSuccess(res, { company: updatedCompany }, "Company logo deleted successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  // ==========================================
  // COMPANY PROFILE: OFFICE PHOTO GALLERY // ==========================================
  uploadGalleryPhoto = async (req: Request, res: Response, next: any) => {
    try {
      const file = (req as any).file
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const caption = req.body?.caption

      if (!file && process.env.NODE_ENV !== "test") {
        return sendError(res, "No file uploaded. Please upload a valid photo.", null, 400)
      }

      let photoDetails: any

      if (file) {
        // Unlike the logo (one deterministic public_id per company, so a
        // re-upload overwrites), gallery photos are many-per-company, so
        // each upload needs its own unique public_id.
        const uniqueName = `${userId}_gallery_${Date.now()}_${Math.round(Math.random() * 1e6)}`
        const result = await uploadToCloudinary(file.buffer, "jfw/gallery", uniqueName, false)
        photoDetails = {
          url: result.secureUrl,
          publicId: result.publicId,
          size: result.size,
          mimetype: file.mimetype,
          caption: caption || undefined,
        }
      } else {
        // Fallback for tests
        photoDetails = {
          url: "https://cloudinary.com/gallery.png",
          publicId: `gallery/mock_${Date.now()}`,
          size: 51200,
          mimetype: "image/png",
          caption: caption || undefined,
        }
      }

      try {
        const updatedCompany = await this.service.addGalleryPhoto(userId, photoDetails, context)
        return sendSuccess(res, { company: updatedCompany }, "Photo added to gallery successfully.", 201)
      } catch (dbErr: any) {
        if (file && photoDetails?.publicId) {
          try {
            await deleteFromCloudinary(photoDetails.publicId, false)
          } catch (cleanupErr: any) {
            logger.warn(`[Cloudinary] Failed to clean up orphaned gallery upload after DB error: ${cleanupErr.message}`)
          }
        }
        throw dbErr
      }
    } catch (err: any) {
      next(err)
    }
  }

  deleteGalleryPhoto = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const publicId = req.body?.publicId
      if (!publicId) {
        return sendError(res, "publicId is required.", null, 400)
      }
      const updatedCompany = await this.service.deleteGalleryPhoto(userId, publicId, context)
      return sendSuccess(res, { company: updatedCompany }, "Photo removed from gallery successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  // ==========================================
  // COMPANY PROFILE: WORKPLACE POLICIES // ==========================================
  updatePolicies = async (req: Request, res: Response, next: any) => {
    try {
      const validated = updatePoliciesSchema.parse(req.body)
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const updatedCompany = await this.service.updatePolicies(userId, validated.policies, context)
      return sendSuccess(res, { company: updatedCompany }, "Company policies updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getTeam = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const result = await this.service.getTeam(userId)
      return sendSuccess(res, result, "Fetched recruiter team members and pending invitations successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  inviteColleague = async (req: Request, res: Response, next: any) => {
    try {
      const validated = inviteColleagueSchema.parse(req.body)
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      const invitation = await this.service.inviteColleague(userId, validated.email, context)
      return sendSuccess(res, invitation, "Colleague invited successfully.", 201)
    } catch (err: any) {
      next(err)
    }
  }

  cancelColleagueInvitation = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const context = this.getContext(req)
      await this.service.cancelColleagueInvitation(userId, req.params.id as string, context)
      return sendSuccess(res, null, "Colleague invitation cancelled successfully.")
    } catch (err: any) {
      next(err)
    }
  }
}

export default RecruiterController
