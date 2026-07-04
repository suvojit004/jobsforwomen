export type ApplicationStatus =
  | "Applied"
  | "Under Review"
  | "Interview Scheduled"
  | "Selected"
  | "Rejected"

export interface Application {
  id: string
  company: string
  companyCode: string
  job: string
  appliedDate: string
  status: ApplicationStatus
  interviewDate?: string
  recruiter?: string
}
