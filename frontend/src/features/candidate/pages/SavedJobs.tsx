import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { mockJobs } from "../mock/jobsMock"
import { JobCard } from "@/components/dashboard/JobCard"
import { EmptyState } from "@/components/shared/EmptyState"

export function SavedJobs() {
  const navigate = useNavigate()

  // Load saved and applied jobs from LocalStorage
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("savedJobs")
    return saved ? JSON.parse(saved) : []
  })

  const [appliedJobIds, setAppliedJobIds] = useState<string[]>(() => {
    const applied = localStorage.getItem("appliedJobs")
    return applied ? JSON.parse(applied) : []
  })

  // Get job objects matching saved IDs
  const savedJobs = mockJobs.filter((job) => savedJobIds.includes(job.id))

  const handleUnsave = (id: string) => {
    const updated = savedJobIds.filter((jobId) => jobId !== id)
    setSavedJobIds(updated)
    localStorage.setItem("savedJobs", JSON.stringify(updated))
  }

  const handleApply = (id: string) => {
    if (!appliedJobIds.includes(id)) {
      const updated = [...appliedJobIds, id]
      setAppliedJobIds(updated)
      localStorage.setItem("appliedJobs", JSON.stringify(updated))

      // Sync into applications tracking table in local storage
      const storedApps = localStorage.getItem("customApplications")
      const apps = storedApps ? JSON.parse(storedApps) : []
      const jobDetails = mockJobs.find((j) => j.id === id)
      if (jobDetails && !apps.some((a: { id: string }) => a.id === id)) {
        const newApp = {
          id: jobDetails.id,
          company: jobDetails.company,
          companyCode: jobDetails.companyCode,
          job: jobDetails.title,
          appliedDate: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          status: "Applied",
          recruiter: "Anjali Rao",
        }
        localStorage.setItem("customApplications", JSON.stringify([newApp, ...apps]))
      }
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

      {savedJobs.length > 0 ? (
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
