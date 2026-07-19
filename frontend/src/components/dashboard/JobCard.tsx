import { memo } from "react"
import { Bookmark, MapPin, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import { MenstrualLeaveChampionBadge } from "@/components/shared/MenstrualLeaveChampionBadge"
import type { Job } from "@/types/dashboard"
import { cn } from "@/lib/utils"

type JobCardProps = {
  job: Job
  isSaved?: boolean
  isApplied?: boolean
  isLoading?: boolean
  onSave?: (id: string) => void
  onApply?: (id: string) => void
}

function JobCardComponent({
  job,
  isSaved = false,
  isApplied = false,
  isLoading = false,
  onSave,
  onApply,
}: JobCardProps) {
  const navigate = useNavigate()
  // CONFIRMED BUG (fixed here): this linked to "/jobs/:id", a bare top-level
  // path that matches no registered route -- JobDetails is only mounted at
  // "/candidate/jobs/:id" (see CandidateRoutes.tsx, nested under the
  // "/candidate/*" ProtectedRoute in AppRouter.tsx). Clicking it silently
  // fell through to AppRouter's catch-all (`Navigate to="/dashboard"`),
  // which is exactly why "clicking the card does nothing" -- it did
  // something, just not what anyone could see, since it round-tripped back
  // to a dashboard-ish page. Also widened from "only the title text is a
  // link" to the whole card being clickable + an explicit View Details
  // affordance, per spec ("Clicking anywhere on the card or View Details
  // should open Job Details").
  const detailsHref = `/candidate/jobs/${job.id}`
  const openDetails = () => navigate(detailsHref)

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={openDetails}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openDetails()
        }
      }}
      className="cursor-pointer rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_16px_34px_rgba(107,44,145,0.13)] dark:border-slate-800 dark:bg-slate-900/72 dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-start gap-3">
        <CompanyLogo code={job.companyCode} tone={job.logoTone} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-slate-950 dark:text-white hover:text-[#6B2C91] dark:hover:text-pink-200 transition-colors">
            <Link to={detailsHref} onClick={(e) => e.stopPropagation()}>{job.title}</Link>
          </h3>
          <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
            {job.company}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {job.postedAt}
          </p>
        </div>
        <motion.div whileHover={{ rotate: -7 }} whileTap={{ scale: 0.82 }}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation()
              onSave?.(job.id)
            }}
            className={cn(
              "shrink-0 transition-colors hover:text-[#6B2C91] dark:hover:text-pink-200",
              isSaved && "text-[#6B2C91] dark:text-pink-200"
            )}
            aria-label={`Save ${job.title} at ${job.company}`}
          >
            <Bookmark className={cn("size-4", isSaved && "fill-current")} />
          </Button>
        </motion.div>
      </div>

      <div className="mt-4">
        <MenstrualLeaveChampionBadge />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-bold",
            job.workMode === "Remote"
              ? "bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100"
              : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200"
          )}
        >
          {job.workMode}
        </span>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
          {job.type}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950 dark:text-white">
            {job.salary}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="size-3.5" />
            {job.location} · {job.experience}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              openDetails()
            }}
            className="h-9 w-full gap-1 px-4 font-bold text-xs sm:w-auto"
          >
            View Details
            <ArrowRight className="size-3.5" />
          </Button>
          <motion.div
            className="w-full sm:w-auto"
            whileHover={(isApplied || isLoading) ? {} : { scale: 1.04 }}
            whileTap={(isApplied || isLoading) ? {} : { scale: 0.97 }}
          >
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onApply?.(job.id)
              }}
              disabled={isApplied || isLoading}
              className={cn(
                "h-9 w-full px-5 font-extrabold transition-colors sm:w-auto",
                isApplied
                  ? "bg-slate-100 text-slate-500 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  : "bg-[#6B2C91] text-white hover:bg-[#5a237b]"
              )}
            >
              {isLoading ? "Applying..." : isApplied ? "Applied" : "Apply Now"}
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.article>
  )
}

export const JobCard = memo(JobCardComponent)
