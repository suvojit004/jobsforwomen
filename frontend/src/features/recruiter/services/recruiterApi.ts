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

const APPLICANT_STATUS_TO_BACKEND: Record<string, string> = {
  Applied: "Applied",
  "Under Review": "Reviewed",
  "Interview Scheduled": "InterviewScheduled",
  Selected: "Hired",
  Rejected: "Rejected",
}

const APPLICANT_STATUS_FROM_BACKEND: Record<string, string> = {
  Applied: "Applied",
  Reviewed: "Under Review",
  Shortlisted: "Under Review",
  InterviewScheduled: "Interview Scheduled",
  InterviewCompleted: "Interview Scheduled",
  OfferReleased: "Selected",
  OfferAccepted: "Selected",
  OfferDeclined: "Rejected",
  Hired: "Selected",
  Rejected: "Rejected",
}

export interface ApplicantRow {
  id: string
  name: string
  email: string
  job: string
  appliedDate: string
  status: string
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
    return applications.map((app) => ({
      id: app.id,
      name: app.candidate?.fullName || "Unknown Candidate",
      email: app.candidate?.user?.email || "",
      job: app.job?.title || "",
      appliedDate: formatDate(app.appliedOn),
      status: APPLICANT_STATUS_FROM_BACKEND[app.status] || app.status,
    }))
  },

  async updateApplicantStatus(applicationId: string, displayStatus: string) {
    const status = APPLICANT_STATUS_TO_BACKEND[displayStatus] || displayStatus
    return apiClient.put(`/api/v1/recruiters/applications/${applicationId}/status`, { status })
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

  async getSettings() {
    const res = await apiClient.get("/api/v1/recruiters/settings")
    return res?.data?.settings || res?.data
  },

  async updateSettings(payload: any) {
    const res = await apiClient.put("/api/v1/recruiters/settings", payload)
    return res?.data?.settings || res?.data
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

  async getConversations() {
    const res = await apiClient.get("/api/v1/recruiters/conversations")
    return res?.data?.conversations || res?.data || []
  },

  async getMessages(conversationId: string) {
    const res = await apiClient.get(`/api/v1/recruiters/conversations/${conversationId}/messages`)
    return res?.data?.messages || res?.data || []
  },

  async sendMessage(conversationId: string, content: string) {
    const res = await apiClient.post(`/api/v1/recruiters/conversations/${conversationId}/messages`, { content })
    return res?.data
  },
}

export default RecruiterApi
