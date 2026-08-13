import { Router } from "express"
import { CandidateController } from "./candidate.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import { uploadResumeMiddleware, uploadAvatarMiddleware } from "../../shared/middleware/upload.middleware"
import {
  requireActiveUser,
  requireVerifiedEmail,
  requireProfileCompleted,
  requireOwnership,
} from "../rbac/rbac.middleware"
import { candidateRateLimiter, uploadRateLimiter, searchRateLimiter } from "../../shared/middleware/rateLimit.middleware"

const router = Router()
const controller = new CandidateController()

// Apply authentication and active user checks to all candidate APIs
router.use(authenticateToken)
router.use(requireActiveUser)
// User-keyed moderate-tier limiter for everything below; job search/browse
// and resume uploads get their own tighter/looser tiers layered on top of
// specific routes further down (see env.ts's RATE_LIMIT_* tiers).
router.use(candidateRateLimiter)

// Consolidated Dashboard & Analytics
router.get("/dashboard", controller.getDashboard)
router.get("/analytics", controller.getAnalytics)
router.get("/activity", controller.getActivityLogs)

// Profile operations (ownership handled via userId lookup internally)
router.get("/profile", controller.getProfile)
router.put("/profile", controller.updateProfile)
router.get("/profile/completion", controller.getProfileCompletion)

// Resume upload & delete
router.post("/resume", uploadRateLimiter, uploadResumeMiddleware, controller.uploadResume)
router.delete("/resume", controller.deleteResume)

// Profile photo upload & delete
router.post("/avatar", uploadRateLimiter, uploadAvatarMiddleware, controller.uploadAvatar)
router.delete("/avatar", controller.deleteAvatar)

// Saved Jobs Bookmarks
router.get("/saved-jobs", controller.getSavedJobs)
router.post("/saved-jobs/:jobId", controller.saveJob)
router.delete("/saved-jobs/:jobId", controller.unsaveJob)

// Settings Management
router.get("/settings", controller.getSettings)
router.put("/settings", controller.updateSettings)

// Notifications Management
router.get("/notifications", controller.getNotifications)
router.put("/notifications/read-all", controller.markAllNotificationsRead)
router.put("/notifications/:id/read", controller.markNotificationRead)
router.delete("/notifications/:id", controller.deleteNotification)

// Jobs Discovery & Reporting -- search/browse gets the higher "search" tier
// instead of the standard candidate tier (legitimate paging/filtering fires
// many requests quickly).
router.get("/jobs", searchRateLimiter, controller.getJobs)
router.get("/jobs/recommendations", searchRateLimiter, controller.getRecommendations)
// Must stay registered after the static "/jobs/recommendations" route above
// -- otherwise this would swallow it (treating "recommendations" as :jobId)
// since Express matches routes in registration order.
router.get("/jobs/:jobId", searchRateLimiter, controller.getJobById)
router.post("/jobs/:jobId/report", controller.reportJob)

// Job Applications (Apply requires verified email & completed profile)
router.get("/applications", controller.getApplications)
router.get("/applications/:id", requireOwnership("Application"), controller.getApplicationDetails)
router.post("/jobs/:jobId/apply", requireVerifiedEmail, requireProfileCompleted, controller.applyToJob)
router.post("/applications/:id/withdraw", requireOwnership("Application"), controller.withdrawApplication)

export default router
