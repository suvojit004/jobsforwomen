import { z } from "zod"
import { CompanyStatus, UserStatus } from "@prisma/client"

// Company Verification Schema
export const verifyCompanySchema = z.object({
  status: z.nativeEnum(CompanyStatus),
  notes: z.string().optional(),
})

// Job Moderation actions:
// approve, reject (flagged), hide, unhide, pause, resume, archive, delete, feature, unfeature
export const moderateJobSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "hide",
    "unhide",
    "pause",
    "resume",
    "archive",
    "delete",
    "feature",
    "unfeature",
  ]),
  notes: z.string().optional(),
})

// User Management status mutations
export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
})

// Employee Invitations Schema
export const inviteEmployeeSchema = z.object({
  email: z.string().email("Invalid email format"),
  roleName: z.enum(["Support Executive", "Moderator", "Admin", "Super Admin"]),
})

// Feature Flags Schema (Categorized into Communication, Platform, Experimental, Maintenance)
export const createFeatureFlagSchema = z.object({
  key: z.string().min(2, "Flag key must be at least 2 characters").max(100),
  value: z.boolean(),
  category: z.enum(["Communication", "Platform", "Experimental", "Maintenance"]),
  description: z.string().optional(),
})

export const updateFeatureFlagSchema = createFeatureFlagSchema.partial().omit({ key: true })

// RBAC Role Schema
export const roleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, "At least one permission is required"),
})

export const updateRoleSchema = roleSchema.partial().omit({ name: true })

// Admin "Contact Support" ticket submission
export const supportTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  category: z.string().min(1, "Category is required"),
  message: z.string().min(1, "Message is required"),
})

// Activity Logs query params (Final Implementation Pass, Part 2).
//
// CONFIRMED BUG (fixed here): the frontend previously fetched up to 500 rows
// unconditionally and did every filter (category tab, search box) purely in
// React over that single fixed page -- so an admin searching for something
// older than the last 500 audit events would see zero results even though
// matching rows existed. This schema validates/coerces the real query
// parameters the fixed getAuditLogs() now accepts so every filter change
// becomes a real, separately-paginated Prisma query.
//
// `uiCategory` mirrors the five human-friendly tabs the Activity Logs page
// has always shown (User Management / Job Moderation / Corporate Perks /
// Feature Flags / Security Settings). Those tabs were previously computed
// by re-deriving a label from `entity`/`category` in the browser after the
// fact; the same derivation now happens once, server-side, in
// admin.service.ts's getAuditLogs(), so backend and frontend can never
// disagree about what a given tab means.
export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).optional(),
  action: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  entity: z.string().trim().max(100).optional(),
  uiCategory: z
    .enum([
      "User Management",
      "Job Moderation",
      "Corporate Perks",
      "Feature Flags",
      "Security Settings",
    ])
    .optional(),
  operatorId: z.string().trim().max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})
