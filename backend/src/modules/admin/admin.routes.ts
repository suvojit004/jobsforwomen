import { Router } from "express"
import { AdminController } from "./admin.controller"
import { authenticateToken, requireRole } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireSuperAdmin,
  requirePermission,
} from "../rbac/rbac.middleware"
import { adminRateLimiter } from "../../shared/middleware/rateLimit.middleware"
import { enforceAdminSessionTimeout, enforceTwoFactorPolicy } from "../../shared/middleware/securityPolicy.middleware"
import { ADMIN_TIER_ROLES } from "../../shared/constants/roles"

const router = Router()
const controller = new AdminController()

// Every route below requires an admin-tier role -- the service layer fetches
// `admin`/`adminId` only for audit attribution, it doesn't itself verify
// role, so this route-level gate is the actual enforcement point. (List now
// lives in shared/constants/roles.ts -- also used by AuthService's login
// lockout scoping and enforceTwoFactorPolicy, so the two copies can't drift.)

// Enforce authentication & active check for all administration endpoints
router.use(authenticateToken)
router.use(requireActiveUser)
router.use(requireRole(ADMIN_TIER_ROLES))
// Moderate, user-keyed limiter -- protects against abuse (compromised admin
// credentials, a buggy client hammering an endpoint) while staying loose
// enough for legitimate high-volume moderation sessions.
router.use(adminRateLimiter)
// Real "Inactivity Session Timeout" and "Force Two-Factor (2FA)" enforcement
// (see Administrative Settings > Platform Security Policies). Both no-op
// when their policy is unset/disabled -- see securityPolicy.middleware.ts.
router.use(enforceAdminSessionTimeout)
// Deliberately after enforceAdminSessionTimeout (an expired session should
// 401 before a 2FA-policy 403) and applies to every /admins/* route --
// enrollment itself lives under /auth/2fa/* (session-gated only, not
// admin-tier-gated), so an unenrolled admin can always reach it to comply.
router.use(enforceTwoFactorPolicy)

// General Admin Search & Dashboard metrics (Admin, Super Admin, Moderator, Support)
router.get("/dashboard", controller.getDashboard)
router.get("/health", controller.getSystemHealth)
router.get("/storage/orphan-scan", requireSuperAdmin, controller.getOrphanAssetReport)
router.get("/search", controller.globalSearch)

// Audits & Reports (Admin, Super Admin)
// The comment above always claimed Admin/Super Admin only, but /reports had
// no extra gate beyond the blanket ADMIN_TIER_ROLES check above -- meaning
// Moderator and Support Executive could already hit it. That was a minor
// gap when the CSV export was a handful of summary columns; now that it
// includes full candidate/recruiter/company PII plus signed resume and
// verification-document links (see AdminService.getReports), the actual
// file download needs the real restriction the comment always implied.
// Scoped to the export=csv path specifically, not the whole endpoint --
// Moderator/Support Executive still need the plain JSON summary this same
// route returns to render the Reports & Analytics trend chart.
const requireReportsExportRole = requireRole(["Admin", "Super Admin"])
router.get(
  "/reports",
  (req, res, next) => (req.query.export === "csv" ? requireReportsExportRole(req, res, next) : next()),
  controller.getReports
)
router.get("/audits", controller.getAuditLogs)

// Admin, Super Admin only -- declared here (rather than down by the User
// Management section below, where it originally lived) since
// suspend/unsuspend/delete on companies now need it too.
const USER_MGMT_ROLES = ["Admin", "Super Admin"]

// Recruiter / Company Verification (Admin, Super Admin, Moderator)
router.get("/companies", controller.listCompanies)
router.post("/companies/:id/verify", controller.verifyCompany)
// Suspend/delete are real moderation actions against a company's recruiters
// and job visibility, not just a verification-status change -- same
// Admin/Super-Admin-only bar as suspending/deleting an individual user
// account below.
router.post("/companies/:id/suspend", requireRole(USER_MGMT_ROLES), controller.suspendCompany)
router.post("/companies/:id/unsuspend", requireRole(USER_MGMT_ROLES), controller.unsuspendCompany)
router.delete("/companies/:id", requireRole(USER_MGMT_ROLES), controller.deleteCompany)

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

// Platform-wide admin security policy (currently just the Inactivity Session
// Timeout) -- every admin-tier role can view it, only Super Admin can change
// it, same gating pattern as Feature Flags above.
router.get("/security-settings", controller.getSecuritySettings)
router.put("/security-settings", requireSuperAdmin, controller.updateSecuritySettings)

// General, non-security platform settings (currently just the "Operations
// Support Contacts" technical helpdesk email on the admin Help & Support
// page -- previously hardcoded in HelpSupport.tsx with no way to change it
// without a code deploy). Every admin-tier role can view it; unlike
// security-settings above, Admin (not just Super Admin) can also change it,
// same USER_MGMT_ROLES bar as the User Management section.
router.get("/platform-settings", controller.getPlatformSettings)
router.put("/platform-settings", requireRole(USER_MGMT_ROLES), controller.updatePlatformSettings)

// Personal preferences and notifications for Admin
router.get("/settings", controller.getAdminSettings)
router.put("/settings", controller.updateAdminSettings)
router.get("/notifications", controller.getAdminNotifications)
router.put("/notifications/read-all", controller.markAllAdminNotificationsRead)
router.put("/notifications/:id/read", controller.markAdminNotificationRead)
router.delete("/notifications/:id", controller.deleteAdminNotification)

export default router
