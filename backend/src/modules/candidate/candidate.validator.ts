import { z } from "zod"

export const updateCandidateProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
  title: z.string().max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  // was length-only (`.max(20)`), so "!!!!" or "abc" was persisted
  // as-is. `.refine` only runs when a non-empty value is present, so
  // clearing the field (empty string/null) still passes.
  phone: z
    .string()
    .max(20)
    .refine((val) => !val || /^\+?[0-9]{10,14}$/.test(val), "Please enter a valid phone number (10-14 digits).")
    .nullable()
    .optional(),
  location: z.string().max(100).nullable().optional(),
  totalExperience: z.string().max(50).nullable().optional(),
  careerBreak: z.object({
    hasBreak: z.boolean(),
    reason: z.string().optional().nullable(),
    duration: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
  }).nullable().optional(),
  preferredLocations: z.array(z.string()).optional(),
  availability: z.string().max(50).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  noticePeriod: z.string().nullable().optional(),
  expectedSalary: z.string().nullable().optional(),
  languages: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(), // Array of skill names
  experience: z.array(z.record(z.string(), z.any())).optional(),
  education: z.array(z.record(z.string(), z.any())).optional(),
  socialLinks: z.array(
    z.object({
      platform: z.string(),
      url: z.string().url(),
    })
  ).optional(),
})

export const updateCandidateSettingsSchema = z.object({
  marketingEmails: z.boolean().optional(),
  applicationUpdates: z.boolean().optional(),
  newJobAlerts: z.boolean().optional(),
  chatMessages: z.boolean().optional(),
  profileVisibility: z.enum(["Public", "Private", "RecruitersOnly"]).optional(),
  showSalary: z.boolean().optional(),
  theme: z.enum(["Light", "Dark", "System"]).optional(),
  emailFormat: z.enum(["HTML", "Text"]).optional(),
  // Fields actually sent by the candidate Settings page (Notifications +
  // Security tabs). Previously missing here, so Zod's default "strip unknown
  // keys" behavior silently dropped every one of these on every save -- the
  // UI showed "Preferences saved!" but nothing was ever persisted.
  emailNewJobs: z.boolean().optional(),
  emailStatusUpdate: z.boolean().optional(),
  emailInterviews: z.boolean().optional(),
  emailPlatformNews: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
})

export const reportJobSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
})

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty").max(1000),
})
