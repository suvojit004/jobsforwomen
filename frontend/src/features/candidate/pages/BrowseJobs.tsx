import { useState, useEffect, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { JobFilters, type FilterState } from "../components/Jobs/JobFilters"
import { Pagination } from "@/components/shared/Pagination"
import { JobCard } from "@/components/dashboard/JobCard"
import { JobCardsSkeleton } from "@/components/dashboard/DashboardSkeletons"
import { EmptyState } from "@/components/shared/EmptyState"
import { mockJobs } from "../mock/jobsMock"

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
  const [isLoading, setIsLoading] = useState(false)
  const [, startTransition] = useTransition()

  // Track saved/applied jobs in LocalStorage to sync across the module
  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    const saved = localStorage.getItem("savedJobs")
    return saved ? JSON.parse(saved) : []
  })

  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const applied = localStorage.getItem("appliedJobs")
    return applied ? JSON.parse(applied) : []
  })

  const [jobs] = useState(() => {
    const storedCustomJobs = localStorage.getItem("recruiterJobs")
    const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []
    const formattedCustomJobs = customJobs.map((job: any) => ({
      id: job.id,
      title: job.title,
      company: "TechNova Solutions",
      companyCode: "TN",
      logoTone: "purple" as const,
      salary: job.salary,
      location: job.location,
      experience: job.experience,
      type: job.type,
      workMode: job.workMode,
      postedAt: job.postedOn,
      womenReturnship: true,
      menstrualLeaveChampion: job.menstrualLeaveChampion,
      flexibleHours: job.flexibleHours,
      workFromHome: job.workFromHome,
      description: job.description || "",
      requirements: Array.isArray(job.requirements)
        ? job.requirements
        : typeof job.requirements === "string"
        ? job.requirements.split("\n").map((r: string) => r.trim()).filter(Boolean)
        : [],
    }))
    return [...formattedCustomJobs, ...mockJobs]
  })

  // Debounce/simulate network loading when filters change
  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 400) // 400ms visual skeleton loading
    return () => clearTimeout(timer)
  }, [filters, currentPage])

  // Filter Logic
  const filteredJobs = jobs.filter((job) => {
    // Search keyword match (title, company, description, requirements)
    if (filters.search) {
      const query = filters.search.toLowerCase()
      const matchesTitle = job.title.toLowerCase().includes(query)
      const matchesCompany = job.company.toLowerCase().includes(query)
      const matchesDesc = job.description.toLowerCase().includes(query)
      const matchesReqs = job.requirements.some((r: string) => r.toLowerCase().includes(query))
      if (!matchesTitle && !matchesCompany && !matchesDesc && !matchesReqs) {
        return false
      }
    }

    // Work Mode match
    if (filters.workMode !== "All" && job.workMode !== filters.workMode) {
      return false
    }

    // Job Type match
    if (filters.jobType !== "All" && job.type !== filters.jobType) {
      return false
    }

    // Experience level match
    if (filters.experience !== "All") {
      // Direct match or check if job experience contains query
      const expQuery = filters.experience.toLowerCase()
      if (!job.experience.toLowerCase().includes(expQuery)) {
        return false
      }
    }

    // Location match
    if (filters.location !== "All" && job.location !== filters.location) {
      return false
    }

    // Returnship match
    if (filters.womenReturnship && !job.womenReturnship) {
      return false
    }

    // Menstrual leave champion match
    if (filters.menstrualLeaveChampion && !job.menstrualLeaveChampion) {
      return false
    }

    return true
  })

  // Pagination Logic
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE)
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

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

  const handleSaveJob = (id: string) => {
    let updated: string[]
    if (savedJobs.includes(id)) {
      updated = savedJobs.filter((savedId) => savedId !== id)
    } else {
      updated = [...savedJobs, id]
    }
    setSavedJobs(updated)
    localStorage.setItem("savedJobs", JSON.stringify(updated))
  }

  const handleApplyJob = (id: string) => {
    if (!appliedJobs.includes(id)) {
      const updated = [...appliedJobs, id]
      setAppliedJobs(updated)
      localStorage.setItem("appliedJobs", JSON.stringify(updated))

      // Also record in applications schema to show up on My Applications page
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
        ) : filteredJobs.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredJobs.length)} of{" "}
                {filteredJobs.length} opportunities
              </span>
            </div>

            <motion.div
              layout
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {paginatedJobs.map((job) => (
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
            />
          </div>
        )}
      </div>
    </div>
  )
}
