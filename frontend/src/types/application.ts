export type ApplicationStatus =
  | "Applied"
  | "Under Review"
  | "Shortlisted"
  | "Interview Scheduled"
  | "Offer Released"
  | "Selected"
  | "Rejected"

// Matches jobsApi.ts's RecruiterSummary / candidate.service.ts's
// shapeRecruiterSummary() -- no dedicated photo column exists on
// RecruiterProfile, so there's deliberately no photoUrl/avatarUrl field
// here; avatars are rendered from initials client-side instead.
export interface ApplicationRecruiter {
  name: string
  jobTitle: string
  email: string | null
}

// Issue 1 (Candidate Job Lifecycle spec): the most recent Interview record's
// full structured details, so the candidate sees exactly what the recruiter
// set -- not just a flattened date string.
export interface ApplicationInterview {
  scheduledAt: string
  timezone?: string | null
  mode: "Online" | "Offline" | string
  meetingLink?: string | null
  venue?: string | null
  notes?: string | null
}

export interface Application {
  id: string
  company: string
  companyCode: string
  companyLogoUrl?: string | null
  job: string
  appliedDate: string
  status: ApplicationStatus
  interviewDate?: string
  interview?: ApplicationInterview | null
  recruiter?: ApplicationRecruiter | null
  // Free-text offer summary and an optional attached offer letter file --
  // both set by the recruiter when releasing an offer (recruiter.service.ts's
  // releaseOffer()). See jobsApi.ts's DisplayApplication, which this mirrors.
  offerDetails?: string
  offerLetterUrl?: string | null
}
