import apiClient from "@/api/client"

export const candidateApi = {
  async getProfile() {
    const res = await apiClient.get("/api/v1/candidates/profile")
    return res?.data?.profile || res?.data
  },

  async updateProfile(profileData: any) {
    const res = await apiClient.put("/api/v1/candidates/profile", profileData)
    return res?.data?.profile || res?.data
  },

  async uploadResume(file: File) {
    const formData = new FormData()
    formData.append("resume", file)
    const res = await apiClient.post("/api/v1/candidates/resume", formData)
    return res?.data?.profile || res?.data
  },

  async deleteResume() {
    const res = await apiClient.delete("/api/v1/candidates/resume")
    return res?.data?.profile || res?.data
  },

  async getSettings() {
    const res = await apiClient.get("/api/v1/candidates/settings")
    return res?.data?.settings || res?.data
  },

  async updateSettings(settingsData: any) {
    const res = await apiClient.put("/api/v1/candidates/settings", settingsData)
    return res?.data?.settings || res?.data
  },

  async getNotifications() {
    const res = await apiClient.get("/api/v1/candidates/notifications")
    return res?.data?.notifications || res?.data || []
  },

  async markNotificationRead(id: string) {
    const res = await apiClient.put(`/api/v1/candidates/notifications/${id}/read`, {})
    return res?.data
  },

  async markAllNotificationsRead() {
    const res = await apiClient.put("/api/v1/candidates/notifications/read-all", {})
    return res?.data
  },

  async deleteNotification(id: string) {
    const res = await apiClient.delete(`/api/v1/candidates/notifications/${id}`)
    return res?.data
  },

  async getConversations() {
    const res = await apiClient.get("/api/v1/candidates/conversations")
    return res?.data?.conversations || res?.data || []
  },

  async getMessages(conversationId: string) {
    const res = await apiClient.get(`/api/v1/candidates/conversations/${conversationId}/messages`)
    return res?.data?.messages || res?.data || []
  },

  async sendMessage(conversationId: string, content: string) {
    const res = await apiClient.post(`/api/v1/candidates/conversations/${conversationId}/messages`, { content })
    return res?.data
  },

  async markConversationAsRead(conversationId: string) {
    const res = await apiClient.put(`/api/v1/candidates/conversations/${conversationId}/read`, {})
    return res?.data
  },

  // CONFIRMED BUG (fixed here): there was previously no way to create a
  // conversation from the Candidate side at all -- Messages.tsx could only
  // ever list conversations that already existed. This finds-or-creates the
  // conversation tied to a specific job application.
  async startConversation(applicationId: string) {
    const res = await apiClient.post(`/api/v1/candidates/applications/${applicationId}/conversation`, {})
    return res?.data?.conversation || res?.data
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await apiClient.put("/api/v1/auth/change-password", { currentPassword, newPassword })
    return res?.data
  },

  async deleteAccount(password: string) {
    const res = await apiClient.delete("/api/v1/auth/account", { password })
    return res?.data
  },
}

export default candidateApi
