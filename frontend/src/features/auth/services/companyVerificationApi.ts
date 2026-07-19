import apiClient from "@/api/client"

// Public, unauthenticated endpoints (Part 3 of the recruiter onboarding/
// approval spec) -- the token itself is the credential, there is no logged
// in user on this page.
export const CompanyVerificationApi = {
  async getByToken(token: string) {
    const res = await apiClient.get(`/api/v1/company-verification/${token}`)
    return res?.data || {}
  },

  async resubmit(
    token: string,
    data: { companyName?: string; website?: string; industryName?: string; location?: string; comment: string }
  ) {
    const res = await apiClient.post(`/api/v1/company-verification/${token}`, data)
    return res?.data || {}
  },

  async uploadDocument(token: string, file: File, category: string) {
    const formData = new FormData()
    formData.append("document", file)
    formData.append("category", category)
    const res = await apiClient.post(`/api/v1/company-verification/${token}/documents`, formData)
    return res?.data
  },
}

export default CompanyVerificationApi
