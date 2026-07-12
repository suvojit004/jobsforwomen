import { Router } from "express"
import { RecruiterController } from "./recruiter.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireApprovedCompany,
  requireOwnership,
} from "../rbac/rbac.middleware"
import { uploadLogoMiddleware } from "../../shared/middleware/upload.middleware"

const router = Router()
const controller = new RecruiterController()

// Apply authentication to all recruiter endpoints
router.use(authenticateToken)
router.use(requireActiveUser)

// Recruiter Dashboard & Analytics
router.get("/dashboard", controller.getDashboard)
router.get("/analytics", controller.getAnalytics)

// Company Onboarding Wizard (Does NOT require approved company)
router.post("/company/onboard", controller.onboardCompany)
router.post("/company/logo", uploadLogoMiddleware, controller.uploadCompanyLogo)
router.delete("/company/logo", controller.deleteCompanyLogo)

// Settings Management
router.get("/settings", controller.getSettings)
router.put("/settings", controller.updateSettings)

// Job Management (Requires approved company)
router.get("/jobs", requireApprovedCompany, controller.getJobs)
router.get("/jobs/:id", requireApprovedCompany, requireOwnership("Job"), controller.getJobById)
router.post("/jobs", requireApprovedCompany, controller.postJob)
router.put("/jobs/:id", requireApprovedCompany, requireOwnership("Job"), controller.updateJob)
router.post("/jobs/:id/duplicate", requireApprovedCompany, requireOwnership("Job"), controller.duplicateJob)
router.post("/jobs/:id/archive", requireApprovedCompany, requireOwnership("Job"), controller.archiveJob)
router.post("/jobs/:id/lifecycle/:action", requireApprovedCompany, requireOwnership("Job"), controller.lifecycleJob)
router.delete("/jobs/:id", requireApprovedCompany, requireOwnership("Job"), controller.deleteJob)

// Applicants Pipeline Management (Requires approved company)
router.get("/applications", requireApprovedCompany, controller.getCompanyApplications)
router.put("/applications/:id/status", requireApprovedCompany, requireOwnership("Application"), controller.progressApplicant)
router.post("/applications/:id/interview", requireApprovedCompany, requireOwnership("Application"), controller.scheduleInterview)
router.post("/applications/:id/offer", requireApprovedCompany, requireOwnership("Application"), controller.releaseOffer)
// Team management (Requires approved company)
router.get("/team", requireApprovedCompany, controller.getTeam)
router.post("/team/invite", requireApprovedCompany, controller.inviteColleague)
router.post("/team/invitations/:id/cancel", requireApprovedCompany, controller.cancelColleagueInvitation)

// Notifications
router.get("/notifications", controller.getNotifications)
router.put("/notifications/read-all", controller.markAllNotificationsRead)
router.put("/notifications/:id/read", controller.markNotificationRead)
router.delete("/notifications/:id", controller.deleteNotification)

// Conversations (Chat)
router.get("/conversations", controller.getConversations)
router.get("/conversations/:id/messages", controller.getMessages)
router.post("/conversations/:id/messages", controller.sendMessage)

export default router
