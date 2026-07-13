import { z } from "zod"
import { WorkMode, ApplicationStatus } from "@prisma/client"

// Explicit states for Company Verification Onboarding Document Types
export const AllowedDocumentFormats = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
export const MaxDocumentSize = 10 * 1024 * 1024 // 10 MB
export const AllowedDocumentCategories = ["GovernmentIssuedID", "TaxRegistration", "BusinessLicense", "UtilityBill"]

// Company Verification Document schema helper
export const verificationDocumentSchema = z.object({
  url: z.string().url("Invalid document URL"),
  publicId: z.string().min(1, "Cloudinary public ID is required"),
  size: z.number().max(MaxDocumentSize, "File size must not exceed 10 MB"),
  mimetype: z.string().refine(val => AllowedDocumentFormats.includes(val), {
    message: "Invalid file format. Allowed formats: PDF, PNG, JPG, JPEG",
  }),
  category: z.string().refine(val => AllowedDocumentCategories.includes(val), {
    message: `Invalid document category. Allowed categories: ${AllowedDocumentCategories.join(", ")}`,
  }),
})

// Logo schema helper
export const logoMetadataSchema = z.object({
  url: z.string().url("Invalid logo URL"),
  publicId: z.string().min(1, "Logo public ID is required"),
  size: z.number().max(2 * 1024 * 1024, "Logo size must not exceed 2 MB").optional(),
  mimetype: z.string().optional(),
})

// Company Onboarding Schema
//
// This endpoint (POST /company/onboard) is used both for the initial
// verification wizard AND as the general "Company Profile" edit form
// (frontend CompanyProfile.tsx) that recruiters revisit any time after
// approval to update their name/description/perks. verificationDocuments
// used to be required with min(1) on every call -- so every single profile
// edit made after the initial onboarding (which never re-collects documents)
// failed Zod validation with a 400, and the frontend's catch block only
// console.error'd it, so the recruiter saw no error and no success message.
// It's now optional; the service only touches stored documents when new
// ones are actually submitted.
export const onboardCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters.").optional(),
  description: z.string().optional(),
  logo: logoMetadataSchema.optional(),
  website: z.string().url("Invalid website URL"),
  location: z.string().min(2, "Location is required"),
  industryName: z.string().min(2, "Industry is required"),
  claimedPerks: z.array(z.string()).optional(),
  verificationDocuments: z.array(verificationDocumentSchema).optional(),
})

// Date helper validator: DD/MM/YYYY and in future
const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/
const futureDateSchema = z.string().regex(dateRegex, "Date must be in DD/MM/YYYY format").refine(val => {
  const parts = val.split("/")
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  const targetDate = new Date(year, month, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return targetDate >= today
}, "Deadline must be a future date")

// Job posting base schema
export const createJobBaseSchema = z.object({
  title: z.string().min(2, "Job title must be at least 2 characters").max(100),
  location: z.string().min(2, "Location is required"),
  type: z.string().min(2, "Job type is required (e.g. Full-time, Part-time)"),
  workMode: z.nativeEnum(WorkMode),
  description: z.string().min(10, "Description must be at least 10 characters"),
  responsibilities: z.string().min(10, "Responsibilities must be at least 10 characters"),
  requirements: z.string().min(10, "Requirements must be at least 10 characters"),
  benefits: z.string().min(10, "Benefits must be at least 10 characters"),
  deadline: futureDateSchema,
  salaryDisplay: z.string().min(1, "Salary display string is required"),
  salaryMin: z.number().int().positive("Minimum salary must be positive"),
  salaryMax: z.number().int().positive("Maximum salary must be positive"),
  experienceMin: z.number().int().nonnegative("Minimum experience must be non-negative"),
  experienceMax: z.number().int().nonnegative("Maximum experience must be non-negative"),
  departmentName: z.string().min(2, "Department name is required"),
  skills: z.array(z.string()).min(1, "At least one skill is required"),
  menstrualLeaveChampion: z.boolean().optional(),
  flexibleHours: z.boolean().optional(),
  workFromHome: z.boolean().optional(),
  status: z.enum(["draft", "pending_approval"]).optional(), // Default is draft or pending approval when posting
})

// Refined schema for Job creation
export const createJobSchema = createJobBaseSchema.refine(data => data.salaryMax >= data.salaryMin, {
  message: "Maximum salary must be greater than or equal to minimum salary",
  path: ["salaryMax"],
}).refine(data => data.experienceMax >= data.experienceMin, {
  message: "Maximum experience must be greater than or equal to minimum experience",
  path: ["experienceMax"],
})

// Partial schema for Job updates
export const updateJobSchema = createJobBaseSchema.partial()

// Applicant Pipeline Schema
// Supported Workflow States match the real ApplicationStatus Prisma enum exactly:
// Applied, Reviewed, Shortlisted, InterviewScheduled, OfferReleased, Hired, Rejected.
// NOTE: InterviewScheduled and OfferReleased require structured data (a real interview
// date, real offer details) and can no longer be set through this generic endpoint --
// use POST /applications/:id/interview and POST /applications/:id/offer instead.
export const progressApplicationSchema = z.object({
  status: z.enum([
    "Applied",
    "Reviewed",
    "Shortlisted",
    "Hired",
    "Rejected"
  ]),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
})

// Schedule a real interview (creates an Interview record + moves status to InterviewScheduled)
export const scheduleInterviewSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date/time"),
  durationMins: z.number().int().positive().max(600).optional(),
  location: z.string().max(500).optional(),
})

// Release a real offer (persists offer details + moves status to OfferReleased)
export const releaseOfferSchema = z.object({
  offerDetails: z.string().min(1, "Offer details are required").max(2000),
})

// Recruiter settings preferences
export const recruiterSettingsSchema = z.object({
  realTimeNotifications: z.boolean().optional(),
  emailDigestInterval: z.enum(["Instant", "Daily", "Weekly", "None"]).optional(),
  // The Settings page (frontend Settings.tsx) also lets a recruiter edit
  // their name, job title, and phone number, but this endpoint previously
  // only accepted the two notification-preference fields above -- so those
  // edits were validated client-side, "saved" with a success banner, and
  // then silently discarded because the request body fields were never
  // even sent to the API. fullName/phone are real RecruiterProfile columns;
  // jobTitle has no dedicated column, so it's stored in the same
  // preferences JSON blob as the notification settings.
  fullName: z.string().min(2, "Name must be at least 2 characters.").optional(),
  phone: z.string().min(8, "Phone number must be at least 8 digits.").optional(),
  jobTitle: z.string().min(2, "Job title must be at least 2 characters.").optional(),
})

// Invite Colleague Schema
export const inviteColleagueSchema = z.object({
  email: z.string().email("Invalid email address"),
})
