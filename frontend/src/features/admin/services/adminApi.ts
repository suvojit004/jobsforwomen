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

  // Destructive -- wipes the entire audit trail (GET /admins/audits/export
  // for the CSV download itself is fetched directly in ActivityLogs.tsx,
  // same manual-fetch-plus-blob pattern ReportsAnalytics.tsx uses, since it
  // needs the raw file bytes rather than a JSON envelope). Super Admin only;
  // the backend 403s otherwise.
  async deleteAllAuditLogs() {
    const res = await apiClient.delete("/api/v1/admins/audits")
    return res?.data
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

  // Only `name` is a real, writable field (-> AdminProfile.fullName). Email
  // is intentionally not sent -- it's read-only everywhere in this app (no
  // role can self-service change their login email), and the old
  // implementation that accepted it here never actually updated the real
  // User.email anyway, just a decorative copy nothing else read. See
  // AdminService.updateAdminSettings.
  async updateSettings(payload: { name: string }) {
    const res = await apiClient.put("/api/v1/admins/settings", { name: payload.name })
    return res?.data?.settings || res?.data || {}
  },

  // Profile photo -- shared by every admin-tier role (Admin, Super Admin,
  // Moderator, Support Executive), since they all key off the same
  // AdminProfile row. Previously no admin-tier role had any avatar support
  // at all (no schema column, no endpoint, no UI).
  async uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append("avatar", file)
    const res = await apiClient.post("/api/v1/admins/avatar", formData)
    return res?.data?.profile || res?.data
  },

  async deleteAvatar() {
    const res = await apiClient.delete("/api/v1/admins/avatar")
    return res?.data?.profile || res?.data
  },

  // Platform-wide "Inactivity Session Timeout" policy -- readable by any
  // admin-tier role, writable only by a Super Admin (backend 403s otherwise).
  async getSecuritySettings() {
    const res = await apiClient.get("/api/v1/admins/security-settings")
    return res?.data?.settings || res?.data || {}
  },

  async updateSecuritySettings(payload: { adminSessionTimeoutMinutes?: number | null; forceTwoFactorForAdmins?: boolean }) {
    const res = await apiClient.put("/api/v1/admins/security-settings", payload)
    return res?.data?.settings || res?.data || {}
  },

  // General, non-security platform settings -- currently just the
  // "Operations Support Contacts" technical helpdesk email on the Help &
  // Support page. Readable by any admin-tier role, writable by Admin/Super
  // Admin (backend 403s otherwise).
  async getPlatformSettings() {
    const res = await apiClient.get("/api/v1/admins/platform-settings")
    return res?.data?.settings || res?.data || {}
  },

  async updatePlatformSettings(payload: { supportContactEmail: string }) {
    const res = await apiClient.put("/api/v1/admins/platform-settings", payload)
    return res?.data?.settings || res?.data || {}
  },

  // Two-Factor Authentication -- these hit /auth/2fa/*, not /admins/*
  // (self-service account management, same as changePassword above calling
  // /auth/change-password), but are exposed from the Admin Settings page.
  async start2FAEnrollment() {
    const res = await apiClient.post("/api/v1/auth/2fa/enroll/start", {})
    return res?.data || {}
  },

  async confirm2FAEnrollment(code: string) {
    const res = await apiClient.post("/api/v1/auth/2fa/enroll/confirm", { code })
    return res?.data || {}
  },

  async disable2FA(password: string) {
    const res = await apiClient.post("/api/v1/auth/2fa/disable", { password })
    return res?.data || {}
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

  // RBAC (Roles & Permissions Matrix, and the role picker on Admin
  // Management) now calls /api/v1/rbac/* directly -- the real, fully
  // permission-gated implementation (rbac.service.ts) -- rather than the
  // parallel /api/v1/admins/rbac/* copy that used to live on admin.routes.ts
  // and has since been removed. That router has no single combined
  // "matrix" endpoint, so getRBAC composes {roles, permissions} from its
  // two list endpoints client-side instead of adding a redundant one
  // server-side.
  async getRBAC() {
    const [rolesRes, permissionsRes] = await Promise.all([
      apiClient.get("/api/v1/rbac/roles"),
      apiClient.get("/api/v1/rbac/permissions"),
    ])
    return {
      roles: rolesRes?.data?.roles || [],
      permissions: permissionsRes?.data?.permissions || [],
    }
  },

  async createRole(name: string, permissionNames: string[] = []) {
    const res = await apiClient.post("/api/v1/rbac/roles", { name, permissionNames })
    return res?.data
  },

  async updateRolePermissions(roleId: string, permissionNames: string[]) {
    const res = await apiClient.post(`/api/v1/rbac/roles/${roleId}/permissions`, { permissionNames })
    return res?.data
  },

  async deleteRole(roleId: string) {
    const res = await apiClient.delete(`/api/v1/rbac/roles/${roleId}`)
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

  async createAdmin(payload: { email: string; fullName: string; roleNames: string[] }) {
    const res = await apiClient.post("/api/v1/admins/management/admins", payload)
    return res?.data
  },

  // Multi-role assign/replace -- calls the real RBAC endpoint directly
  // (POST /api/v1/rbac/users/:id/roles, requireSuperAdmin + manage:users
  // gated, backed by RbacService.assignRolesToUser). Used to go through a
  // parallel route on admin.routes.ts that forwarded to the same service;
  // that forwarding route was removed, so this calls it directly now.
  async assignAdminRoles(userId: string, roleIds: string[]) {
    const res = await apiClient.post(`/api/v1/rbac/users/${userId}/roles`, { roleIds })
    return res?.data
  },

  async removeAdminRole(userId: string, roleName: string) {
    const res = await apiClient.delete(`/api/v1/admins/management/admins/${userId}/roles/${encodeURIComponent(roleName)}`)
    return res?.data
  },
}

export default AdminApi
