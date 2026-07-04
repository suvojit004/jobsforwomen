import { initialRecruiterData } from "@/mock/recruiter/recruiterMock"
import type { RecruiterProfile } from "@/types/recruiter"

export class RecruiterService {
  private static profile: RecruiterProfile = { ...initialRecruiterData }

  static async getProfile(): Promise<RecruiterProfile> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.profile), 100)
    })
  }

  static async updateProfile(data: Partial<RecruiterProfile>): Promise<RecruiterProfile> {
    return new Promise((resolve) => {
      this.profile = {
        ...this.profile,
        ...data,
      }
      setTimeout(() => resolve(this.profile), 100)
    })
  }
}
export default RecruiterService
