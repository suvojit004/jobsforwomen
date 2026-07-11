import { Router } from "express"
import { AdminController } from "./admin.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireSuperAdmin,
  requirePermission,
} from "../rbac/rbac.middleware"

const router = Router()
const controller = new AdminController()

// Enforce authentication & active check for all administration endpoints
router.use(authenticateToken)
router.use(requireActiveUser)

// General Admin Search & Dashboard metrics (Admin, Super Admin, Moderator, Support)
router.get("/dashboard", controller.getDashboard)
router.get("/health", controller.getSystemHealth)
router.get("/search", controller.globalSearch)

// Audits & Reports (Admin, Super Admin)
router.get("/reports", controller.getReports)
router.get("/audits", controller.getAuditLogs)

// Recruiter / Company Verification (Admin, Super Admin, Moderator)
router.get("/companies", controller.listCompanies)
router.post("/companies/:id/verify", controller.verifyCompany)

// Job listings moderation (Admin, Super Admin, Moderator)
router.get("/jobs", controller.listJobs)
router.post("/jobs/:id/moderate", controller.moderateJob)

// User Management (Admin, Super Admin)
router.get("/users", controller.listUsers)
router.put("/users/:id/status", controller.updateUserStatus)
router.put("/recruiters/:id/verify", controller.verifyRecruiter)
router.post("/users/:id/action/:action", controller.userAdministrativeAction)

// Employee invitations (Admin, Super Admin)
router.get("/invitations", controller.listInvitations)
router.post("/invitations", controller.inviteEmployee)
router.post("/invitations/:id/resend", controller.resendInvitation)
router.post("/invitations/:id/cancel", controller.cancelInvitation)
router.post("/invitations/:id/expire", controller.expireInvitation)

// High Privilege Role & Permission Administration (Enforces Super Admin Safeguards)
router.get("/rbac", controller.getRBACData)
router.post("/rbac/roles", requireSuperAdmin, controller.createRole)
router.put("/rbac/roles/:id", requireSuperAdmin, controller.updateRole)
router.delete("/rbac/roles/:id", requireSuperAdmin, controller.deleteRole)
router.post("/users/:id/roles", requireSuperAdmin, controller.assignUserRoles)

// Platform settings & critical Feature Flags (Enforces Super Admin Safeguards)
router.get("/feature-flags", controller.getFeatureFlags)
router.post("/feature-flags", requireSuperAdmin, controller.createFeatureFlag)
router.put("/feature-flags/:id", requireSuperAdmin, controller.updateFeatureFlag)
router.delete("/feature-flags/:id", requireSuperAdmin, controller.deleteFeatureFlag)

// Personal preferences and notifications for Admin
router.get("/settings", controller.getAdminSettings)
router.put("/settings", controller.updateAdminSettings)
router.get("/notifications", controller.getAdminNotifications)

export default router
