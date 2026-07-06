import { z } from "zod"

export const updateCandidateProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
  title: z.string().max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  noticePeriod: z.string().nullable().optional(),
  expectedSalary: z.string().nullable().optional(),
  languages: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(), // Array of skill names
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      description: z.string().optional(),
    })
  ).optional(),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      fieldOfStudy: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().nullable(),
    })
  ).optional(),
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
})

export const reportJobSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
})

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty").max(1000),
})
