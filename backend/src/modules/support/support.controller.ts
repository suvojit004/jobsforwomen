import type { Request, Response } from "express"
import { SupportService, ServiceContext } from "./support.service"
import { sendSuccess } from "../../shared/utils/response"
import { createTicketSchema, updateTicketStatusSchema, listTicketsQuerySchema, addCommentSchema } from "./support.validator"

export class SupportController {
  private service = new SupportService()

  private getContext(req: Request): ServiceContext {
    const userAgent = req.headers["user-agent"] || ""
    const deviceType = userAgent.includes("Mobile") ? "Mobile" : "Desktop"
    return {
      ipAddress: req.ip || "127.0.0.1",
      browser: userAgent || "Unknown",
      device: deviceType,
    }
  }

  createTicket = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const roles = req.user?.roles || []
      const validated = createTicketSchema.parse(req.body)
      const ticket = await this.service.createTicket(userId, roles, validated.subject, validated.category, validated.message, this.getContext(req))
      return sendSuccess(res, ticket, "Your issue ticket has been filed successfully. Support will update you soon.")
    } catch (err: any) {
      next(err)
    }
  }

  listMyTickets = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const tickets = await this.service.listMyTickets(userId)
      return sendSuccess(res, tickets, "Your tickets fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  listAllTickets = async (req: Request, res: Response, next: any) => {
    try {
      const query = listTicketsQuerySchema.parse(req.query)
      const result = await this.service.listAllTickets(query)
      return sendSuccess(res, result, "Support tickets fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  getTicketById = async (req: Request, res: Response, next: any) => {
    try {
      const userId = req.user?.userId || ""
      const roles = req.user?.roles || []
      const ticket = await this.service.getTicketById(req.params.id as string, userId, roles)
      return sendSuccess(res, ticket, "Ticket fetched successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  updateTicketStatus = async (req: Request, res: Response, next: any) => {
    try {
      const operatorId = req.user?.userId || ""
      const operatorEmail = req.user?.email || ""
      const validated = updateTicketStatusSchema.parse(req.body)
      const ticket = await this.service.updateTicketStatus(
        req.params.id as string,
        operatorId,
        operatorEmail,
        validated.status,
        validated.resolutionNotes,
        this.getContext(req)
      )
      return sendSuccess(res, ticket, "Ticket updated successfully.")
    } catch (err: any) {
      next(err)
    }
  }

  addComment = async (req: Request, res: Response, next: any) => {
    try {
      const authorId = req.user?.userId || ""
      const roles = req.user?.roles || []
      const validated = addCommentSchema.parse(req.body)
      const comment = await this.service.addComment(req.params.id as string, authorId, roles, validated.message, this.getContext(req))
      return sendSuccess(res, comment, "Reply posted successfully.")
    } catch (err: any) {
      next(err)
    }
  }
}

export default SupportController
