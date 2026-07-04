import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Search,
  Download,
  Eye,
  Mail,
  CheckCircle,
  FileDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { DataTable, type ColumnDef } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface ApplicantRow {
  id: string // represents the application ID or override key
  name: string
  email: string
  job: string
  appliedDate: string
  status: "Applied" | "Under Review" | "Interview Scheduled" | "Selected" | "Rejected"
}

export function Applicants() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const jobIdParam = searchParams.get("jobId")

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [jobFilter, setJobFilter] = useState<string>("All")
  const [sortBy, setSortBy] = useState<"date" | "name">("date")
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null)

  // Map job ID parameter if pre-filtered from JobDetails "View candidates"
  useEffect(() => {
    if (jobIdParam) {
      // Map job ID to Title
      const jobMap: Record<string, string> = {
        "job-p1": "Frontend Developer",
        "job-p2": "UI/UX Designer",
        "job-p3": "Product Manager",
        "job-p4": "Content Writer",
        "job-p5": "Digital Marketing Executive",
      }
      const matchingTitle = jobMap[jobIdParam]
      if (matchingTitle) {
        setJobFilter(matchingTitle)
      } else if (jobIdParam.startsWith("job-custom-")) {
        // Load custom job title from storage
        const stored = localStorage.getItem("recruiterJobs")
        const customJobs = stored ? JSON.parse(stored) : []
        const match = customJobs.find((j: any) => j.id === jobIdParam)
        if (match) {
          setJobFilter(match.title)
        }
      }
    }
  }, [jobIdParam])

  // Load applicants (combining default applicant logs and custom applications submitted by Priya)
  const [applicants, setApplicants] = useState<ApplicantRow[]>(() => {
    const initialApplicants: ApplicantRow[] = [
      {
        id: "application-1",
        name: "Priya Sharma",
        email: "priya.sharma@example.com",
        job: "Frontend Developer",
        appliedDate: "12 May 2025",
        status: "Applied",
      },
      {
        id: "app-verma",
        name: "Anjali Verma",
        email: "anjali.v@example.com",
        job: "UI/UX Designer",
        appliedDate: "11 May 2025",
        status: "Under Review",
      },
      {
        id: "app-singh",
        name: "Neha Singh",
        email: "neha.singh@example.com",
        job: "Frontend Developer",
        appliedDate: "10 May 2025",
        status: "Interview Scheduled",
      },
      {
        id: "app-patel",
        name: "Riya Patel",
        email: "riya.patel@example.com",
        job: "Content Writer",
        appliedDate: "09 May 2025",
        status: "Selected",
      },
      {
        id: "app-khan",
        name: "Ayesha Khan",
        email: "ayesha.khan@example.com",
        job: "Frontend Developer",
        appliedDate: "08 May 2025",
        status: "Rejected",
      },
    ]

    // Read custom candidate applications from localStorage (submitted by candidate Priya Sharma)
    const storedAppsStr = localStorage.getItem("customApplications")
    const customApps = storedAppsStr ? JSON.parse(storedAppsStr) : []
    
    // Convert to Applicant rows (if the application ID is not already represented by default apps)
    const customApplicantRows = customApps
      .filter((app: any) => app.id !== "application-1")
      .map((app: any) => ({
        id: app.id,
        name: "Priya Sharma",
        email: "priya.sharma@example.com",
        job: app.job,
        appliedDate: app.appliedDate,
        status: app.status || "Applied",
      }))

    // Load status overrides set by the recruiter
    const overridesStr = localStorage.getItem("applicationsOverrides")
    const overrides = overridesStr ? JSON.parse(overridesStr) : []

    const merged = [...customApplicantRows, ...initialApplicants].map((applicant) => {
      const match = overrides.find((o: any) => o.id === applicant.id)
      return match ? { ...applicant, status: match.status } : applicant
    })

    return merged
  })

  // Handle status selector update
  const handleUpdateStatus = (id: string, newStatus: ApplicantRow["status"]) => {
    const updated = applicants.map((app) => {
      if (app.id === id) {
        return { ...app, status: newStatus }
      }
      return app
    })
    setApplicants(updated)

    // Save status overrides to LocalStorage to sync back to candidate applications view
    const overridesStr = localStorage.getItem("applicationsOverrides")
    const overrides = overridesStr ? JSON.parse(overridesStr) : []
    const existingIdx = overrides.findIndex((o: any) => o.id === id)

    if (existingIdx > -1) {
      overrides[existingIdx].status = newStatus
    } else {
      overrides.push({ id, status: newStatus })
    }
    localStorage.setItem("applicationsOverrides", JSON.stringify(overrides))
  }

  // Simulated download resume action
  const handleDownloadResume = (row: ApplicantRow) => {
    setDownloadSuccessId(row.id)
    setTimeout(() => setDownloadSuccessId(null), 2500)
  }

  // Filter and Sort Logic
  const filteredApplicants = applicants
    .filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.job.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === "All" || app.status === statusFilter
      const matchesJob = jobFilter === "All" || app.job === jobFilter

      return matchesSearch && matchesStatus && matchesJob
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name)
      }
      // sort by date (descending, newer first)
      return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
    })

  // Get distinct jobs list for filters
  const uniqueJobs = Array.from(new Set(applicants.map((a) => a.job)))

  // Table Columns Definition
  const columns: ColumnDef<ApplicantRow>[] = [
    {
      header: "Applicant Details",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-[#6B2C91] transition-colors cursor-pointer" onClick={() => navigate(`/recruiter/applicants/${row.id}`)}>
            {row.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-bold dark:text-slate-500">
            <span className="flex items-center gap-0.5 font-bold uppercase truncate max-w-28 sm:max-w-none">
              <Mail className="size-3 shrink-0" />
              {row.email}
            </span>
            <span>•</span>
            <span className="text-[#6B2C91] dark:text-pink-300 uppercase">{row.job}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Applied Date",
      accessorKey: "appliedDate",
      className: "text-slate-500 dark:text-slate-400 font-semibold",
    },
    {
      header: "Application Status",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {/* Status Badge preview */}
          <StatusBadge status={row.status} />

          {/* Interactive drop selector */}
          <select
            value={row.status}
            onChange={(e: any) => handleUpdateStatus(row.id, e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-600 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="Applied">Applied</option>
            <option value="Under Review">Under Review</option>
            <option value="Interview Scheduled">Interview Scheduled</option>
            <option value="Selected">Selected</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/recruiter/applicants/${row.id}`)}
            className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="View Details/Resume"
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDownloadResume(row)}
            className="h-8 w-8 text-slate-400 hover:text-[#6B2C91] dark:hover:text-pink-200"
            title="Download Resume"
          >
            {downloadSuccessId === row.id ? (
              <CheckCircle className="size-3.5 text-emerald-500 stroke-[3]" />
            ) : (
              <Download className="size-3.5" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Manage Applicants
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Search applications, schedule interviews, and select top women candidates.
        </p>
      </div>

      {/* Filter and sorting controls */}
      <DashboardCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates by name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Action Selectors */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Job Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Job Posting</span>
            <select
              value={jobFilter}
              onChange={(e: any) => setJobFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white max-w-44 truncate"
            >
              <option value="All">All Jobs</option>
              {uniqueJobs.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="All">All Statuses</option>
              <option value="Applied">Applied</option>
              <option value="Under Review">Under Review</option>
              <option value="Interview Scheduled">Interview Scheduled</option>
              <option value="Selected">Selected</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Sort</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="date">Applied Date</option>
              <option value="name">Candidate Name</option>
            </select>
          </div>
        </div>
      </DashboardCard>

      {/* Main Applicants DataTable */}
      <DashboardCard className="p-4">
        {downloadSuccessId && (
          <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 select-none border border-emerald-100 dark:border-emerald-950/50">
            <FileDown className="size-4 animate-bounce" />
            Resume download started successfully.
          </div>
        )}
        <DataTable
          columns={columns}
          data={filteredApplicants}
          emptyMessage="No applicants found matching selected criteria."
        />
      </DashboardCard>
    </div>
  )
}
