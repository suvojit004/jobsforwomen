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
