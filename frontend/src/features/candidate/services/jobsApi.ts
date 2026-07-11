import apiClient from "@/api/client"
import { formatDate } from "@/utils/formatDate"
import type { ExtendedJob } from "@/types/job"
import type { JobLogoTone } from "@/types/job"

const LOGO_TONES: JobLogoTone[] = ["purple", "green", "blue", "pink"]

function toneForId(id: string): JobLogoTone {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return LOGO_TONES[hash % LOGO_TONES.length]
}

function codeForCompany(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "JW"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function splitLines(value?: string | null): string[] {
  if (!value) return []
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function mapWorkMode(mode: string): "Remote" | "Hybrid" | "On-site" {
  if (mode === "On_site") return "On-site"
  if (mode === "Hybrid") return "Hybrid"
  return "Remote"
}

/**
 * Maps a raw Job record returned by the backend (GET /api/v1/candidates/jobs,
 * /jobs/recommendations, /saved-jobs, etc.) into the ExtendedJob shape the
 * candidate UI components expect.
 */
export function mapApiJobToExtendedJob(apiJob: any): ExtendedJob {
  const companyName = apiJob.company?.name || "Unknown Company"
  return {
    id: apiJob.id,
    title: apiJob.title,
    company: companyName,
    companyCode: codeForCompany(companyName),
    logoTone: toneForId(apiJob.id),
    salary: apiJob.salaryDisplay || "",
    location: apiJob.location || "",
    experience: apiJob.department?.name || "",
    type: apiJob.type || "",
    workMode: mapWorkMode(apiJob.workMode),
    postedAt: apiJob.postedOn ? formatDate(apiJob.postedOn) : "",
    womenReturnship: false,
    menstrualLeaveChampion: !!apiJob.menstrualLeaveChampion,
    description: apiJob.description || "",
    requirements: splitLines(apiJob.requirements),
    responsibilities: splitLines(apiJob.responsibilities),
    benefits: splitLines(apiJob.benefits),
    companyDescription: apiJob.company?.location,
  }
}

export interface JobFiltersQuery {
  search?: string
  location?: string
  type?: string
  departmentId?: string
  menstrualLeaveChampion?: boolean
  flexibleHours?: boolean
  workFromHome?: boolean
  sortBy?: string
}

export interface PagedJobs {
  jobs: ExtendedJob[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") {
      search.set(key, String(value))
    }
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export const CandidateJobsApi = {
  async getJobs(filters: JobFiltersQuery, page: number, limit: number): Promise<PagedJobs> {
    const qs = buildQuery({ ...filters, page, limit })
    const res = await apiClient.get(`/api/v1/candidates/jobs${qs}`)
    const data = res?.data || {}
    return {
      jobs: (data.jobs || []).map(mapApiJobToExtendedJob),
      total: data.total || 0,
      page: data.page || page,
      limit: data.limit || limit,
      totalPages: data.totalPages || 1,
    }
  },

  async getRecommendations(): Promise<ExtendedJob[]> {
    const res = await apiClient.get("/api/v1/candidates/jobs/recommendations")
    const list = res?.data?.recommendations || res?.data || []
    return list.map(mapApiJobToExtendedJob)
  },

  async getJobById(id: string): Promise<ExtendedJob | undefined> {
    // There's no single-job public endpoint yet, so pull from the listing
    // with a generous page size and find the match.
    const res = await apiClient.get(`/api/v1/candidates/jobs?limit=200`)
    const jobs: any[] = res?.data?.jobs || []
    const found = jobs.find((j) => j.id === id)
    return found ? mapApiJobToExtendedJob(found) : undefined
  },

  async getSavedJobs(): Promise<ExtendedJob[]> {
    const res = await apiClient.get("/api/v1/candidates/saved-jobs")
    const list: any[] = res?.data?.savedJobs || []
    return list.map((s) => mapApiJobToExtendedJob(s.job))
  },

  async saveJob(jobId: string): Promise<void> {
    await apiClient.post(`/api/v1/candidates/saved-jobs/${jobId}`, {})
  },

  async unsaveJob(jobId: string): Promise<void> {
    await apiClient.delete(`/api/v1/candidates/saved-jobs/${jobId}`)
  },

  async applyToJob(jobId: string): Promise<void> {
    await apiClient.post(`/api/v1/candidates/jobs/${jobId}/apply`, {})
  },

  async getApplications(): Promise<any[]> {
    const res = await apiClient.get("/api/v1/candidates/applications")
    return res?.data?.applications || []
  },

  async withdrawApplication(applicationId: string): Promise<void> {
    await apiClient.post(`/api/v1/candidates/applications/${applicationId}/withdraw`, {})
  },
}

const APPLICATION_STATUS_MAP: Record<string, DisplayApplicationStatus> = {
  Applied: "Applied",
  Reviewed: "Under Review",
  Shortlisted: "Under Review",
  InterviewScheduled: "Interview Scheduled",
  Rejected: "Rejected",
  Hired: "Selected",
}

type DisplayApplicationStatus =
  | "Applied"
  | "Under Review"
  | "Interview Scheduled"
  | "Selected"
  | "Rejected"

export interface DisplayApplication {
  id: string
  company: string
  companyCode: string
  job: string
  appliedDate: string
  status: DisplayApplicationStatus
  interviewDate?: string
  recruiter?: string
}

/**
 * Maps a raw Application record (as returned by GET /api/v1/candidates/applications,
 * which includes { job: { company } }) into the flat shape the candidate
 * Applications UI expects.
 */
export function mapApiApplication(app: any): DisplayApplication {
  const companyName = app.job?.company?.name || "Unknown Company"
  return {
    id: app.id,
    company: companyName,
    companyCode: codeForCompany(companyName),
    job: app.job?.title || "Untitled Role",
    appliedDate: formatDate(app.appliedOn),
    status: APPLICATION_STATUS_MAP[app.status] || "Applied",
  }
}

export default CandidateJobsApi
