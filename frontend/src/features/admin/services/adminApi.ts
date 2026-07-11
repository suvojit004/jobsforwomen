import apiClient from "@/api/client"

export const AdminApi = {
  async getDashboard() {
    const res = await apiClient.get("/api/v1/admins/dashboard")
    return res?.data || {}
  },

  async getHealth() {
    const res = await apiClient.get("/api/v1/admins/health")
    return res?.data || {}
  },

  async getReports() {
    const res = await apiClient.get("/api/v1/admins/reports")
    return res?.data || {}
  },

  async getAudits() {
    const res = await apiClient.get("/api/v1/admins/audits")
    return res?.data?.auditLogs || res?.data || []
  },

  async getCompanies() {
    const res = await apiClient.get("/api/v1/admins/companies")
    return res?.data?.companies || res?.data || []
  },

  async verifyCompany(companyId: string, status: string) {
    const res = await apiClient.post(`/api/v1/admins/companies/${companyId}/verify`, { status })
    return res?.data
  },

  async getJobs() {
    const res = await apiClient.get("/api/v1/admins/jobs")
    return res?.data?.jobs || res?.data || []
  },

  async moderateJob(jobId: string, action: string, reason?: string) {
    const res = await apiClient.post(`/api/v1/admins/jobs/${jobId}/moderate`, { action, reason })
    return res?.data
  },

  async getUsers(role?: string) {
    const qs = role ? `?role=${role}` : ""
    const res = await apiClient.get(`/api/v1/admins/users${qs}`)
    return res?.data?.users || res?.data || []
  },

  async updateUserStatus(userId: string, status: string) {
    const res = await apiClient.put(`/api/v1/admins/users/${userId}/status`, { status })
    return res?.data
  },

  async verifyRecruiter(recruiterId: string, verified: boolean) {
    const res = await apiClient.put(`/api/v1/admins/recruiters/${recruiterId}/verify`, { verified })
    return res?.data
  },

  async getFeatureFlags() {
    const res = await apiClient.get("/api/v1/admins/feature-flags")
    return res?.data?.featureFlags || res?.data || []
  },

  async createFeatureFlag(payload: any) {
    const res = await apiClient.post("/api/v1/admins/feature-flags", payload)
    return res?.data
  },

  async updateFeatureFlag(id: string, payload: any) {
    const res = await apiClient.put(`/api/v1/admins/feature-flags/${id}`, payload)
    return res?.data
  },

  async deleteFeatureFlag(id: string) {
    const res = await apiClient.delete(`/api/v1/admins/feature-flags/${id}`)
    return res?.data
  },

  async getSettings() {
    const res = await apiClient.get("/api/v1/admins/settings")
    return res?.data?.settings || res?.data || {}
  },

  async updateSettings(payload: any) {
    const res = await apiClient.put("/api/v1/admins/settings", payload)
    return res?.data?.settings || res?.data || {}
  },

  async getNotifications() {
    const res = await apiClient.get("/api/v1/admins/notifications")
    return res?.data?.notifications || res?.data || []
  },
}

export default AdminApi
