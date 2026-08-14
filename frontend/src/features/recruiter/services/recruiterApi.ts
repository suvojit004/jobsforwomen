import apiClient from "@/api/client"
import { formatDate } from "@/utils/formatDate"

function mapWorkModeToBackend(mode: string): "Remote" | "Hybrid" | "On_site" {
  if (mode === "On-site") return "On_site"
  if (mode === "Hybrid") return "Hybrid"
  return "Remote"
}

function mapWorkModeFromBackend(mode: string): "Remote" | "Hybrid" | "On-site" {
  if (mode === "On_site") return "On-site"
  if (mode === "Hybrid") return "Hybrid"
  return "Remote"
}

/** Extracts LPA figures like "8" and "12" out of "₹ 8 - 12 LPA" style strings. */
function parseSalaryRange(display: string): { min: number; max: number } {
  const numbers = (display.match(/\d+(\.\d+)?/g) || []).map(Number)
  if (numbers.length >= 2) {
    return { min: Math.round(numbers[0] * 100000), max: Math.round(numbers[1] * 100000) }
  }
  if (numbers.length === 1) {
    return { min: Math.round(numbers[0] * 100000), max: Math.round(numbers[0] * 100000) }
  }
  return { min: 100000, max: 300000 }
}

export interface JobPostingFormValues {
  title: string
  department: string
  customDepartment?: string
  location: string
  salary: string
  customSalary?: string
  experience: string
  customExperience?: string
  type: string
  workMode: string
  deadline: string
  skills: string
  description: string
  responsibilities: string
  requirements: string
  benefits: string
  menstrualLeaveChampion?: boolean
  flexibleHours?: boolean
  workFromHome?: boolean
}

export function buildCreateJobPayload(values: JobPostingFormValues) {
  const salaryDisplay =
    values.salary === "Others" ? values.customSalary || "" : values.salary
  const { min, max } = parseSalaryRange(salaryDisplay)
  const departmentName =
    values.department === "Others" ? values.customDepartment || "General" : values.department

  return {
    title: values.title,
    location: values.location,
    type: values.type,
    workMode: mapWorkModeToBackend(values.workMode),
    description: values.description,
    responsibilities: values.responsibilities,
    requirements: values.requirements,
    benefits: values.benefits,
    deadline: values.deadline,
    salaryDisplay,
    salaryMin: min,
    salaryMax: max,
    // Not persisted by the backend today, but required by the validator.
    experienceMin: 0,
    experienceMax: 0,
    departmentName,
    skills: values.skills
      ? values.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : ["General"],
    menstrualLeaveChampion: !!values.menstrualLeaveChampion,
    flexibleHours: !!values.flexibleHours,
    workFromHome: !!values.workFromHome,
    status: "pending_approval" as const,
  }
}

export interface RecruiterJobRow {
  id: string
  title: string
  department: string
  workMode: "Remote" | "Hybrid" | "On-site"
  type: string
  location: string
  applicants: number
  status: string
  postedOn: string
}

// These four are the only statuses settable through the plain status dropdown.
// "Interview Scheduled" and "Offer Released" require structured data (a real
// date, real offer details) and go through scheduleInterview()/releaseOffer()
// instead -- the backend rejects them here on purpose.
const APPLICANT_STATUS_TO_BACKEND: Record<string, string> = {
  Applied: "Applied",
  "Under Review": "Reviewed",
  Shortlisted: "Shortlisted",
  Selected: "Hired",
  Rejected: "Rejected",
}

// "Shortlisted" is a real, distinct pipeline
// stage in the backend (recruiter.service.ts's ApplicationStatus enum /
// PIPELINE_ORDER), but it was being collapsed into the same "Under Review"
// display label as "Reviewed" -- so recruiters had no way to see, or
// deliberately set, this stage at all through the UI. It's now surfaced as
// its own label.
const APPLICANT_STATUS_FROM_BACKEND: Record<string, string> = {
  Applied: "Applied",
  Reviewed: "Under Review",
  Shortlisted: "Shortlisted",
  InterviewScheduled: "Interview Scheduled",
  OfferReleased: "Offer Released",
  Hired: "Selected",
  Rejected: "Rejected",
  // Not settable through APPLICANT_STATUS_TO_BACKEND above -- only the
  // candidate can put an application into this state.
  Withdrawn: "Withdrawn",
}

export interface ApplicantRow {
  id: string
  name: string
  email: string
  job: string
  appliedDate: string
  status: string
  offerDetails?: string
  offerLetterUrl?: string | null
  nextInterview?: { title: string; scheduledAt: string; location?: string } | null
  // Full candidate profile fields -- real data from CandidateProfile, used by
  // the applicant detail page (previously that page used entirely hardcoded
  // fake candidates instead of any of this).
  title?: string
  bio?: string
  resumeUrl?: string | null
  resumeMetadata?: { uploadedAt?: string; size?: number; mimetype?: string } | null
  experience?: { id: string; jobTitle: string; company: string; duration: string; description?: string }[]
  education?: { id: string; degree: string; institution: string; duration: string; grade?: string; specialization?: string }[]
  skills?: string[]
  languages?: string[]
  noticePeriod?: string
  expectedSalary?: string
}

export const RecruiterApi = {
  async createJob(values: JobPostingFormValues) {
    const payload = buildCreateJobPayload(values)
    return apiClient.post("/api/v1/recruiters/jobs", payload)
  },

  async saveDraft(values: JobPostingFormValues) {
    const payload = { ...buildCreateJobPayload(values), status: "draft" as const }
    return apiClient.post("/api/v1/recruiters/jobs", payload)
  },

  async getJobs(): Promise<RecruiterJobRow[]> {
    const res = await apiClient.get("/api/v1/recruiters/jobs")
    const jobs: any[] = res?.data?.jobs || []
    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      department: job.department,
      workMode: mapWorkModeFromBackend(job.workMode),
      type: job.type,
      location: job.location,
      applicants: job.applicants,
      status: job.status,
      postedOn: formatDate(job.postedOn),
    }))
  },

  // Real single-job fetch for the Job Details page. Previously that page
  // never called the backend at all -- it matched the route's :id against a
  // hardcoded array of 5 sample jobs plus a localStorage override cache, so
  // every real job (real UUID ids from Postgres) always showed "Posting Not
  // Found."
  async getJobById(id: string) {
    const res = await apiClient.get(`/api/v1/recruiters/jobs/${id}`)
    const job = res?.data?.job
    if (!job) return null
    return {
      id: job.id,
      title: job.title,
      department: job.department,
      workMode: mapWorkModeFromBackend(job.workMode),
      type: job.type,
      location: job.location,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      benefits: job.benefits,
      deadline: job.deadline,
      salary: job.salaryDisplay,
      skills: job.skills || [],
      menstrualLeaveChampion: !!job.menstrualLeaveChampion,
      flexibleHours: !!job.flexibleHours,
      workFromHome: !!job.workFromHome,
      applicants: job.applicants,
      status: job.status,
      postedOn: formatDate(job.postedOn),
    }
  },

  async updateJob(id: string, values: JobPostingFormValues) {
    const payload = buildCreateJobPayload(values)
    // status is only meaningful at creation time (draft vs pending_approval);
    // updates should never silently re-submit an already-live job for
    // re-approval, so we don't send it here.
    const { status, ...updatePayload } = payload as any
    return apiClient.put(`/api/v1/recruiters/jobs/${id}`, updatePayload)
  },

  async archiveJob(id: string) {
    return apiClient.post(`/api/v1/recruiters/jobs/${id}/archive`, {})
  },

  async deleteJob(id: string) {
    return apiClient.delete(`/api/v1/recruiters/jobs/${id}`)
  },

  async setJobLifecycle(id: string, action: string) {
    return apiClient.post(`/api/v1/recruiters/jobs/${id}/lifecycle/${action}`, {})
  },

  async getApplicants(jobId?: string): Promise<ApplicantRow[]> {
    const qs = jobId ? `?jobId=${jobId}` : ""
    const res = await apiClient.get(`/api/v1/recruiters/applications${qs}`)
    const applications: any[] = res?.data?.applications || []
    return applications.map((app) => {
      const latestInterview = (app.interviews || [])[0]
      const candidate = app.candidate || {}
      return {
        id: app.id,
        name: candidate.fullName || "Unknown Candidate",
        email: candidate.user?.email || "",
        job: app.job?.title || "",
        appliedDate: formatDate(app.appliedOn),
        status: APPLICANT_STATUS_FROM_BACKEND[app.status] || app.status,
        offerDetails: app.offerDetails || undefined,
        offerLetterUrl: app.offerLetterUrl || null,
        nextInterview: latestInterview
          ? { title: latestInterview.title, scheduledAt: latestInterview.scheduledAt, location: latestInterview.location }
          : null,
        title: candidate.title || undefined,
        bio: candidate.bio || undefined,
        resumeUrl: candidate.resumeUrl || null,
        resumeMetadata: candidate.resumeMetadata || null,
        experience: Array.isArray(candidate.experience) ? candidate.experience : [],
        education: Array.isArray(candidate.education) ? candidate.education : [],
        skills: (candidate.skills || []).map((cs: any) => cs.skill?.name).filter(Boolean),
        languages: candidate.languages || [],
        noticePeriod: candidate.noticePeriod || undefined,
        expectedSalary: candidate.expectedSalary || undefined,
      }
    })
  },

  async updateApplicantStatus(applicationId: string, displayStatus: string) {
    const status = APPLICANT_STATUS_TO_BACKEND[displayStatus] || displayStatus
    return apiClient.put(`/api/v1/recruiters/applications/${applicationId}/status`, { status })
  },

  async scheduleInterview(
    applicationId: string,
    data: {
      title: string
      description?: string
      scheduledAt: string
      timezone?: string
      durationMins?: number
      mode?: "Online" | "Offline"
      meetingLink?: string
      venue?: string
      notes?: string
      location?: string
    }
  ) {
    return apiClient.post(`/api/v1/recruiters/applications/${applicationId}/interview`, data)
  },

  // offerLetterFile is optional -- releasing a text-only offer with no
  // attachment still works exactly as before. Always sent as multipart/
  // form-data (rather than only switching to it when a file is present) so
  // there's a single, consistent request shape the backend's
  // uploadOfferLetterMiddleware always parses the same way.
  async releaseOffer(applicationId: string, offerDetails: string, offerLetterFile?: File) {
    const formData = new FormData()
    formData.append("offerDetails", offerDetails)
    if (offerLetterFile) {
      formData.append("offerLetter", offerLetterFile)
    }
    return apiClient.post(`/api/v1/recruiters/applications/${applicationId}/offer`, formData)
  },

  async getDashboard() {
    const res = await apiClient.get("/api/v1/recruiters/dashboard")
    return res?.data || {}
  },

  async getAnalytics() {
    const res = await apiClient.get("/api/v1/recruiters/analytics")
    return res?.data || {}
  },

  async onboardCompany(payload: any) {
    const res = await apiClient.post("/api/v1/recruiters/company/onboard", payload)
    return res?.data
  },

  // Company Perk Requests -- deliberately separate from
  // onboardCompany above. The backend now always returns `documents` as a
  // real array (recruiter.service.ts normalizes it at the source), but this
  // is still the one place every perk-request read passes through on the
  // frontend, so it's normalized defensively here too -- belt-and-suspenders
  // consistent with how CompanyDetails.tsx already guards
  // verificationDocuments, rather than trusting every call site downstream
  // to remember `?.` / `Array.isArray`.
  async getPerkRequests() {
    const res = await apiClient.get("/api/v1/recruiters/perks")
    const requests = res?.data?.perkRequests || []
    return requests.map((r: any) => ({ ...r, documents: Array.isArray(r.documents) ? r.documents : [] }))
  },

  async submitPerk(perkName: string, comment?: string) {
    const res = await apiClient.post("/api/v1/recruiters/perks/submit", { perkName, comment })
    const data = res?.data
    return data ? { ...data, documents: Array.isArray(data.documents) ? data.documents : [] } : data
  },

  async uploadPerkDocument(perkRequestId: string, file: File, category: string) {
    const formData = new FormData()
    formData.append("document", file)
    formData.append("category", category)
    const res = await apiClient.post(`/api/v1/recruiters/perks/${perkRequestId}/documents`, formData)
    return res?.data
  },

  async getApprovalTracker() {
    const res = await apiClient.get("/api/v1/recruiters/approvals")
    return res?.data
  },

  async uploadCompanyLogo(file: File) {
    const formData = new FormData()
    formData.append("logo", file)
    const res = await apiClient.post("/api/v1/recruiters/company/logo", formData)
    return res?.data
  },

  async deleteCompanyLogo() {
    const res = await apiClient.delete("/api/v1/recruiters/company/logo")
    return res?.data
  },

  // Company Profile expansion -- office photo gallery + policies
  async uploadGalleryPhoto(file: File, caption?: string) {
    const formData = new FormData()
    formData.append("photo", file)
    if (caption) formData.append("caption", caption)
    const res = await apiClient.post("/api/v1/recruiters/company/gallery", formData)
    return res?.data
  },

  async deleteGalleryPhoto(publicId: string) {
    const res = await apiClient.delete("/api/v1/recruiters/company/gallery", { publicId })
    return res?.data
  },

  async updatePolicies(policies: { title: string; description: string }[]) {
    const res = await apiClient.put("/api/v1/recruiters/company/policies", { policies })
    return res?.data
  },

  async getSettings() {
    const res = await apiClient.get("/api/v1/recruiters/settings")
    return res?.data?.settings || res?.data
  },

  async updateSettings(payload: any) {
    const res = await apiClient.put("/api/v1/recruiters/settings", payload)
    return res?.data?.settings || res?.data
  },

  // Real TOTP-based Two-Factor Authentication (RFC 6238) -- same shared
  // /auth/2fa/* endpoints AdminApi uses (session-gated only, not role-gated),
  // now offered here as an optional, self-service security setting. The
  // "Security & Authentication" card previously had nothing here at all.
  async start2FAEnrollment() {
    const res = await apiClient.post("/api/v1/auth/2fa/enroll/start", {})
    return res?.data || {}
  },

  async confirm2FAEnrollment(code: string) {
    const res = await apiClient.post("/api/v1/auth/2fa/enroll/confirm", { code })
    return res?.data || {}
  },

  async disable2FA(password: string) {
    const res = await apiClient.post("/api/v1/auth/2fa/disable", { password })
    return res?.data || {}
  },

  // Same shared /auth/change-password endpoint candidateApi/AdminApi use --
  // session-gated only, not role-gated, so nothing new needed backend-side.
  // The "Change Credentials Password" control on the Security card
  // previously had no working button at all (disabled, labeled "Configure").
  async changePassword(currentPassword: string, newPassword: string) {
    const res = await apiClient.put("/api/v1/auth/change-password", { currentPassword, newPassword })
    return res?.data
  },

  async getNotifications() {
    const res = await apiClient.get("/api/v1/recruiters/notifications")
    return res?.data?.notifications || res?.data || []
  },

  async markNotificationRead(id: string) {
    const res = await apiClient.put(`/api/v1/recruiters/notifications/${id}/read`, {})
    return res?.data
  },

  async markAllNotificationsRead() {
    const res = await apiClient.put("/api/v1/recruiters/notifications/read-all", {})
    return res?.data
  },

  async deleteNotification(id: string) {
    const res = await apiClient.delete(`/api/v1/recruiters/notifications/${id}`)
    return res?.data
  },

  async getTeam() {
    const res = await apiClient.get("/api/v1/recruiters/team")
    return res?.data || { members: [], invitations: [], companyName: "" }
  },

  async inviteColleague(email: string) {
    const res = await apiClient.post("/api/v1/recruiters/team/invite", { email })
    return res?.data
  },

  async cancelColleagueInvitation(id: string) {
    const res = await apiClient.post(`/api/v1/recruiters/team/invitations/${id}/cancel`, {})
    return res?.data
  },
}

export default RecruiterApi
