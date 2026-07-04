import { mockJobs as centralJobs } from "@/mock/jobs/jobsMock"
import type { Job } from "@/types/dashboard"

export interface ExtendedJob extends Job {
  womenReturnship: boolean
  menstrualLeaveChampion: boolean
  description: string
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  companyDescription?: string
}

export const mockJobs: ExtendedJob[] = centralJobs as any
export default mockJobs
