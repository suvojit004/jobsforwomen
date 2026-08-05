import { z } from "zod"

// Part 16 (inline field validation): every password field in this file
// previously enforced length only (`.min(8)`), so "aaaaaaaa" or "11111111"
// passed -- add a real complexity requirement (at least one letter + one
// number). Only applied to fields that create/replace a password (register,
// reset, accept-invitation, change-password's newPassword) -- NOT to login's
// password or deleteAccountSchema's re-auth password, since those must keep
// accepting whatever a user's *existing* password already is.
const passwordComplexity = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Password must include at least one letter and one number")

// Phone previously only checked length (`.min(10)`), so "aaaaaaaaaa" (10
// letters) passed. Real digits-only format check (with optional leading
// `+`), matching frontend/src/utils/validators.ts's PHONE_REGEX.
const phoneNumber = z
  .string()
  .regex(/^\+?[0-9]{10,14}$/, "Please enter a valid phone number (10-14 digits).")

export const registerCandidateSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: passwordComplexity,
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
})

export const registerRecruiterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: passwordComplexity,
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
  phone: phoneNumber,
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
  password: passwordComplexity,
})

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordComplexity.optional(),
  googleToken: z.string().optional(),
  fullName: z.string().min(2, "Full name must be at least 2 characters long"),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordComplexity,
})

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Your current password is required to delete your account"),
})

const totpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.")

// POST /auth/2fa/verify -- completes a login paused by AuthService.login()'s
// twoFactorEnabled branch.
export const twoFactorVerifyLoginSchema = z.object({
  pendingToken: z.string().min(1, "Two-factor challenge token is required."),
  code: totpCode,
})

// POST /auth/2fa/enroll/confirm
export const twoFactorEnrollConfirmSchema = z.object({
  code: totpCode,
})

// POST /auth/2fa/disable -- re-authenticates with the current password
// before turning 2FA off, same bar as deleteAccountSchema above.
export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, "Current password is required to disable two-factor authentication."),
})
