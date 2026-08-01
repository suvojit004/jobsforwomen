import { z } from "zod"

// Shared by Candidate/Recruiter/Admin-tier "Report Platform Issue" forms --
// category is intentionally a free string (not a z.enum) since each portal
// offers a different, portal-appropriate dropdown of options.
export const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject is too long"),
  category: z.string().min(1, "Category is required"),
  message: z.string().min(1, "Message is required").max(5000, "Message is too long"),
})

export const updateTicketStatusSchema = z.object({
  status: z.enum(["Open", "InProgress", "Resolved"]),
  // Required when resolving -- a Support Executive marking a ticket Resolved
  // with no notes leaves the submitter (and the admin-tier progress view)
  // with no idea what actually happened.
  resolutionNotes: z.string().max(5000, "Resolution notes are too long").optional(),
}).refine(
  (data) => data.status !== "Resolved" || !!data.resolutionNotes?.trim(),
  { message: "Resolution notes are required when marking a ticket Resolved.", path: ["resolutionNotes"] }
)

export const listTicketsQuerySchema = z.object({
  status: z.enum(["Open", "InProgress", "Resolved"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const addCommentSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000, "Message is too long"),
})
