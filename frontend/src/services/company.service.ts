import { initialCompanyData } from "@/mock/companies/companiesMock"
import type { CompanyProfile } from "@/types/company"

export class CompanyService {
  private static company: CompanyProfile = { ...initialCompanyData }

  static async getProfile(): Promise<CompanyProfile> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.company), 100)
    })
  }

  static async updateProfile(data: Partial<CompanyProfile>): Promise<CompanyProfile> {
    return new Promise((resolve) => {
      this.company = {
        ...this.company,
        ...data,
      }
      setTimeout(() => resolve(this.company), 100)
    })
  }
}
export default CompanyService
