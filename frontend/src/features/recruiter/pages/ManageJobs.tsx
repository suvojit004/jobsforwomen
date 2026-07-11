import { useState, useEffect, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Play,
  Trash2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { DataTable, type ColumnDef } from "@/components/shared/DataTable"
import { cn } from "@/lib/utils"
import { RecruiterApi, type RecruiterJobRow } from "../services/recruiterApi"

// Backend job statuses map to a simplified display status for this table.
function toDisplayStatus(status: string): "Active" | "Paused" | "Closed" {
  if (status === "approved") return "Active"
  if (status === "paused") return "Paused"
  return "Closed" // draft, pending_approval, closed, archived, flagged
}

export function ManageJobs() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Paused" | "Closed">("All")
  const [workModeFilter, setWorkModeFilter] = useState<"All" | "Remote" | "Hybrid" | "On-site">("All")
  const [sortBy, setSortBy] = useState<"date" | "title" | "applicants">("date")
  const [isLoading, setIsLoading] = useState(true)
  const [jobs, setJobs] = useState<RecruiterJobRow[]>([])

  const loadJobs = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await RecruiterApi.getJobs()
      setJobs(result)
    } catch (err) {
      console.error("Failed to load job postings", err)
      toast.error("Couldn't load your job postings. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Toggle Job Status (Active <-> Paused) via lifecycle action
  const handleToggleStatus = async (job: RecruiterJobRow) => {
    const displayStatus = toDisplayStatus(job.status)
    const action = displayStatus === "Active" ? "pause" : "resume"
    try {
      await RecruiterApi.setJobLifecycle(job.id, action)
      toast.success(displayStatus === "Active" ? "Job posting paused." : "Job posting resumed.")
      loadJobs()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't update this job posting.")
    }
  }

  // Delete Job Posting
  const handleDeleteJob = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job posting? This cannot be undone.")) return
    try {
      await RecruiterApi.deleteJob(id)
      setJobs((prev) => prev.filter((job) => job.id !== id))
      toast.success("Job posting deleted.")
    } catch (err: any) {
      toast.error(err?.message || "Couldn't delete this job posting.")
    }
  }

  // Filter and Sort Logic
  const filteredJobs = jobs
    .filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === "All" || toDisplayStatus(job.status) === statusFilter
      const matchesWorkMode = workModeFilter === "All" || job.workMode === workModeFilter

      return matchesSearch && matchesStatus && matchesWorkMode
    })
    .sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === "applicants") {
        return b.applicants - a.applicants
      }
      // sort by date (descending, newer first)
      return new Date(b.postedOn).getTime() - new Date(a.postedOn).getTime()
    })

  // Table Columns Definition
  const columns: ColumnDef<RecruiterJobRow>[] = [
    {
      header: "Opportunity Details",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-[#6B2C91] transition-colors">
            <Link to={`/recruiter/jobs/${row.id}`}>{row.title}</Link>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-bold dark:text-slate-500">
            <span className="uppercase">{row.department}</span>
            <span>•</span>
            <span>{row.location}</span>
            <span>({row.workMode})</span>
          </div>
        </div>
      ),
    },
    {
      header: "Employment",
      cell: (row) => (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {row.type}
        </span>
      ),
    },
    {
      header: "Applicants",
      cell: (row) => (
        <span className="text-sm font-black text-slate-800 dark:text-slate-200">
          {String(row.applicants).padStart(2, "0")}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        const displayStatus = toDisplayStatus(row.status)
        const statusMap = {
          Active: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
          Paused: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
          Closed: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400",
        }
        return (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-black ring-1 ring-inset uppercase",
              statusMap[displayStatus]
            )}
          >
            {row.status === "pending_approval" ? "Pending Approval" : displayStatus}
          </span>
        )
      },
    },
    {
      header: "Posted On",
      accessorKey: "postedOn",
      className: "hidden md:table-cell text-slate-500 dark:text-slate-400 font-semibold",
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => {
        const displayStatus = toDisplayStatus(row.status)
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/recruiter/jobs/${row.id}`)}
              className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="View Details"
            >
              <Eye className="size-3.5" />
            </Button>
            {displayStatus !== "Closed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleStatus(row)}
                className={cn(
                  "h-8 w-8 text-slate-400",
                  displayStatus === "Active" ? "hover:text-amber-600" : "hover:text-emerald-600"
                )}
                title={displayStatus === "Active" ? "Pause Posting" : "Activate Posting"}
              >
                {displayStatus === "Active" ? <Play className="size-3.5 rotate-180" /> : <Play className="size-3.5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteJob(row.id)}
              className="h-8 w-8 text-slate-400 hover:text-red-600"
              title="Delete Posting"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
            Manage Job Postings
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Modify listings, toggle status, and inspect application pipelines.
          </p>
        </div>
        <Button
          onClick={() => navigate("/recruiter/post-job")}
          className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-10 px-5 font-extrabold text-xs gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700 shrink-0 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          Post a New Job
        </Button>
      </div>

      {/* Search & Filtering Panel */}
      <DashboardCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search postings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Work Mode Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Mode</span>
            <select
              value={workModeFilter}
              onChange={(e: any) => setWorkModeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="All">All Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Sort</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="date">Date Posted</option>
              <option value="title">Job Title</option>
              <option value="applicants">Applicant Count</option>
            </select>
          </div>
        </div>
      </DashboardCard>

      {/* DataTable Container */}
      <DashboardCard className="p-4">
        <DataTable
          columns={columns}
          data={filteredJobs}
          emptyMessage={isLoading ? "Loading job postings..." : "No job postings match your filters."}
        />
      </DashboardCard>
    </div>
  )
}
