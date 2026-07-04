import { initialCandidateData } from "@/mock/candidate/candidateMock"
import type { Candidate } from "@/types/candidate"

export class CandidateService {
  private static profile: Candidate = { ...initialCandidateData } as any

  static async getProfile(): Promise<Candidate> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.profile), 100)
    })
  }

  static async updateProfile(data: Partial<Candidate>): Promise<Candidate> {
    return new Promise((resolve) => {
      this.profile = {
        ...this.profile,
        ...data,
      }
      setTimeout(() => resolve(this.profile), 100)
    })
  }
}
export default CandidateService
