import type { Request, Response } from "express"
import { RecruiterService, ServiceContext } from "./recruiter.service"
import { sendSuccess } from "../../shared/utils/response"
import {
  onboardCompanySchema,
  createJobSchema,
  updateJobSchema,
  progressApplicationSchema,
  recruiterSettingsSchema,
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

  onboardCompany = async (req: Request, res: Response) => {
    const validated = onboardCompanySchema.parse(req.body)
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.onboardCompany(userId, validated, context)
    return sendSuccess(res, result, "Company onboarded successfully.")
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

  lifecycleJob = async (req: Request, res: Response) => {
    const action = req.params.action as string
    const userId = req.user?.userId || ""
    const context = this.getContext(req)
    const result = await this.service.lifecycleJob(req.params.id as string, userId, action, context)
    return sendSuccess(res, result, `Job progressed successfully via action: ${action}.`)
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
      if (err.message.includes("transition") || err.message.includes("state")) {
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
}

export default RecruiterController
