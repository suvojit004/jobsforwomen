import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  Award,
  Users,
  Heart,
  Edit2,
  Trash2,
  Pause,
  Play,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { JobPostingForm } from "../components/JobPostingForm"
import { RecruiterApi } from "../services/recruiterApi"
import { cn } from "@/lib/utils"

interface JobDetail {
  id: string
  title: string
  department: string
  workMode: "Remote" | "Hybrid" | "On-site"
  type: string
  location: string
  salary: string
  skills: string[]
  description: string
  responsibilities: string
  requirements: string
  benefits: string
  deadline: string
  menstrualLeaveChampion: boolean
  flexibleHours: boolean
  workFromHome: boolean
  status: string
  applicants: number
  postedOn: string
}

// Backend job statuses map to a simplified display status.
//
// CONFIRMED PRODUCTION BUG (fixed here): this used to collapse
// "pending_approval" and "flagged" into the same generic "Closed" bucket as
// ManageJobs.tsx does, but -- unlike ManageJobs.tsx -- this page never
// gated the Pause/Activate toggle button on displayStatus, so it always
// rendered "Activate Posting" for a job in any non-Active/non-Paused state.
// Clicking it called the "resume" lifecycle action, which the backend
// previously applied unconditionally -- silently marking an unreviewed
// (pending_approval) or admin-rejected (flagged) job as "approved" and
// bypassing moderation entirely. The backend now rejects that transition
// (recruiter.service.ts lifecycleJob), but the button here also needs to
// stop offering an action that can never legitimately succeed for those
// states, and needs to say what's actually going on instead of "Closed".
function toDisplayStatus(status: string): "Active" | "Paused" | "Pending Approval" | "Rejected" | "Closed" {
  if (status === "approved") return "Active"
  if (status === "paused") return "Paused"
  if (status === "pending_approval") return "Pending Approval"
  if (status === "flagged") return "Rejected"
  return "Closed" // draft, closed, archived
}

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [job, setJob] = useState<JobDetail | null>(null)
  const [applicantStats, setApplicantStats] = useState({ interviews: 0, offers: 0, hired: 0 })

  // Real fetch from the backend -- this page previously matched the :id
  // param against a hardcoded array of 5 sample jobs plus a localStorage
  // override cache, so every real job (real UUID ids from Postgres) always
  // rendered "Posting Not Found."
  const load = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const result = await RecruiterApi.getJobById(id)
      setJob(result)

      if (result) {
        const applicants = await RecruiterApi.getApplicants(id)
        setApplicantStats({
          interviews: applicants.filter((a) => a.status === "Interview Scheduled").length,
          offers: applicants.filter((a) => a.status === "Offer Released").length,
          hired: applicants.filter((a) => a.status === "Selected").length,
        })
      }
    } catch (err) {
      console.error("Failed to load job posting", err)
      setJob(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading job posting...</div>
  }

  if (!job) {
    return (
      <div className="py-12 max-w-md mx-auto text-center space-y-4">
        <AlertCircle className="size-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Posting Not Found</h2>
        <p className="text-sm text-slate-500">We couldn't locate the job posting details you requested.</p>
        <Button onClick={() => navigate("/recruiter/manage-jobs")}>Back to Listings</Button>
      </div>
    )
  }

  const displayStatus = toDisplayStatus(job.status)

  // Real save -- calls PUT /api/v1/recruiters/jobs/:id and persists to
  // Postgres, replacing the old handler that only ever wrote to
  // localStorage and never touched the backend.
  const handleEditSubmit = async (values: any) => {
    try {
      await RecruiterApi.updateJob(job.id, values)
      toast.success("Job posting updated successfully.")
      setIsEditing(false)
      load()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't update this job posting.")
    }
  }

  // Real toggle via the same lifecycle endpoint ManageJobs.tsx uses.
  const handleToggleStatus = async () => {
    const action = displayStatus === "Active" ? "pause" : "resume"
    try {
      await RecruiterApi.setJobLifecycle(job.id, action)
      toast.success(displayStatus === "Active" ? "Job posting paused." : "Job posting resumed.")
      load()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't update this job posting.")
    }
  }

  // Real delete via DELETE /api/v1/recruiters/jobs/:id.
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this job posting? This cannot be undone.")) return
    try {
      await RecruiterApi.deleteJob(job.id)
      toast.success("Job posting deleted.")
      navigate("/recruiter/manage-jobs")
    } catch (err: any) {
      toast.error(err?.message || "Couldn't delete this job posting.")
    }
  }

  // Map values for the posting form
  const initialFormValues = {
    title: job.title,
    department: job.department,
    location: job.location,
    salary: job.salary,
    experience: "",
    type: job.type as "Full Time" | "Part Time",
    workMode: job.workMode,
    skills: job.skills.join(", "),
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    deadline: job.deadline,
    menstrualLeaveChampion: job.menstrualLeaveChampion,
    flexibleHours: job.flexibleHours,
    workFromHome: job.workFromHome,
  }

  // Generate bullet lists helper
  const renderList = (text: string) => {
    return text
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item, idx) => {
        const cleanItem = item.startsWith("-") ? item.substring(1).trim() : item
        return (
          <li key={idx} className="text-xs font-semibold text-slate-700 leading-relaxed dark:text-slate-300 flex items-start gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6B2C91] dark:bg-pink-400 mt-1.5 shrink-0" />
            {cleanItem}
          </li>
        )
      })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          to="/recruiter/manage-jobs"
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5" />
          Back to Listings
        </Link>
      </div>

      {isEditing ? (
        /* Edit Form mode */
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">Edit Job Posting</h1>
            <p className="text-xs font-bold text-slate-500">Modify details for "{job.title}" below.</p>
          </div>
          <JobPostingForm
            onSubmit={handleEditSubmit}
            initialValues={initialFormValues}
            submitLabel="Save Specifications"
          />
        </div>
      ) : (
        /* Standard detail viewer mode */
        <div className="space-y-6">
          {/* Header Action Card */}
          <DashboardCard className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-950 truncate dark:text-white">
                    {job.title}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-black uppercase ring-1 ring-inset shrink-0",
                      // Part 17 accessible status colors: Pending -> Blue
                      // (was amber, shared with the unrelated "Paused" state
                      // which made both look like the same status), Paused
                      // -> Gray (a "disabled"/not-currently-live state,
                      // distinct from awaiting-admin-review).
                      displayStatus === "Active"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : displayStatus === "Pending Approval"
                        ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300"
                        : displayStatus === "Rejected"
                        ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300"
                        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {displayStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  <span className="uppercase text-[#6B2C91] dark:text-pink-300 font-extrabold">{job.department}</span>
                  <span>•</span>
                  <span>{job.location} ({job.workMode})</span>
                  <span>•</span>
                  <span>Posted {job.postedOn}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
                >
                  <Edit2 className="size-4" />
                  Edit Posting
                </Button>
                {/* Only an approved (Active) or paused job can legitimately be
                    toggled by the recruiter -- moderation approval itself
                    is admin-only. See toDisplayStatus's comment above. */}
                {(displayStatus === "Active" || displayStatus === "Paused") && (
                  <Button
                    onClick={handleToggleStatus}
                    variant="outline"
                    className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
                  >
                    {displayStatus === "Active" ? (
                      <>
                        <Pause className="size-4" />
                        Pause Posting
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />
                        Activate Posting
                      </>
                    )}
                  </Button>
                )}
                {displayStatus === "Pending Approval" && (
                  <span className="h-9 inline-flex items-center px-3 text-xs font-bold text-blue-600 dark:text-blue-300">
                    Awaiting admin approval
                  </span>
                )}
                {displayStatus === "Rejected" && (
                  <span className="h-9 inline-flex items-center px-3 text-xs font-bold text-red-600 dark:text-red-300">
                    Rejected by admin
                  </span>
                )}
                <Button
                  onClick={handleDelete}
                  variant="ghost"
                  className="h-9 font-bold text-xs gap-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          </DashboardCard>

          {/* Statistics Grid -- real counts from RecruiterApi.getApplicants(),
              replacing the previous Math.ceil(applicants * 0.4/0.15/0.05)
              fabricated percentages. */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Total Applicants", value: job.applicants, icon: Users, color: "text-[#6B2C91]" },
              { label: "Interviews Scheduled", value: applicantStats.interviews, icon: Calendar, color: "text-blue-500" },
              { label: "Offers Released", value: applicantStats.offers, icon: Award, color: "text-emerald-500" },
              { label: "Hired", value: applicantStats.hired, icon: CheckCircle, color: "text-amber-500" },
            ].map((stat, idx) => {
              const Icon = stat.icon
              return (
                <DashboardCard key={idx} className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">{stat.label}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
                  </div>
                  <Icon className={cn("size-5", stat.color)} />
                </DashboardCard>
              )
            })}
          </div>

          {/* Details Content Columns */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left side specs details */}
            <div className="md:col-span-2 space-y-6">
              {/* Description */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Job Description
                </h3>
                <p className="text-xs leading-relaxed text-slate-700 font-semibold dark:text-slate-300">
                  {job.description}
                </p>
              </DashboardCard>

              {/* Responsibilities */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Responsibilities
                </h3>
                <ul className="space-y-2">
                  {renderList(job.responsibilities)}
                </ul>
              </DashboardCard>

              {/* Requirements */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Requirements
                </h3>
                <ul className="space-y-2">
                  {renderList(job.requirements)}
                </ul>
              </DashboardCard>

              {/* Benefits */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Benefits & Perks
                </h3>
                <ul className="space-y-2">
                  {renderList(job.benefits)}
                </ul>
              </DashboardCard>
            </div>

            {/* Right side specifications summary sidebar */}
            <div className="space-y-6">
              {/* Job Specification Card */}
              <DashboardCard className="p-5 space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Job Specifications
                </h3>

                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <Briefcase className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Employment Type</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Work Mode</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.workMode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Salary Package</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.salary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Application Deadline</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.deadline}</p>
                    </div>
                  </div>
                </div>
              </DashboardCard>

              {/* Progressive Policies Status */}
              <DashboardCard className="p-5 space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Equality Indicators
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Menstrual Leave Support</span>
                    {job.menstrualLeaveChampion ? (
                      <span className="rounded-full bg-pink-50 dark:bg-pink-950/20 text-pink-500 px-2 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                        <Heart className="size-3 fill-pink-500" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Flexible Shift Hours</span>
                    {job.flexibleHours ? (
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Work from Home Stipends</span>
                    {job.workFromHome ? (
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </DashboardCard>

              {/* View Applicants Shortcut */}
              <DashboardCard className="p-4 bg-gradient-to-r from-violet-50/50 to-pink-50/50 border border-violet-100 dark:from-violet-950/20 dark:to-pink-950/10 dark:border-violet-400/20 flex items-center justify-between select-none">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Applicant Log</p>
                  <p className="text-xs font-black text-slate-900 dark:text-white">Inspect application pipeline</p>
                </div>
                <Button
                  onClick={() => navigate(`/recruiter/applicants?jobId=${job.id}`)}
                  className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-8 px-3 font-extrabold text-[10px] gap-1 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
                >
                  View candidates
                  <ArrowRight className="size-3" />
                </Button>
              </DashboardCard>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default JobDetails
