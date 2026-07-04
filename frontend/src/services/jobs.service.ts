import { mockJobs } from "@/mock/jobs/jobsMock"
import type { Job } from "@/types/job"

export class JobsService {
  private static jobsList: Job[] = [...mockJobs] as any

  static async getAllJobs(): Promise<Job[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.jobsList), 100)
    })
  }

  static async getJobById(id: string): Promise<Job | undefined> {
    return new Promise((resolve) => {
      const job = this.jobsList.find((j) => j.id === id)
      setTimeout(() => resolve(job), 100)
    })
  }

  static async createJob(jobData: Omit<Job, "id" | "postedAt">): Promise<Job> {
    return new Promise((resolve) => {
      const newJob: Job = {
        ...jobData,
        id: `job-${Date.now()}`,
        postedAt: "Posted just now",
      }
      this.jobsList.unshift(newJob)
      setTimeout(() => resolve(newJob), 150)
    })
  }

  static async deleteJob(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.jobsList = this.jobsList.filter((j) => j.id !== id)
      setTimeout(() => resolve(true), 100)
    })
  }
}
export default JobsService
