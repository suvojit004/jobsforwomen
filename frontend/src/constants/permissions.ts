import { UserRole } from "./roles"

export type Permission = "view_candidate_dashboard" | "view_recruiter_dashboard" | "view_admin_dashboard" | "post_jobs" | "manage_jobs" | "view_applicants" | "manage_company_profile" | "manage_system_users"

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CANDIDATE]: [
    "view_candidate_dashboard",
  ],
  [UserRole.RECRUITER]: [
    "view_recruiter_dashboard",
    "post_jobs",
    "manage_jobs",
    "view_applicants",
    "manage_company_profile",
  ],
  [UserRole.ADMIN]: [
    "view_admin_dashboard",
    "manage_system_users",
    "manage_jobs",
  ],
}
