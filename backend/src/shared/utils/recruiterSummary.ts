// Shared "safe recruiter summary" shape -- used anywhere a RecruiterProfile
// needs to be surfaced to someone who isn't that recruiter (a candidate
// viewing a job/application, an admin reviewing a job posting). Centralized
// here because it was duplicated inline in candidate.service.ts and
// admin.service.ts (Issue 2/5 fixes) and needs to stay in sync: `jobTitle`
// has no dedicated RecruiterProfile column, it lives inside User.preferences
// JSON (see recruiter.service.ts's getSettings, whose "Recruiter Manager"
// default this mirrors), and a naive `include: { user: true }` would pull a
// passwordHash into memory that must never be forwarded to the client.
export const RECRUITER_SUMMARY_SELECT = {
  fullName: true,
  user: { select: { email: true, preferences: true } },
} as const

export interface RecruiterSummarySource {
  fullName: string
  user: { email: string; preferences: unknown } | null
}

export interface RecruiterSummary {
  name: string
  jobTitle: string
  email: string | null
}

export function shapeRecruiterSummary(recruiter: RecruiterSummarySource | null | undefined): RecruiterSummary | null {
  if (!recruiter) return null
  const preferences = recruiter.user?.preferences as any
  return {
    name: recruiter.fullName,
    jobTitle: (preferences && typeof preferences === "object" && preferences.jobTitle) || "Recruiter Manager",
    email: recruiter.user?.email || null,
  }
}

export default { RECRUITER_SUMMARY_SELECT, shapeRecruiterSummary }
