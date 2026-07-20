import { Router } from "express"
import { AdminController } from "./admin.controller"
import { authenticateToken, requireRole } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireSuperAdmin,
  requirePermission,
} from "../rbac/rbac.middleware"
import { adminRateLimiter } from "../../shared/middleware/rateLimit.middleware"

const router = Router()
const controller = new AdminController()

// CONFIRMED CRITICAL BUG (fixed here): every route below this point used to
// be reachable by ANY authenticated, active user regardless of role --
// job moderation, user suspend/ban, company verification, and admin
// invitations only ever checked authenticateToken + requireActiveUser. The
// service layer fetches `admin`/`adminId` purely for audit attribution
// (e.g. `admin?.email`), it never actually verifies the caller holds an
// admin-tier role. A logged-in Candidate or Recruiter JWT could call
// POST /admins/jobs/:id/moderate, PUT /admins/users/:id/status,
// POST /admins/companies/:id/verify, etc. directly and it would succeed.
// This restores the access levels the route comments already documented
// but never enforced.
const ADMIN_TIER_ROLES = ["Admin", "Super Admin", "Moderator", "Support Executive"]

// Enforce authentication & active check for all administration endpoints
router.use(authenticateToken)
router.use(requireActiveUser)
router.use(requireRole(ADMIN_TIER_ROLES))
// Moderate, user-keyed limiter -- protects against abuse (compromised admin
// credentials, a buggy client hammering an endpoint) while staying loose
// enough for legitimate high-volume moderation sessions.
router.use(adminRateLimiter)

// General Admin Search & Dashboard metrics (Admin, Super Admin, Moderator, Support)
router.get("/dashboard", controller.getDashboard)
router.get("/health", controller.getSystemHealth)
router.get("/storage/orphan-scan", requireSuperAdmin, controller.getOrphanAssetReport)
router.get("/search", controller.globalSearch)

// Audits & Reports (Admin, Super Admin)
router.get("/reports", controller.getReports)
router.get("/audits", controller.getAuditLogs)

// Support ticket submission (Admin Help & Support page)
router.post("/support-ticket", controller.submitSupportTicket)

// Recruiter / Company Verification (Admin, Super Admin, Moderator)
router.get("/companies", controller.listCompanies)
router.post("/companies/:id/verify", controller.verifyCompany)

// Company Perk Requests (Parts 6/7/12 -- deliberately a separate module from
// Company Registration Requests above; never mixed into the same queue)
router.get("/perks", controller.listPerkRequests)
router.post("/perks/:id/review", controller.reviewPerkRequest)

// Job listings moderation (Admin, Super Admin, Moderator)
router.get("/jobs", controller.listJobs)
router.post("/jobs/:id/moderate", controller.moderateJob)

// User Management (Admin, Super Admin only -- Moderator/Support Executive
// can view/moderate content but must not be able to suspend/ban accounts
// or trigger administrative actions like forced password resets)
const USER_MGMT_ROLES = ["Admin", "Super Admin"]
router.get("/users", controller.listUsers)
router.put("/users/:id/status", requireRole(USER_MGMT_ROLES), controller.updateUserStatus)
router.delete("/users/:id", requireRole(USER_MGMT_ROLES), controller.deleteUser)
router.put("/recruiters/:id/verify", requireRole(USER_MGMT_ROLES), controller.verifyRecruiter)
router.post("/users/:id/action/:action", requireRole(USER_MGMT_ROLES), controller.userAdministrativeAction)

// Employee invitations (Admin, Super Admin only)
router.get("/invitations", requireRole(USER_MGMT_ROLES), controller.listInvitations)
router.post("/invitations", requireRole(USER_MGMT_ROLES), controller.inviteEmployee)
router.post("/invitations/:id/resend", requireRole(USER_MGMT_ROLES), controller.resendInvitation)
router.post("/invitations/:id/cancel", requireRole(USER_MGMT_ROLES), controller.cancelInvitation)
router.post("/invitations/:id/expire", requireRole(USER_MGMT_ROLES), controller.expireInvitation)

// High Privilege Role & Permission Administration (Enforces Super Admin Safeguards)
router.get("/rbac", controller.getRBACData)
router.post("/rbac/roles", requireSuperAdmin, controller.createRole)
router.put("/rbac/roles/:id", requireSuperAdmin, controller.updateRole)
router.delete("/rbac/roles/:id", requireSuperAdmin, controller.deleteRole)
router.post("/users/:id/roles", requireSuperAdmin, controller.assignUserRoles)

// Admin Management module (Super Admin only, end-to-end -- create/list
// administrator accounts and revoke a single role without recreating the
// user; Suspend/Activate/Delete/Assign-multiple-roles reuse the existing
// USER_MGMT_ROLES + requireSuperAdmin routes above, per the spec's
// "uses reusable services/components" requirement).
router.get("/management/admins", requireSuperAdmin, controller.listAdmins)
router.post("/management/admins", requireSuperAdmin, controller.createAdmin)
router.delete("/management/admins/:id/roles/:roleName", requireSuperAdmin, controller.removeAdminRole)

// Platform settings & critical Feature Flags (Enforces Super Admin Safeguards)
router.get("/feature-flags", controller.getFeatureFlags)
router.post("/feature-flags", requireSuperAdmin, controller.createFeatureFlag)
router.put("/feature-flags/:id", requireSuperAdmin, controller.updateFeatureFlag)
router.delete("/feature-flags/:id", requireSuperAdmin, controller.deleteFeatureFlag)

// Personal preferences and notifications for Admin
router.get("/settings", controller.getAdminSettings)
router.put("/settings", controller.updateAdminSettings)
router.get("/notifications", controller.getAdminNotifications)
router.put("/notifications/read-all", controller.markAllAdminNotificationsRead)
router.put("/notifications/:id/read", controller.markAdminNotificationRead)
router.delete("/notifications/:id", controller.deleteAdminNotification)

export default router
