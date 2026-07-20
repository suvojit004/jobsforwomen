import { Briefcase, Calendar, DollarSign, MapPin, Bookmark, Check, ArrowLeft, User, Mail, Globe, Sparkles, History, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import { MenstrualLeaveChampionBadge } from "@/components/shared/MenstrualLeaveChampionBadge"
import { JobCard } from "@/components/dashboard/JobCard"
import type { ExtendedJob } from "@/types/job"
import { cn } from "@/lib/utils"

export interface JobModerationHistoryEntry {
  status: string
  notes: string | null
  changedBy: string
  createdAt: string
}

type JobDetailContentProps = {
  job: ExtendedJob
  // "candidate" (default) is the original Browse Jobs -> Job Details
  // experience: Save/Apply actions, mobile sticky action bar, related jobs.
  // "admin" reuses the exact same description/responsibilities/requirements/
  // benefits/skills/company/recruiter layout for the Job Approval review
  // modal instead of duplicating it -- no Save/Apply/related-jobs
  // (those are candidate-only concepts), optionally showing applicant count
  // and the moderation history trail instead.
  variant?: "candidate" | "admin"
  isSaved?: boolean
  isApplied?: boolean
  onSave?: () => void
  onApply?: () => void
  relatedJobs?: ExtendedJob[]
  savedJobsList?: string[]
  appliedJobsList?: string[]
  onSaveJobId?: (id: string) => void
  onApplyJobId?: (id: string) => void
  backHref?: string
  backLabel?: string
  applicantsCount?: number
  moderationHistory?: JobModerationHistoryEntry[]
}

export function JobDetailContent({
  job,
  variant = "candidate",
  isSaved = false,
  isApplied = false,
  onSave,
  onApply,
  relatedJobs = [],
  savedJobsList = [],
  appliedJobsList = [],
  onSaveJobId,
  onApplyJobId,
  backHref = "/candidate/jobs",
  backLabel = "Back to Browse Jobs",
  applicantsCount,
  moderationHistory,
}: JobDetailContentProps) {
  const isAdmin = variant === "admin"

  return (
    <div className={cn("space-y-6", isAdmin && "pb-0")}>
      {/* Back link -- admin usage renders inside a modal (JobModeration.tsx),
          so there's nowhere useful to link back to; only show it in the
          candidate full-page context. */}
      {!isAdmin && (
        <div>
          <Link
            to={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#6B2C91] hover:underline dark:text-pink-200"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
        </div>
      )}

      {/* Main Header Card */}
      <DashboardCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <CompanyLogo code={job.companyCode} tone={job.logoTone} className="size-14 sm:size-16" />
            <div className="space-y-1">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white leading-snug">
                {job.title}
              </h1>
              <p className="text-sm font-semibold text-[#6B2C91] dark:text-pink-200">
                {job.company}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {job.location} · {job.experience}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {job.postedAt}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-bold",
                  job.workMode === "Remote"
                    ? "bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100"
                    : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200"
                )}>
                  {job.workMode}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {job.type}
                </span>
                {job.womenReturnship && (
                  <span className="rounded-md bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-700 dark:bg-pink-500/15 dark:text-pink-200">
                    Returnship Friendly
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons on Desktop -- candidate variant only; admin's
              Approve/Reject/Delete actions live in JobModeration.tsx's own
              modal footer, outside this shared component. */}
          {!isAdmin && (
            <div className="hidden lg:flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onSave}
                className={cn(
                  "h-10 border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                  isSaved && "text-[#6B2C91] border-[#6B2C91]/30 bg-violet-50/50 dark:text-pink-200"
                )}
              >
                <Bookmark className={cn("mr-1.5 size-4", isSaved && "fill-current")} />
                {isSaved ? "Saved" : "Save Job"}
              </Button>
              <Button
                type="button"
                onClick={onApply}
                disabled={isApplied}
                className={cn(
                  "h-10 px-6 font-extrabold transition-all",
                  isApplied
                    ? "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                    : "bg-[#6B2C91] text-white hover:bg-[#5a237b]"
                )}
              >
                {isApplied ? (
                  <>
                    <Check className="mr-1.5 size-4" />
                    Applied
                  </>
                ) : (
                  "Apply Now"
                )}
              </Button>
            </div>
          )}
        </div>
      </DashboardCard>

      {/* Two-Column Details Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Job Description & Details */}
        <div className="space-y-6 lg:col-span-8">
          {/* Description */}
          <DashboardCard className="p-5">
            <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">
              Job Description
            </h2>
            <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
              {job.description}
            </p>
          </DashboardCard>

          {/* Responsibilities */}
          <DashboardCard className="p-5">
            <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">
              Key Responsibilities
            </h2>
            <ul className="space-y-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
              {job.responsibilities.map((resp, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="size-1.5 rounded-full bg-[#6B2C91] dark:bg-pink-400 mt-1.5 shrink-0" />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          {/* Requirements */}
          <DashboardCard className="p-5">
            <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">
              Requirements & Qualifications
            </h2>
            <ul className="space-y-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
              {job.requirements.map((req, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="size-1.5 rounded-full bg-[#6B2C91] dark:bg-pink-400 mt-1.5 shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          {/* Benefits */}
          <DashboardCard className="p-5">
            <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">
              Employee Benefits & Perks
            </h2>
            <ul className="space-y-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
              {job.benefits.map((benefit, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="size-1.5 rounded-full bg-[#6B2C91] dark:bg-pink-400 mt-1.5 shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          {/* Skills -- only present on the detail fetch (getJobById), which
              is the whole point of Issue 4/5's fix: the old list-derived
              "detail" page had no way to show these at all. */}
          {job.skills && job.skills.length > 0 && (
            <DashboardCard className="p-5">
              <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Sparkles className="size-4 text-[#6B2C91]" />
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-[#6B2C91] dark:bg-violet-500/15 dark:text-pink-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </DashboardCard>
          )}
        </div>

        {/* Right Column: Sidebar Stats, Company Profile & Related Jobs */}
        <div className="space-y-6 lg:col-span-4">
          {/* Quick Details Sidebar */}
          <DashboardCard className="p-5 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
              Job Summary
            </h2>
            <div className="grid gap-3.5">
              <div className="flex items-center gap-3 text-xs">
                <div className="size-8 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
                  <DollarSign className="size-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-500 dark:text-slate-400">Offered Salary</p>
                  <p className="font-extrabold text-slate-900 dark:text-white">{job.salary}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="size-8 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
                  <Briefcase className="size-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-500 dark:text-slate-400">Experience Needed</p>
                  <p className="font-extrabold text-slate-900 dark:text-white">{job.experience}</p>
                </div>
              </div>

              {isAdmin && typeof applicantsCount === "number" && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="size-8 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-500 dark:text-slate-400">Applicants</p>
                    <p className="font-extrabold text-slate-900 dark:text-white">{applicantsCount} candidates</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <MenstrualLeaveChampionBadge />
            </div>
          </DashboardCard>

          {/* About Company Card */}
          <DashboardCard className="p-5">
            <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">
              About {job.company}
            </h2>
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              {job.companyDescription ?? `${job.company} is a leading enterprise focusing on progressive workplace opportunities.`}
            </p>
            {job.companyWebsite && (
              <a
                href={job.companyWebsite.startsWith("http") ? job.companyWebsite : `https://${job.companyWebsite}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6B2C91] hover:underline dark:text-pink-200"
              >
                <Globe className="size-3.5" />
                Visit Website
              </a>
            )}
          </DashboardCard>

          {/* Recruiter Card -- Issue 4/5: Job Details previously had no
              recruiter/poster info at all (the underlying list-derived fetch
              never carried job.recruiter). */}
          {job.recruiter && (
            <DashboardCard className="p-5">
              <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">
                Posted By
              </h2>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-[#6B2C91] to-pink-600 text-white flex items-center justify-center shrink-0 font-black text-sm">
                  {job.recruiter.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || <User className="size-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {job.recruiter.name}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 truncate">
                    {job.recruiter.jobTitle} · {job.company}
                  </p>
                  {job.recruiter.email && (
                    <a
                      href={`mailto:${job.recruiter.email}`}
                      className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#6B2C91] hover:underline dark:text-pink-200 truncate"
                    >
                      <Mail className="size-3" />
                      {job.recruiter.email}
                    </a>
                  )}
                </div>
              </div>
            </DashboardCard>
          )}

          {/* Moderation History -- admin variant only . */}
          {isAdmin && moderationHistory && moderationHistory.length > 0 && (
            <DashboardCard className="p-5">
              <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-1.5">
                <History className="size-4 text-[#6B2C91]" />
                Moderation History
              </h2>
              <ul className="space-y-3">
                {moderationHistory.map((entry, i) => (
                  <li key={i} className="text-xs border-l-2 border-slate-200 dark:border-slate-800 pl-3">
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {entry.status.replace(/_/g, " ")}
                      <span className="ml-1.5 font-semibold text-slate-400">by {entry.changedBy}</span>
                    </p>
                    {entry.notes && (
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{entry.notes}</p>
                    )}
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </DashboardCard>
          )}

          {/* Related Jobs Section -- candidate variant only. */}
          {!isAdmin && (
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
                Related Opportunities
              </h2>
              {relatedJobs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No related jobs found.</p>
              ) : (
                <div className="grid gap-4">
                  {relatedJobs.map((rJob) => (
                    <JobCard
                      key={rJob.id}
                      job={rJob}
                      isSaved={savedJobsList.includes(rJob.id)}
                      isApplied={appliedJobsList.includes(rJob.id)}
                      onSave={onSaveJobId}
                      onApply={onApplyJobId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions Bar (visible on mobile/tablet, hidden on
          desktop) -- candidate variant only. */}
      {!isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200/80 p-4 flex gap-3 shadow-[0_-10px_35px_rgba(15,23,42,0.08)] lg:hidden dark:bg-slate-950/95 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            className={cn(
              "h-11 w-12 p-0 border-slate-200 dark:border-slate-800 shrink-0",
              isSaved && "text-[#6B2C91] bg-violet-50/50 dark:text-pink-200"
            )}
            aria-label={isSaved ? "Unsave job" : "Save job"}
          >
            <Bookmark className={cn("size-5", isSaved && "fill-current")} />
          </Button>
          <Button
            type="button"
            onClick={onApply}
            disabled={isApplied}
            className={cn(
              "h-11 flex-1 font-extrabold transition-all text-sm",
              isApplied
                ? "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                : "bg-[#6B2C91] text-white hover:bg-[#5a237b]"
            )}
          >
            {isApplied ? "Applied" : "Apply Now"}
          </Button>
        </div>
      )}
    </div>
  )
}
