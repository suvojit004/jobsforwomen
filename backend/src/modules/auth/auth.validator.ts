import { z } from "zod"

export const registerCandidateSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
})

export const registerRecruiterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
  phone: z.string().min(10, "Phone number must be at least 10 characters long"),
  companyName: z.string().min(2, "Company name must be at least 2 characters long"),
  website: z.string().url("Invalid website URL"),
  location: z.string().min(2, "Location must be at least 2 characters long"),
  industry: z.string().min(2, "Industry name must be at least 2 characters long"),
})

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

export const oauthSchema = z.object({
  provider: z.enum(["google", "linkedin", "microsoft"]),
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid OAuth email"),
  fullName: z.string().min(2, "Full name is required"),
  providerUserId: z.string().min(1, "Provider User ID is required"),
  roleType: z.enum(["Candidate", "Recruiter"]).optional(), // Needed if registering via OAuth
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
})

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters long").optional(),
  googleToken: z.string().optional(),
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
})
