import apiClient from "@/api/client"

export type TicketStatus = "Open" | "InProgress" | "Resolved"

export interface TicketParticipant {
  id: string
  email: string
  candidateProfile?: { fullName: string } | null
  recruiterProfile?: { fullName: string } | null
  adminProfile?: { fullName: string } | null
}

export interface TicketComment {
  id: string
  ticketId: string
  authorId: string
  message: string
  createdAt: string
  author?: TicketParticipant
}

export interface SupportTicket {
  id: string
  subject: string
  category: string
  message: string
  status: TicketStatus
  submittedById: string
  submitterRole: string
  assignedToId: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  submittedBy?: TicketParticipant
  assignedTo?: TicketParticipant | null
  // Only populated on the single-ticket detail response (getById) -- list
  // views (listMine/listAll) deliberately stay lean, see support.service.ts.
  comments?: TicketComment[]
}

// Shared "Report Platform Issue" client -- used by the Candidate, Recruiter,
// and Admin portals alike (see support.routes.ts on the backend, mounted at
// /api/v1/support-tickets rather than under the admin-only /api/v1/admins).
export const SupportTicketsApi = {
  async createTicket(subject: string, category: string, message: string): Promise<SupportTicket> {
    const res = await apiClient.post("/api/v1/support-tickets", { subject, category, message })
    return res?.data
  },

  async listMine(): Promise<SupportTicket[]> {
    const res = await apiClient.get("/api/v1/support-tickets/mine")
    return res?.data || []
  },

  async listAll(params: { status?: TicketStatus; page?: number; limit?: number } = {}): Promise<{
    tickets: SupportTicket[]
    total: number
    page: number
    limit: number
  }> {
    const qs = new URLSearchParams()
    if (params.status) qs.set("status", params.status)
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", String(params.limit ?? 20))
    const res = await apiClient.get(`/api/v1/support-tickets?${qs.toString()}`)
    return res?.data || { tickets: [], total: 0, page: 1, limit: 20 }
  },

  async getById(id: string): Promise<SupportTicket> {
    const res = await apiClient.get(`/api/v1/support-tickets/${id}`)
    return res?.data
  },

  async updateStatus(id: string, status: TicketStatus, resolutionNotes?: string): Promise<SupportTicket> {
    const res = await apiClient.put(`/api/v1/support-tickets/${id}/status`, { status, resolutionNotes })
    return res?.data
  },

  async addComment(id: string, message: string): Promise<TicketComment> {
    const res = await apiClient.post(`/api/v1/support-tickets/${id}/comments`, { message })
    return res?.data
  },
}

export default SupportTicketsApi
