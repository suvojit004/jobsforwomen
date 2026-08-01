import prisma from "../../shared/database/db"
import EventBus from "../../shared/eventBus/eventBus"
import { createAuditLog } from "../../shared/utils/audit"
import { addJob } from "../../shared/queue/queue"
import env from "../../shared/config/env"
import { AppError } from "../../shared/middleware/errorHandler"
import { TicketStatus } from "@prisma/client"

export interface ServiceContext {
  ipAddress?: string
  browser?: string
  device?: string
}

// Same admin-tier role list used everywhere else in the backend (see
// admin.routes.ts / admin.service.ts) -- kept local since there's no shared
// constants module for it, matching the existing convention.
const ADMIN_TIER = ["Admin", "Super Admin", "Moderator", "Support Executive"]

// Lightweight select so ticket-list/detail responses carry a readable name +
// email for both submitter and assignee without pulling entire user rows.
const TICKET_PARTICIPANT_SELECT = {
  id: true,
  email: true,
  candidateProfile: { select: { fullName: true } },
  recruiterProfile: { select: { fullName: true } },
  adminProfile: { select: { fullName: true } },
}

const TICKET_INCLUDE = {
  submittedBy: { select: TICKET_PARTICIPANT_SELECT },
  assignedTo: { select: TICKET_PARTICIPANT_SELECT },
}

// Detail view only -- list views (listMine/listAllTickets) deliberately stay
// lean and don't pull every ticket's full comment thread just to render a
// table row.
const TICKET_DETAIL_INCLUDE = {
  ...TICKET_INCLUDE,
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: TICKET_PARTICIPANT_SELECT } },
  },
}

// Same manager tier as updateTicketStatus -- Moderator can read the thread
// (see getTicketById's isAdminTier check) but not post to it, matching its
// read-only progress-visibility role.
const TICKET_MANAGER_TIER = ["Support Executive", "Admin", "Super Admin"]

function resolveFullName(user: { email: string; candidateProfile?: { fullName: string } | null; recruiterProfile?: { fullName: string } | null; adminProfile?: { fullName: string } | null }): string {
  return user.candidateProfile?.fullName || user.recruiterProfile?.fullName || user.adminProfile?.fullName || user.email.split("@")[0]
}

export class SupportService {
  // ==========================================
  // CREATE -- Candidate / Recruiter / Admin-tier can all file a ticket
  // (previously admin-only; see the old AdminService.submitSupportTicket).
  // ==========================================
  async createTicket(
    userId: string,
    userRoles: string[],
    subject: string,
    category: string,
    message: string,
    context?: ServiceContext
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, candidateProfile: { select: { fullName: true } }, recruiterProfile: { select: { fullName: true } }, adminProfile: { select: { fullName: true } } },
    })
    if (!user) {
      throw new AppError("User not found", 404)
    }

    const submitterRole = userRoles[0] || "Unknown"
    const submitterName = resolveFullName(user)

    const ticket = await prisma.supportTicket.create({
      data: { subject, category, message, submittedById: userId, submitterRole },
    })

    // Keep the existing "lands in the ops inbox" email channel alive as a
    // secondary notification path (outside the app) -- fire-and-forget via
    // the throttled email queue, doesn't block ticket creation either way.
    const supportInbox = env.SUPPORT_EMAIL || env.SES_FROM
    await addJob("email", "sendRaw", {
      to: supportInbox,
      subject: `[Support Ticket] ${category}: ${subject}`,
      html: `
        <h2>New Support Ticket</h2>
        <p><strong>From:</strong> ${submitterName} (${user.email}) -- ${submitterRole}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `,
    })

    await createAuditLog({
      operatorId: userId,
      operatorEmail: user.email,
      category: "SUPPORT",
      action: "SUPPORT_TICKET_SUBMITTED",
      entity: "SupportTicket",
      entityId: ticket.id,
      newValue: { subject, category, submitterRole },
      ipAddress: context?.ipAddress,
      browser: context?.browser,
      device: context?.device,
    })

    // Fans out to every active Support Executive (in-app notification +
    // socket push) -- see notification.listener.ts.
    EventBus.publish("SupportTicketCreated", {
      ticketId: ticket.id,
      subject,
      category,
      submitterName,
      submitterRole,
    })

    return ticket
  }

  // ==========================================
  // READ -- own tickets (Candidate/Recruiter "My Tickets"), all tickets
  // (admin-tier queue/progress view), and a single ticket detail.
  // ==========================================
  async listMyTickets(userId: string) {
    return prisma.supportTicket.findMany({
      where: { submittedById: userId },
      orderBy: { createdAt: "desc" },
      include: TICKET_INCLUDE,
    })
  }

  async listAllTickets(filters: { status?: TicketStatus; page: number; limit: number }) {
    const where = filters.status ? { status: filters.status } : {}
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: TICKET_INCLUDE,
      }),
      prisma.supportTicket.count({ where }),
    ])
    return { tickets, total, page: filters.page, limit: filters.limit }
  }

  async getTicketById(ticketId: string, requesterId: string, requesterRoles: string[]) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: TICKET_DETAIL_INCLUDE,
    })
    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }

    const isAdminTier = requesterRoles.some((r) => ADMIN_TIER.includes(r))
    if (!isAdminTier && ticket.submittedById !== requesterId) {
      throw new AppError("Forbidden: you do not have access to this ticket", 403)
    }

    return ticket
  }

  // ==========================================
  // UPDATE -- Support Executive (or Admin/Super Admin as an override) marks
  // progress / resolves. Moderator is deliberately excluded at the route
  // level (read-only progress visibility per spec).
  // ==========================================
  async updateTicketStatus(
    ticketId: string,
    operatorId: string,
    operatorEmail: string,
    status: TicketStatus,
    resolutionNotes: string | undefined,
    context?: ServiceContext
  ) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }

    const data: any = { status }
    // Auto-claim: the first Support Executive/Admin to act on an unassigned
    // ticket becomes its assignee, rather than requiring a separate manual
    // "assign to me" step for every ticket.
    if (!ticket.assignedToId) {
      data.assignedToId = operatorId
    }
    if (resolutionNotes !== undefined) {
      data.resolutionNotes = resolutionNotes
    }
    if (status === "Resolved") {
      data.resolvedAt = new Date()
    } else if (ticket.status === "Resolved") {
      // Reopening a previously-resolved ticket clears the resolution
      // timestamp so it doesn't misleadingly still show as resolved.
      data.resolvedAt = null
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data,
      include: TICKET_INCLUDE,
    })

    await createAuditLog({
      operatorId,
      operatorEmail,
      category: "SUPPORT",
      action: "SUPPORT_TICKET_STATUS_CHANGED",
      entity: "SupportTicket",
      entityId: ticketId,
      oldValue: { status: ticket.status },
      newValue: { status, resolutionNotes },
      ipAddress: context?.ipAddress,
      browser: context?.browser,
      device: context?.device,
    })

    // Notifies the original submitter their ticket moved/was resolved.
    // submitterRole travels with the payload so the listener can deep-link
    // to the right portal ("/candidate/help", "/recruiter/help",
    // "/admin/help-support") -- the three portals don't share a route tree.
    EventBus.publish("SupportTicketStatusChanged", {
      ticketId,
      subject: updated.subject,
      status,
      resolutionNotes,
      submitterId: updated.submittedById,
      submitterRole: ticket.submitterRole,
    })

    return updated
  }

  // ==========================================
  // COMMENTS -- threaded replies so the submitter and staff can go back and
  // forth without abusing status transitions (see the SupportTicketComment
  // model's comment for the full rationale). Posting is restricted to the
  // ticket's own submitter or the manager tier (Support Executive/Admin/
  // Super Admin); Moderator can still read the thread via getTicketById, but
  // not post -- same split as updateTicketStatus.
  // ==========================================
  async addComment(
    ticketId: string,
    authorId: string,
    authorRoles: string[],
    message: string,
    context?: ServiceContext
  ) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }

    const isManager = authorRoles.some((r) => TICKET_MANAGER_TIER.includes(r))
    const isSubmitter = ticket.submittedById === authorId
    if (!isManager && !isSubmitter) {
      throw new AppError("Forbidden: you do not have access to this ticket", 403)
    }

    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, email: true, candidateProfile: { select: { fullName: true } }, recruiterProfile: { select: { fullName: true } }, adminProfile: { select: { fullName: true } } },
    })
    if (!author) {
      throw new AppError("User not found", 404)
    }

    const comment = await prisma.supportTicketComment.create({
      data: { ticketId, authorId, message },
      include: { author: { select: TICKET_PARTICIPANT_SELECT } },
    })

    await createAuditLog({
      operatorId: authorId,
      operatorEmail: author.email,
      category: "SUPPORT",
      action: "SUPPORT_TICKET_COMMENT_ADDED",
      entity: "SupportTicket",
      entityId: ticketId,
      newValue: { commentId: comment.id },
      ipAddress: context?.ipAddress,
      browser: context?.browser,
      device: context?.device,
    })

    // Cross-notifies whichever side didn't just post: a submitter's reply
    // notifies the assignee (or every active Support Executive/admin-tier if
    // still unassigned, same fan-out as ticket creation); a staff reply
    // notifies the submitter. submitterRole travels along so the listener
    // can deep-link into the right portal, same as SupportTicketStatusChanged.
    EventBus.publish("SupportTicketCommentAdded", {
      ticketId,
      subject: ticket.subject,
      authorName: resolveFullName(author),
      isFromSubmitter: isSubmitter,
      submitterId: ticket.submittedById,
      submitterRole: ticket.submitterRole,
      assignedToId: ticket.assignedToId,
    })

    return comment
  }
}

export default SupportService
