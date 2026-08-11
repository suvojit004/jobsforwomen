import { Router } from "express"
import { AdminController } from "./admin.controller"
import { authenticateToken, requireRole } from "../../shared/middleware/auth.middleware"
import {
  requireActiveUser,
  requireSuperAdmin,
  requirePermission,
  requireAll,
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
// (dashboard/health/search/audits/personal notification inbox) are
// deliberately left on their existing role-based gates rather than
// force-fitting a permission that doesn't actually describe them.
// (perks/invitations/admin-management/platform-settings used to be in this
// deliberately-unmapped list too -- manage:perks/manage:invitations/
// manage:admins/manage:platform-settings were added specifically to close
// that gap, see the sections below.)
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
// REPLACE: manage:perks is seeded to all four admin-tier roles today (the
// same set the blanket gate above already let through), so this is a
// zero-regression swap from "any admin-tier role" to "any admin-tier role
// that holds manage:perks" -- which today is everyone, but now genuinely
// depends on the RBAC Matrix rather than being unconditional.
router.get("/perks", requirePermission(["manage:perks"]), controller.listPerkRequests)
router.post("/perks/:id/review", requirePermission(["manage:perks"]), controller.reviewPerkRequest)

// Job listings moderation (Admin, Super Admin, Moderator).
// REPLACE: read:job is seeded to all four admin-tier roles (no regression);
// moderate:job (formerly two separate permissions, approve:job + reject:job,
// consolidated since nothing ever held one without the other) is seeded to
// exactly Admin/Super Admin/Moderator -- same gap-closing rationale as
// Company Verification above (the section comment always said
// Moderator-and-up only, the code let Support Executive through too).
router.get("/jobs", requirePermission(["read:job"]), controller.listJobs)
router.post("/jobs/:id/moderate", requirePermission(["moderate:job"]), controller.moderateJob)

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
// LAYER: verify:recruiters is seeded to exactly Admin + Super Admin, same as
// USER_MGMT_ROLES -- zero regression, but this previously had no permission
// concept at all despite being as much an admin-tier action as everything
// else on this page.
router.put("/recruiters/:id/verify", requireAll(requireRole(USER_MGMT_ROLES), requirePermission(["verify:recruiters"])), controller.verifyRecruiter)
router.post("/users/:id/action/:action", requireUserManagementRole, controller.userAdministrativeAction)

// Employee invitations (Admin, Super Admin only).
// LAYER: manage:invitations is seeded to exactly Admin + Super Admin, same
// as USER_MGMT_ROLES -- zero regression today.
const requireInvitationManagementRole = requireAll(requireRole(USER_MGMT_ROLES), requirePermission(["manage:invitations"]))
router.get("/invitations", requireInvitationManagementRole, controller.listInvitations)
router.post("/invitations", requireInvitationManagementRole, controller.inviteEmployee)
router.post("/invitations/:id/resend", requireInvitationManagementRole, controller.resendInvitation)
router.post("/invitations/:id/cancel", requireInvitationManagementRole, controller.cancelInvitation)
router.post("/invitations/:id/expire", requireInvitationManagementRole, controller.expireInvitation)

// High Privilege Role & Permission Administration, and user-role assignment,
// used to have a full parallel implementation here (GET /rbac, POST/PUT/
// DELETE /rbac/roles, POST /users/:id/roles) alongside the already-real,
// already-permission-gated /api/v1/rbac/* router (rbac.routes.ts) -- which
// the frontend never actually called. That duplication risked the two
// drifting apart (the guards on role deletion, for one, only ever existed
// on this copy). RolesPermissions.tsx and AdminManagement.tsx now call
// /api/v1/rbac/* directly for all of this instead, so it's removed from
// here rather than kept as a second, unused implementation.

// Admin Management module (Super Admin only, end-to-end -- create/list
// administrator accounts and revoke a single role without recreating the
// user; Suspend/Activate/Delete/Assign-multiple-roles reuse the existing
// USER_MGMT_ROLES + requireSuperAdmin routes above, per the spec's
// "uses reusable services/components" requirement).
// LAYER: manage:admins is seeded to exactly Super Admin, identical to
// requireSuperAdmin -- zero regression, but this module (arguably the most
// sensitive one on the whole admin surface, since it creates/edits other
// admin-tier accounts) previously had no permission concept describing it
// at all.
const requireAdminManagementRole = requireAll(requireSuperAdmin, requirePermission(["manage:admins"]))
router.get("/management/admins", requireAdminManagementRole, controller.listAdmins)
router.post("/management/admins", requireAdminManagementRole, controller.createAdmin)
router.delete("/management/admins/:id/roles/:roleName", requireAdminManagementRole, controller.removeAdminRole)

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
// LAYER: manage:platform-settings is seeded to exactly Admin + Super Admin,
// same as USER_MGMT_ROLES -- zero regression today.
router.get("/platform-settings", controller.getPlatformSettings)
router.put("/platform-settings", requireAll(requireRole(USER_MGMT_ROLES), requirePermission(["manage:platform-settings"])), controller.updatePlatformSettings)

// Personal preferences and notifications for Admin
router.get("/settings", controller.getAdminSettings)
router.put("/settings", controller.updateAdminSettings)
router.get("/notifications", controller.getAdminNotifications)
router.put("/notifications/read-all", controller.markAllAdminNotificationsRead)
router.put("/notifications/:id/read", controller.markAdminNotificationRead)
router.delete("/notifications/:id", controller.deleteAdminNotification)

export default router
