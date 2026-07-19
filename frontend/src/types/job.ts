export type JobLogoTone = "purple" | "green" | "blue" | "pink"

export interface Job {
  id: string
  title: string
  company: string
  companyCode: string
  logoTone: JobLogoTone
  salary: string
  location: string
  experience: string
  type: string
  workMode: "Remote" | "Hybrid" | "On-site"
  postedAt: string
}

// Matches candidate.service.ts's shapeRecruiterSummary() -- same shape used
// for the recruiter attached to an Application (types/application.ts).
export interface JobRecruiter {
  name: string
  jobTitle: string
  email: string | null
}

export interface ExtendedJob extends Job {
  womenReturnship: boolean
  menstrualLeaveChampion: boolean
  flexibleHours?: boolean
  workFromHome?: boolean
  description: string
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  skills?: string[]
  companyDescription?: string
  companyWebsite?: string
  companyLogoUrl?: string | null
  department?: string
  recruiter?: JobRecruiter | null
  // Only populated by getJobById (single-job detail fetch), which knows
  // which candidate is asking -- the list endpoint (getJobs) doesn't carry
  // per-candidate state, so these are undefined there.
  applicationStatus?: string | null
  isSaved?: boolean
}
