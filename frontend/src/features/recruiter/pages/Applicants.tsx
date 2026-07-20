import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Search,
  Download,
  Eye,
  Mail,
  CheckCircle,
  FileDown,
  X,
  CalendarClock,
  Gift,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { DataTable, type ColumnDef } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { RecruiterApi, type ApplicantRow } from "../services/recruiterApi"
import { ScheduleInterviewModal, type ScheduleInterviewSubject } from "../components/ScheduleInterviewModal"

export function Applicants() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const jobIdParam = searchParams.get("jobId")

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [jobFilter, setJobFilter] = useState<string>("All")
  const [sortBy, setSortBy] = useState<"date" | "name">("date")
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [applicants, setApplicants] = useState<ApplicantRow[]>([])

  // Interview scheduling modal state -- Issue 1: now delegated entirely to
  // the shared ScheduleInterviewModal (full Timezone/Mode/Meeting
  // Link/Venue/Notes field set) instead of a duplicated inline modal.
  const [schedulingSubject, setSchedulingSubject] = useState<ScheduleInterviewSubject | null>(null)

  // Offer release modal state
  const [releasingRow, setReleasingRow] = useState<ApplicantRow | null>(null)
  const [offerDetailsText, setOfferDetailsText] = useState("")
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null)
  const [offerSubmitting, setOfferSubmitting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const rows = await RecruiterApi.getApplicants(jobIdParam || undefined)
      setApplicants(rows)
    } catch (err) {
      console.error("Failed to load applicants", err)
      toast.error("Couldn't load applicants. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [jobIdParam])

  useEffect(() => {
    load()
  }, [load])

  // Handle status selector update. "Interview Scheduled" and "Offer Released"
  // need real structured data, so they open a modal instead of setting the
  // status directly -- the backend rejects those two values on this endpoint.
  const handleStatusSelect = (row: ApplicantRow, newStatus: string) => {
    if (newStatus === "Interview Scheduled") {
      setSchedulingSubject({ applicationId: row.id, name: row.name, jobTitle: row.job })
      return
    }
    if (newStatus === "Offer Released") {
      setOfferDetailsText("")
      setOfferLetterFile(null)
      setReleasingRow(row)
      return
    }
    handleUpdateStatus(row.id, newStatus)
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const previous = applicants
    setApplicants((prev) => prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app)))
    try {
      await RecruiterApi.updateApplicantStatus(id, newStatus)
    } catch (err: any) {
      setApplicants(previous)
      toast.error(err?.message || "Couldn't update applicant status.")
    }
  }

  const handleConfirmOffer = async () => {
    if (!releasingRow || !offerDetailsText.trim()) {
      toast.error("Offer details are required.")
      return
    }
    try {
      setOfferSubmitting(true)
      await RecruiterApi.releaseOffer(releasingRow.id, offerDetailsText.trim(), offerLetterFile || undefined)
      toast.success("Offer released and candidate notified.")
      setReleasingRow(null)
      setOfferLetterFile(null)
      load()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't release the offer.")
    } finally {
      setOfferSubmitting(false)
    }
  }

  // Opens the candidate's real uploaded resume (Cloudinary URL) in a new tab.
  // Previously this only flashed a fake "download started" toast without
  // actually opening or fetching any file, real or otherwise.
  const handleDownloadResume = (row: ApplicantRow) => {
    if (!row.resumeUrl) {
      toast.error(`${row.name} has not uploaded a resume yet.`)
      return
    }
    window.open(row.resumeUrl, "_blank", "noopener,noreferrer")
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {/* Status Badge preview */}
            <StatusBadge status={row.status as any} />

            {/* Interactive drop selector */}
            <select
              value={row.status}
              onChange={(e: any) => handleStatusSelect(row, e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-600 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="Applied">Applied</option>
              <option value="Under Review">Under Review</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Interview Scheduled">Interview Scheduled</option>
              <option value="Offer Released">Offer Released</option>
              <option value="Selected">Selected</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          {row.nextInterview && (
            <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
              <CalendarClock className="size-2.5" />
              {row.nextInterview.title} · {new Date(row.nextInterview.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          {row.offerDetails && (
            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 max-w-48 truncate" title={row.offerDetails}>
              <Gift className="size-2.5 shrink-0" />
              {row.offerDetails}
            </p>
          )}
          {row.offerLetterUrl && (
            <a
              href={row.offerLetterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-bold text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 hover:underline"
            >
              <FileDown className="size-2.5 shrink-0" />
              View Offer Letter
            </a>
          )}
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
              <option value="Shortlisted">Shortlisted</option>
              <option value="Interview Scheduled">Interview Scheduled</option>
              <option value="Offer Released">Offer Released</option>
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
          emptyMessage={isLoading ? "Loading applicants..." : "No applicants found matching selected criteria."}
        />
      </DashboardCard>

      {/* Schedule Interview modal */}
      <ScheduleInterviewModal
        subject={schedulingSubject}
        onClose={() => setSchedulingSubject(null)}
        onScheduled={load}
      />

      {/* Release Offer modal */}
      {releasingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Gift className="size-4 text-emerald-600" />
                Release Offer — {releasingRow.name}
              </h3>
              <button onClick={() => setReleasingRow(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Offer Details <span className="text-red-500">*</span></label>
                <textarea
                  value={offerDetailsText}
                  onChange={(e) => setOfferDetailsText(e.target.value)}
                  rows={4}
                  placeholder="e.g. ₹12 LPA, joining date 1st Aug, remote-first role"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Offer Letter (Optional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-[11px] font-semibold text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-[#6B2C91]/10 file:px-2.5 file:py-1.5 file:text-[10px] file:font-black file:text-[#6B2C91] hover:file:bg-[#6B2C91]/20 dark:text-slate-400 dark:file:bg-pink-950/30 dark:file:text-pink-200"
                />
                {offerLetterFile && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{offerLetterFile.name}</p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">PDF, DOC, or DOCX, up to 10MB. Attached automatically to the candidate's notification.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setReleasingRow(null)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmOffer}
                disabled={offerSubmitting}
                className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {offerSubmitting ? "Releasing..." : "Release Offer & Notify"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
