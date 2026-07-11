import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { CandidateJobsApi } from "../services/jobsApi"
import type { ExtendedJob } from "@/types/job"
import { JobDetailContent } from "../components/Jobs/JobDetailContent"
import { EmptyState } from "@/components/shared/EmptyState"

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<ExtendedJob | null | undefined>(undefined)
  const [related, setRelated] = useState<ExtendedJob[]>([])
  const [savedJobs, setSavedJobs] = useState<string[]>([])
  const [appliedJobs, setAppliedJobs] = useState<string[]>([])

  const loadJob = useCallback(async () => {
    if (!id) return
    try {
      const [found, savedList, applications, allJobs] = await Promise.all([
        CandidateJobsApi.getJobById(id),
        CandidateJobsApi.getSavedJobs(),
        CandidateJobsApi.getApplications(),
        CandidateJobsApi.getJobs({}, 1, 50),
      ])

      setJob(found || null)
      setSavedJobs(savedList.map((j) => j.id))
      setAppliedJobs(applications.map((a: any) => a.jobId))

      if (found) {
        const others = allJobs.jobs.filter((j) => j.id !== found.id)
        const sameCompany = others.filter((j) => j.company === found.company)
        const rest = others.filter((j) => j.company !== found.company)
        setRelated([...sameCompany, ...rest].slice(0, 2))
      }
    } catch (err) {
      console.error("Failed to load job details", err)
      setJob(null)
    }
  }, [id])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  if (job === undefined) {
    return null
  }

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

  const handleSaveToggle = async (jobId: string) => {
    const wasSaved = savedJobs.includes(jobId)
    setSavedJobs((prev) => (wasSaved ? prev.filter((sId) => sId !== jobId) : [...prev, jobId]))
    try {
      if (wasSaved) {
        await CandidateJobsApi.unsaveJob(jobId)
      } else {
        await CandidateJobsApi.saveJob(jobId)
      }
    } catch {
      setSavedJobs((prev) => (wasSaved ? [...prev, jobId] : prev.filter((sId) => sId !== jobId)))
      toast.error("Couldn't update saved jobs. Please try again.")
    }
  }

  const handleApply = async (jobId: string) => {
    if (appliedJobs.includes(jobId)) return
    try {
      await CandidateJobsApi.applyToJob(jobId)
      setAppliedJobs((prev) => [...prev, jobId])
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
