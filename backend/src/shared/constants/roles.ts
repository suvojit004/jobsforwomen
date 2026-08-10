// Single source of truth for "admin-tier" role names -- previously
// duplicated ad hoc (admin.routes.ts's ADMIN_TIER_ROLES local const,
// auth.validator.ts's inviteEmployeeSchema enum) with real risk of the
// copies silently drifting apart. Anything that needs to ask "is this
// account admin-tier" (route gating, login lockout scoping, Force 2FA
// policy, etc.) should import this rather than re-declaring its own list.
// Deliberately typed as a plain string[] (not `as const`) -- requireRole()
// and other consumers expect a mutable string[] parameter, and a readonly
// tuple isn't assignable to that.
export const ADMIN_TIER_ROLES: string[] = ["Admin", "Super Admin", "Moderator", "Support Executive"]

// Every role seed.ts creates on every run -- the platform's own
// authorization model (route gates, invitation/onboarding flows) assumes
// these exist. Never deletable through any admin-facing role-management
// endpoint. Previously duplicated as a private `SYSTEM_ROLES` constant
// inside admin.service.ts; centralized here since RbacService.deleteRole
// (the endpoint that now actually serves role deletion, see rbac.routes.ts)
// needs the same guard.
export const SYSTEM_ROLES: string[] = ["Candidate", "Recruiter", "Moderator", "Admin", "Super Admin", "Support Executive"]
