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

  async getAudits(params: {
    page?: number
    limit?: number
    search?: string
    uiCategory?: string
    action?: string
    entity?: string
    startDate?: string
    endDate?: string
  } = {}) {
    // Every filter argument is a real query parameter, so GET /admins/audits
    // runs a fresh, server-side paginated query rather than the frontend
    // filtering one fixed fetched page locally.
    const qs = new URLSearchParams()
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", String(params.limit ?? 20))
    if (params.search) qs.set("search", params.search)
    if (params.uiCategory && params.uiCategory !== "All") qs.set("uiCategory", params.uiCategory)
    if (params.action) qs.set("action", params.action)
    if (params.entity) qs.set("entity", params.entity)
    if (params.startDate) qs.set("startDate", params.startDate)
    if (params.endDate) qs.set("endDate", params.endDate)

    const res = await apiClient.get(`/api/v1/admins/audits?${qs.toString()}`)
    return {
      auditLogs: res?.data?.auditLogs || [],
      pagination: res?.data?.pagination || { currentPage: 1, totalPages: 1, totalItems: 0, limit: params.limit ?? 20 },
    }
  },

  async getCompanies() {
    const res = await apiClient.get("/api/v1/admins/companies")
    return res?.data?.companies || res?.data || []
  },

  async verifyCompany(companyId: string, status: string) {
    const res = await apiClient.post(`/api/v1/admins/companies/${companyId}/verify`, { status })
    return res?.data
  },

  async suspendCompany(companyId: string) {
    const res = await apiClient.post(`/api/v1/admins/companies/${companyId}/suspend`, {})
    return res?.data
  },

  async unsuspendCompany(companyId: string) {
    const res = await apiClient.post(`/api/v1/admins/companies/${companyId}/unsuspend`, {})
    return res?.data
  },

  async deleteCompany(companyId: string) {
    const res = await apiClient.delete(`/api/v1/admins/companies/${companyId}`)
    return res?.data
  },

  // Company Perk Requests -- deliberately a separate endpoint
  // family from getCompanies/verifyCompany above.
  async getPerkRequests() {
    const res = await apiClient.get("/api/v1/admins/perks")
    return res?.data?.perkRequests || []
  },

  async reviewPerkRequest(perkRequestId: string, status: string, comment?: string) {
    const res = await apiClient.post(`/api/v1/admins/perks/${perkRequestId}/review`, { status, comment })
    return res?.data
  },

  async getJobs() {
    const res = await apiClient.get("/api/v1/admins/jobs")
    return res?.data?.jobs || res?.data || []
  },

  async moderateJob(jobId: string, action: string, reason?: string) {
    // moderateJobSchema (backend
    // admin.validator.ts) only recognizes a `notes` field -- it was sending
    // `reason`, which Zod's .parse() silently strips as an unrecognized key.
    // Every rejection reason and the "Administrative deletion" delete note
    // was therefore always discarded before it ever reached
    // jobStatusHistory.notes or the JobRejected notification's message.
    const res = await apiClient.post(`/api/v1/admins/jobs/${jobId}/moderate`, { action, notes: reason })
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

  async deleteUser(userId: string, options?: { archiveJobs?: boolean; transferToRecruiterId?: string }) {
    const res = await apiClient.delete(`/api/v1/admins/users/${userId}`, options || {})
    return res?.data
  },

  async verifyRecruiter(recruiterId: string, verified: boolean) {
    const res = await apiClient.put(`/api/v1/admins/recruiters/${recruiterId}/verify`, { verified })
    return res?.data
  },

  async getFeatureFlags() {
    // the backend wraps this response as
    // { flags: [...] } (see admin.controller.ts's getFeatureFlags), not
    // { featureFlags: [...] }. That key never matched, so this always fell
    // through to `res?.data`, which is the wrapper object itself -- not an
    // array -- silently breaking every caller that expected a flags array.
    const res = await apiClient.get("/api/v1/admins/feature-flags")
    return res?.data?.flags || []
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
    // admin.controller.ts's updateAdminSettings reads req.body.preferences,
    // so the payload must be wrapped under that key.
    const res = await apiClient.put("/api/v1/admins/settings", { preferences: payload })
    return res?.data?.settings || res?.data || {}
  },

  async getNotifications() {
    const res = await apiClient.get("/api/v1/admins/notifications")
    return res?.data?.notifications || res?.data || []
  },

  async markNotificationRead(id: string) {
    const res = await apiClient.put(`/api/v1/admins/notifications/${id}/read`, {})
    return res?.data
  },

  async markAllNotificationsRead() {
    const res = await apiClient.put("/api/v1/admins/notifications/read-all", {})
    return res?.data
  },

  async deleteNotification(id: string) {
    const res = await apiClient.delete(`/api/v1/admins/notifications/${id}`)
    return res?.data
  },

  async getRBAC() {
    const res = await apiClient.get("/api/v1/admins/rbac")
    return res?.data || { roles: [], permissions: [] }
  },

  async createRole(name: string, permissionNames: string[] = []) {
    const res = await apiClient.post("/api/v1/admins/rbac/roles", { name, permissions: permissionNames })
    return res?.data
  },

  async updateRolePermissions(roleId: string, permissionNames: string[]) {
    const res = await apiClient.put(`/api/v1/admins/rbac/roles/${roleId}`, { permissions: permissionNames })
    return res?.data
  },

  async deleteRole(roleId: string) {
    const res = await apiClient.delete(`/api/v1/admins/rbac/roles/${roleId}`)
    return res?.data
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await apiClient.put("/api/v1/auth/change-password", { currentPassword, newPassword })
    return res?.data
  },

  // NOTE: ticket submission moved to the shared SupportTicketsApi
  // (@/api/supportTickets), which every portal uses now -- see
  // support.routes.ts on the backend.

  // ==========================================
  // Super Admin: Admin Management module
  // ==========================================
  async getAdmins(params: { search?: string; status?: string; role?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.status && params.status !== "all") qs.set("status", params.status)
    if (params.role && params.role !== "all") qs.set("role", params.role)
    const suffix = qs.toString() ? `?${qs.toString()}` : ""
    const res = await apiClient.get(`/api/v1/admins/management/admins${suffix}`)
    return res?.data?.admins || []
  },

  async createAdmin(payload: { email: string; fullName: string; password: string; roleNames: string[] }) {
    const res = await apiClient.post("/api/v1/admins/management/admins", payload)
    return res?.data
  },

  // Multi-role assign/replace -- reuses the existing hardened RBAC endpoint
  // (POST /admins/users/:id/roles, requireSuperAdmin-gated, delegates to
  // RbacService.assignRolesToUser server-side).
  async assignAdminRoles(userId: string, roleIds: string[]) {
    const res = await apiClient.post(`/api/v1/admins/users/${userId}/roles`, { roleIds })
    return res?.data
  },

  async removeAdminRole(userId: string, roleName: string) {
    const res = await apiClient.delete(`/api/v1/admins/management/admins/${userId}/roles/${encodeURIComponent(roleName)}`)
    return res?.data
  },
}

export default AdminApi
