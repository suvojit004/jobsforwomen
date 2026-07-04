export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/v1/auth/login",
    LOGOUT: "/api/v1/auth/logout",
    ME: "/api/v1/auth/me",
    REFRESH: "/api/v1/auth/refresh",
  },
  CANDIDATE: {
    PROFILE: "/api/v1/candidates/profile",
    RESUME_UPLOAD: "/api/v1/candidates/resume/upload",
    APPLY: "/api/v1/candidates/jobs/:id/apply",
    APPLICATIONS: "/api/v1/candidates/applications",
    SAVED_JOBS: "/api/v1/candidates/saved-jobs",
  },
  RECRUITER: {
    JOBS: "/api/v1/recruiters/jobs",
    JOB_DETAILS: "/api/v1/recruiters/jobs/:id",
    APPLICANTS: "/api/v1/recruiters/applicants",
    APPLICANT_STATUS: "/api/v1/recruiters/applicants/:id/status",
    COMPANY_PROFILE: "/api/v1/recruiters/company",
  },
  ADMIN: {
    USERS: "/api/v1/admin/users",
    JOBS: "/api/v1/admin/jobs",
    COMPANIES: "/api/v1/admin/companies",
    METRICS: "/api/v1/admin/analytics/summary",
  },
} as const
export default ENDPOINTS
