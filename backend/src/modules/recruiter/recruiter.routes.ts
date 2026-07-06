import { Router } from "express"
import { RecruiterController } from "./recruiter.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireApprovedCompany,
  requireOwnership,
} from "../rbac/rbac.middleware"

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

// Settings Management
router.get("/settings", controller.getSettings)
router.put("/settings", controller.updateSettings)

// Job Management (Requires approved company)
router.post("/jobs", requireApprovedCompany, controller.postJob)
router.put("/jobs/:id", requireApprovedCompany, requireOwnership("Job"), controller.updateJob)
router.post("/jobs/:id/duplicate", requireApprovedCompany, requireOwnership("Job"), controller.duplicateJob)
router.post("/jobs/:id/archive", requireApprovedCompany, requireOwnership("Job"), controller.archiveJob)
router.post("/jobs/:id/lifecycle/:action", requireApprovedCompany, requireOwnership("Job"), controller.lifecycleJob)
router.delete("/jobs/:id", requireApprovedCompany, requireOwnership("Job"), controller.deleteJob)

// Applicants Pipeline Management (Requires approved company)
router.get("/applications", requireApprovedCompany, controller.getCompanyApplications)
router.put("/applications/:id/status", requireApprovedCompany, requireOwnership("Application"), controller.progressApplicant)

export default router
