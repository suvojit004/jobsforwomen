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
import type { Request, Response, NextFunction, RequestHandler } from "express"

const router = Router()
const controller = new AdminController()

// Composes several Express middlewares so a route can require ALL of them
// to pass (each middleware in this codebase either calls next() with no
// error on success, or sends its own 4xx response directly and never calls
// next() at all -- see requireRole/requirePermission -- so a bare
// short-circuiting sequence is all that's needed, no error-first plumbing).
// Used below to layer a real requirePermission() check alongside an
// existing, more specific role-name gate without loosening it.
function requireAll(...middlewares: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let i = 0
    const run = (err?: any) => {
      if (err) return next(err)
      if (i >= middlewares.length) return next()
      const mw = middlewares[i++]
      mw(req, res, run)
    }
    run()
  }
}

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

// Platform-wide admin security policy (Inactivity Session Timeout, Force
// Two-Factor) -- every admin-tier role can view it, only Super Admin can
// change it. Deliberately registered BEFORE router.use(enforceTwoFactorPolicy)
// below, not after: if a Super Admin turns Force 2FA on without having
// enrolled their own account first (or their current token predates
// enrollment), the very next /admins/* request -- including the request to
// turn Force 2FA back off -- would otherwise 403 under that same policy,
// permanently locking every admin out of the one screen that could undo it,
// recoverable only via direct database access. This route always stays
// reachable so a Super Admin can never brick themselves this way. Still
// behind requireActiveUser/requireRole/adminRateLimiter/
// enforceAdminSessionTimeout above -- only the 2FA-policy gate is skipped
// for these two routes specifically.
router.get("/security-settings", controller.getSecuritySettings)
router.put("/security-settings", requireSuperAdmin, controller.updateSecuritySettings)

// Deliberately after enforceAdminSessionTimeout (an expired session should
// 401 before a 2FA-policy 403) and applies to every /admins/* route below
// this point -- enrollment itself lives under /auth/2fa/* (session-gated
// only, not admin-tier-gated), so an unenrolled admin can always reach it
// to comply.
router.use(enforceTwoFactorPolicy)

// General Admin Search & Dashboard metrics (Admin, Super Admin, Moderator, Support)
router.get("/dashboard", controller.getDashboard)
router.get("/health", controller.getSystemHealth)
router.get("/storage/orphan-scan", requireSuperAdmin, controller.getOrphanAssetReport)
router.get("/search", controller.globalSearch)

// Real permission-table enforcement (RBAC Matrix, see RolesPermissions.tsx)
// starts below. Applied only where a permission cleanly and unambiguously
// maps to one route's real job -- routes with no matching seeded permission
// (dashboard/health/search/perks/invitations/admin-management/platform-
// settings/audits/personal notification inbox) are deliberately left on
// their existing role-based gates rather than force-fitting a permission
// that doesn't actually describe them.
//
// Two patterns used below:
//   REPLACE -- the permission IS the entire, sole intended boundary for
//     this action (job read/moderate, company view/verify, role/permission
//     CRUD). Swapping the coarse role check for the real permission check
//     closes real gaps where the code allowed more than its own comments
//     promised (see the two Support Executive notes below).
//   LAYER (added AND-condition alongside the existing role gate) -- for
//     destructive/sensitive actions (suspend/delete a user or company,
//     assign roles, flip a feature flag, export the full reports CSV)
//     where loosening today's explicit role boundary wasn't asked for.
//     Every role that currently passes these gates already holds the
//     matching permission in seed.ts, so this is a zero-regression change
//     today -- but if that permission is ever revoked from a role, access
//     now genuinely follows the RBAC Matrix instead of being hardcoded.

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
// LAYER: manage:reports is seeded to exactly Admin + Super Admin today
// (same as the role list below), so this is a no-op in practice right now
// -- but the CSV export now genuinely depends on the RBAC Matrix too, not
// just a hardcoded role name.
const requireReportsExportRole = requireAll(requireRole(["Admin", "Super Admin"]), requirePermission(["manage:reports"]))
router.get(
  "/reports",
  (req, res, next) => (req.query.export === "csv" ? requireReportsExportRole(req, res, next) : next()),
  controller.getReports
)
// Admin, Super Admin only -- declared here (rather than down by the User
// Management section below, where it originally lived) since
// suspend/unsuspend/delete on companies now need it too, and now also
// audits/export just below.
const USER_MGMT_ROLES = ["Admin", "Super Admin"]

router.get("/audits", controller.getAuditLogs)
// Full unfiltered CSV export of the entire audit trail -- restricted to
// Admin/Super Admin (not Moderator/Support Executive), same bar as the
// Reports & Analytics CSV exports, since a full audit dump includes every
// operator's email and IP address across the platform's history.
router.get("/audits/export", requireRole(USER_MGMT_ROLES), controller.exportAuditLogs)
// Destructive -- wipes the entire audit trail. Super-Admin-only, stricter
// than the Admin/Super Admin bar above: this is the platform's own security
// record, not just PII-bearing data, so the bar for deleting it outright is
// the same tier as RBAC and Admin Management (requireSuperAdmin) rather than
// USER_MGMT_ROLES.
router.delete("/audits", requireSuperAdmin, controller.deleteAuditLogs)

// Recruiter / Company Verification (Admin, Super Admin, Moderator).
// REPLACE: manage:companies is seeded to exactly these three roles (not
// Support Executive) -- the route comment always claimed this trio, but the
// code only ever enforced the blanket admin-tier gate above, so Support
// Executive could actually reach these. requirePermission closes that gap.
router.get("/companies", requirePermission(["manage:companies"]), controller.listCompanies)
router.post("/companies/:id/verify", requirePermission(["manage:companies"]), controller.verifyCompany)
// Suspend/delete are real moderation actions against a company's recruiters
// and job visibility, not just a verification-status change -- same
// Admin/Super-Admin-only bar as suspending/deleting an individual user
// account below. LAYER (not replace): manage:companies is also seeded to
// Moderator, who must NOT gain suspend/delete power just by holding it --
// the explicit USER_MGMT_ROLES floor stays.
const requireCompanyManagementRole = requireAll(requireRole(USER_MGMT_ROLES), requirePermission(["manage:companies"]))
router.post("/companies/:id/suspend", requireCompanyManagementRole, controller.suspendCompany)
router.post("/companies/:id/unsuspend", requireCompanyManagementRole, controller.unsuspendCompany)
router.delete("/companies/:id", requireCompanyManagementRole, controller.deleteCompany)

// Company Perk Requests (Parts 6/7/12 -- deliberately a separate module from
// Company Registration Requests above; never mixed into the same queue).
// No seeded permission describes "perks" specifically, so this stays on the
// blanket admin-tier gate rather than force-fitting an unrelated permission.
router.get("/perks", controller.listPerkRequests)
router.post("/perks/:id/review", controller.reviewPerkRequest)

// Job listings moderation (Admin, Super Admin, Moderator).
// REPLACE: read:job is seeded to all four admin-tier roles (no regression);
// approve:job + reject:job are seeded to exactly Admin/Super Admin/Moderator
// -- same gap-closing rationale as Company Verification above (the section
// comment always said Moderator-and-up only, the code let Support Executive
// through too).
router.get("/jobs", requirePermission(["read:job"]), controller.listJobs)
router.post("/jobs/:id/moderate", requirePermission(["approve:job", "reject:job"]), controller.moderateJob)

// User Management (Admin, Super Admin only -- Moderator/Support Executive
// can view/moderate content but must not be able to suspend/ban accounts
// or trigger administrative actions like forced password resets).
// LAYER: manage:users is seeded to exactly Admin + Super Admin today, same
// as USER_MGMT_ROLES -- zero regression now, but access genuinely follows
// the RBAC Matrix going forward instead of only the hardcoded role list.
const requireUserManagementRole = requireAll(requireRole(USER_MGMT_ROLES), requirePermission(["manage:users"]))
router.get("/users", controller.listUsers)
router.put("/users/:id/status", requireUserManagementRole, controller.updateUserStatus)
router.delete("/users/:id", requireUserManagementRole, controller.deleteUser)
router.put("/recruiters/:id/verify", requireRole(USER_MGMT_ROLES), controller.verifyRecruiter)
router.post("/users/:id/action/:action", requireUserManagementRole, controller.userAdministrativeAction)

// Employee invitations (Admin, Super Admin only)
router.get("/invitations", requireRole(USER_MGMT_ROLES), controller.listInvitations)
router.post("/invitations", requireRole(USER_MGMT_ROLES), controller.inviteEmployee)
router.post("/invitations/:id/resend", requireRole(USER_MGMT_ROLES), controller.resendInvitation)
router.post("/invitations/:id/cancel", requireRole(USER_MGMT_ROLES), controller.cancelInvitation)
router.post("/invitations/:id/expire", requireRole(USER_MGMT_ROLES), controller.expireInvitation)

// High Privilege Role & Permission Administration.
// REPLACE: manage:roles is the entire, sole reason this permission exists --
// it's seeded to exactly Super Admin today (identical to requireSuperAdmin,
// so zero regression), but now it's the RBAC Matrix itself that decides who
// can manage roles, not a hardcoded name. This is also what fixes the
// visible bug in RolesPermissions.tsx: before this change, toggling
// "manage:roles" on for any other role had no real effect whatsoever,
// because this exact route -- the one the toggle itself calls
// (PUT /rbac/roles/:id) -- only ever checked requireSuperAdmin.
// GET stays ungated by permission: viewing the matrix has always been open
// to every admin-tier role and nobody should lose that just to look at it.
router.get("/rbac", controller.getRBACData)
router.post("/rbac/roles", requirePermission(["manage:roles"]), controller.createRole)
router.put("/rbac/roles/:id", requirePermission(["manage:roles"]), controller.updateRole)
router.delete("/rbac/roles/:id", requirePermission(["manage:roles"]), controller.deleteRole)
// LAYER (not replace): manage:users is also seeded to Admin, but granting a
// role to a user -- which can include granting Super Admin itself -- stays
// a deliberately narrower, Super-Admin-only action than general user
// management. RbacService.assignRolesToUser (which this delegates to) also
// independently guards against privilege escalation and removing the last
// Super Admin.
router.post("/users/:id/roles", requireAll(requireSuperAdmin, requirePermission(["manage:users"])), controller.assignUserRoles)

// Admin Management module (Super Admin only, end-to-end -- create/list
// administrator accounts and revoke a single role without recreating the
// user; Suspend/Activate/Delete/Assign-multiple-roles reuse the existing
// USER_MGMT_ROLES + requireSuperAdmin routes above, per the spec's
// "uses reusable services/components" requirement).
router.get("/management/admins", requireSuperAdmin, controller.listAdmins)
router.post("/management/admins", requireSuperAdmin, controller.createAdmin)
router.delete("/management/admins/:id/roles/:roleName", requireSuperAdmin, controller.removeAdminRole)

// Platform settings & critical Feature Flags (Enforces Super Admin Safeguards).
// LAYER: manage:features is also seeded to Admin, but flipping a
// platform-wide feature flag stays a deliberately Super-Admin-only action
// -- same reasoning as role assignment above, this permission can only
// narrow that boundary (if ever revoked from Super Admin), never widen it.
const requireFeatureFlagManagementRole = requireAll(requireSuperAdmin, requirePermission(["manage:features"]))
router.get("/feature-flags", controller.getFeatureFlags)
router.post("/feature-flags", requireFeatureFlagManagementRole, controller.createFeatureFlag)
router.put("/feature-flags/:id", requireFeatureFlagManagementRole, controller.updateFeatureFlag)
router.delete("/feature-flags/:id", requireFeatureFlagManagementRole, controller.deleteFeatureFlag)

// (security-settings routes moved above router.use(enforceTwoFactorPolicy) --
// see the comment there for why.)

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
