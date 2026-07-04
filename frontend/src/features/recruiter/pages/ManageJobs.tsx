import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  Search,
  Plus,
  Play,
  Pause,
  Trash2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { DataTable, type ColumnDef } from "@/components/shared/DataTable"
import { cn } from "@/lib/utils"

interface JobListing {
  id: string
  title: string
  department: string
  workMode: "Remote" | "Hybrid" | "On-site"
  type: string
  location: string
  applicants: number
  status: "Active" | "Paused" | "Closed"
  postedOn: string
}

export function ManageJobs() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Paused" | "Closed">("All")
  const [workModeFilter, setWorkModeFilter] = useState<"All" | "Remote" | "Hybrid" | "On-site">("All")
  const [sortBy, setSortBy] = useState<"date" | "title" | "applicants">("date")

  // Load recruiter job list
  const [jobs, setJobs] = useState<JobListing[]>(() => {
    const initialJobs: JobListing[] = [
      {
        id: "job-p1",
        title: "Frontend Developer",
        department: "Engineering",
        workMode: "Remote",
        type: "Full Time",
        location: "Remote",
        applicants: 15,
        status: "Active",
        postedOn: "12 May 2025",
      },
      {
        id: "job-p2",
        title: "UI/UX Designer",
        department: "Design",
        workMode: "Hybrid",
        type: "Full Time",
        location: "Bengaluru",
        applicants: 12,
        status: "Active",
        postedOn: "11 May 2025",
      },
      {
        id: "job-p3",
        title: "Product Manager",
        department: "Management",
        workMode: "On-site",
        type: "Full Time",
        location: "Bengaluru",
        applicants: 9,
        status: "Active",
        postedOn: "08 May 2025",
      },
      {
        id: "job-p4",
        title: "Content Writer",
        department: "Marketing",
        workMode: "Remote",
        type: "Part Time",
        location: "Remote",
        applicants: 6,
        status: "Paused",
        postedOn: "05 May 2025",
      },
      {
        id: "job-p5",
        title: "Digital Marketing Executive",
        department: "Marketing",
        workMode: "Hybrid",
        type: "Full Time",
        location: "Bengaluru",
        applicants: 6,
        status: "Active",
        postedOn: "02 May 2025",
      },
    ]

    const storedCustomJobs = localStorage.getItem("recruiterJobs")
    const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []
    const formattedCustomJobs = customJobs.map((job: any) => ({
      id: job.id,
      title: job.title,
      department: job.department || "General",
      workMode: job.workMode,
      type: job.type || "Full Time",
      location: job.location,
      applicants: job.applicants || 0,
      status: job.status || "Active",
      postedOn: job.postedOn,
    }))

    // Merge custom jobs overrides if any stored in state overrides
    const storedOverrides = localStorage.getItem("recruiterJobsOverrides")
    if (storedOverrides) {
      const overrides = JSON.parse(storedOverrides)
      // apply overrides to initialJobs
      const overriddenInitialJobs = initialJobs.map(job => {
        const match = overrides.find((o: any) => o.id === job.id)
        return match ? { ...job, ...match } : job
      })
      return [...formattedCustomJobs, ...overriddenInitialJobs]
    }

    return [...formattedCustomJobs, ...initialJobs]
  })

  // Synchronize changes to LocalStorage
  const saveJobsState = (updatedJobs: JobListing[]) => {
    setJobs(updatedJobs)

    // Separate custom jobs from default mock jobs
    const customJobs = updatedJobs.filter((job) => job.id.startsWith("job-custom-"))
    localStorage.setItem("recruiterJobs", JSON.stringify(customJobs))

    // Store overrides for default mock jobs
    const mockOverrides = updatedJobs
      .filter((job) => !job.id.startsWith("job-custom-"))
      .map((job) => ({
        id: job.id,
        status: job.status,
      }))
    localStorage.setItem("recruiterJobsOverrides", JSON.stringify(mockOverrides))
  }

  // Toggle Job Status (Active <-> Paused)
  const handleToggleStatus = (id: string) => {
    const updated = jobs.map((job) => {
      if (job.id === id) {
        const nextStatus = job.status === "Active" ? "Paused" : "Active"
        return { ...job, status: nextStatus as "Active" | "Paused" }
      }
      return job
    })
    saveJobsState(updated)
  }

  // Delete Job Posting
  const handleDeleteJob = (id: string) => {
    if (confirm("Are you sure you want to delete this job posting? This cannot be undone.")) {
      const updated = jobs.filter((job) => job.id !== id)
      saveJobsState(updated)
    }
  }

  // Filter and Sort Logic
  const filteredJobs = jobs
    .filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === "All" || job.status === statusFilter
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
  const columns: ColumnDef<JobListing>[] = [
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
        const statusMap = {
          Active: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
          Paused: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
          Closed: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400",
        }
        return (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-black ring-1 ring-inset uppercase",
              statusMap[row.status]
            )}
          >
            {row.status}
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
      cell: (row) => (
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleToggleStatus(row.id)}
            className={cn(
              "h-8 w-8 text-slate-400",
              row.status === "Active" ? "hover:text-amber-600" : "hover:text-emerald-600"
            )}
            title={row.status === "Active" ? "Pause Posting" : "Activate Posting"}
          >
            {row.status === "Active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
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
      ),
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
          emptyMessage="No job postings match your filters."
        />
      </DashboardCard>
    </div>
  )
}
