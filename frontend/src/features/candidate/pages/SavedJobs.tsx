import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CandidateJobsApi } from "../services/jobsApi"
import type { ExtendedJob } from "@/types/job"
import { JobCard } from "@/components/dashboard/JobCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { JobCardsSkeleton } from "@/components/dashboard/DashboardSkeletons"

export function SavedJobs() {
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [savedJobs, setSavedJobs] = useState<ExtendedJob[]>([])
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [saved, applications] = await Promise.all([
        CandidateJobsApi.getSavedJobs(),
        CandidateJobsApi.getApplications(),
      ])
      setSavedJobs(saved)
      setAppliedJobIds(applications.map((a: any) => a.jobId))
    } catch (err) {
      console.error("Failed to load saved jobs", err)
      toast.error("Couldn't load saved jobs. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleUnsave = async (id: string) => {
    const previous = savedJobs
    setSavedJobs((prev) => prev.filter((job) => job.id !== id))
    try {
      await CandidateJobsApi.unsaveJob(id)
    } catch {
      setSavedJobs(previous)
      toast.error("Couldn't remove this job. Please try again.")
    }
  }

  const handleApply = async (id: string) => {
    if (appliedJobIds.includes(id)) return
    try {
      await CandidateJobsApi.applyToJob(id)
      setAppliedJobIds((prev) => [...prev, id])
      toast.success("Application submitted successfully.")
    } catch (err: any) {
      toast.error(err?.message || "Couldn't submit your application. Please try again.")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Saved Opportunities
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Review and apply to roles you have bookmarked.
        </p>
      </div>

      {isLoading ? (
        <JobCardsSkeleton />
      ) : savedJobs.length > 0 ? (
        <motion.div
          layout
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {savedJobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.2 }}
              >
                <JobCard
                  job={job}
                  isSaved={true}
                  isApplied={appliedJobIds.includes(job.id)}
                  onSave={handleUnsave}
                  onApply={handleApply}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="py-12">
          <EmptyState
            title="No Saved Jobs"
            description="You haven't bookmarked any opportunities yet. Save roles from the browse careers page to compare them here."
            actionLabel="Browse Available Careers"
            onActionClick={() => navigate("/jobs")}
          />
        </div>
      )}
    </motion.div>
  )
}
