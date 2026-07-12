import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Briefcase,
  MapPin,
  IndianRupee,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { JobCard } from "@/components/dashboard/JobCard"
import { cn } from "@/lib/utils"

const predefinedSalaries = [
  "₹ 2 – 4 LPA",
  "₹ 4 – 6 LPA",
  "₹ 6 – 8 LPA",
  "₹ 8 – 10 LPA",
  "₹ 10 – 12 LPA",
  "₹ 12 – 15 LPA",
  "₹ 15 – 20 LPA",
  "₹ 20+ LPA",
]

const predefinedExperiences = [
  "Fresher",
  "0–1 Years",
  "1–2 Years",
  "2–3 Years",
  "3–5 Years",
  "5–7 Years",
  "7–10 Years",
  "10+ Years",
  "Women Returnee",
]

const predefinedDepartments = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "Finance",
  "Human Resources",
  "Operations",
  "Legal",
  "Customer Support",
  "Data Science",
  "Business Development",
]

// Form validation schema using Zod
const jobSchema = z
  .object({
    title: z.string().min(3, "Job title must be at least 3 characters."),
    department: z.string().min(1, "Department is required."),
    customDepartment: z.string().optional(),
    location: z.string().min(2, "Location is required."),
    salary: z.string().min(1, "Salary range is required."),
    customSalary: z.string().optional(),
    experience: z.string().min(1, "Experience level is required."),
    customExperience: z.string().optional(),
    type: z.enum(["Full Time", "Part Time"]),
    workMode: z.enum(["Remote", "Hybrid", "On-site"]),
    skills: z.string().min(2, "Please enter at least one skill required."),
    description: z.string().min(10, "Job description must be at least 10 characters."),
    responsibilities: z.string().min(10, "Responsibilities must be at least 10 characters."),
    requirements: z.string().min(10, "Requirements must be at least 10 characters."),
    benefits: z.string().min(10, "Benefits must be at least 10 characters."),
    deadline: z.string().min(5, "Application deadline is required."),
    menstrualLeaveChampion: z.boolean(),
    flexibleHours: z.boolean(),
    workFromHome: z.boolean(),
    otherBenefits: z.boolean().optional(),
    otherBenefitsText: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.salary === "Others" && (!data.customSalary || data.customSalary.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom salary range is required.",
        path: ["customSalary"],
      })
    }
    if (data.experience === "Others" && (!data.customExperience || data.customExperience.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom experience level is required.",
        path: ["customExperience"],
      })
    }
    if (data.department === "Others" && (!data.customDepartment || data.customDepartment.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom department is required.",
        path: ["customDepartment"],
      })
    }
    if (data.otherBenefits && (!data.otherBenefitsText || data.otherBenefitsText.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify your other workplace benefits.",
        path: ["otherBenefitsText"],
      })
    }
  })

type JobFormValues = z.infer<typeof jobSchema>

type JobPostingFormProps = {
  onSubmit: (values: JobFormValues) => void
  onSaveDraft?: (values: Partial<JobFormValues>) => void | Promise<void>
  initialValues?: Partial<JobFormValues>
  submitLabel?: string
}

export function JobPostingForm({
  onSubmit,
  onSaveDraft,
  initialValues,
  submitLabel = "Publish Opportunity",
}: JobPostingFormProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const getInitialSalaryValue = () => {
    const val = initialValues?.salary || ""
    if (!val) return ""
    if (predefinedSalaries.includes(val)) return val
    return "Others"
  }

  const getInitialCustomSalaryValue = () => {
    const val = initialValues?.salary || ""
    if (!val) return ""
    if (predefinedSalaries.includes(val)) return ""
    return val
  }

  const getInitialExperienceValue = () => {
    const val = initialValues?.experience || ""
    if (!val) return ""
    if (predefinedExperiences.includes(val)) return val
    return "Others"
  }

  const getInitialCustomExperienceValue = () => {
    const val = initialValues?.experience || ""
    if (!val) return ""
    if (predefinedExperiences.includes(val)) return ""
    return val
  }

  const getInitialDepartmentValue = () => {
    const val = initialValues?.department || ""
    if (!val) return ""
    if (predefinedDepartments.includes(val)) return val
    return "Others"
  }

  const getInitialCustomDepartmentValue = () => {
    const val = initialValues?.department || ""
    if (!val) return ""
    if (predefinedDepartments.includes(val)) return ""
    return val
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    getValues,
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    mode: "onChange",
    defaultValues: {
      title: initialValues?.title || "",
      department: getInitialDepartmentValue(),
      customDepartment: getInitialCustomDepartmentValue(),
      location: initialValues?.location || "",
      salary: getInitialSalaryValue(),
      customSalary: getInitialCustomSalaryValue(),
      experience: getInitialExperienceValue(),
      customExperience: getInitialCustomExperienceValue(),
      type: initialValues?.type || "Full Time",
      workMode: initialValues?.workMode || "Remote",
      skills: initialValues?.skills || "",
      description: initialValues?.description || "",
      responsibilities: initialValues?.responsibilities || "",
      requirements: initialValues?.requirements || "",
      benefits: initialValues?.benefits || "",
      deadline: initialValues?.deadline || "",
      menstrualLeaveChampion: initialValues?.menstrualLeaveChampion ?? false,
      flexibleHours: initialValues?.flexibleHours ?? false,
      workFromHome: initialValues?.workFromHome ?? false,
      otherBenefits: false,
      otherBenefitsText: "",
    },
  })

  // Watch fields for rendering live preview
  const watchedValues = watch()

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateVal = e.target.value
    if (dateVal) {
      const [year, month, day] = dateVal.split("-")
      const formatted = `${day}/${month}/${year}`
      setValue("deadline", formatted, { shouldValidate: true })
    }
  }

  const handleFormSubmit = (data: any) => {
    const finalData = { ...data }
    if (data.salary === "Others") {
      finalData.salary = data.customSalary
    }
    if (data.experience === "Others") {
      finalData.experience = data.customExperience
    }
    if (data.department === "Others") {
      finalData.department = data.customDepartment
    }
    if (data.otherBenefits && data.otherBenefitsText) {
      finalData.benefits = `${data.benefits}\n\nOther Benefits:\n- ${data.otherBenefitsText}`
    }
    onSubmit(finalData as JobFormValues)
    setIsSuccess(true)
    setTimeout(() => setIsSuccess(false), 3000)
  }

  const handleDraftClick = async () => {
    if (!onSaveDraft) return
    const currentValues = getValues()
    // onSaveDraft (see PostJob.tsx) makes the real saveDraft API call and
    // shows its own success/error toast. We just await it here -- we used to
    // fire an unconditional alert("Draft saved successfully!") the instant
    // the button was clicked, regardless of whether the save actually
    // succeeded, and even on pages where no draft handler was wired up.
    await onSaveDraft(currentValues)
  }

  // Create a mock Job object for previewing
  const previewJob = {
    id: "preview-job-id",
    title: watchedValues.title || "Job Title Preview",
    company: "TechNova Solutions",
    companyCode: "TN",
    logoTone: "purple" as const,
    salary: watchedValues.salary === "Others" ? (watchedValues.customSalary || "₹ 8 - 12 LPA") : (watchedValues.salary || "₹ 8 - 12 LPA"),
    location: watchedValues.location || "Location",
    experience: watchedValues.experience === "Others" ? (watchedValues.customExperience || "1+ Years") : (watchedValues.experience || "1+ Years"),
    type: watchedValues.type || "Full Time",
    workMode: watchedValues.workMode || "Remote",
    postedAt: "Just now",
    menstrualLeaveChampion: watchedValues.menstrualLeaveChampion,
  }

  return (
    <div className="space-y-6">
      {/* Form Action Controls Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 shrink-0">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
          {isPreviewMode ? "Live Preview" : "Job Specifications"}
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
          >
            <Eye className="size-4" />
            {isPreviewMode ? "Edit Specifications" : "Preview Posting"}
          </Button>
          {!isPreviewMode && onSaveDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDraftClick}
              className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
            >
              Save Draft
            </Button>
          )}
        </div>
      </div>

      {isPreviewMode ? (
        /* Live Preview tab screen */
        <div className="space-y-6 max-w-md mx-auto py-6">
          <p className="text-xs text-slate-500 text-center dark:text-slate-400">
            This is how the job card will appear to candidates browsing the jobs page:
          </p>
          <div className="shadow-lg rounded-xl overflow-hidden border border-violet-100 dark:border-slate-800">
            <JobCard job={previewJob} />
          </div>
          <div className="text-center pt-4">
            <Button
              onClick={() => setIsPreviewMode(false)}
              className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-6 font-extrabold text-xs dark:bg-pink-600 dark:hover:bg-pink-700"
            >
              Back to Editing Form
            </Button>
          </div>
        </div>
      ) : (
        /* Actual Multi-Section Form */
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Section 1: Basic Information */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider border-b border-slate-100 pb-2 dark:border-slate-800">
              1. Basic Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Job Title</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Frontend Developer"
                    {...register("title")}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                {errors.title && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Department</label>
                <select
                  {...register("department")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                >
                  <option value="" disabled hidden>Select Department</option>
                  {predefinedDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  <option value="Others">Others</option>
                </select>
                {errors.department && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.department.message}
                  </p>
                )}

                {/* Custom Department */}
                {watchedValues.department === "Others" && (
                  <div className="mt-2 animate-fadeIn">
                    <input
                      type="text"
                      placeholder="e.g. Engineering, Design"
                      {...register("customDepartment")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                    {errors.customDepartment && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.customDepartment.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    {...register("location")}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                {errors.location && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.location.message}
                  </p>
                )}
              </div>

              {/* Offered Salary Range */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Offered Salary Range</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <select
                    {...register("salary")}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                  >
                    <option value="" disabled hidden>e.g. ₹ 8 - 12 LPA</option>
                    {predefinedSalaries.map((sal) => (
                      <option key={sal} value={sal}>{sal}</option>
                    ))}
                    <option value="Others">Others</option>
                  </select>
                </div>
                {errors.salary && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.salary.message}
                  </p>
                )}

                {/* Custom Salary */}
                {watchedValues.salary === "Others" && (
                  <div className="relative mt-2 animate-fadeIn">
                    <IndianRupee className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. ₹ 8 - 12 LPA"
                      {...register("customSalary")}
                      className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                    {errors.customSalary && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.customSalary.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Experience needed */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Experience Needed</label>
                <select
                  {...register("experience")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                >
                  <option value="" disabled hidden>Select Experience</option>
                  {predefinedExperiences.map((exp) => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                  <option value="Others">Others</option>
                </select>
                {errors.experience && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.experience.message}
                  </p>
                )}

                {/* Custom Experience */}
                {watchedValues.experience === "Others" && (
                  <div className="mt-2 animate-fadeIn">
                    <input
                      type="text"
                      placeholder="e.g. 2+ Years, 1-3 Years Returnee"
                      {...register("customExperience")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                    {errors.customExperience && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.customExperience.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Employment Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Employment Type</label>
                <select
                  {...register("type")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                >
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                </select>
                {errors.type && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Work Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Work Mode</label>
                <select
                  {...register("workMode")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
                {errors.workMode && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.workMode.message}
                  </p>
                )}
              </div>

              {/* Application Deadline */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Application Deadline</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    onChange={handleDateChange}
                    className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 opacity-0 cursor-pointer z-10"
                    tabIndex={-1}
                  />
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY (e.g. 30/06/2025)"
                    {...register("deadline")}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                {errors.deadline && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {errors.deadline.message}
                  </p>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Skills Required (Comma separated)</label>
              <input
                type="text"
                placeholder="e.g. React, TypeScript, Tailwind CSS, REST APIs"
                {...register("skills")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              {errors.skills && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.skills.message}
                </p>
              )}
            </div>
          </DashboardCard>

          {/* Section 2: Detailed Specifications */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider border-b border-slate-100 pb-2 dark:border-slate-800">
              2. Detailed Specifications
            </h3>
            
            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Job Description</label>
              <textarea
                rows={3}
                placeholder="Describe the opportunity, team tone, and company focus..."
                {...register("description")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
              />
              {errors.description && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Responsibilities */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Key Responsibilities</label>
              <textarea
                rows={3}
                placeholder="Bullet points describing core job duties..."
                {...register("responsibilities")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
              />
              {errors.responsibilities && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.responsibilities.message}
                </p>
              )}
            </div>

            {/* Requirements */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Requirements & Qualifications</label>
              <textarea
                rows={3}
                placeholder="Candidate qualifications and required skill experiences..."
                {...register("requirements")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
              />
              {errors.requirements && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.requirements.message}
                </p>
              )}
            </div>

            {/* Benefits */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Employee Benefits & Perks</label>
              <textarea
                rows={3}
                placeholder="Flexible hours, insurance details, returnship program specifications..."
                {...register("benefits")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
              />
              {errors.benefits && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.benefits.message}
                </p>
              )}
            </div>
          </DashboardCard>

          {/* Section 3: Progressive Policies / Checkboxes */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider border-b border-slate-100 pb-2 dark:border-slate-800">
              3. Workplace Equality Perks
            </h3>
            
            <div className="space-y-3.5">
              {/* Menstrual Leave */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register("menstrualLeaveChampion")}
                  className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Menstrual Leave Champion</p>
                  <p className="text-[10px] text-slate-500">Provide paid menstrual leave. A champion badge will be visible on candidates search logs.</p>
                </div>
              </label>

              {/* Flexible hours */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register("flexibleHours")}
                  className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Flexible Hours Support</p>
                  <p className="text-[10px] text-slate-500">Allow core working hours setup and custom shifts.</p>
                </div>
              </label>

              {/* Work from Home */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register("workFromHome")}
                  className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 mt-0.5"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Work From Home (WFH)</p>
                  <p className="text-[10px] text-slate-500">Allow complete virtual home operations or stipend budgets.</p>
                </div>
              </label>

              {/* Other Benefits */}
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...register("otherBenefits")}
                    className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Other Benefits</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Enable extra benefits listed below.</p>
                  </div>
                </label>

                {watchedValues.otherBenefits && (
                  <div className="pl-7 space-y-1.5 animate-fadeIn">
                    <textarea
                      rows={3}
                      placeholder="Please specify any additional workplace benefits offered by your company."
                      {...register("otherBenefitsText")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                    {errors.otherBenefitsText && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.otherBenefitsText.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>

          {/* Publishing actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={!isValid}
              className={cn(
                "h-10 px-8 font-extrabold text-xs transition-colors shrink-0",
                isValid
                  ? "bg-[#6B2C91] text-white hover:bg-[#5a237b] dark:bg-pink-600 dark:hover:bg-pink-700 cursor-pointer"
                  : "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
              )}
            >
              {submitLabel}
            </Button>
            {isSuccess && (
              <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="size-4 stroke-[3]" />
                Opportunity saved successfully!
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
export default JobPostingForm
