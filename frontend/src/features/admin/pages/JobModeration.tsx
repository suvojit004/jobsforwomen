import { useState, useEffect } from "react"
import {
  Search,
  AlertTriangle,
  Check,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminService } from "@/services/admin.service"
import type { AdminJob } from "@/services/admin.service"

export function JobModeration() {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "reported" | "hidden">("all")
  const [loading, setLoading] = useState(true)

  const loadJobs = async () => {
    try {
      setLoading(true)
      const data = await AdminService.getJobs()
      setJobs([...data])
    } catch (err) {
      console.error("Failed to load jobs list:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const handleToggleVisibility = async (jobId: string) => {
    const success = await AdminService.toggleJobVisibility(jobId)
    if (success) {
      loadJobs()
    }
  }

  const handleApprove = async (jobId: string) => {
    const success = await AdminService.approveJob(jobId)
    if (success) {
      loadJobs()
    }
  }

  const handleDelete = async (jobId: string) => {
    if (confirm("Are you sure you want to permanently delete this job listing?")) {
      const success = await AdminService.deleteJob(jobId)
      if (success) {
        loadJobs()
      }
    }
  }

  // Filter & Search Logic
  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.company.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (filterMode === "reported") return j.reported
    if (filterMode === "hidden") return j.visibility === "hidden"
    return true
  })

  const columns: ColumnDef<AdminJob>[] = [
    {
      header: "Opportunity Details",
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-white text-xs">{row.title}</span>
            {row.reported && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-pink-700 bg-pink-100 dark:bg-pink-950/40 dark:text-pink-300 px-1.5 py-0.25 rounded">
                <AlertTriangle className="size-2.5" />
                Reported
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{row.company}</p>
        </div>
      ),
    },
    {
      header: "Salary & Location",
      cell: (row) => (
        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <p>{row.location}</p>
          <p className="text-[10px] text-slate-400">{row.salary}</p>
        </div>
      ),
    },
    {
      header: "Applicants",
      cell: (row) => (
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {row.applicantsCount} candidates
        </span>
      ),
    },
    {
      header: "Platform Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.status === "approved"
              ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
              : "bg-pink-100/60 text-pink-850 dark:bg-pink-950/45 dark:text-pink-300"
          }`}
        >
          {row.status === "approved" ? "Approved" : "Flagged"}
        </span>
      ),
    },
    {
      header: "Visibility",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.visibility === "visible"
              ? "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {row.visibility === "visible" ? "Visible" : "Hidden"}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {row.reported && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 border-emerald-250 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950/20"
              onClick={() => handleApprove(row.id)}
            >
              <Check className="size-3 mr-0.5" />
              Approve
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100"
            onClick={() => handleToggleVisibility(row.id)}
          >
            {row.visibility === "visible" ? (
              <>
                <EyeOff className="size-3 mr-0.5" />
                Hide
              </>
            ) : (
              <>
                <Eye className="size-3 mr-0.5" />
                Show
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-[10px] font-bold flex items-center gap-1"
            onClick={() => handleDelete(row.id)}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Job Opportunity Moderation
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Flag, review reported job postings, toggle listing visibility, or purge fraudulent recruiter job logs.
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("all")}
          >
            All Listings
          </Button>
          <Button
            variant={filterMode === "reported" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold flex items-center gap-1"
            onClick={() => setFilterMode("reported")}
          >
            <AlertTriangle className="size-3 text-pink-500" />
            Reported Only
            <span className="ml-1 bg-pink-100 text-pink-700 dark:bg-pink-900/35 dark:text-pink-300 text-[9px] px-1 rounded-full">
              {jobs.filter((j) => j.reported).length}
            </span>
          </Button>
          <Button
            variant={filterMode === "hidden" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("hidden")}
          >
            Hidden Only
          </Button>
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by job title or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Jobs table */}
      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching opportunity logs...
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredJobs}
            emptyMessage="No matching job listings found."
          />
        )}
      </DashboardCard>
    </div>
  )
}
export default JobModeration
