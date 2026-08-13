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
    flexibleHours: !!apiJob.flexibleHours,
    workFromHome: !!apiJob.workFromHome,
    description: apiJob.description || "",
    requirements: splitLines(apiJob.requirements),
    responsibilities: splitLines(apiJob.responsibilities),
    benefits: splitLines(apiJob.benefits),
    // this read the company's *location* into
    // "companyDescription" -- Company.description is a real, separate field
    // that was simply never mapped, so "About {company}" always showed the
    // city instead of an actual company blurb (or silently fell back to the
    // generic placeholder string in JobDetailContent.tsx).
    companyDescription: apiJob.company?.description || undefined,
    companyWebsite: apiJob.company?.website || undefined,
    companyLogoUrl: apiJob.company?.logoUrl || null,
    department: apiJob.department?.name || undefined,
    // Only present on the single-job detail response (getJobById) -- the
    // list endpoint (getJobs) doesn't include job.recruiter/job.skills, so
    // these are simply absent (not wrong) on list-derived ExtendedJobs like
    // the ones used for job cards / related jobs.
    skills: Array.isArray(apiJob.skills) ? apiJob.skills : undefined,
    recruiter: apiJob.recruiter || undefined,
    applicationStatus: apiJob.applicationStatus ?? undefined,
    isSaved: typeof apiJob.isSaved === "boolean" ? apiJob.isSaved : undefined,
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
    // this used to fake a single-job lookup by
    // fetching the paginated list (limit=200) and finding a client-side
    // match -- the exact "summary DTO reused where full detail is required"
    // pattern. That list response never carried job.recruiter or
    // job.skills, so the Job Details page could never show them regardless
    // of what this function did with the data. GET /jobs/:jobId is a real
    // detail endpoint now (candidate.service.ts's getJobById) that includes
    // both, plus this candidate's own application/bookmark state for the job.
    try {
      const res = await apiClient.get(`/api/v1/candidates/jobs/${id}`)
      const job = res?.data?.job
      return job ? mapApiJobToExtendedJob(job) : undefined
    } catch {
      return undefined
    }
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
  OfferReleased: "Offer Released",
  Rejected: "Rejected",
  Hired: "Selected",
  Withdrawn: "Withdrawn",
}

type DisplayApplicationStatus =
  | "Applied"
  | "Under Review"
  | "Interview Scheduled"
  | "Offer Released"
  | "Selected"
  | "Rejected"
  | "Withdrawn"

// Matches candidate.service.ts's shapeRecruiterSummary() -- a flat, safe
// (no passwordHash, no raw preferences blob) recruiter summary attached to
// job.recruiter on both GET /candidates/applications and
// GET /candidates/applications/:id. There's no dedicated recruiter photo
// column in the schema (RecruiterProfile only has fullName/phone/verified),
// so "avatar" is rendered client-side from initials + the company logo
// rather than a stored image -- see RecruiterBadge in ApplicationTimeline.tsx.
export interface RecruiterSummary {
  name: string
  jobTitle: string
  email: string | null
}

// Issue 1: full structured detail for the most recent Interview record
// (mode/timezone/meetingLink/venue/notes), matching the new Interview
// columns -- see types/application.ts's ApplicationInterview.
export interface DisplayApplicationInterview {
  scheduledAt: string
  timezone?: string | null
  mode: string
  meetingLink?: string | null
  venue?: string | null
  notes?: string | null
}

export interface DisplayApplication {
  id: string
  // Needed so a withdrawn application can be resubmitted without a separate
  // lookup -- see CandidateJobsApi.applyToJob().
  jobId: string
  company: string
  companyCode: string
  companyLogoUrl?: string | null
  job: string
  appliedDate: string
  status: DisplayApplicationStatus
  interviewDate?: string
  interview?: DisplayApplicationInterview | null
  offerDetails?: string
  // Optional attached offer letter (PDF/DOC/DOCX) -- see
  // recruiter.service.ts's releaseOffer(). Not yet surfaced in any candidate
  // UI (neither is offerDetails above), but mapped through here so it's
  // available once that UI exists.
  offerLetterUrl?: string | null
  recruiter?: RecruiterSummary | null
}

/**
 * Maps a raw Application record (as returned by GET /api/v1/candidates/applications,
 * which includes { job: { company, recruiter } }) into the flat shape the
 * candidate Applications UI expects.
 */
export function mapApiApplication(app: any): DisplayApplication {
  const companyName = app.job?.company?.name || "Unknown Company"
  const latestInterview = (app.interviews || [])[0]
  return {
    id: app.id,
    jobId: app.jobId,
    company: companyName,
    companyCode: codeForCompany(companyName),
    companyLogoUrl: app.job?.company?.logoUrl || null,
    job: app.job?.title || "Untitled Role",
    appliedDate: formatDate(app.appliedOn),
    // Falling back to the raw backend value (rather than "Applied") means an
    // unmapped future status is at least visible/debuggable instead of lying
    // about the application's real state.
    status: APPLICATION_STATUS_MAP[app.status] || (app.status as DisplayApplicationStatus),
    interviewDate: latestInterview?.scheduledAt ? formatDate(latestInterview.scheduledAt) : undefined,
    interview: latestInterview
      ? {
          scheduledAt: latestInterview.scheduledAt,
          timezone: latestInterview.timezone || null,
          mode: latestInterview.mode || "Online",
          meetingLink: latestInterview.meetingLink || null,
          venue: latestInterview.venue || null,
          notes: latestInterview.notes || null,
        }
      : null,
    offerDetails: app.offerDetails || undefined,
    offerLetterUrl: app.offerLetterUrl || null,
    // this key was never set at all, so the
    // Assigned Recruiter card on the candidate Applications page always
    // showed "Not Assigned" even when job.recruiter existed -- the backend
    // now actually queries and shapes it (candidate.service.ts), this just
    // has to actually read it.
    recruiter: app.job?.recruiter || null,
  }
}

export default CandidateJobsApi
