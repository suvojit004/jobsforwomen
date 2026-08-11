import { Router } from "express"
import { RecruiterController } from "./recruiter.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireApprovedCompany,
  requireOwnership,
  requirePermission,
} from "../rbac/rbac.middleware"
import { uploadLogoMiddleware, uploadPerkDocumentMiddleware, uploadGalleryPhotoMiddleware, uploadOfferLetterMiddleware } from "../../shared/middleware/upload.middleware"
import { recruiterRateLimiter, uploadRateLimiter } from "../../shared/middleware/rateLimit.middleware"

const router = Router()
const controller = new RecruiterController()

// Apply authentication to all recruiter endpoints
router.use(authenticateToken)
router.use(requireActiveUser)
// User-keyed moderate-tier limiter for everything below; file-upload routes
// get the stricter upload tier layered on top further down.
router.use(recruiterRateLimiter)

// Recruiter Dashboard & Analytics
router.get("/dashboard", controller.getDashboard)
router.get("/analytics", controller.getAnalytics)

// Company Onboarding Wizard (Does NOT require approved company)
router.post("/company/onboard", controller.onboardCompany)
router.post("/company/logo", uploadRateLimiter, uploadLogoMiddleware, controller.uploadCompanyLogo)
router.delete("/company/logo", controller.deleteCompanyLogo)

// Company Profile expansion -- office photo gallery + workplace
// policies. Gated behind requireApprovedCompany like Perks, since this is
// part of the post-approval Company Profile area, not the initial
// onboarding wizard.
router.post("/company/gallery", requireApprovedCompany, uploadRateLimiter, uploadGalleryPhotoMiddleware, controller.uploadGalleryPhoto)
// publicId is passed in the request body, not a URL param -- these storage
// paths contain folder slashes (e.g. "jfw/gallery/xyz.png"), which would
// otherwise need awkward double-encoding to survive as a single path segment.
router.delete("/company/gallery", requireApprovedCompany, controller.deleteGalleryPhoto)
router.put("/company/policies", requireApprovedCompany, controller.updatePolicies)

// Company Perk Requests (Parts 6/7 -- independent from company registration
// approval, requires approved company since it's part of the post-approval
// Company Profile area per Part 5)
router.post("/perks/submit", requireApprovedCompany, controller.submitPerk)
router.get("/perks", requireApprovedCompany, controller.getPerkRequests)
router.post("/perks/:id/documents", requireApprovedCompany, uploadRateLimiter, uploadPerkDocumentMiddleware, controller.addPerkDocument)

// Approval Requests tracker -- consolidated Company Registration
// status/history + Perk Requests overview
router.get("/approvals", requireApprovedCompany, controller.getApprovalTracker)

// Settings Management
router.get("/settings", controller.getSettings)
router.put("/settings", controller.updateSettings)

// Job Management (Requires approved company).
// This whole router previously had no role/permission gate at all beyond
// authentication -- POST/PUT/DELETE /jobs relied entirely on
// requireApprovedCompany (a no-op for any non-Recruiter, since it just
// bypasses -- see rbac.middleware.ts) and requireOwnership (which has
// nothing to check yet on create). Any authenticated, active user could
// technically reach these. manage:job (create/update/delete, consolidated
// into one permission -- nothing ever held one without the others) and
// read:job are seeded to exactly Recruiter (+ Admin/Super Admin, who don't
// route through here in practice), so wiring them in is a real,
// zero-regression hardening for the mutating routes. GET is left with
// read:job too for consistency, though note Candidate also holds read:job
// (for browsing public listings on the candidate side) -- this doesn't add
// protection against a Candidate specifically reaching a recruiter's own
// job list, that gap is a limitation of the current permission model, not
// something introduced here.
router.get("/jobs", requireApprovedCompany, requirePermission(["read:job"]), controller.getJobs)
router.get("/jobs/:id", requireApprovedCompany, requirePermission(["read:job"]), requireOwnership("Job"), controller.getJobById)
router.post("/jobs", requireApprovedCompany, requirePermission(["manage:job"]), controller.postJob)
router.put("/jobs/:id", requireApprovedCompany, requirePermission(["manage:job"]), requireOwnership("Job"), controller.updateJob)
router.post("/jobs/:id/duplicate", requireApprovedCompany, requirePermission(["manage:job"]), requireOwnership("Job"), controller.duplicateJob)
router.post("/jobs/:id/archive", requireApprovedCompany, requirePermission(["manage:job"]), requireOwnership("Job"), controller.archiveJob)
router.post("/jobs/:id/lifecycle/:action", requireApprovedCompany, requirePermission(["manage:job"]), requireOwnership("Job"), controller.lifecycleJob)
router.delete("/jobs/:id", requireApprovedCompany, requirePermission(["manage:job"]), requireOwnership("Job"), controller.deleteJob)

// Applicants Pipeline Management (Requires approved company)
router.get("/applications", requireApprovedCompany, controller.getCompanyApplications)
router.put("/applications/:id/status", requireApprovedCompany, requireOwnership("Application"), controller.progressApplicant)
router.post("/applications/:id/interview", requireApprovedCompany, requireOwnership("Application"), controller.scheduleInterview)
router.post("/applications/:id/offer", requireApprovedCompany, requireOwnership("Application"), uploadRateLimiter, uploadOfferLetterMiddleware, controller.releaseOffer)
// Team management (Requires approved company)
router.get("/team", requireApprovedCompany, controller.getTeam)
router.post("/team/invite", requireApprovedCompany, controller.inviteColleague)
router.post("/team/invitations/:id/cancel", requireApprovedCompany, controller.cancelColleagueInvitation)

// Notifications
router.get("/notifications", controller.getNotifications)
router.put("/notifications/read-all", controller.markAllNotificationsRead)
router.put("/notifications/:id/read", controller.markNotificationRead)
router.delete("/notifications/:id", controller.deleteNotification)

export default router
