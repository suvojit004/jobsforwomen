import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { mockJobs } from "../mock/jobsMock"
import { JobDetailContent } from "../components/Jobs/JobDetailContent"
import { EmptyState } from "@/components/shared/EmptyState"

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Sync state with local storage
  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    const saved = localStorage.getItem("savedJobs")
    return saved ? JSON.parse(saved) : []
  })

  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const applied = localStorage.getItem("appliedJobs")
    return applied ? JSON.parse(applied) : []
  })

  // Re-read local storage on ID change to stay in sync
  useEffect(() => {
    const saved = localStorage.getItem("savedJobs")
    if (saved) setSavedJobs(JSON.parse(saved))
    
    const applied = localStorage.getItem("appliedJobs")
    if (applied) setAppliedJobs(JSON.parse(applied))
  }, [id])

  const job = mockJobs.find((j) => j.id === id)

  if (!job) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-12"
      >
        <EmptyState
          title="Opportunity Not Found"
          description="We couldn't locate this job opportunity. It might have expired or been removed by the employer."
          actionLabel="Browse Available Jobs"
        />
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate("/jobs")}
            className="text-xs font-bold text-[#6B2C91] hover:underline dark:text-pink-200"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    )
  }

  // Related jobs: jobs in the same company or similar titles (excluding current job)
  let related = mockJobs.filter(
    (j) => j.id !== job.id && (j.company === job.company || j.title.split(" ")[0] === job.title.split(" ")[0])
  )
  if (related.length < 2) {
    // Fallback: grab any other jobs to populate the sidebar
    related = [...related, ...mockJobs.filter((j) => j.id !== job.id && !related.some((r) => r.id === j.id))].slice(0, 2)
  } else {
    related = related.slice(0, 2)
  }

  const handleSaveToggle = (jobId: string) => {
    let updated: string[]
    if (savedJobs.includes(jobId)) {
      updated = savedJobs.filter((sId) => sId !== jobId)
    } else {
      updated = [...savedJobs, jobId]
    }
    setSavedJobs(updated)
    localStorage.setItem("savedJobs", JSON.stringify(updated))
  }

  const handleApply = (jobId: string) => {
    if (!appliedJobs.includes(jobId)) {
      const updated = [...appliedJobs, jobId]
      setAppliedJobs(updated)
      localStorage.setItem("appliedJobs", JSON.stringify(updated))

      // Also record in applications schema to show up on My Applications page
      const storedApps = localStorage.getItem("customApplications")
      const apps = storedApps ? JSON.parse(storedApps) : []
      const jobDetails = mockJobs.find((j) => j.id === jobId)
      if (jobDetails && !apps.some((a: { id: string }) => a.id === jobId)) {
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
      className="pb-24 lg:pb-0" // Add padding to bottom on mobile so sticky bar does not overlap content
    >
      <JobDetailContent
        job={job}
        isSaved={savedJobs.includes(job.id)}
        isApplied={appliedJobs.includes(job.id)}
        onSave={() => handleSaveToggle(job.id)}
        onApply={() => handleApply(job.id)}
        relatedJobs={related}
        savedJobsList={savedJobs}
        appliedJobsList={appliedJobs}
        onSaveJobId={handleSaveToggle}
        onApplyJobId={handleApply}
      />
    </motion.div>
  )
}
