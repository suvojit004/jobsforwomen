import { z } from "zod"
import { CompanyStatus, UserStatus, PerkStatus } from "@prisma/client"

// Company Verification Schema
export const verifyCompanySchema = z.object({
  status: z.nativeEnum(CompanyStatus),
  notes: z.string().optional(),
})

// Perk Request Review Schema (Parts 6/7 -- entirely independent from
// company verification above)
export const reviewPerkRequestSchema = z.object({
  status: z.nativeEnum(PerkStatus),
  comment: z.string().optional(),
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

// Hard-delete a user account. Both fields are optional and only relevant
// when the target is a recruiter who still owns job postings -- see
// AdminService.deleteUser for why this is required in that case.
export const deleteUserSchema = z.object({
  archiveJobs: z.boolean().optional(),
  transferToRecruiterId: z.string().optional(),
})

// Employee Invitations Schema
export const inviteEmployeeSchema = z.object({
  email: z.string().email("Invalid email format"),
  roleName: z.enum(["Support Executive", "Moderator", "Admin", "Super Admin"]),
})

// Super Admin Admin Management module -- direct account provisioning
// (distinct from the self-serve Employee Invitation flow above: this
// creates the account and sets an initial password immediately, gated
// entirely behind requireSuperAdmin at the route level).
export const createAdminSchema = z.object({
  email: z.string().email("Invalid email format"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleNames: z.array(z.string().min(1)).min(1, "At least one role is required"),
})

// Admin Management listing filters
export const listAdminsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.string().trim().max(100).optional(),
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

// Activity Logs query params. Validates/coerces the query so each filter
// change (category tab, search box) is a real, separately-paginated Prisma
// query rather than filtering a single fixed page client-side.
//
// `uiCategory` mirrors the five tabs the Activity Logs page shows (User
// Management / Job Moderation / Corporate Perks / Feature Flags / Security
// Settings); the label derivation happens once, server-side, in
// admin.service.ts's getAuditLogs(), so backend and frontend can't disagree
// about what a tab means.
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
