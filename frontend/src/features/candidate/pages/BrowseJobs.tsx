import { useState, useEffect, useTransition, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { JobFilters, type FilterState } from "../components/Jobs/JobFilters"
import { Pagination } from "@/components/shared/Pagination"
import { JobCard } from "@/components/dashboard/JobCard"
import { JobCardsSkeleton } from "@/components/dashboard/DashboardSkeletons"
import { EmptyState } from "@/components/shared/EmptyState"
import { CandidateJobsApi } from "../services/jobsApi"
import type { ExtendedJob } from "@/types/job"

const ITEMS_PER_PAGE = 6

const initialFilters: FilterState = {
  search: "",
  workMode: "All",
  jobType: "All",
  experience: "All",
  location: "All",
  womenReturnship: false,
  menstrualLeaveChampion: false,
}

export function BrowseJobs() {
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [, startTransition] = useTransition()

  const [jobs, setJobs] = useState<ExtendedJob[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [savedJobs, setSavedJobs] = useState<string[]>([])
  const [appliedJobs, setAppliedJobs] = useState<string[]>([])

  const loadJobs = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await CandidateJobsApi.getJobs(
        {
          search: filters.search || undefined,
          location: filters.location !== "All" ? filters.location : undefined,
          type: filters.jobType !== "All" ? filters.jobType : undefined,
          menstrualLeaveChampion: filters.menstrualLeaveChampion || undefined,
        },
        currentPage,
        ITEMS_PER_PAGE
      )

      // Backend doesn't yet support workMode / experience / womenReturnship
      // filters server-side, so refine the page we got client-side.
      const refined = result.jobs.filter((job) => {
        if (filters.workMode !== "All" && job.workMode !== filters.workMode) return false
        if (filters.experience !== "All" && !job.experience.toLowerCase().includes(filters.experience.toLowerCase())) return false
        if (filters.womenReturnship && !job.womenReturnship) return false
        return true
      })

      setJobs(refined)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error("Failed to load jobs", err)
      toast.error("Couldn't load job listings. Please try again.")
      setJobs([])
    } finally {
      setIsLoading(false)
    }
  }, [filters, currentPage])

  const loadSavedJobs = useCallback(async () => {
    try {
      const saved = await CandidateJobsApi.getSavedJobs()
      setSavedJobs(saved.map((j) => j.id))
    } catch {
      // Non-fatal - saved state simply won't be pre-populated
    }
  }, [])

  const loadAppliedJobs = useCallback(async () => {
    try {
      const applications = await CandidateJobsApi.getApplications()
      setAppliedJobs(applications.map((a: any) => a.jobId))
    } catch {
      // Non-fatal - applied state simply won't be pre-populated
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  useEffect(() => {
    loadSavedJobs()
    loadAppliedJobs()
  }, [loadSavedJobs, loadAppliedJobs])

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    startTransition(() => {
      setFilters((prev) => ({ ...prev, ...newFilters }))
      setCurrentPage(1) // Reset page on filter change
    })
  }

  const handleClearFilters = () => {
    setFilters(initialFilters)
    setCurrentPage(1)
  }

  const handleSaveJob = async (id: string) => {
    const wasSaved = savedJobs.includes(id)
    setSavedJobs((prev) => (wasSaved ? prev.filter((sId) => sId !== id) : [...prev, id]))
    try {
      if (wasSaved) {
        await CandidateJobsApi.unsaveJob(id)
      } else {
        await CandidateJobsApi.saveJob(id)
      }
    } catch (err) {
      // Revert on failure
      setSavedJobs((prev) => (wasSaved ? [...prev, id] : prev.filter((sId) => sId !== id)))
      toast.error("Couldn't update saved jobs. Please try again.")
    }
  }

  const handleApplyJob = async (id: string) => {
    if (appliedJobs.includes(id)) return
    try {
      await CandidateJobsApi.applyToJob(id)
      setAppliedJobs((prev) => [...prev, id])
      toast.success("Application submitted successfully.")
    } catch (err: any) {
      toast.error(err?.message || "Couldn't submit your application. Please try again.")
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Explore Careers
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Find matching opportunities with progressive corporate benefits.
        </p>
      </div>

      {/* Filters Card */}
      <JobFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Jobs grid section */}
      <div className="relative min-h-[400px]">
        {isLoading ? (
          <div className="py-4">
            <JobCardsSkeleton />
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, total)} of{" "}
                {total} opportunities
              </span>
            </div>

            <motion.div
              layout
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    <JobCard
                      job={job}
                      isSaved={savedJobs.includes(job.id)}
                      isApplied={appliedJobs.includes(job.id)}
                      onSave={handleSaveJob}
                      onApply={handleApplyJob}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination Component */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              title="No Opportunities Found"
              description="We couldn't find any job listing matching your current filter set. Try resetting or adjusting your search queries."
              actionLabel="Reset Search Filters"
              onActionClick={handleClearFilters}
            />
          </div>
        )}
      </div>
    </div>
  )
}
