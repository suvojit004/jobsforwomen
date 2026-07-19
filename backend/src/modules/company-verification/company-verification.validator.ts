import { z } from "zod"

// Public, unauthenticated resubmission form (Part 3 of the recruiter
// onboarding/approval spec). All fields optional except comment -- a
// recruiter might only be fixing one thing (e.g. just re-uploading a
// document without changing any text field).
export const resubmitCompanySchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters.").optional(),
  website: z.string().url("Invalid website URL").optional(),
  industryName: z.string().min(2, "Industry is required").optional(),
  location: z.string().min(2, "Headquarters location is required").optional(),
  comment: z.string().min(1, "Please add a comment describing what you updated.").max(2000),
})

export const documentCategorySchema = z.object({
  category: z.string().min(1, "Document category is required"),
})
